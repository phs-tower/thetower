/** @format */

import { article } from "@prisma/client";
import shuffle from "lodash/shuffle";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import ArticlePreview from "~/components/preview.client";
import { getArticlesBySubcategory, getCurrArticles, getIdOfNewest } from "~/lib/queries";
import styles from "~/lib/styles";
import { expandCategorySlug } from "~/lib/utils";
import { GetStaticPaths, GetStaticProps } from "next";
import { ParsedUrlQuery } from "querystring";

interface Params extends ParsedUrlQuery {
	category: string;
	subcategory: string;
}

interface Props {
	subcategory: string;
	articles: article[];
	sidebar: article[];
}
export const getStaticPaths: GetStaticPaths = async () => {
	const categoryToSubcats = {
		"news-features": ["phs-profiles"],
		opinions: ["editorials", "cheers-jeers"],
		vanguard: ["random-musings", "spreads"],
		"arts-entertainment": ["student-artists"],
		sports: ["student-athletes"],
	};

	const paths = Object.entries(categoryToSubcats).flatMap(([category, subcats]) =>
		subcats.map(subcategory => ({
			params: { category, subcategory },
		}))
	);

	return {
		paths,
		fallback: "blocking",
	};
};

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	const { category, subcategory } = params!;

	const articles = await getArticlesBySubcategory(subcategory, 10, await getIdOfNewest(category, subcategory), 0);
	const sidebar = await getCurrArticles();

	return {
		props: {
			subcategory,
			articles,
			sidebar,
		},
		revalidate: 60,
	};
};

export default function Subcategory(props: Props) {
	const [articles, setArticles] = useState(props.articles);
	const [cursor, setCursor] = useState<number | null>(props.articles.length > 0 ? props.articles[props.articles.length - 1].id : null);
	const [loadingContent, setLoadingContent] = useState("Loading articles, please wait...");
	const [loadingDisplay, setLoadingDisplay] = useState<"none" | "block">("none");
	const [showSidebar, setShowSidebar] = useState(false);
	const [shuffledSidebar, setShuffledSidebar] = useState<article[]>([]);

	const subcategory = props.subcategory;
	const sidebar = props.sidebar;
	const route = useRouter().asPath;

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
				<title>{`${expandCategorySlug(subcategory)} | The Tower`}</title>
				<meta property="og:title" content={`${expandCategorySlug(subcategory)} | The Tower`} />
				<meta property="og:description" content={`${expandCategorySlug(subcategory)} at the Tower`} />
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
				/* Mobile toggle button */
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
					grid-template-columns: 2.25fr 0.75fr;
					grid-column-gap: 2vw;
				}
				.grid .sidebar {
					margin-top: 2vh;
					padding-left: 1vw;
					padding-right: 1vw;
					border: none;
					border-left: 1px solid gainsboro;
					border-right: 1px solid gainsboro;
					opacity: 1;
					transition: opacity 0.2s, border 0.2s;
				}
				#loadmore {
					border-radius: 2rem;
					font-family: ${styles.font.sans};
					font-size: 1.6rem;
					color: black;
					background-color: white;
					border: 1px solid ${styles.color.darkAccent};
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
						/* hide or show sidebar based on state */
						grid-template-columns: ${showSidebar ? "1fr 0.6fr" : "1fr 0"};
					}
					.grid .sidebar {
						border: ${showSidebar ? "1px solid gainsboro" : "none"};
						opacity: ${showSidebar ? "1" : "0"};
					}
				}
			`}</style>

			<h1>{expandCategorySlug(subcategory)}</h1>
			<button className="sidebar-toggle" onClick={() => setShowSidebar(s => !s)}>
				{showSidebar ? "Hide Sidebar" : "Show Sidebar"}
			</button>

			<div className="grid">
				<div>
					<section>
						{articles.map(art => (
							<ArticlePreview key={art.id} article={art} style="row" size="category-list" />
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
						<ArticlePreview key={s.id} article={s} style="row" size="small" category />
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
