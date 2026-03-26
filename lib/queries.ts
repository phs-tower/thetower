/** @format */

import { article, PrismaClient, spreads, multimedia, Prisma } from "@prisma/client";
import { PuzzleInput } from "./crossword/types";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StorageApiError } from "@supabase/storage-js";
import { readFile } from "fs/promises";
import formidable from "formidable";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { SearchResultItem, toCrosswordResultItem } from "./search";

export type MultimediaItem = Omit<multimedia, "id"> & { id: number };
export type CrosswordCreditItem = { id: number; title: string; author: string; date: string };

declare global {
	// eslint-disable-next-line no-var
	var __towerPrisma: PrismaClient | undefined;
}

let yolo = false;

if (process.env.SERVICE_ROLE == undefined) {
	// throw new Error("Set up your .env!");
	console.warn("No .env file ... defaulting to yolo mode");
	yolo = true;
}

const prisma = yolo
	? undefined
	: global.__towerPrisma ??
	  new PrismaClient({
			log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
	  });

if (!yolo && process.env.NODE_ENV !== "production") {
	global.__towerPrisma = prisma;
}

const supabase = !process.env.SERVICE_ROLE ? undefined : createClient("https://yusjougmsdnhcsksadaw.supabase.co/", process.env.SERVICE_ROLE);

function getArticleSubcategoryFilter(subcat: string) {
	return subcat === "articles" ? { in: ["articles", "random-musings"] } : subcat;
}

function getCrosswordTitleFallback(title: string | null | undefined, id: number | bigint) {
	const trimmed = `${title || ""}`.trim();
	return trimmed || `Crossword No. ${Number(id)}`;
}

const recentQueryFailures = new Map<string, number>();
let prismaConnectPromise: Promise<void> | null = null;
let prismaConnected = false;
const prismaConnectRetryDelays = process.env.NODE_ENV === "development" ? [0] : [0, 500, 1500];
const queryRetryDelays = process.env.NODE_ENV === "development" ? [] : [400, 1000];

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableConnectionError(error: unknown) {
	if (!(error instanceof Error)) return false;

	const message = error.message.toLowerCase();
	return (
		message.includes("can't reach database server") ||
		message.includes("prismaclientinitializationerror") ||
		message.includes("connection") ||
		message.includes("econnreset") ||
		message.includes("timed out")
	);
}

function logQueryFailure(queryName: string, error: unknown) {
	const now = Date.now();
	const last = recentQueryFailures.get(queryName) ?? 0;
	if (now - last < 15000) return;
	recentQueryFailures.set(queryName, now);

	if (error instanceof Error) {
		const message = error.message.replace(/\s+/g, " ").trim();
		console.warn(`[queries] ${queryName} failed: ${message}`);
		return;
	}

	console.warn(`[queries] ${queryName} failed`);
}

async function ensurePrismaConnected(db: PrismaClient) {
	if (prismaConnected) return;
	if (prismaConnectPromise) return prismaConnectPromise;

	prismaConnectPromise = (async () => {
		let lastError: unknown;

		for (let i = 0; i < prismaConnectRetryDelays.length; i++) {
			if (prismaConnectRetryDelays[i] > 0) {
				await sleep(prismaConnectRetryDelays[i]);
			}

			try {
				await db.$connect();
				prismaConnected = true;
				return;
			} catch (error) {
				lastError = error;
				prismaConnected = false;
				if (!isRetryableConnectionError(error)) break;
			}
		}

		throw lastError;
	})().finally(() => {
		prismaConnectPromise = null;
	});

	return prismaConnectPromise;
}

async function withQueryFallback<T>(
	queryName: string,
	fallback: T,
	run: (db: PrismaClient) => Promise<T>,
	options?: { throwOnFailure?: boolean }
): Promise<T> {
	const db = prisma;
	if (!db) return fallback;

	let attempt = 0;
	let lastError: unknown;

	while (attempt <= queryRetryDelays.length) {
		try {
			await ensurePrismaConnected(db);
			return await run(db);
		} catch (error) {
			lastError = error;
			if (!isRetryableConnectionError(error) || attempt === queryRetryDelays.length) {
				break;
			}

			prismaConnected = false;
			try {
				await db.$disconnect();
			} catch {
				// ignore disconnect cleanup failures
			}
			await sleep(queryRetryDelays[attempt]);
		}

		attempt++;
	}

	logQueryFailure(queryName, lastError);
	if (options?.throwOnFailure && lastError) {
		throw lastError;
	}
	return fallback;
}

export async function getFrontpageArticles() {
	let articles: Record<string, article[]> = { "news-features": [], opinions: [], "arts-entertainment": [], sports: [], featured: [] };
	if (!prisma) return articles;

	return withQueryFallback("getFrontpageArticles", articles, async db => {
		const categories = Object.keys(articles);

		for (let i = 0; i < categories.length - 1; i++) {
			const curr = new Date();
			let month = curr.getMonth() + 3;
			let year = curr.getFullYear();
			let attempts = 0;

			while (!articles[categories[i]].length && attempts < 24) {
				month--;
				attempts++;

				let temp = await db.article.findMany({
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

		let a = await db.article.findFirst({ where: { featured: true } });
		if (a != null) articles["featured"].push(a);

		return articles;
	});
}

export async function getPublishedArticles() {
	if (!prisma) return [];
	const articles = await prisma.article.findMany({
		where: {
			published: true,
		},
	});

	return articles;
}

export async function getPublishedArchiveIssues() {
	return withQueryFallback(
		"getPublishedArchiveIssues",
		[] as { year: number; month: number }[],
		async db =>
			await db.article.findMany({
				where: {
					published: true,
					NOT: {
						year: 1970,
						month: 1,
					},
				},
				select: {
					year: true,
					month: true,
				},
				distinct: ["year", "month"],
				orderBy: [{ year: "desc" }, { month: "desc" }],
			})
	);
}

export async function getRecommendedCategoryArticle(category: string) {
	return withQueryFallback(
		"getRecommendedCategoryArticle",
		null,
		async db =>
			await db.article.findFirst({
				where: {
					category,
					published: true,
				},
				orderBy: [{ year: "desc" }, { month: "desc" }, { id: "asc" }],
			})
	);
}

export async function getRecommendedSubcategoryArticle(category: string, subcat: string) {
	return withQueryFallback(
		"getRecommendedSubcategoryArticle",
		null,
		async db =>
			await db.article.findFirst({
				where: {
					category,
					subcategory: getArticleSubcategoryFilter(subcat),
					published: true,
				},
				orderBy: [{ year: "desc" }, { month: "desc" }, { id: "asc" }],
			})
	);
}

export async function getRecommendedSubcategoryArticles(category: string, subcat: string) {
	const latest = await withQueryFallback(
		"getRecommendedSubcategoryArticles.latest",
		null as { year: number; month: number } | null,
		async db =>
			await db.article.findFirst({
				where: {
					category,
					subcategory: getArticleSubcategoryFilter(subcat),
					published: true,
				},
				orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
				select: {
					year: true,
					month: true,
				},
			})
	);

	if (!latest) return [];

	return withQueryFallback(
		"getRecommendedSubcategoryArticles.list",
		[] as article[],
		async db =>
			await db.article.findMany({
				where: {
					category,
					subcategory: getArticleSubcategoryFilter(subcat),
					published: true,
					year: latest.year,
					month: latest.month,
				},
				orderBy: [{ id: "asc" }],
			})
	);
}

export async function getArticlesByIssue(month: number, year: number) {
	if (!prisma) return [];
	return await prisma.article.findMany({
		where: {
			month,
			year,
		},
		orderBy: [{ id: "desc" }],
		select: {
			id: true,
			title: true,
			category: true,
			subcategory: true,
			published: true,
			month: true,
			year: true,
		},
	});
}

export async function getPublishedVanguardArticlesByIssue(month: number, year: number) {
	return withQueryFallback(
		"getPublishedVanguardArticlesByIssue",
		[] as article[],
		async db =>
			await db.article.findMany({
				where: {
					category: "vanguard",
					subcategory: getArticleSubcategoryFilter("articles"),
					published: true,
					month,
					year,
				},
				orderBy: [{ id: "asc" }],
			})
	);
}

export async function getArticleByIdAny(id: number) {
	if (!prisma) return null;
	return await prisma.article.findFirst({
		where: { id },
	});
}
export async function getArticle(year: string, month: string, cat: string, id: string, slug: string): Promise<article | null> {
	if (!prisma) return null;

	const parsedId = parseInt(id);
	const isIdValid = !isNaN(parsedId) && id !== "null";
	const titleFromSlug = decodeURIComponent(slug.split("-").slice(0, -1).join(" "));

	return withQueryFallback(
		"getArticle",
		null,
		async db =>
			isIdValid
				? await db.article.findFirst({
						where: {
							id: parsedId,
							published: true,
						},
				  })
				: await db.article.findFirst({
						where: {
							year: parseInt(year),
							month: parseInt(month),
							category: cat,
							title: {
								equals: titleFromSlug,
								mode: "insensitive",
							},
							published: true,
						},
				  }),
		{ throwOnFailure: true }
	);
}

export async function getCurrArticles() {
	if (!prisma) return [];
	const curr = new Date();
	let month = curr.getMonth() + 1;
	let year = curr.getFullYear();

	let articles = await getArticlesByDateOld(year.toString(), month.toString());
	let attempts = 0;
	while (articles.length === 0 && attempts < 24) {
		attempts++;
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
	return withQueryFallback(
		"getArticlesByDateOld",
		[] as article[],
		async db =>
			await db.article.findMany({
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
			})
	);
}

export async function getArticlesByDate(year: string, month: string) {
	let articles: Record<string, article[]> = { "news-features": [], opinions: [], "arts-entertainment": [], sports: [] };
	const categories = Object.keys(articles);

	if (!prisma) return articles;
	if (parseInt(year) === 1970 && parseInt(month) === 1) return articles;

	return withQueryFallback("getArticlesByDate", articles, async db => {
		for (let category of categories) {
			articles[category] = await db.article.findMany({
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
	});
}

export async function getIdOfNewest(cat: string, subcat: string | null) {
	return withQueryFallback("getIdOfNewest", 0, async db => {
		let res;
		if (cat == "spreads") {
			res = await db.spreads.findFirst({
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
			res = await db.multimedia.findFirst({
				orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
				where: {
					format: subcat,
				},
				select: {
					id: true,
				},
			});
		} else {
			const where =
				subcat == null
					? { category: cat, published: true }
					: { category: cat, subcategory: getArticleSubcategoryFilter(subcat), published: true };

			res = await db.article.findFirst({
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

		return res === null ? 0 : Number(res.id);
	});
}

export async function getArticlesByCategory(cat: string, take: number, offsetCursor: number, skip: number) {
	return withQueryFallback(
		"getArticlesByCategory",
		[] as article[],
		async db =>
			await db.article.findMany({
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
				take,
				cursor: offsetCursor ? { id: offsetCursor } : undefined,
				skip,
			})
	);
}

export async function getArticlesExceptCategory(cat: string) {
	let articles: any[] = [];
	if (!prisma) return articles;
	let cats = ["news-features", "arts-entertainment", "opinions", "sports", "multimedia"];

	return withQueryFallback("getArticlesExceptCategory", articles, async () => {
		for (let i = 0; i < cats.length; i++) {
			let c = cats[i];
			if (c == cat) continue;
			let id = await getIdOfNewest(c, c);
			let cArticles = await getArticlesByCategory(c, 2, Number(id), 0);
			articles.push(...cArticles);
		}

		return articles;
	});
}

export async function getArticlesBySearch(query: string | string[]) {
	const safeQuery = Array.isArray(query) ? query[0] : query;
	if (!prisma) return [];
	if (!safeQuery || !safeQuery.trim()) return [];

	// Case-insensitive partial match for names inside the authors[] array using Prisma builder
	// Prisma lacks ILIKE against array elements directly; emulate by OR-ing against hasSome with tokens
	// and falling back to a secondary scan on contentInfo/title/content.
	const tokens = safeQuery
		.split(/\s+/)
		.map(t => t.trim())
		.filter(Boolean);

	// Find articles whose authors[] contains any token exactly, plus an additional pass for relaxed matching using contains on JSON-serialized authors
	const authorIdRows = await prisma.article.findMany({
		where: {
			published: true,
			OR: [
				tokens.length ? { authors: { hasSome: tokens } } : undefined,
				// relaxed: if a single token, match full name equality too
				tokens.length === 1 ? { authors: { has: tokens[0] } } : undefined,
			].filter(Boolean) as Prisma.articleWhereInput[],
		},
		select: { id: true },
	});
	const authorIdsDirect = authorIdRows.map(r => r.id);

	// Extra: in-memory partial match across authors[] to emulate ILIKE against array items
	const qLower = safeQuery.toLowerCase();
	const scanRows = await prisma.article.findMany({
		where: { published: true },
		select: { id: true, authors: true },
	});
	const authorIdsScan = scanRows
		.filter(r => Array.isArray(r.authors) && r.authors.some(name => (name || "").toLowerCase().includes(qLower)))
		.map(r => r.id);

	const authorIds = Array.from(new Set([...authorIdsDirect, ...authorIdsScan]));

	// Build OR conditions, including case-insensitive text search and author matches
	const orConditions: Prisma.articleWhereInput[] = [
		{
			title: {
				contains: safeQuery,
				mode: "insensitive",
			},
		},
		{
			content: {
				contains: safeQuery,
				mode: "insensitive",
			},
		},
		{
			contentInfo: {
				contains: safeQuery,
				mode: "insensitive",
			},
		},
	];

	// Try exact author full-name matches (case variants)
	const titleCase = safeQuery
		.split(/\s+/)
		.map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
		.join(" ");
	const lowered = safeQuery.toLowerCase();
	const uppered = safeQuery.toUpperCase();

	// Push distinct variants to OR conditions
	const authorHasVariants = Array.from(new Set([safeQuery, titleCase, lowered, uppered])).filter(Boolean) as string[];
	for (const variant of authorHasVariants) {
		orConditions.push({ authors: { has: variant } });
	}

	if (authorIds.length) {
		orConditions.push({ id: { in: authorIds } });
	}

	return await prisma.article.findMany({
		where: {
			OR: orConditions,
		},
		orderBy: {
			id: "desc",
		},
	});
}

export async function getSearchIndexArticles() {
	if (!prisma) return [];

	const [articles, crosswords] = await Promise.all([
		prisma.article.findMany({
			where: {
				published: true,
			},
			orderBy: [{ id: "desc" }],
			select: {
				id: true,
				title: true,
				category: true,
				subcategory: true,
				authors: true,
				month: true,
				year: true,
				img: true,
				contentInfo: true,
			},
		}),
		prisma.crossword.findMany({
			orderBy: [{ date: "desc" }],
			select: {
				id: true,
				title: true,
				author: true,
				date: true,
			},
		}),
	]);

	return [
		...articles,
		...crosswords.map(crossword => ({
			id: Number(crossword.id),
			title: getCrosswordTitleFallback(crossword.title, crossword.id),
			category: "crossword",
			subcategory: "",
			authors: [crossword.author],
			month: crossword.date.getMonth() + 1,
			year: crossword.date.getFullYear(),
			img: "",
			contentInfo: null,
			searchType: "crossword" as const,
			crosswordId: Number(crossword.id),
		})),
	];
}

export async function getArticlesBySubcategory(category: string, subcat: string, take: number, offsetCursor: number, skip: number) {
	return withQueryFallback(
		"getArticlesBySubcategory",
		[] as article[],
		async db =>
			await db.article.findMany({
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
					category,
					subcategory: getArticleSubcategoryFilter(subcat),
					published: true,
				},
				take: take,
				cursor: offsetCursor ? { id: offsetCursor } : undefined,
				skip: skip,
			})
	);
}

export async function getArticlesByAuthor(author: string) {
	if (!prisma) return [];
	const decoded = decodeURI(author).trim();
	if (!decoded) return [];

	return withQueryFallback("getArticlesByAuthor", [] as article[], async db => {
		const exactAuthorRows = await db.article.findMany({
			where: {
				published: true,
				authors: {
					has: decoded,
				},
			},
			select: { id: true },
		});

		const photoCreditRows = await db.article.findMany({
			where: {
				published: true,
				contentInfo: {
					not: null,
					contains: decoded,
					mode: "insensitive",
				},
				OR: [
					{ contentInfo: { contains: "Photo:", mode: "insensitive" } },
					{ contentInfo: { contains: "Image:", mode: "insensitive" } },
					{ contentInfo: { contains: "Graphic:", mode: "insensitive" } },
				],
			},
			select: { id: true },
		});

		const ids = Array.from(new Set([...exactAuthorRows.map(r => r.id), ...photoCreditRows.map(r => r.id)]));

		if (!ids.length) return [];

		return await db.article.findMany({
			where: { id: { in: ids } },
			orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
		});
	});
}

export async function getCrosswordsByAuthor(author: string) {
	if (!prisma) return [];
	const decoded = decodeURI(author).trim();
	if (!decoded) return [];

	return withQueryFallback("getCrosswordsByAuthor", [] as CrosswordCreditItem[], async db => {
		const rows = await db.crossword.findMany({
			where: {
				author: decoded,
			},
			orderBy: [{ date: "desc" }],
			select: {
				id: true,
				title: true,
				author: true,
				date: true,
			},
		});

		return rows.map(row => ({
			id: Number(row.id),
			title: getCrosswordTitleFallback(row.title, row.id),
			author: row.author,
			date: row.date.toISOString(),
		}));
	});
}

export async function getCrosswordsBySearch(query: string): Promise<SearchResultItem[]> {
	const safeQuery = query.trim();
	if (!prisma || !safeQuery) return [];

	return withQueryFallback("getCrosswordsBySearch", [] as SearchResultItem[], async db => {
		const rows = await db.crossword.findMany({
			where: {
				OR: [
					{
						title: {
							contains: safeQuery,
							mode: "insensitive",
						},
					},
					{
						author: {
							contains: safeQuery,
							mode: "insensitive",
						},
					},
				],
			},
			orderBy: [{ date: "desc" }],
			select: {
				id: true,
				title: true,
				author: true,
				date: true,
			},
		});

		return rows.map(row =>
			toCrosswordResultItem({
				id: Number(row.id),
				title: getCrosswordTitleFallback(row.title, row.id),
				author: row.author,
				date: row.date,
			})
		);
	});
}

export async function getSpreadsByCategory(category: string, take: number, offsetCursor: number, skip: number) {
	if (!take) take = 1;

	return withQueryFallback(
		"getSpreadsByCategory",
		[] as spreads[],
		async db =>
			await db.spreads.findMany({
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
				cursor: offsetCursor ? { id: offsetCursor } : undefined,
				skip,
			})
	);
}

export async function getSpreadByIssue(category: string, month: number, year: number) {
	return withQueryFallback(
		"getSpreadByIssue",
		null,
		async db =>
			await db.spreads.findFirst({
				where: {
					category,
					month,
					year,
				},
				orderBy: [{ id: "desc" }],
			})
	);
}

export async function getSpread(slug: string) {
	return withQueryFallback(
		"getSpread",
		null,
		async db =>
			await db.spreads.findFirst({
				where: {
					title: decodeURI(slug),
				},
			}),
		{ throwOnFailure: true }
	);
}

export async function getCurrentCrossword(): Promise<PuzzleInput | null> {
	const crossword = await withQueryFallback("getCurrentCrossword", null, async db => await db.crossword.findFirst({ orderBy: { date: "desc" } }));
	if (!crossword) return null;

	return {
		title: getCrosswordTitleFallback(crossword.title, crossword.id),
		author: crossword.author,
		clues: JSON.parse(crossword.clues),
		date: crossword.date.toISOString(),
	};
}

export async function getCrosswords(take: number, offsetCursor: number, skip: number) {
	const crosswords = await withQueryFallback(
		"getCrosswords",
		[] as { author: string; title: string | null; date: Date; id: number | bigint }[],
		async db =>
			await db.crossword.findMany({
				orderBy: [{ date: "desc" }],
				cursor: offsetCursor ? ({ id: BigInt(offsetCursor) } as any) : undefined,
				take,
				skip,
				select: {
					author: true,
					title: true,
					date: true,
					id: true,
				},
			})
	);

	return crosswords.map(c => ({
		author: c.author,
		title: getCrosswordTitleFallback(c.title, c.id),
		id: Number(c.id),
		date: c.date.toLocaleDateString(),
	}));
}

export async function getIdOfNewestCrossword() {
	return withQueryFallback("getIdOfNewestCrossword", 0, async db => {
		const latest = await db.crossword.findFirst({ orderBy: { date: "desc" }, select: { id: true } });
		return latest ? Number(latest.id) : 0;
	});
}

export async function getCrosswordById(id: number) {
	const crossword = await withQueryFallback(
		"getCrosswordById",
		null,
		async db => await db.crossword.findFirst({ where: { id: BigInt(id) as any } })
	);
	if (!crossword) return null;
	return {
		title: getCrosswordTitleFallback(crossword.title, crossword.id),
		author: crossword.author,
		date: crossword.date.toISOString(),
		clues: JSON.parse(crossword.clues),
	};
}

export async function getMultiItems(format: string, take: number, offsetCursor: number, skip: number): Promise<MultimediaItem[]> {
	return withQueryFallback("getMultiItems", [] as MultimediaItem[], async db => {
		const items = await db.multimedia.findMany({
			orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
			where: {
				format: format,
			},
			take: take,
			cursor: offsetCursor ? ({ id: BigInt(offsetCursor) } as any) : undefined,
			skip: skip,
		});

		return items.map(item => ({ ...item, id: Number(item.id) }));
	});
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
	contentInfo?: string;
	markdown?: boolean;
}) {
	if (!prisma) throw new Error("no!");
	console.log("uploadArticle called");
	await prisma.article.create({ data: info });
	console.log("upload complete from uploadArticle");
}

export async function updateArticleById(
	id: number,
	info: {
		title: string;
		authors: string[];
		category: string;
		subcategory: string;
		month: number;
		year: number;
		img: string;
		content: string;
		contentInfo?: string;
		markdown?: boolean;
	}
) {
	if (!prisma) throw new Error("no!");
	await prisma.article.update({
		where: { id },
		data: info,
	});
}

export async function deleteDraftById(id: number) {
	if (!prisma) throw new Error("no!");
	await prisma.article.delete({
		where: { id },
	});
}

export async function uploadSpread(info: { title: string; src: string; month: number; year: number; category: string }) {
	if (!prisma) throw new Error("npoe");
	await prisma.spreads.create({ data: info });
}

export async function uploadMulti(info: { format: string; src_id: string; month: number; year: number; title: string }) {
	if (!prisma) throw new Error("no");
	await prisma.multimedia.create({ data: info });
}

export async function uploadCrossword(info: { title: string; author: string; date: Date; clues: string }) {
	if (!prisma) throw new Error("no");
	await prisma.crossword.create({ data: info });
}

/**
 * Compress image to within `marginOfError` of `targetBytes` (or quality level 50 if not compressible to `targetBytes`)
 * @param image An image buffer
 * @returns Another image buffer!
 */
async function compressImg(image: Buffer, options?: { targetBytes?: number; marginOfError?: number }) {
	let check = await sharp(image).webp().toBuffer();
	const targetBytes = options && options.targetBytes ? options.targetBytes : 500_000;
	const marginOfError = options && options.marginOfError ? options.marginOfError : 100_000;
	// console.log(`Tried 80% quality --> ${check.length} bytes`);
	if (check.length <= targetBytes) return check;

	let lo = 50;
	let hi = 100;
	let triesRemaining = 4;

	// very fuzzy binary search for quality
	while (lo < hi && triesRemaining) {
		triesRemaining--;

		let mid = Math.floor((hi + lo) / 2);
		// we're doing webp because it (a) takes all formats and (b) is atleast as good as jpeg (so = good!)
		check = await sharp(image).webp({ quality: mid, alphaQuality: mid }).toBuffer();
		// console.log(`Tried ${mid}% quality --> ${check.length} bytes`);

		if (check.length >= targetBytes + marginOfError) hi = mid;
		else if (check.length < targetBytes - marginOfError) lo = mid + 1;
		else break;
	}

	let mid = Math.floor((hi + lo) / 2);
	return await sharp(image).webp({ quality: mid, alphaQuality: mid }).toBuffer();
}

export async function uploadBuffer(fileContent: Buffer, bucket: string, key: string, contentType: string) {
	if (!supabase) throw new Error("not happening");

	const { data, error } = await supabase.storage.from(bucket).upload(key, fileContent, { contentType, upsert: true });

	if (error) {
		console.error("Could not upload file: ", error);

		// @ts-ignore
		const status = error.status ?? error.statusCode ?? 500;
		if (String(status) === "409") {
			return { code: 409, message: "A file with that name already exists. (Key collision)" };
		}

		// @ts-ignore
		return { code: Number(status) || 500, message: `${error.name || "UploadError"}: ${error.message}` };
	}

	const pub = supabase.storage.from(bucket).getPublicUrl(data.path);
	return { code: 200, message: pub.data.publicUrl, path: data.path, sizeBytes: fileContent.length };
}

export async function uploadFile(file: formidable.File, bucket: string, options?: { skipCompression?: boolean }) {
	if (!supabase) throw new Error("not happening");

	let fileContent = await readFile(file.filepath);
	console.log("uploadering...");
	const originalName = file.originalFilename || "upload";
	const mimeType = (file.mimetype || "application/octet-stream").toLowerCase();

	// minimal mime → ext map (extend if you need more)
	const EXT_FROM_MIME: Record<string, string> = {
		"image/jpg": "jpg",
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
		"image/heic": "heic",
		"image/heif": "heif",
		"image/heic-sequence": "heic",
		"image/heif-sequence": "heif",
		"application/pdf": "pdf",
	};
	const MIME_FROM_EXT: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		heic: "image/heic",
		heif: "image/heif",
		pdf: "application/pdf",
	};

	// try mimetype first; fall back to original filename’s ext; finally "bin"
	const extFromMime = EXT_FROM_MIME[mimeType];
	const extFromName = path.extname(originalName).slice(1).toLowerCase();
	let ext = (extFromMime || extFromName || "bin").replace(/[^a-z0-9]/gi, "") || "bin";
	let finalMimeType = mimeType === "application/octet-stream" ? MIME_FROM_EXT[ext] || mimeType : mimeType;
	console.log(ext);
	if (!options?.skipCompression && ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext)) {
		try {
			fileContent = await compressImg(fileContent);
			ext = "webp";
			finalMimeType = "image/webp";
		} catch (error) {
			console.error("Could not compress image, uploading original file instead.", error);
		}
	}
	// sanitize base (strip ext, slugify, trim length)
	const base =
		path
			.basename(originalName, path.extname(originalName))
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/gi, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 60) || "upload";

	// folder by year/month + unique suffix prevents 409s
	const now = new Date();
	const key = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), `${base}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`].join(
		"/"
	);

	console.log("Uploading to:", bucket, key);
	return await uploadBuffer(fileContent as Buffer, bucket, key, finalMimeType);
}
