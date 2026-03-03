/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

function getSingleFile(fileField: formidable.File | formidable.File[] | undefined) {
	if (!fileField) return null;
	return Array.isArray(fileField) ? fileField[0] ?? null : fileField;
}

function isHeicLike(file: formidable.File) {
	const mime = (file.mimetype || "").toLowerCase();
	const ext = path.extname(file.originalFilename || "").toLowerCase();
	return mime.includes("heic") || mime.includes("heif") || ext === ".heic" || ext === ".heif";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ message: "Invalid method" });

	const form = formidable({ multiples: false });
	form.parse(req, async (err: any, _fields: formidable.Fields, files: formidable.Files) => {
		if (err) {
			console.error("Could not parse convert-image form data:", err);
			return res.status(500).json({ message: "Could not parse image upload." });
		}

		const imgFile = getSingleFile(files.img);
		if (!imgFile) return res.status(400).json({ message: "No image file was uploaded." });
		if (!isHeicLike(imgFile)) return res.status(400).json({ message: "Only HEIC/HEIF files can be converted here." });

		try {
			const source = await readFile(imgFile.filepath);
			const converted = await sharp(source).rotate().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
			res.setHeader("Content-Type", "image/png");
			res.setHeader("Cache-Control", "no-store");
			return res.status(200).send(converted);
		} catch (error) {
			console.error("HEIC conversion failed:", error);
			return res.status(500).json({ message: "Could not convert this HEIC/HEIF file on the server." });
		}
	});
}

export const config = {
	api: {
		bodyParser: false,
	},
};
