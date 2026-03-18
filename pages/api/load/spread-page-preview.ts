/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { renderSpreadPdfPageToPngBuffer } from "~/lib/spread-pages";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "GET") return res.status(400).json({ message: "Invalid method" });

	const spreadSrc = String(req.query?.src || "");
	const pageNumber = Number(req.query?.page);

	if (!spreadSrc) return res.status(400).json({ message: "Missing spread source." });
	if (!Number.isInteger(pageNumber) || pageNumber < 1) return res.status(400).json({ message: "Invalid page number." });

	try {
		const { pngBuffer, totalPages } = await renderSpreadPdfPageToPngBuffer(spreadSrc, pageNumber);
		res.setHeader("Content-Type", "image/png");
		res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
		if (totalPages) res.setHeader("X-Spread-Page-Count", String(totalPages));
		return res.status(200).send(pngBuffer);
	} catch (error: any) {
		const message = error?.message || "Could not render this spread page.";
		const status = message.includes("not available") ? 404 : 500;
		return res.status(status).json({ message });
	}
}
