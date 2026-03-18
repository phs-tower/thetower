/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { getSpreadByIssue } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(400).json({ message: "Invalid method" });

	const category = String(req.body?.category || "vanguard");
	const month = Number(req.body?.month);
	const year = Number(req.body?.year);

	if (!category) return res.status(400).json({ message: "Invalid category provided." });
	if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12 || year < 2010 || year > 3000) {
		return res.status(400).json({ message: "Invalid month/year provided." });
	}

	const spread = await getSpreadByIssue(category, month, year);
	return res.status(200).json(spread ?? null);
}
