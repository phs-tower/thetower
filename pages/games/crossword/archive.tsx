/** @format */

import Head from "next/head";
import { useState } from "react";
import { CrosswordPreview } from "~/components/crosswordpreview.client";
import { getCrosswords, getIdOfNewestCrossword } from "~/lib/queries";
import styles from "~/lib/styles";

type crossword = {
	id: number;
	author: string;
	date: string;
};

interface Props {
	crosswords: crossword[];
}

export async function getServerSideProps() {
	return {
		props: { crosswords: await getCrosswords(5, await getIdOfNewestCrossword(), 0) },
	};
}

export default function Archive(props: Props) {
	const [crosswords, setCrosswords] = useState<crossword[]>(props.crosswords);
	const [cursor, setCursor] = useState(crosswords[crosswords.length - 1].id);

	const [loadingDisplay, setLoadingDisplay] = useState("none");
	const [loadingContent, setLoadingContent] = useState("Loading crosswords, please wait...");

	async function newCrosswords() {
		setLoadingContent("Loading crosswords, please wait...");
		setLoadingDisplay("block");

		const response = await fetch("/api/load/crossword", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ cursor }),
		});

		const loaded = await response.json();
		if (loaded.length != 0) {
			console.log(loaded);
			setCrosswords([...crosswords, ...loaded]);
			setCursor(loaded[loaded.length - 1].id);
			setLoadingDisplay("none");
		} else {
			setLoadingContent("No more crosswords to load.");
		}
	}

	// newCrosswords()

	return (
		<div id="archive">
			<style jsx>{`
				#archive {
					width: 80vw;
					margin: 0 auto;
					text-align: center;
				}

				#crossword-container {
					display: grid;
					grid-template-columns: repeat(5, 1fr);
					gap: 1.25rem; /*  this adds space between BOTH rows and columns */
					padding-top: 1.25rem;
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

				@media (max-width: 1000px) {
					#crossword-container {
						grid-template-columns: 1fr;
					}
				}
			`}</style>
			<Head>
				<meta property="og:title" content="Crossword Archive | The Tower" />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>
			<h1>Crossword Archive</h1>
			<div id="crossword-container">
				{crosswords.map(c => (
					<CrosswordPreview key={c.id} author={c.author} date={c.date} id={c.id} />
				))}
			</div>
			<br />
			<p id="loading" style={{ display: loadingDisplay }}>
				{loadingContent}
			</p>
			<button id="loadmore" onClick={newCrosswords}>
				Load more
			</button>
		</div>
	);
}
