/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { expandCategorySlug } from "~/lib/utils";
import shuffle from "lodash/shuffle";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import styles from "~/lib/styles";
import { SearchIndexArticle, SearchResultItem, buildSearchSuggestions, getLatestIssueArticles, toSearchResultArticle } from "~/lib/search";
import { loadSearchIndex, warmSearchIndex } from "~/lib/search-client";

const PHOTO_KEYWORDS = ["photo", "image", "graphic"];

const getPhotoLabelForSearch = (article: article, searchTerm: string): "IMAGE" | undefined => {
	const normalized = searchTerm.trim().toLowerCase();
	if (!normalized) return undefined;

	const listed = Array.isArray(article.authors) && article.authors.some(name => name?.trim().toLowerCase() === normalized);
	if (listed) return undefined;

	const info = article.contentInfo;
	if (!info) return undefined;

	const isPhotoCredit = info.split(/\r?\n/).some(line => {
		const lower = line.toLowerCase();
		return lower.includes(normalized) && PHOTO_KEYWORDS.some(keyword => lower.includes(keyword));
	});

	return isPhotoCredit ? "IMAGE" : undefined;
};

const sections = [
	{ value: "Any", label: "Any" },
	{ value: "news-features", label: "NEWS & FEATURES" },
	{ value: "opinions", label: "OPINIONS" },
	{ value: "vanguard", label: "VANGUARD" },
	{ value: "arts-entertainment", label: "ARTS & ENTERTAINMENT" },
	{ value: "sports", label: "SPORTS" },
] as const;

type SortOrder = "newest" | "oldest";
const SEARCH_RESULTS_CACHE_KEY = "tower:search-results:v2";
const SEARCH_RESULTS_TTL_MS = 5 * 60 * 1000;

type SearchResultsCacheEntry = {
	expiry: number;
	data: SearchResultItem[];
};

const searchResultsCache = new Map<string, SearchResultsCacheEntry>();

function getSearchResultsCacheKey(search: string, sort: SortOrder, section: string) {
	return `${search.trim().toLowerCase()}|${sort}|${section}`;
}

function readCachedSearchResults(key: string) {
	const memoryCached = searchResultsCache.get(key);
	if (memoryCached && memoryCached.expiry > Date.now()) return memoryCached.data;

	if (typeof window === "undefined") return null;

	try {
		const raw = sessionStorage.getItem(`${SEARCH_RESULTS_CACHE_KEY}:${key}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SearchResultsCacheEntry;
		if (!parsed?.expiry || parsed.expiry <= Date.now() || !Array.isArray(parsed.data)) return null;
		searchResultsCache.set(key, parsed);
		return parsed.data;
	} catch {
		return null;
	}
}

function writeCachedSearchResults(key: string, data: SearchResultItem[]) {
	const payload: SearchResultsCacheEntry = {
		expiry: Date.now() + SEARCH_RESULTS_TTL_MS,
		data,
	};
	searchResultsCache.set(key, payload);

	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(`${SEARCH_RESULTS_CACHE_KEY}:${key}`, JSON.stringify(payload));
	} catch {
		// non-fatal
	}
}

function getRouterSearch(searchParam: string[] | string | undefined) {
	if (Array.isArray(searchParam)) return searchParam[0] || "";
	return searchParam || "";
}

export default function SearchPage() {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);

	const [index, setIndex] = useState<SearchIndexArticle[]>([]);
	const [indexStatus, setIndexStatus] = useState<"loading" | "ready" | "error">("loading");
	const [manualQuery, setManualQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortOrder>("newest");
	const [selectedSection, setSelectedSection] = useState("Any");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [articles, setArticles] = useState<SearchResultItem[]>([]);
	const [resultsStatus, setResultsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

	const search = getRouterSearch(router.query.search);

	useEffect(() => {
		let cancelled = false;

		loadSearchIndex()
			.then(data => {
				if (cancelled) return;
				setIndex(data);
				setIndexStatus("ready");
			})
			.catch(error => {
				console.error(error);
				if (cancelled) return;
				setIndexStatus("error");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!router.isReady) return;

		setManualQuery(search);
		setSortBy(router.query.sort === "oldest" ? "oldest" : "newest");
		setSelectedSection(typeof router.query.section === "string" ? router.query.section : "Any");
		setActiveIndex(-1);
	}, [router.isReady, router.query.section, router.query.sort, search]);

	const suggestions = useMemo(() => {
		if (!showSuggestions) return [];
		if (manualQuery.trim().length < 2) return [];
		return buildSearchSuggestions(index, manualQuery);
	}, [index, manualQuery, showSuggestions]);

	const sidebarArticles = useMemo(() => shuffle(getLatestIssueArticles(index).map(toSearchResultArticle)).slice(0, 8), [index]);

	useEffect(() => {
		if (!router.isReady) return;
		if (!search.trim()) {
			setArticles([]);
			setResultsStatus("idle");
			return;
		}

		const cacheKey = getSearchResultsCacheKey(search, sortBy, selectedSection);
		const cached = readCachedSearchResults(cacheKey);
		if (cached) {
			setArticles(cached);
			setResultsStatus("ready");
			return;
		}

		const controller = new AbortController();
		setResultsStatus("loading");

		fetch(`/api/search/suggestions?mode=query&q=${encodeURIComponent(search)}&sort=${sortBy}&section=${encodeURIComponent(selectedSection)}`, {
			signal: controller.signal,
		})
			.then(async res => {
				if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
				return (await res.json()) as SearchResultItem[];
			})
			.then(data => {
				writeCachedSearchResults(cacheKey, data);
				setArticles(data);
				setResultsStatus("ready");
			})
			.catch(error => {
				if (error?.name === "AbortError") return;
				console.error(error);
				setResultsStatus("error");
			});

		return () => {
			controller.abort();
		};
	}, [router.isReady, search, selectedSection, sortBy]);

	const updateRoute = (nextSearch: string, nextSort = sortBy, nextSection = selectedSection) => {
		const trimmed = nextSearch.trim();
		const destination = trimmed
			? `/search/${encodeURIComponent(trimmed)}?sort=${nextSort}&section=${nextSection}`
			: `/search?sort=${nextSort}&section=${nextSection}`;

		router.replace(destination, undefined, { shallow: true });
	};

	const handleSearchRedirect = (searchText: string) => {
		updateRoute(searchText);
		setShowSuggestions(false);
	};

	const openSuggestion = (suggestion: (typeof suggestions)[number]) => {
		setShowSuggestions(false);

		if (suggestion.type === "article") {
			handleSearchRedirect(suggestion.title);
			return;
		}

		if (suggestion.type === "crossword") {
			setManualQuery(suggestion.title);
			void router.push(`/games/crossword/${suggestion.id}`);
			return;
		}

		setManualQuery(suggestion.name);
		handleSearchRedirect(suggestion.name);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" || e.key === "Tab") {
			e.preventDefault();
			if (suggestions.length === 0) return;
			setActiveIndex(prev => (prev + 1) % suggestions.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (suggestions.length === 0) return;
			setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
		} else if (e.key === "Enter") {
			if (activeIndex >= 0 && suggestions[activeIndex]) {
				openSuggestion(suggestions[activeIndex]);
			} else {
				handleSearchRedirect(manualQuery);
			}
		}
	};

	return (
		<div className="category search-page">
			<Head>
				<title>{`Search${expandCategorySlug(search) && `: ${expandCategorySlug(search)}`} | The Tower`}</title>
			</Head>

			<style jsx>{`
				.category {
					min-height: 100vh;
				}
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
				}
				.grid {
					display: grid;
					grid-template-columns: 1fr clamp(300px, 26vw, 400px);
					grid-column-gap: 2vw;
				}
				:global(.search-page .article-preview > .category-list-preview) {
					display: grid;
					grid-template-columns: minmax(21rem, 3.5fr) minmax(0, 4fr);
					column-gap: 1.75rem;
					align-items: start;
				}
				:global(.search-page .article-preview.row.category-list .img-wrapper) {
					display: flex;
					justify-content: flex-start;
					margin-right: 0 !important;
				}
				:global(.search-page .article-preview.row.category-list .img-wrapper span) {
					display: block !important;
					width: 100% !important;
				}
				:global(.search-page .article-preview.row.category-list .preview-image) {
					width: 100% !important;
					height: auto !important;
					max-width: 24.5rem !important;
					max-height: 13rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.search-page .article-preview.row.category-list.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				:global(.search-page .article-preview.row.category-list .title) {
					margin-top: 0;
				}
				.grid .sidebar {
					margin-top: 2vh;
					padding-left: 1rem;
					padding-right: 0.6rem;
					border-left: 1px solid gainsboro;
					border-right: none;
					max-width: 400px;
				}
				.status {
					margin: 0.35rem 0 0;
					font-size: 0.92rem;
					color: #6b7280;
					text-align: left;
				}

				@media screen and (max-width: 1000px) {
					.grid .sidebar {
						display: none;
					}
				}
				@media screen and (max-width: 900px) {
					:global(.search-page .article-preview > .category-list-preview) {
						grid-template-columns: 1fr;
						row-gap: 1.5rem;
					}
					:global(.search-page .article-preview.row.category-list .preview-image) {
						max-width: 100% !important;
						max-height: 12rem !important;
					}
				}
				.search-wrap {
					position: relative;
					flex: 1 1 400px;
					min-width: 220px;
					max-width: 900px;
				}
				.search-row {
					display: flex;
					align-items: center;
					gap: 0.6rem;
				}
				.suggestions {
					position: absolute;
					top: calc(100% + 4px);
					left: 0;
					right: 0;
					width: 100%;
					background: white;
					border: 1px solid #ccc;
					border-radius: 5px;
					margin-top: 0.3rem;
					box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
					list-style: none;
					padding: 0;
					max-height: 320px;
					overflow-y: auto;
					z-index: 50;
				}
				.suggestions li {
					padding: 0.5rem 0.75rem;
					cursor: pointer;
					border-bottom: 1px solid #eee;
					text-align: left;
				}
				.suggestions li:hover,
				.suggestions li.active {
					background-color: #f0f0f0;
				}
				.meta {
					font-size: 0.95rem;
					color: #6b7280;
					margin-top: 0.15rem;
					font-weight: 600;
				}
				.meta a {
					text-decoration: underline;
					color: #0070f3;
				}
				.meta a:hover {
					color: #0055cc;
				}
				.icon {
					width: 35px;
					height: 35px;
					font-size: 1.25rem;
					border-radius: 5px 0px 0px 5px;
					color: ${styles.color.primary};
					cursor: text;
					box-sizing: border-box;
					padding: 5px;
					display: grid;
					place-items: center;
				}
				select {
					height: 2.5rem;
					font-size: 1rem;
					padding: 0 0.75rem;
				}
				.filter-container {
					display: flex;
					flex-direction: row;
					flex-wrap: wrap;
					gap: 0.5rem;
					align-items: center;
				}
				.empty-state {
					color: #666;
					font-size: 1rem;
					margin-top: 1rem;
				}
				@media (max-width: 600px) {
					.filter-container {
						flex-direction: column;
						align-items: flex-start;
					}
				}
			`}</style>

			<h1>Search{expandCategorySlug(search) ? `: "${expandCategorySlug(search)}"` : ""}</h1>

			<div
				style={{
					textAlign: "center",
					marginBottom: ".6rem",
					position: "relative",
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: "0.6rem",
					alignItems: "center",
				}}
			>
				<div className="search-wrap">
					<div className="search-row">
						<span className="icon">🔎</span>
						<input
							ref={inputRef}
							type="text"
							value={manualQuery}
							onChange={e => {
								setManualQuery(e.target.value);
								setActiveIndex(-1);
							}}
							onFocus={() => {
								warmSearchIndex();
								setShowSuggestions(true);
							}}
							onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
							onKeyDown={handleKeyDown}
							placeholder="Search articles, titles, authors, or photo credits..."
							style={{
								padding: ".6rem",
								fontSize: "1rem",
								flex: "1 1 200px",
								minWidth: "150px",
								border: "1px solid #ccc",
								borderRadius: "5px",
								width: "100%",
							}}
						/>
					</div>
					{indexStatus === "loading" ? <p className="status">Loading search suggestions...</p> : null}
					{indexStatus === "error" ? <p className="status">Search suggestions are temporarily unavailable.</p> : null}
					{suggestions.length > 0 && showSuggestions && (
						<ul className="suggestions">
							{suggestions.map((suggestion, i) => (
								<li
									key={
										suggestion.type === "article" || suggestion.type === "crossword"
											? `${suggestion.type}-${suggestion.id}`
											: `${suggestion.type}-${suggestion.name}`
									}
									className={i === activeIndex ? "active" : ""}
									onClick={() => openSuggestion(suggestion)}
								>
									<strong>
										{suggestion.type === "article" || suggestion.type === "crossword" ? suggestion.title : suggestion.name}
									</strong>{" "}
									{suggestion.type !== "article" && suggestion.type !== "crossword" ? (
										<span style={{ fontSize: "0.6rem", color: "#777" }}>(Contributor)</span>
									) : null}
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="filter-container">
					<select
						value={sortBy}
						onChange={e => {
							const value = e.target.value as SortOrder;
							setSortBy(value);
							updateRoute(search, value, selectedSection);
						}}
						style={{
							height: "2.5rem",
							minWidth: "10rem",
							borderRadius: "5px",
						}}
					>
						<option value="newest">Sort by: Newest</option>
						<option value="oldest">Sort by: Oldest</option>
					</select>

					<select
						value={selectedSection}
						onChange={e => {
							const value = e.target.value;
							setSelectedSection(value);
							updateRoute(search, sortBy, value);
						}}
						style={{
							height: "2.5rem",
							minWidth: "10rem",
							borderRadius: "5px",
						}}
					>
						{sections.map(sec => (
							<option key={sec.value} value={sec.value}>
								Filter by Section: {sec.label}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="grid">
				<section>
					{!search.trim() ? <p className="empty-state">Enter a search term to explore articles, authors, and photo credits.</p> : null}
					{search.trim() && resultsStatus === "loading" ? <p className="empty-state">Loading results...</p> : null}
					{search.trim() && resultsStatus === "error" ? <p className="empty-state">Search is temporarily unavailable.</p> : null}
					{search.trim() && resultsStatus === "ready" ? (
						<p className="empty-state">
							{articles.length} result{articles.length === 1 ? "" : "s"} found
						</p>
					) : null}
					{articles.map(article => {
						const isCrossword = article.category === "crossword";
						const sectionLabel = sections.find(sec => sec.value === article.category)?.label || article.category;

						return (
							<div key={article.id} style={{ marginBottom: "1.25rem" }}>
								<div className="meta">
									{isCrossword ? null : <Link href={`/category/${encodeURIComponent(article.category)}`}>{sectionLabel}</Link>}
									{!isCrossword ? " - " : ""}
									{new Date(article.year, article.month - 1).toLocaleString("default", {
										month: "long",
										year: "numeric",
									})}
								</div>
								<ArticlePreview
									article={article}
									style="row"
									size="category-list"
									eyebrow={getPhotoLabelForSearch(article, search)}
									showPreviewText
								/>
							</div>
						);
					})}
				</section>

				<section className="sidebar">
					<SidebarArticles sidebar={sidebarArticles} />
				</section>
			</div>
		</div>
	);
}

interface SidebarProps {
	sidebar: article[];
}

function SidebarArticles({ sidebar }: SidebarProps) {
	return (
		<>
			{sidebar.map(article => (
				<ArticlePreview key={article.id} article={article} style="row" size="small" category fit="contain" />
			))}
		</>
	);
}
