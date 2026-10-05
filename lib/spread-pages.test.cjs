/** @format */

// Run after `npm run build`: node --test lib/spread-pages.test.cjs
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createCanvas } = require("canvas");
const sharp = require("sharp");

test("production PDF renderer initializes server graphics and renders both pages", async () => {
	const route = await require("../.next/server/pages/api/load/spread-page-preview.js");
	// Reproduce a server process without browser graphics globals, even if
	// PDF.js's optional dependency loader happened to initialize them here.
	delete globalThis.Path2D;
	delete globalThis.DOMMatrix;
	delete globalThis.ImageData;

	const canvas = createCanvas(100, 100, "pdf");
	const context = canvas.getContext("2d");
	for (const color of ["red", "blue"]) {
		if (color === "blue") context.addPage();
		context.fillStyle = "white";
		context.fillRect(0, 0, 100, 100);
		context.save();
		context.beginPath();
		context.arc(50, 50, 35, 0, 2 * Math.PI);
		context.clip();
		context.fillStyle = color;
		context.fillRect(0, 0, 100, 100);
		context.restore();
	}
	const src = `data:application/pdf;base64,${canvas.toBuffer("application/pdf").toString("base64")}`;

	for (const page of [1, 2]) {
		let status;
		let body;
		const headers = {};
		const response = {
			setHeader(name, value) {
				headers[name] = value;
			},
			status(value) {
				status = value;
				return this;
			},
			send(value) {
				body = value;
				return this;
			},
			json(value) {
				body = value;
				return this;
			},
		};
		await route.default({ method: "GET", query: { src, page } }, response);
		assert.equal(status, 200, JSON.stringify(body));
		assert.equal(headers["Content-Type"], "image/png");
		assert.equal(headers["X-Spread-Page-Count"], "2");
		const { data, info } = await sharp(body).removeAlpha().raw().toBuffer({ resolveWithObject: true });
		assert.equal(info.width, 250);
		assert.equal(info.height, 250);
		const center = (125 * info.width + 125) * info.channels;
		assert.deepEqual([...data.subarray(center, center + 3)], page === 1 ? [255, 0, 0] : [0, 0, 255]);
		assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
	}
	assert.equal(typeof globalThis.Path2D, "function");
});
