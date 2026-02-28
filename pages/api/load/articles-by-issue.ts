/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { getArticlesByIssue } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ message: "Invalid method" });

	const month = Number(req.body?.month);
	const year = Number(req.body?.year);

	if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12 || year < 2010 || year > 3000) {
		return res.status(400).json({ message: "Invalid month/year provided." });
	}

	const articles = await getArticlesByIssue(month, year);
	return res.status(200).json(articles);
}
