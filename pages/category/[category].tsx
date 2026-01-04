/** @format */

import { useState, useEffect } from "react";
import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesExceptCategory, getArticlesByCategory } from "~/lib/queries";
import { expandCategorySlug } from "~/lib/utils";
import shuffle from "lodash/shuffle";
import styles from "~/lib/styles";
import type { GetStaticPaths, GetStaticProps } from "next";
import { ParsedUrlQuery } from "querystring";

interface Params extends ParsedUrlQuery {
	category: string;
}

interface Props {
	category: string;
	articles: article[];
	sidebar: article[];
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
	const categories = ["news-features", "opinions", "arts-entertainment", "sports"];
	return {
		paths: categories.map(cat => ({ params: { category: cat } })),
		fallback: "blocking",
	};
};

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	const [initialArticles, sidebarRaw] = await Promise.all([
		getArticlesByCategory(params!.category, 10, 0, 0),
		getArticlesExceptCategory(params!.category),
	]);

	return {
		props: {
			category: params!.category,
			articles: initialArticles,
			sidebar: shuffle(sidebarRaw),
		},
		revalidate: 60,
	};
};

export default function CategoryPage(props: Props) {
	const { category, sidebar, articles: initialArticles } = props;

	const [articles, setArticles] = useState<article[]>(initialArticles);
	const [cursor, setCursor] = useState<number | null>(initialArticles.length > 0 ? initialArticles[initialArticles.length - 1].id : null);
	const [loadingDisplay, setLoadingDisplay] = useState<"none" | "block">("none");
	const [loadingContent, setLoadingContent] = useState("Loading articles, please wait...");
	const [showSidebar, setShowSidebar] = useState(false);

	// Reset state when props.articles changes (on category switch)
	useEffect(() => {
		setArticles(initialArticles);
		setCursor(initialArticles.length > 0 ? initialArticles[initialArticles.length - 1].id : null);
	}, [initialArticles]);

	async function loadMore() {
		setLoadingContent("Loading articles, please wait...");
		setLoadingDisplay("block");

		const res = await fetch("/api/load/load", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ category, cursor }),
		});
		const more: article[] = await res.json();

		if (more.length > 0) {
			setArticles(prev => [...prev, ...more]);
			setCursor(more[more.length - 1].id);
			setLoadingDisplay("none");
		} else {
			setLoadingContent("No more articles to load.");
		}
	}

	return (
		<div className="category">
			<Head>
				<title>{`${expandCategorySlug(category)} | The Tower`}</title>
				<meta property="og:title" content={`${expandCategorySlug(category)} | The Tower`} />
				<meta property="og:description" content={`Articles from ${expandCategorySlug(category)} at the Tower`} />
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
					/* Desktop: main + fixed-width sidebar matching search page */
					grid-template-columns: 1fr clamp(300px, 26vw, 400px);
					grid-column-gap: 2vw;
					/* Shorter transition to reduce lag */
					transition: grid-template-columns 0.2s ease;
				}
				:global(.category .article-preview > .category-list-preview) {
					display: grid;
					grid-template-columns: minmax(21rem, 3.5fr) minmax(0, 4fr);
					column-gap: 1.75rem;
					align-items: start;
				}
				:global(.category .article-preview.row.category-list .img-wrapper) {
					display: flex;
					justify-content: flex-start;
					margin-right: 0 !important;
				}
				:global(.category .article-preview.row.category-list .img-wrapper span) {
					display: block !important;
					width: 100% !important;
				}
				:global(.category .article-preview.row.category-list .preview-image) {
					width: 100% !important;
					height: auto !important;
					max-width: 24.5rem !important;
					max-height: 13rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.category .article-preview.row.category-list.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				:global(.category .article-preview.row.category-list .title) {
					margin-top: 0;
				}
				@media (max-width: 900px) {
					:global(.category .article-preview > .category-list-preview) {
						grid-template-columns: 1fr;
						row-gap: 1.5rem;
					}
					:global(.category .article-preview.row.category-list .preview-image) {
						max-width: 100% !important;
						max-height: 12rem !important;
					}
				}
				.sidebar {
					margin-top: 2vh;
					padding: 0 0.6rem;
					border-left: 1px solid gainsboro;
					border-right: none;
					transition: all 0.2s ease;
				}
				#loadmore {
					border-radius: 1.25rem;
					font-family: ${styles.font.sans};
					font-size: 1rem;
					color: black;
					background-color: white;
					border-style: solid;
					border-color: ${styles.color.darkAccent};
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

				@media (max-width: 1000px) {
					.grid {
						/* If showSidebar is false => second column is 0 (hidden). If showSidebar is true => second column is 0.6fr	(makes the sidebar smaller relative to main).*/
						grid-template-columns: ${showSidebar ? "1fr 0.6fr" : "1fr 0"};
					}
					.sidebar {
						border: ${showSidebar ? "1px solid gainsboro" : "none"};
						opacity: ${showSidebar ? "1" : "0"};
					}
				}
			`}</style>

			<h1>{expandCategorySlug(category)}</h1>

			<div className="grid">
				<div>
					<section>
						{articles.map(a => (
							<ArticlePreview key={a.id} article={a} style="row" size="category-list" />
						))}
					</section>
					<p id="loading" style={{ display: loadingDisplay }}>
						{loadingContent}
					</p>
					<button id="loadmore" onClick={loadMore}>
						Load more
					</button>
				</div>
				<section className="sidebar">
					{sidebar.map(s => (
						<ArticlePreview key={s.id} article={s} style="row" size="small" category fit="contain" />
					))}
				</section>
			</div>
		</div>
	);
}
