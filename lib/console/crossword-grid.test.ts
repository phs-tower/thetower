/** @format */

// Tests for the crossword builder's grid logic. Run with: npm test
//
// The property that matters most: what the builder saves must rebuild into the
// same grid, because the app reconstructs the puzzle purely from the answers
// and their row/col. Anything the round trip loses is lost in the app too.

import test from "node:test";
import assert from "node:assert/strict";
import {
	BLACK,
	buildCluesJson,
	clueKey,
	computeEntries,
	gridFromClues,
	makeGrid,
	orphanCells,
	type Grid,
} from "./crossword-grid.ts";

/** "CAT/ARE/BED" as a 3x3 grid; "#" marks a black square. */
function gridOf(...rows: string[]): Grid {
	return rows.map(row => row.split(""));
}

const OPEN_3x3 = gridOf("CAT", "ARE", "BED");

test("numbering follows reading order and only marks entry starts", () => {
	const { entries, numbers } = computeEntries(OPEN_3x3);
	// Every square in the top row and left column begins something.
	assert.equal(numbers.get("0,0"), 1);
	assert.equal(numbers.get("0,1"), 2);
	assert.equal(numbers.get("0,2"), 3);
	assert.equal(numbers.get("1,0"), 4);
	assert.equal(numbers.get("2,0"), 5);
	// A square in the middle starts nothing, so it is never numbered.
	assert.equal(numbers.get("1,1"), undefined);
	assert.equal(entries.length, 6);
});

test("entries read the letters actually in the grid", () => {
	const { entries } = computeEntries(OPEN_3x3);
	const answer = (dir: string, number: number) => entries.find(e => e.dir === dir && e.number === number)?.answer;
	assert.equal(answer("across", 1), "CAT");
	assert.equal(answer("across", 4), "ARE");
	assert.equal(answer("across", 5), "BED");
	assert.equal(answer("down", 1), "CAB");
	assert.equal(answer("down", 2), "ARE");
	assert.equal(answer("down", 3), "TED");
});

test("blank squares come back as spaces, so an unfinished grid is detectable", () => {
	const partial = gridOf("CA ", "ARE", "BED");
	const { entries } = computeEntries(partial);
	assert.equal(entries.find(e => e.dir === "across" && e.number === 1)?.answer, "CA ");
	assert.ok(partial.flat().some(cell => cell === " " || cell === ""));
});

test("black squares shorten entries and suppress starts behind them", () => {
	const grid = gridOf("CAT", "AR#", "BED");
	const { entries, numbers } = computeEntries(grid);
	const across = entries.filter(e => e.dir === "across").map(e => `${e.number}:${e.answer}`);
	const down = entries.filter(e => e.dir === "down").map(e => `${e.number}:${e.answer}`);
	assert.deepEqual(across, ["1:CAT", "3:AR", "4:BED"]);
	// The third column cannot start a down entry: the square below it is black.
	assert.deepEqual(down, ["1:CAB", "2:ARE"]);
	assert.equal(numbers.get("0,2"), undefined);
});

test("one-square words are never entries, and are reported as orphans", () => {
	const grid = gridOf("A#", "##");
	const { entries } = computeEntries(grid);
	assert.deepEqual(entries, []);
	assert.deepEqual(orphanCells(grid, entries), [{ r: 0, c: 0 }]);
});

test("a well-formed grid has no orphans", () => {
	const { entries } = computeEntries(OPEN_3x3);
	assert.deepEqual(orphanCells(OPEN_3x3, entries), []);
});

test("saved clue keys are always numeric strings", () => {
	// A non-numeric key crashes the app, so this is the guard on that.
	const { entries } = computeEntries(OPEN_3x3);
	const parsed = JSON.parse(buildCluesJson(entries, {}));
	for (const dir of ["across", "down"]) {
		const keys = Object.keys(parsed[dir]);
		assert.ok(keys.length > 0, `${dir} should have entries`);
		for (const key of keys) assert.match(key, /^\d+$/, `${dir} key ${JSON.stringify(key)} must be numeric`);
	}
});

test("saved entries carry answer, row and col in the app's shape", () => {
	const { entries } = computeEntries(OPEN_3x3);
	const parsed = JSON.parse(buildCluesJson(entries, {}));
	assert.deepEqual(parsed.across["4"], { clue: "", answer: "ARE", row: 1, col: 0 });
	assert.deepEqual(parsed.down["3"], { clue: "", answer: "TED", row: 0, col: 2 });
});

test("save then reopen rebuilds an identical grid", () => {
	const { entries } = computeEntries(OPEN_3x3);
	const rebuilt = gridFromClues(buildCluesJson(entries, {}));
	assert.deepEqual(rebuilt.grid, OPEN_3x3);
});

test("save then reopen rebuilds identical numbering, with black squares", () => {
	const grid = gridOf("CAT", "AR#", "BED");
	const { entries } = computeEntries(grid);
	const rebuilt = gridFromClues(buildCluesJson(entries, {}));
	assert.deepEqual(rebuilt.grid, grid);

	const again = computeEntries(rebuilt.grid);
	assert.deepEqual(
		again.entries.map(e => `${e.dir} ${e.number} ${e.answer}`),
		entries.map(e => `${e.dir} ${e.number} ${e.answer}`)
	);
});

test("clue text survives the round trip and stays on its own entry", () => {
	const { entries } = computeEntries(OPEN_3x3);
	const clues = {
		[clueKey("across", 0, 0)]: "Small pet",
		[clueKey("down", 0, 2)]: "Teddy, informally",
	};
	const rebuilt = gridFromClues(buildCluesJson(entries, clues));
	assert.equal(rebuilt.clues[clueKey("across", 0, 0)], "Small pet");
	assert.equal(rebuilt.clues[clueKey("down", 0, 2)], "Teddy, informally");
});

test("clues are keyed by position, so renumbering cannot reattach them", () => {
	// Blacking out a square renumbers the grid; the clue must follow its own
	// entry rather than whatever now holds that number.
	const { entries: before } = computeEntries(OPEN_3x3);
	const clues = { [clueKey("across", 2, 0)]: "Where you sleep" };
	const numberBefore = before.find(e => e.dir === "across" && e.row === 2)?.number;

	const shifted = gridOf("CAT", "A#E", "BED");
	const { entries: after } = computeEntries(shifted);
	const entryAfter = after.find(e => e.dir === "across" && e.row === 2);
	assert.notEqual(entryAfter?.number, numberBefore, "the number should have changed");

	const parsed = JSON.parse(buildCluesJson(after, clues));
	assert.equal(parsed.across[String(entryAfter?.number)].clue, "Where you sleep");
});

test("gridFromClues refuses input with no entries", () => {
	assert.throws(() => gridFromClues('{"across":{},"down":{}}'), /No across or down entries/);
});

test("gridFromClues treats uncovered squares as black", () => {
	// A single across answer in a 1x3 row: nothing else exists, so nothing else
	// is white.
	const rebuilt = gridFromClues('{"across":{"1":{"clue":"c","answer":"CAT","row":0,"col":0}},"down":{}}');
	assert.deepEqual(rebuilt.grid, [["C", "A", "T"]]);
});

test("makeGrid keeps what fits when the puzzle is resized", () => {
	const grown = makeGrid(4, 4, OPEN_3x3);
	assert.equal(grown.length, 4);
	assert.equal(grown[0].length, 4);
	assert.equal(grown[0][0], "C");
	assert.equal(grown[2][2], "D");
	assert.equal(grown[3][3], "", "new squares start empty");

	const shrunk = makeGrid(2, 2, OPEN_3x3);
	assert.deepEqual(shrunk, [
		["C", "A"],
		["A", "R"],
	]);
});

test("BLACK is the marker the rest of the console expects", () => {
	assert.equal(BLACK, "#");
});
