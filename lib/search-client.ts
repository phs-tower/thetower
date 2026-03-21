/** @format */

import { SearchIndexArticle } from "./search";

const SEARCH_INDEX_CACHE_KEY = "tower:search-index:v2";
const SEARCH_INDEX_TTL_MS = 5 * 60 * 1000;

let memoryCache: SearchIndexArticle[] | null = null;
let inflightRequest: Promise<SearchIndexArticle[]> | null = null;

type SearchIndexCachePayload = {
	expiry: number;
	data: SearchIndexArticle[];
};

function readCachedSearchIndex() {
	if (typeof window === "undefined") return null;
	if (memoryCache) return { data: memoryCache, isFresh: true };

	try {
		const raw = localStorage.getItem(SEARCH_INDEX_CACHE_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as SearchIndexCachePayload;
		if (!parsed?.expiry || !Array.isArray(parsed.data)) return null;

		memoryCache = parsed.data;
		return { data: parsed.data, isFresh: parsed.expiry > Date.now() };
	} catch {
		return null;
	}
}

function writeCachedSearchIndex(data: SearchIndexArticle[]) {
	memoryCache = data;
	if (typeof window === "undefined") return;

	try {
		const payload: SearchIndexCachePayload = {
			expiry: Date.now() + SEARCH_INDEX_TTL_MS,
			data,
		};
		localStorage.setItem(SEARCH_INDEX_CACHE_KEY, JSON.stringify(payload));
	} catch {
		// storage quota is non-critical; memory cache is enough for this session
	}
}

export async function loadSearchIndex() {
	const cached = readCachedSearchIndex();
	if (cached?.isFresh) return cached.data;
	if (cached?.data) {
		void refreshSearchIndex();
		return cached.data;
	}

	return refreshSearchIndex();
}

async function refreshSearchIndex() {
	if (inflightRequest) return inflightRequest;

	inflightRequest = fetch("/api/search/suggestions?mode=index")
		.then(async res => {
			if (!res.ok) throw new Error(`Search index request failed: ${res.status}`);
			return (await res.json()) as SearchIndexArticle[];
		})
		.then(data => {
			writeCachedSearchIndex(data);
			return data;
		})
		.finally(() => {
			inflightRequest = null;
		});

	return inflightRequest;
}

export function warmSearchIndex() {
	if (typeof window === "undefined") return;
	const cached = readCachedSearchIndex();
	if (cached?.isFresh) return;
	void loadSearchIndex().catch(() => {});
}
