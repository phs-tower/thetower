/** @format */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { AscentTabs, refreshWiki } from "~/components/admin/AscentKit";
import { dayLabel, parseReports, parseReview, type ReportedAnswer, type ReportGroup, type ReviewAnswer } from "~/lib/console/ascent";

// Answers readers reported missing once their day was done. Adding one (as an
// answer or an alias) makes it the reporter's answer the next time they open
// The Ascent, with the rarity it gets on the list. A closed prompt takes the
// change while it has an open report, for a week after it closed.
// ascent_reports never says who reported.

function ReportRow({ group, report, answers, onDone }: { group: ReportGroup; report: ReportedAnswer; answers: ReviewAnswer[]; onDone: () => void }) {
	const { supabase } = useAdmin();
	const [pick, setPick] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// `changed` is whether the list needs reloading: an answer whose Wikipedia
	// count failed was still added, so the row must show it matches now.
	const run = async (label: string, action: () => Promise<{ error: string | null; changed: boolean }>) => {
		setBusy(label);
		setError(null);
		const { error: err, changed } = await action();
		setBusy(null);
		setError(err);
		if (changed) onDone();
	};

	const addAnswer = () =>
		run("Adding…", async () => {
			const { data: id, error: err } = await supabase.rpc("ascent_add_answer", { p_prompt_id: group.prompt_id, p_canonical: report.raw });
			if (err) return { error: err.message, changed: false };
			const wiki = await refreshWiki(supabase, [{ id: Number(id), canonical: report.raw, term: null }], setBusy);
			if (wiki.error) return { error: `Added, but its Wikipedia count wasn't saved: ${wiki.error}`, changed: true };
			if (wiki.failed.length) return { error: "Added, but Wikipedia couldn't be reached: fetch its count from the word list.", changed: true };
			return { error: null, changed: true };
		});

	const addAlias = () =>
		run("Adding…", async () => {
			const { error: err } = await supabase.rpc("ascent_add_alias", { p_answer_id: Number(pick), p_alias: report.raw });
			return { error: err?.message ?? null, changed: !err };
		});

	const dismiss = () =>
		run("Dismissing…", async () => {
			const { error: err } = await supabase.rpc("ascent_dismiss_report", { p_prompt_id: group.prompt_id, p_raw: report.raw });
			return { error: err?.message ?? null, changed: !err };
		});

	return (
		<tr>
			<td>
				<span className="ta-asc-raw">“{report.raw}”</span> <span className="ta-muted">× {report.count}</span>
				{error && <p className="ta-error ta-asc-cell-error">{error}</p>}
			</td>
			{report.answer ? (
				<td colSpan={2} className="ta-ok">
					Matches {report.answer} now: it becomes the reporter{report.count === 1 ? "'s" : "s'"} answer when they next open The Ascent.
				</td>
			) : (
				<>
					<td>
						<select value={pick} onChange={e => setPick(e.target.value)} disabled={!!busy}>
							<option value="">Means…</option>
							{answers.map(a => (
								<option key={a.id} value={a.id}>
									{a.canonical}
								</option>
							))}
						</select>{" "}
						<button className="ta-btn ta-btn-small" onClick={addAlias} disabled={!pick || !!busy}>
							Add as alias
						</button>
					</td>
					<td className="ta-asc-nowrap">
						<button className="ta-btn ta-btn-small ta-btn-primary" onClick={addAnswer} disabled={!!busy}>
							{busy ?? "Add as answer"}
						</button>{" "}
						<button className="ta-btn ta-btn-small" onClick={dismiss} disabled={!!busy} title="It doesn't belong on the list">
							Dismiss
						</button>
					</td>
				</>
			)}
		</tr>
	);
}

function ReportPrompt({ group, loaded, onDone }: { group: ReportGroup; loaded: number; onDone: () => void }) {
	const { supabase } = useAdmin();
	const [answers, setAnswers] = useState<ReviewAnswer[]>([]);
	const [error, setError] = useState<string | null>(null);

	// Re-read with every reload of the reports (`loaded`), so an answer just
	// added for one row is in the "Means…" picker of the others.
	useEffect(() => {
		let cancelled = false;
		supabase.rpc("ascent_review", { p_prompt_id: group.prompt_id }).then(({ data, error: err }) => {
			if (cancelled) return;
			setError(err ? `The word list didn't load, so there's nothing to alias to: ${err.message}` : null);
			if (!err) setAnswers(parseReview(data).answers);
		});
		return () => {
			cancelled = true;
		};
	}, [supabase, group.prompt_id, loaded]);

	return (
		<div className="ta-stack">
			<div className="ta-row ta-spread">
				<div>
					<h2>{group.text}</h2>
					<span className="ta-muted ta-asc-meta">
						{dayLabel(group.day)} · slot {group.slot}
					</span>
				</div>
				<Link className="ta-linkish" href={`/admin/ascent/${group.prompt_id}`}>
					Word list
				</Link>
			</div>
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th>Reported</th>
							<th>Alias of</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{group.reports.map(r => (
							<ReportRow key={r.raw} group={group} report={r} answers={answers} onDone={onDone} />
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function ReportsScreen() {
	const { supabase } = useAdmin();
	const [groups, setGroups] = useState<ReportGroup[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(0);

	const load = useCallback(async () => {
		const { data, error: err } = await supabase.rpc("ascent_reports");
		setError(err?.message ?? null);
		if (!err) {
			setGroups(parseReports(data));
			setLoaded(n => n + 1);
		}
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<div className="ta-stack">
			<p className="ta-muted ta-small">
				Answers readers said were missing. Adding one, as an answer or an alias, makes it the reader&apos;s answer the next time they open The
				Ascent, scored where it lands on the list. It also goes onto the bank prompt. Dismiss anything wrong, and never add anything that
				names a private person.
			</p>
			{error && <p className="ta-error">{error}</p>}
			{!groups && !error && <p className="ta-muted">Loading…</p>}
			{groups?.length === 0 && <p className="ta-muted">No open reports.</p>}
			{groups?.map(g => (
				<ReportPrompt key={g.prompt_id} group={g} loaded={loaded} onDone={load} />
			))}
		</div>
	);
}

export default function AscentReportsPage() {
	return (
		<AdminShell title="The Ascent: reports" wide>
			<AscentTabs />
			<ReportsScreen />
		</AdminShell>
	);
}
