/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { getMultiItems, getArticlesBySubcategory, getIdOfNewest } from "~/lib/queries";

const categories: { [key: string]: string } = {
	"phs-profiles": "news-features",
	"student-athletes": "sports",
	"cheers-jeers": "opinions",
	editorials: "opinions",
	articles: "vanguard",
	"random-musings": "vanguard",
	youtube: "multimedia",
	podcast: "multimedia",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method != "POST") return res.status(400);

	const subcat = req.body.subcategory;
	const category = categories[subcat];
	const cursor = req.body.cursor;

	if (category != "multimedia") {
		const articles =
			cursor != null
				? await getArticlesBySubcategory(category, subcat, 10, cursor, 1)
				: await getArticlesBySubcategory(category, subcat, 10, await getIdOfNewest(category, subcat), 0);
		return res.status(200).json(articles);
	} else {
		const items =
			cursor != null ? await getMultiItems(subcat, 5, cursor, 1) : await getMultiItems(subcat, 5, await getIdOfNewest(category, subcat), 0);

		return res.status(200).json(items);
	}
}
