/** @format */

import Head from "next/head";
import Link from "next/link";
import { FormEvent, useState } from "react";
import CrosswordBuilder, {
	createEmptyCrosswordDraft,
	serializeCrosswordDraft,
	type CrosswordDraft,
} from "~/components/crosswordbuilder.client";

export default function CreateCrossword() {
	const [crosswordDraft, setCrosswordDraft] = useState<CrosswordDraft>(() => createEmptyCrosswordDraft(5, 5));
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
	const [message, setMessage] = useState("");

	async function handlePublish(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setMessage("");
		setStatus("idle");

		const serialized = serializeCrosswordDraft(crosswordDraft);
		if (!serialized.ok) {
			setStatus("error");
			setMessage(serialized.error);
			return;
		}

		setSaving(true);
		try {
			const payload = new FormData();
			payload.append("category", "crossword");
			payload.append("crossword-title", serialized.value.title);
			payload.append("crossword-author", serialized.value.author);
			payload.append("crossword-date", serialized.value.date);
			payload.append("crossword-clues", JSON.stringify(serialized.value.clues));

			const response = await fetch("/api/upload", {
				method: "POST",
				body: payload,
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message || "Publish failed.");
			}

			setStatus("success");
			setMessage(data.message || "Crossword published successfully.");
			setCrosswordDraft(createEmptyCrosswordDraft(5, 5));
		} catch (error) {
			setStatus("error");
			setMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Head>
				<title>Create 5x5 Crossword | The Tower</title>
				<meta property="og:title" content="Create 5x5 Crossword | The Tower" />
			</Head>
			<main className="create-page">
				<div className="header-row">
					<div>
						<h1>Create a 5x5 Crossword</h1>
						<p>Create a fixed 5×5 crossword with date, author, and clues in one place.</p>
					</div>
					<Link className="back-link" href="/games/crossword">
						Back to crossword player
					</Link>
				</div>

				<form onSubmit={handlePublish} className="publish-form">
					<CrosswordBuilder value={crosswordDraft} onChange={setCrosswordDraft} fixedSize rows={5} cols={5} />

					<div className="publish-actions">
						<button type="submit" disabled={saving}>
							{saving ? "Publishing…" : "Publish crossword"}
						</button>
						<div className={`status-message ${status}`}>{message}</div>
					</div>
				</form>
			</main>
			<style jsx>{`
				.create-page {
					max-width: 1040px;
					margin: 0 auto;
					padding: 1.5rem 1rem 3rem;
				}

				.header-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: 1rem;
					margin-bottom: 1.5rem;
				}

				.back-link {
					color: #111;
					font-weight: 700;
					text-decoration: none;
				}

				.back-link:hover {
					text-decoration: underline;
				}

				.publish-form {
					display: grid;
					gap: 1.5rem;
				}

				.publish-actions {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 1rem;
				}

				button {
					border: 1px solid #111;
					background: #111;
					color: #fff;
					padding: 0.9rem 1.3rem;
					font-size: 1rem;
					cursor: pointer;
				}

				button:disabled {
					opacity: 0.4;
					cursor: not-allowed;
				}

				.status-message {
					min-height: 1.4rem;
					font-size: 0.95rem;
				}

				.status-message.success {
					color: #0a6d1a;
				}

				.status-message.error {
					color: #9d1a1a;
				}

				@media (max-width: 760px) {
					.header-row {
						flex-direction: column;
						align-items: flex-start;
					}
				}
			`}</style>
		</>
	);
}
