/** @format */

import { article } from "@prisma/client";
import shuffle from "lodash/shuffle";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ArticlePreview from "~/components/preview.client";
import { getArticlesBySubcategory, getCurrArticles, getIdOfNewest } from "~/lib/queries";
import styles from "~/lib/styles";
import { expandCategorySlug } from "~/lib/utils";

interface Params {
	params: {
		subcategory: string;
	};
}

interface Props {
	subcategory: string;
	articles: article[];
	sidebar: article[];
}

export async function getServerSideProps({ params }: Params) {
	return {
		props: {
			subcategory: params.subcategory,
			articles: await getArticlesBySubcategory(params.subcategory, 10, await getIdOfNewest(params.subcategory, params.subcategory), 0),
			sidebar: await getCurrArticles(),
		},
	};
}

export default function Subcategory(props: Props) {
	const [articles, setArticles] = useState(props.articles);
	const [cursor, setCursor] = useState(null);
	const [loadingContent, setLoadingContent] = useState("Loading articles, please wait...");
	const [loadingDisplay, setLoadingDisplay] = useState("none");
	const subcategory = props.subcategory;
	const sidebar = props.sidebar;
	const route = useRouter().asPath;

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

		const loaded = await response.json();
		if (loaded.length != 0) {
			setArticles([...articles, ...loaded]);
			setCursor(loaded[loaded.length - 1].id);
			setLoadingDisplay("none");
		} else {
			setLoadingContent("No more articles to load.");
		}
	}

	useEffect(() => {
		async function setData() {
			setLoadingContent("Loading articles, please wait...");
			setLoadingDisplay("block");
			setCursor(null);

			const articleRes = await fetch("/api/load/loadsub", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ subcategory, cursor: null }),
			});

			articleRes.json().then(recvd => {
				console.log(recvd);
				setArticles(recvd);
				setCursor(recvd[recvd.length - 1].id);
			});

			setLoadingDisplay("none");
		}

		setData();
	}, [route, subcategory, setLoadingContent, setLoadingDisplay, setCursor, setArticles]);

	return (
		<div className="subcategory">
			<Head>
				<title>{`${expandCategorySlug(subcategory)} | The Tower`}</title>
				<meta property="og:title" content={expandCategorySlug(subcategory) + " | The Tower"} />
				<meta property="og:description" content={expandCategorySlug(subcategory) + " at the Tower"} />
			</Head>
			<style jsx>{`
				.subcategory {
					min-height: 100vh;
				}
				h1 {
					text-align: right;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
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
				}

				#loadmore {
					border-radius: 2rem;
					font-family: ${styles.font.sans};
					font-size: 1.6rem;
					color: black;
					background-color: white;
					border-style: solid;
					border-color: ${styles.color.darkAccent};
					padding: 0.5rem;
					padding-left: 0.75rem;
					padding-right: 0.75rem;
					transition: 0.25s;
				}

				#loadmore:hover {
					color: white;
					background-color: ${styles.color.darkAccent};
				}

				#loading {
					display: none;
				}
			`}</style>
			<h1>{expandCategorySlug(subcategory)}</h1>
			<div className="grid">
				<div>
					<section>
						{articles.map(article => (
							<ArticlePreview key={article.id} article={article} style="row" size="category-list" />
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
	let articles = shuffle(sidebar);
	return (
		<>
			{articles.map(article => (
				<ArticlePreview key={article.id} article={article} style="row" size="small" category />
			))}
		</>
	);
}
