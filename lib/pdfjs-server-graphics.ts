/** @format */

import { CanvasRenderingContext2D, DOMMatrix, ImageData } from "canvas";
import { Path2D, applyPath2DToCanvasRenderingContext } from "path2d";

let initialized = false;

export function ensurePdfJsServerGraphics() {
	if (initialized) return;

	// PDF.js loads these optional packages dynamically. Next's server bundles
	// cannot reliably discover them, so install the graphics support explicitly.
	applyPath2DToCanvasRenderingContext(CanvasRenderingContext2D);
	const graphics = globalThis as unknown as {
		Path2D?: typeof Path2D;
		DOMMatrix?: typeof DOMMatrix;
		ImageData?: typeof ImageData;
	};
	graphics.Path2D = Path2D;
	graphics.DOMMatrix ??= DOMMatrix;
	graphics.ImageData ??= ImageData;
	initialized = true;
}
