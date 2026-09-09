/** @format */

// Tests for the live-broadcast logic. Run with:
//   npm test
//
// The property that matters: a kickoff typed into the console must reach a
// reader's phone as the SAME wall-clock time, whatever timezone the editor's
// laptop is set to. The console computes the Eastern offset from the rule and
// the app converts the stored instant back with the same rule, so the two only
// agree if the round trip below holds.

import test from "node:test";
import assert from "node:assert/strict";
import {
	boardGroup,
	easternOffsetForInstant,
	easternOffsetForWallClock,
	EDT_OFFSET,
	EST_OFFSET,
	formatEasternClock,
	formatEasternDate,
	formatEasternStamp,
	formToIso,
	isoFromInstant,
	isoToForm,
	matchupLabel,
	normalizeScorePair,
	parseYouTubeId,
	PHS_LEVELS,
	PHS_SPORTS,
	previewLine,
	quickScoreSteps,
	scorePairNeedsFill,
	scoreUnitLabel,
	shiftIso,
	sportScoring,
	youtubeThumbnail,
} from "./live.ts";

/**
 * Every time assertion runs under a HOSTILE host timezone as well as the local
 * one. An Android emulator is on UTC out of the box, and a laptop left on UTC
 * is exactly the machine that silently ships a schedule shifted by hours — so
 * that case is a test, not a note in a comment.
 */
function inTimezone(tz: string, body: () => void) {
	const previous = process.env.TZ;
	process.env.TZ = tz;
	try {
		body();
	} finally {
		if (previous === undefined) delete process.env.TZ;
		else process.env.TZ = previous;
	}
}

const HOSTILE_ZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Europe/Berlin"];

function inEveryTimezone(body: () => void) {
	for (const tz of HOSTILE_ZONES) inTimezone(tz, body);
}

// ─── Round trips ────────────────────────────────────────────────────────────

test("a July kickoff round-trips through form → ISO → form, on EDT", () => {
	inEveryTimezone(() => {
		const form = "2026-07-04T18:30";
		const iso = formToIso(form);
		assert.equal(iso, "2026-07-04T18:30:00-04:00");
		assert.equal(isoToForm(iso!), form);
		assert.equal(formatEasternClock(iso!), "6:30 PM");
	});
});

test("a January kickoff round-trips through form → ISO → form, on EST", () => {
	inEveryTimezone(() => {
		const form = "2027-01-09T18:30";
		const iso = formToIso(form);
		assert.equal(iso, "2027-01-09T18:30:00-05:00");
		assert.equal(isoToForm(iso!), form);
		assert.equal(formatEasternClock(iso!), "6:30 PM");
	});
});

test("every hour of a season round-trips unchanged", () => {
	inEveryTimezone(() => {
		// One kickoff an hour for 400 days across a DST boundary in each
		// direction: any offset mistake shows up as a form value that came
		// back different from the one that went in.
		let ms = Date.parse("2026-01-01T00:00:00-05:00");
		for (let i = 0; i < 400 * 24; i++, ms += 3600000) {
			const form = isoToForm(ms);
			const iso = formToIso(form);
			assert.ok(iso, `formToIso rejected ${form}`);
			assert.equal(isoToForm(iso!), form, `round trip broke at ${form}`);
		}
	});
});

// ─── The transition weekends ────────────────────────────────────────────────

test("March 2026: DST starts 2:00 on Sunday the 8th", () => {
	inEveryTimezone(() => {
		// 1:30 AM is still EST; 3:30 AM is EDT. Both round-trip.
		assert.equal(formToIso("2026-03-08T01:30"), "2026-03-08T01:30:00-05:00");
		assert.equal(formToIso("2026-03-08T03:30"), "2026-03-08T03:30:00-04:00");
		assert.equal(isoToForm("2026-03-08T01:30:00-05:00"), "2026-03-08T01:30");
		assert.equal(isoToForm("2026-03-08T03:30:00-04:00"), "2026-03-08T03:30");

		// Saturday evening before is EST, Sunday evening after is EDT.
		assert.equal(formToIso("2026-03-07T19:00"), "2026-03-07T19:00:00-05:00");
		assert.equal(formToIso("2026-03-08T19:00"), "2026-03-08T19:00:00-04:00");

		// The boundary read as instants: 06:59:59Z is EST, 07:00:00Z is EDT.
		assert.equal(easternOffsetForInstant(Date.parse("2026-03-08T06:59:59Z")), EST_OFFSET);
		assert.equal(easternOffsetForInstant(Date.parse("2026-03-08T07:00:00Z")), EDT_OFFSET);
	});
});

test("November 2026: DST ends 2:00 on Sunday the 1st", () => {
	inEveryTimezone(() => {
		// 1:30 AM is the ambiguous hour; we take its first (EDT) pass.
		assert.equal(formToIso("2026-11-01T01:30"), "2026-11-01T01:30:00-04:00");
		assert.equal(formToIso("2026-11-01T02:30"), "2026-11-01T02:30:00-05:00");
		assert.equal(isoToForm("2026-11-01T01:30:00-04:00"), "2026-11-01T01:30");
		assert.equal(isoToForm("2026-11-01T02:30:00-05:00"), "2026-11-01T02:30");

		// Saturday evening before is EDT, Sunday evening after is EST.
		assert.equal(formToIso("2026-10-31T19:00"), "2026-10-31T19:00:00-04:00");
		assert.equal(formToIso("2026-11-01T19:00"), "2026-11-01T19:00:00-05:00");

		assert.equal(easternOffsetForInstant(Date.parse("2026-11-01T05:59:59Z")), EDT_OFFSET);
		assert.equal(easternOffsetForInstant(Date.parse("2026-11-01T06:00:00Z")), EST_OFFSET);
	});
});

test("the transition Sundays are found for a spread of years", () => {
	// second Sunday of March / first Sunday of November
	const expected: Array<[number, number, number]> = [
		[2024, 10, 3],
		[2025, 9, 2],
		[2026, 8, 1],
		[2027, 14, 7],
		[2028, 12, 5],
		[2030, 10, 3],
	];
	for (const [year, march, november] of expected) {
		assert.equal(easternOffsetForWallClock(year, 2, march, 1, 59), EST_OFFSET, `${year} March ${march} 01:59`);
		assert.equal(easternOffsetForWallClock(year, 2, march, 2, 0), EDT_OFFSET, `${year} March ${march} 02:00`);
		assert.equal(easternOffsetForWallClock(year, 10, november, 1, 59), EDT_OFFSET, `${year} Nov ${november} 01:59`);
		assert.equal(easternOffsetForWallClock(year, 10, november, 2, 0), EST_OFFSET, `${year} Nov ${november} 02:00`);
	}
});

test("a UTC laptop and an Eastern laptop store the same instant", () => {
	const stored: string[] = [];
	for (const tz of ["UTC", "America/New_York", "Asia/Tokyo"]) {
		inTimezone(tz, () => stored.push(formToIso("2026-09-18T18:30")!));
	}
	assert.equal(new Set(stored).size, 1, `editors in different zones stored different instants: ${stored.join(", ")}`);
	assert.equal(Date.parse(stored[0]), Date.parse("2026-09-18T22:30:00Z"));
});

// ─── Delays ─────────────────────────────────────────────────────────────────

test("delay buttons move an instant by exactly the minutes asked for", () => {
	inEveryTimezone(() => {
		const kickoff = "2026-09-18T18:30:00-04:00";
		assert.equal(isoToForm(shiftIso(kickoff, 15)), "2026-09-18T18:45");
		assert.equal(isoToForm(shiftIso(kickoff, 30)), "2026-09-18T19:00");
		assert.equal(isoToForm(shiftIso(kickoff, 60)), "2026-09-18T19:30");
		// Moving to another day is the same control.
		assert.equal(isoToForm(shiftIso(kickoff, 60 * 24)), "2026-09-19T18:30");
	});
});

test("a delay across the November boundary is still real minutes", () => {
	inEveryTimezone(() => {
		// 1:30 AM EDT + 60 real minutes is 1:30 AM EST, not 2:30.
		const shifted = shiftIso("2026-11-01T01:30:00-04:00", 60);
		assert.equal(Date.parse(shifted), Date.parse("2026-11-01T06:30:00Z"));
		assert.equal(isoToForm(shifted), "2026-11-01T01:30");
	});
});

test("isoFromInstant writes the Eastern offset, not Z", () => {
	inEveryTimezone(() => {
		assert.equal(isoFromInstant(Date.parse("2026-09-18T22:30:00Z")), "2026-09-18T18:30:00-04:00");
		assert.equal(isoFromInstant(Date.parse("2027-01-09T23:30:00Z")), "2027-01-09T18:30:00-05:00");
	});
});

// ─── Bad input ──────────────────────────────────────────────────────────────

test("formToIso refuses anything that is not a datetime-local value", () => {
	for (const bad of ["", "   ", "2026-09-18", "18:30", "2026-09-18 18:30", "next friday", "2026-13-01T18:30", "2026-09-18T25:30"]) {
		assert.equal(formToIso(bad), null, `accepted ${JSON.stringify(bad)}`);
	}
});

// ─── Display ────────────────────────────────────────────────────────────────

test("dates and clocks are formatted from Eastern parts, never the host clock", () => {
	inEveryTimezone(() => {
		const iso = "2026-09-18T18:30:00-04:00";
		assert.equal(formatEasternDate(iso), "Fri, Sep 18");
		assert.equal(formatEasternClock(iso), "6:30 PM");
		assert.equal(formatEasternStamp(iso), "Fri, Sep 18 · 6:30 PM ET");
		// Midnight and noon are the two the 12-hour clock gets wrong.
		assert.equal(formatEasternClock("2026-09-18T00:05:00-04:00"), "12:05 AM");
		assert.equal(formatEasternClock("2026-09-18T12:05:00-04:00"), "12:05 PM");
		assert.equal(formatEasternClock("2026-09-18T18:42:11-04:00", true), "6:42:11 PM");
	});
});

test("the preview line reads the way the app prints the game", () => {
	inEveryTimezone(() => {
		const row = { sport: "Football", level: "Varsity", opponent: "Hopewell Valley", home: true, starts_at: "2026-09-18T18:30:00-04:00" };
		assert.equal(previewLine(row), "PHS vs. Hopewell Valley · Varsity Football · Fri, Sep 18 · 6:30 PM");
		assert.equal(previewLine({ ...row, home: false }), "PHS at Hopewell Valley · Varsity Football · Fri, Sep 18 · 6:30 PM");
		assert.equal(matchupLabel({ opponent: "Nottingham", home: true }), "PHS vs. Nottingham");
		assert.equal(matchupLabel({ opponent: "Nottingham", home: false }), "PHS at Nottingham");
	});
});

// ─── YouTube ids ────────────────────────────────────────────────────────────

test("parseYouTubeId accepts the links an editor actually pastes", () => {
	const id = "mKCieTImjvU";
	const accepted = [
		id,
		`  ${id}  `,
		`https://www.youtube.com/watch?v=${id}`,
		`http://youtube.com/watch?v=${id}`,
		`https://m.youtube.com/watch?v=${id}`,
		`www.youtube.com/watch?v=${id}`,
		`youtube.com/watch?v=${id}`,
		`https://youtu.be/${id}`,
		`https://youtu.be/${id}?t=42`,
		`https://www.youtube.com/live/${id}`,
		`https://www.youtube.com/live/${id}?feature=share`,
		`https://www.youtube.com/embed/${id}`,
		`https://www.youtube-nocookie.com/embed/${id}`,
		`https://www.youtube.com/shorts/${id}`,
		`https://www.youtube.com/watch?v=${id}&feature=share&t=42`,
		`https://www.youtube.com/watch?feature=share&v=${id}&t=42`,
	];
	for (const input of accepted) {
		assert.equal(parseYouTubeId(input), id, `rejected ${input}`);
	}
});

test("parseYouTubeId refuses anything it cannot prove is a YouTube id", () => {
	const id = "mKCieTImjvU";
	const rejected = [
		null,
		undefined,
		"",
		"   ",
		// look-alike hosts: the value is interpolated into a URL the app loads
		// in a JavaScript-enabled WebView, so a substring match would be a way
		// to steer that player off YouTube.
		`https://youtube.com.evil.net/watch?v=${id}`,
		`https://www.youtube.com.evil.net/watch?v=${id}`,
		`https://evil.net/youtube.com/watch?v=${id}`,
		`https://notyoutube.com/watch?v=${id}`,
		`javascript:alert(1)//youtube.com/watch?v=${id}`,
		// wrong length
		"mKCieTImjv",
		"mKCieTImjvUX",
		"short",
		// an id-shaped thing with structure in it
		"mKCieTImj/U",
		"mKCieTImj?U",
		"mKCieTImj U",
		"mKCieTImj.U",
		`${id}/`,
		`${id}?t=42`,
		// right host, nothing usable on it
		"https://www.youtube.com/",
		"https://www.youtube.com/watch",
		"https://www.youtube.com/watch?v=",
		"https://www.youtube.com/watch?v=tooshort",
		"https://www.youtube.com/@thetowerphs",
		"https://youtu.be/",
		"https://youtu.be/tooshort",
		// a URL is not an id, and the column would reject it anyway
		"https://vimeo.com/123456789",
	];
	for (const input of rejected) {
		assert.equal(parseYouTubeId(input as string), null, `accepted ${JSON.stringify(input)}`);
	}
});

test("every id parseYouTubeId returns satisfies the column's check constraint", () => {
	const columnCheck = /^[A-Za-z0-9_-]{11}$/;
	for (const input of ["mKCieTImjvU", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/_-aBcD01234"]) {
		const parsed = parseYouTubeId(input);
		assert.ok(parsed && columnCheck.test(parsed), `${input} produced ${parsed}`);
	}
});

test("the thumbnail URL is built from the id alone", () => {
	assert.equal(youtubeThumbnail("mKCieTImjvU"), "https://i.ytimg.com/vi/mKCieTImjvU/hqdefault.jpg");
});

// ─── Scores ─────────────────────────────────────────────────────────────────

test("a score is both halves or neither", () => {
	assert.deepEqual(normalizeScorePair({ phs: null, opponent: null }), { phs: null, opponent: null });
	assert.deepEqual(normalizeScorePair({ phs: 7, opponent: null }), { phs: 7, opponent: 0 });
	assert.deepEqual(normalizeScorePair({ phs: null, opponent: 3 }), { phs: 0, opponent: 3 });
	assert.deepEqual(normalizeScorePair({ phs: 21, opponent: 14 }), { phs: 21, opponent: 14 });
	assert.deepEqual(normalizeScorePair({ phs: 0, opponent: 0 }), { phs: 0, opponent: 0 });
});

test("scores never go below zero, which the column also refuses", () => {
	assert.deepEqual(normalizeScorePair({ phs: -1, opponent: 3 }), { phs: 0, opponent: 3 });
	assert.deepEqual(normalizeScorePair({ phs: 7.6, opponent: 3.2 }), { phs: 8, opponent: 3 });
	assert.deepEqual(normalizeScorePair({ phs: Number.NaN, opponent: 3 }), { phs: 0, opponent: 3 });
});

test("scorePairNeedsFill flags exactly the half-a-score case", () => {
	assert.equal(scorePairNeedsFill({ phs: 7, opponent: null }), true);
	assert.equal(scorePairNeedsFill({ phs: null, opponent: 7 }), true);
	assert.equal(scorePairNeedsFill({ phs: null, opponent: null }), false);
	assert.equal(scorePairNeedsFill({ phs: 0, opponent: 0 }), false);
});

test("the quick buttons match the sport", () => {
	assert.deepEqual(quickScoreSteps("Football"), [7, 3]);
	assert.deepEqual(quickScoreSteps("  boys football  "), [7, 3]);
	assert.deepEqual(quickScoreSteps("Basketball"), [2, 3]);
	assert.deepEqual(quickScoreSteps("Girls Basketball"), [2, 3]);
	assert.deepEqual(quickScoreSteps("Wrestling"), [3, 6]);
	assert.deepEqual(quickScoreSteps("Baseball"), [2, 3]);
	assert.deepEqual(quickScoreSteps("Softball"), [2, 3]);
});

test("a sport that only ever moves by one gets NO extra button", () => {
	// −1/+1 is always rendered, so a rule of [1] would put two identical +1
	// buttons side by side, the second one styled as if it did something else.
	for (const sport of ["Soccer", "Hockey", "Field Hockey", "Lacrosse - Boys", "Volleyball", "Tennis", "Fencing", "Swimming", "", "Kabaddi"]) {
		assert.deepEqual(quickScoreSteps(sport), [], `${sport || "(blank)"} should have no extra button`);
	}
});

test("Field Hockey is not Hockey", () => {
	// "Field Hockey".includes("hockey") is true, and PHS fields both, so the
	// rule order is what keeps them apart. They score the same today — which is
	// precisely why this would rot unnoticed without a test.
	assert.equal(sportScoring("Field Hockey").unit, "goal");
	assert.equal(sportScoring("Hockey").unit, "goal");
	assert.equal(sportScoring("Girls Field Hockey").unit, "goal");
});

test("every sport PHS fields resolves to a deliberate rule", () => {
	// The dropdown offers exactly these, so none of them may quietly fall
	// through to the default.
	const expected: Record<string, { steps: number[]; unit: string; lowWins?: boolean; judged?: boolean }> = {
		Baseball: { steps: [2, 3], unit: "run" },
		Basketball: { steps: [2, 3], unit: "point" },
		"Cross Country": { steps: [], unit: "", lowWins: true },
		Fencing: { steps: [], unit: "bout" },
		"Field Hockey": { steps: [], unit: "goal" },
		Football: { steps: [7, 3], unit: "point" },
		"Game Day Cheerleading": { steps: [], unit: "", judged: true },
		Golf: { steps: [], unit: "", lowWins: true },
		Hockey: { steps: [], unit: "goal" },
		"Lacrosse - Boys": { steps: [], unit: "goal" },
		"Lacrosse - Girls": { steps: [], unit: "goal" },
		Soccer: { steps: [], unit: "goal" },
		Softball: { steps: [2, 3], unit: "run" },
		Swimming: { steps: [], unit: "point" },
		Tennis: { steps: [], unit: "point" },
		Volleyball: { steps: [], unit: "set" },
		Wrestling: { steps: [3, 6], unit: "team point" },
	};
	assert.deepEqual(PHS_SPORTS.slice().sort(), Object.keys(expected).sort(), "the dropdown list and this table have drifted apart");
	for (const sport of PHS_SPORTS) {
		const want = expected[sport];
		const got = sportScoring(sport);
		assert.deepEqual(got.steps, want.steps, `${sport} steps`);
		assert.equal(got.unit, want.unit, `${sport} unit`);
		assert.equal(got.lowWins, want.lowWins ?? false, `${sport} lowWins`);
		assert.equal(got.judged, want.judged ?? false, `${sport} judged`);
	}
});

test("the sports the score pair misrepresents are flagged", () => {
	// Cross country is the sum of the top five finishers' places and golf is
	// strokes: 23 beats 36. The app prints both numbers with nothing saying so.
	for (const sport of ["Cross Country", "Golf"]) {
		assert.equal(sportScoring(sport).lowWins, true, sport);
	}
	// Judged out of 100, with decimals score_phs (integer) cannot hold.
	assert.equal(sportScoring("Game Day Cheerleading").judged, true);
	for (const sport of ["Football", "Soccer", "Volleyball", "Swimming"]) {
		assert.equal(sportScoring(sport).lowWins, false, sport);
		assert.equal(sportScoring(sport).judged, false, sport);
	}
});

test("the unit caption is what an editor is actually counting", () => {
	assert.equal(scoreUnitLabel("Soccer"), "goals");
	assert.equal(scoreUnitLabel("Volleyball"), "sets");
	assert.equal(scoreUnitLabel("Wrestling"), "team points");
	assert.equal(scoreUnitLabel("Baseball"), "runs");
	assert.equal(scoreUnitLabel("Fencing"), "bouts");
	// Nothing countable, so no caption — a warning takes its place.
	assert.equal(scoreUnitLabel("Golf"), "");
	assert.equal(scoreUnitLabel("Game Day Cheerleading"), "");
});

test("the level list carries the gender, which is why it is a dropdown too", () => {
	assert.ok(PHS_LEVELS.includes("Boys Junior Varsity"));
	assert.ok(PHS_LEVELS.includes("Coed Varsity"));
	assert.ok(PHS_LEVELS.includes("Girls Middle School"));
	// The app prints `${level} ${sport}`, so this has to read as a team name.
	assert.equal(
		previewLine({ sport: "Football", level: "Boys Varsity", opponent: "Hopewell Valley", home: true, starts_at: "2026-09-18T18:30:00-04:00" }),
		"PHS vs. Hopewell Valley · Boys Varsity Football · Fri, Sep 18 · 6:30 PM"
	);
});

// ─── The board ──────────────────────────────────────────────────────────────

test("the board puts each row where an editor expects it", () => {
	const now = Date.parse("2026-09-18T20:00:00-04:00");
	const at = (iso: string, status: string) => boardGroup({ status, starts_at: iso }, now);

	// A game is live because a person said so, never because the clock passed.
	assert.equal(at("2026-09-18T18:30:00-04:00", "live"), "live");
	assert.equal(at("2026-12-25T18:30:00-05:00", "live"), "live");
	assert.equal(at("2026-09-18T18:30:00-04:00", "scheduled"), "upcoming");
	assert.equal(at("2026-09-25T18:30:00-04:00", "scheduled"), "upcoming");

	assert.equal(at("2026-09-11T18:30:00-04:00", "ended"), "recent");
	assert.equal(at("2026-09-11T18:30:00-04:00", "canceled"), "recent");
	assert.equal(at("2026-06-01T18:30:00-04:00", "ended"), "older");
	assert.equal(at("2026-08-27T18:30:00-04:00", "ended"), "older");
});
