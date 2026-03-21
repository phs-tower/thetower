/** @format */
/* eslint-disable @next/next/no-img-element */

import { spreads } from "@prisma/client";
import Link from "next/link";
import { displayDate } from "~/lib/utils";
import styles from "~/lib/styles";
import { getSpreadPageImageUrl, parseSpreadSource } from "~/lib/utils";
import { PdfPageThumbnail } from "./pdfspreadfallback.client";

interface Props {
	spread: spreads;
	variant?: "card" | "category-list";
	recommended?: boolean;
}

export default function Spread({ spread, variant = "card", recommended = false }: Props) {
	const { pageCount, pdfUrl } = parseSpreadSource(spread.src);
	const coverImage = pageCount > 0 ? getSpreadPageImageUrl(spread.src, 1) : "/assets/white-tower.png";
	const spreadHref = "/spreads/" + spread.year + "/" + spread.month + "/vanguard/" + encodeURI(spread.title);
	const isCategoryList = variant === "category-list";

	return (
		<div className={`spread ${isCategoryList ? "category-list" : "card"} ${recommended ? "recommended" : ""}`}>
			<style jsx>{`
				.spread {
					position: relative;
				}

				.spread.card {
					min-width: 50vh;
					justify-content: left;
					background-color: #f5f5f5;
					padding: 20px;
					margin-bottom: 10px;
					margin-top: 10px;
					border-left: 2px solid ${styles.color.accent};
				}

				.spread.category-list {
					padding-bottom: 2rem;
					margin-bottom: 2rem;
					border-bottom: 1px solid gainsboro;
				}

				.spread.category-list.recommended {
					background: linear-gradient(135deg, #f1f5fc 0%, #e8eef9 100%);
					border: 1px solid #b8c6df;
					border-left: 5px solid #102e63;
					padding: 1rem;
					padding-bottom: 2rem;
				}

				.layout {
					display: grid;
					gap: 1.8rem;
					align-items: start;
				}

				.spread.card .layout {
					grid-template-columns: 1fr;
				}

				.spread.category-list .layout {
					grid-template-columns: minmax(30rem, 4.5fr) minmax(0, 4fr);
				}

				.cover {
					display: block;
					margin-bottom: ${isCategoryList ? "0" : "1rem"};
				}

				.cover-link {
					position: relative;
					display: inline-block;
				}

				.cover-frame {
					width: 100%;
					max-width: ${isCategoryList ? "36rem" : "100%"};
					overflow: hidden;
					background: white;
					box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
				}

				.spread.category-list .cover-frame {
					height: 23rem;
				}

				.cover-frame :global(img) {
					display: block;
					width: 100%;
					height: ${isCategoryList ? "100%" : "auto"};
					max-height: ${isCategoryList ? "none" : "18rem"};
					object-fit: contain;
					background: white;
				}

				.spread.category-list .cover-frame :global(img) {
					object-fit: cover;
					object-position: center 20%;
				}

				.cover-frame :global(.pdf-thumb-fallback) {
					display: grid;
					place-items: center;
					min-height: 14rem;
					background: white;
					color: #666;
					padding: 1rem;
					text-align: center;
				}

				.spread.category-list .cover-frame :global(.pdf-thumb-fallback) {
					height: 100%;
				}

				.details {
					min-width: 0;
				}

				.eyebrow {
					display: inline-block;
					margin-bottom: 0.55rem;
					font-family: ${styles.font.sans};
					font-size: 0.8rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: ${styles.color.accent};
				}

				.title {
					margin-top: 0;
					margin-bottom: 0.6rem;
				}

				.title a {
					font-size: ${isCategoryList ? "clamp(2rem, 2.8vw, 2.55rem)" : "1.5rem"};
					line-height: 1.08;
				}

				.title a:hover {
					text-decoration: underline;
				}

				.meta {
					display: block;
					margin-bottom: ${isCategoryList ? "0.9rem" : "0"};
					font-size: ${isCategoryList ? "1.2rem" : "1rem"};
					color: #8b8b8b;
				}

				.summary {
					margin: 0;
					color: #666;
					font-size: ${isCategoryList ? "1.08rem" : "0.98rem"};
					line-height: 1.5;
					max-width: 52rem;
				}

				.recommended-label {
					position: absolute;
					top: 0.85rem;
					left: 0.85rem;
					z-index: 1;
					display: inline-block;
					background: #102e63;
					color: #fff;
					font-family: ${styles.font.sans};
					font-size: 0.78rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					padding: 0.22rem 0.55rem;
					box-shadow: 0 6px 14px rgba(0, 0, 0, 0.16);
				}

				span {
					font-family: ${styles.font.sans};
				}

				@media (max-width: 900px) {
					.spread.category-list .layout {
						grid-template-columns: 1fr;
						gap: 1.25rem;
					}

					.spread.category-list .cover-frame {
						max-width: 100%;
						height: 18rem;
					}

					.title a {
						font-size: ${isCategoryList ? "clamp(1.55rem, 5vw, 2rem)" : "1.5rem"};
					}
				}
			`}</style>
			<div className="layout">
				<div className="cover-link">
					{recommended && <span className="recommended-label">Recommended</span>}
					<Link className="cover" href={spreadHref}>
						<div className="cover-frame">
							{pageCount > 0 ? (
								<img src={coverImage} alt={`${spread.title} cover`} />
							) : pdfUrl ? (
								<PdfPageThumbnail pdfUrl={pdfUrl} alt={`${spread.title} cover`} />
							) : (
								<img src={coverImage} alt={`${spread.title} cover`} />
							)}
						</div>
					</Link>
				</div>
				<div className="details">
					{isCategoryList && <span className="eyebrow">Vanguard Spread</span>}
					<section className="title">
						<Link href={spreadHref}>{spread.title}</Link>
					</section>
					<span className="meta">{displayDate(spread.year, spread.month)}</span>
					{isCategoryList && <p className="summary">Open the full spread to read the rendered Vanguard pages.</p>}
				</div>
			</div>
		</div>
	);
}
