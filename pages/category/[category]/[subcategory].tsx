/** @format */

import { article } from "@prisma/client";
import shuffle from "lodash/shuffle";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import ArticlePreview from "~/components/preview.client";
import {
	getArticlesBySubcategory,
	getCurrArticles,
	getIdOfNewest,
	getRecommendedSubcategoryArticle,
	getRecommendedSubcategoryArticles,
} from "~/lib/queries";
import styles from "~/lib/styles";
import { expandCategorySlug, shortenText } from "~/lib/utils";
import { GetStaticPaths, GetStaticProps } from "next";
import { ParsedUrlQuery } from "querystring";

interface Params extends ParsedUrlQuery {
	category: string;
	subcategory: string;
}

interface Props {
	category: string;
	subcategory: string;
	articles: article[];
	sidebar: article[];
	recommended: article[];
}

function usesRecommendedList(category: string, subcategory: string) {
	return (
		(category === "opinions" && subcategory === "editorials") ||
		(category === "arts-entertainment" && subcategory === "student-artists") ||
		(category === "sports" && subcategory === "student-athletes")
	);
}

async function getRecommendedArticlesForSubcategory(category: string, subcategory: string) {
	if (category === "vanguard" && subcategory === "articles") {
		const recommended = await getRecommendedSubcategoryArticle(category, subcategory);
		return recommended ? [recommended] : [];
	}

	if (usesRecommendedList(category, subcategory)) {
		return await getRecommendedSubcategoryArticles(category, subcategory);
	}

	return [];
}

function buildPreviewContent(content: string | null | undefined, maxLength: number) {
	if (!content) return "";
	const cleaned = content
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return "";
	return cleaned.length <= maxLength ? cleaned : shortenText(cleaned, maxLength);
}

function toSubcategoryPreviewArticle(item: article, includePreviewText: boolean) {
	return {
		...item,
		content: includePreviewText ? buildPreviewContent(item.content, 320) : "",
	};
}

export const getStaticPaths: GetStaticPaths = async () => {
	return {
		paths: [],
		fallback: "blocking",
	};
};

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	const { category, subcategory } = params!;
	if (category === "vanguard" && (subcategory === "spreads" || subcategory === "random-musings")) {
		return {
			redirect: {
				destination: subcategory === "spreads" ? "/category/vanguard" : "/category/vanguard/articles",
				permanent: false,
			},
		};
	}

	const [articles, sidebar, recommended] = await Promise.all([
		getArticlesBySubcategory(category, subcategory, 10, await getIdOfNewest(category, subcategory), 0),
		getCurrArticles(),
		getRecommendedArticlesForSubcategory(category, subcategory),
	]);

	return {
		props: {
			category,
			subcategory,
			articles: articles.map(article => toSubcategoryPreviewArticle(article, true)),
			sidebar: sidebar.map(article => toSubcategoryPreviewArticle(article, false)),
			recommended: recommended.map(article => toSubcategoryPreviewArticle(article, true)),
		},
		revalidate: 60,
	};
};

export default function Subcategory(props: Props) {
	const category = props.category;
	const [articles, setArticles] = useState(props.articles);
	const [cursor, setCursor] = useState<number | null>(props.articles.length > 0 ? props.articles[props.articles.length - 1].id : null);
	const [loadingContent, setLoadingContent] = useState("Loading articles, please wait...");
	const [loadingDisplay, setLoadingDisplay] = useState<"none" | "block">("none");
	const [showSidebar, setShowSidebar] = useState(false);
	const [shuffledSidebar, setShuffledSidebar] = useState<article[]>([]);

	const subcategory = props.subcategory;
	const sidebar = props.sidebar;
	const recommended = props.recommended;
	const route = useRouter().asPath;
	const pageTitle = category === "vanguard" && subcategory === "articles" ? "Vanguard Articles" : expandCategorySlug(subcategory);
	const recommendedIds = new Set(recommended.map(art => art.id));
	const visibleArticles = recommended.length ? articles.filter(art => !recommendedIds.has(art.id)) : articles;

	useEffect(() => {
		setArticles(props.articles);
		setCursor(props.articles.length > 0 ? props.articles[props.articles.length - 1].id : null);
	}, [props.articles, props.subcategory]);

	useEffect(() => {
		setShuffledSidebar(shuffle(sidebar));
	}, [sidebar]);

	async function newArticles() {
		setLoadingContent("Loading articles, please wait...");
		setLoadingDisplay("block");

		const response = await fetch("/api/load/loadsub", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ subcategory, cursor }),
		});

		const loaded: article[] = await response.json();
		if (loaded.length !== 0) {
			setArticles(prev => [...prev, ...loaded]);
			setCursor(loaded[loaded.length - 1].id);
			setLoadingDisplay("none");
		} else {
			setLoadingContent("No more articles to load.");
		}
	}

	return (
		<div className="subcategory">
			<Head>
				<title>{`${pageTitle} | The Tower`}</title>
				<meta property="og:title" content={`${pageTitle} | The Tower`} />
				<meta property="og:description" content={`${pageTitle} at the Tower`} />
			</Head>

			<style jsx>{`
				.subcategory {
					min-height: 100vh;
				}
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
				}

				.grid {
					display: grid;
					/* Desktop: main + fixed-width sidebar matching search page */
					grid-template-columns: 1fr clamp(300px, 26vw, 400px);
					grid-column-gap: 2vw;
				}
				.desktop-card {
					display: block;
				}
				.mobile-card {
					display: none;
				}
				:global(.subcategory .desktop-card .article-preview > .category-list-preview) {
					display: grid;
					grid-template-columns: minmax(21rem, 3.5fr) minmax(0, 4fr);
					column-gap: 1.75rem;
					align-items: start;
				}
				:global(.subcategory .desktop-card .article-preview.row.category-list .img-wrapper) {
					display: flex;
					justify-content: flex-start;
					margin-right: 0 !important;
				}
				:global(.subcategory .desktop-card .article-preview.row.category-list .img-wrapper span) {
					display: block !important;
					width: 100% !important;
				}
				:global(.subcategory .desktop-card .article-preview.row.category-list .preview-image) {
					width: 100% !important;
					height: auto !important;
					max-width: 24.5rem !important;
					max-height: 13rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.subcategory .desktop-card .article-preview.row.category-list.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				:global(.subcategory .desktop-card .article-preview.row.category-list .title) {
					margin-top: 0;
				}
				:global(.subcategory .mobile-card .article-preview.box) {
					padding: 0 !important;
					margin: 0 !important;
				}
				:global(.subcategory .mobile-card .article-preview > .large-preview) {
					padding: 0 0 0.9rem;
					margin-bottom: 0;
				}
				:global(.subcategory .mobile-card .article-preview.box .img-wrapper) {
					margin-right: 0 !important;
					margin-bottom: 0.55rem !important;
				}
				:global(.subcategory .mobile-card .article-preview.box.large .preview-image) {
					width: 100% !important;
					height: 10.75rem !important;
					max-width: 100% !important;
					max-height: 10.75rem !important;
					object-fit: cover !important;
					border-radius: 0.75rem;
					margin: 0 !important;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.subcategory .mobile-card .article-preview.box.large.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				@media (max-width: 900px) {
					.desktop-card {
						display: none;
					}
					.mobile-card {
						display: block;
					}
				}
				.grid .sidebar {
					margin-top: 2vh;
					padding-left: 0.6rem;
					padding-right: 0.6rem;
					border: none;
					border-left: 1px solid gainsboro;
					border-right: none;
					opacity: 1;
					transition: opacity 0.2s, border 0.2s;
				}
				#loadmore {
					border-radius: 1.25rem;
					font-family: ${styles.font.sans};
					font-size: 1rem;
					color: black;
					background-color: white;
					border: 1px solid ${styles.color.darkAccent};
					padding: 0.3rem 0.5rem;
					transition: 0.25s;
				}
				#loadmore:hover {
					color: white;
					background-color: ${styles.color.darkAccent};
				}
				#loading {
					display: none;
				}
				.recommended-card {
					background: linear-gradient(135deg, #f1f5fc 0%, #e8eef9 100%);
					border: 1px solid #b8c6df;
					border-left: 5px solid #102e63;
					padding: 0.8rem;
				}
				.recommended-stack {
					display: grid;
					row-gap: 1rem;
					margin-bottom: 1.2rem;
				}
				.recommended-label {
					display: inline-block;
					background: #102e63;
					color: #fff;
					font-family: ${styles.font.sans};
					font-size: 0.78rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					padding: 0.22rem 0.55rem;
					margin-bottom: 0.5rem;
				}

				@media (max-width: 1000px) {
					.grid {
						/* hide or show sidebar based on state */
						grid-template-columns: ${showSidebar ? "1fr 0.6fr" : "1fr 0"};
					}
					.grid .sidebar {
						border: ${showSidebar ? "1px solid gainsboro" : "none"};
						opacity: ${showSidebar ? "1" : "0"};
					}
				}
			`}</style>

			<h1>{pageTitle}</h1>

			<div className="grid">
				<div>
					<section>
						{recommended.length > 0 && (
							<div className="recommended-stack">
								{recommended.map(recommendedArticle => (
									<div className="recommended-card" key={recommendedArticle.id}>
										<span className="recommended-label">Recommended</span>
										<div className="desktop-card">
											<ArticlePreview
												article={recommendedArticle}
												style="row"
												size="category-list"
												showPreviewText
												showIssueDate
												fit={category === "vanguard" && subcategory === "articles" ? "contain" : "cover"}
												thumbHeight={category === "vanguard" && subcategory === "articles" ? "18rem" : undefined}
											/>
										</div>
										<div className="mobile-card">
											<ArticlePreview
												article={recommendedArticle}
												style="box"
												size="large"
												fit={category === "vanguard" && subcategory === "articles" ? "contain" : "cover"}
												thumbHeight={category === "vanguard" && subcategory === "articles" ? "18rem" : undefined}
											/>
										</div>
									</div>
								))}
							</div>
						)}
						{visibleArticles.map(art => (
							<div key={art.id}>
								<div className="desktop-card">
									<ArticlePreview
										article={art}
										style="row"
										size="category-list"
										showPreviewText
										showIssueDate
										fit={category === "vanguard" && subcategory === "articles" ? "contain" : "cover"}
										thumbHeight={category === "vanguard" && subcategory === "articles" ? "18rem" : undefined}
									/>
								</div>
								<div className="mobile-card">
									<ArticlePreview
										article={art}
										style="box"
										size="large"
										fit={category === "vanguard" && subcategory === "articles" ? "contain" : "cover"}
										thumbHeight={category === "vanguard" && subcategory === "articles" ? "18rem" : undefined}
									/>
								</div>
							</div>
						))}
					</section>
					<p id="loading" style={{ display: loadingDisplay }}>
						{loadingContent}
					</p>
					<button id="loadmore" onClick={newArticles}>
						Load more
					</button>
				</div>
				<section className="sidebar">
					{shuffledSidebar.map(s => (
						<ArticlePreview key={s.id} article={s} style="row" size="small" category fit="contain" />
					))}
				</section>
			</div>
		</div>
	);
}

interface SidebarProps {
	sidebar: article[];
}

function SidebarArticles({ sidebar }: SidebarProps) {
	const articles = shuffle(sidebar);
	return (
		<>
			{articles.map(art => (
				<ArticlePreview key={art.id} article={art} style="row" size="small" category />
			))}
		</>
	);
}
