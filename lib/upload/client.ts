/** @format */

import { getPdfJs } from "~/lib/pdfjs-client";
import { parseSpreadSource } from "~/lib/utils";

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			result => {
				if (result) resolve(result);
				else reject(new Error("Could not convert this Vanguard spread page into an image."));
			},
			type,
			quality
		);
	});
}

function resizeCanvas(source: HTMLCanvasElement, maxDimension: number) {
	const largestDimension = Math.max(source.width, source.height);
	if (largestDimension <= maxDimension) return source;

	const scale = maxDimension / largestDimension;
	const resized = document.createElement("canvas");
	resized.width = Math.max(1, Math.round(source.width * scale));
	resized.height = Math.max(1, Math.round(source.height * scale));

	const resizedContext = resized.getContext("2d");
	if (!resizedContext) throw new Error("Could not resize this Vanguard spread page.");

	resizedContext.drawImage(source, 0, 0, resized.width, resized.height);
	return resized;
}

export async function buildCompactCanvasImageAsset(canvas: HTMLCanvasElement, fileStem: string, targetBytes = 3_000_000) {
	let workingCanvas = resizeCanvas(canvas, 2200);
	let bestBlob = await canvasToBlob(workingCanvas, "image/webp", 0.94);
	const qualities = [0.94, 0.9, 0.86, 0.82, 0.76];

	for (let shrinkRound = 0; shrinkRound < 5; shrinkRound++) {
		for (const quality of qualities) {
			const blob = await canvasToBlob(workingCanvas, "image/webp", quality);
			bestBlob = blob;
			if (blob.size <= targetBytes) {
				return {
					previewUrl: URL.createObjectURL(blob),
					file: new File([blob], `${fileStem}.webp`, {
						type: "image/webp",
						lastModified: Date.now(),
					}),
				};
			}
		}

		workingCanvas = resizeCanvas(workingCanvas, Math.max(1200, Math.round(Math.max(workingCanvas.width, workingCanvas.height) * 0.9)));
	}

	return {
		previewUrl: URL.createObjectURL(bestBlob),
		file: new File([bestBlob], `${fileStem}.webp`, {
			type: "image/webp",
			lastModified: Date.now(),
		}),
	};
}

async function loadImageElement(source: File) {
	const objectUrl = URL.createObjectURL(source);
	const image = new Image();
	image.decoding = "async";

	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error("Could not decode this image in the browser."));
		image.src = objectUrl;
	});

	return {
		image,
		release: () => URL.revokeObjectURL(objectUrl),
	};
}

function fileStemFromName(fileName: string) {
	return (fileName.replace(/\.[^.]+$/, "") || "upload").replace(/[^a-z0-9-_]+/gi, "-");
}

export async function prepareArticleImageUpload(source: File, options?: { maxDimension?: number; targetBytes?: number }) {
	const lowerName = source.name.toLowerCase();
	if (lowerName.endsWith(".gif")) {
		return {
			file: source,
			compressed: false,
		};
	}

	const maxDimension = options?.maxDimension ?? 2400;
	const targetBytes = options?.targetBytes ?? 1_400_000;

	const { image, release } = await loadImageElement(source);

	try {
		const largestDimension = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
		const scale = largestDimension > maxDimension ? maxDimension / largestDimension : 1;

		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
		canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

		const context = canvas.getContext("2d");
		if (!context) throw new Error("Could not create a canvas for image upload preparation.");
		context.drawImage(image, 0, 0, canvas.width, canvas.height);

		const prepared = await buildCompactCanvasImageAsset(canvas, fileStemFromName(source.name), targetBytes);
		if (prepared.file.size >= source.size * 0.98 && source.size <= targetBytes) {
			URL.revokeObjectURL(prepared.previewUrl);
			return {
				file: source,
				compressed: false,
			};
		}

		URL.revokeObjectURL(prepared.previewUrl);
		return {
			file: prepared.file,
			compressed: true,
		};
	} finally {
		release();
	}
}

export function setFileInputVisualState(inp: HTMLInputElement, hasFileClassName: string) {
	const label = inp.parentElement;
	const fileName = inp.files?.[0]?.name ?? "";
	const nameTarget = label?.querySelector("span.img-name");

	if (nameTarget) nameTarget.textContent = fileName;
	if (label) {
		if (fileName) label.classList.add(hasFileClassName);
		else label.classList.remove(hasFileClassName);
	}
}

export async function buildPdfPreviewImages(source: File) {
	const pdfjs = await getPdfJs();
	const loadingTask = pdfjs.getDocument({ data: await source.arrayBuffer(), disableWorker: true } as any);
	const pdf = await loadingTask.promise;
	const previewUrls: string[] = [];

	try {
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
			const page = await pdf.getPage(pageNumber);
			const viewport = page.getViewport({ scale: 1.2 });
			const canvas = document.createElement("canvas");
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Could not create a canvas context for this PDF preview.");

			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);

			await page.render({ canvasContext: context as any, viewport } as any).promise;

			page.cleanup();
			const previewAsset = await buildCompactCanvasImageAsset(canvas, `${source.name.replace(/\.pdf$/i, "")}-preview-${pageNumber}`, 800_000);
			previewUrls.push(previewAsset.previewUrl);
		}

		return { previewUrls, pageCount: pdf.numPages };
	} finally {
		await loadingTask.destroy();
	}
}

export async function convertHeicToPng(source: File): Promise<File> {
	const fd = new FormData();
	fd.append("img", source);
	const response = await fetch("/api/upload/convert-image", {
		method: "POST",
		body: fd,
	});
	if (!response.ok) {
		let msg = "Could not convert HEIC image.";
		try {
			const data = await response.json();
			msg = data?.message || msg;
		} catch {}
		throw new Error(msg);
	}
	const converted = await response.blob();
	const outName = source.name.replace(/\.(heic|heif)$/i, ".png");
	return new File([converted], outName, { type: "image/png", lastModified: Date.now() });
}

export async function buildLegacyVanguardSpreadPageAsset(spreadSrc: string, pageNumber: number, fileStem: string) {
	const { pdfUrl } = parseSpreadSource(spreadSrc);
	const sourceUrl = pdfUrl || spreadSrc;
	const response = await fetch(sourceUrl);
	if (!response.ok) throw new Error("Could not load this Vanguard spread PDF.");

	const pdfjs = await getPdfJs();
	const loadingTask = pdfjs.getDocument({ data: await response.arrayBuffer(), disableWorker: true } as any);
	const pdf = await loadingTask.promise;

	try {
		if (pageNumber > pdf.numPages) {
			throw new Error(`Page ${pageNumber} is not available in this PDF.`);
		}

		const page = await pdf.getPage(pageNumber);
		const viewport = page.getViewport({ scale: 1.25 });
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Could not create a canvas context for this Vanguard page preview.");
		}

		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await page.render({ canvasContext: context as any, viewport } as any).promise;

		page.cleanup();

		return await buildCompactCanvasImageAsset(canvas, fileStem);
	} finally {
		await loadingTask.destroy();
	}
}
