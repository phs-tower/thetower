/** @format */

import sharp from "sharp";
import { getSpreadPageImageUrl, parseSpreadSource } from "./utils";

export async function renderSpreadPdfPageToPngBuffer(spreadSrc: string, pageNumber: number, density = 180) {
	if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Invalid spread page number.");

	const { pdfUrl } = parseSpreadSource(spreadSrc);
	const sourceUrl = pdfUrl || spreadSrc;
	const response = await fetch(sourceUrl);
	if (!response.ok) throw new Error("Could not load the Vanguard spread PDF.");

	const pdfBuffer = Buffer.from(await response.arrayBuffer());
	const metadata = await sharp(pdfBuffer, { density }).metadata();
	const totalPages = Number(metadata.pages || 0);
	if (totalPages && pageNumber > totalPages) {
		throw new Error(`Page ${pageNumber} is not available in this PDF.`);
	}

	const pngBuffer = await sharp(pdfBuffer, { density, page: pageNumber - 1 })
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();

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
