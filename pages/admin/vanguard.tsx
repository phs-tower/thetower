/** @format */

import { useCallback, useEffect, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { monthName } from "~/lib/console/supabase";

// Vanguard "spreads" (the reader calls them issues): a print-page PDF plus an
// optional camera_path — a JSON list of pages, each a list of stops
// {cx, cy, hw, hh, rot} (or {"stops": [...]} wrappers), authored by a tool in
// the app repo and pasted here. Spreads work fine without one (free pinch-zoom).
//
// The spreads storage bucket is PRIVATE: upload, then mint a ~10-year signed
// URL for the src column (matches how existing rows are stored).

interface SpreadRow {
	id: number;
	title: string;
	src: string;
	month: number;
	year: number;
	category: string | null;
	camera_path: unknown;
}

const TEN_YEARS = 10 * 365 * 24 * 60 * 60;

function validateCameraPath(text: string): { value: unknown; pages: number; stops: number } {
	const parsed = JSON.parse(text);
	if (!Array.isArray(parsed)) throw new Error("camera_path must be a JSON array (one entry per PDF page).");
	let stops = 0;
	parsed.forEach((page, i) => {
		const stopList = Array.isArray(page) ? page : page && typeof page === "object" ? (page as { stops?: unknown }).stops : undefined;
		if (!Array.isArray(stopList)) throw new Error(`Page ${i + 1}: expected a list of stops (or {"stops": [...]}).`);
		stopList.forEach((stop, j) => {
			if (!stop || typeof stop !== "object") throw new Error(`Page ${i + 1}, stop ${j + 1}: not an object.`);
			for (const k of ["cx", "cy", "hw", "hh"]) {
				if (typeof (stop as Record<string, unknown>)[k] !== "number")
					throw new Error(`Page ${i + 1}, stop ${j + 1}: missing numeric "${k}".`);
			}
			stops++;
		});
	});
	return { value: parsed, pages: parsed.length, stops };
}

function SpreadForm({ row, onDone }: { row: SpreadRow | null; onDone: () => void }) {
	const { supabase } = useAdmin();
	const now = new Date();
	const [title, setTitle] = useState(row?.title ?? "");
	const [month, setMonth] = useState(row?.month ?? now.getMonth() + 1);
	const [year, setYear] = useState(row?.year ?? now.getFullYear());
	const [src, setSrc] = useState(row?.src ?? "");
	const [cameraText, setCameraText] = useState(row?.camera_path ? JSON.stringify(row.camera_path, null, 2) : "");
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

	const uploadPdf = async (): Promise<string> => {
		if (!file) return src;
		const key = `${year}/${file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`;
		const { error: upErr } = await supabase.storage.from("spreads").upload(key, file, { contentType: "application/pdf", upsert: true });
		if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
		const { data: signed, error: signErr } = await supabase.storage.from("spreads").createSignedUrl(key, TEN_YEARS);
		if (signErr || !signed?.signedUrl) throw new Error(`Could not create a signed URL: ${signErr?.message ?? "no URL returned"}`);
		return signed.signedUrl;
	};

	const save = async () => {
		setBusy(true);
		setMsg({});
		try {
			if (!title.trim()) throw new Error("Title is required.");
			let cameraPath: unknown = null;
			if (cameraText.trim()) {
				const v = validateCameraPath(cameraText);
				cameraPath = v.value;
			}
			const finalSrc = await uploadPdf();
			if (!/^https?:\/\//.test(finalSrc)) throw new Error("A PDF is required — upload a file or paste a URL.");

			const payload = { title: title.trim(), month, year, category: "vanguard", src: finalSrc, camera_path: cameraPath };
			if (row) {
				const { error, data } = await supabase.from("spreads").update(payload).eq("id", row.id).select("id");
				if (error) throw error;
				if (!data?.length) throw new Error("Save was blocked — are you signed in as an editor?");
			} else {
				const { error } = await supabase.from("spreads").insert(payload);
				if (error) throw error;
			}
			setMsg({ ok: "Saved." });
			onDone();
		} catch (e) {
			setMsg({ err: e instanceof Error ? e.message : String(e) });
		}
		setBusy(false);
	};

	let cameraStatus: string | null = null;
	let cameraBad = false;
	if (cameraText.trim()) {
		try {
			const v = validateCameraPath(cameraText);
			cameraStatus = `Valid: ${v.pages} pages, ${v.stops} stops.`;
		} catch (e) {
			cameraStatus = e instanceof Error ? e.message : String(e);
			cameraBad = true;
		}
	}

	return (
		<div className="ta-card ta-stack">
			<b>{row ? `Edit spread #${row.id}` : "New spread"}</b>
			<div className="ta-row">
				<label style={{ margin: 0, minWidth: 260, flex: 1 }}>
					Title
					<input type="text" value={title} placeholder="VANGUARD Talks Pets" onChange={e => setTitle(e.target.value)} />
				</label>
				<label style={{ margin: 0 }}>
					Month
					<select value={month} onChange={e => setMonth(Number(e.target.value))}>
						{Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
							<option key={m} value={m}>
								{monthName(m)}
							</option>
						))}
					</select>
				</label>
				<label style={{ margin: 0, maxWidth: 110 }}>
					Year
					<input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
				</label>
			</div>
			<label style={{ margin: 0 }}>
				PDF — upload a file (stored in the private spreads bucket with a 10-year signed link) or paste an existing URL
				<input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ marginTop: 4 }} />
			</label>
			{!file && <input type="url" value={src} placeholder="https://…/spreads/…pdf" onChange={e => setSrc(e.target.value)} />}
			{file && (
				<p className="ta-muted ta-small" style={{ margin: 0 }}>
					Will upload: {file.name} ({Math.round(file.size / 1024)} KB)
				</p>
			)}
			<label style={{ margin: 0 }}>
				Guided camera path (optional) — paste JSON from the authoring tool
				<textarea
					rows={5}
					value={cameraText}
					placeholder='[ [ {"cx":0.5,"cy":0.35,"hw":0.4,"hh":0.2,"rot":0} ] ]'
					onChange={e => setCameraText(e.target.value)}
					style={{ fontFamily: "monospace" }}
				/>
			</label>
			{cameraStatus && <p className={cameraBad ? "ta-error" : "ta-ok"}>{cameraStatus}</p>}
			<div className="ta-row">
				<button className="ta-btn ta-btn-primary" disabled={busy || cameraBad} onClick={() => void save()}>
					{busy ? "Saving…" : row ? "Save spread" : "Create spread"}
				</button>
				<button className="ta-btn" onClick={onDone} disabled={busy}>
					Close
				</button>
				{msg.ok && <span className="ta-ok">{msg.ok}</span>}
				{msg.err && <span className="ta-error">{msg.err}</span>}
			</div>
		</div>
	);
}

function VanguardManager() {
	const { supabase } = useAdmin();
	const [rows, setRows] = useState<SpreadRow[]>([]);
	const [editing, setEditing] = useState<SpreadRow | null | "new">(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const { data, error: err } = await supabase
			.from("spreads")
			.select("id, title, src, month, year, category, camera_path")
			.order("year", { ascending: false })
			.order("month", { ascending: false });
		if (err) {
			setError(err.message);
			return;
		}
		setRows((data ?? []) as SpreadRow[]);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	const remove = async (row: SpreadRow) => {
		if (!window.confirm(`Delete "${row.title}" (${monthName(row.month)} ${row.year})? The app's Vanguard list drops it on next refresh.`)) return;
		const { error: err } = await supabase.from("spreads").delete().eq("id", row.id);
		if (err) {
			setError(err.message);
			return;
		}
		await load();
	};

	return (
		<div className="ta-stack">
			{editing === null ? (
				<div>
					<button className="ta-btn ta-btn-primary" onClick={() => setEditing("new")}>
						+ New spread
					</button>
				</div>
			) : (
				<SpreadForm
					row={editing === "new" ? null : editing}
					onDone={() => {
						setEditing(null);
						void load();
					}}
				/>
			)}
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th>Title</th>
							<th style={{ width: 140 }}>Issue</th>
							<th style={{ width: 120 }}>PDF</th>
							<th style={{ width: 130 }}>Guided path</th>
							<th style={{ width: 150 }} />
						</tr>
					</thead>
					<tbody>
						{rows.map(r => (
							<tr key={r.id}>
								<td>
									<b>{r.title}</b> <span className="ta-muted">#{r.id}</span>
								</td>
								<td>
									{monthName(r.month)} {r.year}
								</td>
								<td>
									{/^https?:\/\//.test(r.src?.split("#")[0] ?? "") ? (
										<a href={r.src.split("#")[0]} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
											Open PDF
										</a>
									) : (
										<span className="ta-badge red">bad src</span>
									)}
								</td>
								<td>{r.camera_path ? <span className="ta-badge green">yes</span> : <span className="ta-badge gray">none</span>}</td>
								<td>
									<button className="ta-btn ta-btn-small" onClick={() => setEditing(r)}>
										Edit
									</button>{" "}
									<button className="ta-btn ta-btn-small ta-btn-ghost-danger" onClick={() => void remove(r)}>
										Delete
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default function VanguardPage() {
	return (
		<AdminShell title="Vanguard spreads" wide>
			<VanguardManager />
		</AdminShell>
	);
}
