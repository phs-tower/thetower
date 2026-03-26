/** @format */

import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/router";
import CreditLink from "./credit.client";

interface Props {
	author: string;
	date: string;
	id: number;
	title: string;
}

export function CrosswordPreview(props: Props) {
	const router = useRouter();

	function openCrossword() {
		void router.push(`/games/crossword/${props.id}`);
	}

	function handlePreviewClick(e: MouseEvent<HTMLDivElement>) {
		if ((e.target as HTMLElement).closest("a")) return;
		openCrossword();
	}

	function handlePreviewKeyDown(e: KeyboardEvent<HTMLDivElement>) {
		if ((e.target as HTMLElement).closest("a")) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		openCrossword();
	}

	return (
		<div>
			<style jsx>{`
				.crossword-preview {
					min-height: 10.5rem;
					padding: 1rem 1rem 0.95rem;
					background: linear-gradient(180deg, #f8f8f8 0%, #efefef 100%);
					text-align: left;
					border: 1px solid #d8d8d8;
					display: flex;
					flex-direction: column;
					justify-content: space-between;
					gap: 0.75rem;
				}

				.crossword-preview:hover {
					cursor: pointer;
					background: linear-gradient(180deg, #f3f6fb 0%, #e8eef8 100%);
					border-color: #a7bddf;
				}

				.crossword-preview:focus-visible {
					outline: 2px solid rgb(94, 150, 229);
					outline-offset: 2px;
				}

				.eyebrow {
					margin: 0;
					color: #6a6a6a;
					font-size: 0.78rem;
					letter-spacing: 0.08em;
					text-transform: uppercase;
				}

				.title {
					margin: 0.15rem 0 0;
					font-size: 1.15rem;
					line-height: 1.2;
				}

				.meta {
					margin: 0.35rem 0 0;
					color: #525252;
				}

				.open-label {
					margin: 0;
					font-size: 0.9rem;
					color: #102e63;
					font-family: "Neue Montreal Medium";
				}
			`}</style>
			<div className="crossword-preview" role="link" tabIndex={0} onClick={handlePreviewClick} onKeyDown={handlePreviewKeyDown}>
				<div>
					<p className="eyebrow">{props.date}</p>
					<h3 className="title">{props.title}</h3>
					<p className="meta">
						By <CreditLink author={props.author} />
					</p>
				</div>
				<p className="open-label">Open crossword</p>
			</div>
		</div>
	);
}
