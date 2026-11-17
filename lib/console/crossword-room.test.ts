/** @format */

// Tests for the collaborative crossword room. Run with: npm test
//
// The property that matters most is convergence: two editors who make edits
// without seeing each other's must end up with the same grid once each has
// seen the other's work, whatever order the messages arrive in and however
// many are lost. Everything else in the room is built on that.

import test from "node:test";
import assert from "node:assert/strict";
import { MAX_SIZE, MIN_SIZE } from "./crossword-grid.ts";
import {
	cellKey,
	clampSize,
	clearGrid,
	cluesFromDoc,
	docFromBuilder,
	emptyDoc,
	gridFromDoc,
	mergeDoc,
	metaFromDoc,
	parseDoc,
	parsePatch,
	peerColor,
	pickStamp,
	setCell,
	setClue,
	setMeta,
	setSize,
	SIZE_BOUNDS,
	type RoomDoc,
	type RoomPatch,
} from "./crossword-room.ts";

const ALICE = "aaaa";
const BOB = "bbbb";
const T0 = 1_700_000_000_000;

const fresh = () => emptyDoc(ALICE, T0, { rows: 3, cols: 3 });

test("the size bounds stay in step with crossword-grid", () => {
	// crossword-room cannot import crossword-grid (see the note at its top), so
	// this is what stops the two copies drifting.
	assert.equal(SIZE_BOUNDS.MIN_SIZE, MIN_SIZE);
	assert.equal(SIZE_BOUNDS.MAX_SIZE, MAX_SIZE);
});

test("an empty doc renders an empty grid of the requested size", () => {
	const grid = gridFromDoc(fresh());
	assert.equal(grid.length, 3);
	assert.equal(grid[0].length, 3);
	assert.deepEqual(grid.flat(), ["", "", "", "", "", "", "", "", ""]);
});

test("a later edit beats an earlier one", () => {
	const a = { v: "A", t: T0, by: ALICE };
	const b = { v: "B", t: T0 + 1, by: BOB };
	assert.equal(pickStamp(a, b)?.v, "B");
	assert.equal(pickStamp(b, a)?.v, "B");
});

test("a tie breaks on the author id, the same way for everyone", () => {
	const a = { v: "A", t: T0, by: ALICE };
	const b = { v: "B", t: T0, by: BOB };
	// Whichever side it is merged from, the answer is identical.
	assert.equal(pickStamp(a, b)?.v, "B");
	assert.equal(pickStamp(b, a)?.v, "B");
});

test("concurrent edits to different squares both survive", () => {
	const base = fresh();
	const alice = setCell(base, 0, 0, "C", ALICE, T0 + 10);
	const bob = setCell(base, 2, 2, "T", BOB, T0 + 11);

	// Each applies the other's patch, in opposite orders.
	const aliceSees = mergeDoc(alice.doc, bob.patch);
	const bobSees = mergeDoc(bob.doc, alice.patch);

	assert.deepEqual(gridFromDoc(aliceSees), gridFromDoc(bobSees));
	assert.equal(gridFromDoc(aliceSees)[0][0], "C");
	assert.equal(gridFromDoc(aliceSees)[2][2], "T");
});

test("concurrent edits to the SAME square converge on one answer", () => {
	const base = fresh();
	const alice = setCell(base, 1, 1, "X", ALICE, T0 + 10);
	const bob = setCell(base, 1, 1, "Y", BOB, T0 + 20);

	const aliceSees = mergeDoc(alice.doc, bob.patch);
	const bobSees = mergeDoc(bob.doc, alice.patch);

	assert.equal(gridFromDoc(aliceSees)[1][1], "Y", "the later edit wins");
	assert.deepEqual(gridFromDoc(aliceSees), gridFromDoc(bobSees));
});

test("merging is order independent across a whole burst of edits", () => {
	const base = fresh();
	const patches: RoomPatch[] = [];
	let doc = base;
	for (const [i, letter] of ["A", "B", "C", "D", "E"].entries()) {
		const by = i % 2 === 0 ? ALICE : BOB;
		const edit = setCell(doc, Math.floor(i / 3), i % 3, letter, by, T0 + i);
		doc = edit.doc;
		patches.push(edit.patch);
	}

	// Replay the same patches into a fresh doc, backwards.
	let replayed = base;
	for (const patch of [...patches].reverse()) replayed = mergeDoc(replayed, patch);

	assert.deepEqual(gridFromDoc(replayed), gridFromDoc(doc));
});

test("a lost message costs nothing once a full doc is merged", () => {
	const base = fresh();
	const alice = setCell(base, 0, 1, "Q", ALICE, T0 + 5);
	// Bob never receives the patch, and edits from the stale base.
	const bob = setCell(base, 2, 0, "Z", BOB, T0 + 6);
	// The next save merges whole docs rather than patches.
	const merged = mergeDoc(bob.doc, alice.doc);
	assert.equal(gridFromDoc(merged)[0][1], "Q");
	assert.equal(gridFromDoc(merged)[2][0], "Z");
});

test("a black square and a letter are just values, so the same rule applies", () => {
	const base = fresh();
	const alice = setCell(base, 0, 0, "#", ALICE, T0 + 1);
	const bob = setCell(base, 0, 0, "R", BOB, T0 + 2);
	assert.equal(gridFromDoc(mergeDoc(alice.doc, bob.patch))[0][0], "R");
	assert.equal(gridFromDoc(mergeDoc(bob.doc, alice.patch))[0][0], "R");
});

test("clearing the grid beats earlier letters but loses to later ones", () => {
	let doc = setCell(fresh(), 1, 1, "K", ALICE, T0 + 1).doc;
	doc = clearGrid(doc, BOB, T0 + 2).doc;
	assert.equal(gridFromDoc(doc)[1][1], "");

	// Someone typing after the clear still wins.
	doc = mergeDoc(doc, setCell(doc, 1, 1, "M", ALICE, T0 + 3).patch);
	assert.equal(gridFromDoc(doc)[1][1], "M");
});

test("a clear is a write, not a delete, so it survives a merge with the old doc", () => {
	const typed = setCell(fresh(), 0, 0, "K", ALICE, T0 + 1).doc;
	const cleared = clearGrid(typed, BOB, T0 + 2).doc;
	// Merging the pre-clear doc back in must not resurrect the letter.
	assert.equal(gridFromDoc(mergeDoc(cleared, typed))[0][0], "");
});

test("shrinking the grid hides letters, growing it brings them back", () => {
	let doc = setCell(fresh(), 2, 2, "E", ALICE, T0 + 1).doc;
	doc = setSize(doc, { rows: 2, cols: 2 }, ALICE, T0 + 2).doc;
	assert.equal(gridFromDoc(doc).length, 2);
	assert.equal(gridFromDoc(doc)[0].length, 2);

	doc = setSize(doc, { rows: 3, cols: 3 }, BOB, T0 + 3).doc;
	assert.equal(gridFromDoc(doc)[2][2], "E", "the square outside the small grid was kept");
});

test("sizes are clamped to what the builder can draw", () => {
	assert.deepEqual(clampSize({ rows: 0, cols: 0 }), { rows: MIN_SIZE, cols: MIN_SIZE });
	assert.deepEqual(clampSize({ rows: 999, cols: 999 }), { rows: MAX_SIZE, cols: MAX_SIZE });
	assert.deepEqual(clampSize({ rows: 7.4, cols: 7.6 }), { rows: 7, cols: 8 });
	assert.deepEqual(clampSize({ rows: NaN, cols: NaN }), { rows: MIN_SIZE, cols: MIN_SIZE });
});

test("a size arriving over the wire is clamped too", () => {
	const patch = parsePatch({ size: { v: { rows: 400, cols: -3 }, t: T0, by: BOB } });
	assert.deepEqual(patch.size?.v, { rows: MAX_SIZE, cols: MIN_SIZE });
});

test("clues and meta merge by the same rule as cells", () => {
	const base = fresh();
	const alice = setClue(base, "across:0,0", "Feline", ALICE, T0 + 1);
	const bob = setClue(base, "down:0,0", "Automobile", BOB, T0 + 2);
	const merged = mergeDoc(alice.doc, bob.patch);
	assert.deepEqual(cluesFromDoc(merged), { "across:0,0": "Feline", "down:0,0": "Automobile" });

	const titled = setMeta(merged, "title", "Mini", ALICE, T0 + 3);
	const retitled = setMeta(merged, "title", "Midi", BOB, T0 + 4);
	assert.equal(metaFromDoc(mergeDoc(titled.doc, retitled.patch)).title, "Midi");
});

test("a doc seeded from the builder round trips", () => {
	const grid = [
		["C", "A", "T"],
		["A", "#", "O"],
		["B", "E", "D"],
	];
	const doc = docFromBuilder({ grid, clues: { "across:0,0": "Feline" }, meta: { date: "2026-11-16", title: "Mini", author: "Joy" } }, ALICE, T0);
	assert.deepEqual(gridFromDoc(doc), grid);
	assert.deepEqual(cluesFromDoc(doc), { "across:0,0": "Feline" });
	assert.deepEqual(metaFromDoc(doc), { date: "2026-11-16", title: "Mini", author: "Joy" });
});

test("junk from the wire is dropped rather than trusted", () => {
	const doc = parseDoc(
		{
			size: { v: { rows: 3, cols: 3 }, t: T0, by: BOB },
			cells: {
				"0,0": { v: "A", t: T0, by: BOB },
				"0,1": { v: 42, t: T0, by: BOB }, // not a string
				"0,2": "plain string", // not a stamp
				"1,0": { v: "B" }, // no timestamp
			},
			clues: null,
			meta: { title: { v: "Ok", t: T0, by: BOB }, author: 17 },
		},
		ALICE,
		T0
	);
	assert.deepEqual(Object.keys(doc.cells), ["0,0"]);
	assert.deepEqual(doc.clues, {});
	assert.equal(doc.meta.title.v, "Ok");
	assert.equal(doc.meta.author.v, "", "the junk author fell back to the empty default");
});

test("a doc parsed from nothing is still usable", () => {
	for (const junk of [null, undefined, 7, "x", []]) {
		const doc = parseDoc(junk, ALICE, T0);
		assert.equal(gridFromDoc(doc).length, 5);
		assert.deepEqual(cluesFromDoc(doc), {});
	}
});

test("an empty patch changes nothing", () => {
	const doc = setCell(fresh(), 0, 0, "A", ALICE, T0 + 1).doc;
	assert.deepEqual(mergeDoc(doc, parsePatch(null)), doc);
	assert.deepEqual(mergeDoc(doc, {}), doc);
});

test("a patch carries only what changed", () => {
	const doc = fresh();
	const { patch } = setCell(doc, 1, 2, "Z", ALICE, T0 + 1);
	assert.deepEqual(Object.keys(patch), ["cells"]);
	assert.deepEqual(Object.keys(patch.cells!), [cellKey(1, 2)]);
});

test("peer colours are stable and come from the fixed list", () => {
	const first = peerColor(ALICE);
	assert.equal(first, peerColor(ALICE));
	assert.match(first, /^#[0-9a-f]{6}$/);
});

test("merging a doc with itself is a no-op", () => {
	const doc: RoomDoc = setClue(setCell(fresh(), 0, 0, "A", ALICE, T0 + 1).doc, "across:0,0", "Letter", BOB, T0 + 2).doc;
	assert.deepEqual(mergeDoc(doc, doc), doc);
});
