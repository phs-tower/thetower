/** @format */

import Link from "next/link";
import styles from "~/lib/styles";

interface Props {
	title: String;
}

export default function SubBanner({ title }: Props) {
	return (
		<div>
			<style jsx>{`
				.sub-banner {
					text-align: center;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.75rem;
					padding: 2rem 0;
					max-width: 960px;
					margin: 0 auto;
				}

				.sub-banner h2 {
					margin: 0;
					font-size: clamp(1.4rem, 4vw, 2rem);
					line-height: 1.25;
				}

				.sub-banner p {
					margin: 0;
					max-width: 36rem;
					line-height: 1.6;
				}

				.sub-link {
					border-color: ${styles.color.darkAccent};
					border-style: solid;
					background-color: white;
					transition: 0.25s;
					padding: 0.35rem 1.2rem;
					font-family: ${styles.font.sans};
					font-size: 1rem;
					color: black;
					border-width: 2px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					border-radius: 999px;
				}

				.sub-link:hover {
					color: white;
					background-color: ${styles.color.darkAccent};
				}

				hr {
					align-self: stretch;
					background-color: #ccc;
					border: none;
					margin: 0;
					height: 3px;
				}

				@media screen and (max-width: 700px) {
					.sub-banner {
						padding: clamp(1.25rem, 6.5vw, 1.75rem) 0;
						gap: 0.65rem;
					}

					.sub-banner p {
						max-width: 90%;
						font-size: 0.95rem;
					}

					.sub-link {
						padding: 0.3rem 1.05rem;
						font-size: 0.95rem;
					}
				}
			`}</style>
			<div className="sub-banner">
				<hr />
				<h2>{title}</h2>
				<p>
					For $30.00 a year, subscribers to The Tower will receive all eight issues shipped to their home or business over the course of the
					year.
				</p>
				<br />
				<Link href="/subscribe">
					<p className="sub-link">Learn more</p>
				</Link>
			</div>
		</div>
	);
}
