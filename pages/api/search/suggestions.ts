/** @format */

import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	const query = (req.query.q as string)?.toLowerCase();
	if (!query || query.length < 2) return res.status(200).json([]);

	try {
		const articles = await prisma.article.findMany({
			where: { published: true },
			orderBy: { id: "desc" },
		});

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
