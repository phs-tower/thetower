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
	params: {
		category: string;
	};
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
			articles: [],
			sidebar: await getArticlesExceptCategory(params.category),
		},
	};
}

export default function Category(props: Props) {
	const [articles, setArticles] = useState(props.articles);
	const [cursor, setCursor] = useState(null);
	const [loadingDisplay, setLoadingDisplay] = useState("none");
	const [loadingContent, setLoadingContent] = useState("Loading articles, please wait...");
	const category = props.category;
	const route = useRouter().asPath;
	const sidebar = props.sidebar;

	async function newArticles() {
		setLoadingContent("Loading articles, please wait...");
		setLoadingDisplay("block");

		const response = await fetch("/api/load/load", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ category, cursor }),
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
			console.log("route change");
			setLoadingContent("Loading articles, please wait...");
			setLoadingDisplay("block");

			setCursor(null);

			const articleRes = await fetch("/api/load/load", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ category, cursor: null }),
			});

			articleRes.json().then(recvd => {
				console.log(recvd);
				setArticles(recvd);
				setCursor(recvd[recvd.length - 1].id);
			});

			setLoadingDisplay("none");
		}

		setData();
	}, [route, category, setLoadingContent, setLoadingDisplay, setCursor, setArticles]);

	return (
		<div className="category">
			<Head>
				<title>{`${expandCategorySlug(category)} | The Tower`}</title>
				<meta property="og:title" content={expandCategorySlug(category) + " | The Tower"} />
				<meta property="og:description" content={expandCategorySlug(category) + " at the Tower"} />
			</Head>
			<style jsx>{`
				.category {
					min-height: 100vh;
				}
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
					/* font-weight: bold;
					font-family: ${styles.font.serifHeader};
					font-size: calc(1.5rem + 1vw); */
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
			<h1>{expandCategorySlug(category)}</h1>
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
