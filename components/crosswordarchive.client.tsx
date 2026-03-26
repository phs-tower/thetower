/** @format */

import { useState } from "react";
import { CrosswordPreview } from "~/components/crosswordpreview.client";
import styles from "~/lib/styles";

export type CrosswordSummary = {
	id: number;
	title: string;
	author: string;
	date: string;
};

type Props = {
	initialCrosswords: CrosswordSummary[];
	heading: string;
	description?: string;
};

export default function CrosswordArchiveSection({ initialCrosswords, heading, description }: Props) {
	const [crosswords, setCrosswords] = useState<CrosswordSummary[]>(initialCrosswords);
	const [cursor, setCursor] = useState<number | null>(initialCrosswords.length > 0 ? initialCrosswords[initialCrosswords.length - 1].id : null);
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState("");

	async function loadMore() {
		if (loading) return;
		if (cursor == null) {
			setStatus("No more crosswords to load.");
			return;
		}

		setLoading(true);
		setStatus("Loading crosswords...");

		try {
			const response = await fetch("/api/load/crossword", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ cursor }),
			});
			const loaded = (await response.json()) as CrosswordSummary[];

			if (!response.ok) throw new Error("Could not load more crosswords.");

			if (loaded.length === 0) {
				setStatus("No more crosswords to load.");
				setCursor(null);
				return;
			}

			setCrosswords(prev => [...prev, ...loaded]);
			setCursor(loaded[loaded.length - 1].id);
			setStatus("");
		} catch (error) {
			console.error(error);
			setStatus("Crosswords are temporarily unavailable.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<section className="crossword-archive-section">
			<style jsx>{`
				.crossword-archive-section {
					margin-top: 3rem;
					padding-top: 1.5rem;
					border-top: 1px solid #d8d8d8;
				}

				.section-head {
					display: flex;
					justify-content: space-between;
					align-items: end;
					gap: 1rem;
					flex-wrap: wrap;
					margin-bottom: 1.25rem;
				}

				.section-head h2 {
					margin: 0;
				}

				.section-head p {
					margin: 0.35rem 0 0;
					max-width: 44rem;
					color: #5e5e5e;
					font-family: ${styles.font.sans};
				}

				.crossword-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
					gap: 1rem;
				}

				.status {
					margin: 1rem 0 0;
					color: #666;
					font-family: ${styles.font.sans};
				}

				.load-more {
					margin-top: 1.25rem;
					border: 1px solid ${styles.color.darkAccent};
					background: white;
					color: ${styles.color.darkAccent};
					font-family: ${styles.font.sans};
					padding: 0.55rem 0.9rem;
					transition: background 0.2s ease, color 0.2s ease;
				}

				.load-more:hover:not(:disabled) {
					background: ${styles.color.darkAccent};
					color: white;
				}

				.load-more:disabled {
					opacity: 0.55;
					cursor: not-allowed;
				}
			`}</style>
			<div className="section-head">
				<div>
					<h2>{heading}</h2>
					{description ? <p>{description}</p> : null}
				</div>
			</div>
			<div className="crossword-grid">
				{crosswords.map(crossword => (
					<CrosswordPreview key={crossword.id} author={crossword.author} date={crossword.date} id={crossword.id} title={crossword.title} />
				))}
			</div>
			{status ? <p className="status">{status}</p> : null}
			{cursor !== null ? (
				<button type="button" className="load-more" onClick={loadMore} disabled={loading}>
					{loading ? "Loading..." : "Load more"}
				</button>
			) : null}
		</section>
	);
}
