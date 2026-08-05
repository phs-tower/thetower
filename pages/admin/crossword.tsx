/** @format */

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";

// crossword.clues is a JSON STRING (text column):
//   { "across": { "1": {clue, answer, row, col}, … }, "down": { … } }
// CRITICAL app constraint: clue keys are parsed as integers — a non-numeric
// key crashes the app, so saving is blocked unless every key is numeric.

interface CrosswordRow {
	id: number;
	date: string;
	title: string | null;
	author: string;
	clues: string;
}

interface ClueEntry {
	key: string; // react key
	dir: "across" | "down";
	number: string;
	clue: string;
	answer: string;
	row: number;
	col: number;
}

let ck = 0;
const nextCk = () => `c${++ck}`;

function cluesToEntries(cluesJson: string): ClueEntry[] {
	const parsed = JSON.parse(cluesJson);
	const out: ClueEntry[] = [];
	for (const dir of ["across", "down"] as const) {
		const map = parsed?.[dir] ?? {};
		for (const number of Object.keys(map)) {
			const c = map[number] ?? {};
			out.push({
				key: nextCk(),
				dir,
				number,
				clue: String(c.clue ?? ""),
				answer: String(c.answer ?? ""),
				row: Number(c.row ?? 0),
				col: Number(c.col ?? 0),
			});
		}
	}
	return out.sort((a, b) => (a.dir === b.dir ? Number(a.number) - Number(b.number) : a.dir === "across" ? -1 : 1));
}

function entriesToClues(entries: ClueEntry[]): string {
	const result: Record<string, Record<string, { clue: string; answer: string; row: number; col: number }>> = { across: {}, down: {} };
	for (const e of entries) {
		result[e.dir][e.number.trim()] = { clue: e.clue, answer: e.answer.toUpperCase(), row: e.row, col: e.col };
	}
	return JSON.stringify(result, null, 2);
}

function validate(entries: ClueEntry[]): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();
	const cells = new Map<string, { letter: string; from: string }>();
	for (const e of entries) {
		const label = `${e.dir} ${e.number || "?"}`;
		if (!/^\d+$/.test(e.number.trim())) problems.push(`${label}: clue number "${e.number}" is not numeric — this would CRASH the app.`);
		const dupKey = `${e.dir}:${e.number.trim()}`;
		if (seen.has(dupKey)) problems.push(`${label}: duplicate clue number.`);
		seen.add(dupKey);
		if (!e.clue.trim()) problems.push(`${label}: empty clue.`);
		if (!/^[A-Za-z]+$/.test(e.answer)) problems.push(`${label}: answer "${e.answer}" must be letters only.`);
		if (e.row < 0 || e.col < 0 || !Number.isInteger(e.row) || !Number.isInteger(e.col))
			problems.push(`${label}: row/col must be non-negative integers.`);
		// letter grid conflicts
		const letters = e.answer.toUpperCase().split("");
		letters.forEach((letter, i) => {
			const r = e.dir === "across" ? e.row : e.row + i;
			const c = e.dir === "across" ? e.col + i : e.col;
			const at = cells.get(`${r},${c}`);
			if (at && at.letter !== letter)
				problems.push(`${label}: letter ${i + 1} ("${letter}") collides with ${at.from} ("${at.letter}") at row ${r}, col ${c}.`);
			else cells.set(`${r},${c}`, { letter, from: label });
		});
	}
	return problems;
}

function GridPreview({ entries }: { entries: ClueEntry[] }) {
	const { grid, numbers, rows, cols } = useMemo(() => {
		const cellMap = new Map<string, string>();
		const numberMap = new Map<string, string>();
		let maxR = 0;
		let maxC = 0;
		for (const e of entries) {
			if (!/^[A-Za-z]+$/.test(e.answer)) continue;
			const letters = e.answer.toUpperCase().split("");
			letters.forEach((letter, i) => {
				const r = e.dir === "across" ? e.row : e.row + i;
				const c = e.dir === "across" ? e.col + i : e.col;
				cellMap.set(`${r},${c}`, letter);
				maxR = Math.max(maxR, r);
				maxC = Math.max(maxC, c);
			});
			if (!numberMap.has(`${e.row},${e.col}`)) numberMap.set(`${e.row},${e.col}`, e.number);
		}
		return { grid: cellMap, numbers: numberMap, rows: maxR + 1, cols: maxC + 1 };
	}, [entries]);

	if (grid.size === 0) return <p className="ta-muted">Add clues to preview the grid.</p>;
	if (rows > 30 || cols > 30)
		return (
			<p className="ta-error">
				Grid is {rows}×{cols} — that looks wrong (a row/col is probably mistyped).
			</p>
		);

	return (
		<div
			style={{
				display: "inline-grid",
				gridTemplateColumns: `repeat(${cols}, 30px)`,
				gap: 1,
				background: "#031025",
				border: "2px solid #031025",
			}}
		>
			{Array.from({ length: rows * cols }, (_, i) => {
				const r = Math.floor(i / cols);
				const c = i % cols;
				const letter = grid.get(`${r},${c}`);
				const num = numbers.get(`${r},${c}`);
				return (
					<div
						key={i}
						style={{
							width: 30,
							height: 30,
							background: letter ? "#fff" : "#031025",
							position: "relative",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontWeight: 700,
							fontSize: 14,
						}}
					>
						{num && <span style={{ position: "absolute", top: 0, left: 2, fontSize: 8, fontWeight: 600 }}>{num}</span>}
						{letter}
					</div>
				);
			})}
		</div>
	);
}

function CrosswordEditor() {
	const { supabase } = useAdmin();
	const [list, setList] = useState<CrosswordRow[]>([]);
	const [selected, setSelected] = useState<number | "new" | null>(null);
	const [meta, setMeta] = useState({ date: "", title: "", author: "" });
	const [entries, setEntries] = useState<ClueEntry[]>([]);
	const [jsonMode, setJsonMode] = useState(false);
	const [jsonText, setJsonText] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

	const load = useCallback(async () => {
		const { data, error } = await supabase.from("crossword").select("id, date, title, author, clues").order("date", { ascending: false });
		if (error) {
			setMsg({ err: error.message });
			return;
		}
		setList((data ?? []) as CrosswordRow[]);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	const open = (row: CrosswordRow) => {
		try {
			setEntries(cluesToEntries(row.clues));
			setJsonText(row.clues);
		} catch {
			setEntries([]);
			setJsonText(row.clues);
			setJsonMode(true);
			setMsg({ err: "Stored clues JSON didn't parse — fix it in JSON mode." });
		}
		setSelected(row.id);
		setMeta({ date: row.date, title: row.title ?? "", author: row.author });
		setMsg({});
	};

	const startNew = () => {
		setSelected("new");
		setMeta({ date: new Date().toISOString().slice(0, 10), title: "", author: "" });
		setEntries([]);
		setJsonText('{\n  "across": {},\n  "down": {}\n}');
		setMsg({});
	};

	const problems = useMemo(() => validate(entries), [entries]);

	const switchMode = (toJson: boolean) => {
		if (toJson === jsonMode) return;
		if (toJson) {
			setJsonText(entriesToClues(entries));
			setJsonMode(true);
		} else {
			try {
				setEntries(cluesToEntries(jsonText));
				setJsonMode(false);
			} catch (e) {
				setMsg({ err: `JSON doesn't parse: ${e instanceof Error ? e.message : e}` });
			}
		}
	};

	const save = async () => {
		setBusy(true);
		setMsg({});
		try {
			let cluesJson: string;
			if (jsonMode) {
				const parsed = JSON.parse(jsonText); // throws if invalid
				for (const dir of ["across", "down"]) {
					for (const key of Object.keys(parsed?.[dir] ?? {})) {
						if (!/^\d+$/.test(key)) throw new Error(`Clue key "${key}" in ${dir} is not numeric — this would crash the app.`);
					}
				}
				cluesJson = jsonText;
			} else {
				if (problems.length) throw new Error("Fix the validation problems first.");
				if (entries.length === 0) throw new Error("No clues yet.");
				cluesJson = entriesToClues(entries);
			}
			if (!meta.date) throw new Error("A publish date is required (the archive is dated).");
			if (!meta.author.trim()) throw new Error("Author is required.");

			const payload = { date: meta.date, title: meta.title.trim() || null, author: meta.author.trim(), clues: cluesJson };
			if (selected === "new") {
				const { error } = await supabase.from("crossword").insert(payload);
				if (error) throw error;
			} else {
				const { error, data } = await supabase.from("crossword").update(payload).eq("id", selected).select("id");
				if (error) throw error;
				if (!data?.length) throw new Error("Save was blocked — are you signed in as an editor?");
			}
			await load();
			setMsg({ ok: "Saved." });
			if (selected === "new") setSelected(null);
		} catch (e) {
			setMsg({ err: e instanceof Error ? e.message : String(e) });
		}
		setBusy(false);
	};

	const patchEntry = (key: string, patch: Partial<ClueEntry>) => setEntries(prev => prev.map(e => (e.key === key ? { ...e, ...patch } : e)));

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<select
					value={selected === null ? "" : selected}
					onChange={e => {
						if (e.target.value === "new") startNew();
						else {
							const row = list.find(r => r.id === Number(e.target.value));
							if (row) open(row);
						}
					}}
					style={{ maxWidth: 360 }}
				>
					<option value="" disabled>
						Pick a crossword…
					</option>
					{list.map(r => (
						<option key={r.id} value={r.id}>
							{r.date} — {r.title || `Crossword #${r.id}`} ({r.author})
						</option>
					))}
					<option value="new">+ New crossword…</option>
				</select>
			</div>

			{selected !== null && (
				<>
					<div className="ta-card ta-row">
						<label style={{ margin: 0 }}>
							Publish date
							<input type="date" value={meta.date} onChange={e => setMeta({ ...meta, date: e.target.value })} />
						</label>
						<label style={{ margin: 0, minWidth: 220 }}>
							Title
							<input
								type="text"
								value={meta.title}
								placeholder="(optional)"
								onChange={e => setMeta({ ...meta, title: e.target.value })}
							/>
						</label>
						<label style={{ margin: 0, minWidth: 200 }}>
							Author
							<input type="text" value={meta.author} onChange={e => setMeta({ ...meta, author: e.target.value })} />
						</label>
					</div>

					<div className="ta-tabs">
						<button className={!jsonMode ? "active" : ""} onClick={() => switchMode(false)}>
							Clue editor
						</button>
						<button className={jsonMode ? "active" : ""} onClick={() => switchMode(true)}>
							Raw JSON
						</button>
					</div>

					{jsonMode ? (
						<textarea rows={16} value={jsonText} onChange={e => setJsonText(e.target.value)} style={{ fontFamily: "monospace" }} />
					) : (
						<>
							<div className="ta-table-wrap">
								<table className="ta-table">
									<thead>
										<tr>
											<th style={{ width: 100 }}>Dir</th>
											<th style={{ width: 70 }}>No.</th>
											<th>Clue</th>
											<th style={{ width: 140 }}>Answer</th>
											<th style={{ width: 70 }}>Row</th>
											<th style={{ width: 70 }}>Col</th>
											<th style={{ width: 60 }} />
										</tr>
									</thead>
									<tbody>
										{entries.map(e => (
											<tr key={e.key}>
												<td>
													<select
														value={e.dir}
														onChange={ev => patchEntry(e.key, { dir: ev.target.value as "across" | "down" })}
													>
														<option value="across">Across</option>
														<option value="down">Down</option>
													</select>
												</td>
												<td>
													<input
														type="text"
														value={e.number}
														onChange={ev => patchEntry(e.key, { number: ev.target.value })}
													/>
												</td>
												<td>
													<input type="text" value={e.clue} onChange={ev => patchEntry(e.key, { clue: ev.target.value })} />
												</td>
												<td>
													<input
														type="text"
														value={e.answer}
														style={{ textTransform: "uppercase", fontFamily: "monospace" }}
														onChange={ev => patchEntry(e.key, { answer: ev.target.value })}
													/>
												</td>
												<td>
													<input
														type="number"
														value={e.row}
														min={0}
														onChange={ev => patchEntry(e.key, { row: Number(ev.target.value) })}
													/>
												</td>
												<td>
													<input
														type="number"
														value={e.col}
														min={0}
														onChange={ev => patchEntry(e.key, { col: Number(ev.target.value) })}
													/>
												</td>
												<td>
													<button
														className="ta-btn ta-btn-small ta-btn-ghost-danger"
														onClick={() => setEntries(prev => prev.filter(x => x.key !== e.key))}
													>
														✕
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div>
								<button
									className="ta-btn"
									onClick={() =>
										setEntries(prev => [
											...prev,
											{ key: nextCk(), dir: "across", number: "", clue: "", answer: "", row: 0, col: 0 },
										])
									}
								>
									+ Add clue
								</button>
							</div>
							{problems.length > 0 && (
								<div className="ta-card" style={{ borderLeft: "4px solid #a8133f" }}>
									{problems.slice(0, 8).map((p, i) => (
										<p key={i} className="ta-error" style={{ margin: "2px 0" }}>
											{p}
										</p>
									))}
									{problems.length > 8 && <p className="ta-muted">…and {problems.length - 8} more.</p>}
								</div>
							)}
							<div>
								<h3 style={{ fontSize: 14, marginBottom: 6 }}>Grid preview</h3>
								<GridPreview entries={entries} />
							</div>
						</>
					)}

					<div className="ta-row">
						<button className="ta-btn ta-btn-primary" disabled={busy || (!jsonMode && problems.length > 0)} onClick={() => void save()}>
							{busy ? "Saving…" : selected === "new" ? "Publish crossword" : "Save changes"}
						</button>
						{msg.ok && <span className="ta-ok">{msg.ok}</span>}
						{msg.err && <span className="ta-error">{msg.err}</span>}
					</div>
				</>
			)}
		</div>
	);
}

export default function CrosswordPage() {
	return (
		<AdminShell title="Crossword uploader" wide>
			<CrosswordEditor />
		</AdminShell>
	);
}
