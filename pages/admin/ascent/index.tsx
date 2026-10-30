/** @format */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { AscentTabs, PhaseBadge, useNow, WeightsEditor } from "~/components/admin/AscentKit";
import {
	addDays,
	bankRunningLow,
	dayLabel,
	defaultMonday,
	familyCounts,
	formatFamilyCounts,
	groupBank,
	localToday,
	permissions,
	promptPhase,
	PROMPT_COLUMNS,
	weekGrid,
	type AscentPrompt,
	type BankRow,
} from "~/lib/console/ascent";

// The Ascent's week: two prompts a school day. The scheduling rules (two
// families a day, four of a family a week, six months between runs) live in
// ascent_bank and ascent_schedule; this screen shows what they say.

function Picker({ day, onScheduled, onClose }: { day: string; onScheduled: () => void; onClose: () => void }) {
	const { supabase } = useAdmin();
	const [rows, setRows] = useState<BankRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busyKey, setBusyKey] = useState<string | null>(null);

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

	const schedule = async (key: string) => {
		setBusyKey(key);
		setError(null);
		const { error: err } = await supabase.rpc("ascent_schedule", { p_key: key, p_day: day });
		setBusyKey(null);
		if (err) {
			setError(err.message);
			return;
		}
		onScheduled();
	};

	const free = rows?.filter(r => !r.blocked).length ?? 0;

	return (
		<div className="ta-xw-scrim" onClick={onClose}>
			<div className="ta-xw-dialog ta-asc-picker" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Schedule ${dayLabel(day)}`}>
				<div className="ta-row ta-spread">
					<h2>Schedule {dayLabel(day)}</h2>
					<button className="ta-btn ta-btn-small" onClick={onClose}>
						Close
					</button>
				</div>
				{error && <p className="ta-error">{error}</p>}
				{!rows && !error && <p className="ta-muted">Loading the bank…</p>}
				{rows && (
					<>
						<p className="ta-muted ta-small">
							{free} of {rows.length} prompts can run this day.
						</p>
						{bankRunningLow(rows) && (
							<p className="ta-asc-notice">
								Most of the bank ran in the last six months, so the choice is thin. Add prompts to the bank in the app repo&apos;s
								import when you can.
							</p>
						)}
						{groupBank(rows).map(group => (
							<section key={group.family} className="ta-asc-picker-group">
								<h3>{group.family}</h3>
								<ul>
									{group.rows.map(r => (
										<li key={r.key} className={r.blocked ? "blocked" : ""}>
											<div className="ta-asc-picker-main">
												<div>{r.text}</div>
												<div className="ta-muted ta-asc-meta">
													{r.key} ·{" "}
													{r.last_ran ? `last ran ${dayLabel(r.last_ran)} ${r.last_ran.slice(0, 4)}` : "never run"}
													{r.blocked && <span className="ta-asc-blocked"> · {r.blocked}</span>}
												</div>
											</div>
											<button
												className="ta-btn ta-btn-small"
												disabled={!!r.blocked || busyKey !== null}
												onClick={() => schedule(r.key)}
											>
												{busyKey === r.key ? "…" : "Pick"}
											</button>
										</li>
									))}
								</ul>
							</section>
						))}
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
	const can = permissions(phase);

	const unschedule = async () => {
		setBusy(true);
		setError(null);
		// The opens_at filter makes the server refuse too if it opened meanwhile.
		const { data, error: err } = await supabase
			.from("ascent_prompt")
			.delete()
			.eq("id", prompt.id)
			.gt("opens_at", new Date().toISOString())
			.select("id");
		setBusy(false);
		setConfirming(false);
		if (err) setError(err.message);
		else if (!data?.length) setError("Not removed: the prompt has opened, so readers may have answered it.");
		else onChanged();
	};

	return (
		<div className={`ta-asc-slot ${prompt.family ?? ""}`}>
			<div className="ta-row ta-spread">
				<span className="ta-muted ta-asc-meta">
					Slot {slot} · {prompt.family} · {prompt.key}
				</span>
				<PhaseBadge phase={phase} />
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
				{can.unschedule && !confirming && (
					<button className="ta-linkish ta-asc-danger" onClick={() => setConfirming(true)}>
						Unschedule
					</button>
				)}
			</div>
			{confirming && (
				<div className="ta-asc-confirm">
					<span>Remove this prompt and its answers from {prompt.day}?</span>
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

function Week() {
	const { supabase } = useAdmin();
	const now = useNow();
	const [monday, setMonday] = useState(() => defaultMonday(localToday()));
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

	const grid = useMemo(() => weekGrid(monday, prompts ?? []), [monday, prompts]);
	const counts = useMemo(() => familyCounts(monday, prompts ?? []), [monday, prompts]);
	const filled = grid.reduce((n, d) => n + d.slots.filter(Boolean).length, 0);

	return (
		<>
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
			<div className="ta-row ta-asc-counts">
				<span>{formatFamilyCounts(counts)}</span>
				<span className="ta-muted">· {filled}/10 filled</span>
			</div>
			<p className="ta-muted ta-small">Each day needs two different families, and no family more than four times a week.</p>
			{error && <p className="ta-error">{error}</p>}
			{!prompts && !error && <p className="ta-muted">Loading…</p>}
			{prompts && (
				<div className="ta-asc-week">
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

export default function AscentWeekPage() {
	return (
		<AdminShell title="The Ascent" wide>
			<AscentTabs />
			<Week />
		</AdminShell>
	);
}
