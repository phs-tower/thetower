/** @format */

import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { formatEasternClock, matchupLabel, normalizeScorePair } from "~/lib/console/live";
import {
	advance,
	clockSeconds,
	computeStats,
	describePlay,
	EMPTY_SITUATION,
	formatBallOn,
	formatDownDistance,
	gamecastAvailable,
	isScoringKind,
	isScrimmage,
	isSide,
	madeLineToGain,
	normalizeClock,
	opponentAbbrev,
	ownYardLine,
	parseRosterLines,
	PERIODS,
	playData,
	playHasTeam,
	playKind,
	playPoints,
	playSituationText,
	reachesEndZone,
	recentNumbers,
	roleSide,
	scoreLines,
	scrimmageGain,
	situationColumns,
	situationFromColumns,
	situationsEqual,
	suggestNext,
	teamName,
	toGoal,
	type PlayData,
	type PlayKind,
	type PlayRow,
	type PlayType,
	type Role,
	type RosterEntry,
	type Side,
	type Situation,
} from "~/lib/console/gamecast";

// Gamecast: running a football game play by play from the sideline, for the
// app's game page (situation strip, play feed, team and player stats).
//
// Built for ONE HAND ON A PHONE while the game is going on. That is why the
// big targets, why digits-only clock entry, and why a "−" button sits beside
// the yards box (most phone number pads have no minus key).
//
// What reaches readers, and how:
//   * gamecast           the situation and the computed stats. Written here.
//   * gamecast_play      the feed. Every insert, edit and delete touches the
//                        gamecast row by trigger, which is what the app
//                        listens to, so undo reaches readers with no extra
//                        work here.
//   * broadcast          the score, exactly as the live console's score panel
//                        writes it.
// Stats are recomputed from ALL plays after every change (lib/console/
// gamecast.ts), never incremented, which is what makes undo and edits safe.
//
// The situation is only ever SUGGESTED after a play. The editor is watching
// the field; the arithmetic is a convenience and is applied on a tap.

const GAME_COLUMNS = "id, sport, level, opponent, home, status, starts_at, score_phs, score_opponent, show_score, gamecast, published";
const PLAY_COLUMNS = "id, period, clock, team, kind, description, down_distance, score_phs, score_opponent, data";

interface GameRow {
	id: number;
	sport: string;
	level: string;
	opponent: string;
	home: boolean;
	status: string;
	starts_at: string;
	score_phs: number | null;
	score_opponent: number | null;
	show_score: boolean;
	gamecast: boolean;
	published: boolean;
}

/** One play as the entry form hands it up, for a new play or an edit. */
interface PlayDraft {
	team: Side | null;
	kind: PlayKind;
	description: string;
	down_distance: string;
	period: string;
	clock: string;
	data: PlayData;
}

const nowIso = () => new Date().toISOString();

// ─── The page ───────────────────────────────────────────────────────────────

function GamecastConsole() {
	const { supabase } = useAdmin();
	const router = useRouter();
	const id = Number(router.query.id);
	const validId = router.isReady && Number.isInteger(id) && id > 0;

	const [game, setGame] = useState<GameRow | null>(null);
	const [plays, setPlays] = useState<PlayRow[]>([]);
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [situation, setSituation] = useState<Situation>(EMPTY_SITUATION);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	/** The last automatic change to the situation, kept for one-tap undo. */
	const [changed, setChanged] = useState<{ prev: Situation; next: Situation; why: string } | null>(null);
	const [editing, setEditing] = useState<PlayRow | null>(null);
	const [busy, setBusy] = useState(false);
	const [abbrev, setAbbrev] = useState("OPP");
	const entryRef = useRef<HTMLDivElement | null>(null);

	// Situation writes are queued so that four quick taps land in the order
	// they were made, whatever order the network answers in.
	const queue = useRef<Promise<unknown>>(Promise.resolve());
	const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
		const next = queue.current.then(work, work);
		queue.current = next.catch(() => undefined);
		return next;
	}, []);

	const ok = useCallback(() => {
		setError(null);
		setSavedAt(Date.now());
	}, []);

	// ── Loading ──

	const load = useCallback(async () => {
		if (!validId) return;
		const [g, c, p, r] = await Promise.all([
			supabase.from("broadcast").select(GAME_COLUMNS).eq("id", id).maybeSingle(),
			supabase.from("gamecast").select("period, clock, possession, down_distance, ball_on").eq("broadcast_id", id).maybeSingle(),
			supabase.from("gamecast_play").select(PLAY_COLUMNS).eq("broadcast_id", id).order("id", { ascending: true }),
			supabase.from("gamecast_roster").select("team, number, name, position").eq("broadcast_id", id).order("number"),
		]);
		const failed = g.error ?? c.error ?? p.error ?? r.error;
		if (failed) {
			setLoadError(
				/gamecast/i.test(failed.message) && /(does not exist|could not find|schema cache)/i.test(failed.message)
					? `${failed.message}. The Gamecast migrations (supabase/migrations/20261012000001_gamecast.sql and …0002_gamecast_console.sql) have not been applied to this project yet.`
					: failed.message
			);
			return;
		}
		if (!g.data) {
			setLoadError("There is no game with that id.");
			return;
		}
		setLoadError(null);
		setGame(g.data as GameRow);
		setPlays((p.data ?? []) as PlayRow[]);
		setRoster(((r.data ?? []) as RosterEntry[]).filter(e => isSide(e.team)));
		setSituation(c.data ? situationFromColumns(c.data) : EMPTY_SITUATION);
	}, [supabase, id, validId]);

	useEffect(() => {
		void load();
	}, [load]);

	// A phone that slept in a pocket for a quarter comes back stale. Re-read
	// when the page is shown again, unless a write is in flight.
	const busyRef = useRef(false);
	busyRef.current = busy;
	useEffect(() => {
		const onShow = () => {
			if (document.visibilityState === "visible" && !busyRef.current) void load();
		};
		document.addEventListener("visibilitychange", onShow);
		return () => document.removeEventListener("visibilitychange", onShow);
	}, [load]);

	// The short name in "HV 34". Per editor, per game: it only shapes the text
	// written to ball_on, which parses back whatever it says.
	useEffect(() => {
		if (!game) return;
		let stored: string | null = null;
		try {
			stored = window.localStorage.getItem(`gamecast-abbrev-${game.id}`);
		} catch {
			stored = null;
		}
		setAbbrev(stored || opponentAbbrev(game.opponent));
	}, [game?.id, game?.opponent]); // eslint-disable-line react-hooks/exhaustive-deps

	const saveAbbrev = (value: string) => {
		const clean = value
			.replace(/[^A-Za-z0-9 .'-]/g, "")
			.slice(0, 6)
			.toUpperCase();
		setAbbrev(clean);
		try {
			window.localStorage.setItem(`gamecast-abbrev-${id}`, clean);
		} catch {
			// Private window: the default comes back next time, which is fine.
		}
	};

	// ── Writes ──

	const writeSituation = useCallback(
		(next: Situation) => {
			setSituation(next);
			return enqueue(async () => {
				const { error: err } = await supabase
					.from("gamecast")
					.upsert({ broadcast_id: id, ...situationColumns(next, abbrev), updated_at: nowIso() });
				if (err) setError(`The situation was not saved: ${err.message}`);
				else ok();
			});
		},
		[supabase, id, abbrev, enqueue, ok]
	);

	/** Add points to the broadcast's score, read fresh so a change made on the
	 *  live console's score panel in the meantime is not overwritten. */
	const applyScore = useCallback(
		async (delta: { phs: number; opponent: number }): Promise<{ phs: number | null; opponent: number | null }> => {
			const { data, error: err } = await supabase.from("broadcast").select("score_phs, score_opponent").eq("id", id).single();
			if (err) throw new Error(`Could not read the score: ${err.message}`);
			const current = { phs: data.score_phs as number | null, opponent: data.score_opponent as number | null };
			if (delta.phs === 0 && delta.opponent === 0) return current;
			const next = normalizeScorePair({ phs: (current.phs ?? 0) + delta.phs, opponent: (current.opponent ?? 0) + delta.opponent });
			const { error: upErr } = await supabase.from("broadcast").update({ score_phs: next.phs, score_opponent: next.opponent }).eq("id", id);
			if (upErr) throw new Error(`The play was saved but the score was not: ${upErr.message}. Fix the score above.`);
			setGame(g => (g ? { ...g, score_phs: next.phs, score_opponent: next.opponent } : g));
			return next;
		},
		[supabase, id]
	);

	/** Re-read every play, recompute every stat, and bring each scoring play's
	 *  score line into agreement with the scoreboard. */
	const recompute = useCallback(
		async (totals: { phs: number | null; opponent: number | null }, rosterNow: RosterEntry[]) => {
			const { data, error: err } = await supabase
				.from("gamecast_play")
				.select(PLAY_COLUMNS)
				.eq("broadcast_id", id)
				.order("id", { ascending: true });
			if (err) throw new Error(`Could not re-read the plays: ${err.message}`);
			const rows = (data ?? []) as PlayRow[];
			const stats = computeStats(rows, rosterNow);
			const { error: statErr } = await supabase.from("gamecast").upsert({ broadcast_id: id, ...stats, updated_at: nowIso() });
			if (statErr) throw new Error(`The stats were not saved: ${statErr.message}`);
			const lines = scoreLines(rows, totals);
			const fixed = [...rows];
			for (let i = 0; i < rows.length; i++) {
				const want = lines.get(rows[i].id) ?? null;
				const phs = want ? want.phs : null;
				const opponent = want ? want.opponent : null;
				if (rows[i].score_phs === phs && rows[i].score_opponent === opponent) continue;
				const { error: lineErr } = await supabase
					.from("gamecast_play")
					.update({ score_phs: phs, score_opponent: opponent })
					.eq("id", rows[i].id);
				if (lineErr) throw new Error(`A play's score line was not updated: ${lineErr.message}`);
				fixed[i] = { ...rows[i], score_phs: phs, score_opponent: opponent };
			}
			setPlays(fixed);
		},
		[supabase, id]
	);

	/** After a play changes: move the score, then recompute. The stats are
	 *  recomputed even if the score write failed, so the feed and the stats
	 *  never disagree; the score error is still reported. */
	const scoreAndRecompute = async (delta: { phs: number; opponent: number }) => {
		let totals = { phs: game?.score_phs ?? null, opponent: game?.score_opponent ?? null };
		let scoreError: unknown = null;
		try {
			totals = await applyScore(delta);
		} catch (e) {
			scoreError = e;
		}
		await recompute(totals, roster);
		if (scoreError) throw scoreError;
	};

	const mutate = useCallback(
		async (work: () => Promise<void>) => {
			setBusy(true);
			try {
				await work();
				ok();
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setBusy(false);
			}
		},
		[ok]
	);

	const postPlay = (draft: PlayDraft) =>
		mutate(async () => {
			const before = situation;
			const pts = playPoints(draft.data, draft.team);
			const { error: err } = await supabase.from("gamecast_play").insert({
				broadcast_id: id,
				period: draft.period,
				clock: draft.clock,
				team: draft.team,
				kind: draft.kind,
				description: draft.description,
				down_distance: draft.down_distance,
				data: draft.data,
			});
			if (err) throw new Error(`The play was not posted: ${err.message}`);
			await scoreAndRecompute(pts);
			// The situation moves on by itself; the bar says what changed and
			// offers Undo, for when the field disagrees with the arithmetic.
			const next = suggestNext(before, draft.data, draft.team);
			if (next && !situationsEqual(next, before)) {
				await writeSituation(next);
				setChanged({ prev: before, next, why: "Updated after the play" });
			} else setChanged(null);
			window.scrollTo({ top: 0, behavior: "smooth" });
		});

	const updatePlay = (row: PlayRow, draft: PlayDraft) =>
		mutate(async () => {
			const oldPts = playPoints(playData(row), isSide(row.team) ? row.team : null);
			const newPts = playPoints(draft.data, draft.team);
			const { error: err } = await supabase
				.from("gamecast_play")
				.update({
					period: draft.period,
					clock: draft.clock,
					team: draft.team,
					kind: draft.kind,
					description: draft.description,
					down_distance: draft.down_distance,
					data: draft.data,
				})
				.eq("id", row.id);
			if (err) throw new Error(`The edit was not saved: ${err.message}`);
			await scoreAndRecompute({ phs: newPts.phs - oldPts.phs, opponent: newPts.opponent - oldPts.opponent });
			setEditing(null);
		});

	const deletePlay = (row: PlayRow) =>
		mutate(async () => {
			const pts = playPoints(playData(row), isSide(row.team) ? row.team : null);
			const newest = plays.length > 0 && plays[plays.length - 1].id === row.id;
			const { error: err } = await supabase.from("gamecast_play").delete().eq("id", row.id);
			if (err) throw new Error(`The play was not removed: ${err.message}`);
			await scoreAndRecompute({ phs: -pts.phs, opponent: -pts.opponent });
			setEditing(e => (e?.id === row.id ? null : e));
			// Undoing the last play puts the situation back where it was.
			const restore = newest ? situationBefore(row, situation) : null;
			if (restore && !situationsEqual(restore, situation)) {
				await writeSituation(restore);
				setChanged({ prev: situation, next: restore, why: "Back to before the undone play" });
			}
		});

	const setScore = (phs: number | null, opponent: number | null) =>
		mutate(async () => {
			const next = normalizeScorePair({ phs, opponent });
			setGame(g => (g ? { ...g, score_phs: next.phs, score_opponent: next.opponent } : g));
			const { error: err } = await supabase.from("broadcast").update({ score_phs: next.phs, score_opponent: next.opponent }).eq("id", id);
			if (err) throw new Error(`The score was not saved: ${err.message}`);
			await recompute(next, roster);
		});

	const setGamecast = (on: boolean) =>
		mutate(async () => {
			const { error: err } = await supabase.from("broadcast").update({ gamecast: on }).eq("id", id);
			if (err) throw new Error(err.message);
			setGame(g => (g ? { ...g, gamecast: on } : g));
		});

	const rosterChanged = (next: RosterEntry[]) =>
		mutate(async () => {
			setRoster(next);
			// Player stat rows carry names, so a roster fix has to reach them.
			await recompute({ phs: game?.score_phs ?? null, opponent: game?.score_opponent ?? null }, next);
		});

	// ── Render ──

	if (loadError) {
		return (
			<div className="ta-stack">
				<BackLink />
				<p className="ta-error">{loadError}</p>
				<button className="ta-btn" onClick={() => void load()}>
					Try again
				</button>
			</div>
		);
	}
	if (!game) return <p className="ta-muted">Loading the game…</p>;

	const offered = gamecastAvailable(game.sport);

	return (
		<div className="ta-gc">
			<div className="ta-gc-title">
				<BackLink />
				<span className="ta-muted ta-small">
					{matchupLabel(game)} · {game.level} {game.sport}
					{game.published ? "" : " · NOT PUBLISHED"}
				</span>
			</div>

			{!game.gamecast && (
				<div className="ta-live-warn">
					<b>Gamecast is off for this game.</b> Readers see the ordinary game page, and nothing entered here reaches them until it is on.
					{offered ? (
						<div style={{ marginTop: "0.5rem" }}>
							<button className="ta-btn ta-btn-primary" disabled={busy} onClick={() => void setGamecast(true)}>
								Turn Gamecast on
							</button>
						</div>
					) : (
						<div>Gamecast is for football; this game is {game.sport || "not a sport the console recognises"}.</div>
					)}
				</div>
			)}

			<GameBar
				game={game}
				situation={situation}
				abbrev={abbrev}
				busy={busy}
				error={error}
				savedAt={savedAt}
				changed={changed}
				onSituation={next => {
					setChanged(null);
					void writeSituation(next);
				}}
				onScore={setScore}
				onAbbrev={saveAbbrev}
				onUndoChange={() => {
					if (!changed) return;
					void writeSituation(changed.prev);
					setChanged(null);
				}}
				onDismissChange={() => setChanged(null)}
				onReload={() => void load()}
			/>

			<div ref={entryRef}>
				<PlayEntry
					key={editing ? `edit-${editing.id}` : "new"}
					editing={editing}
					situation={situation}
					abbrev={abbrev}
					roster={roster}
					plays={plays}
					opponent={game.opponent}
					busy={busy}
					onPost={postPlay}
					onUpdate={updatePlay}
					onDelete={deletePlay}
					onCancel={() => setEditing(null)}
					onClock={clock => void writeSituation({ ...situation, clock })}
				/>
			</div>

			<Feed
				plays={plays}
				opponent={game.opponent}
				busy={busy}
				editingId={editing?.id ?? null}
				onEdit={row => {
					setEditing(row);
					entryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
				}}
				onUndo={row => void deletePlay(row)}
			/>

			<RosterPanel gameId={id} roster={roster} opponent={game.opponent} onChanged={rosterChanged} />

			<ReaderPreview plays={plays} roster={roster} opponent={game.opponent} />

			{game.gamecast && (
				<div className="ta-card ta-gc-section">
					<h3>Gamecast switch</h3>
					<button className="ta-btn" disabled={busy} onClick={() => void setGamecast(false)}>
						Turn Gamecast off
					</button>
					<p className="ta-muted ta-small">
						Readers go back to the ordinary game page. Nothing here is deleted: turn it back on and the feed and stats return as they
						were.
					</p>
				</div>
			)}
		</div>
	);
}

function BackLink() {
	return (
		<Link href="/admin/live" className="ta-gc-back">
			← Live console
		</Link>
	);
}

/** The situation a play was posted from, rebuilt from its data. */
function situationBefore(row: PlayRow, current: Situation): Situation | null {
	const d = playData(row);
	if (!d) return null;
	const label = d.down ? "" : d.type === "kickoff" ? "Kickoff" : d.type === "extra_point" || d.type === "two_point" ? "PAT" : "";
	return {
		period: row.period || current.period,
		clock: row.clock,
		possession: isSide(row.team) ? row.team : current.possession,
		down: d.down ?? null,
		distance: d.distance ?? null,
		goal: Boolean(d.goal),
		spot: d.spot ?? null,
		label,
	};
}

// ─── Situation ──────────────────────────────────────────────────────────────

function Seg<T extends string | number | null>({
	options,
	value,
	onPick,
	wrap,
}: {
	options: Array<{ value: T; label: string }>;
	value: T;
	onPick: (v: T) => void;
	wrap?: boolean;
}) {
	return (
		<div className={`ta-gc-seg${wrap ? " wrap" : ""}`}>
			{options.map(o => (
				<button
					key={String(o.value)}
					type="button"
					className={o.value === value ? "on" : ""}
					aria-pressed={o.value === value}
					onClick={() => onPick(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

/** A box that commits on Enter or on leaving it, never per keystroke: a
 *  half-typed "1" on its way to "12" must not go out to readers. */
function CommitInput({
	value,
	onCommit,
	placeholder,
	className,
	numeric,
	ariaLabel,
}: {
	value: string;
	onCommit: (text: string) => boolean | void;
	placeholder?: string;
	className?: string;
	numeric?: boolean;
	ariaLabel: string;
}) {
	const [text, setText] = useState(value);
	const [bad, setBad] = useState(false);
	useEffect(() => {
		setText(value);
		setBad(false);
	}, [value]);
	const commit = () => {
		if (text === value) return;
		const accepted = onCommit(text);
		if (accepted === false) setBad(true);
	};
	return (
		<input
			type="text"
			aria-label={ariaLabel}
			className={`${className ?? ""}${bad ? " bad" : ""}`}
			inputMode={numeric ? "numeric" : undefined}
			value={text}
			placeholder={placeholder}
			onChange={e => {
				setText(e.target.value);
				setBad(false);
			}}
			onBlur={commit}
			onKeyDown={e => {
				if (e.key === "Enter") e.currentTarget.blur();
			}}
		/>
	);
}

/**
 * The top of the screen, pinned while the editor scrolls: score, period,
 * clock and the situation. The full situation editor folds away behind
 * Adjust, because the plays move the situation on by themselves and it is
 * only needed to correct them. The clock is set at the start of each play,
 * in the play form, so it is only shown here.
 */
function GameBar({
	game,
	situation: s,
	abbrev,
	busy,
	error,
	savedAt,
	changed,
	onSituation,
	onScore,
	onAbbrev,
	onUndoChange,
	onDismissChange,
	onReload,
}: {
	game: GameRow;
	situation: Situation;
	abbrev: string;
	busy: boolean;
	error: string | null;
	savedAt: number | null;
	changed: { prev: Situation; next: Situation; why: string } | null;
	onSituation: (next: Situation) => void;
	onScore: (phs: number | null, opponent: number | null) => void;
	onAbbrev: (value: string) => void;
	onUndoChange: () => void;
	onDismissChange: () => void;
	onReload: () => void;
}) {
	const [open, setOpen] = useState(false);
	const set = (patch: Partial<Situation>) => onSituation({ ...s, ...patch });

	// The console's section nav is pinned to the top as well; sit just under
	// it rather than slide beneath it. Its height changes with the window.
	const [top, setTop] = useState(0);
	useEffect(() => {
		const nav = document.querySelector<HTMLElement>(".ta-nav");
		if (!nav) return;
		const measure = () => setTop(nav.getBoundingClientRect().height);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(nav);
		return () => observer.disconnect();
	}, []);

	const dd = formatDownDistance(s);
	const at = formatBallOn(s.spot, abbrev);
	const where = [dd, at ? `${dd ? "at " : ""}${at}` : ""].filter(Boolean).join(" ");

	return (
		<div className="ta-gc-bar" style={{ top }}>
			<div className="ta-gc-bar-top">
				<div className="ta-gc-bar-score" aria-label="Score">
					<span>PHS</span>
					<b>{game.score_phs ?? "–"}</b>
					<span>–</span>
					<b>{game.score_opponent ?? "–"}</b>
					<span>{abbrev}</span>
				</div>
				<div className="ta-gc-bar-time">
					{s.period} {s.clock}
				</div>
			</div>

			<button type="button" className={`ta-gc-bar-sit${open ? " open" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
				<span className="ta-gc-bar-poss">{s.possession ? `${s.possession === "phs" ? "PHS" : abbrev} ball` : "No possession"}</span>
				<b>{where || "Set the situation"}</b>
				<span className="ta-gc-bar-adjust">{open ? "Done" : "Adjust"}</span>
			</button>

			{changed && !open && (
				<div className="ta-gc-bar-note">
					<span>{changed.why}.</span>
					<button type="button" className="ta-gc-linkbtn" onClick={onUndoChange}>
						Undo
					</button>
					<button type="button" className="ta-gc-linkbtn" onClick={onDismissChange}>
						OK
					</button>
				</div>
			)}
			{error ? (
				<div className="ta-gc-bar-error">
					<span>{error}</span>
					<button type="button" className="ta-gc-linkbtn" onClick={onReload}>
						Reload
					</button>
				</div>
			) : (
				<div className="ta-gc-bar-saved">
					{busy ? "Saving…" : savedAt ? `Saved ${formatEasternClock(savedAt, true)} · readers see it in about a second` : ""}
				</div>
			)}

			{open && <SituationEditor situation={s} abbrev={abbrev} game={game} busy={busy} set={set} onScore={onScore} onAbbrev={onAbbrev} />}
		</div>
	);
}

function SituationEditor({
	situation: s,
	abbrev,
	game,
	busy,
	set,
	onScore,
	onAbbrev,
}: {
	situation: Situation;
	abbrev: string;
	game: GameRow;
	busy: boolean;
	set: (patch: Partial<Situation>) => void;
	onScore: (phs: number | null, opponent: number | null) => void;
	onAbbrev: (value: string) => void;
}) {
	const side: Side | null = s.spot === null ? null : s.spot <= 50 ? "phs" : "opponent";
	const yard = s.spot === null ? "" : String(s.spot <= 50 ? s.spot : 100 - s.spot);
	const nudge = (n: number) => {
		if (s.spot === null) return;
		set({ spot: Math.min(100, Math.max(0, advance(s.possession ?? "phs", s.spot, n))) });
	};
	const bump = (team: Side, delta: number) => {
		const phs = game.score_phs ?? 0;
		const opponent = game.score_opponent ?? 0;
		onScore(team === "phs" ? Math.max(0, phs + delta) : phs, team === "opponent" ? Math.max(0, opponent + delta) : opponent);
	};

	return (
		<div className="ta-gc-adjust">
			<div className="ta-gc-inline">
				<span className="ta-gc-label">Period</span>
				<Seg wrap options={PERIODS.map(p => ({ value: p, label: p }))} value={s.period} onPick={period => set({ period })} />
			</div>

			<div className="ta-gc-inline">
				<span className="ta-gc-label">Ball</span>
				<Seg
					options={[
						{ value: "phs" as Side | null, label: "PHS" },
						{ value: "opponent" as Side | null, label: abbrev },
						{ value: null as Side | null, label: "—" },
					]}
					value={s.possession}
					onPick={possession => set({ possession })}
				/>
			</div>

			<div className="ta-gc-inline">
				<span className="ta-gc-label">Down</span>
				<Seg
					options={[
						{ value: 1 as number | null, label: "1" },
						{ value: 2 as number | null, label: "2" },
						{ value: 3 as number | null, label: "3" },
						{ value: 4 as number | null, label: "4" },
						{ value: null as number | null, label: "—" },
					]}
					value={s.down}
					onPick={down => set({ down, label: down ? "" : s.label, distance: down && s.distance === null && !s.goal ? 10 : s.distance })}
				/>
			</div>

			{s.down !== null ? (
				<div className="ta-gc-inline">
					<span className="ta-gc-label">To go</span>
					<CommitInput
						ariaLabel="Yards to go"
						className="ta-gc-yard"
						numeric
						value={s.goal || s.distance === null ? "" : String(s.distance)}
						placeholder={s.goal ? "Goal" : "10"}
						onCommit={text => {
							const n = Number(text.trim());
							if (!text.trim() || !Number.isInteger(n) || n < 0 || n > 99) return false;
							set({ distance: n, goal: false });
						}}
					/>
					<button className="ta-btn ta-gc-big" onClick={() => set({ distance: 10, goal: false })}>
						10
					</button>
					<button className={`ta-btn ta-gc-big${s.goal ? " ta-btn-primary" : ""}`} onClick={() => set({ goal: !s.goal })}>
						Goal
					</button>
				</div>
			) : (
				<div className="ta-gc-inline">
					<span className="ta-gc-label">Show</span>
					<Seg
						options={[
							{ value: "", label: "Nothing" },
							{ value: "Kickoff", label: "Kickoff" },
							{ value: "PAT", label: "PAT" },
						]}
						value={s.label}
						onPick={label => set({ label })}
					/>
				</div>
			)}

			<div className="ta-gc-inline">
				<span className="ta-gc-label">Spot</span>
				<Seg
					options={[
						{ value: "phs" as Side | null, label: "PHS" },
						{ value: "opponent" as Side | null, label: abbrev },
					]}
					value={side}
					onPick={next => {
						const y = s.spot === null ? 25 : Number(yard);
						if (next) set({ spot: next === "phs" ? y : 100 - y });
					}}
				/>
				<CommitInput
					ariaLabel="Yard line"
					className="ta-gc-yard"
					numeric
					value={yard}
					placeholder="yd"
					onCommit={text => {
						if (!text.trim()) {
							set({ spot: null });
							return;
						}
						const n = Number(text.trim());
						if (!Number.isInteger(n) || n < 0 || n > 50) return false;
						const onSide = side ?? s.possession ?? "phs";
						set({ spot: n === 50 ? 50 : onSide === "phs" ? n : 100 - n });
					}}
				/>
			</div>
			{s.spot !== null && (
				<div className="ta-gc-inline">
					<span className="ta-gc-label">Move</span>
					{[-5, -1, 1, 5].map(n => (
						<button key={n} type="button" className="ta-btn ta-gc-big" onClick={() => nudge(n)}>
							{n > 0 ? `+${n}` : `−${-n}`}
						</button>
					))}
				</div>
			)}

			<div className="ta-gc-inline">
				<span className="ta-gc-label">Score</span>
				{(["phs", "opponent"] as Side[]).map(team => (
					<span key={team} className="ta-gc-scorefix">
						{team === "phs" ? "PHS" : abbrev}
						<button className="ta-btn ta-gc-big" disabled={busy} onClick={() => bump(team, -1)} aria-label="minus one">
							−
						</button>
						<button className="ta-btn ta-gc-big" disabled={busy} onClick={() => bump(team, 1)} aria-label="plus one">
							+
						</button>
					</span>
				))}
			</div>
			<p className="ta-muted ta-small" style={{ margin: "0 0 0.5rem" }}>
				Scoring plays move the score by themselves; this is for corrections.
				{!game.show_score && " The scoreboard is off for this game, so readers do not see the score."}
			</p>

			<label className="ta-gc-abbrev">
				Short name for {abbrev === "OPP" ? "the opponent" : abbrev}
				<input type="text" value={abbrev} maxLength={6} onChange={e => onAbbrev(e.target.value)} />
			</label>
		</div>
	);
}

// ─── Play entry ─────────────────────────────────────────────────────────────

interface Form {
	pick: string;
	type: PlayType | null;
	/** null: follow the strip's possession. */
	team: Side | null;
	nums: Partial<Record<Role, string>>;
	yards: string;
	negative: boolean;
	ret: string;
	complete: boolean;
	good: boolean;
	/** null: worked out from the yards, shown as "auto". */
	touchdown: boolean | null;
	firstDown: boolean | null;
	fumble: boolean;
	turnover: boolean;
	safety: boolean;
	touchback: boolean;
	method: "rush" | "pass";
	penaltyOn: Side | null;
	penaltyName: string;
	/** Kickoffs: the kicking team's own yard line. "" means the default. */
	kickFrom: string;
	text: string;
	/** null: the generated line. */
	description: string | null;
	period: string;
	clock: string;
}

const blankForm = (): Form => ({
	pick: "",
	type: null,
	team: null,
	nums: {},
	yards: "",
	negative: false,
	ret: "",
	complete: true,
	good: true,
	touchdown: null,
	firstDown: null,
	fumble: false,
	turnover: false,
	safety: false,
	touchback: false,
	method: "rush",
	penaltyOn: null,
	penaltyName: "",
	kickFrom: "",
	text: "",
	description: null,
	period: "",
	clock: "",
});

/** The buttons, in the order plays happen most. Fumble and incomplete are
 *  shortcuts into run and pass rather than types of their own. */
const PICKS: Array<{ key: string; label: string; type: PlayType; preset?: Partial<Form> }> = [
	{ key: "rush", label: "Run", type: "rush" },
	{ key: "pass", label: "Pass", type: "pass", preset: { complete: true } },
	{ key: "incomplete", label: "Incomplete", type: "pass", preset: { complete: false } },
	{ key: "sack", label: "Sack", type: "sack" },
	{ key: "penalty", label: "Penalty", type: "penalty" },
	{ key: "punt", label: "Punt", type: "punt" },
	{ key: "kickoff", label: "Kickoff", type: "kickoff" },
	{ key: "extra_point", label: "Extra point", type: "extra_point" },
	{ key: "field_goal", label: "Field goal", type: "field_goal" },
	{ key: "two_point", label: "2-pt try", type: "two_point" },
	{ key: "fumble", label: "Fumble", type: "rush", preset: { fumble: true, turnover: true } },
	{ key: "interception", label: "Interception", type: "interception" },
	{ key: "kneel", label: "Kneel", type: "kneel" },
	{ key: "timeout", label: "Timeout", type: "timeout" },
	{ key: "period_end", label: "End of period", type: "period_end" },
	{ key: "note", label: "Note", type: "note" },
];

const PENALTIES = [
	"False start",
	"Holding",
	"Offside",
	"Encroachment",
	"Delay of game",
	"Pass interference",
	"Personal foul",
	"Facemask",
	"Illegal procedure",
];

/** The players a play type asks for, in the order they are asked. */
function rolesFor(f: Form): Role[] {
	switch (f.type) {
		case "rush":
			return f.fumble ? ["carrier", "tackler", "recoverer"] : ["carrier", "tackler"];
		case "pass":
			if (!f.complete) return ["passer", "receiver"];
			return f.fumble ? ["passer", "receiver", "tackler", "recoverer"] : ["passer", "receiver", "tackler"];
		case "sack":
			return f.fumble ? ["carrier", "tackler", "recoverer"] : ["carrier", "tackler"];
		case "kneel":
			return ["carrier"];
		case "interception":
			return ["passer", "receiver", "interceptor", "tackler"];
		case "punt":
		case "kickoff":
			if (f.touchback) return ["kicker"];
			return f.turnover ? ["kicker", "returner", "recoverer"] : ["kicker", "returner", "tackler"];
		case "field_goal":
		case "extra_point":
			return ["kicker"];
		case "two_point":
			return f.method === "pass" ? ["passer", "receiver"] : ["carrier"];
		case "penalty":
			return ["player"];
		default:
			return [];
	}
}

function roleLabel(role: Role, f: Form): string {
	switch (role) {
		case "carrier":
			return f.type === "sack" || f.type === "kneel" ? "QB" : "Ball carrier";
		case "passer":
			return "Passer";
		case "receiver":
			return f.type === "interception" || !f.complete ? "Intended for" : "Caught by";
		case "kicker":
			return f.type === "punt" ? "Punter" : "Kicker";
		case "returner":
			return "Returner";
		case "tackler":
			return f.type === "sack" ? "Sacked by" : "Tackled by";
		case "interceptor":
			return "Intercepted by";
		case "recoverer":
			return "Recovered by";
		case "player":
			return "Player (optional)";
	}
}

function yardsLabel(f: Form): string | null {
	switch (f.type) {
		case "rush":
			return "Gain";
		case "pass":
			return f.complete ? "Gain" : null;
		case "sack":
		case "kneel":
			return "Loss";
		case "punt":
			return "Punt distance";
		case "kickoff":
			return "Kick distance";
		case "field_goal":
			return "Distance";
		case "interception":
			return "Return";
		case "penalty":
			return "Yards";
		default:
			return null;
	}
}

const asNumber = (s: string | undefined): number | undefined => {
	const t = (s ?? "").trim();
	if (!t) return undefined;
	const n = Number(t);
	return Number.isInteger(n) && n >= 0 && n <= 99 ? n : undefined;
};

/** The form → gamecast_play.data. Only the fields this type uses go in, so
 *  a number typed under another type and abandoned never reaches stats. */
function buildData(
	f: Form,
	team: Side,
	before: Situation,
	auto: { touchdown: boolean; firstDown: boolean; fgDistance: number | null; kickFrom: number }
): PlayData {
	const type = f.type!;
	const d: PlayData = { v: 1, type, down: before.down, distance: before.distance, goal: before.goal, spot: before.spot };
	for (const role of rolesFor(f)) {
		const n = asNumber(f.nums[role]);
		if (n !== undefined) d[role] = n;
	}
	const raw = Number(f.yards.trim() || "0");
	const y = Number.isFinite(raw) ? Math.abs(Math.round(raw)) : 0;
	const touchdown = f.touchdown ?? auto.touchdown;
	const firstDown = f.firstDown ?? auto.firstDown;
	switch (type) {
		case "rush":
		case "pass":
			if (type === "pass") d.complete = f.complete;
			if (type === "rush" || f.complete) {
				d.yards = f.negative ? -y : y;
				d.touchdown = touchdown;
				d.first_down = firstDown && !(f.fumble && f.turnover);
				d.fumble = f.fumble;
				d.turnover = f.fumble && f.turnover;
				d.safety = f.safety;
			}
			break;
		case "sack":
		case "kneel":
			d.yards = -y;
			if (type === "sack") {
				d.fumble = f.fumble;
				d.turnover = f.fumble && f.turnover;
				d.touchdown = f.fumble && f.turnover && Boolean(f.touchdown);
			}
			d.safety = f.safety;
			break;
		case "interception":
			d.return_yards = y;
			d.touchdown = Boolean(f.touchdown);
			break;
		case "punt":
		case "kickoff":
			// A kickoff's spot is where it was kicked from, not the strip's.
			if (type === "kickoff") d.spot = ownYardLine(team, asNumber(f.kickFrom) ?? auto.kickFrom);
			d.yards = y;
			d.touchback = f.touchback;
			if (!f.touchback) {
				d.return_yards = asNumber(f.ret) ?? 0;
				d.turnover = f.turnover;
				d.touchdown = Boolean(f.touchdown);
			}
			break;
		case "field_goal":
			d.yards = f.yards.trim() ? y : auto.fgDistance;
			d.good = f.good;
			break;
		case "extra_point":
			d.good = f.good;
			break;
		case "two_point":
			d.method = f.method;
			d.good = f.good;
			break;
		case "penalty":
			d.yards = y;
			d.penalty_on = f.penaltyOn ?? team;
			d.penalty_name = f.penaltyName.trim();
			d.first_down = firstDown;
			d.safety = f.safety;
			break;
		case "note":
			d.text = f.text.trim();
			break;
	}
	return d;
}

/** A stored play → the form, for editing. */
function formFromPlay(row: PlayRow, ctx: { roster: RosterEntry[]; opponent: string }): Form {
	const d = playData(row);
	const f = blankForm();
	f.period = row.period;
	f.clock = row.clock;
	f.team = isSide(row.team) ? row.team : null;
	if (!d) {
		f.pick = "note";
		f.type = "note";
		f.text = row.description;
		return f;
	}
	f.type = d.type;
	f.pick =
		d.type === "pass" && !d.complete ? "incomplete" : d.type === "rush" && d.fumble ? "fumble" : PICKS.find(p => p.type === d.type)?.key ?? "";
	const roles: Role[] = ["passer", "carrier", "receiver", "kicker", "returner", "tackler", "interceptor", "recoverer", "player"];
	for (const role of roles) if (typeof d[role] === "number") f.nums[role] = String(d[role]);
	const y = d.type === "interception" ? d.return_yards ?? d.yards ?? 0 : d.yards ?? 0;
	f.yards = d.yards === null && d.type !== "interception" ? "" : String(Math.abs(y));
	f.negative = (d.type === "rush" || d.type === "pass") && y < 0;
	f.ret = d.return_yards ? String(d.return_yards) : "";
	f.complete = d.complete ?? true;
	f.good = d.good ?? true;
	f.touchdown = d.touchdown ?? null;
	f.firstDown = d.first_down ?? null;
	f.fumble = Boolean(d.fumble);
	f.turnover = Boolean(d.turnover);
	f.safety = Boolean(d.safety);
	f.touchback = Boolean(d.touchback);
	f.method = d.method ?? "rush";
	f.penaltyOn = d.penalty_on ?? null;
	f.penaltyName = d.penalty_name ?? "";
	f.text = d.text ?? "";
	if (d.type === "kickoff" && typeof d.spot === "number" && f.team) f.kickFrom = String(100 - toGoal(f.team, d.spot));
	// Keep a hand-written line; let a generated one keep regenerating.
	const generated = describePlay(d, f.team, { ...ctx, period: row.period });
	f.description = row.description === generated ? null : row.description;
	return f;
}

function PlayEntry({
	editing,
	situation,
	abbrev,
	roster,
	plays,
	opponent,
	busy,
	onPost,
	onUpdate,
	onDelete,
	onCancel,
	onClock,
}: {
	editing: PlayRow | null;
	situation: Situation;
	abbrev: string;
	roster: RosterEntry[];
	plays: PlayRow[];
	opponent: string;
	busy: boolean;
	onPost: (draft: PlayDraft) => Promise<void>;
	onUpdate: (row: PlayRow, draft: PlayDraft) => Promise<void>;
	onDelete: (row: PlayRow) => Promise<void>;
	onCancel: () => void;
	/** The clock at the snap, set first for every new play. */
	onClock: (clock: string) => void;
}) {
	const [editText, setEditText] = useState(false);
	const [f, setF] = useState<Form>(() => (editing ? formFromPlay(editing, { roster, opponent }) : blankForm()));
	const [confirmDelete, setConfirmDelete] = useState(false);
	const set = (patch: Partial<Form>) => setF(prev => ({ ...prev, ...patch }));

	// The situation the play was run from: the strip for a new play, the
	// play's own record for an edit.
	const before: Situation = useMemo(
		() => (editing ? situationBefore(editing, situation) ?? situation : situation),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editing, situation]
	);
	const hasTeam = f.type !== null && playHasTeam(f.type);
	const team: Side = f.team ?? before.possession ?? "phs";
	const teamSituation: Situation = { ...before, possession: team };

	const auto = useMemo(() => {
		// Kick off from the strip's spot if it is on the kicking team's own half
		// (a safety kick from the 20, a penalty), otherwise from their 40.
		const own = before.spot === null ? null : 100 - toGoal(team, before.spot);
		const kickFrom = own !== null && own >= 1 && own <= 50 ? own : 40;
		const probe = f.type ? buildData(f, team, teamSituation, { touchdown: false, firstDown: false, fgDistance: null, kickFrom }) : null;
		const gain = probe && (probe.type === "rush" || probe.type === "pass") ? scrimmageGain(probe) : 0;
		const lost = f.fumble && f.turnover;
		const touchdown = !lost && (f.type === "rush" || (f.type === "pass" && f.complete)) && reachesEndZone(team, before.spot, gain);
		let firstDown = false;
		if (f.type === "rush" || (f.type === "pass" && f.complete)) firstDown = madeLineToGain(teamSituation, gain) && !lost;
		if (f.type === "penalty") {
			const on = f.penaltyOn ?? team;
			const dist = teamSituation.goal && before.spot !== null ? toGoal(team, before.spot) : before.distance;
			firstDown = on !== team && dist !== null && before.down !== null && Number(f.yards || 0) >= dist;
		}
		const fgDistance = f.type === "field_goal" && before.spot !== null ? toGoal(team, before.spot) + 17 : null;
		return { touchdown, firstDown, fgDistance, kickFrom };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [f, team, before]);

	const data = f.type ? buildData(f, team, teamSituation, auto) : null;
	const rowTeam = data && hasTeam ? team : null;
	const period = editing ? f.period : situation.period;
	const ctx = { roster, opponent, period };
	const generated = data ? describePlay(data, rowTeam, ctx) : "";
	const description = f.description ?? generated;
	const kind = data ? playKind(data, rowTeam) : null;
	const points = data ? playPoints(data, rowTeam) : { phs: 0, opponent: 0 };

	const pick = (key: string) => {
		const p = PICKS.find(x => x.key === key)!;
		setConfirmDelete(false);
		// Switching type keeps the team and the clock and drops everything else,
		// so a returner typed under "Punt" cannot leak into a run.
		setF(prev => ({ ...blankForm(), team: prev.team, period: prev.period, clock: prev.clock, pick: key, type: p.type, ...(p.preset ?? {}) }));
	};

	const submit = async () => {
		if (!data || !kind || !description.trim()) return;
		const usesDown = isScrimmage(data.type) || data.type === "penalty" || data.type === "punt" || data.type === "field_goal";
		const draft: PlayDraft = {
			team: rowTeam,
			kind,
			description: description.trim(),
			down_distance: usesDown ? playSituationText(teamSituation, abbrev) : "",
			period: editing ? f.period.trim().toUpperCase() : situation.period,
			clock: editing ? normalizeClock(f.clock) ?? f.clock : situation.clock,
			data,
		};
		if (editing) await onUpdate(editing, draft);
		else {
			await onPost(draft);
			setF(prev => ({ ...blankForm(), team: prev.team }));
			setEditText(false);
		}
	};

	const side = (role: Role): Side => (data ? roleSide(data, role, team) : team);
	const teamLabel = (s: Side) => (s === "phs" ? "PHS" : abbrev);
	const yl = yardsLabel(f);
	const showFlags = f.type === "rush" || (f.type === "pass" && f.complete) || f.type === "sack";

	return (
		<section className={`ta-card ta-gc-section ta-gc-entry${editing ? " editing" : ""}`}>
			{editing ? (
				<h3>Editing: {editing.description}</h3>
			) : (
				<div className="ta-gc-inline ta-gc-snap">
					<span className="ta-gc-label">Time</span>
					<CommitInput
						ariaLabel="Clock at the snap (type 842 for 8:42)"
						className="ta-gc-clock"
						numeric
						value={situation.clock}
						placeholder="12:00"
						onCommit={text => {
							const clock = normalizeClock(text);
							if (clock === null) return false;
							onClock(clock);
						}}
					/>
					<span className="ta-gc-snap-period">{situation.period}</span>
					<span className="ta-muted ta-small">842 = 8:42</span>
				</div>
			)}

			<div className="ta-gc-types">
				{PICKS.map(p => (
					<button
						key={p.key}
						type="button"
						className={f.pick === p.key ? "on" : ""}
						aria-pressed={f.pick === p.key}
						onClick={() => pick(p.key)}
					>
						{p.label}
					</button>
				))}
			</div>

			{f.type && (
				<>
					{hasTeam && (
						<div className="ta-gc-inline">
							<span className="ta-gc-label">
								{f.type === "punt" || f.type === "kickoff" ? "Kicking" : f.type === "timeout" ? "Called by" : "Offense"}
							</span>
							<Seg
								options={[
									{ value: "phs" as Side, label: "PHS" },
									{ value: "opponent" as Side, label: abbrev },
								]}
								value={team}
								onPick={t => set({ team: t })}
							/>
						</div>
					)}

					{editing && (
						<div className="ta-gc-field ta-gc-row">
							<label className="ta-gc-small-field">
								Period
								<input type="text" value={f.period} onChange={e => set({ period: e.target.value })} />
							</label>
							<label className="ta-gc-small-field">
								Clock
								<input type="text" inputMode="numeric" value={f.clock} onChange={e => set({ clock: e.target.value })} />
							</label>
						</div>
					)}

					{f.type === "pass" && (
						<div className="ta-gc-field">
							<Seg
								options={[
									{ value: "c", label: "Complete" },
									{ value: "i", label: "Incomplete" },
								]}
								value={f.complete ? "c" : "i"}
								onPick={v => set({ complete: v === "c", pick: v === "c" ? "pass" : "incomplete" })}
							/>
						</div>
					)}

					{f.type === "two_point" && (
						<div className="ta-gc-field">
							<Seg
								options={[
									{ value: "rush", label: "Run" },
									{ value: "pass", label: "Pass" },
								]}
								value={f.method}
								onPick={method => set({ method: method as "rush" | "pass" })}
							/>
						</div>
					)}

					{f.type === "penalty" && (
						<>
							<div className="ta-gc-field">
								<div className="ta-gc-label">Penalty on</div>
								<Seg
									options={[
										{ value: "phs" as Side, label: "PHS" },
										{ value: "opponent" as Side, label: abbrev },
									]}
									value={f.penaltyOn ?? team}
									onPick={penaltyOn => set({ penaltyOn })}
								/>
							</div>
							<div className="ta-gc-field">
								<div className="ta-gc-label">Foul</div>
								<div className="ta-gc-chips">
									{PENALTIES.map(name => (
										<button
											key={name}
											type="button"
											className={f.penaltyName === name ? "on" : ""}
											onClick={() => set({ penaltyName: name })}
										>
											{name}
										</button>
									))}
								</div>
								<input
									type="text"
									value={f.penaltyName}
									placeholder="Or type it"
									onChange={e => set({ penaltyName: e.target.value })}
								/>
							</div>
						</>
					)}

					<div className="ta-gc-picks">
						{rolesFor(f).map(role => (
							<NumberPick
								key={role}
								label={roleLabel(role, f)}
								sideLabel={teamLabel(side(role))}
								side={side(role)}
								value={f.nums[role] ?? ""}
								roster={roster}
								recent={recentNumbers(plays, role, side(role))}
								onChange={v => set({ nums: { ...f.nums, [role]: v } })}
							/>
						))}
					</div>

					{f.type === "kickoff" && (
						<div className="ta-gc-field">
							<div className="ta-gc-label">Kicked from</div>
							<div className="ta-gc-row">
								<span>{team === "phs" ? "PHS" : abbrev}</span>
								<input
									className="ta-gc-yard"
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									aria-label="Kicked from yard line"
									value={f.kickFrom}
									placeholder={String(auto.kickFrom)}
									onChange={e => set({ kickFrom: e.target.value.replace(/\D/g, "").slice(0, 2) })}
								/>
								{[40, 35, 30, 20].map(n => (
									<button
										key={n}
										type="button"
										className={`ta-btn ta-gc-big${(asNumber(f.kickFrom) ?? auto.kickFrom) === n ? " ta-btn-primary" : ""}`}
										onClick={() => set({ kickFrom: String(n) })}
									>
										{n}
									</button>
								))}
							</div>
						</div>
					)}

					{yl && (
						<div className="ta-gc-field">
							<div className="ta-gc-label">{yl}</div>
							<div className="ta-gc-row">
								{(f.type === "rush" || f.type === "pass") && (
									<button
										type="button"
										className={`ta-btn ta-gc-big${f.negative ? " ta-btn-primary" : ""}`}
										aria-pressed={f.negative}
										onClick={() => set({ negative: !f.negative })}
										title="Loss"
									>
										−
									</button>
								)}
								<input
									className="ta-gc-yard"
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									aria-label={yl}
									value={f.yards}
									placeholder={f.type === "field_goal" && auto.fgDistance ? String(auto.fgDistance) : "0"}
									onChange={e => set({ yards: e.target.value.replace(/\D/g, "").slice(0, 3) })}
								/>
								<span className="ta-muted">yds</span>
								{(f.type === "penalty" ? [5, 10, 15] : f.type === "kickoff" ? [40, 45, 50, 55, 60] : []).map(n => (
									<button
										key={n}
										type="button"
										className={`ta-btn ta-gc-big${f.yards === String(n) ? " ta-btn-primary" : ""}`}
										onClick={() => set({ yards: String(n) })}
									>
										{n}
									</button>
								))}
							</div>
							{f.type === "kickoff" && data && typeof data.spot === "number" && f.yards.trim() !== "" && (
								<div className="ta-muted ta-small" style={{ marginTop: "0.3rem" }}>
									{toGoal(team, data.spot) - Number(f.yards) <= 0
										? "Lands in the end zone. Tick Touchback below if it was downed or went out the back."
										: `Lands at ${formatBallOn(advance(team, data.spot, Number(f.yards)), abbrev)}.`}
								</div>
							)}
						</div>
					)}

					{(f.type === "punt" || f.type === "kickoff") && !f.touchback && !f.turnover && (
						<div className="ta-gc-field">
							<div className="ta-gc-label">Return</div>
							<div className="ta-gc-row">
								<input
									className="ta-gc-yard"
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									aria-label="Return yards"
									value={f.ret}
									placeholder="0"
									onChange={e => set({ ret: e.target.value.replace(/\D/g, "").slice(0, 3) })}
								/>
								<span className="ta-muted">yds</span>
							</div>
						</div>
					)}

					{(f.type === "field_goal" || f.type === "extra_point" || f.type === "two_point") && (
						<div className="ta-gc-field">
							<Seg
								options={[
									{ value: "y", label: "Good" },
									{ value: "n", label: "No good" },
								]}
								value={f.good ? "y" : "n"}
								onPick={v => set({ good: v === "y" })}
							/>
						</div>
					)}

					{f.type === "note" && (
						<div className="ta-gc-field">
							<textarea
								rows={2}
								value={f.text}
								placeholder="Lightning delay, teams off the field"
								onChange={e => set({ text: e.target.value })}
							/>
						</div>
					)}

					<div className="ta-gc-chips ta-gc-flags">
						{showFlags && f.type !== "sack" && (
							<Flag label="Touchdown" value={f.touchdown} auto={auto.touchdown} onChange={touchdown => set({ touchdown })} />
						)}
						{showFlags && f.type !== "sack" && (
							<Flag label="First down" value={f.firstDown} auto={auto.firstDown} onChange={firstDown => set({ firstDown })} />
						)}
						{showFlags && (
							<Flag label="Fumble" value={f.fumble} onChange={fumble => set({ fumble: Boolean(fumble), turnover: Boolean(fumble) })} />
						)}
						{showFlags && f.fumble && (
							<Flag label="Lost (turnover)" value={f.turnover} onChange={turnover => set({ turnover: Boolean(turnover) })} />
						)}
						{showFlags && f.fumble && f.turnover && f.type === "sack" && (
							<Flag label="Returned for TD" value={f.touchdown ?? false} onChange={touchdown => set({ touchdown })} />
						)}
						{(showFlags || f.type === "kneel" || f.type === "penalty") && (
							<Flag label="Safety" value={f.safety} onChange={safety => set({ safety: Boolean(safety) })} />
						)}
						{f.type === "penalty" && (
							<Flag label="Automatic first down" value={f.firstDown} auto={auto.firstDown} onChange={firstDown => set({ firstDown })} />
						)}
						{f.type === "interception" && (
							<Flag label="Pick six" value={f.touchdown ?? false} onChange={touchdown => set({ touchdown })} />
						)}
						{(f.type === "punt" || f.type === "kickoff") && (
							<>
								<Flag label="Touchback" value={f.touchback} onChange={touchback => set({ touchback: Boolean(touchback) })} />
								{!f.touchback && (
									<Flag
										label="Muffed, kicking team recovered"
										value={f.turnover}
										onChange={turnover => set({ turnover: Boolean(turnover) })}
									/>
								)}
								{!f.touchback && <Flag label="Touchdown" value={f.touchdown ?? false} onChange={touchdown => set({ touchdown })} />}
							</>
						)}
					</div>

					{editText || f.description !== null ? (
						<div className="ta-gc-field">
							<textarea
								className="ta-gc-desc"
								rows={2}
								autoFocus
								value={description}
								onChange={e => set({ description: e.target.value })}
							/>
							<button
								type="button"
								className="ta-gc-linkbtn"
								onClick={() => {
									set({ description: null });
									setEditText(false);
								}}
							>
								use the generated line
							</button>
						</div>
					) : null}
					{!editing && situation.clock && clockSeconds(situation.clock) === null && (
						<p className="ta-error">The time above is not a game clock; fix it before posting.</p>
					)}

					<div className="ta-gc-postbar">
						<div className="ta-gc-postbar-text">
							<div className="ta-gc-postbar-desc">{description || "…"}</div>
							<div className="ta-muted ta-small">
								{[
									!editing ? `${situation.period} ${situation.clock}`.trim() : `${f.period} ${f.clock}`.trim(),
									kind && kind !== "play" ? kind.replace("_", " ") : "",
									points.phs ? `PHS +${points.phs}` : "",
									points.opponent ? `${abbrev} +${points.opponent}` : "",
								]
									.filter(Boolean)
									.join(" · ")}
								{!editText && f.description === null && (
									<>
										{" · "}
										<button type="button" className="ta-gc-linkbtn" onClick={() => setEditText(true)}>
											edit text
										</button>
									</>
								)}
							</div>
						</div>
						<div className="ta-gc-postbar-actions">
							{editing ? (
								<>
									<button
										className={`ta-btn ta-gc-big${confirmDelete ? " ta-btn-danger" : ""}`}
										disabled={busy}
										onClick={() => (confirmDelete ? void onDelete(editing) : setConfirmDelete(true))}
									>
										{confirmDelete ? "Sure?" : "Delete"}
									</button>
									<button className="ta-btn ta-gc-big" disabled={busy} onClick={onCancel}>
										Cancel
									</button>
								</>
							) : (
								<button
									className="ta-btn ta-gc-big"
									disabled={busy}
									onClick={() => {
										setF(prev => ({ ...blankForm(), team: prev.team }));
										setEditText(false);
									}}
									aria-label="Clear"
								>
									×
								</button>
							)}
							<button className="ta-btn ta-btn-primary ta-gc-post" disabled={busy || !description.trim()} onClick={() => void submit()}>
								{busy ? "Saving…" : editing ? "Save" : "Post"}
							</button>
						</div>
					</div>
				</>
			)}
		</section>
	);
}

/** A flag the editor can set, or leave to be worked out from the yards. */
function Flag({ label, value, auto, onChange }: { label: string; value: boolean | null; auto?: boolean; onChange: (next: boolean | null) => void }) {
	const effective = value ?? auto ?? false;
	return (
		<button type="button" className={effective ? "on" : ""} aria-pressed={effective} onClick={() => onChange(!effective)}>
			{effective ? "✓ " : ""}
			{label}
			{value === null && auto !== undefined ? " (auto)" : ""}
		</button>
	);
}

function NumberPick({
	label,
	side,
	sideLabel,
	value,
	roster,
	recent,
	onChange,
}: {
	label: string;
	side: Side;
	sideLabel: string;
	value: string;
	roster: RosterEntry[];
	recent: number[];
	onChange: (v: string) => void;
}) {
	const n = asNumber(value);
	const entry = n === undefined ? undefined : roster.find(r => r.team === side && r.number === n);
	const surname = (num: number) => {
		const name = roster.find(r => r.team === side && r.number === num)?.name ?? "";
		return name.split(/\s+/).pop() ?? "";
	};
	return (
		<div className="ta-gc-pick">
			<div className="ta-gc-label">
				{label} <span className="ta-gc-side">{sideLabel}</span>
			</div>
			<div className="ta-gc-row">
				<input
					className="ta-gc-yard"
					type="text"
					inputMode="numeric"
					pattern="[0-9]*"
					aria-label={`${label} number`}
					placeholder="#"
					value={value}
					onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
				/>
				<span className={`ta-gc-pick-name${n !== undefined && !entry ? " unknown" : ""}`}>
					{n === undefined ? "" : entry ? `${entry.name}${entry.position ? ` · ${entry.position}` : ""}` : "not on roster"}
				</span>
			</div>
			{recent.length > 0 && (
				<div className="ta-gc-chips ta-gc-recent">
					{recent.map(r => (
						<button key={r} type="button" className={n === r ? "on" : ""} onClick={() => onChange(n === r ? "" : String(r))}>
							#{r} {surname(r)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

// ─── The feed ───────────────────────────────────────────────────────────────

function Feed({
	plays,
	opponent,
	busy,
	editingId,
	onEdit,
	onUndo,
}: {
	plays: PlayRow[];
	opponent: string;
	busy: boolean;
	editingId: number | null;
	onEdit: (row: PlayRow) => void;
	onUndo: (row: PlayRow) => void;
}) {
	const [armed, setArmed] = useState(false);
	const newest = plays.length ? plays[plays.length - 1] : null;
	useEffect(() => {
		if (!armed) return;
		const t = window.setTimeout(() => setArmed(false), 4000);
		return () => window.clearTimeout(t);
	}, [armed]);
	useEffect(() => setArmed(false), [newest?.id]);

	return (
		<section className="ta-card ta-gc-section">
			<div className="ta-spread">
				<h3 style={{ margin: 0 }}>Play by play ({plays.length})</h3>
				{newest && (
					<button
						className={`ta-btn ta-gc-big${armed ? " ta-btn-danger" : ""}`}
						disabled={busy}
						onClick={() => {
							if (armed) {
								setArmed(false);
								onUndo(newest);
							} else setArmed(true);
						}}
					>
						{armed ? "Tap again to undo" : "Undo last play"}
					</button>
				)}
			</div>
			{armed && newest && <p className="ta-muted ta-small">Undo “{newest.description}”?</p>}
			{plays.length === 0 ? (
				<p className="ta-muted ta-small">No plays yet. The newest appears at the top, as it does in the app.</p>
			) : (
				<ol className="ta-gc-feed">
					{[...plays].reverse().map(row => (
						<li key={row.id} className={`${isScoringKind(row.kind) ? "scoring" : ""}${editingId === row.id ? " editing" : ""}`}>
							<div className="ta-gc-feed-meta">
								{row.period} {row.clock}
								{row.team ? ` · ${teamName(row.team, opponent)}` : ""}
								{row.down_distance ? ` · ${row.down_distance}` : ""}
							</div>
							<div className="ta-gc-feed-desc">{row.description}</div>
							<div className="ta-gc-feed-foot">
								{row.score_phs !== null && row.score_opponent !== null && (
									<b>
										{row.score_phs}–{row.score_opponent}
									</b>
								)}
								{playData(row) === null && <span className="ta-muted ta-small">no play data: not counted in stats</span>}
								<button className="ta-btn ta-btn-small" disabled={busy} onClick={() => onEdit(row)}>
									Edit
								</button>
							</div>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}

// ─── Rosters ────────────────────────────────────────────────────────────────

function RosterPanel({
	gameId,
	roster,
	opponent,
	onChanged,
}: {
	gameId: number;
	roster: RosterEntry[];
	opponent: string;
	onChanged: (next: RosterEntry[]) => Promise<void>;
}) {
	const { supabase } = useAdmin();
	const [team, setTeam] = useState<Side>("phs");
	const [paste, setPaste] = useState("");
	const [problems, setProblems] = useState<string[]>([]);
	const [message, setMessage] = useState<string | null>(null);
	const [working, setWorking] = useState(false);
	const [sources, setSources] = useState<Array<{ id: number; label: string; count: number }> | null>(null);
	const [source, setSource] = useState<string>("");

	const reread = async (): Promise<RosterEntry[] | null> => {
		const { data, error } = await supabase
			.from("gamecast_roster")
			.select("team, number, name, position")
			.eq("broadcast_id", gameId)
			.order("number");
		if (error) {
			setMessage(`Could not re-read the roster: ${error.message}`);
			return null;
		}
		return ((data ?? []) as RosterEntry[]).filter(e => isSide(e.team));
	};

	const upsert = async (entries: RosterEntry[]) => {
		const { error } = await supabase
			.from("gamecast_roster")
			.upsert(entries.map(e => ({ broadcast_id: gameId, team: e.team, number: e.number, name: e.name, position: e.position })));
		if (error) throw new Error(error.message);
	};

	const add = async () => {
		const { entries, errors } = parseRosterLines(paste, team);
		setProblems(errors);
		if (entries.length === 0) {
			setMessage(errors.length ? null : "Nothing to add. One player per line: 12 J. Smith QB");
			return;
		}
		setWorking(true);
		try {
			await upsert(entries);
			const next = await reread();
			if (next) await onChanged(next);
			setPaste("");
			setMessage(
				`Saved ${entries.length} ${entries.length === 1 ? "player" : "players"}${errors.length ? "; the lines below were skipped" : ""}.`
			);
		} catch (e) {
			setMessage(`Not saved: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setWorking(false);
		}
	};

	const remove = async (entry: RosterEntry) => {
		setWorking(true);
		const { error } = await supabase.from("gamecast_roster").delete().match({ broadcast_id: gameId, team: entry.team, number: entry.number });
		if (error) setMessage(`Not removed: ${error.message}`);
		else {
			const next = await reread();
			if (next) await onChanged(next);
		}
		setWorking(false);
	};

	const loadSources = async () => {
		const { data, error } = await supabase.from("gamecast_roster").select("broadcast_id").eq("team", "phs").neq("broadcast_id", gameId);
		if (error) {
			setMessage(error.message);
			return;
		}
		const counts = new Map<number, number>();
		for (const r of (data ?? []) as Array<{ broadcast_id: number }>) counts.set(r.broadcast_id, (counts.get(r.broadcast_id) ?? 0) + 1);
		if (counts.size === 0) {
			setSources([]);
			return;
		}
		const { data: games, error: gErr } = await supabase
			.from("broadcast")
			.select("id, opponent, home, starts_at")
			.in("id", [...counts.keys()])
			.order("starts_at", { ascending: false });
		if (gErr) {
			setMessage(gErr.message);
			return;
		}
		const list = ((games ?? []) as Array<{ id: number; opponent: string; home: boolean; starts_at: string }>).map(g => ({
			id: g.id,
			label: `${matchupLabel(g)} · ${g.starts_at.slice(0, 10)}`,
			count: counts.get(g.id) ?? 0,
		}));
		setSources(list);
		if (list.length) setSource(String(list[0].id));
	};

	const copyFrom = async () => {
		const from = Number(source);
		if (!from) return;
		setWorking(true);
		try {
			const { data, error } = await supabase
				.from("gamecast_roster")
				.select("team, number, name, position")
				.eq("broadcast_id", from)
				.eq("team", "phs");
			if (error) throw new Error(error.message);
			const entries = (data ?? []) as RosterEntry[];
			await upsert(entries);
			const next = await reread();
			if (next) await onChanged(next);
			setMessage(`Copied ${entries.length} PHS players. Anyone already on this game's roster with the same number was replaced.`);
		} catch (e) {
			setMessage(`Not copied: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setWorking(false);
		}
	};

	const shown = roster.filter(r => r.team === team);

	return (
		<details className="ta-card ta-gc-section" open={roster.length === 0}>
			<summary>
				<h3 style={{ display: "inline" }}>
					Rosters · PHS {roster.filter(r => r.team === "phs").length} · {opponent || "Opponent"}{" "}
					{roster.filter(r => r.team === "opponent").length}
				</h3>
			</summary>
			<p className="ta-muted ta-small">
				Number, name as it should print (initial and surname: <i>J. Smith</i>), position. Nothing else about a player belongs here. Only the
				console reads this table.
			</p>
			<Seg
				options={[
					{ value: "phs" as Side, label: "PHS" },
					{ value: "opponent" as Side, label: opponent || "Opponent" },
				]}
				value={team}
				onPick={t => {
					setTeam(t);
					setProblems([]);
					setMessage(null);
				}}
			/>

			{shown.length > 0 && (
				<ul className="ta-gc-roster">
					{shown.map(r => (
						<li key={`${r.team}-${r.number}`}>
							<span className="ta-gc-roster-num">#{r.number}</span> {r.name} <span className="ta-muted">{r.position}</span>
							<button
								className="ta-btn ta-btn-small"
								disabled={working}
								onClick={() => void remove(r)}
								aria-label={`Remove #${r.number}`}
							>
								×
							</button>
						</li>
					))}
				</ul>
			)}

			<label style={{ display: "block", marginTop: "0.6rem" }}>
				Paste or type players, one per line
				<textarea
					rows={5}
					value={paste}
					placeholder={"12 J. Smith QB\n22 M. Ortiz RB\n4 A. Lee WR"}
					onChange={e => setPaste(e.target.value)}
				/>
			</label>
			<div className="ta-gc-row">
				<button className="ta-btn ta-btn-primary" disabled={working || !paste.trim()} onClick={() => void add()}>
					Add to {team === "phs" ? "PHS" : opponent || "opponent"}
				</button>
				<span className="ta-muted ta-small">A number already on the roster is replaced, which is how to fix a typo.</span>
			</div>
			{problems.length > 0 && (
				<ul className="ta-error ta-small">
					{problems.map(p => (
						<li key={p}>{p}</li>
					))}
				</ul>
			)}
			{message && <p className="ta-muted ta-small">{message}</p>}

			{team === "phs" && (
				<div className="ta-gc-field" style={{ marginTop: "0.8rem" }}>
					<div className="ta-gc-label">Copy the PHS roster from an earlier game</div>
					{sources === null ? (
						<button className="ta-btn" onClick={() => void loadSources()}>
							Find earlier games
						</button>
					) : sources.length === 0 ? (
						<p className="ta-muted ta-small">No other game has a PHS roster yet.</p>
					) : (
						<div className="ta-gc-row">
							<select value={source} onChange={e => setSource(e.target.value)}>
								{sources.map(s => (
									<option key={s.id} value={s.id}>
										{s.label} ({s.count})
									</option>
								))}
							</select>
							<button className="ta-btn" disabled={working} onClick={() => void copyFrom()}>
								Copy
							</button>
						</div>
					)}
				</div>
			)}
		</details>
	);
}

// ─── What readers see ───────────────────────────────────────────────────────

function ReaderPreview({ plays, roster, opponent }: { plays: PlayRow[]; roster: RosterEntry[]; opponent: string }) {
	const stats = useMemo(() => computeStats(plays, roster), [plays, roster]);
	const tables = stats.player_stats.filter(t => t.rows.length > 0);
	return (
		<details className="ta-card ta-gc-section">
			<summary>
				<h3 style={{ display: "inline" }}>Stats readers see</h3>
			</summary>
			<p className="ta-muted ta-small">Computed from every play above and written after each change. Edit a play to change these.</p>
			<table className="ta-gc-stats">
				<thead>
					<tr>
						<th />
						<th>PHS</th>
						<th>{opponent || "Opponent"}</th>
					</tr>
				</thead>
				<tbody>
					{stats.team_stats.map(s => (
						<tr key={s.label}>
							<td>{s.label}</td>
							<td>{s.phs}</td>
							<td>{s.opponent}</td>
						</tr>
					))}
				</tbody>
			</table>
			{tables.map(t => (
				<table key={t.title} className="ta-gc-stats">
					<thead>
						<tr>
							<th>{t.title}</th>
							{t.columns.map(c => (
								<th key={c}>{c}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{t.rows.map(r => (
							<tr key={`${r.team}-${r.number}`}>
								<td>
									{r.team === "phs" ? "" : `${opponent || "OPP"} `}#{r.number} {r.name}
								</td>
								{r.values.map((v, i) => (
									<td key={i}>{v}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			))}
		</details>
	);
}

export default function GamecastPage() {
	return (
		<AdminShell title="Gamecast">
			<GamecastConsole />
		</AdminShell>
	);
}
