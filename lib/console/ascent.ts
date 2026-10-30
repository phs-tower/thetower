/** @format */

// Logic for the console's Ascent screens, kept apart from the React so it can
// be unit tested.
//
// THE SERVER OWNS THE GAME. Scheduling rules live in ascent_bank, matching in
// ascent_match (via ascent_try), scoring in ascent_archive_prior and
// ascent_board. Nothing here decides whether a prompt may run, whether an
// answer counts or how rare it is: this file lays out what the RPCs return and
// fetches Wikipedia counts, the one input the server cannot get for itself.
// See the app repo's ASCENT.md and supabase/ascent.sql.
//
// Dates are ISO days ('2026-11-02'), the same as ascent_prompt.day. Date
// arithmetic is done at UTC noon so no time zone can move a day.

export type Family = "club" | "sport" | "archive";
export const FAMILIES: Family[] = ["club", "sport", "archive"];

/** At most this many prompts of one family a week (ascent_bank's rule, shown
 *  here only so the counts above the grid read "3/4"). */
export const FAMILY_WEEK_CAP = 4;

/** ascent_set_answers recounts the archive per row, which is slow. */
export const SET_ANSWERS_BATCH = 25;

/** How many Wikipedia requests are in flight at once. */
export const WIKI_CONCURRENCY = 4;

export const PROMPT_COLUMNS = "id, day, slot, key, family, text, opens_at, closes_at, published, wiki_weight, prior_weight, turnout";

export interface AscentPrompt {
	id: number;
	day: string | null;
	slot: number | null;
	key: string | null;
	family: Family | null;
	text: string;
	opens_at: string | null;
	closes_at: string | null;
	published: boolean;
	wiki_weight: number;
	prior_weight: number;
	turnout: number;
}

export interface BankRow {
	key: string;
	family: Family;
	text: string;
	last_ran: string | null;
	blocked: string | null;
}

export interface ReviewAnswer {
	id: number;
	canonical: string;
	aliases: string[] | null;
	term: string | null;
	tower_mentions: number | null;
	wiki_hits: number | null;
	prior: number | null;
}

export interface Unmatched {
	raw: string;
	count: number;
}

export interface Review {
	answers: ReviewAnswer[];
	unmatched: Unmatched[];
}

export type MatchHow = "exact" | "alias" | "core" | "typo";

export interface TryResult {
	answer_id: number;
	canonical: string;
	how: MatchHow;
}

// ─── Days and weeks ─────────────────────────────────────────────────────────

function parseDay(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d, 12));
}

function formatDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
	const d = parseDay(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return formatDay(d);
}

/** The Monday of the week holding `iso` (Postgres date_trunc('week') too). */
export function mondayOf(iso: string): string {
	const dow = parseDay(iso).getUTCDay(); // 0 Sunday … 6 Saturday
	return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** The week an editor most likely wants: this one, or next on a weekend. */
export function defaultMonday(todayIso: string): string {
	const dow = parseDay(todayIso).getUTCDay();
	return dow === 0 || dow === 6 ? addDays(mondayOf(todayIso), 7) : mondayOf(todayIso);
}

/** Today in the browser's own calendar, as an ISO day. */
export function localToday(now: Date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function dayLabel(iso: string): string {
	const d = parseDay(iso);
	const name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
	const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
	return `${name} ${month} ${d.getUTCDate()}`;
}

export interface GridDay {
	day: string;
	slots: [AscentPrompt | null, AscentPrompt | null];
}

/** Monday to Friday, two slots each. Prompts outside the week are ignored. */
export function weekGrid(monday: string, prompts: AscentPrompt[]): GridDay[] {
	return [0, 1, 2, 3, 4].map(i => {
		const day = addDays(monday, i);
		const slots: [AscentPrompt | null, AscentPrompt | null] = [null, null];
		for (const p of prompts) if (p.day === day && (p.slot === 1 || p.slot === 2)) slots[p.slot - 1] = p;
		return { day, slots };
	});
}

/** Prompts per family in the week starting `monday` (Monday to Sunday, as
 *  ascent_bank counts). */
export function familyCounts(monday: string, prompts: AscentPrompt[]): Record<Family, number> {
	const counts: Record<Family, number> = { club: 0, sport: 0, archive: 0 };
	const end = addDays(monday, 6);
	for (const p of prompts) {
		if (!p.day || p.day < monday || p.day > end || !p.family) continue;
		if (p.family in counts) counts[p.family]++;
	}
	return counts;
}

/** "club 3/4 · sport 4/4 · archive 1/4" */
export function formatFamilyCounts(counts: Record<Family, number>): string {
	return FAMILIES.map(f => `${f} ${counts[f]}/${FAMILY_WEEK_CAP}`).join(" · ");
}

// ─── A prompt's state ───────────────────────────────────────────────────────

export type Phase = "bank" | "upcoming" | "open" | "closed";

export function promptPhase(p: Pick<AscentPrompt, "day" | "opens_at" | "closes_at">, now: Date): Phase {
	if (p.day === null) return "bank";
	const t = now.getTime();
	if (p.opens_at && t < Date.parse(p.opens_at)) return "upcoming";
	if (p.closes_at && t < Date.parse(p.closes_at)) return "open";
	return "closed";
}

/** What an editor may do to a prompt in each phase. The server enforces all
 *  of these; the console only hides what would be refused. */
export function permissions(phase: Phase) {
	return {
		unschedule: phase === "upcoming",
		removeAnswer: phase === "bank" || phase === "upcoming",
		addAnswer: phase !== "closed",
		editAnswers: phase !== "closed", // search terms and Wikipedia counts
		editWeights: phase !== "closed",
		addAlias: true,
	};
}

// ─── The bank ───────────────────────────────────────────────────────────────

export const COOLDOWN_REASON = "ran within six months";

export function groupBank(rows: BankRow[]): { family: Family; rows: BankRow[] }[] {
	return FAMILIES.map(family => ({ family, rows: rows.filter(r => r.family === family) })).filter(g => g.rows.length > 0);
}

/** Whether the cooldown has blocked most of the bank: three quarters or
 *  more, or fewer than five prompts left that it hasn't. */
export function bankRunningLow(rows: BankRow[]): boolean {
	if (rows.length === 0) return false;
	const cooled = rows.filter(r => r.blocked === COOLDOWN_REASON).length;
	return cooled / rows.length >= 0.75 || rows.length - cooled < 5;
}

// ─── Weights ────────────────────────────────────────────────────────────────

export interface Weights {
	wiki_weight: number;
	prior_weight: number;
	turnout: number;
}

export interface WeightsForm {
	wikiPct: string;
	priorPct: string;
	turnout: string;
}

const pctOf = (fraction: number) => String(Math.round(Number(fraction) * 1000) / 10);

export function weightsToForm(w: Weights): WeightsForm {
	return { wikiPct: pctOf(w.wiki_weight), priorPct: pctOf(w.prior_weight), turnout: String(w.turnout) };
}

/** The form as the RPC's arguments, or the reason it can't be. */
export function formToWeights(f: WeightsForm): { ok: true; weights: Weights } | { ok: false; error: string } {
	const wiki = Number(f.wikiPct.trim());
	const prior = Number(f.priorPct.trim());
	const turnout = Number(f.turnout.trim());
	if (f.wikiPct.trim() === "" || !Number.isFinite(wiki) || wiki < 0 || wiki > 100) return { ok: false, error: "Wikipedia share must be 0–100%." };
	if (f.priorPct.trim() === "" || !Number.isFinite(prior) || prior < 0 || prior > 100) return { ok: false, error: "Prior share must be 0–100%." };
	if (!Number.isInteger(turnout) || turnout < 1) return { ok: false, error: "Turnout must be a whole number, 1 or more." };
	return {
		ok: true,
		weights: { wiki_weight: Math.round(wiki * 10) / 1000, prior_weight: Math.round(prior * 10) / 1000, turnout },
	};
}

export function formatWeights(w: Weights): string {
	return `wiki ${pctOf(w.wiki_weight)}% · prior ${pctOf(w.prior_weight)}% · turnout ${w.turnout}`;
}

// ─── The word list ──────────────────────────────────────────────────────────

/** What The Tower and Wikipedia are searched for. */
export function searchTerm(a: Pick<ReviewAnswer, "term" | "canonical">): string {
	return a.term?.trim() || a.canonical;
}

/** Most obvious (lowest prior) first; answers without a prior last. */
export function sortByPrior(answers: ReviewAnswer[]): ReviewAnswer[] {
	return [...answers].sort((a, b) => {
		if (a.prior === null && b.prior === null) return a.canonical.localeCompare(b.canonical);
		if (a.prior === null) return 1;
		if (b.prior === null) return -1;
		return Number(a.prior) - Number(b.prior) || a.canonical.localeCompare(b.canonical);
	});
}

export function missingWiki(answers: ReviewAnswer[]): number {
	return answers.filter(a => a.wiki_hits === null || a.wiki_hits === undefined).length;
}

/** Reads ascent_review's jsonb, tolerating absent lists. */
export function parseReview(data: unknown): Review {
	const d = (data ?? {}) as Partial<Review>;
	return { answers: Array.isArray(d.answers) ? d.answers : [], unmatched: Array.isArray(d.unmatched) ? d.unmatched : [] };
}

/** Reads ascent_try's jsonb: a match, or null for `{}`. */
export function parseTry(data: unknown): TryResult | null {
	const d = data as Partial<TryResult> | null;
	if (!d || typeof d !== "object" || d.answer_id == null || !d.how) return null;
	return { answer_id: Number(d.answer_id), canonical: String(d.canonical ?? ""), how: d.how };
}

export function describeTry(r: TryResult | null): string {
	if (!r) return "Would not count: it lands on the unmatched list.";
	switch (r.how) {
		case "exact":
			return `Counts as ${r.canonical} (exact name).`;
		case "alias":
			return `Counts as ${r.canonical} (alias).`;
		case "core":
			return `Asks “Did you mean ${r.canonical}?” (same core); counts if they say yes.`;
		case "typo":
			return `Asks “Did you mean ${r.canonical}?” (typo or sound-alike); counts if they say yes.`;
	}
}

// ─── Wikipedia ──────────────────────────────────────────────────────────────

/** Only answer search terms go here, never anything a reader typed. */
export function wikiUrl(term: string): string {
	const q = `"${term.replace(/"/g, "").trim()}"`;
	return (
		"https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srinfo=totalhits&srsearch=" +
		encodeURIComponent(q)
	);
}

/** query.searchinfo.totalhits, or null if the response isn't one. */
export function parseWikiHits(json: unknown): number | null {
	const hits = (json as { query?: { searchinfo?: { totalhits?: unknown } } } | null)?.query?.searchinfo?.totalhits;
	return typeof hits === "number" && Number.isInteger(hits) && hits >= 0 ? hits : null;
}

export type JsonFetcher = (url: string) => Promise<unknown>;

export const browserFetcher: JsonFetcher = async url => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
};

export interface WikiResult {
	/** answer id → count, for the answers that were fetched. */
	hits: Map<number, number>;
	/** answers that weren't: their wiki_hits must stay as they are. */
	failed: { id: number; canonical: string }[];
}

/** Fetches each answer's count, a few at a time. A failure is reported, never
 *  turned into a 0: a 0 would make that answer the rarest in the prompt. */
export async function fetchWikiCounts(
	answers: Pick<ReviewAnswer, "id" | "canonical" | "term">[],
	fetcher: JsonFetcher = browserFetcher,
	onProgress?: (done: number, total: number) => void,
	concurrency = WIKI_CONCURRENCY
): Promise<WikiResult> {
	const hits = new Map<number, number>();
	const failed: WikiResult["failed"] = [];
	let next = 0;
	let done = 0;
	const worker = async () => {
		while (next < answers.length) {
			const a = answers[next++];
			let n: number | null = null;
			try {
				n = parseWikiHits(await fetcher(wikiUrl(searchTerm(a))));
			} catch {
				n = null;
			}
			if (n === null) failed.push({ id: a.id, canonical: a.canonical });
			else hits.set(a.id, n);
			onProgress?.(++done, answers.length);
		}
	};
	await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, answers.length)) }, worker));
	failed.sort((a, b) => a.canonical.localeCompare(b.canonical));
	return { hits, failed };
}

export function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

/** ascent_set_answers payloads, 25 rows a call, carrying only the counts that
 *  were fetched. */
export function wikiBatches(hits: Map<number, number>, size = SET_ANSWERS_BATCH): { id: number; wiki_hits: number }[][] {
	return chunk(
		[...hits].map(([id, wiki_hits]) => ({ id, wiki_hits })),
		size
	);
}

export function formatPrior(prior: number | null): string {
	return prior === null || prior === undefined ? "—" : Number(prior).toFixed(2);
}
