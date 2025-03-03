/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { getSpreadsByCategory, getIdOfNewest } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method != "POST") return res.status(400);

	const category = req.body.category;
	const cursor = req.body.cursor;

	const spreads =
		cursor != null
			? await getSpreadsByCategory(category, 10, cursor, 1)
			: await getSpreadsByCategory(category, 10, await getIdOfNewest("spreads", category), 0);

	console.log(category, cursor, await getIdOfNewest(category, null), spreads);
	return res.status(200).json(spreads);
}
