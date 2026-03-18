/** @format */
/* eslint-disable @next/next/no-img-element */

import styles from "~/lib/styles";
import ArticlePreview from "./preview.client";
import { article, spreads } from "@prisma/client";
import Link from "next/link";
import { getSpreadPageImageUrl, parseSpreadSource } from "~/lib/utils";
import { PdfPageThumbnail } from "./pdfspreadfallback.client";

interface SectionProps {
	category: string;
	desc: string;
	articles: article[];
}

export function SectionContainer({ category, desc, articles }: SectionProps) {
	return (
		<div className={category}>
			<style jsx>{`
				.row-container {
					display: flex;
					gap: 1rem;
					list-style: none;
					overflow-x: scroll;
					scroll-snap-type: x mandatory;
				}

				.item {
					flex-shrink: 0;
					width: 22rem;
					height: 100%;
					background-color: var(--background);
					scroll-snap-align: start;
				}

				/* Uniform card visuals: fixed image area + clamped text */
				:global(.row-container .article-preview.box .preview-image) {
					width: 100% !important;
					height: 13rem !important; /* fixed so all cards equal height */
					object-fit: contain !important; /* show full image */
					margin-left: 0 !important;
					margin-right: 0 !important;
				}
				/* Pull title tight to image by shrinking image wrapper gap */
				:global(.row-container .article-preview.box .img-wrapper) {
					margin-bottom: -1rem !important;
				}
				/* Title directly under image with stable height */
				:global(.row-container .article-preview.box .title) {
					margin-top: 0rem; /* keep title snug under image */
					margin-bottom: 0.3rem;
				}
				/* Clamp title to 2 lines but do not reserve extra space; container below ensures uniform height */
				:global(.row-container .article-preview.box .title .large) {
					display: -webkit-box;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
					overflow: hidden;
					min-height: 0; /* allow single-line titles without extra gap */
					text-overflow: ellipsis;
				}
				/* Stack title + authors together with a fixed block height so cards align */
				:global(.row-container .article-preview.box .large-preview > div:last-child) {
					display: flex;
					flex-direction: column;
					justify-content: flex-start; /* pack title + authors at top */
					height: 6.5rem; /* fixed block: ~3 lines, leaves empty space below authors if short */
					overflow: hidden;
					gap: 0.15rem;
				}
				/* Authors pinned right under title; anything below is hidden */
				:global(.row-container .article-preview.box .authors) {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					min-height: 1.2rem; /* stabilize author line */
				}
				:global(.row-container .article-preview.box .preview-text) {
					display: none !important;
				}

				h3 {
					font-family: ${styles.font.sans};
				}
			`}</style>
			<h3>{category}</h3>
			<p>{desc}</p>
			<ul className="row-container">
				{Object.values(articles).map(article => (
					<li key={article.id} className="item">
						<ArticlePreview key={article.id} style="box" size="large" fit="contain" article={article} />
					</li>
				))}
			</ul>
		</div>
	);
}

interface VangProps {
	desc: string;
	spreads: spreads[];
}

export function VanguardContainer({ desc, spreads }: VangProps) {
	const latestSpread = spreads[0];
	if (!latestSpread) return null;

	const { pageCount, pdfUrl } = parseSpreadSource(latestSpread.src);
	const spreadHref = `/spreads/${latestSpread.year}/${latestSpread.month}/vanguard/${encodeURI(latestSpread.title)}`;
	const pages = Array.from({ length: Math.min(pageCount > 0 ? pageCount : 2, 2) }, (_, index) => ({
		pageNumber: index + 1,
		src: pageCount > 0 ? getSpreadPageImageUrl(latestSpread.src, index + 1) : "",
	}));
	const pageOne = pages[0];
	const pageTwo = pages[1];
	const canRenderPages = pageCount > 0 || Boolean(pdfUrl);

	return (
		<div id="vanguard">
			<style jsx>{`
				.spread-shell {
					padding: 0.6rem 0 0;
					max-width: 92rem;
					margin: 0 auto;
				}

				.page-header {
					display: grid;
					grid-template-columns: minmax(0, 1.08fr) auto minmax(0, 1.52fr);
					column-gap: 0.7rem;
					align-items: center;
				}

				.pages-grid {
					display: grid;
					grid-template-columns: minmax(0, 1.08fr) minmax(0, 1.52fr);
					column-gap: 0;
					align-items: start;
				}

				h3 {
					font-family: ${styles.font.sans};
				}

				.spread-title {
					margin: 0.5rem 0 0.9rem;
					font-size: clamp(1.22rem, 1.8vw, 1.5rem);
					font-style: italic;
					line-height: 1.12;
				}

				.spread-title a:hover {
					text-decoration: underline;
				}

				.page-header {
					margin-bottom: 0.65rem;
				}

				.page-label {
					display: block;
					text-align: center;
					font-family: ${styles.font.sans};
					font-size: 0.88rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: ${styles.color.accent};
				}

				.page-label.page-1-label {
					grid-column: 1;
				}

				.page-label.page-2-label {
					grid-column: 3;
				}

				.page-divider {
					grid-column: 2;
					font-family: ${styles.font.sans};
					font-size: 0.95rem;
					font-weight: 700;
					color: ${styles.color.accent};
				}

				.page-card {
					display: block;
					text-decoration: none;
					min-width: 0;
				}

				.page-card.page-1 {
					grid-column: 1;
				}

				.page-card.page-2 {
					grid-column: 2;
				}

				.page-frame {
					padding: 0.45rem;
					background: #fff;
					box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
					border: 1px solid #ececec;
					box-sizing: border-box;
				}

				.page-frame :global(img) {
					display: block;
					width: 100%;
					height: auto;
					background: white;
				}

				.page-frame :global(.pdf-thumb-fallback) {
					display: grid;
					place-items: center;
					width: 100%;
					min-height: 12rem;
					padding: 1rem;
					text-align: center;
					color: #666;
					background: #fafafa;
				}

				.empty-state {
					padding: 1rem 0;
					color: #666;
				}

				@media (max-width: 900px) {
					.page-header,
					.pages-grid {
						grid-template-columns: 1fr;
						row-gap: 0.9rem;
					}

					.page-label.page-1-label,
					.page-label.page-2-label,
					.page-card.page-1,
					.page-card.page-2 {
						grid-column: 1;
					}

					.page-divider {
						display: none;
					}
				}
			`}</style>
			<h3>VANGUARD</h3>
			<p>{desc}</p>
			<div className="spread-shell">
				<h4 className="spread-title">
					<Link href={spreadHref}>{latestSpread.title}</Link>
				</h4>
				{canRenderPages ? (
					<>
						<div className="page-header">
							{pageOne ? <span className="page-label page-1-label">Page 1</span> : null}
							{pageTwo ? <span className="page-divider">|</span> : null}
							{pageTwo ? <span className="page-label page-2-label">Page 2</span> : null}
						</div>
						<div className="pages-grid">
							{pageOne ? (
								<Link href={spreadHref} className="page-card page-1">
									<div className="page-frame">
										{pageOne.src ? (
											<img src={pageOne.src} alt={`${latestSpread.title} page ${pageOne.pageNumber}`} />
										) : pdfUrl ? (
											<PdfPageThumbnail
												pdfUrl={pdfUrl}
												pageNumber={pageOne.pageNumber}
												alt={`${latestSpread.title} page ${pageOne.pageNumber}`}
											/>
										) : null}
									</div>
								</Link>
							) : null}
							{pageTwo ? (
								<Link href={spreadHref} className="page-card page-2">
									<div className="page-frame">
										{pageTwo.src ? (
											<img src={pageTwo.src} alt={`${latestSpread.title} page ${pageTwo.pageNumber}`} />
										) : pdfUrl ? (
											<PdfPageThumbnail
												pdfUrl={pdfUrl}
												pageNumber={pageTwo.pageNumber}
												alt={`${latestSpread.title} page ${pageTwo.pageNumber}`}
											/>
										) : null}
									</div>
								</Link>
							) : null}
						</div>
					</>
				) : (
					<p className="empty-state">
						Page previews are not available for this spread yet. <Link href={spreadHref}>Open the full Vanguard spread.</Link>
					</p>
				)}
			</div>
		</div>
	);
}
