/** @format */

// Round-trip tests for the ported Vanguard camera math. Run with:
//   npm run test:camera
//
// The property that matters for parity: a stop captured in the web author tool
// must replay in the Flutter reader to the exact view it was captured from —
// captureStop(cameraForStop(s)) === s.

import test from "node:test";
import assert from "node:assert/strict";
import {
	cameraForStop,
	cameraToMatrix,
	captureStop,
	cameraMoveDuration,
	invertMatrix,
	K_STOP_ROTATION_FIX,
	lerpCamera,
	overviewCamera,
	parseCameraPath,
	shortestAngle,
	transformPoint,
	validateCameraPath,
	type Size,
	type VanguardStop,
} from "./vanguard-camera.ts";

const VIEWPORT: Size = { width: 390, height: 844 }; // phone-shaped, like the reader
const IMAGE_WIDTH = 1600;

function closeTo(actual: number, expected: number, tolerance = 1e-9, label = "") {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`${label} expected ${expected}, got ${actual} (delta ${Math.abs(actual - expected)})`
	);
}

function assertStopsEqual(actual: VanguardStop, expected: VanguardStop, tolerance = 1e-9) {
	for (const key of ["cx", "cy", "hw", "hh", "rot"] as const) {
		closeTo(actual[key], expected[key], tolerance, `${key}:`);
	}
}

/**
 * captureStop always emits extents with the viewport's aspect ratio, so any
 * stop it produces round-trips exactly. Build test stops the same way the
 * editor does rather than hand-writing extents.
 */
function stopWithViewportAspect(cx: number, cy: number, scale: number, rot: number): VanguardStop {
	return captureStop(cameraToMatrix({ cx: cx * IMAGE_WIDTH, cy: cy * IMAGE_WIDTH, scale, rot }, VIEWPORT), VIEWPORT, IMAGE_WIDTH);
}

test("captureStop(cameraForStop(s)) round-trips an unrotated stop", () => {
	const stop = stopWithViewportAspect(0.5, 0.35, 0.4, K_STOP_ROTATION_FIX);
	const back = captureStop(cameraToMatrix(cameraForStop(VIEWPORT, IMAGE_WIDTH, stop), VIEWPORT), VIEWPORT, IMAGE_WIDTH);
	assertStopsEqual(back, stop);
});

test("captureStop(cameraForStop(s)) round-trips rotated stops", () => {
	for (const rot of [0.3, -0.3, 1.2, -1.2, Math.PI / 4, -Math.PI / 3]) {
		const stop = stopWithViewportAspect(0.42, 0.61, 0.55, rot);
		const back = captureStop(cameraToMatrix(cameraForStop(VIEWPORT, IMAGE_WIDTH, stop), VIEWPORT), VIEWPORT, IMAGE_WIDTH);
		assertStopsEqual(back, stop, 1e-9);
	}
});

test("a stop captured from a camera replays to that same camera", () => {
	const camera = { cx: 0.33 * IMAGE_WIDTH, cy: 0.77 * IMAGE_WIDTH, scale: 0.62, rot: 0.42 };
	const stop = captureStop(cameraToMatrix(camera, VIEWPORT), VIEWPORT, IMAGE_WIDTH);
	const replayed = cameraForStop(VIEWPORT, IMAGE_WIDTH, stop);
	closeTo(replayed.cx, camera.cx, 1e-6, "cx:");
	closeTo(replayed.cy, camera.cy, 1e-6, "cy:");
	closeTo(replayed.scale, camera.scale, 1e-9, "scale:");
	closeTo(replayed.rot, camera.rot, 1e-9, "rot:");
});

test("the quarter-turn fix cancels across a capture/replay cycle", () => {
	// A stop stored with rot = r is played back rotated by r + fix, and a stop
	// captured from a camera rotated by θ stores θ - fix. Net: no drift.
	const stop = stopWithViewportAspect(0.5, 0.5, 0.5, 0);
	const camera = cameraForStop(VIEWPORT, IMAGE_WIDTH, stop);
	closeTo(camera.rot, stop.rot + K_STOP_ROTATION_FIX, 1e-12, "playback angle:");
	const back = captureStop(cameraToMatrix(camera, VIEWPORT), VIEWPORT, IMAGE_WIDTH);
	closeTo(back.rot, stop.rot, 1e-12, "restored angle:");
});

test("hw/hh swap: the stored horizontal extent is fitted to viewport height", () => {
	// Guards trap 3 — if someone "fixes" the swap in cameraForStop this fails.
	const stop: VanguardStop = { cx: 0.5, cy: 0.5, hw: 0.1, hh: 0.2, rot: 0 };
	const camera = cameraForStop(VIEWPORT, IMAGE_WIDTH, stop);
	const expected = Math.min(VIEWPORT.width / (2 * stop.hh * IMAGE_WIDTH), VIEWPORT.height / (2 * stop.hw * IMAGE_WIDTH));
	closeTo(camera.scale, expected, 1e-12, "scale:");
});

test("normalization is by image width on BOTH axes", () => {
	// Guards trap 1: cy scales with imageWidth, never with image height.
	const camera = { cx: 100, cy: 900, scale: 0.5, rot: 0 };
	const stop = captureStop(cameraToMatrix(camera, VIEWPORT), VIEWPORT, IMAGE_WIDTH);
	closeTo(stop.cx, 100 / IMAGE_WIDTH, 1e-12, "cx:");
	closeTo(stop.cy, 900 / IMAGE_WIDTH, 1e-12, "cy:");
});

test("a stop wider than the viewport aspect is contained, not cropped", () => {
	// Contain semantics: replaying a stop whose aspect differs from the viewport
	// shows MORE than was framed, never less. Both extents must fit.
	const stop: VanguardStop = { cx: 0.5, cy: 0.5, hw: 0.05, hh: 0.4, rot: 0 };
	const camera = cameraForStop(VIEWPORT, IMAGE_WIDTH, stop);
	const visibleHalfW = VIEWPORT.width / 2 / camera.scale / IMAGE_WIDTH;
	const visibleHalfH = VIEWPORT.height / 2 / camera.scale / IMAGE_WIDTH;
	assert.ok(visibleHalfW >= stop.hh - 1e-12, "stored hh must fit the viewport width");
	assert.ok(visibleHalfH >= stop.hw - 1e-12, "stored hw must fit the viewport height");
});

test("the camera matrix puts the camera centre at the viewport centre", () => {
	const camera = { cx: 640, cy: 1200, scale: 0.3, rot: 0.9 };
	const m = cameraToMatrix(camera, VIEWPORT);
	const centre = transformPoint(m, camera.cx, camera.cy);
	closeTo(centre.x, VIEWPORT.width / 2, 1e-9, "x:");
	closeTo(centre.y, VIEWPORT.height / 2, 1e-9, "y:");
});

test("invertMatrix undoes cameraToMatrix", () => {
	const m = cameraToMatrix({ cx: 300, cy: 800, scale: 0.44, rot: -0.7 }, VIEWPORT);
	const inv = invertMatrix(m);
	const p = transformPoint(inv, transformPoint(m, 123, 456).x, transformPoint(m, 123, 456).y);
	closeTo(p.x, 123, 1e-9, "x:");
	closeTo(p.y, 456, 1e-9, "y:");
});

test("overviewCamera contains the whole page", () => {
	const image = { width: IMAGE_WIDTH, height: 2400 };
	const camera = overviewCamera(VIEWPORT, image);
	assert.ok(image.width * camera.scale <= VIEWPORT.width + 1e-9);
	assert.ok(image.height * camera.scale <= VIEWPORT.height + 1e-9);
	closeTo(camera.rot, 0, 1e-12, "rot:");
});

test("shortestAngle takes the short way round", () => {
	closeTo(shortestAngle(0, Math.PI / 2), Math.PI / 2, 1e-12);
	closeTo(shortestAngle(0, (3 * Math.PI) / 2), -Math.PI / 2, 1e-12);
	closeTo(shortestAngle(-Math.PI + 0.1, Math.PI - 0.1), -0.2, 1e-12);
});

test("lerpCamera hits both endpoints and zooms geometrically", () => {
	const a = { cx: 0, cy: 0, scale: 0.25, rot: 0 };
	const b = { cx: 100, cy: 200, scale: 1, rot: 1 };
	assertNearCamera(lerpCamera(a, b, 0), a);
	assertNearCamera(lerpCamera(a, b, 1), b);
	closeTo(lerpCamera(a, b, 0.5).scale, Math.sqrt(a.scale * b.scale), 1e-12, "geometric midpoint:");

	function assertNearCamera(actual: typeof a, expected: typeof a) {
		for (const key of ["cx", "cy", "scale", "rot"] as const) closeTo(actual[key], expected[key], 1e-9, `${key}:`);
	}
});

test("cameraMoveDuration stays within its clamp", () => {
	const still = { cx: 0, cy: 0, scale: 1, rot: 0 };
	assert.equal(cameraMoveDuration(still, still), 450);
	const far = { cx: 100000, cy: 100000, scale: 40, rot: Math.PI };
	const ms = cameraMoveDuration(still, far);
	assert.ok(ms >= 450 && ms <= 1100, `expected 450..1100, got ${ms}`);
});

test("parseCameraPath accepts bare lists and {stops:[...]} wrappers", () => {
	const parsed = parseCameraPath([
		[{ cx: 0.1, cy: 0.2, hw: 0.3, hh: 0.4, rot: 0.5 }],
		{ stops: [{ cx: 1, cy: 2, hw: 3, hh: 4, rot: 5 }] },
		[],
	]);
	assert.equal(parsed.length, 3);
	assertStopsEqual(parsed[0][0], { cx: 0.1, cy: 0.2, hw: 0.3, hh: 0.4, rot: 0.5 });
	assertStopsEqual(parsed[1][0], { cx: 1, cy: 2, hw: 3, hh: 4, rot: 5 });
	assert.equal(parsed[2].length, 0);
	assert.deepEqual(parseCameraPath(null), []);
});

test("parseCameraPath defaults a missing rot to 0", () => {
	const parsed = parseCameraPath([[{ cx: 0.1, cy: 0.2, hw: 0.3, hh: 0.4 }]]);
	closeTo(parsed[0][0].rot, 0, 1e-12);
});

test("validateCameraPath rejects bad extents and over-long paths", () => {
	const ok = validateCameraPath([[{ cx: 0.5, cy: 0.5, hw: 0.1, hh: 0.2, rot: 0 }]], 2);
	assert.deepEqual(ok.errors, []);

	const zeroExtent = validateCameraPath([[{ cx: 0.5, cy: 0.5, hw: 0, hh: 0.2, rot: 0 }]], 2);
	assert.equal(zeroExtent.errors.length, 1);

	const tooManyPages = validateCameraPath([[], [], []], 2);
	assert.ok(tooManyPages.errors.some(e => e.includes("only has 2")));

	const emptyPage = validateCameraPath([[]], 1);
	assert.deepEqual(emptyPage.errors, []);
	assert.equal(emptyPage.warnings.length, 1);
});
