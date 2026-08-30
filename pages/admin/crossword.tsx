/** @format */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";

// crossword.clues is a JSON STRING (text column):
//   { "across": { "1": {clue, answer, row, col}, ... }, "down": { ... } }
// CRITICAL app constraint: clue keys are parsed as integers, and a non-numeric
// key crashes the app. The builder only ever writes numbers it computed itself
// from the grid, so a bad key can no longer be typed in by hand.

import {
	BLACK,
	buildCluesJson,
	clueKey,
	computeEntries,
	gridFromClues,
	isBlack,
	makeGrid,
	MAX_SIZE,
	MIN_SIZE,
	orphanCells,
	type Dir,
	type Entry,
	type Grid,
} from "~/lib/console/crossword-grid";

type Step = "size" | "blocks" | "letters";

interface CrosswordRow {
	id: number;
	date: string;
	title: string | null;
	author: string;
	clues: string;
}

// ─── the grid ────────────────────────────────────────────────────────────────

function GridEditor({
	grid,
	numbers,
	mode,
	selected,
	highlight,
	onCellClick,
	onKeyDown,
	gridRef,
}: {
	grid: Grid;
	numbers: Map<string, number>;
	mode: "blocks" | "letters";
	selected: { r: number; c: number } | null;
	highlight: Set<string>;
	onCellClick: (r: number, c: number) => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
	gridRef: React.RefObject<HTMLDivElement>;
}) {
	const cols = grid[0]?.length ?? 0;
	return (
		<div
			className="ta-xw-grid"
			ref={gridRef}
			tabIndex={0}
			onKeyDown={onKeyDown}
			style={{ gridTemplateColumns: `repeat(${cols}, var(--xw-cell))` }}
			aria-label={mode === "blocks" ? "Click squares to make them black" : "Type letters into the grid"}
		>
			{grid.map((rowCells, r) =>
				rowCells.map((cell, c) => {
					const black = cell === BLACK;
					const isSel = selected?.r === r && selected?.c === c;
					const inWord = highlight.has(`${r},${c}`);
					const number = numbers.get(`${r},${c}`);
					return (
						<div
							key={`${r},${c}`}
							className={`ta-xw-cell${black ? " black" : ""}${isSel ? " selected" : ""}${inWord && !isSel ? " in-word" : ""}`}
							onMouseDown={e => {
								e.preventDefault();
								onCellClick(r, c);
							}}
						>
							{!black && number !== undefined && <span className="ta-xw-num">{number}</span>}
							{!black && <span className="ta-xw-letter">{cell}</span>}
						</div>
					);
				})
			)}
		</div>
	);
}

// ─── the clue dialog ─────────────────────────────────────────────────────────

function ClueDialog({
	entries,
	clues,
	onChange,
	onClose,
	onSave,
	busy,
	error,
}: {
	entries: Entry[];
	clues: Record<string, string>;
	onChange: (key: string, value: string) => void;
	onClose: () => void;
	onSave: () => void;
	busy: boolean;
	error: string | null;
}) {
	const written = entries.filter(e => (clues[clueKey(e.dir, e.row, e.col)] ?? "").trim()).length;

	const section = (dir: Dir) => {
		const list = entries.filter(e => e.dir === dir);
		return (
			<div className="ta-xw-cluecol">
				<h3>{dir === "across" ? "Across" : "Down"}</h3>
				{list.length === 0 && <p className="ta-muted ta-small">No {dir} entries.</p>}
				{list.map(e => {
					const key = clueKey(e.dir, e.row, e.col);
					return (
						<label key={key} className="ta-xw-clue">
							<span className="ta-xw-clue-head">
								<b>{e.number}</b> <code>{e.answer}</code>
							</span>
							<input
								type="text"
								value={clues[key] ?? ""}
								placeholder={`Clue for ${e.answer}`}
								onChange={ev => onChange(key, ev.target.value)}
							/>
						</label>
					);
				})}
			</div>
		);
	};

	return (
		<div className="ta-xw-scrim" onMouseDown={onClose}>
			<div className="ta-xw-dialog" onMouseDown={e => e.stopPropagation()}>
				<div className="ta-row ta-spread">
					<h2>Write the clues</h2>
					<span className="ta-badge">
						{written} of {entries.length} written
					</span>
				</div>
				<div className="ta-xw-clues">
					{section("across")}
					{section("down")}
				</div>
				{error && <p className="ta-error">{error}</p>}
				<div className="ta-row">
					<button className="ta-btn ta-btn-primary" onClick={onSave} disabled={busy}>
						{busy ? "Saving…" : "Save crossword"}
					</button>
					<button className="ta-btn" onClick={onClose} disabled={busy}>
						Back to the grid
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── the builder ─────────────────────────────────────────────────────────────

function CrosswordEditor() {
	const { supabase } = useAdmin();
	const gridRef = useRef<HTMLDivElement>(null);

	const [list, setList] = useState<CrosswordRow[]>([]);
	const [selectedRow, setSelectedRow] = useState<number | "new" | null>(null);
	const [meta, setMeta] = useState({ date: "", title: "", author: "" });

	const [step, setStep] = useState<Step>("size");
	const [size, setSize] = useState({ rows: 5, cols: 5 });
	const [grid, setGrid] = useState<Grid>(() => makeGrid(5, 5));
	const [clues, setClues] = useState<Record<string, string>>({});
	const [symmetry, setSymmetry] = useState(true);

	const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);
	const [dir, setDir] = useState<Dir>("across");
	const [showClues, setShowClues] = useState(false);

	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
	const [repairJson, setRepairJson] = useState<string | null>(null);

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

	const { entries, numbers } = useMemo(() => computeEntries(grid), [grid]);
	const orphans = useMemo(() => orphanCells(grid, entries), [grid, entries]);
	const blanks = useMemo(() => grid.flat().filter(cell => cell === "").length, [grid]);
	const missingClues = entries.filter(e => !(clues[clueKey(e.dir, e.row, e.col)] ?? "").trim());

	const openRow = (row: CrosswordRow) => {
		setSelectedRow(row.id);
		setMeta({ date: row.date, title: row.title ?? "", author: row.author });
		setMsg({});
		setRepairJson(null);
		setCursor(null);
		setShowClues(false);
		try {
			const rebuilt = gridFromClues(row.clues);
			setGrid(rebuilt.grid);
			setClues(rebuilt.clues);
			setSize({ rows: rebuilt.grid.length, cols: rebuilt.grid[0]?.length ?? 0 });
			setStep("letters");
		} catch (e) {
			// Only reachable for a row written before this builder existed, or one
			// hand-edited into a shape the grid cannot represent.
			setRepairJson(row.clues);
			setMsg({ err: `This crossword could not be opened in the grid: ${e instanceof Error ? e.message : e}` });
		}
	};

	const startNew = () => {
		setSelectedRow("new");
		setMeta({ date: new Date().toISOString().slice(0, 10), title: "", author: "" });
		setSize({ rows: 5, cols: 5 });
		setGrid(makeGrid(5, 5));
		setClues({});
		setCursor(null);
		setStep("size");
		setMsg({});
		setRepairJson(null);
		setShowClues(false);
	};

	const applySize = () => {
		const rows = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size.rows) || MIN_SIZE));
		const cols = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size.cols) || MIN_SIZE));
		setSize({ rows, cols });
		setGrid(prev => makeGrid(rows, cols, prev));
		setCursor(null);
		setStep("blocks");
	};

	const toggleBlack = (r: number, c: number) => {
		setGrid(prev => {
			const next = prev.map(row => [...row]);
			const becomingBlack = next[r][c] !== BLACK;
			next[r][c] = becomingBlack ? BLACK : "";
			if (symmetry) {
				// Crosswords are conventionally symmetric under a 180 degree turn.
				const sr = prev.length - 1 - r;
				const sc = (prev[0]?.length ?? 0) - 1 - c;
				if ((sr !== r || sc !== c) && next[sr] && next[sr][sc] !== undefined) next[sr][sc] = becomingBlack ? BLACK : "";
			}
			return next;
		});
	};

	const wordCells = useMemo(() => {
		const set = new Set<string>();
		if (!cursor || isBlack(grid, cursor.r, cursor.c)) return set;
		if (dir === "across") {
			let c = cursor.c;
			while (!isBlack(grid, cursor.r, c - 1)) c--;
			for (; !isBlack(grid, cursor.r, c); c++) set.add(`${cursor.r},${c}`);
		} else {
			let r = cursor.r;
			while (!isBlack(grid, r - 1, cursor.c)) r--;
			for (; !isBlack(grid, r, cursor.c); r++) set.add(`${r},${cursor.c}`);
		}
		return set;
	}, [cursor, dir, grid]);

	const onCellClick = (r: number, c: number) => {
		gridRef.current?.focus();
		if (step === "blocks") {
			toggleBlack(r, c);
			return;
		}
		if (isBlack(grid, r, c)) return;
		if (cursor && cursor.r === r && cursor.c === c) setDir(d => (d === "across" ? "down" : "across"));
		else setCursor({ r, c });
	};

	const advance = (r: number, c: number, back: boolean) => {
		const d = back ? -1 : 1;
		return dir === "across" ? { r, c: c + d } : { r: r + d, c };
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (step !== "letters" || !cursor) return;
		const { r, c } = cursor;
		const rows = grid.length;
		const cols = grid[0]?.length ?? 0;
		const inside = (p: { r: number; c: number }) => p.r >= 0 && p.c >= 0 && p.r < rows && p.c < cols;

		if (e.key === " ") {
			e.preventDefault();
			setDir(d => (d === "across" ? "down" : "across"));
			return;
		}
		if (e.key.startsWith("Arrow")) {
			e.preventDefault();
			const delta =
				e.key === "ArrowLeft"
					? { r: 0, c: -1 }
					: e.key === "ArrowRight"
					? { r: 0, c: 1 }
					: e.key === "ArrowUp"
					? { r: -1, c: 0 }
					: { r: 1, c: 0 };
			const next = { r: r + delta.r, c: c + delta.c };
			if (inside(next)) setCursor(next);
			return;
		}
		if (e.key === "Backspace" || e.key === "Delete") {
			e.preventDefault();
			const back = advance(r, c, true);
			const clearBehind = !grid[r][c] && inside(back) && !isBlack(grid, back.r, back.c);
			setGrid(prev => {
				const next = prev.map(row => [...row]);
				if (next[r][c]) next[r][c] = "";
				else if (clearBehind) next[back.r][back.c] = "";
				return next;
			});
			if (clearBehind) setCursor(back);
			return;
		}
		if (/^[a-zA-Z]$/.test(e.key)) {
			e.preventDefault();
			const letter = e.key.toUpperCase();
			setGrid(prev => {
				const next = prev.map(row => [...row]);
				next[r][c] = letter;
				return next;
			});
			const forward = advance(r, c, false);
			if (inside(forward) && !isBlack(grid, forward.r, forward.c)) setCursor(forward);
		}
	};

	const save = async () => {
		setBusy(true);
		setMsg({});
		try {
			if (!meta.date) throw new Error("A publish date is required (the archive is dated).");
			if (!meta.author.trim()) throw new Error("Author is required.");
			if (!entries.length) throw new Error("The grid has no entries yet.");
			if (blanks > 0) throw new Error(`${blanks} square${blanks === 1 ? " is" : "s are"} still empty.`);
			if (orphans.length) throw new Error(`A white square at row ${orphans[0].r + 1}, column ${orphans[0].c + 1} is not part of any word.`);
			if (missingClues.length) throw new Error(`${missingClues.length} clue${missingClues.length === 1 ? "" : "s"} still need writing.`);

			const payload = {
				date: meta.date,
				title: meta.title.trim() || null,
				author: meta.author.trim(),
				clues: buildCluesJson(entries, clues),
			};
			if (selectedRow === "new") {
				const { error } = await supabase.from("crossword").insert(payload);
				if (error) throw error;
			} else {
				const { error, data } = await supabase.from("crossword").update(payload).eq("id", selectedRow).select("id");
				if (error) throw error;
				if (!data?.length) throw new Error("Save was blocked. Are you signed in as an editor?");
			}
			await load();
			setShowClues(false);
			setMsg({ ok: "Saved." });
			if (selectedRow === "new") setSelectedRow(null);
		} catch (e) {
			setMsg({ err: e instanceof Error ? e.message : String(e) });
		}
		setBusy(false);
	};

	const gridReady = entries.length > 0 && blanks === 0 && orphans.length === 0;
	const started = grid.flat().some(Boolean);

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<select
					value={selectedRow === null ? "" : selectedRow}
					onChange={e => {
						if (e.target.value === "new") startNew();
						else {
							const row = list.find(r => r.id === Number(e.target.value));
							if (row) openRow(row);
						}
					}}
					style={{ maxWidth: "22rem" }}
				>
					<option value="" disabled>
						Pick a crossword…
					</option>
					{list.map(r => (
						<option key={r.id} value={r.id}>
							{r.date} · {r.title || `Crossword #${r.id}`} ({r.author})
						</option>
					))}
					<option value="new">+ New crossword…</option>
				</select>
			</div>

			{repairJson !== null && (
				<div className="ta-card ta-stack">
					<b>Stored clues, for repair</b>
					<p className="ta-muted ta-small">
						The builder could not lay this one out on a grid, so nothing has been changed. The raw JSON is below.
					</p>
					{msg.err && <p className="ta-error">{msg.err}</p>}
					<pre className="ta-code">{repairJson}</pre>
				</div>
			)}

			{selectedRow !== null && repairJson === null && (
				<>
					<div className="ta-card ta-row">
						<label style={{ margin: 0 }}>
							Publish date
							<input type="date" value={meta.date} onChange={e => setMeta({ ...meta, date: e.target.value })} />
						</label>
						<label style={{ margin: 0, minWidth: "14rem" }}>
							Title
							<input type="text" value={meta.title} placeholder="(optional)" onChange={e => setMeta({ ...meta, title: e.target.value })} />
						</label>
						<label style={{ margin: 0, minWidth: "12rem" }}>
							Author
							<input type="text" value={meta.author} onChange={e => setMeta({ ...meta, author: e.target.value })} />
						</label>
					</div>

					<div className="ta-tabs">
						<button className={step === "size" ? "active" : ""} onClick={() => setStep("size")}>
							1. Size
						</button>
						<button className={step === "blocks" ? "active" : ""} onClick={() => setStep("blocks")}>
							2. Black squares
						</button>
						<button className={step === "letters" ? "active" : ""} onClick={() => setStep("letters")}>
							3. Letters
						</button>
						<button className={showClues ? "active" : ""} onClick={() => setShowClues(true)} disabled={!gridReady}>
							4. Clues
						</button>
					</div>

					{step === "size" && (
						<div className="ta-card ta-stack" style={{ maxWidth: "34rem" }}>
							<b>How big is the puzzle?</b>
							<div className="ta-row">
								<label style={{ margin: 0, maxWidth: "7rem" }}>
									Rows
									<input
										type="number"
										min={MIN_SIZE}
										max={MAX_SIZE}
										value={size.rows}
										onChange={e => setSize({ ...size, rows: Number(e.target.value) })}
									/>
								</label>
								<label style={{ margin: 0, maxWidth: "7rem" }}>
									Columns
									<input
										type="number"
										min={MIN_SIZE}
										max={MAX_SIZE}
										value={size.cols}
										onChange={e => setSize({ ...size, cols: Number(e.target.value) })}
									/>
								</label>
								<span className="ta-muted ta-small">
									{MIN_SIZE} to {MAX_SIZE} each way.
								</span>
							</div>
							<div className="ta-row">
								{[
									[5, 5],
									[7, 7],
									[11, 11],
									[15, 15],
								].map(([r, c]) => (
									<button key={`${r}x${c}`} className="ta-btn ta-btn-small" onClick={() => setSize({ rows: r, cols: c })}>
										{r}x{c}
									</button>
								))}
							</div>
							<div>
								<button className="ta-btn ta-btn-primary" onClick={applySize}>
									{started ? "Resize grid" : "Create grid"}
								</button>
							</div>
							{started && <p className="ta-muted ta-small">Resizing keeps whatever already fits inside the new shape.</p>}
						</div>
					)}

					{(step === "blocks" || step === "letters") && (
						<div className="ta-xw-layout">
							<div>
								<GridEditor
									grid={grid}
									numbers={numbers}
									mode={step}
									selected={step === "letters" ? cursor : null}
									highlight={step === "letters" ? wordCells : new Set()}
									onCellClick={onCellClick}
									onKeyDown={onKeyDown}
									gridRef={gridRef}
								/>
							</div>

							<div className="ta-stack">
								{step === "blocks" ? (
									<div className="ta-card ta-stack">
										<b>Click squares to black them out</b>
										<p className="ta-muted ta-small">
											Numbering updates as you go. Every white square has to belong to a word at least two squares long.
										</p>
										<label style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
											<input
												type="checkbox"
												checked={symmetry}
												onChange={e => setSymmetry(e.target.checked)}
												style={{ width: "auto" }}
											/>
											Mirror each square (180 degree symmetry)
										</label>
										<div className="ta-row">
											<button className="ta-btn" onClick={() => setGrid(makeGrid(size.rows, size.cols))}>
												Clear all
											</button>
											<button className="ta-btn ta-btn-primary" onClick={() => setStep("letters")}>
												Next: fill in letters
											</button>
										</div>
									</div>
								) : (
									<div className="ta-card ta-stack">
										<b>Type the answers</b>
										<p className="ta-muted ta-small">
											Click a square and type. Clicking the same square again switches between across and down, as does the space
											bar. Arrow keys move, backspace clears.
										</p>
										<p style={{ margin: 0 }}>
											Direction: <b>{dir === "across" ? "Across" : "Down"}</b> ·{" "}
											{blanks > 0 ? (
												<span className="ta-muted">
													{blanks} square{blanks === 1 ? "" : "s"} left
												</span>
											) : (
												<span className="ta-ok">grid complete</span>
											)}
										</p>
										<div className="ta-row">
											<button className="ta-btn" onClick={() => setStep("blocks")}>
												Back to black squares
											</button>
											<button className="ta-btn ta-btn-primary" onClick={() => setShowClues(true)} disabled={!gridReady}>
												Next: write the clues
											</button>
										</div>
									</div>
								)}

								<div className="ta-card">
									<b>
										{entries.length} entr{entries.length === 1 ? "y" : "ies"}
									</b>
									<p className="ta-muted ta-small" style={{ margin: 0 }}>
										{entries.filter(e => e.dir === "across").length} across, {entries.filter(e => e.dir === "down").length} down
									</p>
								</div>

								{orphans.length > 0 && (
									<p className="ta-error">
										{orphans.length} white square{orphans.length === 1 ? "" : "s"} belong to no word (first at row {orphans[0].r + 1},
										column {orphans[0].c + 1}). The app would drop {orphans.length === 1 ? "it" : "them"}.
									</p>
								)}
								{msg.ok && <p className="ta-ok">{msg.ok}</p>}
								{msg.err && !showClues && <p className="ta-error">{msg.err}</p>}
							</div>
						</div>
					)}

					{showClues && (
						<ClueDialog
							entries={entries}
							clues={clues}
							onChange={(key, value) => setClues(prev => ({ ...prev, [key]: value }))}
							onClose={() => setShowClues(false)}
							onSave={() => void save()}
							busy={busy}
							error={msg.err ?? null}
						/>
					)}

					{gridReady && (
						<details>
							<summary className="ta-muted ta-small">Show the JSON that will be saved</summary>
							<pre className="ta-code">{buildCluesJson(entries, clues)}</pre>
						</details>
					)}
				</>
			)}
		</div>
	);
}

export default function CrosswordPage() {
	return (
		<AdminShell title="Crossword builder" wide>
			<CrosswordEditor />
		</AdminShell>
	);
}
