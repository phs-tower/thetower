/** @format */

import { article, PrismaClient, spreads, multimedia } from "@prisma/client";
import { PuzzleInput } from "./crossword/types";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import formidable from "formidable";

if (process.env.SERVICE_ROLE == undefined) {
	throw new Error("Set up your .env!");
}

const prisma = new PrismaClient();

const supabase = createClient("https://yusjougmsdnhcsksadaw.supabase.co/", process.env.SERVICE_ROLE);

export async function getFrontpageArticles() {
	let articles: Record<string, article[]> = { "news-features": [], opinions: [], "arts-entertainment": [], sports: [], featured: [] };
	const categories = Object.keys(articles);

	for (let i = 0; i < categories.length - 1; i++) {
		const curr = new Date();
		let month = curr.getMonth() + 3;
		let year = curr.getFullYear();

		while (!articles[categories[i]].length) {
			month--;

			let temp = await prisma.article.findMany({
				orderBy: [
					{
						id: "asc",
					},
				],
				where: {
					year: year,
					month: month,
					category: categories[i],
					published: true,
				},
			});
			articles[categories[i]] = temp;
			if (month === 0) {
				month = 13;
				year--;
			}
		}
	}

	let a = await prisma.article.findFirst({ where: { featured: true } });
	if (a != null) articles["featured"].push(a);

	// a = await prisma.spreads.findFirst({orderBy: {year: "desc", month: "desc"}, where: {title: {startsWith: "VANGUARD"}}})
	// if (a != null) articles.vanguard.push(a)

	return articles;
}

export async function getPublishedArticles() {
	const articles = await prisma.article.findMany({
		where: {
			published: true,
		},
	});

	return articles;
}

export async function getArticle(year: string, month: string, cat: string, id: string, slug: string): Promise<article | null> {
	// new scheme
	let art =
		id !== "null"
			? await prisma.article.findFirst({
					where: {
						id: parseInt(id),
						published: true,
					},
			  })
			: await prisma.article.findFirst({
					where: {
						year: parseInt(year),
						month: parseInt(month),
						category: cat,
						title: decodeURI(slug.replace(/-/g, " ")),
						published: true,
					},
			  });

	// if (art) return Promise.resolve(art);
	// else return Promise.reject("No article found");
	return art;
}

export async function getCurrArticles() {
	const curr = new Date();
	let month = curr.getMonth() + 1;
	let year = curr.getFullYear();

	let articles = await getArticlesByDateOld(curr.getFullYear().toString(), (curr.getMonth() + 1).toString());
	while (articles.length === 0) {
		month--;
		if (month === 0) {
			month = 12;
			year--;
		}
		articles = await getArticlesByDateOld(year.toString(), month.toString());
	}

	return articles;
}

export async function getArticlesByDateOld(year: string, month: string) {
	let articles: article[] = [];

	articles = await prisma.article.findMany({
		orderBy: [
			{
				id: "desc",
			},
		],
		where: {
			year: parseInt(year),
			month: parseInt(month),
			published: true,
		},
	});

	return articles;
}

export async function getArticlesByDate(year: string, month: string) {
	let articles: Record<string, article[]> = { "news-features": [], opinions: [], "arts-entertainment": [], sports: [] };
	const categories = Object.keys(articles);

	for (let category of categories) {
		articles[category] = await prisma.article.findMany({
			orderBy: [
				{
					id: "asc",
				},
			],
			where: {
				year: parseInt(year),
				month: parseInt(month),
				published: true,
				category: category,
			},
		});
	}

	return articles;
}

export async function getIdOfNewest(cat: string, subcat: string | null) {
	let res;
	if (cat == "spreads") {
		res = await prisma.spreads.findFirst({
			orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
			where: {
				category: subcat != null ? subcat : "",
			},
			select: {
				id: true,
			},
		});
	} else if (cat == "multimedia") {
		subcat = subcat == null ? "youtube" : subcat;
		res = await prisma.multimedia.findFirst({
			orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
			where: {
				format: subcat,
			},
			select: {
				id: true,
			},
		});
	} else {
		const where = subcat == null ? { category: cat, published: true } : { category: cat, subcategory: subcat, published: true };

		res = await prisma.article.findFirst({
			orderBy: [
				{
					year: "desc",
				},
				{
					month: "desc",
				},
				{
					id: "desc",
				},
			],
			where,
			select: {
				id: true,
			},
		});
	}

	return res === null ? 0 : res.id;
}

export async function getArticlesByCategory(cat: string, take: number, offsetCursor: number, skip: number) {
	const articles = await prisma.article.findMany({
		orderBy: [
			{
				year: "desc",
			},
			{
				month: "desc",
			},
			{
				id: "desc",
			},
		],
		where: {
			category: cat,
			published: true,
		},
		take: take,
		cursor: {
			id: offsetCursor,
		},
		skip: skip,
	});

	return articles;
}

export async function getArticlesExceptCategory(cat: string) {
	let articles: any[] = [];
	let cats = ["news-features", "arts-entertainment", "opinions", "sports", "multimedia"];

	for (let i = 0; i < cats.length; i++) {
		// TODO: use foreach but make it actually work
		let c = cats[i];
		if (c == cat) continue;
		let id = await getIdOfNewest(c, c);
		let cArticles = await getArticlesByCategory(c, 2, id, 0);
		articles.push(...cArticles);
	}

	return articles;
}

export async function getArticlesBySearch(query: string) {
	return await prisma.article.findMany({
		where: {
			OR: [
				{
					title: {
						contains: query,
						mode: "insensitive",
					},
				},
				{
					content: {
						contains: query,
						mode: "insensitive",
					},
				},
				{
					authors: {
						has: query, // exact match in array
					},
				},
				{
					contentInfo: {
						contains: query,
						mode: "insensitive", // ✅ photo credit search!
					},
				},
			],
		},
		orderBy: {
			id: "desc",
		},
	});
}

export async function getArticlesBySubcategory(subcat: string, take: number, offsetCursor: number, skip: number) {
	const articles = await prisma.article.findMany({
		orderBy: [
			{
				year: "desc",
			},
			{
				month: "desc",
			},
		],
		where: {
			subcategory: subcat,
			published: true,
		},
		take: take,
		cursor: {
			id: offsetCursor,
		},
		skip: skip,
	});

	return articles;
}
import { Prisma } from "@prisma/client"; // make sure this is imported at the top

export async function getArticlesByAuthor(author: string) {
	const decoded = decodeURI(author);
	const nameParts = decoded.split(" ").filter(Boolean);

	const contentInfoConditions = nameParts.map(part => ({
		contentInfo: {
			contains: part,
			mode: Prisma.QueryMode.insensitive, // ✅ fix is here
		},
	}));

	const articles = await prisma.article.findMany({
		orderBy: [{ year: "desc" }, { month: "desc" }],
		where: {
			published: true,
			OR: [
				{
					authors: {
						has: decoded,
					},
				},
				{
					AND: contentInfoConditions,
				},
			],
		},
	});

	return articles;
}

export async function getSpreadsByCategory(category: string, take: number, offsetCursor: number, skip: number) {
	if (!take) take = 1;

	const spreads = await prisma.spreads.findMany({
		orderBy: [
			{
				year: "desc",
			},
			{
				month: "desc",
			},
		],
		where: {
			category,
		},
		take,
		cursor: {
			id: offsetCursor,
		},
		skip,
	});

	return spreads;
}

export async function getSpread(slug: string) {
	const spreads = await prisma.spreads.findFirst({
		where: {
			title: decodeURI(slug),
		},
	});

	return spreads;
}

export async function getCurrentCrossword(): Promise<PuzzleInput> {
	const crossword = (await prisma.crossword.findFirst({ orderBy: { date: "desc" } }))!;
	return {
		author: crossword.author,
		clues: JSON.parse(crossword.clues),
		date: crossword.date.toISOString(),
	};
}

export async function getCrosswords(take: number, offsetCursor: number, skip: number) {
	const crosswords = await prisma.crossword.findMany({
		orderBy: [{ date: "desc" }],
		cursor: {
			id: offsetCursor,
		},
		take,
		skip,
		select: {
			author: true,
			date: true,
			id: true,
		},
	});

	return crosswords.map(c => ({ author: c.author, id: c.id, date: c.date.toLocaleDateString() }));
}

export async function getIdOfNewestCrossword() {
	return (await prisma.crossword.findFirst({ orderBy: { date: "desc" }, select: { id: true } }))?.id || 1;
}

export async function getCrosswordById(id: number) {
	const crossword = await prisma.crossword.findFirst({ where: { id } });
	if (!crossword) return null;
	return {
		author: crossword.author,
		date: crossword.date.toLocaleDateString(),
		clues: JSON.parse(crossword.clues),
	};
}

export async function getMultiItems(format: string, take: number, offsetCursor: number, skip: number) {
	const items = await prisma.multimedia.findMany({
		orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
		where: {
			format: format,
		},
		take: take,
		cursor: {
			id: offsetCursor,
		},
		skip: skip,
	});

	return items;
}

export async function uploadArticle(info: {
	title: string;
	authors: string[];
	category: string;
	subcategory: string;
	month: number;
	year: number;
	img: string;
	content: string;
}) {
	console.log("uploadArticle called");
	await prisma.article.create({ data: info });
	console.log("upload complete from uploadArticle");
}

export async function uploadSpread(info: { title: string; src: string; month: number; year: number; category: string }) {
	await prisma.spreads.create({ data: info });
}

export async function uploadMulti(info: { format: string; src_id: string; month: number; year: number; title: string }) {
	await prisma.multimedia.create({ data: info });
}

export async function uploadFile(file: formidable.File, bucket: string) {
	const fileContent = await readFile(file.filepath);
	console.log("filename: ", file.originalFilename);
	let regex = file.originalFilename ? file.originalFilename.replaceAll(/(?!\.png|\.jpg|\.jpeg|\.gif)\.|\s/g, "-") : "";
	console.log("filename after regex:", regex);
	const { data, error } = await supabase.storage
		.from(bucket)
		.upload(regex, fileContent, { contentType: file.mimetype || "file/unknown", upsert: false });
	if (error) {
		console.error("we have a problem:", error);

		//@ts-ignore
		// error.statusCode exists but for some reason ts says it doesn't
		if (error.statusCode == "409") return { code: 409, message: "A file with that name already exists. Has your co-editor uploaded for you?" };

		//@ts-ignore
		// error.error & error.message exist but for some reason ts says they don't
		return { code: 500, message: `Unexpected problem in the server! Message: "${error.error}: ${error.message}". Contact Online editor(s).` };
	} else {
		console.log("File uploaded to ", data.fullPath);
		return { code: 200, message: supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl };
	}
}
