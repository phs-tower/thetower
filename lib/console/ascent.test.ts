/** @format */

// Tests for the Ascent console logic. Run with:
//   npm test
//
// The property that matters most: a Wikipedia fetch that fails leaves that
// answer's count alone. A 0 in its place would make it the rarest answer in
// the prompt, so a failure must never become a row sent to the server.

import test from "node:test";
import assert from "node:assert/strict";
import {
	addDays,
	byTier,
	chunk,
	defaultMonday,
	describeTry,
	dropPrior,
	familyCounts,
	fetchWikiCounts,
	formatFamilyCounts,
	formToWeights,
	groupBank,
	LADDER,
	lastRunByKey,
	lastUsedLabel,
	missingWiki,
	mondayOf,
	parseReview,
	parseTry,
	parseWikiHits,
	permissions,
	promptPhase,
	searchTerm,
	sortByPrior,
	tierIndex,
	weekGrid,
	weightsToForm,
	wikiBatches,
	wikiUrl,
	type AscentPrompt,
	type BankRow,
	type ReviewAnswer,
} from "./ascent.ts";

const prompt = (over: Partial<AscentPrompt>): AscentPrompt => ({
	id: 1,
	day: "2026-11-02",
	slot: 1,
	key: "club-any",
	family: "club",
	text: "Name a PHS club.",
	opens_at: "2026-11-02T12:00:00Z",
	closes_at: "2026-11-03T12:00:00Z",
	published: true,
	wiki_weight: 0.4,
	...over,
});

const answer = (over: Partial<ReviewAnswer>): ReviewAnswer => ({
	id: 1,
	canonical: "PHS Debate",
	aliases: [],
	term: null,
	tower_mentions: 3,
	wiki_hits: 100,
	archive_prior: 0.5,
	prior: 0.5,
	manual: false,
	...over,
});

// ─── Weeks ───

test("mondayOf finds the Monday, Sunday belonging to the week before", () => {
	assert.equal(mondayOf("2026-11-02"), "2026-11-02"); // Monday
	assert.equal(mondayOf("2026-11-06"), "2026-11-02"); // Friday
	assert.equal(mondayOf("2026-11-08"), "2026-11-02"); // Sunday
	assert.equal(mondayOf("2026-11-09"), "2026-11-09");
});

test("addDays crosses months and years", () => {
	assert.equal(addDays("2026-10-30", 3), "2026-11-02");
	assert.equal(addDays("2026-12-28", 7), "2027-01-04");
	assert.equal(addDays("2026-11-02", -7), "2026-10-26");
});

test("defaultMonday is this week on a weekday and next week at the weekend", () => {
	assert.equal(defaultMonday("2026-10-29"), "2026-10-26");
	assert.equal(defaultMonday("2026-10-31"), "2026-11-02");
	assert.equal(defaultMonday("2026-11-01"), "2026-11-02");
});

test("weekGrid lays out Monday to Friday with two slots", () => {
	const grid = weekGrid("2026-11-02", [
		prompt({ id: 1, day: "2026-11-02", slot: 2 }),
		prompt({ id: 2, day: "2026-11-04", slot: 1 }),
		prompt({ id: 3, day: "2026-11-07", slot: 1 }), // Saturday: not on the grid
		prompt({ id: 4, day: "2026-11-09", slot: 1 }), // next week
	]);
	assert.deepEqual(
		grid.map(d => d.day),
		["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]
	);
	assert.equal(grid[0].slots[0], null);
	assert.equal(grid[0].slots[1]?.id, 1);
	assert.equal(grid[2].slots[0]?.id, 2);
	assert.ok(grid.every(d => d.slots.length === 2));
	assert.ok(!grid.some(d => d.slots.some(s => s?.id === 3 || s?.id === 4)));
});

test("familyCounts counts the whole week, Monday to Sunday, and nothing else", () => {
	const counts = familyCounts("2026-11-02", [
		prompt({ day: "2026-11-02", family: "club" }),
		prompt({ day: "2026-11-03", family: "club" }),
		prompt({ day: "2026-11-03", family: "sport" }),
		prompt({ day: "2026-11-08", family: "archive" }), // Sunday, same week
		prompt({ day: "2026-11-09", family: "club" }), // next week
		prompt({ day: "2026-11-01", family: "sport" }), // last week
	]);
	assert.deepEqual(counts, { club: 2, sport: 1, archive: 1 });
	assert.equal(formatFamilyCounts(counts), "club 2/4 · sport 1/4 · archive 1/4");
});

// ─── Phases ───

test("promptPhase follows opens_at and closes_at", () => {
	const p = prompt({});
	assert.equal(promptPhase(prompt({ day: null, opens_at: null, closes_at: null }), new Date()), "bank");
	assert.equal(promptPhase(p, new Date("2026-11-02T11:59:59Z")), "upcoming");
	assert.equal(promptPhase(p, new Date("2026-11-02T12:00:00Z")), "open");
	assert.equal(promptPhase(p, new Date("2026-11-03T12:00:00Z")), "closed");
});

test("permissions hide what the server would refuse", () => {
	assert.deepEqual(permissions("upcoming"), {
		unschedule: true,
		removeAnswer: true,
		addAnswer: true,
		editAnswers: true,
		editWeights: true,
		addAlias: true,
	});
	const open = permissions("open");
	assert.equal(open.unschedule, false);
	assert.equal(open.removeAnswer, false);
	assert.equal(open.addAnswer, true);
	assert.equal(open.editWeights, true);
	const closed = permissions("closed");
	assert.equal(closed.addAnswer, false);
	assert.equal(closed.editAnswers, false);
	assert.equal(closed.editWeights, false);
	assert.equal(closed.addAlias, true, "aliases fix the bank for next time");
	const bank = permissions("bank");
	assert.equal(bank.removeAnswer, true);
	assert.equal(bank.unschedule, false);
});

// ─── Bank ───

const bankRow = (key: string, family: BankRow["family"], blocked: string | null = null): BankRow => ({
	key,
	family,
	text: key,
	last_ran: null,
	blocked,
});

test("groupBank groups by family in a fixed order and drops empty families", () => {
	const groups = groupBank([bankRow("t", "archive"), bankRow("c", "club"), bankRow("c2", "club")]);
	assert.deepEqual(
		groups.map(g => [g.family, g.rows.length]),
		[
			["club", 2],
			["archive", 1],
		]
	);
});

test("lastUsedLabel tags past, today, future and never", () => {
	assert.equal(lastUsedLabel(null, "2026-11-05"), "never used");
	assert.equal(lastUsedLabel("2026-11-02", "2026-11-05"), "last used Mon Nov 2 2026");
	assert.equal(lastUsedLabel("2026-11-05", "2026-11-05"), "running today");
	assert.equal(lastUsedLabel("2026-11-10", "2026-11-05"), "scheduled Tue Nov 10 2026");
});

test("lastRunByKey keeps each key's latest day and skips the bank", () => {
	const m = lastRunByKey([
		{ key: "a", day: "2026-10-01" },
		{ key: "a", day: "2026-11-03" },
		{ key: "a", day: "2026-09-01" },
		{ key: "b", day: null },
		{ key: null, day: "2026-11-01" },
	]);
	assert.deepEqual([...m], [["a", "2026-11-03"]]);
});

// ─── Weights ───

test("weights round-trip through the form as percentages", () => {
	const form = weightsToForm({ wiki_weight: 0.4 });
	assert.deepEqual(form, { wikiPct: "40" });
	assert.deepEqual(formToWeights(form), { ok: true, weights: { wiki_weight: 0.4 } });
	assert.deepEqual(formToWeights({ wikiPct: "12.5" }), { ok: true, weights: { wiki_weight: 0.125 } });
});

test("formToWeights refuses out-of-range input", () => {
	assert.equal(formToWeights({ wikiPct: "101" }).ok, false);
	assert.equal(formToWeights({ wikiPct: "" }).ok, false);
	assert.equal(formToWeights({ wikiPct: "-1" }).ok, false);
});

// ─── The ladder ───

test("the ladder covers 0 to 1 without gaps and tierIndex agrees with it", () => {
	assert.equal(LADDER[0].from, 0);
	assert.equal(LADDER[LADDER.length - 1].to, 1);
	for (let i = 1; i < LADDER.length; i++) assert.equal(LADDER[i].from, LADDER[i - 1].to);
	// ascent_score: rarity < 0.35 is 10, < 0.55 is 25 … else 100.
	assert.equal(LADDER[tierIndex(0)].score, 10);
	assert.equal(LADDER[tierIndex(0.3499)].score, 10);
	assert.equal(LADDER[tierIndex(0.35)].score, 25);
	assert.equal(LADDER[tierIndex(0.9)].score, 85);
	assert.equal(LADDER[tierIndex(0.9599)].score, 85);
	assert.equal(LADDER[tierIndex(0.96)].score, 100);
	assert.equal(LADDER[tierIndex(1)].score, 100);
});

test("byTier lists every tier, empty ones too", () => {
	const groups = byTier([answer({ id: 1, prior: 0.1 }), answer({ id: 2, prior: 0.97 }), answer({ id: 3, prior: null })]);
	assert.equal(groups.length, LADDER.length);
	assert.deepEqual(
		groups.map(g => g.answers.map(a => a.id)),
		[[1], [], [], [], [], [], [2]]
	);
});

test("dropPrior lands halfway between neighbours, inside the tier dropped into", () => {
	const others = [answer({ id: 1, prior: 0.1 }), answer({ id: 2, prior: 0.3 }), answer({ id: 3, prior: 0.6 }), answer({ id: 4, prior: 0.98 })];
	// Above 2: between 1 and 2.
	assert.equal(dropPrior(others, { kind: "answer", id: 2, after: false }), 0.2);
	// Above 1, the first: between the floor and 1.
	assert.equal(dropPrior(others, { kind: "answer", id: 1, after: false }), 0.05);
	// Below 2, the last Common: stays Common, between 2 and the 0.35 threshold.
	assert.equal(dropPrior(others, { kind: "answer", id: 2, after: true }), 0.325);
	// Above 3, the only Rare: between the 0.55 threshold and 3, not Uncommon.
	assert.equal(dropPrior(others, { kind: "answer", id: 3, after: false }), 0.575);
	// Below 4, at the top: between 4 and 1.
	assert.equal(dropPrior(others, { kind: "answer", id: 4, after: true }), 0.99);
	// On an empty tier's heading (Epic): its middle.
	assert.equal(dropPrior(others, { kind: "tier", index: 4 }), 0.86);
	// On a tier's heading with answers in it: above its first.
	assert.equal(dropPrior(others, { kind: "tier", index: 0 }), 0.05);
	assert.equal(dropPrior(others, { kind: "answer", id: 99, after: false }), null);
});

// ─── Word list ───

test("searchTerm falls back to the canonical name", () => {
	assert.equal(searchTerm(answer({ term: null })), "PHS Debate");
	assert.equal(searchTerm(answer({ term: "  " })), "PHS Debate");
	assert.equal(searchTerm(answer({ term: "debate" })), "debate");
});

test("sortByPrior puts the obvious answers first and unknown priors last", () => {
	const sorted = sortByPrior([
		answer({ id: 1, canonical: "B", prior: 0.9 }),
		answer({ id: 2, canonical: "A", prior: null }),
		answer({ id: 3, canonical: "C", prior: 0.1 }),
		answer({ id: 4, canonical: "D", prior: 0.1 }),
	]);
	assert.deepEqual(
		sorted.map(a => a.id),
		[3, 4, 1, 2]
	);
});

test("missingWiki counts answers never fetched", () => {
	assert.equal(missingWiki([answer({ wiki_hits: null }), answer({ wiki_hits: 0 }), answer({})]), 1);
});

test("parseReview and parseTry read the RPCs' jsonb", () => {
	assert.deepEqual(parseReview(null), { answers: [], unmatched: [] });
	assert.deepEqual(parseReview({ answers: [answer({})], unmatched: [{ raw: "Model UN", count: 20 }] }).unmatched, [{ raw: "Model UN", count: 20 }]);
	assert.equal(parseTry({}), null);
	assert.equal(parseTry(null), null);
	assert.deepEqual(parseTry({ answer_id: 7, canonical: "PHS Debate", how: "core" }), {
		answer_id: 7,
		canonical: "PHS Debate",
		how: "core",
	});
	assert.match(describeTry(null), /would not count/i);
	assert.match(describeTry({ answer_id: 7, canonical: "PHS Debate", how: "typo" }), /Did you mean PHS Debate/);
});

// ─── Wikipedia ───

test("wikiUrl quotes the term as a phrase", () => {
	const url = new URL(wikiUrl("field hockey"));
	assert.equal(url.hostname, "en.wikipedia.org");
	assert.equal(url.searchParams.get("srsearch"), '"field hockey"');
	assert.equal(url.searchParams.get("origin"), "*");
	assert.equal(url.searchParams.get("srinfo"), "totalhits");
	assert.equal(new URL(wikiUrl('say "hi"')).searchParams.get("srsearch"), '"say hi"');
});

test("parseWikiHits reads totalhits and nothing else", () => {
	assert.equal(parseWikiHits({ query: { searchinfo: { totalhits: 1234 } } }), 1234);
	assert.equal(parseWikiHits({ query: { searchinfo: { totalhits: 0 } } }), 0);
	assert.equal(parseWikiHits({ error: { code: "maxlag" } }), null);
	assert.equal(parseWikiHits({ query: { searchinfo: {} } }), null);
	assert.equal(parseWikiHits(null), null);
	assert.equal(parseWikiHits({ query: { searchinfo: { totalhits: "12" } } }), null);
});

test("fetchWikiCounts keeps failures out of the counts instead of sending 0", async () => {
	const answers = [
		answer({ id: 1, canonical: "Chess Club" }),
		answer({ id: 2, canonical: "Korean Culture Club" }),
		answer({ id: 3, canonical: "Boys Soccer", term: "soccer" }),
		answer({ id: 4, canonical: "Broken" }),
	];
	const asked: string[] = [];
	const progress: number[] = [];
	const result = await fetchWikiCounts(
		answers,
		async url => {
			const term = new URL(url).searchParams.get("srsearch")!;
			asked.push(term);
			if (term === '"Korean Culture Club"') throw new Error("network");
			if (term === '"Broken"') return { error: "nope" };
			return { query: { searchinfo: { totalhits: term.length } } };
		},
		done => progress.push(done),
		2
	);
	assert.deepEqual([...result.hits].sort(), [
		[1, '"Chess Club"'.length],
		[3, '"soccer"'.length],
	]);
	assert.deepEqual(
		result.failed.map(f => f.id),
		[4, 2]
	);
	assert.ok(asked.includes('"soccer"'), "the search term is used, not the canonical name");
	assert.deepEqual(progress, [1, 2, 3, 4]);

	const batches = wikiBatches(result.hits);
	assert.equal(batches.length, 1);
	assert.ok(!batches[0].some(r => r.id === 2 || r.id === 4), "failed answers are never sent");
});

test("fetchWikiCounts limits requests in flight", async () => {
	let inFlight = 0;
	let peak = 0;
	const answers = Array.from({ length: 20 }, (_, i) => answer({ id: i, canonical: `A${i}` }));
	await fetchWikiCounts(
		answers,
		async () => {
			peak = Math.max(peak, ++inFlight);
			await new Promise(r => setTimeout(r, 2));
			inFlight--;
			return { query: { searchinfo: { totalhits: 1 } } };
		},
		undefined,
		4
	);
	assert.equal(peak, 4);
});

test("counts go to the server 25 rows at a time", () => {
	assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
	assert.deepEqual(chunk([], 25), []);
	const hits = new Map(Array.from({ length: 151 }, (_, i) => [i, i * 10] as [number, number]));
	const batches = wikiBatches(hits);
	assert.equal(batches.length, 7);
	assert.ok(batches.every(b => b.length <= 25));
	assert.equal(batches.flat().length, 151);
	assert.deepEqual(batches[0][3], { id: 3, wiki_hits: 30 });
});
