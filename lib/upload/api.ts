/** @format */

import type { article, spreads } from "@prisma/client";
import type { UploadListItem } from "~/lib/upload/shared";

async function parseJsonSafely<T = any>(response: Response): Promise<T> {
	try {
		return await response.json();
	} catch {
		return {} as T;
	}
}

export async function fetchIssueArticles(month: number, year: number) {
	const response = await fetch("/api/load/articles-by-issue", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ month, year }),
	});
	const data = await parseJsonSafely<UploadListItem[] | { message?: string }>(response);
	if (!response.ok) {
		const message = !Array.isArray(data) && data?.message ? data.message : "Could not load uploaded articles.";
		throw new Error(message);
	}
	return Array.isArray(data) ? data : [];
}

export async function fetchArticleForEditing(id: number) {
	const response = await fetch("/api/load/article-by-id", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id }),
	});
	const loaded = (await parseJsonSafely<article & { message?: string }>(response)) as article & { message?: string };
	if (!response.ok) throw new Error(loaded?.message || "Could not load this article.");
	return loaded;
}

export async function fetchIssueVanguardSpread(month: number, year: number) {
	const response = await fetch("/api/load/spread-by-issue", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ category: "vanguard", month, year }),
	});
	const data = await parseJsonSafely<spreads | null | { message?: string }>(response);
	if (!response.ok) {
		const message = data && typeof data === "object" && "message" in data ? data.message : "Could not load the Vanguard spread for this issue.";
		throw new Error(message);
	}
	return data && typeof data === "object" && "id" in data ? data : null;
}

export async function deleteUploadDraft(id: number) {
	const response = await fetch("/api/upload/delete-draft", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id }),
	});
	const data = await parseJsonSafely<{ message?: string }>(response);
	if (!response.ok) throw new Error(data?.message || "Failed to delete draft.");
	return data?.message || "Draft deleted.";
}

export async function attemptUpload(fd: FormData, retries = 1): Promise<{ response: Response; data: any }> {
	try {
		const response = await fetch("/api/upload", { method: "POST", body: fd });
		const contentType = response.headers.get("content-type") || "";

		let data;
		if (contentType.includes("application/json")) {
			data = await parseJsonSafely(response);
		} else {
			const text = await response.text();

			if (text.toLowerCase().includes("entity too large")) {
				throw new Error("Image is too large to upload. Try compressing or using a smaller image.");
			}

			console.error("Unexpected text response:", text);
			throw new Error(text);
		}

		if (!response.ok) {
			if (retries > 0) return await attemptUpload(fd, retries - 1);
			return { response, data };
		}

		return { response, data };
	} catch (error: any) {
		if (retries > 0) return await attemptUpload(fd, retries - 1);
		throw error;
	}
}

async function uploadFileDirectToStorage(file: File, endpoint: string, defaultErrorMessage: string) {
	const prepareResponse = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ filename: file.name }),
	});

	const prepareData = await parseJsonSafely<{ signedUrl?: string; path?: string; publicUrl?: string; message?: string }>(prepareResponse);
	if (!prepareResponse.ok) {
		throw new Error(prepareData?.message || defaultErrorMessage);
	}

	const body = new FormData();
	body.append("cacheControl", "3600");
	body.append("", file);

	const signedUploadResponse = await fetch(String(prepareData.signedUrl || ""), {
		method: "PUT",
		headers: {
			"x-upsert": "true",
		},
		body,
	});

	if (!signedUploadResponse.ok) {
		const errorText = await signedUploadResponse.text().catch(() => "");
		throw new Error(errorText || defaultErrorMessage);
	}

	return {
		path: String(prepareData.path || ""),
		publicUrl: String(prepareData.publicUrl || ""),
		sizeBytes: file.size,
	};
}

export async function uploadVanguardSpreadPdfDirect(file: File) {
	return await uploadFileDirectToStorage(file, "/api/upload/spread-signed-url", "Could not upload the Vanguard PDF to storage.");
}

export async function uploadArticleImageDirect(file: File) {
	return await uploadFileDirectToStorage(file, "/api/upload/image-signed-url", "Could not upload the article image to storage.");
}
