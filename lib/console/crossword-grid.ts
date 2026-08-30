/** @format */

// Grid logic for the console's crossword builder, kept apart from the React so
// it can be unit tested. The stored shape is a JSON STRING in crossword.clues:
//   { "across": { "1": {clue, answer, row, col}, ... }, "down": { ... } }
//
// CRITICAL app constraint: the app parses clue keys as integers, and a
// non-numeric key crashes it. Numbers here are always computed from the grid,
// never typed, so a bad key cannot be introduced by hand.

export const BLACK = "#";
export const MIN_SIZE = 2;
export const MAX_SIZE = 25;

export type Grid = string[][];
export type Dir = "across" | "down";

export interface Entry {
	number: number;
	dir: Dir;
	row: number;
	col: number;
	length: number;
	/** Current letters, with a space for any square still blank. */
	answer: string;
}

/** Clues are keyed by position, not by number, so renumbering never reattaches
 *  a clue to the wrong entry when a black square moves. */
export const clueKey = (dir: Dir, row: number, col: number) => `${dir}:${row},${col}`;

export function makeGrid(rows: number, cols: number, from?: Grid): Grid {
	return Array.from({ length: rows }, (_, r) =>
		Array.from({ length: cols }, (_, c) => (from && from[r] && from[r][c] !== undefined ? from[r][c] : ""))
	);
}

export function isBlack(grid: Grid, r: number, c: number) {
	if (r < 0 || c < 0 || r >= grid.length || c >= (grid[0]?.length ?? 0)) return true;
	return grid[r][c] === BLACK;
}

/** Standard crossword numbering: a square is numbered when it begins an across
 *  or a down entry, scanning left to right, top to bottom. Entries are at least
 *  two squares long, which is what the app (and every solver) expects. */
export function computeEntries(grid: Grid): { entries: Entry[]; numbers: Map<string, number> } {
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;
	const numbers = new Map<string, number>();
	const entries: Entry[] = [];
	let n = 0;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (isBlack(grid, r, c)) continue;
			const startsAcross = isBlack(grid, r, c - 1) && !isBlack(grid, r, c + 1);
			const startsDown = isBlack(grid, r - 1, c) && !isBlack(grid, r + 1, c);
			if (!startsAcross && !startsDown) continue;
			n++;
			numbers.set(`${r},${c}`, n);

			if (startsAcross) {
				let letters = "";
				let cc = c;
				while (!isBlack(grid, r, cc)) {
					letters += grid[r][cc] || " ";
					cc++;
				}
				entries.push({ number: n, dir: "across", row: r, col: c, length: cc - c, answer: letters });
			}
			if (startsDown) {
				let letters = "";
				let rr = r;
				while (!isBlack(grid, rr, c)) {
					letters += grid[rr][c] || " ";
					rr++;
				}
				entries.push({ number: n, dir: "down", row: r, col: c, length: rr - r, answer: letters });
			}
		}
	}
	return { entries, numbers };
}

/** White squares that belong to no entry. The app rebuilds its grid purely from
 *  the answers, so a square like this would simply vanish from the puzzle. */
export function orphanCells(grid: Grid, entries: Entry[]): { r: number; c: number }[] {
	const covered = new Set<string>();
	for (const e of entries) {
		for (let i = 0; i < e.length; i++) {
			const r = e.dir === "across" ? e.row : e.row + i;
			const c = e.dir === "across" ? e.col + i : e.col;
			covered.add(`${r},${c}`);
		}
	}
	const out: { r: number; c: number }[] = [];
	for (let r = 0; r < grid.length; r++) {
		for (let c = 0; c < (grid[0]?.length ?? 0); c++) {
			if (!isBlack(grid, r, c) && !covered.has(`${r},${c}`)) out.push({ r, c });
		}
	}
	return out;
}

/** Rebuild a grid from stored clues. Everything not covered by an answer
 *  becomes a black square, which is exactly how the app reads the data back. */
export function gridFromClues(cluesJson: string): { grid: Grid; clues: Record<string, string> } {
	const parsed = JSON.parse(cluesJson);
	const placed: { dir: Dir; row: number; col: number; answer: string; clue: string }[] = [];
	let maxRow = 0;
	let maxCol = 0;

	for (const dir of ["across", "down"] as const) {
		const map = parsed?.[dir] ?? {};
		for (const number of Object.keys(map)) {
			const raw = map[number] ?? {};
			const answer = String(raw.answer ?? "").toUpperCase();
			const row = Number(raw.row ?? 0);
			const col = Number(raw.col ?? 0);
			if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || !answer) continue;
			placed.push({ dir, row, col, answer, clue: String(raw.clue ?? "") });
			maxRow = Math.max(maxRow, dir === "across" ? row : row + answer.length - 1);
			maxCol = Math.max(maxCol, dir === "across" ? col + answer.length - 1 : col);
		}
	}
	if (!placed.length) throw new Error("No across or down entries in the stored clues.");
	if (maxRow >= MAX_SIZE || maxCol >= MAX_SIZE) {
		throw new Error(`Stored grid is ${maxRow + 1}x${maxCol + 1}, larger than the builder supports.`);
	}

	const grid: Grid = Array.from({ length: maxRow + 1 }, () => Array.from({ length: maxCol + 1 }, () => BLACK));
	const clues: Record<string, string> = {};
	for (const p of placed) {
		clues[clueKey(p.dir, p.row, p.col)] = p.clue;
		for (let i = 0; i < p.answer.length; i++) {
			const r = p.dir === "across" ? p.row : p.row + i;
			const c = p.dir === "across" ? p.col + i : p.col;
			if (grid[r] && grid[r][c] !== undefined) grid[r][c] = p.answer[i];
		}
	}
	return { grid, clues };
}

export function buildCluesJson(entries: Entry[], clues: Record<string, string>): string {
	const result: Record<string, Record<string, { clue: string; answer: string; row: number; col: number }>> = { across: {}, down: {} };
	for (const e of entries) {
		result[e.dir][String(e.number)] = {
			clue: (clues[clueKey(e.dir, e.row, e.col)] ?? "").trim(),
			answer: e.answer.toUpperCase(),
			row: e.row,
			col: e.col,
		};
	}
	return JSON.stringify(result, null, 2);
}
