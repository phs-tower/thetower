/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { getArticleByIdAny } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ message: "Invalid method" });

	const id = Number(req.body?.id);
	if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid article id." });

	const article = await getArticleByIdAny(id);
	if (!article) return res.status(404).json({ message: "Article not found." });
	if (article.published) return res.status(403).json({ message: "Published articles are locked and cannot be edited here." });

	return res.status(200).json(article);
}
