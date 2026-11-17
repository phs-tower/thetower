/** @format */

// Shared state for a collaborative crossword room, kept apart from the React
// so it can be unit tested.
//
// Two people edit the same grid at once, over a link, with no lock and no
// server-side merge. Every value therefore carries the time it was set and who
// set it, and merging two versions means taking the newer value field by
// field: a last-write-wins map, which converges no matter what order updates
// arrive in or how many are lost. That one rule covers both jobs:
//
//   * a realtime message is a PARTIAL doc, merged into the local one
//   * a save is a FULL doc, merged with whatever the row already holds
//
// so a dropped message costs nothing (the next save carries the value anyway)
// and two simultaneous saves cannot erase each other's squares.
//
// Timestamps come from each editor's own clock, so a badly wrong clock on one
// machine makes that person's edits win or lose consistently. Ties break on
// the author id, so every peer resolves a tie the same way.

// This module deliberately imports nothing: `npm test` runs it through node's
// type stripping, which cannot resolve the "~/" alias. The size bounds below
// mirror crossword-grid's, and crossword-room.test.ts imports both files and
// fails if the two ever drift apart.
const MIN_SIZE = 2;
const MAX_SIZE = 25;

/** Same shape as crossword-grid's Grid. */
export type Grid = string[][];

export interface Stamp<T> {
	/** The value. */
	v: T;
	/** Milliseconds since the epoch, from the clock of whoever set it. */
	t: number;
	/** Author id, used only to break a tie on `t`. */
	by: string;
}

export interface RoomSize {
	rows: number;
	cols: number;
}

export type MetaField = "date" | "title" | "author";

export interface RoomDoc {
	size: Stamp<RoomSize>;
	/** Keyed "row,col". Values are "" (blank white), BLACK, or a single letter. */
	cells: Record<string, Stamp<string>>;
	/** Keyed by crossword-grid's clueKey(). */
	clues: Record<string, Stamp<string>>;
	meta: Record<MetaField, Stamp<string>>;
}

/** A partial doc: what one edit broadcasts. */
export type RoomPatch = Partial<Omit<RoomDoc, "meta">> & { meta?: Partial<RoomDoc["meta"]> };

export const cellKey = (r: number, c: number) => `${r},${c}`;

const stamp = <T>(v: T, by: string, now: number): Stamp<T> => ({ v, t: now, by });

export function clampSize(size: RoomSize): RoomSize {
	const fix = (n: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n) || MIN_SIZE));
	return { rows: fix(size.rows), cols: fix(size.cols) };
}

export function emptyDoc(by: string, now: number, size: RoomSize = { rows: 5, cols: 5 }): RoomDoc {
	return {
		size: stamp(clampSize(size), by, now),
		cells: {},
		clues: {},
		meta: {
			date: stamp(new Date(now).toISOString().slice(0, 10), by, now),
			title: stamp("", by, now),
			author: stamp("", by, now),
		},
	};
}

/** Later wins; an equal timestamp is broken on the author id so that every
 *  peer, merging in whatever order, lands on the same value. */
export function pickStamp<T>(a: Stamp<T> | undefined, b: Stamp<T> | undefined): Stamp<T> | undefined {
	if (!a) return b;
	if (!b) return a;
	if (b.t > a.t) return b;
	if (a.t > b.t) return a;
	return b.by > a.by ? b : a;
}

function mergeMap(a: Record<string, Stamp<string>> = {}, b: Record<string, Stamp<string>> = {}) {
	const out: Record<string, Stamp<string>> = { ...a };
	for (const key of Object.keys(b)) {
		const winner = pickStamp(a[key], b[key]);
		if (winner) out[key] = winner;
	}
	return out;
}

/** Merge `patch` into `base`. Used for both realtime messages and saves. */
export function mergeDoc(base: RoomDoc, patch: RoomPatch): RoomDoc {
	const meta = { ...base.meta };
	for (const field of ["date", "title", "author"] as MetaField[]) {
		const winner = pickStamp(base.meta[field], patch.meta?.[field]);
		if (winner) meta[field] = winner;
	}
	return {
		size: pickStamp(base.size, patch.size) ?? base.size,
		cells: mergeMap(base.cells, patch.cells),
		clues: mergeMap(base.clues, patch.clues),
		meta,
	};
}

// ─── reading the doc ─────────────────────────────────────────────────────────

/** Cells outside the current size are kept rather than dropped, so shrinking
 *  the grid and growing it again brings the letters back. */
export function gridFromDoc(doc: RoomDoc): Grid {
	const { rows, cols } = clampSize(doc.size.v);
	return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => doc.cells[cellKey(r, c)]?.v ?? ""));
}

export function cluesFromDoc(doc: RoomDoc): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of Object.keys(doc.clues)) out[key] = doc.clues[key].v;
	return out;
}

export function metaFromDoc(doc: RoomDoc) {
	return { date: doc.meta.date.v, title: doc.meta.title.v, author: doc.meta.author.v };
}

// ─── writing to the doc ──────────────────────────────────────────────────────
//
// Every edit returns the patch it made as well as the new doc. The caller
// applies the doc locally and sends the patch to the other editors.

export interface Edit {
	doc: RoomDoc;
	patch: RoomPatch;
}

export function setCells(doc: RoomDoc, cells: { r: number; c: number; v: string }[], by: string, now: number): Edit {
	const patch: RoomPatch = { cells: {} };
	for (const { r, c, v } of cells) patch.cells![cellKey(r, c)] = stamp(v, by, now);
	return { doc: mergeDoc(doc, patch), patch };
}

export function setCell(doc: RoomDoc, r: number, c: number, v: string, by: string, now: number): Edit {
	return setCells(doc, [{ r, c, v }], by, now);
}

export function setClue(doc: RoomDoc, key: string, text: string, by: string, now: number): Edit {
	const patch: RoomPatch = { clues: { [key]: stamp(text, by, now) } };
	return { doc: mergeDoc(doc, patch), patch };
}

export function setMeta(doc: RoomDoc, field: MetaField, value: string, by: string, now: number): Edit {
	const patch: RoomPatch = { meta: { [field]: stamp(value, by, now) } };
	return { doc: mergeDoc(doc, patch), patch };
}

export function setSize(doc: RoomDoc, size: RoomSize, by: string, now: number): Edit {
	const patch: RoomPatch = { size: stamp(clampSize(size), by, now) };
	return { doc: mergeDoc(doc, patch), patch };
}

/** Clear every square inside the current size. The cells are set to "" rather
 *  than deleted, because a deletion cannot win a last-write-wins merge. */
export function clearGrid(doc: RoomDoc, by: string, now: number): Edit {
	const { rows, cols } = clampSize(doc.size.v);
	const cells: { r: number; c: number; v: string }[] = [];
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c, v: "" });
	return setCells(doc, cells, by, now);
}

// ─── seeding a room from the builder ─────────────────────────────────────────

export function docFromBuilder(
	input: { grid: Grid; clues: Record<string, string>; meta: { date: string; title: string; author: string } },
	by: string,
	now: number
): RoomDoc {
	const rows = input.grid.length;
	const cols = input.grid[0]?.length ?? 0;
	const doc = emptyDoc(by, now, { rows, cols });
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const v = input.grid[r][c] ?? "";
			if (v) doc.cells[cellKey(r, c)] = stamp(v, by, now);
		}
	}
	for (const key of Object.keys(input.clues)) {
		if (input.clues[key]) doc.clues[key] = stamp(input.clues[key], by, now);
	}
	doc.meta.date = stamp(input.meta.date, by, now);
	doc.meta.title = stamp(input.meta.title, by, now);
	doc.meta.author = stamp(input.meta.author, by, now);
	return doc;
}

// ─── reading a doc back off the wire ─────────────────────────────────────────

const isStamp = (x: unknown): x is Stamp<unknown> =>
	!!x && typeof x === "object" && "v" in (x as object) && typeof (x as Stamp<unknown>).t === "number";

function readStampMap(raw: unknown): Record<string, Stamp<string>> {
	const out: Record<string, Stamp<string>> = {};
	if (!raw || typeof raw !== "object") return out;
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (isStamp(value) && typeof value.v === "string") out[key] = { v: value.v, t: value.t, by: String((value as Stamp<string>).by ?? "") };
	}
	return out;
}

/** Anything stored in or sent to a room is untrusted: it comes from another
 *  browser on a link anyone may hold. Parse it into the shape we expect and
 *  drop the rest rather than trusting it. */
export function parseDoc(raw: unknown, fallbackBy: string, now: number): RoomDoc {
	const base = emptyDoc(fallbackBy, now);
	if (!raw || typeof raw !== "object") return base;
	const input = raw as Partial<RoomDoc>;

	if (isStamp(input.size) && input.size.v && typeof input.size.v === "object") {
		const v = input.size.v as RoomSize;
		base.size = { v: clampSize({ rows: Number(v.rows), cols: Number(v.cols) }), t: input.size.t, by: String(input.size.by ?? "") };
	}
	base.cells = readStampMap(input.cells);
	base.clues = readStampMap(input.clues);
	for (const field of ["date", "title", "author"] as MetaField[]) {
		const value = input.meta?.[field];
		if (isStamp(value) && typeof value.v === "string") base.meta[field] = { v: value.v, t: value.t, by: String(value.by ?? "") };
	}
	return base;
}

export function parsePatch(raw: unknown): RoomPatch {
	if (!raw || typeof raw !== "object") return {};
	const input = raw as RoomPatch;
	const patch: RoomPatch = {};
	if (isStamp(input.size) && input.size.v && typeof input.size.v === "object") {
		const v = input.size.v as RoomSize;
		patch.size = { v: clampSize({ rows: Number(v.rows), cols: Number(v.cols) }), t: input.size.t, by: String(input.size.by ?? "") };
	}
	if (input.cells) patch.cells = readStampMap(input.cells);
	if (input.clues) patch.clues = readStampMap(input.clues);
	if (input.meta) {
		const meta: Partial<RoomDoc["meta"]> = {};
		for (const field of ["date", "title", "author"] as MetaField[]) {
			const value = input.meta[field];
			if (isStamp(value) && typeof value.v === "string") meta[field] = { v: value.v, t: value.t, by: String(value.by ?? "") };
		}
		if (Object.keys(meta).length) patch.meta = meta;
	}
	return patch;
}

// ─── odds and ends ───────────────────────────────────────────────────────────

/** A per-tab author id. Used to break merge ties and to tell presence entries
 *  apart; it is not an identity and grants nothing. */
export function newAuthorId(): string {
	const bytes = new Uint8Array(8);
	if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
	else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** Stable, readable colours for the people in a room. */
export const PEER_COLORS = ["#a8133f", "#0b6e4f", "#1f4e9c", "#8a5a00", "#6b3fa0", "#107b7b"];

export function peerColor(authorId: string): string {
	let hash = 0;
	for (let i = 0; i < authorId.length; i++) hash = (hash * 31 + authorId.charCodeAt(i)) >>> 0;
	return PEER_COLORS[hash % PEER_COLORS.length];
}

/** Exported so the test can check it against crossword-grid's bounds. */
export const SIZE_BOUNDS = { MIN_SIZE, MAX_SIZE };
