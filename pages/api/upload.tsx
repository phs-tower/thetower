/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { getArticleByIdAny, updateArticleById, uploadArticle, uploadMulti, uploadSpread, uploadFile } from "~/lib/queries";

async function uploadVang(files: formidable.Files, fields: formidable.Fields, chosenMonth: number, chosenYear: number) {
	let ret = { code: 500, error: "" };

	if (!files.spread) return { ...ret, error: "Did you upload a spread?" };

	const upload = await uploadFile(files.spread[0], "spreads");
	if (upload.code != 200) return { ...ret, code: upload.code, error: upload.message };

	try {
		await uploadSpread({
			title: fields.title ? fields.title[0] : "No title provided",
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
		const providedMonth = parseInt((fields as any)?.month?.[0] ?? "", 10);
		const providedYear = parseInt((fields as any)?.year?.[0] ?? "", 10);
		const chosenMonth = !isNaN(providedMonth) && providedMonth >= 1 && providedMonth <= 12 ? providedMonth : currentMonth;
		const chosenYear = !isNaN(providedYear) && providedYear >= 2010 && providedYear <= currentYear + 1 ? providedYear : currentYear;

		if (!fields.category) return res.status(500).json({ message: "Did you provide a category?" });

		if (fields.category[0] == "vanguard") {
			const status = await uploadVang(files, fields, chosenMonth, chosenYear);
			return res.status(status.code).json({ message: status.error ?? "Uploaded!" });
		}
		if (fields.category[0] == "multimedia") {
			if (!fields.subcategory || !fields.multi)
				return res.status(500).json({ message: "Did you provide a subcategory and a link to the resource?" });
			try {
				await uploadMulti({
					format: fields.subcategory[0],
					src_id: fields.multi[0],
					month: chosenMonth,
					year: chosenYear,
					title: fields.title ? fields.title[0] : "",
				});
				return res.status(200).json({ message: "Uploaded!" });
			} catch (e) {
				return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
			}
		}

		// Just a standard Article!
		const providedArticleId = Number((fields as any)?.["article-id"]?.[0] ?? "");
		const isEditingArticle = Number.isInteger(providedArticleId) && providedArticleId > 0;
		const hasExistingImgField = Object.prototype.hasOwnProperty.call(fields, "existing-img");
		const existingImgFromClient = String((fields as any)?.["existing-img"]?.[0] ?? "");

		let existingArticle = null;
		if (isEditingArticle) {
			existingArticle = await getArticleByIdAny(providedArticleId);
			if (!existingArticle) return res.status(404).json({ message: "Upload failed: article to edit was not found." });
			if (existingArticle.published) return res.status(403).json({ message: "Published articles are locked and cannot be edited here." });
		}

		let imgURL = existingArticle?.img ?? "";
		if (files.img) {
			console.log("uploading file...");
			const clientCompressed = ((fields as any)["img-client-compressed"]?.[0] ?? "") === "1";

			let upload = await uploadFile(files.img[0], "images", { skipCompression: clientCompressed });
			if (upload.code != 200) return res.status(upload.code).json({ message: upload.message });
			imgURL = upload.message;
			// Attach server final size if available
			(fields as any).serverImgSizeBytes = String((upload as any).sizeBytes ?? "");
			console.log("upload complete");
		} else if (isEditingArticle) {
			// Preserve existing image when provided by client; allow clearing by passing empty string.
			imgURL = hasExistingImgField ? existingImgFromClient : existingArticle?.img ?? "";
		}

		console.log("passing field checks...");
		if (!fields.subcategory || !fields.title || !fields.authors) {
			return res.status(500).json({
				message: `Some checks that should've already passed failed on the server. Content: ${JSON.stringify(
					fields
				)}. Contact online editor(s).`,
			});
		}
		console.log("checks completed, creating articleInfo object");

		const articleInfo = {
			category: fields.category[0],
			subcategory: fields.subcategory[0],
			title: fields.title[0],
			authors: fields.authors ? JSON.parse(fields.authors[0]) : [],
			content: fields.content ? fields.content[0] : "",
			contentInfo: fields["content-info"] ? fields["content-info"][0] : "",
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
		// bubble final server-compressed size to client if present
		const serverImgSizeBytes = (fields as any).serverImgSizeBytes ? Number((fields as any).serverImgSizeBytes) : undefined;
		return res.status(200).json({ message: isEditingArticle ? "Updated!" : "Uploaded!", serverImgSizeBytes });
	});
}

export const config = {
	api: {
		bodyParser: false,
	},
};
