/** @format */

import type { article } from "@prisma/client";
import type { PreviewArticle } from "~/components/preview.client";

export type SearchIndexArticle = {
	id: number;
	title: string;
	category: string;
	subcategory: string;
	authors: string[];
	month: number;
	year: number;
	img: string;
	contentInfo: string | null;
	searchType?: "article" | "crossword";
	crosswordId?: number;
};

export type SearchResultItem = PreviewArticle;

export type SearchSuggestion =
	| {
			type: "article";
			id: number;
			title: string;
			year: number;
			month: number;
			category: string;
			slug: string;
	  }
	| {
			type: "crossword";
			id: number;
			title: string;
	  }
	| {
			type: "author" | "photo";
			name: string;
	  };

const PHOTO_KEYWORDS = ["photo", "image", "graphic"];

export function normalizeSearchText(text: string | null | undefined) {
	return `${text || ""}`
		.replace(/<[^>]*>/g, " ")
		.replace(/[\r\n\t]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

export function buildSearchIndexArticle(article: SearchIndexArticle): SearchIndexArticle {
	return {
		id: article.id,
		title: article.title,
		category: article.category,
		subcategory: article.subcategory,
		authors: article.authors,
		month: article.month,
		year: article.year,
		img: article.img,
		contentInfo: article.contentInfo,
		searchType: article.searchType,
		crosswordId: article.crosswordId,
	};
}

function extractPhotoNames(contentInfo: string | null, query: string) {
	if (!contentInfo) return [];

	return contentInfo
		.split(/\r?\n/)
		.filter(line => {
			const lower = line.toLowerCase();
			return lower.includes(query) && PHOTO_KEYWORDS.some(keyword => lower.includes(keyword)) && line.includes(":");
		})
		.map(line => line.split(":")[1]?.trim())
		.filter((name): name is string => Boolean(name));
}

export function buildSearchSuggestions(index: SearchIndexArticle[], query: string) {
	const normalized = normalizeSearchText(query);
	if (normalized.length < 2) return [];

	const authors = new Set<string>();
	const photographers = new Set<string>();
	const articleSuggestions: SearchSuggestion[] = [];

	for (const item of index) {
		for (const author of item.authors) {
			if (normalizeSearchText(author).includes(normalized)) authors.add(author);
		}

		for (const name of extractPhotoNames(item.contentInfo, normalized)) {
			photographers.add(name);
		}

		const matches =
			normalizeSearchText(item.title).includes(normalized) ||
			item.authors.some(author => normalizeSearchText(author).includes(normalized)) ||
			normalizeSearchText(item.contentInfo).includes(normalized);
		if (matches) {
			if (item.searchType === "crossword" && item.crosswordId) {
				articleSuggestions.push({
					type: "crossword",
					id: item.crosswordId,
					title: item.title,
				});
			} else {
				articleSuggestions.push({
					type: "article",
					id: item.id,
					title: item.title,
					year: item.year,
					month: item.month,
					category: item.category,
					slug: item.title.replace(/\s+/g, "-"),
				});
			}
		}
	}

	return [
		...Array.from(authors).map(name => ({ type: "author", name } as SearchSuggestion)),
		...Array.from(photographers).map(name => ({ type: "photo", name } as SearchSuggestion)),
		...articleSuggestions,
	].slice(0, 6);
}

export function getLatestIssueArticles(index: SearchIndexArticle[]) {
	const articleItems = index.filter(item => item.searchType !== "crossword");
	if (!articleItems.length) return [];

	const latest = articleItems.reduce(
		(acc, article) => {
			if (article.year > acc.year || (article.year === acc.year && article.month > acc.month)) {
				return { year: article.year, month: article.month };
			}
			return acc;
		},
		{ year: articleItems[0].year, month: articleItems[0].month }
	);

	return articleItems.filter(article => article.year === latest.year && article.month === latest.month);
}

export function toSearchResultArticle(item: SearchIndexArticle): article {
	return {
		id: item.id,
		title: item.title,
		content: "",
		published: true,
		category: item.category,
		subcategory: item.subcategory,
		authors: item.authors,
		month: item.month,
		year: item.year,
		img: item.img,
		featured: false,
		markdown: false,
		contentInfo: item.contentInfo,
		spotifyUrl: null,
		Index: false,
	};
}

export function toCrosswordResultItem(item: { id: number; title: string; author: string; date: string | Date }): SearchResultItem {
	const date = item.date instanceof Date ? item.date : new Date(item.date);

	return {
		id: item.id,
		title: item.title,
		content: "",
		published: true,
		category: "crossword",
		subcategory: "",
		authors: [item.author],
		month: date.getMonth() + 1,
		year: date.getFullYear(),
		img: "/assets/crossword.png",
		featured: false,
		markdown: false,
		contentInfo: null,
		spotifyUrl: null,
		Index: false,
		href: `/games/crossword/${item.id}`,
	};
}
