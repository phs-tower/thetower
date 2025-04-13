/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesBySearch, getCurrArticles } from "~/lib/queries";
import { expandCategorySlug } from "~/lib/utils";
import shuffle from "lodash/shuffle";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import styles from "~/lib/styles";

// Instead of using a string array for sections, we now define an array of objects with actual category keys
const sections = [
	{ value: "Any", label: "Any" },
	{ value: "news-features", label: "NEWS & FEATURES" },
	{ value: "opinions", label: "OPINIONS" },
	{ value: "vanguard", label: "VANGUARD" },
	{ value: "arts-entertainment", label: "ARTS & ENTERTAINMENT" },
	{ value: "sports", label: "SPORTS" },
];

interface Params {
	params: { search: string };
	query: { sort?: string; section?: string };
}

interface Props {
	search: string;
	articles: article[];
	sidebar: article[];
	sort: "relevance" | "newest" | "oldest";
	section: string;
}

export async function getServerSideProps({ params, query }: Params) {
	const rawSearch = params.search?.[0] || "";
	const sort = query.sort === "oldest" ? "oldest" : query.sort === "newest" ? "newest" : "relevance";
	const section = query.section ?? "Any";

	const sidebarArticles = shuffle(await getCurrArticles());

	// ✅ Don't return articles if search is empty
	if (!rawSearch.trim()) {
		return {
			props: {
				search: "",
				articles: [],
				sidebar: sidebarArticles,
				sort,
				section,
			},
		};
	}

	const all = await getArticlesBySearch(rawSearch);
	const filtered = section === "Any" ? all : all.filter(a => a.category === section);
	const sorted =
		sort === "relevance"
			? filtered
			: [...filtered].sort((a, b) =>
					sort === "newest"
						? b.year !== a.year
							? b.year - a.year
							: b.month - a.month
						: a.year !== b.year
						? a.year - b.year
						: a.month - b.month
			  );

	return {
		props: {
			search: rawSearch,
			articles: sorted,
			sidebar: sidebarArticles,
			sort,
			section,
		},
	};
}

export default function Category({ search, articles, sidebar, sort, section }: Props) {
	const router = useRouter();

	// query and manualQuery: manualQuery holds the latest text input
	const [query, setQuery] = useState(search);
	const [manualQuery, setManualQuery] = useState(search);
	const [suggestions, setSuggestions] = useState<any[]>([]);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [sortBy, setSortBy] = useState<Props["sort"]>(sort);
	// selectedSection stores the category key (e.g. "news-features")
	const [selectedSection, setSelectedSection] = useState(section);
	const [showSuggestions, setShowSuggestions] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);

	// Sidebar caching – cached for 15 minutes using sessionStorage
	const [cachedSidebar, setCachedSidebar] = useState<article[]>([]);
	useEffect(() => {
		const stored = sessionStorage.getItem("tower_sidebar_cache");
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Date.now() < parsed.expiry) {
				setCachedSidebar(parsed.data);
				return;
			}
		}
		sessionStorage.setItem(
			"tower_sidebar_cache",
			JSON.stringify({
				data: sidebar,
				expiry: Date.now() + 15 * 60 * 1000,
			})
		);
		setCachedSidebar(sidebar);
	}, [sidebar]);

	// Fetch suggestions when manualQuery changes (only when input is focused)
	useEffect(() => {
		const trimmed = manualQuery.trim();
		if (trimmed.length > 1 && showSuggestions) {
			fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}&sort=${sortBy}`)
				.then(res => res.json())
				.then(data => {
					setSuggestions(data);
					setActiveIndex(-1);
				})
				.catch(err => console.error(err));
		} else {
			setSuggestions([]);
		}
	}, [manualQuery, sortBy, showSuggestions]);

	// Update URL immediately on filter changes using router.replace
	const updateFilter = (newSort?: Props["sort"], newSection?: string) => {
		const finalSort = newSort ?? sortBy;
		const finalSection = newSection ?? selectedSection;
		// Use router.replace so that navigation happens without adding a new history entry.
		router.replace(`/search/${encodeURIComponent(search)}?sort=${finalSort}&section=${finalSection}`);
	};

	const handleSearchRedirect = (searchText: string) => {
		const encoded = encodeURIComponent(searchText);
		router.replace(`/search/${encoded}?sort=${sortBy}&section=${selectedSection}`);
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
				const s = suggestions[activeIndex];
				// Do not update the text in the search box beyond what the user already typed
				handleSearchRedirect(s.type === "article" ? s.title : s.name);
				setShowSuggestions(false);
			} else {
				handleSearchRedirect(manualQuery);
			}
		}
	};

	return (
		<div className="category">
			<Head>
				<title>{`Search: ${expandCategorySlug(search)} | The Tower`}</title>
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
					grid-template-columns: 2fr 1fr;
					grid-column-gap: 2vw;
				}
				.grid .sidebar {
					margin-top: 2vh;
					padding-left: 1vw;
					padding-right: 1vw;
					border-left: 1px solid gainsboro;
					border-right: 1px solid gainsboro;
				}

				@media screen and (max-width: 1000px) {
					.grid .sidebar {
						display: none;
					}
				}
				.suggestions {
					position: absolute;
					left: 8.5%;
					width: 60%;
					background: white;
					border: 1px solid #ccc;
					border-radius: 5px;
					margin-top: 0.5rem;
					box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
					list-style: none;
					padding: 0;
					z-index: 10;
				}
				.suggestions li {
					padding: 0.8rem 1.2rem;
					cursor: pointer;
					border-bottom: 1px solid #eee;
					text-align: left;
				}
				.suggestions li:hover,
				.suggestions li.active {
					background-color: #f0f0f0;
				}
				.meta {
					font-size: 0.9rem;
					color: #666;
					margin-top: 0.25rem;
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
					font-size: 2rem;
					border-radius: 5px 0px 0px 5px;
					transform: scaleX(-1);
					color: ${styles.color.primary};
					cursor: pointer;
					box-sizing: border-box;
					padding: 5px;
				}
			`}</style>

			<h1>Search: &quot;{expandCategorySlug(search)}&quot;</h1>

			<div style={{ textAlign: "center", marginBottom: "1rem", position: "relative" }}>
				<span className="icon">🔎︎</span>
				<input
					ref={inputRef}
					type="text"
					value={manualQuery}
					onChange={e => {
						setManualQuery(e.target.value);
						setQuery(e.target.value);
						setActiveIndex(-1);
					}}
					onFocus={() => setShowSuggestions(true)}
					onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
					onKeyDown={handleKeyDown}
					placeholder="Search articles, authors, or photo credits..."
					style={{
						padding: "1rem",
						fontSize: "1.5rem",
						width: "60%",
						border: "1px solid #ccc",
						borderRadius: "5px",
					}}
				/>

				<select
					value={sortBy}
					onChange={e => {
						const value = e.target.value as "relevance" | "newest" | "oldest";
						setSortBy(value);
						updateFilter(value, selectedSection);
					}}
					style={{
						marginLeft: "1rem",
						padding: "0.8rem",
						fontSize: "1.4rem",
						borderRadius: "5px",
					}}
				>
					<option value="relevance">Sort by: Relevance</option>
					<option value="newest">Sort by: Newest</option>
					<option value="oldest">Sort by: Oldest</option>
				</select>

				<select
					value={selectedSection}
					onChange={e => {
						const val = e.target.value;
						setSelectedSection(val);
						updateFilter(undefined, val);
					}}
					style={{
						marginLeft: "1rem",
						padding: "0.8rem",
						fontSize: "1.4rem",
						borderRadius: "5px",
						width: "auto",
						maxWidth: "60%",
					}}
				>
					{sections.map(sec => (
						<option key={sec.value} value={sec.value}>
							Filter by Section: {sec.value === "vanguard" ? "Vanguard (Broken)" : sec.label}
						</option>
					))}
				</select>

				{suggestions.length > 0 && showSuggestions && (
					<ul className="suggestions">
						{suggestions.map((s, i) => (
							<li
								key={s.type === "article" ? s.id : `${s.type}-${s.name}`}
								className={i === activeIndex ? "active" : ""}
								onClick={() => {
									const text = s.type === "article" ? s.title : s.name;
									setManualQuery(text);
									handleSearchRedirect(text);
									setShowSuggestions(false);
								}}
							>
								<strong>{s.type === "article" ? s.title : s.name}</strong>{" "}
								{s.type !== "article" && <span style={{ fontSize: "0.9rem", color: "#777" }}>(Contributor)</span>}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="grid">
				<section>
					{articles.map(article => {
						const sectionLabel = sections.find(sec => sec.value === article.category)?.label || article.category;

						return (
							<div key={article.id} style={{ marginBottom: "2rem" }}>
								<div className="meta">
									<Link href={`/category/${encodeURIComponent(article.category)}`}>{sectionLabel}</Link> –{" "}
									{new Date(article.year, article.month - 1).toLocaleString("default", {
										month: "long",
										year: "numeric",
									})}
								</div>
								<ArticlePreview article={article} style="row" size="small" />
							</div>
						);
					})}
				</section>

				<section className="sidebar">
					<SidebarArticles sidebar={cachedSidebar} />
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
				<ArticlePreview key={article.id} article={article} style="row" size="small" category />
			))}
		</>
	);
}
