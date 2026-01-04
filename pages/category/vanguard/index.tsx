/** @format */

import { article, spreads } from "@prisma/client";
import shuffle from "lodash/shuffle";
import Head from "next/head";
import { useState } from "react";
import ArticlePreview from "~/components/preview.client";
import Spread from "~/components/spread.client";
import { getCurrArticles, getIdOfNewest, getSpreadsByCategory } from "~/lib/queries";
import styles from "~/lib/styles";

interface Props {
	spreads: spreads[];
	sidebar: article[];
}

export async function getServerSideProps() {
	return {
		props: {
			spreads: await getSpreadsByCategory("vanguard", 5, await getIdOfNewest("spreads", "vanguard"), 0),
			sidebar: await getCurrArticles(),
		},
	};
}

export default function Category(props: Props) {
	const [spreads, setSpreads] = useState(props.spreads);
	const [cursor, setCursor] = useState(spreads[spreads.length - 1].id);
	const [loadingDisplay, setLoadingDisplay] = useState("none");
	const [loadingContent, setLoadingContent] = useState("Loading spreads, please wait...");
	const sidebar = props.sidebar;

	async function newSpreads() {
		setLoadingContent("Loading spreads, please wait...");
		setLoadingDisplay("block");

		const response = await fetch("/api/load/vang", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ category: "vanguard", cursor }),
		});

		const loaded = await response.json();
		if (loaded.length != 0) {
			setSpreads([...spreads, ...loaded]);
			setCursor(loaded[loaded.length - 1].id);
			setLoadingDisplay("none");
		} else {
			setLoadingContent("No more articles to load.");
		}
	}

	return (
		<div className="vanguard">
			<Head>
				<title>Vanguard | The Tower</title>
				<meta property="og:title" content="Vanguard | The Tower" />
				<meta property="og:description" content="Vanguard at the Tower" />
			</Head>
			<style jsx>{`
				.vanguard {
				}
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
					/* font-weight: bold;
					font-size: calc(1rem + 1vw); */
				}
				.grid {
					display: grid;
					/* Keep Vanguard layout (not multimedia), but align sidebar width */
					grid-template-columns: 1fr clamp(300px, 26vw, 400px);
					grid-column-gap: 2vw;
				}
				:global(.vanguard .article-preview > .category-list-preview) {
					display: grid;
					grid-template-columns: minmax(21rem, 3.5fr) minmax(0, 4fr);
					column-gap: 1.75rem;
					align-items: start;
				}
				:global(.vanguard .article-preview.row.category-list .img-wrapper) {
					display: flex;
					justify-content: flex-start;
					margin-right: 0 !important;
				}
				:global(.vanguard .article-preview.row.category-list .img-wrapper span) {
					display: block !important;
					width: 100% !important;
				}
				:global(.vanguard .article-preview.row.category-list .preview-image) {
					width: 100% !important;
					height: auto !important;
					max-width: 24.5rem !important;
					max-height: 13rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.vanguard .article-preview.row.category-list.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				:global(.vanguard .article-preview.row.category-list .title) {
					margin-top: 0;
				}
				@media (max-width: 900px) {
					:global(.vanguard .article-preview > .category-list-preview) {
						grid-template-columns: 1fr;
						row-gap: 1.5rem;
					}
					:global(.vanguard .article-preview.row.category-list .preview-image) {
						max-width: 100% !important;
						max-height: 12rem !important;
					}
				}
				.spreads {
				}
				.sidebar {
					margin-top: 2vh;
					padding-left: 1vw;
					padding-right: 1vw;
					border: none;
					border-left: 1px solid gainsboro;
					border-right: 1px solid gainsboro;
				}

				#loadmore {
					border-radius: 1.25rem;
					font-family: ${styles.font.sans};
					font-size: 1rem;
					color: black;
					background-color: white;
					border-style: solid;
					border-color: ${styles.color.darkAccent};
					padding: 0.3rem;
					padding-left: 0.5rem;
					padding-right: 0.5rem;
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
			<h1>Vanguard</h1>
			<div className="grid">
				<div>
					<section className="spreads">
						{spreads.map(spread => (
							<Spread key={spread.id} spread={spread} />
						))}
					</section>
					<p id="loading" style={{ display: loadingDisplay }}>
						{loadingContent}
					</p>
					<button id="loadmore" onClick={newSpreads}>
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
