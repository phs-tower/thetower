/** @format */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getSpreadPageImageUrl, parseSpreadSource } from "~/lib/utils";
import PdfSpreadFallback from "./pdfspreadfallback.client";

interface Props {
	spreadSrc: string;
	pagePreviewUrls?: string[];
	showDownload?: boolean;
}

export default function SpreadGallery({ spreadSrc, pagePreviewUrls, showDownload = true }: Props) {
	const { pdfUrl, pageCount } = parseSpreadSource(spreadSrc);
	const pages =
		pagePreviewUrls && pagePreviewUrls.length > 0
			? pagePreviewUrls
			: Array.from({ length: pageCount }, (_, index) => getSpreadPageImageUrl(spreadSrc, index + 1));
	const hasRenderedImages = pages.length > 0;

	return (
		<div className="spread-gallery">
			<style jsx>{`
				.spread-gallery {
					width: 100%;
				}

				.spread-gallery-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 1rem;
					margin-bottom: 1rem;
					flex-wrap: wrap;
				}

				.download-link {
					border: 1px solid var(--accent-dark);
					padding: 0.45rem 0.8rem;
					text-transform: uppercase;
					letter-spacing: 0.06em;
					font-size: 0.9rem;
				}

				.page-list {
					display: grid;
					gap: 1.5rem;
				}

				.page-card {
					background: #f7f7f7;
					border: 1px solid #dddddd;
					padding: 1rem;
				}

				.page-label {
					display: inline-block;
					margin-bottom: 0.75rem;
					font-size: 0.8rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: #43516d;
				}

				.page-card img {
					display: block;
					width: 100%;
					height: auto;
					box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
					background: white;
				}

				.empty-state {
					border: 1px solid #dddddd;
					background: #fafafa;
					padding: 1rem;
					color: #555;
				}
			`}</style>

			<div className="spread-gallery-header">
				{showDownload && pdfUrl ? (
					<Link href={pdfUrl} target="_blank" rel="noreferrer" className="download-link">
						Open PDF
					</Link>
				) : (
					<span />
				)}
			</div>

			{hasRenderedImages ? (
				<div className="page-list">
					{pages.map((pageUrl, index) => (
						<div className="page-card" key={`${pageUrl}-${index}`}>
							<span className="page-label">Page {index + 1}</span>
							<img src={pageUrl} alt={`Spread page ${index + 1}`} />
						</div>
					))}
				</div>
			) : pdfUrl ? (
				<PdfSpreadFallback pdfUrl={pdfUrl} />
			) : (
				<div className="empty-state">Page previews are not available for this spread yet. Use the PDF link above.</div>
			)}
		</div>
	);
}
