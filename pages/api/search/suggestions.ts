/** @format */

import type { NextApiRequest, NextApiResponse } from "next";
import { getArticlesBySearch, getCrosswordsBySearch, getSearchIndexArticles } from "~/lib/queries";
import { buildSearchIndexArticle, buildSearchSuggestions } from "~/lib/search";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	const mode = typeof req.query.mode === "string" ? req.query.mode : "suggestions";
	const query = (req.query.q as string)?.toLowerCase();

	try {
		if (mode === "index") {
			res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
			const articles = await getSearchIndexArticles();
			return res.status(200).json(articles.map(buildSearchIndexArticle));
		}

		if (mode === "query") {
			const rawQuery = `${req.query.q || ""}`.trim();
			const sort = req.query.sort === "oldest" ? "oldest" : "newest";
			const section = typeof req.query.section === "string" ? req.query.section : "Any";

			if (!rawQuery) {
				res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
				return res.status(200).json([]);
			}

			const [articles, crosswords] = await Promise.all([getArticlesBySearch(rawQuery), getCrosswordsBySearch(rawQuery)]);
			const all = [...articles, ...crosswords];
			const filtered = section === "Any" ? all : all.filter(article => article.category === section);
			const sorted = [...filtered].sort((a, b) =>
				sort === "newest"
					? b.year !== a.year
						? b.year - a.year
						: b.month - a.month
					: a.year !== b.year
					? a.year - b.year
					: a.month - b.month
			);

			res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
			return res.status(200).json(sorted);
		}

		if (!query || query.length < 2) return res.status(200).json([]);

		res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");

		const articles = await getSearchIndexArticles();
		res.status(200).json(buildSearchSuggestions(articles.map(buildSearchIndexArticle), query));
	} catch (err) {
		console.error(err);
		res.status(500).json([]);
	}
}
