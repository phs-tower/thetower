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
	const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	return `${days[date.getDay()]}, ${months[date.getMonth() + 1]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function shortenText(text: string, length: number) {
	if (length === 0) return "";

	const sentences = text.substring(0, length).split(" ");
	sentences.pop();
	return sentences.join(" ").replace(/[\n\r\t\s]+/g, " ") + "...";
}
