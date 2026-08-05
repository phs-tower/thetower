/** @format */

// Vanguard guided-camera math — a LITERAL port of the app repo's
// lib/vanguard/camera.dart. The web author tool and the Flutter reader must
// agree exactly, so this file mirrors that Dart file line for line rather than
// re-deriving anything. If the Dart changes, change this to match; do not
// "clean up" the conventions below — all three are load-bearing:
//
//   1. Everything is normalized by the rendered image WIDTH, including cy and
//      hh. Not width-for-x / height-for-y. One shared unit keeps rotation true.
//   2. Stored angles carry a legacy quarter turn (kStopRotationFix), added at
//      playback and subtracted at capture. It cancels for new data; removing it
//      breaks every path already in the database.
//   3. hw/hh are measured in the ROTATED screen frame, so cameraForStop fits
//      2*hh to the viewport WIDTH and 2*hw to its HEIGHT. That swap is a
//      consequence of (2), not a bug.

export interface VanguardStop {
	cx: number;
	cy: number;
	hw: number;
	hh: number;
	rot: number;
}

export interface VanguardCamera {
	/** Image-pixel point shown at the viewport center. */
	cx: number;
	cy: number;
	scale: number;
	/** Radians applied to the image. */
	rot: number;
}

export interface Size {
	width: number;
	height: number;
}

/**
 * A 2D affine transform, canvas-style:
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 *
 * Matches both CanvasRenderingContext2D.setTransform and the entries the Dart
 * reads out of Matrix4 (storage[0] is `a`, storage[1] is `b`).
 */
export interface Matrix {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
}

/**
 * Stop angles already in the database were authored against a raster a quarter
 * turn from the one rendered today, so every stored angle carries a spurious
 * quarter turn that has to come back off.
 *
 * Screen space has Y pointing down, so a positive angle turns clockwise;
 * counter-clockwise is negative.
 */
export const K_STOP_ROTATION_FIX = -Math.PI / 2;

/** Matrix4.identity()..translate(v/2)..rotateZ(rot)..scale(s)..translate(-c) */
export function cameraToMatrix(camera: VanguardCamera, viewport: Size): Matrix {
	const cos = Math.cos(camera.rot);
	const sin = Math.sin(camera.rot);
	const a = camera.scale * cos;
	const b = camera.scale * sin;
	const c = -camera.scale * sin;
	const d = camera.scale * cos;
	return {
		a,
		b,
		c,
		d,
		e: viewport.width / 2 - (a * camera.cx + c * camera.cy),
		f: viewport.height / 2 - (b * camera.cx + d * camera.cy),
	};
}

/** Matrix4.getMaxScaleOnAxis() for a translate·rotate·uniform-scale matrix. */
export function maxScaleOnAxis(m: Matrix): number {
	return Math.hypot(m.a, m.b);
}

export function invertMatrix(m: Matrix): Matrix {
	const det = m.a * m.d - m.b * m.c;
	if (!det) throw new Error("Camera matrix is singular and cannot be inverted.");
	return {
		a: m.d / det,
		b: -m.b / det,
		c: -m.c / det,
		d: m.a / det,
		e: (m.c * m.f - m.d * m.e) / det,
		f: (m.b * m.e - m.a * m.f) / det,
	};
}

export function transformPoint(m: Matrix, x: number, y: number): { x: number; y: number } {
	return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/**
 * Camera that frames [stop] fully visible and centered in [viewport]
 * (contain), rotating the page by the stop's angle. [imageWidth] is the
 * rendered page width in pixels.
 */
export function cameraForStop(viewport: Size, imageWidth: number, s: VanguardStop): VanguardCamera {
	const hw = s.hw * imageWidth;
	const hh = s.hh * imageWidth;
	// kStopRotationFix turns the stop's box a quarter turn on screen, so its
	// stored horizontal extent is what the viewport's *height* has to fit, and
	// vice versa.
	const scale = Math.min(viewport.width / (2 * hh), viewport.height / (2 * hw));
	return { cx: s.cx * imageWidth, cy: s.cy * imageWidth, scale, rot: s.rot + K_STOP_ROTATION_FIX };
}

/** Full-page overview framing (no rotation). */
export function overviewCamera(viewport: Size, imageSize: Size): VanguardCamera {
	const scale = Math.min(viewport.width / imageSize.width, viewport.height / imageSize.height);
	return { cx: imageSize.width / 2, cy: imageSize.height / 2, scale, rot: 0 };
}

/**
 * The region the viewport currently shows, as a storable stop. Inverse of
 * cameraForStop: works for any translate·rotate·scale matrix.
 */
export function captureStop(m: Matrix, viewport: Size, imageWidth: number): VanguardStop {
	const s = maxScaleOnAxis(m);
	const rot = Math.atan2(m.b, m.a);
	const inv = invertMatrix(m);
	const c = transformPoint(inv, viewport.width / 2, viewport.height / 2);
	// Back out exactly what cameraForStop will re-apply, extents included, so a
	// captured stop replays to the view it was captured from.
	return {
		cx: c.x / imageWidth,
		cy: c.y / imageWidth,
		hw: viewport.height / 2 / s / imageWidth,
		hh: viewport.width / 2 / s / imageWidth,
		rot: rot - K_STOP_ROTATION_FIX,
	};
}

export function shortestAngle(a: number, b: number): number {
	let d = (b - a) % (2 * Math.PI);
	if (d > Math.PI) d -= 2 * Math.PI;
	if (d < -Math.PI) d += 2 * Math.PI;
	return d;
}

/**
 * Center lerps linearly, scale geometrically (constant-speed zoom), rotation
 * along the shortest arc.
 */
export function lerpCamera(a: VanguardCamera, b: VanguardCamera, t: number): VanguardCamera {
	return {
		cx: a.cx + (b.cx - a.cx) * t,
		cy: a.cy + (b.cy - a.cy) * t,
		scale: a.scale * Math.pow(b.scale / a.scale, t),
		rot: a.rot + shortestAngle(a.rot, b.rot) * t,
	};
}

/** Animation duration scaled by pan distance, zoom ratio, and rotation. */
export function cameraMoveDuration(from: VanguardCamera, to: VanguardCamera): number {
	const panScreen = Math.hypot(to.cx - from.cx, to.cy - from.cy) * Math.min(from.scale, to.scale);
	const zoom = Math.abs(Math.log(to.scale / from.scale));
	const turn = Math.abs(shortestAngle(from.rot, to.rot));
	const ms = 450 + 0.35 * panScreen + 250 * zoom + 260 * turn;
	return Math.round(Math.min(1100, Math.max(450, ms)));
}

// ─── camera_path (de)serialization ──────────────────────────────────────────

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

/**
 * Parse a stored camera_path. Accepts both page shapes the app accepts — a
 * bare list of stops, or a {"stops": [...]} wrapper — and returns pages of
 * stops. Anything unparseable becomes an empty page rather than throwing, so a
 * half-broken row can still be opened and repaired in the editor.
 */
export function parseCameraPath(raw: unknown): VanguardStop[][] {
	if (!Array.isArray(raw)) return [];
	return raw.map(page => {
		const stops = Array.isArray(page) ? page : page && typeof page === "object" ? (page as { stops?: unknown }).stops : undefined;
		if (!Array.isArray(stops)) return [];
		return stops
			.filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
			.map(s => ({
				cx: isFiniteNumber(s.cx) ? s.cx : 0,
				cy: isFiniteNumber(s.cy) ? s.cy : 0,
				hw: isFiniteNumber(s.hw) ? s.hw : 0,
				hh: isFiniteNumber(s.hh) ? s.hh : 0,
				rot: isFiniteNumber(s.rot) ? s.rot : 0,
			}));
	});
}

/** Emit the bare-list page form the app prefers. */
export function serializeCameraPath(pages: VanguardStop[][]): VanguardStop[][] {
	return pages.map(page => page.map(s => ({ cx: s.cx, cy: s.cy, hw: s.hw, hh: s.hh, rot: s.rot })));
}

export interface PathValidation {
	errors: string[];
	warnings: string[];
}

export function validateCameraPath(pages: VanguardStop[][], pdfPageCount: number): PathValidation {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (pdfPageCount > 0 && pages.length > pdfPageCount) {
		errors.push(`The path has ${pages.length} pages but the PDF only has ${pdfPageCount}.`);
	}

	pages.forEach((page, pageIx) => {
		if (page.length === 0) warnings.push(`Page ${pageIx + 1} has no stops — the reader will skip straight past it.`);
		page.forEach((s, stopIx) => {
			const label = `Page ${pageIx + 1}, stop ${stopIx + 1}`;
			for (const key of ["cx", "cy", "hw", "hh", "rot"] as const) {
				if (!isFiniteNumber(s[key])) errors.push(`${label}: ${key} is not a finite number.`);
			}
			if (isFiniteNumber(s.hw) && s.hw <= 0) errors.push(`${label}: hw must be greater than 0.`);
			if (isFiniteNumber(s.hh) && s.hh <= 0) errors.push(`${label}: hh must be greater than 0.`);
		});
	});

	return { errors, warnings };
}
