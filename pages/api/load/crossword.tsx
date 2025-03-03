/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { getCrosswords, getIdOfNewestCrossword } from "~/lib/queries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method != "POST") return res.status(400);

	const cursor = req.body.cursor;

	const crosswords = cursor != null ? await getCrosswords(10, cursor, 1) : await getCrosswords(10, await getIdOfNewestCrossword(), 0);
	return res.status(200).json(crosswords);
}
