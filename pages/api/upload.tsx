/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { getArticleByIdAny, updateArticleById, uploadArticle, uploadMulti, uploadSpread, uploadFile } from "~/lib/queries";

function getSingleFile(fileField: formidable.File | formidable.File[] | undefined) {
	if (!fileField) return null;
	return Array.isArray(fileField) ? fileField[0] ?? null : fileField;
}

function getFirstFieldValue(field: string | string[] | undefined) {
	if (Array.isArray(field)) return field[0] ?? "";
	return field ?? "";
}

async function uploadVang(files: formidable.Files, fields: formidable.Fields, chosenMonth: number, chosenYear: number) {
	let ret = { code: 500, error: "" };

	const spreadFile = getSingleFile(files.spread);
	if (!spreadFile) return { ...ret, error: "Did you upload a spread?" };

	const upload = await uploadFile(spreadFile, "spreads");
	if (upload.code != 200) return { ...ret, code: upload.code, error: upload.message };

	try {
		await uploadSpread({
			title: getFirstFieldValue(fields.title) || "No title provided",
			src: upload.message,
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

		if (category == "vanguard") {
			const status = await uploadVang(files, fields, chosenMonth, chosenYear);
			return res.status(status.code).json({ message: status.error ?? "Uploaded!" });
		}
		if (category == "multimedia") {
			const subcategory = getFirstFieldValue(fields.subcategory);
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
		if (imageFile) {
			console.log("uploading file...");
			const clientCompressed = getFirstFieldValue((fields as any)["img-client-compressed"]) === "1";

			let upload = await uploadFile(imageFile, "images", { skipCompression: clientCompressed });
			if (upload.code != 200) return res.status(upload.code).json({ message: upload.message });
			imgURL = upload.message;
			serverImgSizeBytes = typeof (upload as any).sizeBytes === "number" ? Number((upload as any).sizeBytes) : undefined;
			console.log("upload complete");
		} else if (isEditingArticle) {
			// Preserve existing image when provided by client; allow clearing by passing empty string.
			imgURL = hasExistingImgField ? existingImgFromClient : existingArticle?.img ?? "";
		}

		console.log("passing field checks...");
		const subcategory = getFirstFieldValue(fields.subcategory);
		const title = getFirstFieldValue(fields.title);
		const authorsRaw = getFirstFieldValue(fields.authors);
		if (!subcategory || !title || !authorsRaw) {
			return res.status(500).json({
				message: `Some checks that should've already passed failed on the server. Content: ${JSON.stringify(
					fields
				)}. Contact online editor(s).`,
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
