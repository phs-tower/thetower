/** @format */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { AscentTabs } from "~/components/admin/AscentKit";
import { FAMILIES, formatWeights, PROMPT_COLUMNS, type AscentPrompt } from "~/lib/console/ascent";

// Every prompt in the bank (day is null). Each is the template its scheduled
// copies start from: its word list, search terms and weights are what the
// next run gets.

function Bank() {
	const { supabase } = useAdmin();
	const [prompts, setPrompts] = useState<AscentPrompt[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState("");

	const load = useCallback(async () => {
		const { data, error: err } = await supabase.from("ascent_prompt").select(PROMPT_COLUMNS).is("day", null).order("key");
		if (err) setError(err.message);
		else setPrompts((data ?? []) as AscentPrompt[]);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

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
			</div>
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
