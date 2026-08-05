/** @format */

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";

// Schedule reference data for the PHS Tower app. Load-bearing semantics:
//   * school_day: ABSENCE of a row means NO SCHOOL. Weekends/holidays/summer
//     are simply not rows. Clearing a date = deleting its row.
//   * period_time: one row per block in clock order; a period that doesn't
//     meet on a day type has no row; period IS NULL rows are Lunch/Advisory
//     and the app shows them.
//   * teacher: NEVER deleted (enrollment FKs restrict) — toggle active.
//   * term: S1/S2 only. Full-year courses are two enrollments; no FY term.
// The app caches this data ~12h.

interface DayType {
	code: string;
	label: string;
	sort_order: number;
}
interface SchoolDay {
	day: string;
	type_code: string;
	note: string | null;
}
interface PeriodTime {
	id: number;
	type_code: string;
	period: number | null;
	label: string;
	starts_at: string;
	ends_at: string;
}
interface Teacher {
	id: number;
	first_name: string;
	last_name: string;
	department: string | null;
	active: boolean;
}
interface Term {
	code: string;
	label: string;
	starts_on: string;
	ends_on: string;
	sort_order: number;
}

function isoOf(y: number, m: number, d: number) {
	return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function* eachWeekday(startIso: string, endIso: string) {
	const [sy, sm, sd] = startIso.split("-").map(Number);
	const [ey, em, ed] = endIso.split("-").map(Number);
	const cur = new Date(sy, sm - 1, sd, 12);
	const end = new Date(ey, em - 1, ed, 12);
	while (cur <= end) {
		const dow = cur.getDay();
		if (dow !== 0 && dow !== 6) yield isoOf(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
		cur.setDate(cur.getDate() + 1);
	}
}

// ─── Calendar tab ────────────────────────────────────────────────────────────

function GenerateYear({
	dayTypes,
	onApply,
	busy,
}: {
	dayTypes: DayType[];
	onApply: (rows: SchoolDay[], clearStart: string, clearEnd: string) => void;
	busy: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [first, setFirst] = useState("");
	const [last, setLast] = useState("");
	const [cycle, setCycle] = useState("A,B,C,D");
	const [closures, setClosures] = useState("");
	const [overrides, setOverrides] = useState("");
	const [preview, setPreview] = useState<SchoolDay[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	const build = () => {
		setError(null);
		setPreview(null);
		try {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || !/^\d{4}-\d{2}-\d{2}$/.test(last)) throw new Error("First/last day must be YYYY-MM-DD.");
			const cycleArr = cycle
				.split(",")
				.map(s => s.trim())
				.filter(Boolean);
			if (!cycleArr.length) throw new Error("Rotation cycle is empty.");
			const known = new Set(dayTypes.map(t => t.code));
			for (const c of cycleArr) if (!known.has(c)) throw new Error(`Cycle day type "${c}" is not in day_type.`);

			const closed = new Set<string>();
			for (const raw of closures.split("\n")) {
				const entry = raw.split("#")[0].trim();
				if (!entry) continue;
				if (entry.includes("..")) {
					const [a, b] = entry.split("..").map(s => s.trim());
					for (const d of eachWeekday(a, b)) closed.add(d);
				} else {
					if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) throw new Error(`Bad closure date: "${entry}"`);
					closed.add(entry);
				}
			}

			// date=TYPE|optional note   (rotation still advances on overrides)
			const over = new Map<string, { type: string; note: string | null }>();
			for (const raw of overrides.split("\n")) {
				const entry = raw.trim();
				if (!entry) continue;
				const m = entry.match(/^(\d{4}-\d{2}-\d{2})\s*=\s*([A-Za-z0-9_]+)\s*(?:\|(.*))?$/);
				if (!m) throw new Error(`Bad override line: "${entry}" (want date=TYPE|note)`);
				if (!known.has(m[2])) throw new Error(`Override day type "${m[2]}" is not in day_type.`);
				over.set(m[1], { type: m[2], note: m[3]?.trim() || null });
			}

			const rows: SchoolDay[] = [];
			let ix = 0;
			for (const day of eachWeekday(first, last)) {
				if (closed.has(day)) continue;
				const ov = over.get(day);
				rows.push(ov ? { day, type_code: ov.type, note: ov.note } : { day, type_code: cycleArr[ix % cycleArr.length], note: null });
				ix++; // the rotation advances only on school days; overrides still consume a cycle slot
			}
			setPreview(rows);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};

	if (!open)
		return (
			<button className="ta-btn" onClick={() => setOpen(true)}>
				Generate year…
			</button>
		);

	return (
		<div className="ta-card ta-stack" style={{ borderLeft: "4px solid #072636" }}>
			<b>Generate a school year</b>
			<p className="ta-muted ta-small" style={{ margin: 0 }}>
				Weekends are skipped, closure dates are skipped (absence = no school), the rotation advances only on school days, and overrides (half
				days, delays) replace the day type while the rotation still advances. Applying REPLACES every row between first and last day.
			</p>
			<div className="ta-row">
				<label style={{ margin: 0 }}>
					First day
					<input type="date" value={first} onChange={e => setFirst(e.target.value)} />
				</label>
				<label style={{ margin: 0 }}>
					Last day
					<input type="date" value={last} onChange={e => setLast(e.target.value)} />
				</label>
				<label style={{ margin: 0, minWidth: 180 }}>
					Rotation cycle
					<input type="text" value={cycle} onChange={e => setCycle(e.target.value)} />
				</label>
			</div>
			<label style={{ margin: 0 }}>
				Closures — one per line: 2026-11-05 or 2026-12-24..2027-01-01 (# comments ok)
				<textarea
					rows={4}
					value={closures}
					onChange={e => setClosures(e.target.value)}
					placeholder={"2026-11-05\n2026-12-24..2027-01-01  # winter break"}
				/>
			</label>
			<label style={{ margin: 0 }}>
				Half-day / delay overrides — one per line: 2026-11-25=HALF|Early dismissal
				<textarea
					rows={3}
					value={overrides}
					onChange={e => setOverrides(e.target.value)}
					placeholder={"2026-11-25=HALF|Early dismissal — Thanksgiving"}
				/>
			</label>
			<div className="ta-row">
				<button className="ta-btn ta-btn-primary" onClick={build}>
					Preview
				</button>
				{preview && (
					<button className="ta-btn ta-btn-danger" disabled={busy} onClick={() => onApply(preview, first, last)}>
						{busy ? "Applying…" : `Apply — replaces ${first} → ${last} with ${preview.length} school days`}
					</button>
				)}
				<button className="ta-btn" onClick={() => setOpen(false)}>
					Close
				</button>
			</div>
			{error && <p className="ta-error">{error}</p>}
			{preview && (
				<p className="ta-ok">
					{preview.length} school days generated ({preview.filter(r => r.note).length} with notes).
				</p>
			)}
		</div>
	);
}

function CalendarTab({ dayTypes }: { dayTypes: DayType[] }) {
	const { supabase } = useAdmin();
	const now = new Date();
	const [startYear, setStartYear] = useState(now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1);
	const [days, setDays] = useState<Map<string, SchoolDay>>(new Map());
	const [paint, setPaint] = useState<string>("A");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const yearStart = `${startYear}-08-01`;
	const yearEnd = `${startYear + 1}-07-31`;

	const load = useCallback(async () => {
		setError(null);
		const { data, error: err } = await supabase
			.from("school_day")
			.select("day, type_code, note")
			.gte("day", yearStart)
			.lte("day", yearEnd)
			.order("day")
			.limit(500);
		if (err) {
			setError(err.message);
			return;
		}
		setDays(new Map(((data ?? []) as SchoolDay[]).map(r => [r.day, r])));
	}, [supabase, yearStart, yearEnd]);

	useEffect(() => {
		void load();
	}, [load]);

	const clickDay = async (iso: string) => {
		if (busy) return;
		setError(null);
		const existing = days.get(iso);
		try {
			if (paint === "CLEAR") {
				if (!existing) return;
				const { error: err } = await supabase.from("school_day").delete().eq("day", iso);
				if (err) throw err;
				setDays(prev => {
					const next = new Map(prev);
					next.delete(iso);
					return next;
				});
			} else if (paint === "NOTE") {
				if (!existing) {
					setError("Pick a day type first — notes attach to an existing school day.");
					return;
				}
				const note = window.prompt(`Note for ${iso} (empty clears):`, existing.note ?? "");
				if (note === null) return;
				const { error: err } = await supabase
					.from("school_day")
					.update({ note: note.trim() || null })
					.eq("day", iso);
				if (err) throw err;
				setDays(prev => new Map(prev).set(iso, { ...existing, note: note.trim() || null }));
			} else {
				const row = { day: iso, type_code: paint, note: existing?.note ?? null };
				const { error: err } = await supabase.from("school_day").upsert(row, { onConflict: "day" });
				if (err) throw err;
				setDays(prev => new Map(prev).set(iso, row));
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};

	const applyGenerated = async (rows: SchoolDay[], clearStart: string, clearEnd: string) => {
		if (!window.confirm(`Replace ALL school days between ${clearStart} and ${clearEnd} with ${rows.length} generated rows?`)) return;
		setBusy(true);
		setError(null);
		try {
			const { error: delErr } = await supabase.from("school_day").delete().gte("day", clearStart).lte("day", clearEnd);
			if (delErr) throw delErr;
			for (let i = 0; i < rows.length; i += 200) {
				const { error: insErr } = await supabase.from("school_day").insert(rows.slice(i, i + 200));
				if (insErr) throw insErr;
			}
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
		setBusy(false);
	};

	// Aug..Dec of startYear, Jan..Jul of startYear+1
	const months = [
		...Array.from({ length: 5 }, (_, i) => ({ y: startYear, m: 8 + i })),
		...Array.from({ length: 7 }, (_, i) => ({ y: startYear + 1, m: 1 + i })),
	];
	const special = new Set(dayTypes.filter(t => t.sort_order >= 50).map(t => t.code));

	return (
		<div className="ta-stack">
			<div className="ta-cal-controls">
				<select value={startYear} onChange={e => setStartYear(Number(e.target.value))} style={{ maxWidth: 160 }}>
					{Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
						<option key={y} value={y}>
							{y}–{y + 1} school year
						</option>
					))}
				</select>
				<div className="ta-cal-paint">
					{dayTypes.map(t => (
						<button key={t.code} className={paint === t.code ? "selected" : ""} title={t.label} onClick={() => setPaint(t.code)}>
							{t.code}
						</button>
					))}
					<button className={paint === "NOTE" ? "selected" : ""} onClick={() => setPaint("NOTE")}>
						✎ Note
					</button>
					<button className={paint === "CLEAR" ? "selected" : ""} onClick={() => setPaint("CLEAR")} style={{ color: "#a31621" }}>
						✕ No school
					</button>
				</div>
			</div>
			<p className="ta-muted ta-small" style={{ margin: 0 }}>
				Pick a paint, then click dates. &ldquo;No school&rdquo; deletes the row — absence of a row IS the no-school state. Dot = has a note
				(hover to read).
			</p>
			<GenerateYear dayTypes={dayTypes} onApply={applyGenerated} busy={busy} />
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-cal-months">
				{months.map(({ y, m }) => {
					const firstDow = new Date(y, m - 1, 1).getDay();
					const daysInMonth = new Date(y, m, 0).getDate();
					const cells: (string | null)[] = [];
					// leading blanks to align the first weekday column (Mon..Fri)
					const lead = firstDow === 0 ? 0 : firstDow - 1; // Sun→next week, Mon→0 …
					for (let i = 0; i < (firstDow === 0 || firstDow === 6 ? 0 : lead); i++) cells.push(null);
					for (let d = 1; d <= daysInMonth; d++) {
						const dow = new Date(y, m - 1, d).getDay();
						if (dow === 0 || dow === 6) continue;
						cells.push(isoOf(y, m, d));
					}
					return (
						<div key={`${y}-${m}`} className="ta-cal-month">
							<h3>
								{new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" })} {y}
							</h3>
							<div className="ta-cal-grid">
								{["M", "T", "W", "Th", "F"].map(h => (
									<span key={h} className="ta-cal-head">
										{h}
									</span>
								))}
								{cells.map((iso, i) => {
									if (!iso) return <span key={`b${i}`} />;
									const row = days.get(iso);
									const cls = ["ta-cal-cell"];
									if (!row) cls.push("noschool");
									else if (special.has(row.type_code)) cls.push("special");
									if (row?.note) cls.push("has-note");
									return (
										<button key={iso} className={cls.join(" ")} title={row?.note ?? undefined} onClick={() => void clickDay(iso)}>
											<span className="d">{Number(iso.slice(8))}</span>
											<span className="t">{row ? row.type_code : "—"}</span>
										</button>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─── Bell schedule tab ───────────────────────────────────────────────────────

function BellsTab({ dayTypes }: { dayTypes: DayType[] }) {
	const { supabase } = useAdmin();
	const [typeCode, setTypeCode] = useState<string>("");
	const [rows, setRows] = useState<PeriodTime[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [draft, setDraft] = useState({ label: "", period: "", starts_at: "", ends_at: "" });

	useEffect(() => {
		if (!typeCode && dayTypes.length) setTypeCode(dayTypes[0].code);
	}, [dayTypes, typeCode]);

	const load = useCallback(async () => {
		if (!typeCode) return;
		const { data, error: err } = await supabase
			.from("period_time")
			.select("id, type_code, period, label, starts_at, ends_at")
			.eq("type_code", typeCode)
			.order("starts_at");
		if (err) {
			setError(err.message);
			return;
		}
		setRows((data ?? []) as PeriodTime[]);
	}, [supabase, typeCode]);

	useEffect(() => {
		setError(null);
		void load();
	}, [load]);

	const hhmm = (t: string) => t.slice(0, 5);

	const add = async () => {
		setError(null);
		if (!draft.label.trim() || !draft.starts_at || !draft.ends_at) {
			setError("Label, start, and end are required. Leave period blank for Lunch/Advisory blocks.");
			return;
		}
		const { error: err } = await supabase.from("period_time").insert({
			type_code: typeCode,
			period: draft.period.trim() ? Number(draft.period) : null,
			label: draft.label.trim(),
			starts_at: draft.starts_at,
			ends_at: draft.ends_at,
		});
		if (err) {
			setError(err.message);
			return;
		}
		setDraft({ label: "", period: "", starts_at: "", ends_at: "" });
		await load();
	};

	const update = async (row: PeriodTime, patch: Partial<PeriodTime>) => {
		setError(null);
		const { error: err } = await supabase.from("period_time").update(patch).eq("id", row.id);
		if (err) {
			setError(err.message);
			await load();
			return;
		}
		await load();
	};

	const remove = async (row: PeriodTime) => {
		if (
			!window.confirm(
				`Delete "${row.label}" (${hhmm(row.starts_at)}–${hhmm(
					row.ends_at
				)}) from ${typeCode}? A period with no row simply doesn't meet on this day type.`
			)
		)
			return;
		const { error: err } = await supabase.from("period_time").delete().eq("id", row.id);
		if (err) {
			setError(err.message);
			return;
		}
		await load();
	};

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<select value={typeCode} onChange={e => setTypeCode(e.target.value)} style={{ maxWidth: 220 }}>
					{dayTypes.map(t => (
						<option key={t.code} value={t.code}>
							{t.code} — {t.label}
						</option>
					))}
				</select>
				<span className="ta-muted ta-small">
					One row per block in clock order. Blank period = non-class block (Lunch/Advisory) — the app shows those, don&rsquo;t drop them.
				</span>
			</div>
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th>Label</th>
							<th style={{ width: 90 }}>Period</th>
							<th style={{ width: 130 }}>Starts</th>
							<th style={{ width: 130 }}>Ends</th>
							<th style={{ width: 90 }} />
						</tr>
					</thead>
					<tbody>
						{rows.map(r => (
							<tr key={r.id}>
								<td>
									<input
										type="text"
										defaultValue={r.label}
										onBlur={e => e.target.value !== r.label && void update(r, { label: e.target.value })}
									/>
								</td>
								<td>
									<input
										type="number"
										defaultValue={r.period ?? ""}
										placeholder="—"
										onBlur={e => {
											const v = e.target.value.trim() === "" ? null : Number(e.target.value);
											if (v !== r.period) void update(r, { period: v });
										}}
									/>
								</td>
								<td>
									<input
										type="time"
										defaultValue={hhmm(r.starts_at)}
										onBlur={e =>
											e.target.value && e.target.value !== hhmm(r.starts_at) && void update(r, { starts_at: e.target.value })
										}
									/>
								</td>
								<td>
									<input
										type="time"
										defaultValue={hhmm(r.ends_at)}
										onBlur={e =>
											e.target.value && e.target.value !== hhmm(r.ends_at) && void update(r, { ends_at: e.target.value })
										}
									/>
								</td>
								<td>
									<button className="ta-btn ta-btn-small ta-btn-ghost-danger" onClick={() => void remove(r)}>
										Delete
									</button>
								</td>
							</tr>
						))}
						<tr>
							<td>
								<input
									type="text"
									placeholder="Period 1 / Lunch…"
									value={draft.label}
									onChange={e => setDraft({ ...draft, label: e.target.value })}
								/>
							</td>
							<td>
								<input
									type="number"
									placeholder="—"
									value={draft.period}
									onChange={e => setDraft({ ...draft, period: e.target.value })}
								/>
							</td>
							<td>
								<input type="time" value={draft.starts_at} onChange={e => setDraft({ ...draft, starts_at: e.target.value })} />
							</td>
							<td>
								<input type="time" value={draft.ends_at} onChange={e => setDraft({ ...draft, ends_at: e.target.value })} />
							</td>
							<td>
								<button className="ta-btn ta-btn-small ta-btn-primary" onClick={() => void add()}>
									Add
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─── Teachers tab ────────────────────────────────────────────────────────────

function TeachersTab() {
	const { supabase } = useAdmin();
	const [teachers, setTeachers] = useState<Teacher[]>([]);
	const [search, setSearch] = useState("");
	const [showInactive, setShowInactive] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [draft, setDraft] = useState({ first_name: "", last_name: "", department: "" });

	const load = useCallback(async () => {
		const { data, error: err } = await supabase
			.from("teacher")
			.select("id, first_name, last_name, department, active")
			.order("last_name")
			.limit(1000);
		if (err) {
			setError(err.message);
			return;
		}
		setTeachers((data ?? []) as Teacher[]);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	const visible = teachers.filter(t => {
		if (!showInactive && !t.active) return false;
		const q = search.trim().toLowerCase();
		if (!q) return true;
		return `${t.first_name} ${t.last_name} ${t.department ?? ""}`.toLowerCase().includes(q);
	});

	const update = async (id: number, patch: Partial<Teacher>) => {
		setError(null);
		const { error: err } = await supabase.from("teacher").update(patch).eq("id", id);
		if (err) {
			setError(err.message);
			await load();
			return;
		}
		setTeachers(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
	};

	const add = async () => {
		setError(null);
		if (!draft.last_name.trim()) {
			setError("Last name is required.");
			return;
		}
		const { error: err } = await supabase.from("teacher").insert({
			first_name: draft.first_name.trim(),
			last_name: draft.last_name.trim(),
			department: draft.department.trim() || null,
		});
		if (err) {
			setError(err.message);
			return;
		}
		setDraft({ first_name: "", last_name: "", department: "" });
		await load();
	};

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<input type="search" placeholder="Search teachers…" value={search} onChange={e => setSearch(e.target.value)} />
				<label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
					<input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ width: "auto" }} />
					Show inactive
				</label>
				<span className="ta-muted ta-small">Teachers are never deleted (student schedules reference them) — deactivate instead.</span>
			</div>
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th style={{ width: 180 }}>First name</th>
							<th style={{ width: 200 }}>Last name</th>
							<th>Department</th>
							<th style={{ width: 130 }}>Status</th>
						</tr>
					</thead>
					<tbody>
						{visible.map(t => (
							<tr key={t.id} style={t.active ? undefined : { opacity: 0.55 }}>
								<td>
									<input
										type="text"
										defaultValue={t.first_name}
										onBlur={e => e.target.value !== t.first_name && void update(t.id, { first_name: e.target.value })}
									/>
								</td>
								<td>
									<input
										type="text"
										defaultValue={t.last_name}
										onBlur={e => e.target.value !== t.last_name && void update(t.id, { last_name: e.target.value })}
									/>
								</td>
								<td>
									<input
										type="text"
										defaultValue={t.department ?? ""}
										placeholder="—"
										onBlur={e =>
											(e.target.value || null) !== t.department && void update(t.id, { department: e.target.value || null })
										}
									/>
								</td>
								<td>
									<button
										className={`ta-btn ta-btn-small${t.active ? "" : " ta-btn-primary"}`}
										onClick={() => void update(t.id, { active: !t.active })}
									>
										{t.active ? "Deactivate" : "Reactivate"}
									</button>
								</td>
							</tr>
						))}
						<tr>
							<td>
								<input
									type="text"
									placeholder="First"
									value={draft.first_name}
									onChange={e => setDraft({ ...draft, first_name: e.target.value })}
								/>
							</td>
							<td>
								<input
									type="text"
									placeholder="Last (required)"
									value={draft.last_name}
									onChange={e => setDraft({ ...draft, last_name: e.target.value })}
								/>
							</td>
							<td>
								<input
									type="text"
									placeholder="Department"
									value={draft.department}
									onChange={e => setDraft({ ...draft, department: e.target.value })}
								/>
							</td>
							<td>
								<button className="ta-btn ta-btn-small ta-btn-primary" onClick={() => void add()}>
									Add teacher
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="ta-muted ta-small">
				{visible.length} shown of {teachers.length} total.
			</p>
		</div>
	);
}

// ─── Terms & day types tab ───────────────────────────────────────────────────

function TermsTab({ dayTypes, reloadDayTypes }: { dayTypes: DayType[]; reloadDayTypes: () => Promise<void> }) {
	const { supabase } = useAdmin();
	const [terms, setTerms] = useState<Term[]>([]);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const { data, error: err } = await supabase.from("term").select("code, label, starts_on, ends_on, sort_order").order("sort_order");
		if (err) {
			setError(err.message);
			return;
		}
		setTerms((data ?? []) as Term[]);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	const updateTerm = async (code: string, patch: Partial<Term>) => {
		setError(null);
		const { error: err } = await supabase.from("term").update(patch).eq("code", code);
		if (err) setError(err.message);
		await load();
	};

	const updateDayType = async (code: string, patch: Partial<DayType>) => {
		setError(null);
		const { error: err } = await supabase.from("day_type").update(patch).eq("code", code);
		if (err) setError(err.message);
		await reloadDayTypes();
	};

	const addDayType = async () => {
		const code = window.prompt("New day type CODE (e.g. E, PEP):")?.trim();
		if (!code) return;
		const label = window.prompt("Label (e.g. Pep Rally Day):")?.trim() || code;
		const { error: err } = await supabase.from("day_type").insert({ code, label, sort_order: 50 });
		if (err) setError(err.message);
		await reloadDayTypes();
	};

	return (
		<div className="ta-stack">
			<h3 style={{ fontSize: 15 }}>Terms</h3>
			<p className="ta-muted ta-small" style={{ margin: 0 }}>
				S1/S2 only — do NOT add a full-year term; the app stores full-year courses as one enrollment per semester. Term dates drive which
				semester &ldquo;now&rdquo; is.
			</p>
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th style={{ width: 80 }}>Code</th>
							<th>Label</th>
							<th style={{ width: 160 }}>Starts</th>
							<th style={{ width: 160 }}>Ends</th>
						</tr>
					</thead>
					<tbody>
						{terms.map(t => (
							<tr key={t.code}>
								<td>
									<b>{t.code}</b>
								</td>
								<td>
									<input
										type="text"
										defaultValue={t.label}
										onBlur={e => e.target.value !== t.label && void updateTerm(t.code, { label: e.target.value })}
									/>
								</td>
								<td>
									<input
										type="date"
										defaultValue={t.starts_on}
										onBlur={e =>
											e.target.value && e.target.value !== t.starts_on && void updateTerm(t.code, { starts_on: e.target.value })
										}
									/>
								</td>
								<td>
									<input
										type="date"
										defaultValue={t.ends_on}
										onBlur={e =>
											e.target.value && e.target.value !== t.ends_on && void updateTerm(t.code, { ends_on: e.target.value })
										}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<h3 style={{ fontSize: 15 }}>Day types</h3>
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th style={{ width: 100 }}>Code</th>
							<th>Label</th>
							<th style={{ width: 110 }}>Sort</th>
						</tr>
					</thead>
					<tbody>
						{dayTypes.map(t => (
							<tr key={t.code}>
								<td>
									<b>{t.code}</b>
								</td>
								<td>
									<input
										type="text"
										defaultValue={t.label}
										onBlur={e => e.target.value !== t.label && void updateDayType(t.code, { label: e.target.value })}
									/>
								</td>
								<td>
									<input
										type="number"
										defaultValue={t.sort_order}
										onBlur={e =>
											Number(e.target.value) !== t.sort_order &&
											void updateDayType(t.code, { sort_order: Number(e.target.value) })
										}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div>
				<button className="ta-btn" onClick={() => void addDayType()}>
					+ Add day type
				</button>
			</div>
		</div>
	);
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ScheduleManager() {
	const { supabase } = useAdmin();
	const [tab, setTab] = useState<"calendar" | "bells" | "teachers" | "terms">("calendar");
	const [dayTypes, setDayTypes] = useState<DayType[]>([]);

	const loadDayTypes = useCallback(async () => {
		const { data } = await supabase.from("day_type").select("code, label, sort_order").order("sort_order");
		setDayTypes((data ?? []) as DayType[]);
	}, [supabase]);

	useEffect(() => {
		void loadDayTypes();
	}, [loadDayTypes]);

	return (
		<div>
			<div className="ta-tabs">
				<button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>
					School calendar
				</button>
				<button className={tab === "bells" ? "active" : ""} onClick={() => setTab("bells")}>
					Bell schedules
				</button>
				<button className={tab === "teachers" ? "active" : ""} onClick={() => setTab("teachers")}>
					Teachers
				</button>
				<button className={tab === "terms" ? "active" : ""} onClick={() => setTab("terms")}>
					Terms &amp; day types
				</button>
			</div>
			{tab === "calendar" && <CalendarTab dayTypes={dayTypes} />}
			{tab === "bells" && <BellsTab dayTypes={dayTypes} />}
			{tab === "teachers" && <TeachersTab />}
			{tab === "terms" && <TermsTab dayTypes={dayTypes} reloadDayTypes={loadDayTypes} />}
		</div>
	);
}

export default function SchedulePage() {
	return (
		<AdminShell title="Schedule data">
			<ScheduleManager />
		</AdminShell>
	);
}
