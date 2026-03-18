/** @format */

import { article } from "@prisma/client";
import camelCase from "lodash/camelCase";
import startCase from "lodash/startCase";

import { months, categorySlugs } from "./constants";

export interface ArticleData {
	slug: string;
	articles: article[];
}

export function expandCategorySlug(slug: string) {
	const expanded = categorySlugs.get(slug);
	if (expanded) return expanded;
	return startCase(camelCase(slug));
}

export function displayDate(year: number, month: number): string;
export function displayDate(): string;
/** Outputs the given date (current if unspecified) in the form [month name], [year] */
export function displayDate(year?: number, month?: number): string {
	year = year ?? new Date().getFullYear();
	month = month ?? new Date().getMonth() + 1;
	return months[month] + ", " + year;
}

/** Display the given date in the form "[Weekday], [Month] [Day], [Year]" */
export function displayFullDate(date?: Date) {
	if (!date) date = new Date();
	// Always show date in Princeton :)
	return date.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function shortenText(text: string, length: number) {
	if (length === 0) return "";

	const sentences = text.substring(0, length).split(" ");
	sentences.pop();
	return sentences.join(" ").replace(/[\n\r\t\s]+/g, " ") + "...";
}

export function stripSpreadSourceHash(src: string) {
	return src.split("#")[0] ?? src;
}

export function parseSpreadSource(src: string) {
	const [pdfUrl, hash = ""] = src.split("#", 2);
	const params = new URLSearchParams(hash);
	const parsedPageCount = Number(params.get("pages") ?? "");
	const pageCount = Number.isInteger(parsedPageCount) && parsedPageCount > 0 ? parsedPageCount : 0;

	return {
		pdfUrl,
		pageCount,
	};
}

export function buildSpreadSource(pdfUrl: string, pageCount: number) {
	const cleanPdfUrl = stripSpreadSourceHash(pdfUrl);
	if (!pageCount || pageCount < 1) return cleanPdfUrl;
	return `${cleanPdfUrl}#pages=${pageCount}`;
}

export function getSpreadPageImageUrl(src: string, pageNumber: number) {
	if (!pageNumber || pageNumber < 1) return "";
	const { pdfUrl } = parseSpreadSource(src);
	return stripSpreadSourceHash(pdfUrl).replace(/\.pdf$/i, `-page-${pageNumber}.png`);
}

export function inferVanguardPageFromImageUrl(img: string | null | undefined) {
	if (!img) return null;
	const match = img.match(/-page-(\d+)\.(png|webp|jpg|jpeg)$/i);
	if (!match) return null;

	const parsed = Number(match[1]);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
