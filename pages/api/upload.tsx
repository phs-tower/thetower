/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { uploadArticle, uploadMulti, uploadSpread, uploadFile } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ error: "Invalid method" });

	const form = formidable({ multiples: false });

	form.parse(req, async (err: any, fields: formidable.Fields, files: formidable.Files) => {
		if (err) {
			console.error("Error parsing form data:", err);
			return res.status(500).json({ error: "Error parsing form data" });
		}

		const today = new Date();

		if (!fields.category) return res.status(500).json({ message: "Did you provide a category?" });
		if (fields.category[0] == "vanguard") {
			if (!files.spread) return res.status(500).json({ message: "Did you upload a spread?" });
			let upload = await uploadFile(files.spread[0], "spreads");
			if (upload.code != 200) return res.status(upload.code).json({ message: upload.message });
			try {
				await uploadSpread({
					title: fields.title ? fields.title[0] : "No title provided",
					src: upload.message,
					month: today.getMonth(),
					year: today.getFullYear(),
					category: "vanguard",
				});
				return res.status(200).json({ message: "Uploaded!" });
			} catch (e) {
				return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
			}
		} else if (fields.category[0] == "multimedia") {
			if (!fields.subcategory || !fields.multi)
				return res.status(500).json({ message: "Did you provide a subcategory and a link to the resource?" });
			try {
				await uploadMulti({
					format: fields.subcategory[0],
					src_id: fields.multi[0],
					month: today.getMonth(),
					year: today.getFullYear(),
					title: fields.title ? fields.title[0] : "",
				});
				return res.status(200).json({ message: "Uploaded!" });
			} catch (e) {
				return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
			}
		} else {
			console.log("standard article type");
			let imgURL = "";
			if (files.img) {
				console.log("uploading file...");
				let upload = await uploadFile(files.img[0], "images");
				if (upload.code != 200) return res.status(upload.code).json({ message: upload.message });
				imgURL = upload.message;
				console.log("upload complete");
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
				img: imgURL,
				month: today.getMonth(),
				year: today.getFullYear(),
				markdown: true,
			};

			try {
				console.log("calling uploadArticle");
				await uploadArticle(articleInfo);
				console.log("try block complete");
			} catch (e) {
				console.log(e);
				return res.status(500).json({ message: `Unexpected problem in the server! Message: ${e}` });
			}

			console.log("returning success message");
			return res.status(200).json({ message: "Uploaded!" });
		}
	});
}

export const config = {
	api: {
		bodyParser: false,
	},
};
