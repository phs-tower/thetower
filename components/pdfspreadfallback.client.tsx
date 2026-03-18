/** @format */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { getPdfJs } from "~/lib/pdfjs-client";

type RenderedPdfPage = {
	pageNumber: number;
	src: string;
};

async function canvasToObjectUrl(canvas: HTMLCanvasElement) {
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(result => {
			if (result) resolve(result);
			else reject(new Error("Could not turn the PDF canvas into an image."));
		}, "image/png");
	});

	return URL.createObjectURL(blob);
}

async function renderPdfPages(pdfUrl: string, pageNumbers: number[], scale: number) {
	const pdfjs = await getPdfJs();
	const response = await fetch(pdfUrl);
	if (!response.ok) throw new Error("Could not load this PDF.");

	const data = await response.arrayBuffer();
	const loadingTask = pdfjs.getDocument({ data, disableWorker: true } as any);
	const pdf = await loadingTask.promise;
	const renderedPages: RenderedPdfPage[] = [];

	for (const pageNumber of pageNumbers) {
		if (pageNumber < 1 || pageNumber > pdf.numPages) continue;

		const page = await pdf.getPage(pageNumber);
		const viewport = page.getViewport({ scale });
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Could not create a PDF preview canvas.");

		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);

		await page.render({ canvasContext: context as any, viewport } as any).promise;
		renderedPages.push({ pageNumber, src: await canvasToObjectUrl(canvas) });
		page.cleanup();
	}

	await loadingTask.destroy();
	return {
		renderedPages,
		totalPages: pdf.numPages,
	};
}

function revokePageUrls(pages: RenderedPdfPage[]) {
	pages.forEach(page => URL.revokeObjectURL(page.src));
}

export function PdfPageThumbnail({ pdfUrl, pageNumber = 1, alt }: { pdfUrl: string; pageNumber?: number; alt: string }) {
	const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		let pageUrls: RenderedPdfPage[] = [];

		(async () => {
			try {
				const rendered = await renderPdfPages(pdfUrl, [pageNumber], 1.35);
				pageUrls = rendered.renderedPages;
				if (cancelled) return;
				if (rendered.renderedPages[0]?.src) {
					setThumbnailSrc(rendered.renderedPages[0].src);
					setError(null);
				} else {
					setThumbnailSrc(null);
					setError(`Page ${pageNumber} is not available in this PDF.`);
				}
			} catch (err: any) {
				if (!cancelled) setError(err?.message || "Could not render the PDF preview.");
			}
		})();

		return () => {
			cancelled = true;
			revokePageUrls(pageUrls);
		};
	}, [pageNumber, pdfUrl]);

	if (thumbnailSrc) return <img src={thumbnailSrc} alt={alt} />;
	if (error) return <div className="pdf-thumb-fallback">{error}</div>;
	return <div className="pdf-thumb-fallback">Rendering preview...</div>;
}

export default function PdfSpreadFallback({ pdfUrl }: { pdfUrl: string }) {
	const [pages, setPages] = useState<RenderedPdfPage[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		let pageUrls: RenderedPdfPage[] = [];

		(async () => {
			try {
				const initial = await renderPdfPages(pdfUrl, [1], 1.6);
				const remainingPageNumbers = Array.from({ length: initial.totalPages - 1 }, (_, index) => index + 2);
				const rendered =
					remainingPageNumbers.length > 0
						? await renderPdfPages(pdfUrl, remainingPageNumbers, 1.6)
						: { renderedPages: [] as RenderedPdfPage[], totalPages: initial.totalPages };
				pageUrls = [...initial.renderedPages, ...rendered.renderedPages];
				if (!cancelled) setPages(pageUrls);
			} catch (err: any) {
				if (!cancelled) setError(err?.message || "Could not render this PDF.");
			}
		})();

		return () => {
			cancelled = true;
			revokePageUrls(pageUrls);
		};
	}, [pdfUrl]);

	if (error) return <div className="pdf-fallback-error">{error}</div>;
	if (pages.length === 0) return <div className="pdf-fallback-loading">Rendering PDF pages...</div>;

	return (
		<div className="pdf-fallback-pages">
			<style jsx>{`
				.pdf-fallback-pages {
					display: grid;
					gap: 1.5rem;
				}

				.pdf-fallback-page {
					background: #f7f7f7;
					border: 1px solid #dddddd;
					padding: 1rem;
				}

				.pdf-fallback-label {
					display: inline-block;
					margin-bottom: 0.75rem;
					font-size: 0.8rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: #43516d;
				}

				.pdf-fallback-page img {
					display: block;
					width: 100%;
					height: auto;
					background: white;
					box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
				}

				.pdf-fallback-loading,
				.pdf-fallback-error {
					border: 1px solid #dddddd;
					background: #fafafa;
					padding: 1rem;
					color: #555;
				}
			`}</style>

			{pages.map(page => (
				<div key={page.pageNumber} className="pdf-fallback-page">
					<span className="pdf-fallback-label">Page {page.pageNumber}</span>
					<img src={page.src} alt={`PDF page ${page.pageNumber}`} />
				</div>
			))}
		</div>
	);
}
