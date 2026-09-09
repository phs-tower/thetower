/** @format */

// Logic for the console's live-broadcast screen (public.broadcast, read by the
// app's News → Live tab), kept apart from the React so it can be unit tested.
//
// Two things in here are load-bearing and neither is obvious:
//
//   1. TIME. starts_at is a timestamptz — an instant — and the app renders it
//      as America/New_York wall time itself, deliberately, because it cannot
//      trust a phone's clock settings. An <input type="datetime-local"> hands
//      back a wall-clock string with NO zone, and new Date() would read that in
//      the EDITOR's timezone. On a laptop in Princeton that is right by luck;
//      on one left in UTC, or a student editing over break, every game is
//      silently off by hours. So the Eastern offset is computed here, from the
//      rule, and written into the ISO string. This mirrors the app's
//      lib/util/school_time.dart; if that changes, change this to match.
//
//   2. youtube_id is ELEVEN id characters, never a URL. The app interpolates
//      it into a URL it loads in a WebView with JavaScript enabled, so a stray
//      slash or query string is a way to steer that player off YouTube. The
//      database enforces the shape and the app checks it again; parseYouTubeId
//      exists so an editor can paste a link 30 seconds before kickoff and get
//      an id instead of a constraint violation.

// ─── Times ──────────────────────────────────────────────────────────────────

/** Minutes east of UTC. US Eastern is one of exactly these two. */
export const EDT_OFFSET = -240; // UTC−4, summer
export const EST_OFFSET = -300; // UTC−5, winter

/** Day-of-month of the nth Sunday of a month (month0 is 0-based). */
function nthSunday(year: number, month0: number, nth: number): number {
	const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
	const firstSunday = 1 + ((7 - firstDow) % 7);
	return firstSunday + (nth - 1) * 7;
}

/**
 * Energy Policy Act of 2005: DST runs from 2:00 local on the SECOND Sunday of
 * March to 2:00 local on the FIRST Sunday of November.
 *
 * Expressed as UTC instants, that is 07:00Z (2:00 EST) to 06:00Z (2:00 EDT).
 */
function dstWindowUtc(year: number): { start: number; end: number } {
	return {
		start: Date.UTC(year, 2, nthSunday(year, 2, 2), 7, 0, 0, 0),
		end: Date.UTC(year, 10, nthSunday(year, 10, 1), 6, 0, 0, 0),
	};
}

/** The same window read as Eastern WALL CLOCK, for going the other direction. */
function dstWindowWall(year: number): { start: number; end: number } {
	return {
		start: Date.UTC(year, 2, nthSunday(year, 2, 2), 2, 0, 0, 0),
		end: Date.UTC(year, 10, nthSunday(year, 10, 1), 2, 0, 0, 0),
	};
}

/** Eastern offset for an instant (epoch ms). */
export function easternOffsetForInstant(ms: number): number {
	// The UTC year is safe here: the boundaries are in March and November, so
	// no instant is ever pushed across one by the 5-hour difference in year.
	const { start, end } = dstWindowUtc(new Date(ms).getUTCFullYear());
	return ms >= start && ms < end ? EDT_OFFSET : EST_OFFSET;
}

/**
 * Eastern offset for a wall-clock reading, which is what a datetime-local
 * input gives us.
 *
 * Two hours a year are not a function: 2:00–2:59 on the March Sunday never
 * happens, and 1:00–1:59 on the November Sunday happens twice. We resolve both
 * by reading the rule literally — the March gap lands on EDT, the November
 * repeat on its first (EDT) pass. A kickoff is never scheduled in either hour,
 * and being deterministic matters more than being clever.
 */
export function easternOffsetForWallClock(year: number, month0: number, day: number, hour: number, minute: number): number {
	const wall = Date.UTC(year, month0, day, hour, minute, 0, 0);
	const { start, end } = dstWindowWall(year);
	return wall >= start && wall < end ? EDT_OFFSET : EST_OFFSET;
}

/** "+HH:MM" / "-HH:MM" for an offset in minutes. */
function offsetSuffix(minutes: number): string {
	const sign = minutes <= 0 ? "-" : "+";
	const abs = Math.abs(minutes);
	return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** The shape an <input type="datetime-local"> speaks: "2026-09-18T18:30". */
const FORM_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

/**
 * datetime-local value (read as EASTERN wall time) → a zoned ISO instant, the
 * string handed to Postgres. Never let new Date() see the bare form value.
 */
export function formToIso(value: string): string | null {
	const m = FORM_RE.exec((value ?? "").trim());
	if (!m) return null;
	const year = Number(m[1]);
	const month = Number(m[2]);
	const day = Number(m[3]);
	const hour = Number(m[4]);
	const minute = Number(m[5]);
	if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
	const offset = easternOffsetForWallClock(year, month - 1, day, hour, minute);
	return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offsetSuffix(offset)}`;
}

/** Eastern wall-clock parts of an instant. */
export interface EasternParts {
	year: number;
	month0: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	/** 0 = Sunday. */
	weekday: number;
	offset: number;
}

export function easternParts(instant: string | number | Date): EasternParts | null {
	const ms = instant instanceof Date ? instant.getTime() : typeof instant === "number" ? instant : Date.parse(instant);
	if (!Number.isFinite(ms)) return null;
	const offset = easternOffsetForInstant(ms);
	// Shift the instant by the offset, then read it with the UTC getters: that
	// is the Eastern wall clock, with the host timezone never consulted.
	const shifted = new Date(ms + offset * 60000);
	return {
		year: shifted.getUTCFullYear(),
		month0: shifted.getUTCMonth(),
		day: shifted.getUTCDate(),
		hour: shifted.getUTCHours(),
		minute: shifted.getUTCMinutes(),
		second: shifted.getUTCSeconds(),
		weekday: shifted.getUTCDay(),
		offset,
	};
}

/** Instant → the datetime-local value an editor edits. Inverse of formToIso. */
export function isoToForm(instant: string | number | Date): string {
	const p = easternParts(instant);
	if (!p) return "";
	return `${pad(p.year, 4)}-${pad(p.month0 + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** An instant, written with its Eastern offset so the string reads correctly
 *  to a human looking at the database as well as to Postgres. */
export function isoFromInstant(ms: number): string {
	const p = easternParts(ms);
	if (!p) return new Date(ms).toISOString();
	return `${pad(p.year, 4)}-${pad(p.month0 + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${offsetSuffix(p.offset)}`;
}

/** Move an instant by whole minutes, keeping it an instant. A delay that
 *  crosses a DST boundary still moves by exactly the minutes asked for. */
export function shiftIso(instant: string, minutes: number): string {
	const ms = Date.parse(instant);
	if (!Number.isFinite(ms)) return instant;
	return isoFromInstant(ms + minutes * 60000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri, Sep 18" — formatted from the computed parts, not toLocaleString, so
 *  the host timezone can never leak into what an editor reads. */
export function formatEasternDate(instant: string | number | Date): string {
	const p = easternParts(instant);
	if (!p) return "—";
	return `${WEEKDAYS[p.weekday]}, ${MONTHS[p.month0]} ${p.day}`;
}

/** "6:30 PM" (no zone label — callers that show it to an editor add " ET"). */
export function formatEasternClock(instant: string | number | Date, withSeconds = false): string {
	const p = easternParts(instant);
	if (!p) return "—";
	const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
	const suffix = p.hour < 12 ? "AM" : "PM";
	const secs = withSeconds ? `:${pad(p.second)}` : "";
	return `${h12}:${pad(p.minute)}${secs} ${suffix}`;
}

/** "Fri, Sep 18 · 6:30 PM ET" — every time in the console is labelled, so an
 *  editor never has to wonder which clock they are reading. */
export function formatEasternStamp(instant: string | number | Date): string {
	const p = easternParts(instant);
	if (!p) return "—";
	return `${formatEasternDate(instant)} · ${formatEasternClock(instant)} ET`;
}

// ─── YouTube ids ────────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Hosts a video id may come from. Matched on the FULL hostname, never a
 *  substring: "youtube.com.evil.net" contains "youtube.com" and is not it. */
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"]);

/** Path prefixes that carry the id in the next segment. */
const ID_PATH_SEGMENTS = new Set(["live", "embed", "shorts", "v"]);

/**
 * A pasted link or a bare id → the eleven-character id, or null.
 *
 * Deliberately strict. Anything this does not recognise is refused rather than
 * guessed at, because the value ends up inside a URL the app loads in a
 * JavaScript-enabled WebView.
 */
export function parseYouTubeId(raw: string | null | undefined): string | null {
	const s = (raw ?? "").trim();
	if (!s) return null;
	if (ID_RE.test(s)) return s;
	// Anything else has to be a URL on a YouTube host. A bare string that is
	// not an id — 10 characters, 12 characters, one with a slash or a "?" in
	// it — fails here, because it parses to a hostname that is not on the list.
	let url: URL;
	try {
		url = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) ? s : `https://${s}`);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	if (!YOUTUBE_HOSTS.has(host)) return null;

	const segments = url.pathname.split("/").filter(Boolean);
	if (host === "youtu.be") {
		return segments.length >= 1 && ID_RE.test(segments[0]) ? segments[0] : null;
	}
	if (segments[0] === "watch") {
		const v = url.searchParams.get("v");
		// Extra params (&feature=share&t=42) are fine; only v is read.
		return v && ID_RE.test(v) ? v : null;
	}
	if (segments.length >= 2 && ID_PATH_SEGMENTS.has(segments[0])) {
		return ID_RE.test(segments[1]) ? segments[1] : null;
	}
	return null;
}

/** The still the console shows back as confirmation of a parsed id. */
export function youtubeThumbnail(id: string): string {
	return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// ─── Scores ─────────────────────────────────────────────────────────────────

export interface ScorePair {
	phs: number | null;
	opponent: number | null;
}

/**
 * The app shows no score unless BOTH halves are set, so half a score is worse
 * than none: it reads as "no score yet" while an editor watches their number
 * sit in the console. Filling the blank side with 0 is the honest reading of
 * "PHS 7" ten seconds into a game.
 */
export function normalizeScorePair(pair: ScorePair): ScorePair {
	const clamp = (n: number | null) => (n === null || !Number.isFinite(n) ? null : Math.max(0, Math.round(n)));
	const phs = clamp(pair.phs);
	const opponent = clamp(pair.opponent);
	if (phs === null && opponent === null) return { phs: null, opponent: null };
	return { phs: phs ?? 0, opponent: opponent ?? 0 };
}

/** True when normalizing would invent a 0 the editor did not type, which is
 *  the case the panel says out loud rather than doing silently. */
export function scorePairNeedsFill(pair: ScorePair): boolean {
	return (pair.phs === null) !== (pair.opponent === null);
}

// ─── Sports ─────────────────────────────────────────────────────────────────

/** The seventeen sports PHS fields, spelled the way the athletics site spells
 *  them — the console offers exactly these in a dropdown so the string the
 *  scoring rules key off is never a typo. Lacrosse is the only one that
 *  carries a gender; for everything else the gender lives in `level`. */
export const PHS_SPORTS = [
	"Baseball",
	"Basketball",
	"Cross Country",
	"Fencing",
	"Field Hockey",
	"Football",
	"Game Day Cheerleading",
	"Golf",
	"Hockey",
	"Lacrosse - Boys",
	"Lacrosse - Girls",
	"Soccer",
	"Softball",
	"Swimming",
	"Tennis",
	"Volleyball",
	"Wrestling",
];

/** Team levels, which is where the gender lives: "Boys Junior Varsity". */
export const PHS_LEVELS = [
	"Boys Varsity",
	"Boys Junior Varsity",
	"Boys Freshman",
	"Boys Middle School",
	"Girls Varsity",
	"Girls Junior Varsity",
	"Girls Freshman",
	"Girls Middle School",
	"Coed Varsity",
	"Coed Middle School",
];

export interface SportScoring {
	/** Extra one-tap buttons BEYOND the −1/+1 pair, which is always rendered.
	 *  Empty for a sport that only ever moves by one — a second +1 button next
	 *  to the first is not a feature. At most two, or the row wraps and stops
	 *  being usable one-handed. */
	steps: number[];
	/** Singular noun for the caption under each number: "goal", "run", "set".
	 *  Empty where the number is not a countable thing. */
	unit: string;
	/** Lower total wins (cross country places, golf strokes). The app prints
	 *  the two numbers with nothing saying so, and a reader takes the smaller
	 *  one for a loss — so the panel warns rather than let it go out silently. */
	lowWins: boolean;
	/** Judged out of 100, with decimals the integer column cannot hold, and not
	 *  head-to-head anyway. */
	judged: boolean;
}

/**
 * Ordered: the FIRST match wins, and the order is load-bearing.
 * "Field Hockey" contains "hockey", and PHS fields both, so field hockey has
 * to be tested first. They happen to score identically today, which is exactly
 * why that would rot unnoticed — hence the test.
 *
 * Never key on "ball": football, basketball, volleyball and softball all
 * contain it.
 */
const SPORT_RULES: Array<{ match: string[] } & SportScoring> = [
	// Increments worth a button are the ones that happen as a SINGLE event.
	{ match: ["football"], steps: [7, 3], unit: "point", lowWins: false, judged: false }, // TD+XP, field goal
	{ match: ["basketball"], steps: [2, 3], unit: "point", lowWins: false, judged: false }, // +1 is the free throw
	{ match: ["wrestling"], steps: [3, 6], unit: "team point", lowWins: false, judged: false }, // decision 3, fall 6
	{ match: ["baseball", "softball"], steps: [2, 3], unit: "run", lowWins: false, judged: false }, // two- and three-run homers

	// One at a time: −1/+1 is the whole control.
	{ match: ["volleyball"], steps: [], unit: "set", lowWins: false, judged: false }, // sets won, not points in the set
	{ match: ["fencing"], steps: [], unit: "bout", lowWins: false, judged: false }, // 27 bouts, first to 14
	{ match: ["tennis"], steps: [], unit: "point", lowWins: false, judged: false }, // dual match, first to 3 of 5
	{ match: ["field hockey"], steps: [], unit: "goal", lowWins: false, judged: false }, // MUST precede "hockey"
	{ match: ["hockey", "soccer", "lacrosse"], steps: [], unit: "goal", lowWins: false, judged: false },

	// Accumulates in 6/4/3 and 8/4 relay chunks split across both teams, so no
	// single increment exists. The editor types the running total.
	{ match: ["swimming"], steps: [], unit: "point", lowWins: false, judged: false },

	// The score pair misrepresents these; the panel says so.
	{ match: ["cross country", "golf"], steps: [], unit: "", lowWins: true, judged: false },
	{ match: ["cheer"], steps: [], unit: "", lowWins: false, judged: true },
];

const DEFAULT_SCORING: SportScoring = { steps: [], unit: "point", lowWins: false, judged: false };

/** How a sport is scored. Approximately right is fine: −1/+1 and the type-over
 *  box fix anything the buttons miss. */
export function sportScoring(sport: string): SportScoring {
	const s = (sport ?? "").trim().toLowerCase();
	if (!s) return DEFAULT_SCORING;
	for (const rule of SPORT_RULES) {
		if (rule.match.some(needle => s.includes(needle))) {
			return { steps: rule.steps, unit: rule.unit, lowWins: rule.lowWins, judged: rule.judged };
		}
	}
	return DEFAULT_SCORING;
}

/** The extra one-tap buttons for a sport. */
export function quickScoreSteps(sport: string): number[] {
	return sportScoring(sport).steps;
}

/** "GOALS" / "TEAM POINTS" — the caption under each big number, so nobody has
 *  to remember whether volleyball is counting sets or points. */
export function scoreUnitLabel(sport: string): string {
	const { unit } = sportScoring(sport);
	return unit ? `${unit}s` : "";
}

// ─── How the app prints a game ──────────────────────────────────────────────

export interface BroadcastLike {
	sport: string;
	level: string;
	opponent: string;
	home: boolean;
	starts_at: string;
}

/** "PHS vs. Hopewell Valley" at home, "PHS at Hopewell Valley" away. */
export function matchupLabel(row: Pick<BroadcastLike, "opponent" | "home">): string {
	return `PHS ${row.home ? "vs." : "at"} ${row.opponent.trim() || "—"}`;
}

/** The reader's version of the row: "PHS vs. Hopewell Valley · Varsity
 *  Football · Fri, Sep 18 · 6:30 PM". Shown in the create form so an editor
 *  sees what they are about to publish before they publish it. */
export function previewLine(row: BroadcastLike): string {
	const fixture = `${row.level.trim()} ${row.sport.trim()}`.trim();
	return [matchupLabel(row), fixture, formatEasternDate(row.starts_at), formatEasternClock(row.starts_at)].filter(Boolean).join(" · ");
}

export type BroadcastStatus = "scheduled" | "live" | "ended" | "canceled";

/** The four words the check constraint allows. Anything else is read as
 *  "scheduled" by the app rather than risk claiming a game is on the air. */
export const STATUSES: BroadcastStatus[] = ["scheduled", "live", "ended", "canceled"];

export function isStatus(value: string): value is BroadcastStatus {
	return (STATUSES as string[]).includes(value);
}

/** Which of the three groups on the game board a row belongs in. "Recent" is
 *  ended and canceled games from the last 21 days; older ones stay in the
 *  table but out of the way. */
export function boardGroup(row: { status: string; starts_at: string }, now = Date.now()): "live" | "upcoming" | "recent" | "older" {
	if (row.status === "live") return "live";
	if (row.status === "ended" || row.status === "canceled") {
		const ms = Date.parse(row.starts_at);
		return Number.isFinite(ms) && now - ms > 21 * 86400000 ? "older" : "recent";
	}
	return "upcoming";
}
