/** @format */

// Logic for the console's Ascent screens, kept apart from the React so it can
// be unit tested.
//
// THE SERVER OWNS THE GAME. Scheduling rules live in ascent_bank, matching in
// ascent_match (via ascent_try), scoring in ascent_prior and ascent_board.
// Nothing here decides whether a prompt may run or whether an answer counts:
// this file lays out what the RPCs return, fetches Wikipedia counts (the one
// input the server cannot get for itself), and works out where a dragged
// answer's prior goes. LADDER mirrors ascent_score so the word list can show
// which tier each answer lands in.
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

export const PROMPT_COLUMNS = "id, day, slot, key, family, text, opens_at, closes_at, published, wiki_weight, unlocked";

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
	/** For testing: a closed prompt an editor has unlocked to change. */
	unlocked: boolean;
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
	/** What the counts give: 0 most obvious, 1 rarest. */
	archive_prior: number | null;
	/** The score's rarity: the editor's placement if `manual`, else archive_prior. */
	prior: number | null;
	/** Whether an editor dragged it into place (ascent_set_prior). */
	manual: boolean;
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
 *  of these; the console only hides what would be refused. An `unlocked`
 *  prompt (for testing) allows every edit to its word list and weight, even
 *  after it has closed. */
export function permissions(phase: Phase, unlocked = false) {
	if (unlocked)
		return { unschedule: phase === "upcoming", removeAnswer: true, addAnswer: true, editAnswers: true, editWeights: true, addAlias: true };
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

export function groupBank(rows: BankRow[]): { family: Family; rows: BankRow[] }[] {
	return FAMILIES.map(family => ({ family, rows: rows.filter(r => r.family === family) })).filter(g => g.rows.length > 0);
}

/** The tag beside a bank prompt: when a copy of it last ran (or is
 *  scheduled to). Prompts may repeat; this is only so an editor notices. */
export function lastUsedLabel(lastRan: string | null, todayIso: string): string {
	if (!lastRan) return "never used";
	const when = `${dayLabel(lastRan)} ${lastRan.slice(0, 4)}`;
	return lastRan > todayIso ? `scheduled ${when}` : lastRan === todayIso ? "running today" : `last used ${when}`;
}

/** The latest day each key has been scheduled, from ascent_prompt rows. */
export function lastRunByKey(rows: { key: string | null; day: string | null }[]): Map<string, string> {
	const out = new Map<string, string>();
	for (const r of rows) if (r.key && r.day && (out.get(r.key) ?? "") < r.day) out.set(r.key, r.day);
	return out;
}

// ─── Weights ────────────────────────────────────────────────────────────────

export interface Weights {
	wiki_weight: number;
}

export interface WeightsForm {
	wikiPct: string;
}

const pctOf = (fraction: number) => String(Math.round(Number(fraction) * 1000) / 10);

export function weightsToForm(w: Weights): WeightsForm {
	return { wikiPct: pctOf(w.wiki_weight) };
}

/** The form as the RPC's arguments, or the reason it can't be. */
export function formToWeights(f: WeightsForm): { ok: true; weights: Weights } | { ok: false; error: string } {
	const wiki = Number(f.wikiPct.trim());
	if (f.wikiPct.trim() === "" || !Number.isFinite(wiki) || wiki < 0 || wiki > 100) return { ok: false, error: "Wikipedia share must be 0–100%." };
	return { ok: true, weights: { wiki_weight: Math.round(wiki * 10) / 1000 } };
}

export function formatWeights(w: Weights): string {
	return `wiki ${pctOf(w.wiki_weight)}%`;
}

// ─── The ladder ─────────────────────────────────────────────────────────────

export interface Tier {
	/** Rarity from which an answer reaches this tier, inclusive. */
	from: number;
	/** Rarity at which the next tier starts, exclusive (1 for the top). */
	to: number;
	score: number;
	tier: string;
	rarity: string;
}

/** Mirrors ascent_score() and ascent_tier() in the app repo's
 *  supabase/ascent.sql, and the rarity words of lib/models/ascent.dart.
 *  Ground to roof. Rarity is an answer's rank in its prompt, so these are
 *  shares of the list: the bottom 35% Common, the top 10% Legendary. */
export const LADDER: Tier[] = [
	{ from: 0, to: 0.35, score: 10, tier: "Front Steps", rarity: "Common" },
	{ from: 0.35, to: 0.55, score: 25, tier: "Lobby", rarity: "Uncommon" },
	{ from: 0.55, to: 0.7, score: 40, tier: "Newsroom", rarity: "Rare" },
	{ from: 0.7, to: 0.82, score: 55, tier: "The Archives", rarity: "Super Rare" },
	{ from: 0.82, to: 0.9, score: 70, tier: "Clock Face", rarity: "Epic" },
	{ from: 0.9, to: 1, score: 100, tier: "The Masthead", rarity: "Legendary" },
];

/** The colour each rarity word is shown in, as the app shows it. */
export const RARITY_COLORS: Record<string, string> = {
	Common: "#8A949C",
	Uncommon: "#2E9E6B",
	Rare: "#2F7FD1",
	"Super Rare": "#13A3B5",
	Epic: "#8E44D9",
	Legendary: "#E08A00",
};

/** The index into LADDER of the tier a rarity lands in. */
export function tierIndex(prior: number): number {
	for (let i = LADDER.length - 1; i > 0; i--) if (Number(prior) >= LADDER[i].from) return i;
	return 0;
}

/** Answers grouped under every tier of the ladder, empty tiers included so
 *  an answer can be dragged into one. `answers` must be sortByPrior'd;
 *  answers without a prior are left out. */
export function byTier(answers: ReviewAnswer[]): { tier: Tier; index: number; answers: ReviewAnswer[] }[] {
	return LADDER.map((tier, index) => ({
		tier,
		index,
		answers: answers.filter(a => a.prior !== null && a.prior !== undefined && tierIndex(a.prior) === index),
	}));
}

/** Where an answer was dropped: just above or below another answer, or at
 *  the top of a tier (on its heading). */
export type DropTarget = { kind: "answer"; id: number; after: boolean } | { kind: "tier"; index: number };

/** The priors a dragged group of `count` answers gets, in order: spread
 *  evenly between whatever they now sit between, never outside the tier they
 *  were dropped into. `others` are the prompt's other answers, sortByPrior'd.
 *  Null if the target is not there. */
export function dropPriors(others: ReviewAnswer[], target: DropTarget, count: number): number[] | null {
	const ranked = others.filter(a => a.prior !== null && a.prior !== undefined);
	let lo: number;
	let hi: number;
	if (target.kind === "tier") {
		const tier = LADDER[target.index];
		if (!tier) return null;
		const first = ranked.find(a => tierIndex(a.prior!) === target.index);
		lo = tier.from;
		hi = first ? Number(first.prior) : tier.to;
	} else {
		const at = ranked.findIndex(a => a.id === target.id);
		if (at < 0) return null;
		const p = Number(ranked[at].prior);
		const tier = LADDER[tierIndex(p)];
		const sameTier = (a: ReviewAnswer | undefined) => a !== undefined && tierIndex(a.prior!) === tierIndex(p);
		if (target.after) {
			const next = ranked[at + 1];
			lo = p;
			hi = sameTier(next) ? Number(next.prior) : tier.to;
		} else {
			const prev = ranked[at - 1];
			lo = sameTier(prev) ? Number(prev.prior) : tier.from;
			hi = p;
		}
	}
	return Array.from({ length: count }, (_, k) => round4(lo + ((hi - lo) * (k + 1)) / (count + 1)));
}

/** The prior one dragged answer gets: halfway between its new neighbours. */
export function dropPrior(others: ReviewAnswer[], target: DropTarget): number | null {
	return dropPriors(others, target, 1)?.[0] ?? null;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Where a drop lands in its tier: the tier, and how many of the tier's
 *  other answers sit above the dropped ones. */
function dropSlot(ranked: ReviewAnswer[], target: DropTarget): { index: number; pos: number } | null {
	if (target.kind === "tier") return LADDER[target.index] ? { index: target.index, pos: 0 } : null;
	const at = ranked.find(a => a.id === target.id);
	if (!at) return null;
	const index = tierIndex(at.prior!);
	const inTier = ranked.filter(a => tierIndex(a.prior!) === index);
	return { index, pos: inTier.indexOf(at) + (target.after ? 1 : 0) };
}

/** The new priors for a drop of `ids` (kept in their current order) at
 *  `target`, as answer id → prior. `answers` is the whole list,
 *  sortByPrior'd. Normally only the moved answers change, spread evenly
 *  between their new neighbours. When there is no room between them (they
 *  tie, as answers with the same counts do), the whole tier is re-spaced
 *  in its new order instead, or the moved rows would sort straight back to
 *  where they were. Null if the target is not there. */
export function placeAnswers(answers: ReviewAnswer[], ids: number[], target: DropTarget): Map<number, number> | null {
	const ranked = answers.filter(a => a.prior !== null && a.prior !== undefined);
	const movers = ranked.filter(a => ids.includes(a.id));
	const others = ranked.filter(a => !ids.includes(a.id));
	if (!movers.length) return null;
	const priors = dropPriors(others, target, movers.length);
	const slot = dropSlot(others, target);
	if (!priors || !slot) return null;

	const tier = LADDER[slot.index];
	const inTier = others.filter(a => tierIndex(a.prior!) === slot.index);
	const above = inTier[slot.pos - 1];
	const below = inTier[slot.pos];
	const fits = priors.every(
		(p, i) =>
			p >= tier.from &&
			p < tier.to &&
			(above === undefined || p > Number(above.prior)) &&
			(below === undefined || p < Number(below.prior)) &&
			(i === 0 || p > priors[i - 1])
	);
	if (fits) return new Map(movers.map((a, i) => [a.id, priors[i]]));

	const order = [...inTier.slice(0, slot.pos), ...movers, ...inTier.slice(slot.pos)];
	const out = new Map<number, number>();
	order.forEach((a, k) => {
		const p = round4(tier.from + ((tier.to - tier.from) * (k + 0.5)) / order.length);
		if (ids.includes(a.id) || p !== Number(a.prior)) out.set(a.id, p);
	});
	return out;
}

/** The ids from `anchor` to `id` inclusive, in `order`: a shift-click's
 *  range. Just `id` if the anchor isn't in the list. */
export function selectRange(order: number[], anchor: number | null, id: number): number[] {
	const a = anchor === null ? -1 : order.indexOf(anchor);
	const b = order.indexOf(id);
	if (a < 0 || b < 0) return [id];
	return order.slice(Math.min(a, b), Math.max(a, b) + 1);
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
