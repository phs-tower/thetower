/** @format */

// Tests for the Gamecast logic. Run with:
//   npm test
//
// The property that matters most: computeStats is the ONLY football
// arithmetic between a play being posted and a reader's phone. The app prints
// what it is given, so a wrong number here is a wrong number in the app, and
// a shape the app does not expect is a blank table. Both are checked below.

import test from "node:test";
import assert from "node:assert/strict";
import {
	computeStats,
	describePlay,
	formatBallOn,
	formatDownDistance,
	normalizeClock,
	opponentAbbrev,
	parseBallOn,
	parseDownDistance,
	parseRosterLines,
	playKind,
	playPoints,
	recentNumbers,
	scoreLines,
	situationColumns,
	situationFromColumns,
	suggestNext,
	EMPTY_SITUATION,
	type PlayData,
	type PlayRow,
	type RosterEntry,
	type Side,
	type Situation,
	type StatTable,
	type TeamStat,
} from "./gamecast.ts";

const ROSTER: RosterEntry[] = [
	{ team: "phs", number: 12, name: "J. Smith", position: "QB" },
	{ team: "phs", number: 22, name: "M. Ortiz", position: "RB" },
	{ team: "phs", number: 4, name: "A. Lee", position: "WR" },
	{ team: "phs", number: 81, name: "T. Park", position: "TE" },
	{ team: "phs", number: 15, name: "R. Hall", position: "K" },
	{ team: "phs", number: 90, name: "B. Cole", position: "DL" },
	{ team: "phs", number: 21, name: "C. Day", position: "CB" },
	{ team: "opponent", number: 7, name: "D. West", position: "QB" },
	{ team: "opponent", number: 54, name: "K. Doe", position: "LB" },
];

let nextId = 1;
function play(team: Side | null, data: Omit<PlayData, "v">, period = "Q1", clock = ""): Pick<PlayRow, "id" | "team" | "period" | "clock" | "data"> {
	return { id: nextId++, team, period, clock, data: { v: 1, ...data } };
}

const stat = (stats: TeamStat[], label: string) => {
	const s = stats.find(x => x.label === label);
	assert.ok(s, `team stat ${label} exists`);
	return [s.phs, s.opponent];
};

const table = (tables: StatTable[], title: string) => {
	const t = tables.find(x => x.title === title);
	assert.ok(t, `table ${title} exists`);
	return t;
};

const row = (tables: StatTable[], title: string, team: Side, number: number) =>
	table(tables, title).rows.find(r => r.team === team && r.number === number);

/** The contract the app parses, checked on every computed result. */
function assertContract(result: ReturnType<typeof computeStats>) {
	for (const s of result.team_stats) {
		assert.equal(typeof s.label, "string");
		assert.equal(typeof s.phs, "string");
		assert.equal(typeof s.opponent, "string");
	}
	assert.deepEqual(
		result.player_stats.map(t => t.title),
		["Passing", "Rushing", "Receiving", "Defense", "Kicking"]
	);
	for (const t of result.player_stats) {
		assert.ok(t.columns.length <= 5, `${t.title}: at most five columns fit beside a name`);
		let seenOpponent = false;
		for (const r of t.rows) {
			assert.ok(r.team === "phs" || r.team === "opponent");
			assert.ok(Number.isInteger(r.number));
			assert.equal(typeof r.name, "string");
			assert.equal(r.values.length, t.columns.length, `${t.title}: one value per column`);
			for (const v of r.values) assert.equal(typeof v, "string");
			// The app lists PHS first; keep the order honest anyway.
			if (r.team === "opponent") seenOpponent = true;
			else assert.ok(!seenOpponent, `${t.title}: PHS rows come first`);
		}
	}
	// Exactly the JSON that will be written: nothing that does not survive it.
	assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
}

// ─── An empty game ──────────────────────────────────────────────────────────

test("an empty game: zeros, no possession line, five empty tables", () => {
	const result = computeStats([], ROSTER);
	assertContract(result);
	assert.deepEqual(result.team_stats, [
		{ label: "Total yards", phs: "0", opponent: "0" },
		{ label: "Passing yards", phs: "0", opponent: "0" },
		{ label: "Rushing yards", phs: "0", opponent: "0" },
		{ label: "First downs", phs: "0", opponent: "0" },
		{ label: "Third down", phs: "0/0", opponent: "0/0" },
		{ label: "Fourth down", phs: "0/0", opponent: "0/0" },
		{ label: "Turnovers", phs: "0", opponent: "0" },
		{ label: "Penalties-yards", phs: "0-0", opponent: "0-0" },
	]);
	for (const t of result.player_stats) assert.deepEqual(t.rows, []);
});

test("plays with no usable data are shown in the feed but never break stats", () => {
	const result = computeStats(
		[
			{ id: 1, team: "phs", period: "Q1", clock: "", data: {} },
			{ id: 2, team: null, period: "Q1", clock: "", data: null },
			{ id: 3, team: "phs", period: "Q1", clock: "", data: { v: 1, type: "warp drive" } },
		],
		ROSTER
	);
	assertContract(result);
	assert.deepEqual(stat(result.team_stats, "Total yards"), ["0", "0"]);
});

// ─── A touchdown drive ──────────────────────────────────────────────────────

function touchdownDrive() {
	return [
		play("opponent", { type: "kickoff", kicker: 9, yards: 45, returner: 3, return_yards: 20, tackler: 40 }),
		play("phs", { type: "rush", carrier: 22, yards: 7, tackler: 54, down: 1, distance: 10, spot: 35 }),
		play("phs", { type: "pass", passer: 12, receiver: 4, complete: true, yards: 23, first_down: true, down: 2, distance: 3, spot: 42 }),
		play("phs", { type: "rush", carrier: 22, yards: 2, down: 1, distance: 10, spot: 65 }),
		play("phs", { type: "pass", passer: 12, receiver: 4, complete: false, down: 2, distance: 8, spot: 67 }),
		play("phs", { type: "pass", passer: 12, receiver: 81, complete: true, yards: 12, first_down: true, down: 3, distance: 8, spot: 67 }),
		play("phs", { type: "rush", carrier: 22, yards: 21, touchdown: true, down: 1, distance: 10, spot: 79 }),
		play("phs", { type: "extra_point", kicker: 15, good: true }),
	];
}

test("a touchdown drive: team totals", () => {
	const result = computeStats(touchdownDrive(), ROSTER);
	assertContract(result);
	const ts = result.team_stats;
	assert.deepEqual(stat(ts, "Passing yards"), ["35", "0"]);
	assert.deepEqual(stat(ts, "Rushing yards"), ["30", "0"]);
	assert.deepEqual(stat(ts, "Total yards"), ["65", "0"]);
	assert.deepEqual(stat(ts, "First downs"), ["2", "0"]);
	assert.deepEqual(stat(ts, "Third down"), ["1/1", "0/0"]);
	assert.deepEqual(stat(ts, "Turnovers"), ["0", "0"]);
});

test("a touchdown drive: player lines, names from the roster", () => {
	const ps = computeStats(touchdownDrive(), ROSTER).player_stats;
	assert.deepEqual(row(ps, "Passing", "phs", 12), { team: "phs", number: 12, name: "J. Smith", values: ["2/3", "35", "0", "0"] });
	assert.deepEqual(row(ps, "Rushing", "phs", 22)?.values, ["3", "30", "1", "21"]);
	assert.deepEqual(row(ps, "Receiving", "phs", 4)?.values, ["1", "23", "0", "23"]);
	assert.deepEqual(row(ps, "Receiving", "phs", 81)?.values, ["1", "12", "0", "12"]);
	assert.deepEqual(row(ps, "Kicking", "phs", 15)?.values, ["0/0", "1/1", "0"]);
	// A tackle on the run belongs to the defense; the kickoff coverage tackle
	// belongs to the kicking team.
	assert.deepEqual(row(ps, "Defense", "opponent", 54), { team: "opponent", number: 54, name: "K. Doe", values: ["1", "0", "0"] });
	assert.deepEqual(row(ps, "Defense", "opponent", 40)?.values, ["1", "0", "0"]);
	// Not on the roster: the number alone, and the app prints "#40".
	assert.equal(row(ps, "Defense", "opponent", 40)?.name, "");
	// Leader first.
	assert.deepEqual(
		table(ps, "Receiving").rows.map(r => r.number),
		[4, 81]
	);
});

test("a touchdown drive: the score", () => {
	const plays = touchdownDrive();
	const td = plays[6];
	assert.deepEqual(playPoints(td.data as PlayData, "phs"), { phs: 6, opponent: 0 });
	assert.equal(playKind(td.data as PlayData, "phs"), "touchdown");
	assert.deepEqual(playPoints(plays[7].data as PlayData, "phs"), { phs: 1, opponent: 0 });
	assert.equal(playKind(plays[7].data as PlayData, "phs"), "extra_point");

	const lines = scoreLines(plays, { phs: 7, opponent: 0 });
	assert.deepEqual(lines.get(td.id), { phs: 6, opponent: 0 });
	assert.deepEqual(lines.get(plays[7].id), { phs: 7, opponent: 0 });
	assert.equal(lines.get(plays[1].id), null);
});

test("a touchdown pass credits both the passer and the receiver", () => {
	const ps = computeStats(
		[play("phs", { type: "pass", passer: 12, receiver: 4, complete: true, yards: 30, touchdown: true, down: 3, distance: 6 })],
		ROSTER
	).player_stats;
	assert.deepEqual(row(ps, "Passing", "phs", 12)?.values, ["1/1", "30", "1", "0"]);
	assert.deepEqual(row(ps, "Receiving", "phs", 4)?.values, ["1", "30", "1", "30"]);
	// A third down that scores is a conversion even without the flag.
	assert.deepEqual(
		stat(
			computeStats([play("phs", { type: "rush", carrier: 22, yards: 4, touchdown: true, down: 3, distance: 4 })], ROSTER).team_stats,
			"Third down"
		),
		["1/1", "0/0"]
	);
});

// ─── Undoing a scoring play ─────────────────────────────────────────────────

test("undoing a scoring play takes the points and the stats back off", () => {
	const plays = touchdownDrive();
	const td = plays[6];
	const scoreBefore = { phs: 7, opponent: 0 };
	const pts = playPoints(td.data as PlayData, td.team);
	const scoreAfter = { phs: scoreBefore.phs - pts.phs, opponent: scoreBefore.opponent - pts.opponent };
	assert.deepEqual(scoreAfter, { phs: 1, opponent: 0 });

	const remaining = plays.filter(p => p.id !== td.id);
	const result = computeStats(remaining, ROSTER);
	assertContract(result);
	assert.deepEqual(row(result.player_stats, "Rushing", "phs", 22)?.values, ["2", "9", "0", "7"]);
	assert.deepEqual(stat(result.team_stats, "Rushing yards"), ["9", "0"]);
	// The extra point's line now reads 1–0, matching the scoreboard.
	assert.deepEqual(scoreLines(remaining, scoreAfter).get(plays[7].id), { phs: 1, opponent: 0 });
});

test("editing a touchdown into a short run clears its score line", () => {
	const plays = touchdownDrive();
	plays[6] = { ...plays[6], data: { v: 1, type: "rush", carrier: 22, yards: 18, down: 1, distance: 10 } };
	const lines = scoreLines(plays, { phs: 1, opponent: 0 });
	assert.equal(lines.get(plays[6].id), null);
	assert.deepEqual(lines.get(plays[7].id), { phs: 1, opponent: 0 });
});

test("score lines account for points entered before the first play", () => {
	// The editor started entering plays at 7–3.
	const plays = [play("opponent", { type: "field_goal", kicker: 3, yards: 31, good: true })];
	assert.deepEqual(scoreLines(plays, { phs: 7, opponent: 6 }).get(plays[0].id), { phs: 7, opponent: 6 });
});

// ─── An interception ────────────────────────────────────────────────────────

test("an interception: a pass attempt, a turnover and a pick for the defender", () => {
	const pick = play("opponent", {
		type: "interception",
		passer: 7,
		receiver: 11,
		interceptor: 21,
		return_yards: 15,
		tackler: 70,
		down: 2,
		distance: 7,
		spot: 60,
	});
	const result = computeStats(
		[play("opponent", { type: "pass", passer: 7, receiver: 11, complete: true, yards: 9, down: 1, distance: 10, spot: 69 }), pick],
		ROSTER
	);
	assertContract(result);
	assert.deepEqual(row(result.player_stats, "Passing", "opponent", 7)?.values, ["1/2", "9", "0", "1"]);
	assert.deepEqual(row(result.player_stats, "Defense", "phs", 21), { team: "phs", number: 21, name: "C. Day", values: ["0", "0", "1"] });
	// The man who tackled the returner was on the offense.
	assert.deepEqual(row(result.player_stats, "Defense", "opponent", 70)?.values, ["1", "0", "0"]);
	assert.deepEqual(stat(result.team_stats, "Turnovers"), ["0", "1"]);
	assert.equal(playKind(pick.data as PlayData, "opponent"), "turnover");
	assert.deepEqual(playPoints(pick.data as PlayData, "opponent"), { phs: 0, opponent: 0 });
	assert.equal(
		describePlay(pick.data as PlayData, "opponent", { roster: ROSTER, opponent: "Hopewell Valley", period: "Q2" }),
		"#7 D. West pass intended for #11 intercepted by #21 C. Day, returned 15 yds (tackle by #70)"
	);
});

test("a pick six scores for the defense", () => {
	const d: PlayData = { v: 1, type: "interception", passer: 7, interceptor: 21, return_yards: 40, touchdown: true };
	assert.deepEqual(playPoints(d, "opponent"), { phs: 6, opponent: 0 });
	assert.equal(playKind(d, "opponent"), "touchdown");
	const next = suggestNext({ ...EMPTY_SITUATION, possession: "opponent", down: 2, distance: 7, spot: 60 }, d, "opponent");
	assert.equal(next?.possession, "phs");
	assert.equal(next?.label, "PAT");
});

test("a lost fumble counts against the offense; the yards before it still count", () => {
	const result = computeStats([play("phs", { type: "rush", carrier: 22, yards: 4, fumble: true, turnover: true, recoverer: 54 })], ROSTER);
	assert.deepEqual(stat(result.team_stats, "Turnovers"), ["1", "0"]);
	assert.deepEqual(stat(result.team_stats, "Rushing yards"), ["4", "0"]);
});

// ─── A sack ─────────────────────────────────────────────────────────────────

test("a sack: negative rushing yards for the QB, a sack for the defender", () => {
	const sack = play("opponent", { type: "sack", carrier: 7, tackler: 90, yards: -8, down: 2, distance: 6, spot: 40 });
	const result = computeStats([play("opponent", { type: "pass", passer: 7, receiver: 11, complete: true, yards: 14 }), sack], ROSTER);
	assertContract(result);
	assert.deepEqual(row(result.player_stats, "Rushing", "opponent", 7)?.values, ["1", "-8", "0", "-8"]);
	// Sack yards come off rushing, the high-school and college convention, so
	// passing yards are untouched and the QB's attempts are unchanged.
	assert.deepEqual(stat(result.team_stats, "Rushing yards"), ["0", "-8"]);
	assert.deepEqual(stat(result.team_stats, "Passing yards"), ["0", "14"]);
	assert.deepEqual(row(result.player_stats, "Passing", "opponent", 7)?.values, ["1/1", "14", "0", "0"]);
	// The sack is a tackle as well.
	assert.deepEqual(row(result.player_stats, "Defense", "phs", 90), { team: "phs", number: 90, name: "B. Cole", values: ["1", "1", "0"] });
	assert.equal(
		describePlay(sack.data as PlayData, "opponent", { roster: ROSTER, opponent: "Hopewell Valley", period: "Q2" }),
		"#7 D. West sacked by #90 B. Cole for a loss of 8 yds"
	);
	// 2nd & 6 at HV 40 (spot 40, opponent driving toward 0) → 3rd & 14 at HV 48.
	const next = suggestNext({ ...EMPTY_SITUATION, possession: "opponent", down: 2, distance: 6, spot: 40 }, sack.data as PlayData, "opponent");
	assert.deepEqual([next?.down, next?.distance, next?.spot], [3, 14, 48]);
});

test("a safety: two points to the defense, then a free kick from the 20", () => {
	const d: PlayData = { v: 1, type: "sack", carrier: 12, tackler: 54, yards: -3, safety: true };
	assert.deepEqual(playPoints(d, "phs"), { phs: 0, opponent: 2 });
	assert.equal(playKind(d, "phs"), "safety");
	const next = suggestNext({ ...EMPTY_SITUATION, possession: "phs", down: 2, distance: 10, spot: 2 }, d, "phs");
	assert.deepEqual([next?.possession, next?.spot, next?.label], ["phs", 20, "Kickoff"]);
});

// ─── A penalty ──────────────────────────────────────────────────────────────

test("a penalty: charged to the team it was called on, not the offense", () => {
	const holding = play("phs", {
		type: "penalty",
		penalty_on: "phs",
		penalty_name: "Holding",
		player: 71,
		yards: 10,
		down: 1,
		distance: 10,
		spot: 30,
	});
	const offside = play("phs", { type: "penalty", penalty_on: "opponent", penalty_name: "Offside", yards: 5, down: 1, distance: 20, spot: 20 });
	const result = computeStats([holding, offside], ROSTER);
	assertContract(result);
	assert.deepEqual(stat(result.team_stats, "Penalties-yards"), ["1-10", "1-5"]);
	// Penalties are not plays from scrimmage: no yards, no third-down attempt.
	assert.deepEqual(stat(result.team_stats, "Total yards"), ["0", "0"]);
	assert.equal(playKind(holding.data as PlayData, "phs"), "penalty");
	assert.equal(
		describePlay(holding.data as PlayData, "phs", { roster: ROSTER, opponent: "Hopewell Valley", period: "Q1" }),
		"Penalty on PHS #71: Holding, 10 yds"
	);
});

test("a penalty suggests the new spot and distance, and respects half the distance", () => {
	const at = (spot: number, down = 1, distance = 10): Situation => ({ ...EMPTY_SITUATION, possession: "phs", down, distance, spot });
	const hold: PlayData = { v: 1, type: "penalty", penalty_on: "phs", yards: 10 };
	let next = suggestNext(at(30), hold, "phs");
	assert.deepEqual([next?.down, next?.distance, next?.spot], [1, 20, 20]);
	next = suggestNext(at(8), hold, "phs");
	assert.deepEqual([next?.down, next?.distance, next?.spot], [1, 14, 4]);

	const offside: PlayData = { v: 1, type: "penalty", penalty_on: "opponent", yards: 5 };
	next = suggestNext(at(40, 3, 3), offside, "phs");
	assert.deepEqual([next?.down, next?.distance, next?.spot], [1, 10, 45]);
	next = suggestNext(at(40, 3, 8), offside, "phs");
	assert.deepEqual([next?.down, next?.distance, next?.spot], [3, 3, 45]);
});

// ─── Suggestions ────────────────────────────────────────────────────────────

test("a 7-yard run on 1st & 10 proposes 2nd & 3", () => {
	const before: Situation = { ...EMPTY_SITUATION, possession: "phs", down: 1, distance: 10, spot: 25 };
	const next = suggestNext(before, { v: 1, type: "rush", carrier: 22, yards: 7 }, "phs");
	assert.deepEqual([next?.possession, next?.down, next?.distance, next?.spot], ["phs", 2, 3, 32]);
	assert.equal(situationColumns(next!, "HV").down_distance, "2nd & 3");
	assert.equal(situationColumns(next!, "HV").ball_on, "PHS 32");
});

test("suggestions: first downs, goal to go, turnover on downs", () => {
	const s = (o: Partial<Situation>): Situation => ({ ...EMPTY_SITUATION, possession: "phs", down: 1, distance: 10, ...o });
	let next = suggestNext(s({ down: 2, distance: 3, spot: 40 }), { v: 1, type: "rush", yards: 4 }, "phs");
	assert.deepEqual([next?.down, next?.distance, next?.goal, next?.spot], [1, 10, false, 44]);
	next = suggestNext(s({ spot: 85 }), { v: 1, type: "pass", complete: true, yards: 10 }, "phs");
	assert.deepEqual([next?.down, next?.goal, next?.spot], [1, true, 95]);
	assert.equal(formatDownDistance(next!), "1st & Goal");
	next = suggestNext(s({ down: 4, distance: 2, spot: 50 }), { v: 1, type: "pass", complete: false }, "phs");
	assert.deepEqual([next?.possession, next?.down, next?.spot], ["opponent", 1, 50]);
	// Nothing to suggest for a timeout or a note.
	assert.equal(suggestNext(s({ spot: 30 }), { v: 1, type: "timeout" }, "phs"), null);
});

test("suggestions: kicks and the end of a period", () => {
	const s: Situation = { ...EMPTY_SITUATION, possession: "phs", down: 4, distance: 9, spot: 30 };
	// A 40-yard punt from the PHS 30 lands at the HV 30; a 10-yard return
	// brings it back to the HV 40. Opponent ball.
	let next = suggestNext(s, { v: 1, type: "punt", yards: 40, return_yards: 10 }, "phs");
	assert.deepEqual([next?.possession, next?.down, next?.spot], ["opponent", 1, 60]);
	assert.equal(formatBallOn(next!.spot, "HV"), "HV 40");
	next = suggestNext(s, { v: 1, type: "punt", yards: 45, touchback: true }, "phs");
	assert.equal(formatBallOn(next!.spot, "HV"), "HV 20");
	next = suggestNext({ ...EMPTY_SITUATION, possession: "phs", spot: 97, label: "PAT" }, { v: 1, type: "extra_point", good: true }, "phs");
	assert.deepEqual([next?.possession, next?.label, next?.spot], ["phs", "Kickoff", 40]);

	next = suggestNext({ ...s, period: "Q1", clock: "0:00" }, { v: 1, type: "period_end" }, null);
	assert.deepEqual([next?.period, next?.clock, next?.possession, next?.spot], ["Q2", "12:00", "phs", 30]);
	next = suggestNext({ ...s, period: "Q2", clock: "0:00" }, { v: 1, type: "period_end" }, null);
	assert.deepEqual([next?.period, next?.clock, next?.possession], ["HALF", "", null]);
});

// ─── Time of possession ─────────────────────────────────────────────────────

test("time of possession comes from the clock between plays, and is hidden without one", () => {
	const plays = [
		play("phs", { type: "rush", carrier: 22, yards: 3 }, "Q1", "12:00"),
		play("phs", { type: "punt", kicker: 15, yards: 40 }, "Q1", "10:30"),
		play("opponent", { type: "rush", yards: 2 }, "Q1", "10:20"),
		play(null, { type: "period_end" }, "Q1", "0:00"),
	];
	const ts = computeStats(plays, ROSTER).team_stats;
	assert.deepEqual(stat(ts, "Possession"), ["1:30", "10:30"]);
	assert.equal(ts[ts.length - 1].label, "Possession");
});

// ─── Text in and out ────────────────────────────────────────────────────────

test("descriptions read like a box score", () => {
	const ctx = { roster: ROSTER, opponent: "Hopewell Valley", period: "Q1" };
	const d = (data: Omit<PlayData, "v">, team: Side | null = "phs") => describePlay({ v: 1, ...data }, team, ctx);
	assert.equal(d({ type: "pass", passer: 12, receiver: 4, complete: true, yards: 23 }), "#12 J. Smith pass to #4 A. Lee for 23 yds");
	assert.equal(d({ type: "rush", carrier: 22, yards: 14, touchdown: true }), "#22 M. Ortiz 14 yd touchdown run");
	assert.equal(d({ type: "rush", carrier: 22, yards: 0, tackler: 54 }), "#22 M. Ortiz run for no gain (tackle by #54 K. Doe)");
	assert.equal(d({ type: "pass", passer: 12, receiver: 4, complete: false }), "#12 J. Smith pass incomplete intended for #4 A. Lee");
	assert.equal(d({ type: "field_goal", kicker: 15, yards: 32, good: false }), "#15 R. Hall 32 yd field goal is no good");
	assert.equal(d({ type: "extra_point", kicker: 15, good: true }), "#15 R. Hall extra point is good");
	assert.equal(d({ type: "kickoff", kicker: 15, yards: 50, touchback: true }), "#15 R. Hall kickoff 50 yds, touchback");
	assert.equal(d({ type: "timeout" }, "opponent"), "Timeout Hopewell Valley");
	assert.equal(d({ type: "period_end" }, null), "End of 1st quarter");
	assert.equal(d({ type: "note", text: "  Lightning delay  " }, null), "Lightning delay");
});

test("clock entry: a number pad has no colon", () => {
	assert.equal(normalizeClock("842"), "8:42");
	assert.equal(normalizeClock("1200"), "12:00");
	assert.equal(normalizeClock("45"), "0:45");
	assert.equal(normalizeClock("8:42"), "8:42");
	assert.equal(normalizeClock("8.4"), "8:40");
	assert.equal(normalizeClock(""), "");
	assert.equal(normalizeClock("875"), null);
	assert.equal(normalizeClock("eight"), null);
});

test("the situation survives a round trip through the gamecast row", () => {
	const cases: Situation[] = [
		{ period: "Q2", clock: "8:42", possession: "phs", down: 3, distance: 7, goal: false, spot: 66, label: "" },
		{ period: "Q3", clock: "1:10", possession: "opponent", down: 1, distance: null, goal: true, spot: 6, label: "" },
		{ period: "Q4", clock: "4:00", possession: "phs", down: null, distance: null, goal: false, spot: 97, label: "PAT" },
		{ period: "HALF", clock: "", possession: null, down: null, distance: null, goal: false, spot: null, label: "" },
		{ period: "Q1", clock: "12:00", possession: "phs", down: 2, distance: 10, goal: false, spot: 50, label: "" },
	];
	for (const s of cases) assert.deepEqual(situationFromColumns(situationColumns(s, "HV")), s);
	assert.equal(situationColumns(cases[0], "HV").ball_on, "HV 34");
	assert.equal(parseBallOn("PHS 34"), 34);
	assert.equal(parseBallOn("50"), 50);
	assert.equal(parseBallOn("WWPN 12"), 88);
	assert.deepEqual(parseDownDistance("4th & Inches"), { down: 4, distance: 0, goal: false, label: "" });
});

test("opponent abbreviations for the ball spot", () => {
	assert.equal(opponentAbbrev("Hopewell Valley"), "HV");
	assert.equal(opponentAbbrev("Lawrenceville"), "LAW");
	assert.equal(opponentAbbrev("Hamilton West High School"), "HW");
	assert.equal(opponentAbbrev(""), "OPP");
});

test("pasted rosters", () => {
	const { entries, errors } = parseRosterLines(
		[
			"12 J. Smith QB",
			"#4 A. Lee",
			"22, M. Ortiz, RB",
			"81\tT. Park\tTE",
			"7 - D. West - QB/S",
			"",
			"Coach Brown",
			"150 Too Big",
			"21 C. Day cb",
			"12 J. Smith Jr. QB",
		].join("\n"),
		"phs"
	);
	assert.deepEqual(entries, [
		{ team: "phs", number: 4, name: "A. Lee", position: "" },
		{ team: "phs", number: 7, name: "D. West", position: "QB/S" },
		// A later line for the same number wins.
		{ team: "phs", number: 12, name: "J. Smith Jr.", position: "QB" },
		{ team: "phs", number: 21, name: "C. Day", position: "CB" },
		{ team: "phs", number: 22, name: "M. Ortiz", position: "RB" },
		{ team: "phs", number: 81, name: "T. Park", position: "TE" },
	]);
	assert.equal(errors.length, 2);
});

test("recent numbers for one-tap picks, by role and side", () => {
	const plays = touchdownDrive();
	assert.deepEqual(recentNumbers(plays, "receiver", "phs"), [81, 4]);
	assert.deepEqual(recentNumbers(plays, "carrier", "phs"), [22]);
	assert.deepEqual(recentNumbers(plays, "tackler", "opponent"), [54, 40]);
	assert.deepEqual(recentNumbers(plays, "returner", "phs"), [3]);
});
