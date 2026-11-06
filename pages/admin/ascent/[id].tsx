/** @format */

import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { AscentTabs, errorText, PhaseBadge, useNow, WeightsEditor } from "~/components/admin/AscentKit";
import {
	byTier,
	dayLabel,
	describeTry,
	dropPrior,
	fetchWikiCounts,
	formatPrior,
	missingWiki,
	parseReview,
	parseTry,
	permissions,
	promptPhase,
	PROMPT_COLUMNS,
	RARITY_COLORS,
	sortByPrior,
	wikiBatches,
	type AscentPrompt,
	type DropTarget,
	type ReviewAnswer,
	type Tier,
	type TryResult,
} from "~/lib/console/ascent";

// One prompt's word list: every answer it accepts, with what its prior is
// made of, grouped under the tier its prior lands in. The prior is the score:
// what readers say never moves it. An editor drags an answer up or down to
// override what the counts gave (ascent_set_prior). A bank prompt's list is
// what every future copy starts from; a scheduled prompt's is its own, and
// additions and aliases also reach the bank. Matching and scoring are the
// server's (ascent_try, ascent_review).

type Supabase = ReturnType<typeof useAdmin>["supabase"];

/** Fetches Wikipedia counts for `answers` and saves the ones that came back,
 *  25 rows a call. Returns the names that failed: theirs are left as they
 *  were. */
async function refreshWiki(
	supabase: Supabase,
	answers: ReviewAnswer[],
	onProgress: (text: string) => void
): Promise<{ failed: string[]; error: string | null }> {
	const { hits, failed } = await fetchWikiCounts(answers, undefined, (done, total) => onProgress(`Fetching Wikipedia ${done}/${total}…`));
	const batches = wikiBatches(hits);
	for (let i = 0; i < batches.length; i++) {
		onProgress(`Saving ${i + 1}/${batches.length}…`);
		const { error } = await supabase.rpc("ascent_set_answers", { p_rows: batches[i] });
		if (error) return { failed: failed.map(f => f.canonical), error: error.message };
	}
	return { failed: failed.map(f => f.canonical), error: null };
}

function TryBox({ promptId }: { promptId: number }) {
	const { supabase } = useAdmin();
	const [text, setText] = useState("");
	const [result, setResult] = useState<{ raw: string; match: TryResult | null } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const seq = useRef(0);

	useEffect(() => {
		const raw = text.trim();
		const mine = ++seq.current;
		if (!raw) {
			setResult(null);
			setError(null);
			return;
		}
		const t = setTimeout(async () => {
			const { data, error: err } = await supabase.rpc("ascent_try", { p_prompt_id: promptId, p_raw: raw });
			if (mine !== seq.current) return;
			if (err) setError(err.message);
			else {
				setError(null);
				setResult({ raw, match: parseTry(data) });
			}
		}, 300);
		return () => clearTimeout(t);
	}, [text, promptId, supabase]);

	return (
		<div className="ta-card ta-asc-try">
			<label>
				Test an answer
				<input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type what a reader might" />
			</label>
			{error && <p className="ta-error">{error}</p>}
			{result && (
				<p className={result.match ? (result.match.how === "exact" || result.match.how === "alias" ? "ta-ok" : "ta-asc-ask") : "ta-error"}>
					“{result.raw}”: {describeTry(result.match)}
				</p>
			)}
		</div>
	);
}

/** Props that make a row a drop target: above or below it, by which half
 *  of the row the pointer is over. */
function dropZone(
	target: (after: boolean) => DropTarget,
	drag: { active: boolean; onOver: (t: DropTarget) => void; onDrop: (t: DropTarget) => void }
) {
	if (!drag.active) return {};
	const at = (e: React.DragEvent<HTMLElement>) => {
		const r = e.currentTarget.getBoundingClientRect();
		return target(e.clientY > r.top + r.height / 2);
	};
	return {
		onDragOver: (e: React.DragEvent<HTMLElement>) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			drag.onOver(at(e));
		},
		onDrop: (e: React.DragEvent<HTMLElement>) => {
			e.preventDefault();
			drag.onDrop(at(e));
		},
	};
}

interface Drag {
	/** Whether dragging is allowed at all (the prompt hasn't closed). */
	enabled: boolean;
	/** The answer being dragged, if any. */
	id: number | null;
	over: DropTarget | null;
	start: (id: number) => void;
	end: () => void;
	onOver: (t: DropTarget) => void;
	onDrop: (t: DropTarget) => void;
}

function AnswerRow({
	answer,
	can,
	busy,
	drag,
	onTerm,
	onAlias,
	onRemove,
	onResetPrior,
}: {
	answer: ReviewAnswer;
	can: ReturnType<typeof permissions>;
	busy: boolean;
	drag: Drag;
	onTerm: (term: string) => Promise<string | null>;
	onAlias: (alias: string) => Promise<string | null>;
	onRemove: () => Promise<string | null>;
	onResetPrior: () => Promise<string | null>;
}) {
	const [term, setTerm] = useState(answer.term ?? "");
	const [alias, setAlias] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(false);

	useEffect(() => setTerm(answer.term ?? ""), [answer.term]);

	const run = async (fn: () => Promise<string | null>) => {
		setWorking(true);
		setError(null);
		const err = await fn();
		setWorking(false);
		if (err) setError(err);
		return !err;
	};

	const termDirty = term.trim() !== (answer.term ?? "").trim();
	const over = drag.over?.kind === "answer" && drag.over.id === answer.id ? (drag.over.after ? "drop-after" : "drop-before") : "";
	const dragging = drag.id === answer.id;

	return (
		<tr
			className={`${over} ${dragging ? "dragging" : ""}`}
			{...dropZone(after => ({ kind: "answer", id: answer.id, after }), {
				active: drag.id !== null && !dragging,
				onOver: drag.onOver,
				onDrop: drag.onDrop,
			})}
		>
			{drag.enabled && (
				<td
					className="ta-asc-handle"
					draggable={!busy && answer.prior !== null && answer.prior !== undefined}
					title="Drag up for more obvious, down for rarer"
					onDragStart={e => {
						e.dataTransfer.effectAllowed = "move";
						e.dataTransfer.setData("text/plain", String(answer.id));
						const row = e.currentTarget.parentElement;
						if (row) e.dataTransfer.setDragImage(row, 12, 12);
						drag.start(answer.id);
					}}
					onDragEnd={drag.end}
				>
					⠿
				</td>
			)}
			<td>
				<div className="ta-asc-canonical">{answer.canonical}</div>
				{error && <p className="ta-error ta-asc-cell-error">{error}</p>}
			</td>
			<td className="ta-asc-aliases">
				{(answer.aliases ?? []).join(", ") || <span className="ta-muted">—</span>}
				{alias === null ? (
					<button className="ta-linkish ta-asc-inline" onClick={() => setAlias("")} disabled={busy}>
						+ alias
					</button>
				) : (
					<form
						className="ta-asc-inline-form"
						onSubmit={async e => {
							e.preventDefault();
							if (alias.trim() && (await run(() => onAlias(alias.trim())))) setAlias(null);
						}}
					>
						<input type="text" value={alias} onChange={e => setAlias(e.target.value)} autoFocus placeholder="alias" />
						<button className="ta-btn ta-btn-small" type="submit" disabled={working || !alias.trim()}>
							Add
						</button>
						<button className="ta-btn ta-btn-small" type="button" onClick={() => setAlias(null)}>
							✕
						</button>
					</form>
				)}
			</td>
			<td>
				{can.editAnswers ? (
					<form
						className="ta-asc-inline-form"
						onSubmit={e => {
							e.preventDefault();
							if (termDirty) void run(() => onTerm(term.trim()));
						}}
					>
						<input type="text" value={term} onChange={e => setTerm(e.target.value)} placeholder={answer.canonical} />
						{termDirty && (
							<button className="ta-btn ta-btn-small" type="submit" disabled={working || busy}>
								{working ? "…" : "Save"}
							</button>
						)}
					</form>
				) : (
					answer.term ?? <span className="ta-muted">{answer.canonical}</span>
				)}
			</td>
			<td className="ta-asc-num">{answer.tower_mentions ?? "—"}</td>
			<td className="ta-asc-num">
				{answer.wiki_hits == null ? <span className="ta-muted">not fetched</span> : answer.wiki_hits.toLocaleString()}
			</td>
			<td className="ta-asc-num">
				{answer.manual && (
					<span className="ta-asc-manual" title={`Placed by hand. The counts give ${formatPrior(answer.archive_prior)}.`}>
						set by hand
						{can.editWeights && (
							<button className="ta-linkish ta-asc-inline" onClick={() => run(onResetPrior)} disabled={busy || working}>
								reset
							</button>
						)}
					</span>
				)}
				<span className="ta-asc-prior" style={{ ["--p" as string]: String(answer.prior ?? 0) }}>
					{formatPrior(answer.prior)}
				</span>
			</td>
			{can.removeAnswer && (
				<td>
					{confirming ? (
						<span className="ta-asc-confirm">
							<button className="ta-btn ta-btn-small ta-btn-danger" disabled={working} onClick={() => run(onRemove)}>
								Remove
							</button>
							<button className="ta-btn ta-btn-small" onClick={() => setConfirming(false)}>
								Keep
							</button>
						</span>
					) : (
						<button className="ta-linkish ta-asc-danger" onClick={() => setConfirming(true)} disabled={busy}>
							Remove
						</button>
					)}
				</td>
			)}
		</tr>
	);
}

/** The thresholds, ground to roof, with how many answers sit in each. */
function Ladder({ groups }: { groups: ReturnType<typeof byTier> }) {
	return (
		<div className="ta-card ta-asc-ladder">
			<div className="ta-asc-ladder-bar">
				{groups.map(g => (
					<div
						key={g.tier.score}
						style={{ flexGrow: g.tier.to - g.tier.from, ["--c" as string]: RARITY_COLORS[g.tier.rarity] }}
						title={`${g.tier.rarity} · ${g.tier.tier}: rarity ${rangeText(g.tier)}`}
					>
						<span className="ta-asc-ladder-word">{g.tier.rarity}</span>
						<span className="ta-asc-ladder-sub">
							{g.tier.tier} · {g.tier.score}
						</span>
						<span className="ta-asc-ladder-sub">
							{rangeText(g.tier)} · {g.answers.length}
						</span>
					</div>
				))}
			</div>
			<p className="ta-muted ta-small">
				Rarity runs 0 (most obvious) to 1 (rarest), and the tier it lands in is the score: readers&apos; answers never move it. Drag an answer
				by ⠿ to place it by hand; it lands halfway between its new neighbours, inside the tier you drop it in.
			</p>
		</div>
	);
}

function rangeText(t: Tier): string {
	return t.to >= 1 ? `≥ ${t.from.toFixed(2)}` : `${t.from.toFixed(2)}–${t.to.toFixed(2)}`;
}

function WordList({ id }: { id: number }) {
	const { supabase } = useAdmin();
	const now = useNow();
	const [prompt, setPrompt] = useState<AscentPrompt | null>(null);
	const [bankId, setBankId] = useState<number | null>(null);
	const [answers, setAnswers] = useState<ReviewAnswer[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [newAnswer, setNewAnswer] = useState("");
	const [adding, setAdding] = useState(false);
	const [addError, setAddError] = useState<string | null>(null);
	const [dragId, setDragId] = useState<number | null>(null);
	const [dragOver, setDragOver] = useState<DropTarget | null>(null);

	const loadPrompt = useCallback(async () => {
		const { data, error: err } = await supabase.from("ascent_prompt").select(PROMPT_COLUMNS).eq("id", id).maybeSingle();
		if (err) return setError(err.message);
		if (!data) return setError("No such prompt.");
		const p = data as AscentPrompt;
		setPrompt(p);
		if (p.day !== null && p.key) {
			const { data: bank } = await supabase.from("ascent_prompt").select("id").eq("key", p.key).is("day", null).maybeSingle();
			setBankId(bank?.id ?? null);
		} else setBankId(null);
	}, [supabase, id]);

	const loadAnswers = useCallback(async () => {
		const { data, error: err } = await supabase.rpc("ascent_review", { p_prompt_id: id });
		if (err) setError(err.message);
		else setAnswers(sortByPrior(parseReview(data).answers));
	}, [supabase, id]);

	useEffect(() => {
		setPrompt(null);
		setAnswers(null);
		setError(null);
		void loadPrompt();
		void loadAnswers();
	}, [loadPrompt, loadAnswers]);

	const phase = prompt ? promptPhase(prompt, now) : null;
	const can = permissions(phase ?? "closed");
	const missing = useMemo(() => missingWiki(answers ?? []), [answers]);
	const groups = useMemo(() => byTier(answers ?? []), [answers]);
	const unranked = useMemo(() => (answers ?? []).filter(a => a.prior === null || a.prior === undefined), [answers]);
	const busy = progress !== null;

	const reportWiki = (failed: string[], err: string | null) => {
		if (err) setNotice(`Saving counts failed: ${err}`);
		else if (failed.length) setNotice(`Wikipedia didn't answer for ${failed.join(", ")}. Their counts are unchanged; try again.`);
		else setNotice(null);
	};

	const fetchAll = async () => {
		if (!answers?.length) return;
		setNotice(null);
		try {
			const { failed, error: err } = await refreshWiki(supabase, answers, setProgress);
			reportWiki(failed, err);
		} catch (e) {
			setNotice(errorText(e));
		}
		setProgress(null);
		await loadAnswers();
	};

	const addAnswer = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = newAnswer.trim();
		if (!name) return;
		setAdding(true);
		setAddError(null);
		setNotice(null);
		const { data, error: err } = await supabase.rpc("ascent_add_answer", { p_prompt_id: id, p_canonical: name });
		if (err) {
			setAdding(false);
			setAddError(err.message);
			return;
		}
		setNewAnswer("");
		const { failed, error: saveErr } = await refreshWiki(supabase, [{ id: Number(data), canonical: name, term: null } as ReviewAnswer], () => {});
		reportWiki(failed, saveErr);
		setAdding(false);
		await loadAnswers();
	};

	const setTerm = async (a: ReviewAnswer, term: string) => {
		const { error: err } = await supabase.rpc("ascent_set_answers", { p_rows: [{ id: a.id, term }] });
		if (err) return err.message;
		const { failed, error: saveErr } = await refreshWiki(supabase, [{ ...a, term: term || null }], () => {});
		await loadAnswers();
		if (saveErr) return `Term saved, but saving its Wikipedia count failed: ${saveErr}`;
		if (failed.length) return "Term saved, but Wikipedia didn't answer: its count is unchanged.";
		return null;
	};

	const addAlias = async (a: ReviewAnswer, alias: string) => {
		const { error: err } = await supabase.rpc("ascent_add_alias", { p_answer_id: a.id, p_alias: alias });
		if (err) return err.message;
		await loadAnswers();
		return null;
	};

	const setPrior = async (answerId: number, prior: number | null) => {
		const { error: err } = await supabase.rpc("ascent_set_prior", { p_answer_id: answerId, p_prior: prior });
		if (err) return err.message;
		await loadAnswers();
		return null;
	};

	const drop = async (target: DropTarget) => {
		const moving = answers?.find(a => a.id === dragId);
		setDragId(null);
		setDragOver(null);
		if (!moving || !answers) return;
		const prior = dropPrior(
			answers.filter(a => a.id !== moving.id),
			target
		);
		if (prior === null || prior === Number(moving.prior)) return;
		// Shown at once so the row doesn't jump back while the server answers.
		setAnswers(sortByPrior(answers.map(a => (a.id === moving.id ? { ...a, prior, manual: true } : a))));
		const err = await setPrior(moving.id, prior);
		if (err) {
			setNotice(`Couldn't move ${moving.canonical}: ${err}`);
			await loadAnswers();
		}
	};

	const drag: Drag = {
		enabled: can.editWeights,
		id: dragId,
		over: dragOver,
		start: answerId => {
			setNotice(null);
			setDragId(answerId);
		},
		end: () => {
			setDragId(null);
			setDragOver(null);
		},
		onOver: t => setDragOver(prev => (JSON.stringify(prev) === JSON.stringify(t) ? prev : t)),
		onDrop: t => void drop(t),
	};

	const remove = async (a: ReviewAnswer) => {
		const { error: err } = await supabase.rpc("ascent_remove_answer", { p_answer_id: a.id });
		if (err) return err.message;
		await loadAnswers();
		return null;
	};

	if (error) return <p className="ta-error">{error}</p>;
	if (!prompt || !phase) return <p className="ta-muted">Loading…</p>;

	return (
		<div className="ta-stack">
			<div className="ta-card ta-asc-head">
				<div className="ta-row ta-spread">
					<span className="ta-muted ta-asc-meta">
						{prompt.day ? `${dayLabel(prompt.day)} ${prompt.day.slice(0, 4)} · slot ${prompt.slot}` : "Bank"} · {prompt.family} ·{" "}
						{prompt.key}
					</span>
					<PhaseBadge phase={phase} />
				</div>
				<h2>{prompt.text}</h2>
				<WeightsEditor prompt={prompt} editable={can.editWeights} onSaved={loadPrompt} />
				{bankId !== null && (
					<p className="ta-muted ta-small">
						This is one day&apos;s copy. New answers, aliases and search terms also reach the{" "}
						<Link href={`/admin/ascent/${bankId}`}>bank prompt</Link>; weights and removals stay with this day.
					</p>
				)}
				{phase === "closed" && (
					<p className="ta-muted ta-small">
						Closed: its board has been shown, so only aliases can change here. To grow the list for next time, add the answer on the bank
						prompt.
					</p>
				)}
			</div>

			<TryBox promptId={id} />

			{can.addAnswer && (
				<form className="ta-row ta-asc-add" onSubmit={addAnswer}>
					<input type="text" value={newAnswer} onChange={e => setNewAnswer(e.target.value)} placeholder="New answer (never a person)" />
					<button className="ta-btn ta-btn-primary" type="submit" disabled={adding || busy || !newAnswer.trim()}>
						{adding ? "Adding…" : "Add answer"}
					</button>
					{addError && <p className="ta-error">{addError}</p>}
				</form>
			)}

			{missing > 0 && (
				<p className="ta-asc-notice">
					{missing} answer{missing === 1 ? " has" : "s have"} no Wikipedia count. Until they are fetched, Wikipedia counts as 0.5 for every
					answer, which flattens the prior.
				</p>
			)}

			<div className="ta-row ta-spread">
				<span className="ta-muted">
					{answers ? `${answers.length} answers, most obvious first${can.editWeights ? "; drag ⠿ to re-rank" : ""}` : "Loading answers…"}
				</span>
				{can.editAnswers && (
					<button className="ta-btn" onClick={fetchAll} disabled={busy || !answers?.length}>
						{progress ?? "Fetch Wikipedia counts"}
					</button>
				)}
			</div>
			{notice && <p className="ta-asc-notice">{notice}</p>}

			{answers && <Ladder groups={groups} />}

			{answers && (
				<div className="ta-table-wrap">
					<table className={`ta-table ta-asc-words ${dragId !== null ? "is-dragging" : ""}`}>
						<thead>
							<tr>
								{drag.enabled && <th />}
								<th>Answer</th>
								<th>Aliases</th>
								<th>Search term</th>
								<th className="ta-asc-num">Tower</th>
								<th className="ta-asc-num">Wikipedia</th>
								<th className="ta-asc-num" title="0 is the most obvious, 1 the rarest">
									Rarity
								</th>
								{can.removeAnswer && <th />}
							</tr>
						</thead>
						{groups.map(g => (
							<tbody key={g.tier.score} style={{ ["--c" as string]: RARITY_COLORS[g.tier.rarity] }}>
								<tr
									className={`ta-asc-tier ${dragOver?.kind === "tier" && dragOver.index === g.index ? "drop-after" : ""}`}
									{...dropZone(() => ({ kind: "tier", index: g.index }), {
										active: dragId !== null,
										onOver: drag.onOver,
										onDrop: drag.onDrop,
									})}
								>
									<td colSpan={5 + (drag.enabled ? 1 : 0) + 1 + (can.removeAnswer ? 1 : 0)}>
										<strong>{g.tier.rarity}</strong> · {g.tier.tier} · {g.tier.score} points ·{" "}
										<span className="ta-muted">
											rarity {rangeText(g.tier)} · {g.answers.length} answer{g.answers.length === 1 ? "" : "s"}
										</span>
									</td>
								</tr>
								{g.answers.map(a => (
									<AnswerRow
										key={a.id}
										answer={a}
										can={can}
										busy={busy}
										drag={drag}
										onTerm={term => setTerm(a, term)}
										onAlias={alias => addAlias(a, alias)}
										onRemove={() => remove(a)}
										onResetPrior={() => setPrior(a.id, null)}
									/>
								))}
							</tbody>
						))}
						{unranked.length > 0 && (
							<tbody>
								{unranked.map(a => (
									<AnswerRow
										key={a.id}
										answer={a}
										can={can}
										busy={busy}
										drag={drag}
										onTerm={term => setTerm(a, term)}
										onAlias={alias => addAlias(a, alias)}
										onRemove={() => remove(a)}
										onResetPrior={() => setPrior(a.id, null)}
									/>
								))}
							</tbody>
						)}
					</table>
				</div>
			)}
		</div>
	);
}

export default function AscentWordListPage() {
	const router = useRouter();
	const id = Number(router.query.id);
	return (
		<AdminShell title="The Ascent: word list" wide>
			<AscentTabs />
			{router.isReady && Number.isInteger(id) ? <WordList id={id} /> : router.isReady ? <p className="ta-error">Bad prompt id.</p> : null}
		</AdminShell>
	);
}
