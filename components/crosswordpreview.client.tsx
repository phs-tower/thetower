/** @format */

import Link from "next/link";
import CreditLink from "./credit.client";

interface Props {
	author: string;
	date: string;
	id: number;
}

export function CrosswordPreview(props: Props) {
	return (
		<div>
			<style jsx>{`
				.crossword-preview {
					width: 12rem;
					height: 6.875rem;
					background-color: #f0f0f0;
					text-align: center;
				}

				.crossword-preview:hover {
					cursor: pointer;
					background-color: #d0d0d0;
				}

				.date {
					padding-top: 1.5rem;
				}
			`}</style>
			<Link legacyBehavior href={`/games/crossword/${props.id}`}>
				<div className="crossword-preview">
					<p className="date">{props.date}</p>
					<p>
						By <CreditLink author={props.author} />
					</p>
				</div>
			</Link>
		</div>
	);
}
