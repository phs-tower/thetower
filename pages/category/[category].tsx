/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesExceptCategory } from "~/lib/queries";
import { expandCategorySlug } from "~/lib/utils";
import shuffle from "lodash/shuffle";
import styles from "~/lib/styles";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

interface Params {
	params: { category: string };
}

interface Props {
	category: string;
	articles: article[];
	sidebar: article[];
}

export async function getServerSideProps({ params }: Params) {
	return {
		props: {
			category: params.category,
			articles: [], // We'll fetch these via /api/load after mount
			sidebar: shuffle(await getArticlesExceptCategory(params.category)),
		},
	};
}

export default function Category(props: Props) {
	const [articles, setArticles] = useState<article[]>(props.articles);
	const [cursor, setCursor] = useState<number | null>(null);
	const [loadingDisplay, setLoadingDisplay] = useState<"none" | "block">("none");
	const [loadingContent, setLoadingContent] = useState("Loading articles, please wait...");
	const [showSidebar, setShowSidebar] = useState(false);

	const category = props.category;
	const sidebar = props.sidebar;

	const router = useRouter();
	const route = router.asPath; // triggers effect on route changes

	/** Load more articles on “Load More” button */
	async function newArticles() {
		setLoadingContent("Loading articles, please wait...");
		setLoadingDisplay("block");

		const res = await fetch("/api/load/load", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ category, cursor }),
		});

		const loaded = await res.json();
		if (loaded.length > 0) {
			setArticles(prev => [...prev, ...loaded]);
			setCursor(loaded[loaded.length - 1].id);
			setLoadingDisplay("none");
		} else {
			setLoadingContent("No more articles to load.");
		}
	}

	/** On mount or route change, fetch the initial set of articles */
	useEffect(() => {
		async function fetchArticles() {
			setLoadingContent("Loading articles, please wait...");
			setLoadingDisplay("block");
			setCursor(null);

			const res = await fetch("/api/load/load", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ category, cursor: null }),
			});

			const data = await res.json();
			setArticles(data);
			setCursor(data[data.length - 1]?.id || null);

			setLoadingDisplay("none");
		}
		fetchArticles();
	}, [route, category]);

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
				/* The mobile toggle button is hidden by default */
				.sidebar-toggle {
					display: none;
					margin-bottom: 1rem;
					background: ${styles.color.accent};
					color: white;
					border: none;
					padding: 0.6rem 1.2rem;
					font-size: 1.4rem;
					border-radius: 5px;
					cursor: pointer;
				}
				.grid {
					display: grid;
					/* On desktop, 2.25fr for main, 0.75fr for sidebar */
					grid-template-columns: 2.25fr 0.75fr;
					grid-column-gap: 2vw;
					/* Shorter transition to reduce lag */
					transition: grid-template-columns 0.2s ease;
				}
				.sidebar {
					margin-top: 2vh;
					padding: 0 1vw;
					border-left: 1px solid gainsboro;
					border-right: 1px solid gainsboro;
					transition: all 0.2s ease;
				}
				#loadmore {
					border-radius: 2rem;
					font-family: ${styles.font.sans};
					font-size: 1.6rem;
					color: black;
					background-color: white;
					border-style: solid;
					border-color: ${styles.color.darkAccent};
					padding: 0.5rem 0.75rem;
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
					.sidebar-toggle {
						display: inline-block;
					}
					.grid {
						/*
              If showSidebar is false => second column is 0 (hidden).
              If showSidebar is true => second column is 0.6fr
              (makes the sidebar smaller relative to main).
            */
						grid-template-columns: ${showSidebar ? "1fr 0.6fr" : "1fr 0"};
					}
					.sidebar {
						border: ${showSidebar ? "1px solid gainsboro" : "none"};
						opacity: ${showSidebar ? "1" : "0"};
					}
				}
			`}</style>

			<h1>{expandCategorySlug(category)}</h1>

			{/* Mobile toggle button (below 1000px) */}
			<button className="sidebar-toggle" onClick={() => setShowSidebar(prev => !prev)}>
				{showSidebar ? "Hide Sidebar" : "Show Sidebar"}
			</button>

			<div className="grid">
				{/* Main articles column */}
				<div>
					<section>
						{articles.map(a => (
							<ArticlePreview key={a.id} article={a} style="row" size="category-list" />
						))}
					</section>
					<p id="loading" style={{ display: loadingDisplay }}>
						{loadingContent}
					</p>
					<button id="loadmore" onClick={newArticles}>
						Load more
					</button>
				</div>

				{/* Sidebar column */}
				<section className="sidebar">
					<SidebarArticles sidebar={sidebar} />
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
			{sidebar.map(s => (
				<ArticlePreview key={s.id} article={s} style="row" size="small" category />
			))}
		</>
	);
}
