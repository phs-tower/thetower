/** @format */

import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAdmin } from "~/components/admin/AdminShell";
import { formatWeights, formToWeights, weightsToForm, type AscentPrompt, type Phase, type WeightsForm } from "~/lib/console/ascent";

// Pieces shared by the Ascent screens (pages/admin/ascent/*).

const TABS = [
	{ href: "/admin/ascent", label: "Week" },
	{ href: "/admin/ascent/bank", label: "Bank" },
	{ href: "/admin/ascent/review", label: "Review" },
];

export function AscentTabs() {
	const router = useRouter();
	return (
		<div className="ta-tabs">
			{TABS.map(t => (
				<Link key={t.href} href={t.href} className={router.pathname === t.href ? "active" : ""}>
					{t.label}
				</Link>
			))}
		</div>
	);
}

/** The time, re-read every 30 seconds so a prompt opening or closing while
 *  the page is up locks what it should. */
export function useNow(): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const t = setInterval(() => setNow(new Date()), 30_000);
		return () => clearInterval(t);
	}, []);
	return now;
}

const PHASE_LABEL: Record<Phase, string> = { bank: "Bank", upcoming: "Not open yet", open: "Open now", closed: "Closed" };
const PHASE_CLASS: Record<Phase, string> = { bank: "", upcoming: "", open: "green", closed: "gray" };

export function PhaseBadge({ phase }: { phase: Phase }) {
	return <span className={`ta-badge ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>;
}

export function errorText(e: unknown): string {
	if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
	return String(e);
}

/** A prompt's three weights. Read-only unless `editable`; saving calls
 *  ascent_set_weights for this prompt alone. */
export function WeightsEditor({
	prompt,
	editable,
	onSaved,
}: {
	prompt: Pick<AscentPrompt, "id" | "wiki_weight" | "prior_weight" | "turnout">;
	editable: boolean;
	onSaved: () => void;
}) {
	const { supabase } = useAdmin();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState<WeightsForm>(() => weightsToForm(prompt));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setForm(weightsToForm(prompt));
	}, [prompt.id, prompt.wiki_weight, prompt.prior_weight, prompt.turnout]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!editable || !open)
		return (
			<div className="ta-asc-weights">
				<span className="ta-muted">{formatWeights(prompt)}</span>
				{editable && (
					<button className="ta-linkish" onClick={() => setOpen(true)}>
						Edit weights
					</button>
				)}
				{!editable && <span className="ta-muted ta-asc-note">(final)</span>}
			</div>
		);

	const save = async () => {
		const parsed = formToWeights(form);
		if (!parsed.ok) {
			setError(parsed.error);
			return;
		}
		setBusy(true);
		setError(null);
		const { error: err } = await supabase.rpc("ascent_set_weights", {
			p_prompt_id: prompt.id,
			p_wiki_weight: parsed.weights.wiki_weight,
			p_prior_weight: parsed.weights.prior_weight,
			p_turnout: parsed.weights.turnout,
		});
		setBusy(false);
		if (err) {
			setError(err.message);
			return;
		}
		setOpen(false);
		onSaved();
	};

	return (
		<div className="ta-asc-weights-form">
			<label>
				Wikipedia %
				<input
					type="number"
					min={0}
					max={100}
					step="any"
					value={form.wikiPct}
					onChange={e => setForm({ ...form, wikiPct: e.target.value })}
				/>
			</label>
			<label>
				Prior %
				<input
					type="number"
					min={0}
					max={100}
					step="any"
					value={form.priorPct}
					onChange={e => setForm({ ...form, priorPct: e.target.value })}
				/>
			</label>
			<label>
				Turnout
				<input type="number" min={1} step={1} value={form.turnout} onChange={e => setForm({ ...form, turnout: e.target.value })} />
			</label>
			<div className="ta-row">
				<button className="ta-btn ta-btn-small ta-btn-primary" onClick={save} disabled={busy}>
					{busy ? "Saving…" : "Save"}
				</button>
				<button
					className="ta-btn ta-btn-small"
					onClick={() => {
						setOpen(false);
						setError(null);
						setForm(weightsToForm(prompt));
					}}
					disabled={busy}
				>
					Cancel
				</button>
			</div>
			{error && <p className="ta-error">{error}</p>}
		</div>
	);
}
