/** @format */

import { createCanvas } from "canvas";
import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { getSpreadPageImageUrl, parseSpreadSource } from "./utils";

let pdfjsPromise: Promise<any> | null = null;

class NodeCanvasFactory {
	create(width: number, height: number) {
		if (width <= 0 || height <= 0) throw new Error("Invalid canvas size for Vanguard spread rendering.");
		const canvas = createCanvas(width, height);
		const context = canvas.getContext("2d");
		return { canvas, context };
	}

	reset(
		canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: ReturnType<ReturnType<typeof createCanvas>["getContext"]> },
		width: number,
		height: number
	) {
		if (width <= 0 || height <= 0) throw new Error("Invalid canvas size for Vanguard spread rendering.");
		canvasAndContext.canvas.width = width;
		canvasAndContext.canvas.height = height;
	}

	destroy(canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: ReturnType<ReturnType<typeof createCanvas>["getContext"]> }) {
		canvasAndContext.canvas.width = 0;
		canvasAndContext.canvas.height = 0;
	}
}

async function getPdfJsServer() {
	if (!pdfjsPromise) {
		const bundledPdfJsPath = join(process.cwd(), "node_modules", "react-pdf", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs");
		const fallbackPdfJsPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs");
		const pdfJsModuleUrl = existsSync(bundledPdfJsPath) ? pathToFileURL(bundledPdfJsPath).href : pathToFileURL(fallbackPdfJsPath).href;
		pdfjsPromise = import(/* webpackIgnore: true */ pdfJsModuleUrl);
	}

	return await pdfjsPromise;
}

async function getPdfBufferFromSpreadSrc(spreadSrc: string) {
	const { pdfUrl } = parseSpreadSource(spreadSrc);
	const sourceUrl = pdfUrl || spreadSrc;
	const response = await fetch(sourceUrl);
	if (!response.ok) throw new Error("Could not load the Vanguard spread PDF.");
	return Buffer.from(await response.arrayBuffer());
}

async function loadPdfDocument(pdfBuffer: Buffer) {
	const pdfjs = await getPdfJsServer();
	const loadingTask = pdfjs.getDocument({
		data: new Uint8Array(pdfBuffer),
		disableWorker: true,
		isEvalSupported: false,
		useSystemFonts: true,
		verbosity: 0,
	} as any);
	const pdf = await loadingTask.promise;

	return {
		pdf,
		loadingTask,
	};
}

async function destroyPdfDocument(loadingTask: any, pdf: any) {
	try {
		await pdf?.cleanup?.();
	} catch {}

	try {
		await loadingTask?.destroy?.();
	} catch {}
}

function getRenderScale(density: number) {
	const safeDensity = Number.isFinite(density) && density > 0 ? density : 180;
	return safeDensity / 72;
}

async function renderPdfPageToPngBuffer(pdf: any, pageNumber: number, scale: number) {
	const page = await pdf.getPage(pageNumber);
	const viewport = page.getViewport({ scale });
	const canvasFactory = new NodeCanvasFactory();
	const { canvas, context } = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));

	if (!context) throw new Error("Could not create a canvas context for this Vanguard spread page.");

	await page.render({
		canvasContext: context as any,
		viewport,
		canvasFactory: canvasFactory as any,
	} as any).promise;

	page.cleanup();

	return canvas.toBuffer("image/png");
}

export async function renderPdfBufferPageToPngBuffer(pdfBuffer: Buffer, pageNumber: number, density = 180) {
	if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Invalid spread page number.");

	const { pdf, loadingTask } = await loadPdfDocument(pdfBuffer);

	try {
		const totalPages = Number(pdf.numPages || 0);
		if (totalPages && pageNumber > totalPages) {
			throw new Error(`Page ${pageNumber} is not available in this PDF.`);
		}

		const pngBuffer = await renderPdfPageToPngBuffer(pdf, pageNumber, getRenderScale(density));
		return {
			pngBuffer,
			totalPages,
		};
	} finally {
		await destroyPdfDocument(loadingTask, pdf);
	}
}

export async function renderPdfBufferToPngBuffers(pdfBuffer: Buffer, density = 180) {
	const { pdf, loadingTask } = await loadPdfDocument(pdfBuffer);

	try {
		const totalPages = Number(pdf.numPages || 0);
		if (!totalPages) throw new Error("Could not determine how many pages this Vanguard spread PDF has.");

		const renderedPages: { pageNumber: number; pngBuffer: Buffer }[] = [];
		const scale = getRenderScale(density);

		for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
			const pngBuffer = await renderPdfPageToPngBuffer(pdf, pageNumber, scale);
			renderedPages.push({ pageNumber, pngBuffer });
		}

		return {
			renderedPages,
			totalPages,
		};
	} finally {
		await destroyPdfDocument(loadingTask, pdf);
	}
}

export async function renderSpreadPdfPageToPngBuffer(spreadSrc: string, pageNumber: number, density = 180) {
	const pdfBuffer = await getPdfBufferFromSpreadSrc(spreadSrc);
	const { pngBuffer, totalPages } = await renderPdfBufferPageToPngBuffer(pdfBuffer, pageNumber, density);

	return {
		pngBuffer,
		totalPages,
		pagePublicUrl: getSpreadPageImageUrl(spreadSrc, pageNumber),
	};
}

export function getBucketObjectKeyFromPublicUrl(publicUrl: string, bucket: string) {
	const marker = `/object/public/${bucket}/`;
	const markerIndex = publicUrl.indexOf(marker);
	if (markerIndex === -1) throw new Error(`Could not derive the storage key for bucket "${bucket}".`);

	return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
}
