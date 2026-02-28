/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { deleteDraftById, getArticleByIdAny } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ message: "Invalid method" });

	const id = Number(req.body?.id);
	if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid article id." });

	const article = await getArticleByIdAny(id);
	if (!article) return res.status(404).json({ message: "Draft not found." });
	if (article.published) return res.status(403).json({ message: "Published articles cannot be deleted as drafts." });

	try {
		await deleteDraftById(id);
		return res.status(200).json({ message: "Draft deleted." });
	} catch (e) {
		return res.status(500).json({ message: `Unexpected server problem: ${e}` });
	}
}
