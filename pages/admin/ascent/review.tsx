/** @format */

import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { AscentTabs, PhaseBadge, useNow } from "~/components/admin/AscentKit";
import {
	dayLabel,
	describeTry,
	parseReview,
	parseTry,
	promptPhase,
	PROMPT_COLUMNS,
	type AscentPrompt,
	type Review,
	type ReviewAnswer,
} from "~/lib/console/ascent";

// The weekly review: what readers typed that matched nothing, most common
// first, and a one-click alias for each. Only what was typed and how often;
// ascent_review never says who typed it.

function UnmatchedRow({
	raw,
	count,
	answers,
	onAlias,
	onHide,
}: {
	raw: string;
	count: number;
	answers: ReviewAnswer[];
	onAlias: (answerId: number) => Promise<string | null>;
	onHide: () => void;
}) {
	const [pick, setPick] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const add = async () => {
		setBusy(true);
		setError(null);
		const err = await onAlias(Number(pick));
		setBusy(false);
		if (err) setError(err);
	};

	return (
		<tr>
			<td>
				<span className="ta-asc-raw">“{raw}”</span> <span className="ta-muted">× {count}</span>
				{error && <p className="ta-error ta-asc-cell-error">{error}</p>}
			</td>
			<td>
				<select value={pick} onChange={e => setPick(e.target.value)}>
					<option value="">Means…</option>
					{answers.map(a => (
						<option key={a.id} value={a.id}>
							{a.canonical}
						</option>
					))}
				</select>
			</td>
			<td className="ta-asc-nowrap">
				<button className="ta-btn ta-btn-small ta-btn-primary" onClick={add} disabled={!pick || busy}>
					{busy ? "Adding…" : "Add as alias"}
				</button>{" "}
				<button className="ta-btn ta-btn-small" onClick={onHide} disabled={busy} title="Hide for this session">
					Hide
				</button>
			</td>
		</tr>
	);
}

function ReviewPrompt({ prompt, now }: { prompt: AscentPrompt; now: Date }) {
	const { supabase } = useAdmin();
	const [review, setReview] = useState<Review | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hidden, setHidden] = useState<Set<string>>(new Set());
	const [done, setDone] = useState<string[]>([]);
	const [bankId, setBankId] = useState<number | null>(null);

	const load = useCallback(async () => {
		const { data, error: err } = await supabase.rpc("ascent_review", { p_prompt_id: prompt.id });
		if (err) setError(err.message);
		else setReview(parseReview(data));
	}, [supabase, prompt.id]);

	useEffect(() => {
		setReview(null);
		setError(null);
		setDone([]);
		void load();
		if (prompt.key)
			supabase
				.from("ascent_prompt")
				.select("id")
				.eq("key", prompt.key)
				.is("day", null)
				.maybeSingle()
				.then(({ data }) => setBankId(data?.id ?? null));
	}, [load, supabase, prompt.key]);

	const answers = useMemo(() => [...(review?.answers ?? [])].sort((a, b) => a.canonical.localeCompare(b.canonical)), [review]);
	const phase = promptPhase(prompt, now);

	const addAlias = async (raw: string, answerId: number) => {
		const { error: err } = await supabase.rpc("ascent_add_alias", { p_answer_id: answerId, p_alias: raw });
		if (err) return err.message;
		// What the bank, and so the next run, now makes of it.
		let next = "";
		if (bankId !== null) {
			const { data } = await supabase.rpc("ascent_try", { p_prompt_id: bankId, p_raw: raw });
			next = ` Next run: ${describeTry(parseTry(data))}`;
		}
		const name = answers.find(a => a.id === answerId)?.canonical ?? "";
		setDone(d => [`“${raw}” → ${name}.${next}`, ...d]);
		await load();
		return null;
	};

	const shown = (review?.unmatched ?? []).filter(u => !hidden.has(u.raw));

	return (
		<div className="ta-stack">
			<div className="ta-row ta-spread">
				<div>
					<h2>{prompt.text}</h2>
					<span className="ta-muted ta-asc-meta">
						{prompt.day && dayLabel(prompt.day)} · slot {prompt.slot} · {prompt.key}
					</span>
				</div>
				<div className="ta-row">
					<PhaseBadge phase={phase} />
					<Link className="ta-linkish" href={`/admin/ascent/${prompt.id}`}>
						Word list
					</Link>
				</div>
			</div>
			<p className="ta-muted ta-small">
				Each alias also goes onto the bank prompt, so it matches next time.{" "}
				{phase === "open"
					? "The prompt is still open, so readers who typed it are credited now."
					: "The prompt has closed, so this board stays as it was shown."}{" "}
				Never alias anything that names a person; leave those, and plain wrong answers, alone.
			</p>
			{error && <p className="ta-error">{error}</p>}
			{done.length > 0 && (
				<ul className="ta-asc-done">
					{done.map((d, i) => (
						<li key={i} className="ta-ok">
							{d}
						</li>
					))}
				</ul>
			)}
			{!review && !error && <p className="ta-muted">Loading…</p>}
			{review && shown.length === 0 && <p className="ta-muted">Nothing unmatched{hidden.size ? " left" : ""}.</p>}
			{review && shown.length > 0 && (
				<div className="ta-table-wrap">
					<table className="ta-table">
						<thead>
							<tr>
								<th>Typed</th>
								<th>Alias of</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{shown.map(u => (
								<UnmatchedRow
									key={u.raw}
									raw={u.raw}
									count={u.count}
									answers={answers}
									onAlias={id => addAlias(u.raw, id)}
									onHide={() => setHidden(h => new Set(h).add(u.raw))}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
			{hidden.size > 0 && (
				<button className="ta-linkish" onClick={() => setHidden(new Set())}>
					Show {hidden.size} hidden
				</button>
			)}
		</div>
	);
}

function ReviewScreen() {
	const { supabase } = useAdmin();
	const router = useRouter();
	const now = useNow();
	const [prompts, setPrompts] = useState<AscentPrompt[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const selectedId = Number(router.query.id) || null;

	useEffect(() => {
		// Prompts readers have already seen, newest first.
		supabase
			.from("ascent_prompt")
			.select(PROMPT_COLUMNS)
			.not("day", "is", null)
			.lte("opens_at", new Date().toISOString())
			.order("day", { ascending: false })
			.order("slot")
			.limit(40)
			.then(({ data, error: err }) => {
				if (err) setError(err.message);
				else setPrompts((data ?? []) as AscentPrompt[]);
			});
	}, [supabase]);

	const selected = prompts?.find(p => p.id === selectedId) ?? null;
	const choose = (id: number) => router.replace({ pathname: router.pathname, query: { id } }, undefined, { shallow: true });

	return (
		<div className="ta-asc-review">
			<aside className="ta-asc-review-list">
				{error && <p className="ta-error">{error}</p>}
				{!prompts && !error && <p className="ta-muted">Loading…</p>}
				{prompts?.length === 0 && <p className="ta-muted">No prompt has opened yet.</p>}
				<ul>
					{prompts?.map(p => (
						<li key={p.id}>
							<button className={p.id === selectedId ? "active" : ""} onClick={() => choose(p.id)}>
								<span className="ta-asc-meta ta-muted">
									{p.day && dayLabel(p.day)} · {p.slot} {promptPhase(p, now) === "open" ? "· open" : ""}
								</span>
								<span>{p.text}</span>
							</button>
						</li>
					))}
				</ul>
			</aside>
			<div className="ta-asc-review-main">
				{selected ? (
					<ReviewPrompt key={selected.id} prompt={selected} now={now} />
				) : (
					prompts && <p className="ta-muted">Choose a prompt to see what readers typed that matched nothing.</p>
				)}
			</div>
		</div>
	);
}

export default function AscentReviewPage() {
	return (
		<AdminShell title="The Ascent: review" wide>
			<AscentTabs />
			<ReviewScreen />
		</AdminShell>
	);
}
