/** @format */

import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { getPdfJs } from "~/lib/pdfjs-client";
import {
	cameraForStop,
	cameraMoveDuration,
	cameraToMatrix,
	captureStop,
	invertMatrix,
	lerpCamera,
	overviewCamera,
	parseCameraPath,
	serializeCameraPath,
	transformPoint,
	validateCameraPath,
	type Size,
	type VanguardCamera,
	type VanguardStop,
} from "~/lib/console/vanguard-camera";

// Camera-path author tool. Deliberately a CAMERA-CAPTURE editor rather than a
// draw-a-rectangle one: the user frames the shot by panning/zooming/rotating,
// and captureStop() derives the stop from the resulting matrix. That keeps all
// the geometry (and all three of its traps) inside the ported math, so what is
// framed here is exactly what the Flutter reader will frame.

interface SpreadRow {
	id: number;
	title: string;
	src: string;
	month: number;
	year: number;
	camera_path: unknown;
}

const VIEWPORT_PRESETS = [
	{ key: "phone", label: "Phone (9:19.5)", ratio: 390 / 844 },
	{ key: "tablet", label: "Tablet (3:4)", ratio: 3 / 4 },
	{ key: "square", label: "Square (1:1)", ratio: 1 },
];

const RENDER_WIDTH = 1400; // px raster per page; stops are normalized so this is just quality
const HOLD_MS = 900; // pause on each stop during preview

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function degrees(radians: number) {
	return (radians * 180) / Math.PI;
}

async function renderPdfPages(pdfUrl: string): Promise<HTMLCanvasElement[]> {
	const pdfjs = await getPdfJs();
	const response = await fetch(pdfUrl);
	if (!response.ok) throw new Error(`Could not download the PDF (HTTP ${response.status}).`);
	const data = await response.arrayBuffer();
	const pdf = await pdfjs.getDocument({ data, disableWorker: true } as any).promise;

	const canvases: HTMLCanvasElement[] = [];
	for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
		const page = await pdf.getPage(pageNumber);
		const unscaled = page.getViewport({ scale: 1 });
		const viewport = page.getViewport({ scale: RENDER_WIDTH / unscaled.width });
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Could not create a canvas to render the PDF.");
		await page.render({ canvasContext: context as any, viewport } as any).promise;
		page.cleanup();
		canvases.push(canvas);
	}
	return canvases;
}

function CameraEditor({ spreadId }: { spreadId: number }) {
	const { supabase } = useAdmin();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const animationRef = useRef<number | null>(null);

	const [spread, setSpread] = useState<SpreadRow | null>(null);
	const [pageCanvases, setPageCanvases] = useState<HTMLCanvasElement[]>([]);
	const [loadState, setLoadState] = useState<{ busy: boolean; error: string | null }>({ busy: true, error: null });

	const [pages, setPages] = useState<VanguardStop[][]>([]);
	const [originalJson, setOriginalJson] = useState<string>("");
	const [pageIx, setPageIx] = useState(0);
	const [selected, setSelected] = useState<number | null>(null);

	const [camera, setCamera] = useState<VanguardCamera>({ cx: 0, cy: 0, scale: 1, rot: 0 });
	const [preset, setPreset] = useState(VIEWPORT_PRESETS[0]);
	const [viewport, setViewport] = useState<Size>({ width: 390, height: 844 });
	const [playing, setPlaying] = useState(false);
	const [saveState, setSaveState] = useState<{ busy: boolean; ok: string | null; error: string | null }>({
		busy: false,
		ok: null,
		error: null,
	});
	const [roundTrip, setRoundTrip] = useState<string | null>(null);

	const image = pageCanvases[pageIx];
	const imageWidth = image?.width ?? 0;

	// ─── load the spread + render its PDF ───────────────────────────────────
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			setLoadState({ busy: true, error: null });
			const { data, error } = await supabase
				.from("spreads")
				.select("id, title, src, month, year, camera_path")
				.eq("id", spreadId)
				.maybeSingle();
			if (cancelled) return;
			if (error || !data) {
				setLoadState({ busy: false, error: error?.message ?? "That spread does not exist." });
				return;
			}
			const row = data as SpreadRow;
			setSpread(row);

			const parsed = parseCameraPath(row.camera_path);
			setOriginalJson(JSON.stringify(serializeCameraPath(parsed)));

			try {
				const canvases = await renderPdfPages(row.src.split("#")[0]);
				if (cancelled) return;
				setPageCanvases(canvases);
				// Pad (in memory only) so every PDF page is editable. Trailing empty
				// pages are trimmed again on save, so an untouched row stays untouched.
				const padded = [...parsed];
				while (padded.length < canvases.length) padded.push([]);
				setPages(padded);
				setLoadState({ busy: false, error: null });
			} catch (e) {
				if (cancelled) return;
				setLoadState({
					busy: false,
					error: `${e instanceof Error ? e.message : String(e)} — if this is a CORS error, the PDF's storage bucket must allow browser reads.`,
				});
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [supabase, spreadId]);

	// ─── viewport sizing ────────────────────────────────────────────────────
	useEffect(() => {
		const frame = frameRef.current;
		if (!frame) return;
		const measure = () => {
			const width = frame.clientWidth;
			setViewport({ width, height: Math.round(width / preset.ratio) });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(frame);
		return () => observer.disconnect();
	}, [preset, loadState.busy]);

	// ─── fit the page when it changes ───────────────────────────────────────
	const fitPage = useCallback(() => {
		if (!image || !viewport.width) return;
		setCamera(overviewCamera(viewport, { width: image.width, height: image.height }));
	}, [image, viewport]);

	useEffect(() => {
		fitPage();
	}, [fitPage]);

	// ─── draw ───────────────────────────────────────────────────────────────
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !image || !viewport.width) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(viewport.width * dpr);
		canvas.height = Math.round(viewport.height * dpr);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = "#101820";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const m = cameraToMatrix(camera, viewport);
		ctx.setTransform(m.a * dpr, m.b * dpr, m.c * dpr, m.d * dpr, m.e * dpr, m.f * dpr);
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(image, 0, 0);
	}, [camera, image, viewport]);

	// ─── gestures ───────────────────────────────────────────────────────────
	const dragRef = useRef<{ mode: "pan" | "rotate"; x: number; y: number } | null>(null);

	const stopPreview = useCallback(() => {
		if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
		animationRef.current = null;
		setPlaying(false);
	}, []);

	const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		stopPreview();
		(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
		const rect = e.currentTarget.getBoundingClientRect();
		dragRef.current = {
			mode: e.altKey || e.shiftKey || e.button === 2 ? "rotate" : "pan",
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		};
	};

	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const drag = dragRef.current;
		if (!drag) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const dx = x - drag.x;
		const dy = y - drag.y;
		dragRef.current = { ...drag, x, y };

		if (drag.mode === "pan") {
			setCamera(c => {
				const cos = Math.cos(c.rot);
				const sin = Math.sin(c.rot);
				// Inverse of the linear part (rotation · uniform scale).
				return { ...c, cx: c.cx - (dx * cos + dy * sin) / c.scale, cy: c.cy - (-dx * sin + dy * cos) / c.scale };
			});
		} else {
			const centreX = viewport.width / 2;
			const centreY = viewport.height / 2;
			const before = Math.atan2(y - dy - centreY, x - dx - centreX);
			const after = Math.atan2(y - centreY, x - centreX);
			setCamera(c => ({ ...c, rot: c.rot + (after - before) }));
		}
	};

	const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
		dragRef.current = null;
		try {
			(e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
		} catch {
			/* pointer already released */
		}
	};

	const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
		if (!image) return;
		stopPreview();
		const rect = e.currentTarget.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const factor = Math.exp(-e.deltaY / 400);
		setCamera(c => {
			const fitted = Math.min(viewport.width / image.width, viewport.height / image.height);
			const scale = clamp(c.scale * factor, fitted * 0.4, fitted * 40);
			// Keep the image point under the cursor pinned.
			const p = transformPoint(invertMatrix(cameraToMatrix(c, viewport)), sx, sy);
			const cos = Math.cos(c.rot);
			const sin = Math.sin(c.rot);
			const ox = sx - viewport.width / 2;
			const oy = sy - viewport.height / 2;
			return { ...c, scale, cx: p.x - (ox * cos + oy * sin) / scale, cy: p.y - (-ox * sin + oy * cos) / scale };
		});
	};

	// ─── stops ──────────────────────────────────────────────────────────────
	const currentStops = pages[pageIx] ?? [];

	const setStops = (updater: (stops: VanguardStop[]) => VanguardStop[]) => {
		setPages(prev => prev.map((page, ix) => (ix === pageIx ? updater(page) : page)));
		setSaveState(s => ({ ...s, ok: null }));
	};

	/** Capture, then immediately verify the stop replays to where we are now. */
	const captureHere = (replaceIx?: number) => {
		if (!image || !viewport.width) return;
		const stop = captureStop(cameraToMatrix(camera, viewport), viewport, image.width);
		const replay = cameraForStop(viewport, image.width, stop);
		const drift = Math.max(
			Math.abs(replay.cx - camera.cx),
			Math.abs(replay.cy - camera.cy),
			Math.abs(replay.scale - camera.scale) * image.width,
			Math.abs(replay.rot - camera.rot) * image.width
		);
		setRoundTrip(drift < 0.01 ? "Round-trip verified — replays exactly here." : `⚠ Round-trip drifted by ${drift.toFixed(3)}px.`);

		if (replaceIx === undefined) {
			setStops(stops => [...stops, stop]);
			setSelected(currentStops.length);
		} else {
			setStops(stops => stops.map((s, i) => (i === replaceIx ? stop : s)));
			setSelected(replaceIx);
		}
	};

	const jumpTo = useCallback(
		(ix: number) => {
			const stop = pages[pageIx]?.[ix];
			if (!stop || !image || !viewport.width) return;
			stopPreview();
			setSelected(ix);
			setCamera(cameraForStop(viewport, image.width, stop));
		},
		[pages, pageIx, image, viewport, stopPreview]
	);

	const move = (ix: number, delta: number) => {
		const target = ix + delta;
		if (target < 0 || target >= currentStops.length) return;
		setStops(stops => {
			const next = [...stops];
			const [item] = next.splice(ix, 1);
			next.splice(target, 0, item);
			return next;
		});
		setSelected(target);
	};

	// ─── preview player ─────────────────────────────────────────────────────
	const play = () => {
		if (!image || currentStops.length === 0) return;
		stopPreview();
		setPlaying(true);
		const cameras = currentStops.map(s => cameraForStop(viewport, image.width, s));
		let leg = 0;
		let legStart = performance.now();
		setCamera(cameras[0]);

		const step = (now: number) => {
			if (leg >= cameras.length - 1) {
				setPlaying(false);
				animationRef.current = null;
				return;
			}
			const from = cameras[leg];
			const to = cameras[leg + 1];
			const duration = cameraMoveDuration(from, to);
			const elapsed = now - legStart;
			if (elapsed < HOLD_MS) {
				setCamera(from);
			} else if (elapsed < HOLD_MS + duration) {
				setCamera(lerpCamera(from, to, (elapsed - HOLD_MS) / duration));
			} else {
				setCamera(to);
				leg += 1;
				legStart = now;
				setSelected(leg);
			}
			animationRef.current = requestAnimationFrame(step);
		};
		animationRef.current = requestAnimationFrame(step);
	};

	useEffect(() => () => stopPreview(), [stopPreview]);

	// ─── save ───────────────────────────────────────────────────────────────
	// Trim trailing empty pages so padding for the editor never reaches the DB.
	const trimmed = useMemo(() => {
		const copy = [...pages];
		while (copy.length && copy[copy.length - 1].length === 0) copy.pop();
		return copy;
	}, [pages]);

	const currentJson = useMemo(() => JSON.stringify(serializeCameraPath(trimmed)), [trimmed]);
	const dirty = currentJson !== originalJson;
	const validation = useMemo(() => validateCameraPath(trimmed, pageCanvases.length), [trimmed, pageCanvases.length]);

	const save = async () => {
		setSaveState({ busy: true, ok: null, error: null });
		try {
			if (validation.errors.length) throw new Error(validation.errors[0]);
			const payload = trimmed.length ? serializeCameraPath(trimmed) : null;
			const { error, data } = await supabase.from("spreads").update({ camera_path: payload }).eq("id", spreadId).select("id");
			if (error) throw error;
			if (!data?.length) throw new Error("Save was blocked — are you still signed in as an editor?");
			setOriginalJson(currentJson);
			setSaveState({ busy: false, ok: "Saved.", error: null });
		} catch (e) {
			setSaveState({ busy: false, ok: null, error: e instanceof Error ? e.message : String(e) });
		}
	};

	if (loadState.busy) return <p className="ta-muted">Loading the spread and rendering its PDF…</p>;
	if (loadState.error) return <p className="ta-error">{loadState.error}</p>;

	const totalStops = pages.reduce((sum, page) => sum + page.length, 0);

	return (
		<div className="ta-stack">
			<div className="ta-row ta-spread">
				<div>
					<b>{spread?.title}</b>{" "}
					<span className="ta-muted ta-small">
						· {pageCanvases.length} page{pageCanvases.length === 1 ? "" : "s"} · {totalStops} stop{totalStops === 1 ? "" : "s"}
					</span>
				</div>
				<Link href="/admin/vanguard" className="ta-btn ta-btn-small">
					← Back to spreads
				</Link>
			</div>

			<div className="ta-cam-layout">
				<div>
					<div className="ta-cam-frame" ref={frameRef}>
						<canvas
							ref={canvasRef}
							className="ta-cam-canvas"
							style={{ width: viewport.width, height: viewport.height }}
							onPointerDown={onPointerDown}
							onPointerMove={onPointerMove}
							onPointerUp={endDrag}
							onPointerCancel={endDrag}
							onWheel={onWheel}
							onContextMenu={e => e.preventDefault()}
						/>
					</div>
					<p className="ta-muted ta-small" style={{ marginTop: "0.5rem" }}>
						Drag to pan · scroll to zoom · <b>Alt/Shift-drag</b> (or right-drag) to rotate. Frame the shot, then capture — the reader
						will frame exactly this.
					</p>
				</div>

				<div className="ta-stack">
					<div className="ta-card ta-stack">
						<div className="ta-row">
							<label style={{ margin: 0, flex: 1 }}>
								Page
								<select value={pageIx} onChange={e => { setPageIx(Number(e.target.value)); setSelected(null); }}>
									{pageCanvases.map((_, ix) => (
										<option key={ix} value={ix}>
											Page {ix + 1} ({pages[ix]?.length ?? 0} stops)
										</option>
									))}
								</select>
							</label>
							<label style={{ margin: 0, flex: 1 }}>
								Reader shape
								<select
									value={preset.key}
									onChange={e => setPreset(VIEWPORT_PRESETS.find(p => p.key === e.target.value) ?? VIEWPORT_PRESETS[0])}
								>
									{VIEWPORT_PRESETS.map(p => (
										<option key={p.key} value={p.key}>
											{p.label}
										</option>
									))}
								</select>
							</label>
						</div>
						<label style={{ margin: 0 }}>
							Rotation — {degrees(camera.rot).toFixed(1)}°
							<input
								type="range"
								min={-180}
								max={180}
								step={0.5}
								value={clamp(degrees(camera.rot), -180, 180)}
								onChange={e => setCamera(c => ({ ...c, rot: (Number(e.target.value) * Math.PI) / 180 }))}
							/>
						</label>
						<div className="ta-row">
							<button className="ta-btn ta-btn-primary" onClick={() => captureHere()} disabled={playing}>
								+ Capture stop
							</button>
							<button className="ta-btn" onClick={fitPage}>
								Fit page
							</button>
							<button className="ta-btn" onClick={() => setCamera(c => ({ ...c, rot: 0 }))}>
								Level
							</button>
							<button className="ta-btn" onClick={playing ? stopPreview : play} disabled={currentStops.length === 0}>
								{playing ? "■ Stop" : "▶ Preview page"}
							</button>
						</div>
						{roundTrip && <p className={roundTrip.startsWith("⚠") ? "ta-error" : "ta-ok"}>{roundTrip}</p>}
					</div>

					<div className="ta-table-wrap">
						<table className="ta-table">
							<thead>
								<tr>
									<th style={{ width: "2.5rem" }}>#</th>
									<th>Stop</th>
									<th style={{ width: "10rem" }} />
								</tr>
							</thead>
							<tbody>
								{currentStops.map((s, ix) => (
									<tr key={ix} style={selected === ix ? { background: "#eef2f6" } : undefined}>
										<td>
											<b>{ix + 1}</b>
										</td>
										<td className="ta-small">
											<button className="ta-linkish" onClick={() => jumpTo(ix)}>
												centre {s.cx.toFixed(3)}, {s.cy.toFixed(3)} · {degrees(s.rot).toFixed(0)}°
											</button>
										</td>
										<td>
											<button className="ta-btn ta-btn-small" onClick={() => move(ix, -1)} disabled={ix === 0} title="Move earlier">
												▲
											</button>{" "}
											<button
												className="ta-btn ta-btn-small"
												onClick={() => move(ix, 1)}
												disabled={ix === currentStops.length - 1}
												title="Move later"
											>
												▼
											</button>{" "}
											<button className="ta-btn ta-btn-small" onClick={() => captureHere(ix)} title="Replace with the current view">
												Re-capture
											</button>{" "}
											<button
												className="ta-btn ta-btn-small ta-btn-ghost-danger"
												onClick={() => {
													setStops(stops => stops.filter((_, i) => i !== ix));
													setSelected(null);
												}}
											>
												✕
											</button>
										</td>
									</tr>
								))}
								{currentStops.length === 0 && (
									<tr>
										<td colSpan={3} className="ta-muted ta-small">
											No stops on this page yet — frame a shot and capture it. A page with no stops is valid; the reader just
											passes over it.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{validation.errors.map((problem, i) => (
						<p key={i} className="ta-error">
							{problem}
						</p>
					))}
					{validation.warnings.map((problem, i) => (
						<p key={i} className="ta-muted ta-small">
							{problem}
						</p>
					))}

					<div className="ta-row">
						<button className="ta-btn ta-btn-primary" onClick={() => void save()} disabled={saveState.busy || !dirty || validation.errors.length > 0}>
							{saveState.busy ? "Saving…" : dirty ? "Save camera path" : "No changes to save"}
						</button>
						{saveState.ok && <span className="ta-ok">{saveState.ok}</span>}
						{saveState.error && <span className="ta-error">{saveState.error}</span>}
					</div>
				</div>
			</div>

			<details>
				<summary className="ta-muted ta-small">Show the JSON that will be saved</summary>
				<pre className="ta-code">{JSON.stringify(serializeCameraPath(trimmed), null, 1)}</pre>
			</details>
		</div>
	);
}

export default function CameraPathPage() {
	const router = useRouter();
	const id = Number(router.query.id);

	return (
		<AdminShell title="Vanguard camera path" wide>
			{router.isReady && Number.isInteger(id) && id > 0 ? (
				<CameraEditor spreadId={id} />
			) : router.isReady ? (
				<p className="ta-error">
					No spread selected. Open this from <Link href="/admin/vanguard">the spreads list</Link>.
				</p>
			) : (
				<p className="ta-muted">Loading…</p>
			)}
		</AdminShell>
	);
}
