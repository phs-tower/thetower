/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { readFile } from "fs/promises";
import {
	getArticleByIdAny,
	getSpreadByIssue,
	updateArticleById,
	uploadArticle,
	uploadBuffer,
	uploadCrossword,
	uploadFile,
	uploadMulti,
	uploadSpread,
} from "~/lib/queries";
import { renderPdfBufferToPngBuffers } from "~/lib/spread-pages";
import { buildPublicStorageUrl } from "~/lib/storage";
import { buildSpreadSource, getSpreadPageImageUrl, parseSpreadSource } from "~/lib/utils";

function getSingleFile(fileField: formidable.File | formidable.File[] | undefined) {
	if (!fileField) return null;
	return Array.isArray(fileField) ? fileField[0] ?? null : fileField;
}

function getFirstFieldValue(field: string | string[] | undefined) {
	if (Array.isArray(field)) return field[0] ?? "";
	return field ?? "";
}

function normalizeVanguardSubcategory(category: string, subcategory: string) {
	return category === "vanguard" && subcategory === "random-musings" ? "articles" : subcategory;
}

async function uploadVanguardSpread(files: formidable.Files, fields: formidable.Fields, chosenMonth: number, chosenYear: number) {
	let ret = { code: 500, error: "" };

	const spreadFile = getSingleFile(files.spread);
	const spreadStoragePath = getFirstFieldValue((fields as any)["spread-storage-path"]).trim();
	let spreadPdfUrl = "";
	let spreadPath = "";
	let pdfBuffer: Buffer;

	if (spreadStoragePath) {
		spreadPath = spreadStoragePath;
		spreadPdfUrl = buildPublicStorageUrl("spreads", spreadStoragePath);

		const response = await fetch(spreadPdfUrl);
		if (!response.ok) {
			return { ...ret, error: "The uploaded Vanguard spread PDF could not be loaded from storage." };
		}

		pdfBuffer = Buffer.from(await response.arrayBuffer());
	} else {
		if (!spreadFile) return { ...ret, error: "Did you upload a spread?" };

		const upload = await uploadFile(spreadFile, "spreads");
		if (upload.code != 200) return { ...ret, code: upload.code, error: upload.message };
		if (!("path" in upload) || typeof upload.path !== "string") {
			return { ...ret, error: "The spread PDF uploaded, but its preview image path could not be determined." };
		}

		spreadPdfUrl = upload.message;
		spreadPath = upload.path;
		pdfBuffer = await readFile(spreadFile.filepath);
	}

	try {
		const { renderedPages, totalPages } = await renderPdfBufferToPngBuffers(pdfBuffer);
		if (!totalPages || renderedPages.length === 0) {
			return { ...ret, error: "The Vanguard spread PDF could not be rendered into page images." };
		}

		for (const renderedPage of renderedPages) {
			const pagePath = spreadPath.replace(/\.pdf$/i, `-page-${renderedPage.pageNumber}.png`);
			const pageUpload = await uploadBuffer(renderedPage.pngBuffer, "spreads", pagePath, "image/png");
			if (pageUpload.code !== 200) return { ...ret, code: pageUpload.code, error: pageUpload.message };
		}

		await uploadSpread({
			title: getFirstFieldValue(fields.title) || "No title provided",
			src: buildSpreadSource(spreadPdfUrl, totalPages),
			month: chosenMonth,
			year: chosenYear,
			category: "vanguard",
		});
		return { ...ret, code: 200, error: "" };
	} catch (e) {
		return { ...ret, error: `Unexpected problem in the server! Message: ${e}` };
	}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ error: "Invalid method" });

	const form = formidable({ multiples: false });

	form.parse(req, async (err: any, fields: formidable.Fields, files: formidable.Files) => {
		if (err) {
			console.error("Error parsing form data:", err);
			return res.status(500).json({ error: "Error parsing form data" });
		}

		const today = new Date();

		const currentMonth = today.getMonth() + 1;
		const currentYear = today.getFullYear();
		// allow client to provide custom month/year
		const providedMonth = parseInt(getFirstFieldValue((fields as any)?.month), 10);
		const providedYear = parseInt(getFirstFieldValue((fields as any)?.year), 10);
		const chosenMonth = !isNaN(providedMonth) && providedMonth >= 1 && providedMonth <= 12 ? providedMonth : currentMonth;
		const chosenYear = !isNaN(providedYear) && providedYear >= 2010 && providedYear <= currentYear + 1 ? providedYear : currentYear;

		const category = getFirstFieldValue(fields.category);
		if (!category) return res.status(500).json({ message: "Did you provide a category?" });
		const rawSubcategory = getFirstFieldValue(fields.subcategory);
		const subcategory = normalizeVanguardSubcategory(category, rawSubcategory);

		if (category == "vanguard" && subcategory == "spreads") {
			const status = await uploadVanguardSpread(files, fields, chosenMonth, chosenYear);
			return res.status(status.code).json({ message: status.error ?? "Uploaded!" });
		}
		if (category == "multimedia") {
			const multi = getFirstFieldValue(fields.multi);
			if (!subcategory || !multi) return res.status(500).json({ message: "Did you provide a subcategory and a link to the resource?" });
			try {
				await uploadMulti({
					format: subcategory,
					src_id: multi,
					month: chosenMonth,
					year: chosenYear,
					title: getFirstFieldValue(fields.title),
				});
				return res.status(200).json({ message: "Uploaded!" });
			} catch (e) {
				return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
			}
		}
		if (category == "crossword") {
			const title = getFirstFieldValue((fields as any)["crossword-title"]).trim();
			const author = getFirstFieldValue((fields as any)["crossword-author"]).trim();
			const dateValue = getFirstFieldValue((fields as any)["crossword-date"]).trim();
			const cluesRaw = getFirstFieldValue((fields as any)["crossword-clues"]).trim();
			if (!title || !author || !dateValue || !cluesRaw) {
				return res.status(400).json({ message: "Upload failed: crossword title, author, date, and clues are required." });
			}

			const crosswordDate = new Date(`${dateValue}T00:00:00`);
			if (Number.isNaN(crosswordDate.getTime())) {
				return res.status(400).json({ message: "Upload failed: crossword date is invalid." });
			}

			try {
				JSON.parse(cluesRaw);
			} catch {
				return res.status(400).json({ message: "Upload failed: crossword clue data is invalid." });
			}

			try {
				await uploadCrossword({
					title,
					author,
					date: crosswordDate,
					clues: cluesRaw,
				});
				return res.status(200).json({ message: "Crossword uploaded!" });
			} catch (e: any) {
				const message = String(e?.message || e || "");
				if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("crossword_created_at_key")) {
					return res.status(409).json({ message: "Upload failed: a crossword for that date already exists." });
				}
				return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
			}
		}

		// Just a standard Article!
		const providedArticleId = Number(getFirstFieldValue((fields as any)?.["article-id"]));
		const isEditingArticle = Number.isInteger(providedArticleId) && providedArticleId > 0;
		const hasExistingImgField = Object.prototype.hasOwnProperty.call(fields, "existing-img");
		const existingImgFromClient = String(getFirstFieldValue((fields as any)?.["existing-img"]));

		let existingArticle = null;
		if (isEditingArticle) {
			existingArticle = await getArticleByIdAny(providedArticleId);
			if (!existingArticle) return res.status(404).json({ message: "Upload failed: article to edit was not found." });
			if (existingArticle.published) return res.status(403).json({ message: "Published articles are locked and cannot be edited here." });
		}

		let imgURL = existingArticle?.img ?? "";
		let serverImgSizeBytes: number | undefined;
		const imageFile = getSingleFile(files.img);
		const vanguardPageNumber = Number(getFirstFieldValue((fields as any)["vanguard-page-number"]));
		const hasVanguardPageNumber = Number.isInteger(vanguardPageNumber) && vanguardPageNumber > 0;
		const isVanguardArticle = category === "vanguard" && subcategory === "articles";
		if (imageFile) {
			console.log("uploading file...");
			const clientCompressed = getFirstFieldValue((fields as any)["img-client-compressed"]) === "1";

			let upload = await uploadFile(imageFile, "images", { skipCompression: clientCompressed });
			if (upload.code != 200) return res.status(upload.code).json({ message: upload.message });
			imgURL = upload.message;
			serverImgSizeBytes = typeof (upload as any).sizeBytes === "number" ? Number((upload as any).sizeBytes) : undefined;
			console.log("upload complete");
		} else if (isVanguardArticle && hasVanguardPageNumber) {
			const spread = await getSpreadByIssue("vanguard", chosenMonth, chosenYear);
			if (!spread) {
				return res
					.status(400)
					.json({ message: "Upload failed: upload the Vanguard spread PDF for this issue before uploading Vanguard articles." });
			}

			const { pageCount } = parseSpreadSource(spread.src);
			if (pageCount && vanguardPageNumber > pageCount) {
				return res.status(400).json({
					message: `Upload failed: the selected Vanguard spread only has ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
				});
			}

			if (pageCount > 0) {
				imgURL = getSpreadPageImageUrl(spread.src, vanguardPageNumber);
			} else {
				return res.status(400).json({
					message: "Upload failed: this older Vanguard spread page needs to be prepared in the browser first. Refresh and try again.",
				});
			}
		} else if (isEditingArticle) {
			// Preserve existing image when provided by client; allow clearing by passing empty string.
			imgURL = hasExistingImgField ? existingImgFromClient : existingArticle?.img ?? "";
		}

		console.log("passing field checks...");
		const title = getFirstFieldValue(fields.title);
		const authorsRaw = getFirstFieldValue(fields.authors);
		if (!subcategory || !title || !authorsRaw) {
			return res.status(500).json({
				message: `Some checks that should've already passed failed on the server. Content: ${JSON.stringify(
					fields
				)}. Contact online editor(s).`,
			});
		}
		if (isVanguardArticle && !imgURL) {
			return res.status(400).json({
				message: "Upload failed: choose a valid Vanguard page number after uploading the issue spread PDF.",
			});
		}
		console.log("checks completed, creating articleInfo object");

		const articleInfo = {
			category,
			subcategory,
			title,
			authors: authorsRaw ? JSON.parse(authorsRaw) : [],
			content: getFirstFieldValue(fields.content),
			contentInfo: getFirstFieldValue(fields["content-info"]),
			img: imgURL,
			month: chosenMonth,
			year: chosenYear,
			markdown: true,
		};

		try {
			if (isEditingArticle) await updateArticleById(providedArticleId, articleInfo);
			else await uploadArticle(articleInfo);
		} catch (e) {
			console.log(e);
			return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
		}

		console.log("returning success message");
		return res.status(200).json({ message: isEditingArticle ? "Updated!" : "Uploaded!", serverImgSizeBytes });
	});
}

export const config = {
	api: {
		bodyParser: false,
	},
};
