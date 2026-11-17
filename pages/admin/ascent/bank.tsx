/** @format */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { AscentTabs, refreshWiki } from "~/components/admin/AscentKit";
import {
	FAMILIES,
	formatWeights,
	lastRunByKey,
	lastUsedLabel,
	localToday,
	parseReview,
	PROMPT_COLUMNS,
	type AscentPrompt,
	type ReviewAnswer,
} from "~/lib/console/ascent";

// Every prompt in the bank (day is null). Each is the template its scheduled
// copies start from: its word list, search terms, weights and hand-placed
// answers are what the next run gets. Prompts may repeat; the tag says when
// each last ran.

function Bank() {
	const { supabase } = useAdmin();
	const [prompts, setPrompts] = useState<AscentPrompt[] | null>(null);
	const [lastRun, setLastRun] = useState<Map<string, string>>(new Map());
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState("");
	const [progress, setProgress] = useState<string | null>(null);
	const [fillResult, setFillResult] = useState<string | null>(null);

	const load = useCallback(async () => {
		const [bank, runs] = await Promise.all([
			supabase.from("ascent_prompt").select(PROMPT_COLUMNS).is("day", null).order("key"),
			supabase.from("ascent_prompt").select("key, day").not("day", "is", null),
		]);
		const err = bank.error ?? runs.error;
		if (err) return setError(err.message);
		setPrompts((bank.data ?? []) as AscentPrompt[]);
		setLastRun(lastRunByKey((runs.data ?? []) as { key: string | null; day: string | null }[]));
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	// Every bank answer without a Wikipedia count, fetched in one go: new
	// prompts (supabase/seed/ascent-bank) arrive with Tower counts only.
	const fillMissingWiki = async () => {
		if (!prompts) return;
		setError(null);
		setFillResult(null);
		const missing: ReviewAnswer[] = [];
		for (let i = 0; i < prompts.length; i++) {
			setProgress(`Reading word lists ${i + 1}/${prompts.length}…`);
			const { data, error: err } = await supabase.rpc("ascent_review", { p_prompt_id: prompts[i].id });
			if (err) {
				setProgress(null);
				return setError(err.message);
			}
			missing.push(...parseReview(data).answers.filter(a => a.wiki_hits === null || a.wiki_hits === undefined));
		}
		if (!missing.length) {
			setProgress(null);
			return setFillResult("Every bank answer already has a Wikipedia count.");
		}
		const { failed, error: err } = await refreshWiki(supabase, missing, setProgress);
		setProgress(null);
		if (err) return setError(err);
		setFillResult(
			`Filled ${missing.length - failed.length} of ${missing.length} missing counts.` +
				(failed.length ? ` Wikipedia didn't answer for ${failed.length}; run it again to retry them.` : "")
		);
	};

	const groups = useMemo(() => {
		const q = filter.trim().toLowerCase();
		const shown = (prompts ?? []).filter(p => !q || p.text.toLowerCase().includes(q) || (p.key ?? "").toLowerCase().includes(q));
		return FAMILIES.map(family => ({ family, rows: shown.filter(p => p.family === family) })).filter(g => g.rows.length);
	}, [prompts, filter]);

	return (
		<>
			<div className="ta-toolbar">
				<input type="search" placeholder="Filter prompts" value={filter} onChange={e => setFilter(e.target.value)} />
				{prompts && <span className="ta-muted">{prompts.length} prompts in the bank</span>}
				{prompts && (
					<button
						className="ta-btn ta-btn-small"
						onClick={() => void fillMissingWiki()}
						disabled={progress !== null}
						title="Fetch a Wikipedia count for every bank answer that has none"
					>
						{progress ?? "Fill missing Wikipedia counts"}
					</button>
				)}
			</div>
			{fillResult && <p className="ta-muted ta-small">{fillResult}</p>}
			{error && <p className="ta-error">{error}</p>}
			{!prompts && !error && <p className="ta-muted">Loading…</p>}
			{groups.map(g => (
				<section key={g.family} className="ta-asc-bank-group">
					<h2>{g.family}</h2>
					<div className="ta-table-wrap">
						<table className="ta-table">
							<thead>
								<tr>
									<th>Prompt</th>
									<th>Key</th>
									<th>Last used</th>
									<th>Weights</th>
								</tr>
							</thead>
							<tbody>
								{g.rows.map(p => (
									<tr key={p.id}>
										<td>
											<Link href={`/admin/ascent/${p.id}`}>{p.text}</Link>
										</td>
										<td className="ta-muted">{p.key}</td>
										<td className="ta-asc-nowrap">
											<span className={`ta-badge ${p.key && lastRun.has(p.key) ? "" : "green"}`}>
												{lastUsedLabel((p.key && lastRun.get(p.key)) || null, localToday())}
											</span>
										</td>
										<td className="ta-muted ta-asc-nowrap">{formatWeights(p)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			))}
		</>
	);
}

export default function AscentBankPage() {
	return (
		<AdminShell title="The Ascent" wide>
			<AscentTabs />
			<Bank />
		</AdminShell>
	);
}
