/** @format */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "~/components/admin/AdminShell";
import { PhaseBadge, useNow, WeightsEditor } from "~/components/admin/AscentKit";
import {
	addDays,
	dayLabel,
	defaultMonday,
	familyChips,
	familyCounts,
	formatFamilyCounts,
	lastUsedLabel,
	localToday,
	permissions,
	pickerRows,
	pickerSections,
	promptPhase,
	PROMPT_COLUMNS,
	TEST_WEEK,
	weekGrid,
	type AscentPrompt,
	type BankRow,
	type Family,
} from "~/lib/console/ascent";

// The Ascent's week: two prompts a school day. The scheduling rules (two
// families a day, four of a family a week; no cooldown for now) live in
// ascent_bank and ascent_schedule; this screen shows what they say.
//
// With `test`, the same screen shows the sandbox week (TEST_WEEK, Monday to
// Sunday) and schedules through ascent_schedule_test, whose copies are
// unpublished, so readers never see them.

function PickerRow({ row: r, busyKey, onPick }: { row: BankRow; busyKey: string | null; onPick: (key: string) => void }) {
	return (
		<li>
			<button
				className={r.blocked ? "blocked" : ""}
				disabled={!!r.blocked || busyKey !== null}
				onClick={() => onPick(r.key)}
				title={r.blocked ?? "Schedule this prompt"}
			>
				<span className="ta-asc-picker-text">{busyKey === r.key ? "Scheduling…" : r.text}</span>
				<span className="ta-muted ta-asc-meta">
					<span className={`ta-asc-fam ${r.family}`}>{r.family}</span> {r.key} ·{" "}
					<span className={r.last_ran ? "" : "ta-asc-fresh"}>{lastUsedLabel(r.last_ran, localToday())}</span>
					{r.blocked && <span className="ta-asc-blocked"> · {r.blocked}</span>}
				</span>
			</button>
		</li>
	);
}

function Picker({ day, test, onScheduled, onClose }: { day: string; test: boolean; onScheduled: () => void; onClose: () => void }) {
	const { supabase } = useAdmin();
	const [rows, setRows] = useState<BankRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [family, setFamily] = useState<Family | null>(null);
	const [showBlocked, setShowBlocked] = useState(false);

	useEffect(() => {
		let cancelled = false;
		supabase.rpc("ascent_bank", { p_day: day }).then(({ data, error: err }) => {
			if (cancelled) return;
			if (err) setError(err.message);
			else setRows((data ?? []) as BankRow[]);
		});
		return () => {
			cancelled = true;
		};
	}, [supabase, day]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const chips = useMemo(() => familyChips(rows ?? []), [rows]);
	const shown = useMemo(() => pickerRows(rows ?? [], { query, family, showBlocked }), [rows, query, family, showBlocked]);
	const hiddenBlocked = useMemo(
		() => (showBlocked ? 0 : pickerRows(rows ?? [], { query, family, showBlocked: true }).length - shown.length),
		[rows, query, family, showBlocked, shown]
	);

	const schedule = async (key: string) => {
		setBusyKey(key);
		setError(null);
		const { error: err } = await supabase.rpc(test ? "ascent_schedule_test" : "ascent_schedule", { p_key: key, p_day: day });
		setBusyKey(null);
		if (err) {
			setError(err.message);
			return;
		}
		onScheduled();
	};

	const free = rows?.filter(r => !r.blocked).length ?? 0;
	// With nothing searched or chosen, a few picks per family instead of the
	// whole bank; a search or a family chip shows the full matching list.
	const browsing = query.trim() === "" && family === null;
	const sections = useMemo(() => pickerSections(rows ?? []), [rows]);
	const fullFamilies = chips.filter(c => c.blocked);
	const top = browsing ? sections[0]?.rows[0] : shown.find(r => !r.blocked);

	return (
		<div className="ta-xw-scrim" onClick={onClose}>
			<div className="ta-xw-dialog ta-asc-picker" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Schedule ${dayLabel(day)}`}>
				<div className="ta-asc-picker-head">
					<div className="ta-row ta-spread">
						<h2>Schedule {dayLabel(day)}</h2>
						<button className="ta-btn ta-btn-small" onClick={onClose}>
							Close
						</button>
					</div>
					{rows && (
						<>
							<input
								type="search"
								className="ta-asc-picker-search"
								value={query}
								onChange={e => setQuery(e.target.value)}
								onKeyDown={e => {
									if (e.key === "Enter" && top && busyKey === null) void schedule(top.key);
								}}
								placeholder={`Search ${free} prompts that can run this day… (Enter picks the first)`}
								aria-label="Search prompts"
								autoFocus
							/>
							<div className="ta-asc-picker-chips" role="group" aria-label="Family">
								<button className={family === null ? "on" : ""} aria-pressed={family === null} onClick={() => setFamily(null)}>
									All <span>{free}</span>
								</button>
								{chips.map(c => (
									<button
										key={c.family}
										className={`${family === c.family ? "on" : ""} ${c.blocked ? "full" : ""}`}
										aria-pressed={family === c.family}
										onClick={() => setFamily(family === c.family ? null : c.family)}
										title={c.blocked ?? `${c.free} of ${c.total} can run this day`}
									>
										{c.family} <span>{c.free}</span>
									</button>
								))}
							</div>
						</>
					)}
					{error && <p className="ta-error">{error}</p>}
				</div>
				{!rows && !error && <p className="ta-muted">Loading the bank…</p>}
				{rows && (
					<>
						{!browsing && shown.length === 0 && (
							<p className="ta-muted">
								{family && chips.find(c => c.family === family)?.blocked
									? `No ${family} prompt can run: ${chips.find(c => c.family === family)?.blocked}.`
									: "Nothing matches."}
							</p>
						)}
						{browsing && sections.length === 0 && <p className="ta-muted">No bank prompt can run this day.</p>}
						{browsing ? (
							sections.map(sec => (
								<section key={sec.family} className="ta-asc-picker-section">
									<div className="ta-asc-picker-section-head">
										<span className={`ta-asc-fam ${sec.family}`}>{sec.family}</span>
										{sec.free > sec.rows.length && (
											<button className="ta-linkish ta-small" onClick={() => setFamily(sec.family)}>
												All {sec.free} →
											</button>
										)}
									</div>
									<ul className="ta-asc-picker-list">
										{sec.rows.map(r => (
											<PickerRow key={r.key} row={r} busyKey={busyKey} onPick={schedule} />
										))}
									</ul>
								</section>
							))
						) : (
							<ul className="ta-asc-picker-list">
								{shown.map(r => (
									<PickerRow key={r.key} row={r} busyKey={busyKey} onPick={schedule} />
								))}
							</ul>
						)}
						{browsing && fullFamilies.length > 0 && (
							<p className="ta-muted ta-small">
								Can&apos;t run this day: {fullFamilies.map(c => `${c.family} (${c.blocked})`).join(" · ")}
							</p>
						)}
						{!browsing && (hiddenBlocked > 0 || showBlocked) && (
							<button className="ta-linkish ta-small" onClick={() => setShowBlocked(!showBlocked)}>
								{showBlocked ? "Hide prompts that can't run this day" : `Show ${hiddenBlocked} that can't run this day`}
							</button>
						)}
					</>
				)}
			</div>
		</div>
	);
}

function Slot({
	prompt,
	slot,
	now,
	onSchedule,
	onChanged,
}: {
	prompt: AscentPrompt | null;
	slot: number;
	now: Date;
	onSchedule: () => void;
	onChanged: () => void;
}) {
	const { supabase } = useAdmin();
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!prompt)
		return (
			<div className="ta-asc-slot empty">
				<span className="ta-muted ta-asc-meta">Slot {slot}</span>
				<button className="ta-btn ta-btn-small" onClick={onSchedule}>
					Schedule
				</button>
			</div>
		);

	const phase = promptPhase(prompt, now);
	const can = permissions(phase, prompt.unlocked);

	const unschedule = async () => {
		setBusy(true);
		setError(null);
		// The opens_at filter makes the server refuse too if it opened meanwhile,
		// unless an editor unlocked it for testing.
		let query = supabase.from("ascent_prompt").delete().eq("id", prompt.id);
		if (!prompt.unlocked) query = query.gt("opens_at", new Date().toISOString());
		const { data, error: err } = await query.select("id");
		setBusy(false);
		setConfirming(false);
		if (err) setError(err.message);
		else if (!data?.length) setError("Not removed: the prompt has opened, so readers may have answered it.");
		else onChanged();
	};

	const setUnlocked = async (unlocked: boolean) => {
		setBusy(true);
		setError(null);
		const { error: err } = await supabase.rpc("ascent_set_unlocked", { p_prompt_id: prompt.id, p_unlocked: unlocked });
		setBusy(false);
		if (err) setError(err.message);
		else onChanged();
	};

	return (
		<div className={`ta-asc-slot ${prompt.family ?? ""}`}>
			<div className="ta-row ta-spread">
				<span className="ta-muted ta-asc-meta">
					Slot {slot} · {prompt.family} · {prompt.key}
				</span>
				<span>
					{prompt.unlocked && <span className="ta-badge red">Unlocked</span>} <PhaseBadge phase={phase} />
				</span>
			</div>
			<div className="ta-asc-slot-text">{prompt.text}</div>
			<WeightsEditor prompt={prompt} editable={can.editWeights} onSaved={onChanged} />
			<div className="ta-row ta-asc-slot-actions">
				<Link className="ta-linkish" href={`/admin/ascent/${prompt.id}`}>
					Word list
				</Link>
				{phase === "closed" && (
					<Link className="ta-linkish" href={`/admin/ascent/review?id=${prompt.id}`}>
						Review
					</Link>
				)}
				{phase === "closed" && (
					<button className="ta-linkish" onClick={() => setUnlocked(!prompt.unlocked)} disabled={busy}>
						{prompt.unlocked ? "Lock again" : "Unlock for testing"}
					</button>
				)}
				{can.unschedule && !confirming && (
					<button className="ta-linkish ta-asc-danger" onClick={() => setConfirming(true)}>
						Unschedule
					</button>
				)}
			</div>
			{confirming && (
				<div className="ta-asc-confirm">
					<span>
						Remove this prompt and its answers from {prompt.day}?{phase !== "upcoming" && " Readers' answers to it are deleted too."}
					</span>
					<button className="ta-btn ta-btn-small ta-btn-danger" onClick={unschedule} disabled={busy}>
						{busy ? "Removing…" : "Remove"}
					</button>
					<button className="ta-btn ta-btn-small" onClick={() => setConfirming(false)} disabled={busy}>
						Keep
					</button>
				</div>
			)}
			{error && <p className="ta-error">{error}</p>}
		</div>
	);
}

export function AscentWeek({ test = false }: { test?: boolean }) {
	const { supabase } = useAdmin();
	const now = useNow();
	const [chosenMonday, setMonday] = useState(() => defaultMonday(localToday()));
	const monday = test ? TEST_WEEK : chosenMonday;
	const days = test ? 7 : 5;
	const [clearing, setClearing] = useState<"confirm" | "busy" | null>(null);
	const [prompts, setPrompts] = useState<AscentPrompt[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [picking, setPicking] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		const { data, error: err } = await supabase
			.from("ascent_prompt")
			.select(PROMPT_COLUMNS)
			.gte("day", monday)
			.lte("day", addDays(monday, 6))
			.order("day")
			.order("slot");
		if (err) setError(err.message);
		else setPrompts((data ?? []) as AscentPrompt[]);
	}, [supabase, monday]);

	useEffect(() => {
		setPrompts(null);
		void load();
	}, [load]);

	// Only unpublished copies, so a mistake here can never touch a real week.
	const clearTestWeek = async () => {
		setClearing("busy");
		setError(null);
		const { error: err } = await supabase
			.from("ascent_prompt")
			.delete()
			.gte("day", TEST_WEEK)
			.lte("day", addDays(TEST_WEEK, 6))
			.eq("published", false);
		setClearing(null);
		if (err) setError(err.message);
		void load();
	};

	const grid = useMemo(() => weekGrid(monday, prompts ?? [], days), [monday, prompts, days]);
	const counts = useMemo(() => familyCounts(monday, prompts ?? []), [monday, prompts]);
	const filled = grid.reduce((n, d) => n + d.slots.filter(Boolean).length, 0);

	return (
		<>
			{test ? (
				<div className="ta-toolbar">
					<strong className="ta-asc-weekname">
						Test week · {dayLabel(TEST_WEEK)} – {dayLabel(addDays(TEST_WEEK, 6))} {TEST_WEEK.slice(0, 4)}
					</strong>
					{clearing === null && (prompts?.length ?? 0) > 0 && (
						<button className="ta-btn ta-btn-small" onClick={() => setClearing("confirm")}>
							Clear test week
						</button>
					)}
					{clearing !== null && (
						<span className="ta-asc-confirm">
							<span>Remove all {prompts?.length ?? 0} test prompts?</span>
							<button className="ta-btn ta-btn-small ta-btn-danger" onClick={clearTestWeek} disabled={clearing === "busy"}>
								{clearing === "busy" ? "Removing…" : "Remove"}
							</button>
							<button className="ta-btn ta-btn-small" onClick={() => setClearing(null)} disabled={clearing === "busy"}>
								Keep
							</button>
						</span>
					)}
				</div>
			) : (
				<div className="ta-toolbar">
					<button className="ta-btn ta-btn-small" onClick={() => setMonday(addDays(monday, -7))}>
						← Previous
					</button>
					<strong className="ta-asc-weekname">
						Week of {dayLabel(monday)} {monday.slice(0, 4)}
					</strong>
					<button className="ta-btn ta-btn-small" onClick={() => setMonday(addDays(monday, 7))}>
						Next →
					</button>
					<button className="ta-btn ta-btn-small" onClick={() => setMonday(defaultMonday(localToday()))}>
						This week
					</button>
				</div>
			)}
			<div className="ta-row ta-asc-counts">
				<span>{formatFamilyCounts(counts)}</span>
				<span className="ta-muted">
					· {filled}/{days * 2} filled
				</span>
			</div>
			<p className="ta-muted ta-small">
				{test && "A sandbox for trying prompts out: these copies are never published, so readers don't see them. "}
				Each day needs two different families, and no family more than four times a week.
			</p>
			{error && <p className="ta-error">{error}</p>}
			{!prompts && !error && <p className="ta-muted">Loading…</p>}
			{prompts && (
				<div className={`ta-asc-week ${days === 7 ? "full" : ""}`}>
					{grid.map(d => (
						<div key={d.day} className="ta-asc-day">
							<h3>{dayLabel(d.day)}</h3>
							{d.slots.map((p, i) => (
								<Slot
									key={p?.id ?? `empty-${i}`}
									prompt={p}
									slot={i + 1}
									now={now}
									onSchedule={() => setPicking(d.day)}
									onChanged={load}
								/>
							))}
						</div>
					))}
				</div>
			)}
			{picking && (
				<Picker
					day={picking}
					test={test}
					onClose={() => setPicking(null)}
					onScheduled={() => {
						setPicking(null);
						void load();
					}}
				/>
			)}
		</>
	);
}
