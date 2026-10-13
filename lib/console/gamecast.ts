/** @format */

// Logic for the console's Gamecast screen (football play-by-play), kept apart
// from the React so it can be unit tested.
//
// THE APP ONLY DISPLAYS. Every number a reader sees is text computed here and
// written to public.gamecast as display-ready strings; the app does no
// football arithmetic. The shapes are a contract with the app (see the app
// repo's supabase/gamecast.sql and lib/models/gamecast.dart): changing a key
// name, or putting more than five columns in a player table, needs an app
// update to match. Adding, renaming or reordering a stat does not.
//
// Stats are always recomputed from ALL of a game's plays, never incremented.
// That is what makes undo and editing an old play correct for free.
//
// Field position is one number, `spot`: yards from the PHS goal line, 0–100.
// PHS drives toward 100, the opponent toward 0. "PHS 34" is 34, "HV 34" is 66.

export type Side = "phs" | "opponent";

export const other = (side: Side): Side => (side === "phs" ? "opponent" : "phs");

export function isSide(value: unknown): value is Side {
	return value === "phs" || value === "opponent";
}

// ─── Plays ──────────────────────────────────────────────────────────────────

/** What the editor picks. "Fumble" is not here: it is a run (or catch) with
 *  the fumble flag, so the yards still count where they were gained. */
export type PlayType =
	| "rush"
	| "pass"
	| "sack"
	| "kneel"
	| "punt"
	| "kickoff"
	| "field_goal"
	| "extra_point"
	| "two_point"
	| "penalty"
	| "interception"
	| "timeout"
	| "period_end"
	| "note";

export const PLAY_TYPES: PlayType[] = [
	"rush",
	"pass",
	"sack",
	"kneel",
	"punt",
	"kickoff",
	"field_goal",
	"extra_point",
	"two_point",
	"penalty",
	"interception",
	"timeout",
	"period_end",
	"note",
];

/** The `kind` column. Picks the icon in the app; the first five are
 *  highlighted there as scoring plays. Must match the check constraint. */
export type PlayKind =
	| "play"
	| "touchdown"
	| "field_goal"
	| "extra_point"
	| "two_point"
	| "safety"
	| "turnover"
	| "penalty"
	| "punt"
	| "kickoff"
	| "timeout"
	| "period_end"
	| "note";

export const SCORING_KINDS: PlayKind[] = ["touchdown", "field_goal", "extra_point", "two_point", "safety"];

/** Player roles a play can name. Which team each belongs to depends on the
 *  play: see roleSide. */
export type Role = "passer" | "carrier" | "receiver" | "kicker" | "returner" | "tackler" | "interceptor" | "recoverer" | "player";

/**
 * gamecast_play.data — console-only; the app never reads it. This is what
 * stats are computed from, so it records what happened, not how to print it.
 *
 * `yards` is the offense's signed gain on scrimmage plays (a sack is
 * negative), the kick's distance on punts, kickoffs and field goals, the
 * return on an interception, and the penalty's yardage on a penalty.
 */
export interface PlayData {
	v: 1;
	type: PlayType;

	// The situation before the snap, as the strip showed it. Third-down
	// conversions are counted from these.
	down?: number | null;
	distance?: number | null;
	goal?: boolean;
	spot?: number | null;

	passer?: number | null;
	carrier?: number | null;
	receiver?: number | null;
	kicker?: number | null;
	returner?: number | null;
	tackler?: number | null;
	interceptor?: number | null;
	recoverer?: number | null;
	/** The player a penalty was called on. */
	player?: number | null;

	yards?: number | null;
	return_yards?: number | null;

	complete?: boolean;
	good?: boolean;
	touchdown?: boolean;
	first_down?: boolean;
	/** Possession changed hands on this play: a lost fumble, or a muffed kick
	 *  recovered by the kicking team. Interceptions are always turnovers. */
	turnover?: boolean;
	fumble?: boolean;
	safety?: boolean;
	touchback?: boolean;
	/** Two-point conversions: how it was tried. */
	method?: "rush" | "pass";
	penalty_on?: Side | null;
	penalty_name?: string;
	/** Notes: the whole line. */
	text?: string;
}

/** A gamecast_play row as the console reads it back. */
export interface PlayRow {
	id: number;
	period: string;
	clock: string;
	team: Side | null;
	kind: string;
	description: string;
	down_distance: string;
	score_phs: number | null;
	score_opponent: number | null;
	data: unknown;
}

export interface RosterEntry {
	team: Side;
	number: number;
	name: string;
	position: string;
}

/** Rows written before data existed, or by hand in the SQL editor, are shown
 *  in the feed but contribute nothing to stats rather than throwing. */
export function playData(row: { data: unknown }): PlayData | null {
	const d = row.data as PlayData | null;
	if (!d || typeof d !== "object" || !PLAY_TYPES.includes(d.type)) return null;
	return d;
}

const num = (value: number | null | undefined): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const has = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

/** Plays from scrimmage: the ones that use a down. */
export function isScrimmage(type: PlayType): boolean {
	return type === "rush" || type === "pass" || type === "sack" || type === "kneel" || type === "interception";
}

/** Who has the ball at the end of the play (before any score's kickoff). */
function endingCarrier(d: PlayData, team: Side): Side {
	if (d.type === "interception") return other(team);
	if (d.type === "punt" || d.type === "kickoff") return d.turnover ? team : other(team);
	if (d.turnover) return other(team);
	return team;
}

/** Which team a named player is on. `team` is the row's team: the offense,
 *  or the kicking team on punts and kickoffs. */
export function roleSide(d: PlayData, role: Role, team: Side): Side {
	switch (role) {
		case "passer":
		case "carrier":
		case "receiver":
		case "kicker":
			return team;
		case "returner":
		case "interceptor":
			return other(team);
		case "recoverer":
			return endingCarrier(d, team);
		case "tackler":
			// Whoever tackled the man with the ball at the end of the play.
			return other(endingCarrier(d, team));
		case "player":
			return d.penalty_on ?? team;
	}
}

/** The team that scores the touchdown on this play, if any. */
function touchdownSide(d: PlayData, team: Side): Side | null {
	if (!d.touchdown) return null;
	if (d.type === "rush" || d.type === "pass" || d.type === "sack" || d.type === "kneel") return d.turnover ? other(team) : team;
	if (d.type === "interception" || d.type === "punt" || d.type === "kickoff") return endingCarrier(d, team);
	return null;
}

/** Points this play is worth to each side. */
export function playPoints(d: PlayData | null, team: Side | null): { phs: number; opponent: number } {
	const points = { phs: 0, opponent: 0 };
	if (!d || !team) return points;
	const td = touchdownSide(d, team);
	if (td) points[td] += 6;
	if (d.type === "field_goal" && d.good) points[team] += 3;
	if (d.type === "extra_point" && d.good) points[team] += 1;
	if (d.type === "two_point" && d.good) points[team] += 2;
	// A safety scores for the defense: the team tackled in its own end zone
	// is the offense of the row.
	if (d.safety && !td) points[other(team)] += 2;
	return points;
}

/** The `kind` column for a play. Missed kicks are ordinary plays: the app
 *  highlights the scoring kinds, and a missed field goal is not one. */
export function playKind(d: PlayData, team: Side | null): PlayKind {
	if (team && touchdownSide(d, team)) return "touchdown";
	if (d.safety) return "safety";
	switch (d.type) {
		case "field_goal":
			return d.good ? "field_goal" : "play";
		case "extra_point":
			return d.good ? "extra_point" : "play";
		case "two_point":
			return d.good ? "two_point" : "play";
		case "interception":
			return "turnover";
		case "penalty":
			return "penalty";
		case "punt":
			return d.turnover ? "turnover" : "punt";
		case "kickoff":
			return d.turnover ? "turnover" : "kickoff";
		case "timeout":
			return "timeout";
		case "period_end":
			return "period_end";
		case "note":
			return "note";
		default:
			return d.turnover ? "turnover" : "play";
	}
}

export function isScoringKind(kind: string): boolean {
	return (SCORING_KINDS as string[]).includes(kind);
}

/** Plays that belong to neither side store team = null. */
export function playHasTeam(type: PlayType): boolean {
	return type !== "period_end" && type !== "note";
}

// ─── Scores ─────────────────────────────────────────────────────────────────

/**
 * The score after each scoring play, PHS first, for the score columns of
 * gamecast_play. Plays in id order (oldest first).
 *
 * `totals` is the broadcast's current score. Anything in it the plays do not
 * account for (an editor who started entering plays at 7–0, or a manual fix
 * on the score panel) is treated as having happened before the first play,
 * so the last scoring play always agrees with the scoreboard.
 *
 * Non-scoring plays map to null, which is how a play that was edited from a
 * touchdown into a run loses its score line.
 */
export function scoreLines(
	plays: Array<{ id: number; team: Side | null; data: unknown }>,
	totals: { phs: number | null; opponent: number | null }
): Map<number, { phs: number; opponent: number } | null> {
	const all = { phs: 0, opponent: 0 };
	for (const p of plays) {
		const pts = playPoints(playData(p), p.team);
		all.phs += pts.phs;
		all.opponent += pts.opponent;
	}
	const running = { phs: num(totals.phs) - all.phs, opponent: num(totals.opponent) - all.opponent };
	const out = new Map<number, { phs: number; opponent: number } | null>();
	for (const p of plays) {
		const d = playData(p);
		const pts = playPoints(d, p.team);
		running.phs += pts.phs;
		running.opponent += pts.opponent;
		const scoring = d !== null && isScoringKind(playKind(d, p.team)) && pts.phs + pts.opponent > 0;
		out.set(p.id, scoring ? { phs: Math.max(0, running.phs), opponent: Math.max(0, running.opponent) } : null);
	}
	return out;
}

// ─── Clock and periods ──────────────────────────────────────────────────────

/** NJSIAA varsity quarters are twelve minutes. */
export const QUARTER_LENGTH = "12:00";

export const PERIODS = ["Q1", "Q2", "HALF", "Q3", "Q4", "OT", "FINAL"];

/** What comes after a period ends. Q4 suggests FINAL: overtime is the
 *  editor's call, one tap away. */
export function nextPeriod(period: string): string {
	switch (period.trim().toUpperCase()) {
		case "Q1":
			return "Q2";
		case "Q2":
			return "HALF";
		case "HALF":
			return "Q3";
		case "Q3":
			return "Q4";
		case "Q4":
		case "OT":
			return "FINAL";
		default:
			return period;
	}
}

/** Periods in which a game clock runs. */
export function periodHasClock(period: string): boolean {
	return /^(Q[1-4]|OT\d*)$/i.test(period.trim());
}

/**
 * What an editor typed into the clock box → "M:SS", "" for empty, or null if
 * it cannot be a game clock. Digits alone are read right to left, the way a
 * microwave does, because a phone's number pad has no colon: "842" is 8:42,
 * "1200" is 12:00, "45" is 0:45.
 */
export function normalizeClock(raw: string): string | null {
	const s = (raw ?? "").trim();
	if (!s) return "";
	let minutes: number;
	let seconds: number;
	const sep = /^(\d{1,2})[:.](\d{1,2})$/.exec(s);
	if (sep) {
		minutes = Number(sep[1]);
		seconds = Number(sep[2].length === 1 ? `${sep[2]}0` : sep[2]);
	} else if (/^\d{1,4}$/.test(s)) {
		const n = Number(s);
		minutes = Math.floor(n / 100);
		seconds = n % 100;
	} else return null;
	if (seconds > 59 || minutes > 15) return null;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "8:42" → 522 seconds, or null. */
export function clockSeconds(clock: string): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec((clock ?? "").trim());
	if (!m) return null;
	return Number(m[1]) * 60 + Number(m[2]);
}

function formatDuration(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Situation ──────────────────────────────────────────────────────────────

/** The strip at the top of the Gamecast screen, structured. It is stored in
 *  public.gamecast as display text and parsed back on load. */
export interface Situation {
	period: string;
	clock: string;
	possession: Side | null;
	/** 1–4, or null when there is no down (a kickoff, a try, halftime). */
	down: number | null;
	distance: number | null;
	/** "& Goal": the distance is the yards to the goal line. */
	goal: boolean;
	/** Yards from the PHS goal line, 0–100. */
	spot: number | null;
	/** What to show instead of a down: "PAT", "Kickoff". */
	label: string;
}

export const EMPTY_SITUATION: Situation = {
	period: "Q1",
	clock: QUARTER_LENGTH,
	possession: null,
	down: null,
	distance: null,
	goal: false,
	spot: null,
	label: "",
};

/** Yards the offense still has to go to score. */
export function toGoal(offense: Side, spot: number): number {
	return offense === "phs" ? 100 - spot : spot;
}

/** Move the ball `yards` in the offense's direction. */
export function advance(offense: Side, spot: number, yards: number): number {
	return offense === "phs" ? spot + yards : spot - yards;
}

/** A team's own N-yard line as a spot. */
export function ownYardLine(side: Side, yards: number): number {
	return side === "phs" ? yards : 100 - yards;
}

/** "HV" for Hopewell Valley, "LAW" for Lawrenceville. Box scores use a short
 *  code for the ball spot, and ball_on has to fit beside the down. */
export function opponentAbbrev(opponent: string): string {
	const words = (opponent ?? "")
		.replace(/\b(high|school|regional|hs|h\.s\.|the)\b/gi, " ")
		.split(/[\s\-–/]+/)
		.map(w => w.replace(/[^A-Za-z]/g, ""))
		.filter(Boolean);
	if (words.length === 0) return "OPP";
	if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
	return words
		.map(w => w[0])
		.join("")
		.slice(0, 4)
		.toUpperCase();
}

const ORDINALS = ["", "1st", "2nd", "3rd", "4th"];

/** The effective distance: "& Goal" means the yards to the goal line. */
export function effectiveDistance(s: Pick<Situation, "distance" | "goal" | "spot" | "possession">): number | null {
	if (s.goal && s.spot !== null && s.possession) return toGoal(s.possession, s.spot);
	return s.distance;
}

/** "3rd & 7", "1st & Goal", or the label ("PAT") when there is no down. */
export function formatDownDistance(s: Pick<Situation, "down" | "distance" | "goal" | "label">): string {
	if (!s.down || s.down < 1 || s.down > 4) return s.label;
	if (s.goal) return `${ORDINALS[s.down]} & Goal`;
	if (s.distance === null) return ORDINALS[s.down];
	// Less than a yard prints the way a broadcaster says it.
	return `${ORDINALS[s.down]} & ${s.distance < 1 ? "Inches" : s.distance}`;
}

/** "PHS 34", "HV 34", "50", or "". */
export function formatBallOn(spot: number | null, abbrev: string): string {
	if (spot === null) return "";
	const s = Math.round(spot);
	if (s === 50) return "50";
	if (s < 50) return `PHS ${Math.max(0, s)}`;
	return `${abbrev} ${Math.max(0, 100 - s)}`;
}

/** Inverse of formatBallOn. Anything not "PHS n" or "50" with a yard number
 *  is read as the opponent's side, so a renamed abbreviation still parses. */
export function parseBallOn(text: string): number | null {
	const t = (text ?? "").trim();
	if (!t) return null;
	if (/^50$/.test(t)) return 50;
	const m = /^(.*?)\s*(\d{1,2})$/.exec(t);
	if (!m) return null;
	const yards = Number(m[2]);
	if (yards > 50) return null;
	return m[1].trim().toUpperCase() === "PHS" ? yards : 100 - yards;
}

export function parseDownDistance(text: string): Pick<Situation, "down" | "distance" | "goal" | "label"> {
	const t = (text ?? "").trim();
	const m = /^([1-4])(?:st|nd|rd|th)?\s*(?:&\s*(goal|inches|\d{1,2}))?$/i.exec(t);
	if (!m) return { down: null, distance: null, goal: false, label: t };
	const down = Number(m[1]);
	const rest = (m[2] ?? "").toLowerCase();
	if (rest === "goal") return { down, distance: null, goal: true, label: "" };
	if (rest === "inches") return { down, distance: 0, goal: false, label: "" };
	return { down, distance: rest ? Number(rest) : null, goal: false, label: "" };
}

/** The gamecast row's situation columns, as the app expects them. */
export function situationColumns(s: Situation, abbrev: string) {
	return {
		period: s.period,
		clock: s.clock,
		possession: s.possession,
		down_distance: formatDownDistance(s),
		ball_on: formatBallOn(s.spot, abbrev),
	};
}

export function situationFromColumns(row: {
	period?: string | null;
	clock?: string | null;
	possession?: string | null;
	down_distance?: string | null;
	ball_on?: string | null;
}): Situation {
	return {
		period: row.period || EMPTY_SITUATION.period,
		clock: row.clock ?? "",
		possession: isSide(row.possession) ? row.possession : null,
		...parseDownDistance(row.down_distance ?? ""),
		spot: parseBallOn(row.ball_on ?? ""),
	};
}

/** "2nd & 4 at PHS 46" — gamecast_play.down_distance, the situation before
 *  the play. Empty when there was no down. */
export function playSituationText(s: Situation, abbrev: string): string {
	const dd = s.down ? formatDownDistance(s) : "";
	if (!dd) return "";
	const at = formatBallOn(s.spot, abbrev);
	return at ? `${dd} at ${at}` : dd;
}

export function situationsEqual(a: Situation, b: Situation): boolean {
	return (
		a.period === b.period &&
		a.clock === b.clock &&
		a.possession === b.possession &&
		a.down === b.down &&
		a.distance === b.distance &&
		a.goal === b.goal &&
		a.spot === b.spot &&
		a.label === b.label
	);
}

function firstAndTen(offense: Side, spot: number): Pick<Situation, "down" | "distance" | "goal" | "label" | "possession" | "spot"> {
	const goal = toGoal(offense, spot) <= 10;
	return { possession: offense, spot, down: 1, distance: goal ? null : 10, goal, label: "" };
}

function clampSpot(spot: number): number {
	return Math.min(99, Math.max(1, Math.round(spot)));
}

/** The gain on a scrimmage play: what the offense's spot moves by. */
export function scrimmageGain(d: PlayData): number {
	if (d.type === "pass" && !d.complete) return 0;
	if (d.type === "interception") return 0;
	return num(d.yards);
}

/** Does a gain make the line to gain? Used to tick "first down" for the
 *  editor, who can untick it. */
export function madeLineToGain(s: Situation, gain: number): boolean {
	const dist = effectiveDistance(s);
	return s.down !== null && dist !== null && gain >= dist;
}

/** Does a gain reach the end zone? Ticks "touchdown" for the editor. */
export function reachesEndZone(offense: Side | null, spot: number | null, gain: number): boolean {
	return offense !== null && spot !== null && gain > 0 && gain >= toGoal(offense, spot);
}

/**
 * The situation to PROPOSE after a play. Never applied without the editor
 * tapping it: they are watching the field, and this is only arithmetic.
 * Returns null when the play changes nothing (a timeout, a note).
 *
 * `before` is the strip as it stood before the play, and `team` the play's
 * team (offense, or the kicking team).
 */
export function suggestNext(before: Situation, d: PlayData, team: Side | null): Situation | null {
	const base: Situation = { ...before, label: "" };
	const off = team ?? before.possession;

	if (d.type === "period_end") {
		const period = nextPeriod(before.period);
		const half = period === "HALF" || period === "FINAL";
		return {
			...base,
			period,
			clock: periodHasClock(period) ? QUARTER_LENGTH : "",
			// The ball carries over between Q1/Q2 and Q3/Q4. At the half the
			// second half starts with a kickoff, so nobody has it.
			possession: half ? null : before.possession,
			down: half ? null : before.down,
			distance: half ? null : before.distance,
			goal: half ? false : before.goal,
			spot: half ? null : before.spot,
			label: period === "Q3" ? "Kickoff" : half ? "" : before.label,
		};
	}
	if (d.type === "timeout" || d.type === "note" || !off) return null;

	const kickoffBy = (side: Side, fromOwn: number): Situation => ({
		...base,
		possession: side,
		down: null,
		distance: null,
		goal: false,
		spot: ownYardLine(side, fromOwn),
		label: "Kickoff",
	});
	const pat = (side: Side): Situation => ({
		...base,
		possession: side,
		down: null,
		distance: null,
		goal: false,
		spot: ownYardLine(other(side), 3),
		label: "PAT",
	});

	const scorer = touchdownSide(d, off);
	if (scorer) return pat(scorer);
	// The team tackled in its own end zone free-kicks from its own 20.
	if (d.safety) return kickoffBy(off, 20);

	const spot = before.spot;
	switch (d.type) {
		case "rush":
		case "pass":
		case "sack":
		case "kneel": {
			if (spot === null) return null;
			const gain = scrimmageGain(d);
			const next = clampSpot(advance(off, spot, gain));
			if (d.turnover) return { ...base, ...firstAndTen(other(off), next) };
			if (d.first_down || madeLineToGain(before, gain)) return { ...base, ...firstAndTen(off, next) };
			if (before.down === null) return { ...base, possession: off, spot: next };
			if (before.down >= 4) return { ...base, ...firstAndTen(other(off), next) }; // turnover on downs
			const dist = effectiveDistance(before);
			return {
				...base,
				possession: off,
				spot: next,
				down: before.down + 1,
				goal: before.goal,
				distance: before.goal || dist === null ? null : Math.max(0, dist - gain),
			};
		}
		case "interception": {
			if (spot === null) return { ...base, possession: other(off), down: 1, distance: 10, goal: false };
			// The spot of the catch is not recorded; the line of scrimmage moved
			// by the return is close enough to propose.
			return { ...base, ...firstAndTen(other(off), clampSpot(advance(off, spot, -num(d.return_yards ?? d.yards)))) };
		}
		case "punt":
		case "kickoff": {
			const from = spot ?? (d.type === "kickoff" ? ownYardLine(off, 40) : null);
			const receiver = other(off);
			if (from === null) return { ...base, possession: d.turnover ? off : receiver, down: 1, distance: 10, goal: false };
			const landed = advance(off, from, num(d.yards));
			if (d.turnover) return { ...base, ...firstAndTen(off, clampSpot(landed)) };
			if (d.touchback || toGoal(off, landed) <= 0) return { ...base, ...firstAndTen(receiver, ownYardLine(receiver, 20)) };
			return { ...base, ...firstAndTen(receiver, clampSpot(advance(off, landed, -num(d.return_yards)))) };
		}
		case "field_goal":
			if (d.good) return kickoffBy(off, 40);
			// NFHS: a missed field goal is treated like a punt. Into the end zone
			// (the usual miss) is a touchback at the 20.
			return { ...base, ...firstAndTen(other(off), ownYardLine(other(off), 20)) };
		case "extra_point":
		case "two_point":
			return kickoffBy(off, 40);
		case "penalty": {
			if (spot === null) return null;
			const on = d.penalty_on ?? off;
			const y = Math.abs(num(d.yards));
			if (on === off) {
				// Half the distance to the offense's own goal, never more.
				const behind = 100 - toGoal(off, spot);
				const moved = Math.min(y, behind / 2);
				const next = advance(off, spot, -moved);
				if (before.down === null) return { ...base, possession: off, spot: next };
				const dist = effectiveDistance(before);
				return {
					...base,
					possession: off,
					spot: next,
					goal: before.goal,
					distance: before.goal || dist === null ? null : dist + moved,
				};
			}
			const moved = Math.min(y, toGoal(off, spot) / 2);
			const next = advance(off, spot, moved);
			const dist = effectiveDistance(before);
			if (d.first_down || (dist !== null && moved >= dist)) return { ...base, ...firstAndTen(off, next) };
			if (before.down === null) return { ...base, possession: off, spot: next };
			return {
				...base,
				possession: off,
				spot: next,
				goal: before.goal,
				distance: before.goal || dist === null ? null : dist - moved,
			};
		}
	}
	return null;
}

// ─── Descriptions ───────────────────────────────────────────────────────────

export interface DescribeContext {
	roster: RosterEntry[];
	/** The opponent's name as the broadcast row has it. */
	opponent: string;
	/** The period the play happened in, for "End of 1st quarter". */
	period: string;
}

export function rosterName(roster: RosterEntry[], side: Side, number: number | null | undefined): string {
	if (!has(number)) return "";
	return roster.find(r => r.team === side && r.number === number)?.name ?? "";
}

export function teamName(side: Side, opponent: string): string {
	return side === "phs" ? "PHS" : opponent.trim() || "Opponent";
}

function yds(n: number): string {
	return Math.abs(n) === 1 ? "1 yd" : `${Math.abs(n)} yds`;
}

function forGain(n: number): string {
	if (n === 0) return "for no gain";
	if (n < 0) return `for a loss of ${yds(n)}`;
	return `for ${yds(n)}`;
}

const PERIOD_NAMES: Record<string, string> = {
	Q1: "1st quarter",
	Q2: "2nd quarter",
	Q3: "3rd quarter",
	Q4: "4th quarter",
	OT: "overtime",
};

/**
 * The line readers see: "#12 J. Smith pass to #4 A. Lee for 23 yds".
 * Built from the roster; the editor can rewrite it before posting.
 */
export function describePlay(d: PlayData, team: Side | null, ctx: DescribeContext): string {
	const off = team ?? "phs";
	const who = (role: Role): string => {
		const n = d[role];
		if (!has(n)) return "";
		const name = rosterName(ctx.roster, roleSide(d, role, off), n);
		return name ? `#${n} ${name}` : `#${n}`;
	};
	const tName = (side: Side) => teamName(side, ctx.opponent);
	const y = num(d.yards);
	const ret = num(d.return_yards);
	const tackle = who("tackler") ? ` (tackle by ${who("tackler")})` : "";
	const fumble = () => {
		if (!d.fumble) return "";
		const rec = who("recoverer");
		const side = d.turnover ? other(off) : off;
		return `, fumbles, recovered by ${rec || tName(side)}`;
	};
	const td = () => {
		if (!d.touchdown) return "";
		return d.turnover || d.type === "interception" ? ", returned for a touchdown" : "";
	};
	const safety = d.safety ? ", safety" : "";

	switch (d.type) {
		case "rush": {
			const runner = who("carrier") || tName(off);
			if (d.touchdown && !d.turnover) return `${runner} ${yds(y).replace("yds", "yd")} touchdown run${fumble()}`;
			return `${runner} run ${forGain(y)}${fumble()}${td()}${safety}${d.touchdown || d.fumble ? "" : tackle}`;
		}
		case "pass": {
			const qb = who("passer") || tName(off);
			const target = who("receiver");
			if (!d.complete) return `${qb} pass incomplete${target ? ` intended for ${target}` : ""}`;
			if (d.touchdown && !d.turnover) return `${qb} ${yds(y).replace("yds", "yd")} touchdown pass${target ? ` to ${target}` : ""}`;
			return `${qb} pass${target ? ` to ${target}` : " complete"} ${forGain(y)}${fumble()}${td()}${safety}${
				d.touchdown || d.fumble ? "" : tackle
			}`;
		}
		case "sack": {
			const qb = who("carrier") || tName(off);
			const by = who("tackler");
			return `${qb} sacked${by ? ` by ${by}` : ""} ${forGain(y)}${fumble()}${td()}${safety}`;
		}
		case "kneel":
			return `${who("carrier") || tName(off)} kneels${y ? ` ${forGain(y)}` : ""}${safety}`;
		case "interception": {
			const qb = who("passer") || tName(off);
			const target = who("receiver");
			const picker = who("interceptor");
			const back = num(d.return_yards ?? d.yards);
			return `${qb} pass${target ? ` intended for ${target}` : ""} intercepted${picker ? ` by ${picker}` : ""}${
				d.touchdown ? `, returned ${yds(back)} for a touchdown` : back ? `, returned ${yds(back)}` : ""
			}${d.touchdown ? "" : tackle}`;
		}
		case "punt":
		case "kickoff": {
			const verb = d.type === "punt" ? "punt" : "kickoff";
			const kicker = who("kicker") || tName(off);
			const head = `${kicker} ${verb}${y ? ` ${yds(y)}` : ""}`;
			if (d.touchback) return `${head}, touchback`;
			const returner = who("returner");
			if (d.turnover) {
				const rec = who("recoverer");
				return `${head}, muffed${returner ? ` by ${returner}` : ""}, recovered by ${rec || tName(off)}${
					d.touchdown ? " for a touchdown" : ""
				}`;
			}
			if (!returner && !ret && !d.touchdown) return head;
			const returned = ret ? `returned ${yds(ret)}` : "returned for no gain";
			return `${head}, ${returned}${returner ? ` by ${returner}` : ""}${d.touchdown ? " for a touchdown" : tackle}`;
		}
		case "field_goal":
			return `${who("kicker") || tName(off)} ${y ? `${y} yd ` : ""}field goal is ${d.good ? "good" : "no good"}`;
		case "extra_point":
			return `${who("kicker") || tName(off)} extra point is ${d.good ? "good" : "no good"}`;
		case "two_point": {
			const how =
				d.method === "pass"
					? `${who("passer") || tName(off)} pass${who("receiver") ? ` to ${who("receiver")}` : ""}`
					: `${who("carrier") || tName(off)} run`;
			return `Two-point conversion: ${how}, ${d.good ? "good" : "no good"}`;
		}
		case "penalty": {
			const on = d.penalty_on ?? off;
			const player = who("player");
			const name = (d.penalty_name ?? "").trim();
			return `Penalty on ${tName(on)}${player ? ` ${player}` : ""}${name ? `: ${name}` : ""}${y ? `, ${yds(y)}` : ""}${
				d.first_down ? ", automatic first down" : ""
			}${safety}`;
		}
		case "timeout":
			return `Timeout ${tName(off)}`;
		case "period_end": {
			const p = ctx.period.trim().toUpperCase();
			return PERIOD_NAMES[p] ? `End of ${PERIOD_NAMES[p]}` : "End of period";
		}
		case "note":
			return (d.text ?? "").trim();
	}
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface TeamStat {
	label: string;
	phs: string;
	opponent: string;
}

export interface PlayerStatRow {
	team: Side;
	number: number;
	name: string;
	values: string[];
}

export interface StatTable {
	title: string;
	columns: string[];
	rows: PlayerStatRow[];
}

interface PlayerLine {
	team: Side;
	number: number;
	comp: number;
	att: number;
	passYds: number;
	passTd: number;
	thrownInt: number;
	car: number;
	rushYds: number;
	rushTd: number;
	rushLong: number | null;
	rec: number;
	recYds: number;
	recTd: number;
	recLong: number | null;
	tkl: number;
	sack: number;
	defInt: number;
	fgm: number;
	fga: number;
	fgLong: number | null;
	xpm: number;
	xpa: number;
}

interface TeamLine {
	passYds: number;
	rushYds: number;
	firstDowns: number;
	thirdAtt: number;
	thirdConv: number;
	fourthAtt: number;
	fourthConv: number;
	turnovers: number;
	penalties: number;
	penaltyYds: number;
	possession: number;
}

const blankTeam = (): TeamLine => ({
	passYds: 0,
	rushYds: 0,
	firstDowns: 0,
	thirdAtt: 0,
	thirdConv: 0,
	fourthAtt: 0,
	fourthConv: 0,
	turnovers: 0,
	penalties: 0,
	penaltyYds: 0,
	possession: 0,
});

const maxOf = (a: number | null, b: number) => (a === null ? b : Math.max(a, b));

/**
 * Who holds the ball while the clock runs after this play, for time of
 * possession. Kicks belong to the receiver; a timeout or a note changes
 * nothing.
 */
function holderAfter(d: PlayData, team: Side | null, current: Side | null): Side | null {
	if (!team || d.type === "timeout" || d.type === "note" || d.type === "period_end") return current;
	if (touchdownSide(d, team) || d.type === "extra_point" || d.type === "two_point" || (d.type === "field_goal" && d.good)) return current;
	if (d.type === "field_goal") return other(team);
	return endingCarrier(d, team);
}

/**
 * Every display value the app shows for a game, from ALL of its plays (any
 * order; sorted by id here). Pure: same plays and roster in, same JSON out.
 */
export function computeStats(
	plays: Array<Pick<PlayRow, "id" | "team" | "period" | "clock" | "data">>,
	roster: RosterEntry[]
): { team_stats: TeamStat[]; player_stats: StatTable[] } {
	const ordered = [...plays].sort((a, b) => a.id - b.id);
	const teams: Record<Side, TeamLine> = { phs: blankTeam(), opponent: blankTeam() };
	const players = new Map<string, PlayerLine>();

	const player = (side: Side, n: number | null | undefined): PlayerLine | null => {
		if (!has(n)) return null;
		const key = `${side}:${n}`;
		let line = players.get(key);
		if (!line) {
			line = {
				team: side,
				number: n,
				comp: 0,
				att: 0,
				passYds: 0,
				passTd: 0,
				thrownInt: 0,
				car: 0,
				rushYds: 0,
				rushTd: 0,
				rushLong: null,
				rec: 0,
				recYds: 0,
				recTd: 0,
				recLong: null,
				tkl: 0,
				sack: 0,
				defInt: 0,
				fgm: 0,
				fga: 0,
				fgLong: null,
				xpm: 0,
				xpa: 0,
			};
			players.set(key, line);
		}
		return line;
	};

	// Time of possession: the clock that runs between two consecutive plays in
	// the same period belongs to whoever held the ball after the first.
	let holder: Side | null = null;
	let lastClock: { period: string; seconds: number } | null = null;

	for (const row of ordered) {
		const d = playData(row);
		if (!d) continue;
		const team = isSide(row.team) ? row.team : null;

		const seconds = clockSeconds(row.clock);
		if (seconds !== null) {
			if (lastClock && lastClock.period === row.period && holder && lastClock.seconds >= seconds) {
				teams[holder].possession += lastClock.seconds - seconds;
			}
			lastClock = { period: row.period, seconds };
		}
		holder = holderAfter(d, team, holder);

		if (!team) continue;
		const off = teams[team];
		const scoredTd = touchdownSide(d, team) === team;
		const defenseLine = (role: Role) => player(roleSide(d, role, team), d[role] as number | null | undefined);

		if (isScrimmage(d.type) && (d.down === 3 || d.down === 4)) {
			const converted = Boolean(d.first_down) || (scoredTd && d.type !== "interception");
			if (d.down === 3) {
				off.thirdAtt++;
				if (converted) off.thirdConv++;
			} else {
				off.fourthAtt++;
				if (converted) off.fourthConv++;
			}
		}
		if (d.first_down && d.type !== "punt" && d.type !== "kickoff") off.firstDowns++;
		if (d.turnover || d.type === "interception") teams[d.type === "punt" || d.type === "kickoff" ? other(team) : team].turnovers++;

		const tackled = !d.touchdown && !d.touchback && has(d.tackler);

		switch (d.type) {
			case "rush":
			case "kneel":
			case "sack": {
				const y = num(d.yards);
				off.rushYds += y;
				const p = player(team, d.carrier);
				if (p) {
					p.car++;
					p.rushYds += y;
					p.rushLong = maxOf(p.rushLong, y);
					if (scoredTd) p.rushTd++;
				}
				if (d.type === "sack") {
					const s = defenseLine("tackler");
					if (s) {
						s.sack++;
						s.tkl++;
					}
				} else if (tackled) {
					const t = defenseLine("tackler");
					if (t) t.tkl++;
				}
				break;
			}
			case "pass": {
				const qb = player(team, d.passer);
				if (qb) qb.att++;
				if (!d.complete) break;
				const y = num(d.yards);
				off.passYds += y;
				if (qb) {
					qb.comp++;
					qb.passYds += y;
					if (scoredTd) qb.passTd++;
				}
				const r = player(team, d.receiver);
				if (r) {
					r.rec++;
					r.recYds += y;
					r.recLong = maxOf(r.recLong, y);
					if (scoredTd) r.recTd++;
				}
				if (tackled) {
					const t = defenseLine("tackler");
					if (t) t.tkl++;
				}
				break;
			}
			case "interception": {
				const qb = player(team, d.passer);
				if (qb) {
					qb.att++;
					qb.thrownInt++;
				}
				const i = defenseLine("interceptor");
				if (i) i.defInt++;
				if (tackled) {
					const t = defenseLine("tackler");
					if (t) t.tkl++;
				}
				break;
			}
			case "punt":
			case "kickoff":
				if (tackled && !d.turnover) {
					const t = defenseLine("tackler");
					if (t) t.tkl++;
				}
				break;
			case "field_goal": {
				const k = player(team, d.kicker);
				if (k) {
					k.fga++;
					if (d.good) {
						k.fgm++;
						if (has(d.yards)) k.fgLong = maxOf(k.fgLong, d.yards);
					}
				}
				break;
			}
			case "extra_point": {
				const k = player(team, d.kicker);
				if (k) {
					k.xpa++;
					if (d.good) k.xpm++;
				}
				break;
			}
			case "penalty": {
				const on = teams[d.penalty_on ?? team];
				on.penalties++;
				on.penaltyYds += Math.abs(num(d.yards));
				break;
			}
		}
	}

	const both = (f: (t: TeamLine) => string): Pick<TeamStat, "phs" | "opponent"> => ({ phs: f(teams.phs), opponent: f(teams.opponent) });
	const team_stats: TeamStat[] = [
		{ label: "Total yards", ...both(t => String(t.passYds + t.rushYds)) },
		{ label: "Passing yards", ...both(t => String(t.passYds)) },
		{ label: "Rushing yards", ...both(t => String(t.rushYds)) },
		{ label: "First downs", ...both(t => String(t.firstDowns)) },
		{ label: "Third down", ...both(t => `${t.thirdConv}/${t.thirdAtt}`) },
		{ label: "Fourth down", ...both(t => `${t.fourthConv}/${t.fourthAtt}`) },
		{ label: "Turnovers", ...both(t => String(t.turnovers)) },
		{ label: "Penalties-yards", ...both(t => `${t.penalties}-${t.penaltyYds}`) },
	];
	// No clock entered, no possession line: 0:00 for both reads as a fact.
	if (teams.phs.possession + teams.opponent.possession > 0) {
		team_stats.push({ label: "Possession", ...both(t => formatDuration(t.possession)) });
	}

	const lines = [...players.values()];
	const name = (p: PlayerLine) => rosterName(roster, p.team, p.number);
	const table = (
		title: string,
		columns: string[],
		include: (p: PlayerLine) => boolean,
		rank: (p: PlayerLine) => number,
		values: (p: PlayerLine) => Array<string | number>
	): StatTable => ({
		title,
		columns,
		rows: lines
			.filter(include)
			// PHS first, then the opponent; within a team the leader first, and
			// the jersey number breaks ties so the order is stable.
			.sort((a, b) => (a.team === b.team ? rank(b) - rank(a) || a.number - b.number : a.team === "phs" ? -1 : 1))
			.map(p => ({ team: p.team, number: p.number, name: name(p), values: values(p).map(String) })),
	});
	const long = (v: number | null) => (v === null ? "0" : String(v));

	const player_stats: StatTable[] = [
		table(
			"Passing",
			["C/ATT", "YDS", "TD", "INT"],
			p => p.att > 0,
			p => p.passYds,
			p => [`${p.comp}/${p.att}`, p.passYds, p.passTd, p.thrownInt]
		),
		table(
			"Rushing",
			["CAR", "YDS", "TD", "LONG"],
			p => p.car > 0,
			p => p.rushYds,
			p => [p.car, p.rushYds, p.rushTd, long(p.rushLong)]
		),
		table(
			"Receiving",
			["REC", "YDS", "TD", "LONG"],
			p => p.rec > 0,
			p => p.recYds,
			p => [p.rec, p.recYds, p.recTd, long(p.recLong)]
		),
		table(
			"Defense",
			["TKL", "SACK", "INT"],
			p => p.tkl + p.sack + p.defInt > 0,
			p => p.tkl * 100 + p.sack * 10 + p.defInt,
			p => [p.tkl, p.sack, p.defInt]
		),
		table(
			"Kicking",
			["FG", "XP", "LONG"],
			p => p.fga + p.xpa > 0,
			p => p.fgm * 100 + p.xpm,
			p => [`${p.fgm}/${p.fga}`, `${p.xpm}/${p.xpa}`, long(p.fgLong)]
		),
	];

	return { team_stats, player_stats };
}

// ─── Rosters ────────────────────────────────────────────────────────────────

/** Positions recognised at the end of a pasted line. A last word that is not
 *  one of these is kept as part of the name rather than guessed at. */
const POSITIONS = new Set(
	"QB RB HB FB TB WR TE SE FL OL OT OG C G T LT RT LG RG DL DE DT NT LB ILB OLB MLB WLB SLB DB CB S FS SS SAF K P PK LS KR PR H ATH EDGE".split(" ")
);

function isPosition(token: string): boolean {
	const parts = token.toUpperCase().split("/");
	return parts.length > 0 && parts.every(p => POSITIONS.has(p));
}

/**
 * Pasted lines → roster entries. Accepts "12 J. Smith QB", "#12 J. Smith",
 * "12, J. Smith, QB", "12\tJ. Smith\tQB" and "12 - J. Smith - QB".
 * Names are kept exactly as typed: they go in as they should print.
 */
export function parseRosterLines(text: string, team: Side): { entries: RosterEntry[]; errors: string[] } {
	const byNumber = new Map<number, RosterEntry>();
	const errors: string[] = [];
	for (const raw of (text ?? "").split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const m = /^#?\s*(\d{1,3})\s*[,\t.:\-–]?\s*(.+)$/.exec(line);
		if (!m) {
			errors.push(`“${line}”: no jersey number at the start`);
			continue;
		}
		const number = Number(m[1]);
		if (number > 99) {
			errors.push(`“${line}”: ${number} is not a jersey number`);
			continue;
		}
		let rest = m[2].trim();
		let position = "";
		const cells = rest
			.split(/\t|,|\s+[-–]\s+/)
			.map(c => c.trim())
			.filter(Boolean);
		if (cells.length >= 2) {
			rest = cells[0];
			position = cells.slice(1).join(" ").toUpperCase();
		} else {
			const words = rest.split(/\s+/);
			if (words.length >= 2 && isPosition(words[words.length - 1])) {
				position = words.pop()!.toUpperCase();
				rest = words.join(" ");
			}
		}
		if (!rest) {
			errors.push(`“${line}”: no name`);
			continue;
		}
		byNumber.set(number, { team, number, name: rest, position });
	}
	return { entries: [...byNumber.values()].sort((a, b) => a.number - b.number), errors };
}

/** Numbers recently named in a role, newest first, for one-tap picks. */
export function recentNumbers(plays: Array<Pick<PlayRow, "id" | "team" | "data">>, role: Role, side: Side, limit = 4): number[] {
	const out: number[] = [];
	for (const row of [...plays].sort((a, b) => b.id - a.id)) {
		const d = playData(row);
		if (!d || !isSide(row.team)) continue;
		const n = d[role];
		if (!has(n) || roleSide(d, role, row.team) !== side || out.includes(n)) continue;
		out.push(n);
		if (out.length >= limit) break;
	}
	return out;
}

/** Whether the Gamecast switch is offered for a sport. */
export function gamecastAvailable(sport: string): boolean {
	return /football/i.test(sport ?? "");
}
