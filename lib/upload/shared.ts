/** @format */

import type { article } from "@prisma/client";

export type FormDataType = {
	category?: string | null;
	subcategory?: string | null;
	title?: string | null;
	authors?: string | null;
	content?: string | null;
	contentInfo?: string | null;
	multi?: string | null;
	img?: File | null;
	spread?: File | null;
	imgData?: string | null;
	imgName?: string | null;
	month?: number | null;
	year?: number | null;
	vanguardPageNumber?: number | null;
};

export type UploadListItem = Pick<article, "id" | "title" | "category" | "subcategory" | "published" | "month" | "year">;

export const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
export const MONTH_NAMES = [
	"",
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const VALID_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"];
const HEIC_EXTENSIONS = [".heic", ".heif"];

export function hasAllowedImageExtension(fileName: string) {
	const lowerName = fileName.toLowerCase();
	return VALID_IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function isHeicLike(fileName: string) {
	const lowerName = fileName.toLowerCase();
	return HEIC_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function normalizeVanguardSubcategory(subcategory?: string | null) {
	return subcategory === "random-musings" ? "articles" : subcategory;
}

export function formatBytes(bytes: number | null | undefined) {
	if (bytes === null || bytes === undefined) return "";

	const units = ["B", "KB", "MB", "GB"] as const;
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}

	return `${Math.round(value * 10) / 10} ${units[unitIndex]}`;
}
