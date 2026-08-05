/** @format */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { monthName } from "~/lib/console/supabase";

// The app's front page renders from a tiny DSL, one directive per line:
//   LargeArticle(123)      hero card
//   Sidescroll(4, 5, 6)    horizontal row of cards
//   Divider
//   Text("Header")         centered navy section header
// The app fetches the latest PUBLISHED row (year desc, month desc). This
// editor makes the layout reviewable at a glance — a joke header once shipped
// to the app from this table.

type Block =
	| { key: string; kind: "large"; ids: number[] }
	| { key: string; kind: "side"; ids: number[] }
	| { key: string; kind: "divider" }
	| { key: string; kind: "text"; text: string }
	| { key: string; kind: "raw"; line: string };

interface LayoutRow {
	id: number;
	layout: string;
	month: number;
	year: number;
	published: boolean;
}

interface ArticleLite {
	id: number;
	title: string;
	month: number;
	year: number;
	published: boolean;
}

let keyCounter = 0;
const nextKey = () => `b${++keyCounter}`;

function parseLayout(script: string): Block[] {
	const blocks: Block[] = [];
	for (const rawLine of script.split("\n")) {
		const line = rawLine.trim();
		if (!line) continue;
		let m: RegExpMatchArray | null;
		if ((m = line.match(/^LargeArticle\(\s*(\d+)\s*\)$/i))) {
			blocks.push({ key: nextKey(), kind: "large", ids: [Number(m[1])] });
		} else if ((m = line.match(/^Sidescroll\(\s*([\d\s,]*?)\s*\)$/i))) {
			const ids = m[1]
				.split(",")
				.map(s => s.trim())
				.filter(Boolean)
				.map(Number);
			blocks.push({ key: nextKey(), kind: "side", ids });
		} else if (/^Divider$/i.test(line)) {
			blocks.push({ key: nextKey(), kind: "divider" });
		} else if ((m = line.match(/^Text\(\s*"(.*)"\s*\)$/i))) {
			blocks.push({ key: nextKey(), kind: "text", text: m[1] });
		} else {
			// Comments (#...) and anything unrecognized survive round-trips.
			blocks.push({ key: nextKey(), kind: "raw", line });
		}
	}
	return blocks;
}

function serializeLayout(blocks: Block[]): string {
	return (
		blocks
			.map(b => {
				switch (b.kind) {
					case "large":
						return `LargeArticle(${b.ids[0] ?? ""})`;
					case "side":
						return `Sidescroll(${b.ids.join(", ")})`;
					case "divider":
						return "Divider";
					case "text":
						return `Text("${b.text.replace(/"/g, "'")}")`;
					case "raw":
						return b.line;
				}
			})
			.join("\n") + "\n"
	);
}

function allIds(blocks: Block[]): number[] {
	return blocks.flatMap(b => (b.kind === "large" || b.kind === "side" ? b.ids : []));
}

function ArticlePicker({ onPick, placeholder }: { onPick: (a: ArticleLite) => void; placeholder?: string }) {
	const { supabase } = useAdmin();
	const [term, setTerm] = useState("");
	const [results, setResults] = useState<ArticleLite[]>([]);
	const [open, setOpen] = useState(false);
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const close = (e: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, []);

	useEffect(() => {
		const t = setTimeout(async () => {
			const q = term.trim();
			if (!q) {
				setResults([]);
				return;
			}
			let query = supabase.from("article").select("id, title, month, year, published").order("id", { ascending: false }).limit(12);
			query = /^\d+$/.test(q) ? query.eq("id", Number(q)) : query.ilike("title", `%${q}%`);
			const { data } = await query;
			setResults((data ?? []) as ArticleLite[]);
			setOpen(true);
		}, 220);
		return () => clearTimeout(t);
	}, [supabase, term]);

	return (
		<div className="ta-picker" ref={boxRef}>
			<input
				type="search"
				value={term}
				placeholder={placeholder ?? "Add article by title or id…"}
				onChange={e => setTerm(e.target.value)}
				onFocus={() => results.length && setOpen(true)}
			/>
			{open && results.length > 0 && (
				<div className="ta-picker-results">
					{results.map(a => (
						<button
							key={a.id}
							type="button"
							onClick={() => {
								onPick(a);
								setTerm("");
								setOpen(false);
							}}
						>
							<b>#{a.id}</b> {a.title}{" "}
							<span className="ta-muted">
								{monthName(a.month)} {a.year}
								{a.published ? "" : " · UNPUBLISHED"}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function BlockCard({
	block,
	index,
	total,
	titles,
	duplicates,
	onChange,
	onMove,
	onDelete,
}: {
	block: Block;
	index: number;
	total: number;
	titles: Map<number, ArticleLite | null>;
	duplicates: Set<number>;
	onChange: (b: Block) => void;
	onMove: (from: number, dir: -1 | 1) => void;
	onDelete: () => void;
}) {
	const invalid =
		(block.kind === "large" || block.kind === "side") &&
		(block.ids.length === 0 || block.ids.some(id => titles.get(id) === null || duplicates.has(id)));

	const chip = (id: number, remove: () => void) => {
		const info = titles.get(id);
		const missing = info === null;
		const dup = duplicates.has(id);
		return (
			<span
				key={id}
				className={`ta-article-chip${missing || dup ? " missing" : ""}`}
				title={dup ? "Used more than once in this layout" : undefined}
			>
				<b>#{id}</b> {missing ? "⚠ not found" : info ? info.title.slice(0, 48) : "…"}
				{dup && <span className="ta-error">dup</span>}
				<button type="button" onClick={remove} aria-label="Remove">
					×
				</button>
			</span>
		);
	};

	return (
		<div className={`ta-layout-block${invalid ? " invalid" : ""}`}>
			<div className="ta-layout-move">
				<button disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Move up">
					▲
				</button>
				<button disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label="Move down">
					▼
				</button>
			</div>
			<div className="ta-layout-body">
				{block.kind === "large" && (
					<>
						<span className="ta-layout-kind">Hero card</span>
						<div>
							{block.ids.map(id => chip(id, () => onChange({ ...block, ids: [] })))}
							{block.ids.length === 0 && (
								<ArticlePicker placeholder="Pick the hero article…" onPick={a => onChange({ ...block, ids: [a.id] })} />
							)}
						</div>
					</>
				)}
				{block.kind === "side" && (
					<>
						<span className="ta-layout-kind">Sidescroll row</span>
						<div>{block.ids.map(id => chip(id, () => onChange({ ...block, ids: block.ids.filter(x => x !== id) })))}</div>
						<ArticlePicker onPick={a => !block.ids.includes(a.id) && onChange({ ...block, ids: [...block.ids, a.id] })} />
					</>
				)}
				{block.kind === "divider" && <span className="ta-layout-kind">— Divider —</span>}
				{block.kind === "text" && (
					<>
						<span className="ta-layout-kind">Section header</span>
						<input
							type="text"
							value={block.text}
							placeholder="This Week at PHS"
							onChange={e => onChange({ ...block, text: e.target.value })}
							style={{ fontWeight: 700, color: "#031025" }}
						/>
					</>
				)}
				{block.kind === "raw" && (
					<>
						<span className="ta-layout-kind">{block.line.startsWith("#") ? "Comment" : "⚠ Unrecognized line"}</span>
						<input
							type="text"
							value={block.line}
							onChange={e => onChange({ ...block, line: e.target.value })}
							style={{ fontFamily: "monospace" }}
						/>
					</>
				)}
			</div>
			<button className="ta-btn ta-btn-small ta-btn-ghost-danger" onClick={onDelete}>
				Delete
			</button>
		</div>
	);
}

function LayoutEditor() {
	const { supabase } = useAdmin();
	const [rows, setRows] = useState<LayoutRow[]>([]);
	const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [meta, setMeta] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), published: false });
	const [titles, setTitles] = useState<Map<number, ArticleLite | null>>(new Map());
	const [tab, setTab] = useState<"visual" | "raw">("visual");
	const [rawText, setRawText] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

	const loadRows = useCallback(async () => {
		const { data, error } = await supabase
			.from("app_layout")
			.select("id, layout, month, year, published")
			.order("year", { ascending: false })
			.order("month", { ascending: false })
			.order("id", { ascending: false });
		if (error) {
			setMsg({ err: error.message });
			return [] as LayoutRow[];
		}
		const list = (data ?? []) as LayoutRow[];
		setRows(list);
		return list;
	}, [supabase]);

	useEffect(() => {
		void loadRows().then(list => {
			if (list.length && selectedId === null) selectRow(list[0]);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loadRows]);

	// The row the app is actually showing right now: latest published.
	const liveRowId = useMemo(() => {
		const published = rows.filter(r => r.published);
		return published.length ? published[0].id : null;
	}, [rows]);

	const selectRow = (row: LayoutRow) => {
		setSelectedId(row.id);
		setBlocks(parseLayout(row.layout));
		setRawText(row.layout);
		setMeta({ month: row.month, year: row.year, published: row.published });
		setMsg({});
	};

	const startNew = () => {
		const now = new Date();
		setSelectedId("new");
		setBlocks([]);
		setRawText("");
		setMeta({ month: now.getMonth() + 1, year: now.getFullYear(), published: false });
		setMsg({});
	};

	// Resolve all referenced article ids to titles (validates existence).
	const idsInLayout = useMemo(() => allIds(blocks), [blocks]);
	useEffect(() => {
		const missing = idsInLayout.filter(id => !titles.has(id));
		if (missing.length === 0) return;
		let cancelled = false;
		void (async () => {
			const { data } = await supabase.from("article").select("id, title, month, year, published").in("id", missing);
			if (cancelled) return;
			setTitles(prev => {
				const next = new Map(prev);
				for (const id of missing) next.set(id, null);
				for (const a of (data ?? []) as ArticleLite[]) next.set(a.id, a);
				return next;
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [supabase, idsInLayout, titles]);

	const duplicates = useMemo(() => {
		const seen = new Set<number>();
		const dups = new Set<number>();
		for (const id of idsInLayout) (seen.has(id) ? dups : seen).add(id);
		return dups;
	}, [idsInLayout]);

	const missingIds = idsInLayout.filter(id => titles.get(id) === null);
	const script = useMemo(() => serializeLayout(blocks), [blocks]);
	const hardInvalid =
		duplicates.size > 0 || missingIds.length > 0 || blocks.some(b => (b.kind === "large" || b.kind === "side") && b.ids.length === 0);

	const switchTab = (next: "visual" | "raw") => {
		if (next === tab) return;
		if (next === "raw") setRawText(script);
		else setBlocks(parseLayout(rawText));
		setTab(next);
	};

	const save = async () => {
		setBusy(true);
		setMsg({});
		const layoutText = tab === "raw" ? rawText : script;
		try {
			if (selectedId === "new") {
				const { data, error } = await supabase
					.from("app_layout")
					.insert({ layout: layoutText, month: meta.month, year: meta.year, published: meta.published })
					.select("id, layout, month, year, published")
					.single();
				if (error) throw error;
				await loadRows();
				selectRow(data as LayoutRow);
			} else if (typeof selectedId === "number") {
				const { error, data } = await supabase
					.from("app_layout")
					.update({ layout: layoutText, month: meta.month, year: meta.year, published: meta.published })
					.eq("id", selectedId)
					.select("id");
				if (error) throw error;
				if (!data?.length) throw new Error("Save was blocked (no rows updated) — are you signed in as an editor?");
				await loadRows();
			}
			setMsg({ ok: "Saved." });
		} catch (e) {
			setMsg({ err: e instanceof Error ? e.message : String(e) });
		}
		setBusy(false);
	};

	const addBlock = (kind: Block["kind"]) => {
		const base = { key: nextKey() };
		const block: Block =
			kind === "large"
				? { ...base, kind: "large", ids: [] }
				: kind === "side"
				? { ...base, kind: "side", ids: [] }
				: kind === "text"
				? { ...base, kind: "text", text: "" }
				: kind === "raw"
				? { ...base, kind: "raw", line: "# comment" }
				: { ...base, kind: "divider" };
		setBlocks(prev => [...prev, block]);
	};

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<select
					value={selectedId === null ? "" : selectedId}
					onChange={e => {
						if (e.target.value === "new") startNew();
						else {
							const row = rows.find(r => r.id === Number(e.target.value));
							if (row) selectRow(row);
						}
					}}
					style={{ maxWidth: 320 }}
				>
					<option value="" disabled>
						Pick a layout…
					</option>
					{rows.map(r => (
						<option key={r.id} value={r.id}>
							{monthName(r.month)} {r.year} — #{r.id}
							{r.published ? " · published" : ""}
							{r.id === liveRowId ? " · LIVE IN APP" : ""}
						</option>
					))}
					<option value="new">+ New layout…</option>
				</select>
				{typeof selectedId === "number" && selectedId === liveRowId && <span className="ta-badge red">LIVE IN APP</span>}
			</div>

			{selectedId !== null && (
				<>
					<div className="ta-card ta-row">
						<label style={{ margin: 0 }}>
							Month
							<select value={meta.month} onChange={e => setMeta({ ...meta, month: Number(e.target.value) })}>
								{Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
									<option key={m} value={m}>
										{monthName(m)}
									</option>
								))}
							</select>
						</label>
						<label style={{ margin: 0, maxWidth: 110 }}>
							Year
							<input type="number" value={meta.year} onChange={e => setMeta({ ...meta, year: Number(e.target.value) })} />
						</label>
						<label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
							<input
								type="checkbox"
								checked={meta.published}
								onChange={e => setMeta({ ...meta, published: e.target.checked })}
								style={{ width: "auto" }}
							/>
							Published (the app shows the latest published layout)
						</label>
					</div>

					<div className="ta-tabs">
						<button className={tab === "visual" ? "active" : ""} onClick={() => switchTab("visual")}>
							Visual editor
						</button>
						<button className={tab === "raw" ? "active" : ""} onClick={() => switchTab("raw")}>
							Raw script
						</button>
					</div>

					{tab === "visual" ? (
						<>
							<div className="ta-stack">
								{blocks.map((b, i) => (
									<BlockCard
										key={b.key}
										block={b}
										index={i}
										total={blocks.length}
										titles={titles}
										duplicates={duplicates}
										onChange={nb => setBlocks(prev => prev.map(x => (x.key === b.key ? nb : x)))}
										onMove={(from, dir) =>
											setBlocks(prev => {
												const next = [...prev];
												const [item] = next.splice(from, 1);
												next.splice(from + dir, 0, item);
												return next;
											})
										}
										onDelete={() => setBlocks(prev => prev.filter(x => x.key !== b.key))}
									/>
								))}
								{blocks.length === 0 && <p className="ta-muted">Empty layout — add blocks below.</p>}
							</div>
							<div className="ta-row">
								<button className="ta-btn" onClick={() => addBlock("large")}>
									+ Hero card
								</button>
								<button className="ta-btn" onClick={() => addBlock("side")}>
									+ Sidescroll
								</button>
								<button className="ta-btn" onClick={() => addBlock("text")}>
									+ Section header
								</button>
								<button className="ta-btn" onClick={() => addBlock("divider")}>
									+ Divider
								</button>
							</div>
							<div>
								<h3 style={{ fontSize: 14, marginBottom: 6 }}>Script preview</h3>
								<pre className="ta-code">{script || "(empty)"}</pre>
							</div>
						</>
					) : (
						<textarea rows={14} value={rawText} onChange={e => setRawText(e.target.value)} style={{ fontFamily: "monospace" }} />
					)}

					{missingIds.length > 0 && (
						<p className="ta-error">Unknown article ids: {missingIds.join(", ")} — they don&rsquo;t exist in the article table.</p>
					)}
					{duplicates.size > 0 && (
						<p className="ta-error">Duplicate article ids: {Array.from(duplicates).join(", ")} — each article may appear once.</p>
					)}

					<div className="ta-row">
						<button className="ta-btn ta-btn-primary" disabled={busy || (tab === "visual" && hardInvalid)} onClick={save}>
							{busy ? "Saving…" : selectedId === "new" ? "Create layout" : "Save layout"}
						</button>
						{msg.ok && <span className="ta-ok">{msg.ok}</span>}
						{msg.err && <span className="ta-error">{msg.err}</span>}
					</div>
				</>
			)}
		</div>
	);
}

export default function LayoutPage() {
	return (
		<AdminShell title="App front-page layout">
			<LayoutEditor />
		</AdminShell>
	);
}
