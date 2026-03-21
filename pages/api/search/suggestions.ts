/** @format */

import type { NextApiRequest, NextApiResponse } from "next";
import { getArticlesBySearch, getSearchIndexArticles } from "~/lib/queries";
import { buildSearchIndexArticle } from "~/lib/search";

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

			const all = await getArticlesBySearch(rawQuery);
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

		const authorsSet = new Set<string>();
		const photographersSet = new Set<string>();
		const articleSuggestions: any[] = [];

		for (const a of articles) {
			a.authors.forEach(name => {
				if (name.toLowerCase().includes(query)) authorsSet.add(name);
			});

			const info = a.contentInfo?.toLowerCase() || "";
			if (info.includes(query)) {
				a.contentInfo!.split("\n").forEach(line => {
					if (line.toLowerCase().includes(query) && line.includes(":")) {
						const name = line.split(":")[1]?.trim();
						if (name) photographersSet.add(name);
					}
				});
			}

			if (a.title.toLowerCase().includes(query)) {
				articleSuggestions.push({
					id: a.id,
					title: a.title,
					year: a.year,
					month: a.month,
					category: a.category,
					slug: a.title.replace(/\s+/g, "-"),
					type: "article",
				});
			}
		}

		const formatted = [
			...Array.from(authorsSet).map(name => ({ name, type: "author" })),
			...Array.from(photographersSet).map(name => ({ name, type: "photo" })),
			...articleSuggestions,
		];

		res.status(200).json(formatted.slice(0, 6));
	} catch (err) {
		console.error(err);
		res.status(500).json([]);
	}
}
