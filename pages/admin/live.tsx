/** @format */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import {
	boardGroup,
	formatEasternClock,
	formatEasternDate,
	formatEasternStamp,
	formToIso,
	isoToForm,
	matchupLabel,
	normalizeScorePair,
	parseYouTubeId,
	PHS_LEVELS,
	PHS_SPORTS,
	previewLine,
	scorePairNeedsFill,
	scoreUnitLabel,
	shiftIso,
	sportScoring,
	youtubeThumbnail,
	type BroadcastStatus,
} from "~/lib/console/live";

// Feeds the app's News → Live tab (public.broadcast). Three things about the
// reader side shape this whole screen:
//
//   * The app trusts `status`, never the clock. A game is on the air because a
//     person pressed "Go live" here; nothing goes live by itself at kickoff.
//   * The app POLLS EVERY TWO MINUTES. A score saved here is on a phone within
//     about two minutes, not instantly, which is why the panel says so — an
//     editor tapping +7 and staring at a phone for three seconds would
//     otherwise assume it failed and tap it again.
//   * Only `published` rows are visible at all. There is no draft state
//     beyond that flag.

const APP_POLL_NOTE = "Readers see changes within about two minutes — the app polls every two minutes while the Live tab is open.";

interface BroadcastRow {
	id: number;
	sport: string;
	level: string;
	opponent: string;
	home: boolean;
	venue: string;
	starts_at: string;
	status: string;
	youtube_id: string | null;
	score_phs: number | null;
	score_opponent: number | null;
	show_score: boolean;
	note: string;
	published: boolean;
}

const COLUMNS = "id, sport, level, opponent, home, venue, starts_at, status, youtube_id, score_phs, score_opponent, show_score, note, published";

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
	live: { label: "● Live", tone: "red" },
	scheduled: { label: "Scheduled", tone: "" },
	ended: { label: "Ended", tone: "gray" },
	canceled: { label: "Canceled", tone: "gray" },
};

function StatusBadge({ status }: { status: string }) {
	// An unknown status is the app's "read it as scheduled" case; show the raw
	// word rather than pretending it is something we recognise.
	const badge = STATUS_BADGE[status] ?? { label: status, tone: "gray" };
	return <span className={`ta-badge ${badge.tone}`}>{badge.label}</span>;
}

function scoreText(row: BroadcastRow): string {
	// With the scoreboard off a reader sees the matchup line and no numbers,
	// so the console must not print one either, or the two disagree about what
	// is on screen. The stored values are kept, and stay visible in the panel.
	if (!row.show_score) return "Not shown";
	if (row.score_phs === null || row.score_opponent === null) return "—";
	return `${row.score_phs} – ${row.score_opponent}`;
}

// ─── The page ───────────────────────────────────────────────────────────────

function LiveConsole() {
	const { supabase, role } = useAdmin();
	const [rows, setRows] = useState<BroadcastRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [openId, setOpenId] = useState<number | null>(null);
	const [draft, setDraft] = useState<Draft>(blankDraft);
	const announceRef = useRef<HTMLDivElement | null>(null);

	const load = useCallback(async () => {
		const { data, error: err } = await supabase.from("broadcast").select(COLUMNS).order("starts_at", { ascending: false });
		if (err) {
			setError(err.message);
			return;
		}
		setError(null);
		setRows((data ?? []) as BroadcastRow[]);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	/** Update the local row first, then the database. Deliberately does NOT
	 *  revert on failure: mid-game, the number the editor typed is the one that
	 *  should stay on screen, with a retry next to it. */
	const commit = useCallback(
		async (id: number, patch: Partial<BroadcastRow>): Promise<string | null> => {
			setRows(prev => (prev ? prev.map(r => (r.id === id ? { ...r, ...patch } : r)) : prev));
			const { error: err } = await supabase.from("broadcast").update(patch).eq("id", id);
			return err ? err.message : null;
		},
		[supabase]
	);

	const remove = useCallback(
		async (id: number) => {
			const { error: err } = await supabase.from("broadcast").delete().eq("id", id);
			if (err) {
				setError(err.message);
				return;
			}
			setOpenId(prev => (prev === id ? null : prev));
			await load();
		},
		[supabase, load]
	);

	const duplicate = useCallback((row: BroadcastRow) => {
		// Same fixture, a week on: a season is mostly the same twenty rows.
		setDraft({
			sport: row.sport,
			level: row.level,
			opponent: row.opponent,
			home: row.home,
			venue: row.venue,
			kickoff: isoToForm(shiftIso(row.starts_at, 7 * 24 * 60)),
			note: "",
			video: "",
			published: false,
			// Carry the scoreboard choice over: a rematch is scored the same way.
			showScore: row.show_score,
		});
		announceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	}, []);

	const groups = useMemo(() => {
		const now = Date.now();
		const live: BroadcastRow[] = [];
		const upcoming: BroadcastRow[] = [];
		const recent: BroadcastRow[] = [];
		const older: BroadcastRow[] = [];
		for (const row of rows ?? []) {
			const group = boardGroup(row, now);
			if (group === "live") live.push(row);
			else if (group === "upcoming") upcoming.push(row);
			else if (group === "recent") recent.push(row);
			else older.push(row);
		}
		// Upcoming reads forwards (the next game first); everything finished
		// reads backwards (the most recent first).
		upcoming.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
		return { live, upcoming, recent, older };
	}, [rows]);

	const openRow = rows?.find(r => r.id === openId) ?? null;

	return (
		<div className="ta-stack">
			{error && <p className="ta-error">{error}</p>}

			{/* The first question on opening this page is "is anything on air
			    right now". It is answered before anything else on the screen. */}
			<OnAir rows={groups.live} openId={openId} onOpen={setOpenId} loading={rows === null} />

			{openRow && (
				<RunOfGame
					key={openRow.id}
					row={openRow}
					commit={commit}
					onClose={() => setOpenId(null)}
					onDelete={remove}
					canDelete={role === "admin"}
				/>
			)}

			<div className="ta-toolbar" style={{ marginBottom: 0 }}>
				<button className="ta-btn ta-btn-small" onClick={() => void load()}>
					Refresh board
				</button>
				<span className="ta-muted ta-small">All times Eastern. {APP_POLL_NOTE}</span>
			</div>

			<Board title="Upcoming" rows={groups.upcoming} openId={openId} onOpen={setOpenId} onDuplicate={duplicate} loading={rows === null} />
			<Board
				title="Recent (last 21 days)"
				rows={groups.recent}
				openId={openId}
				onOpen={setOpenId}
				onDuplicate={duplicate}
				loading={rows === null}
			/>
			{groups.older.length > 0 && (
				<details className="ta-card">
					<summary>Older games ({groups.older.length})</summary>
					<div style={{ marginTop: "0.75rem" }}>
						<Board title="" rows={groups.older} openId={openId} onOpen={setOpenId} onDuplicate={duplicate} loading={false} />
					</div>
				</details>
			)}

			<div ref={announceRef}>
				<Announce draft={draft} setDraft={setDraft} supabase={supabase} onCreated={load} />
			</div>
		</div>
	);
}

// ─── Part 1: the game board ─────────────────────────────────────────────────

function OnAir({ rows, openId, onOpen, loading }: { rows: BroadcastRow[]; openId: number | null; onOpen: (id: number) => void; loading: boolean }) {
	if (loading) {
		return (
			<div className="ta-card">
				<p className="ta-muted" style={{ margin: 0 }}>
					Loading the board…
				</p>
			</div>
		);
	}
	if (rows.length === 0) {
		return (
			<div className="ta-card ta-live-onair quiet">
				<h2>Nothing is on the air</h2>
				<p className="ta-muted ta-small" style={{ margin: 0 }}>
					A game goes live when someone presses <b>Go live</b> below — never on its own at kickoff. Open an upcoming game to start one.
				</p>
			</div>
		);
	}
	return (
		<div className="ta-card ta-live-onair">
			<h2>
				On the air <span className="ta-badge red">● Live</span>
			</h2>
			<div className="ta-stack">
				{rows.map(row => (
					<div key={row.id} className="ta-live-onair-row">
						<div>
							<div className="ta-live-matchup">{matchupLabel(row)}</div>
							<div className="ta-muted ta-small">
								{row.level} {row.sport} · started {formatEasternStamp(row.starts_at)}
								{row.published ? "" : " · NOT PUBLISHED (no reader can see it)"}
							</div>
						</div>
						<div className="ta-live-onair-score">{scoreText(row)}</div>
						<button className="ta-btn ta-btn-primary" onClick={() => onOpen(row.id)}>
							{openId === row.id ? "Open below" : "Run this game"}
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

function Board({
	title,
	rows,
	openId,
	onOpen,
	onDuplicate,
	loading,
}: {
	title: string;
	rows: BroadcastRow[];
	openId: number | null;
	onOpen: (id: number) => void;
	onDuplicate: (row: BroadcastRow) => void;
	loading: boolean;
}) {
	return (
		<section className="ta-stack">
			{title && <h2 className="ta-live-group">{title}</h2>}
			{loading ? (
				<p className="ta-muted">Loading…</p>
			) : rows.length === 0 ? (
				<p className="ta-muted ta-small">Nothing here.</p>
			) : (
				<div className="ta-table-wrap">
					<table className="ta-table">
						<thead>
							<tr>
								<th style={{ width: 190 }}>Kickoff (ET)</th>
								<th>Matchup</th>
								<th style={{ width: 170 }}>Fixture</th>
								<th style={{ width: 120 }}>Status</th>
								<th style={{ width: 110 }}>Reader</th>
								<th style={{ width: 90 }}>Score</th>
								<th style={{ width: 190 }} />
							</tr>
						</thead>
						<tbody>
							{rows.map(row => (
								<tr key={row.id} style={row.status === "canceled" ? { opacity: 0.6 } : undefined}>
									<td>
										<div>{formatEasternDate(row.starts_at)}</div>
										<div className="ta-muted ta-small">{formatEasternClock(row.starts_at)} ET</div>
									</td>
									<td>
										<div className={row.status === "canceled" ? "ta-live-struck" : undefined}>{matchupLabel(row)}</div>
										{row.note && <div className="ta-muted ta-small">{row.note}</div>}
									</td>
									<td>
										{row.level} {row.sport}
										{row.venue ? <div className="ta-muted ta-small">{row.venue}</div> : null}
									</td>
									<td>
										<StatusBadge status={row.status} />
										{row.youtube_id ? <div className="ta-muted ta-small">video attached</div> : null}
									</td>
									<td>
										<span className={`ta-badge ${row.published ? "green" : "gray"}`}>
											{row.published ? "Published" : "Hidden"}
										</span>
									</td>
									<td>{scoreText(row)}</td>
									<td>
										<button className="ta-btn ta-btn-small ta-btn-primary" onClick={() => onOpen(row.id)}>
											{openId === row.id ? "Open" : "Open"}
										</button>{" "}
										<button className="ta-btn ta-btn-small" onClick={() => onDuplicate(row)}>
											Duplicate
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

// ─── Part 2: the run-of-game panel ──────────────────────────────────────────

type Commit = (id: number, patch: Partial<BroadcastRow>) => Promise<string | null>;

function RunOfGame({
	row,
	commit,
	onClose,
	onDelete,
	canDelete,
}: {
	row: BroadcastRow;
	commit: Commit;
	onClose: () => void;
	onDelete: (id: number) => void;
	canDelete: boolean;
}) {
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [failure, setFailure] = useState<{ message: string; patch: Partial<BroadcastRow> } | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [acting, setActing] = useState(false);
	const seq = useRef(0);

	/** Every write on this panel goes through here: optimistic, immediate, and
	 *  never reverted behind the editor's back. */
	const run = useCallback(
		async (patch: Partial<BroadcastRow>, note?: string) => {
			const mine = ++seq.current;
			setNotice(note ?? null);
			const message = await commit(row.id, patch);
			// A newer tap owns the status line; a stale reply must not clear it.
			if (seq.current !== mine) return message;
			if (message) setFailure({ message, patch });
			else {
				setFailure(null);
				setSavedAt(Date.now());
			}
			return message;
		},
		[commit, row.id]
	);

	const act = useCallback(
		async (patch: Partial<BroadcastRow>, note?: string) => {
			setActing(true);
			const message = await run(patch, note);
			setActing(false);
			return message;
		},
		[run]
	);

	return (
		<div className="ta-card ta-live-panel">
			<div className="ta-spread">
				<div>
					<h2 style={{ margin: 0 }}>{matchupLabel(row)}</h2>
					<p className="ta-muted ta-small" style={{ margin: "0.15rem 0 0" }}>
						{row.level} {row.sport}
						{row.venue ? ` · ${row.venue}` : ""} · <StatusBadge status={row.status} />{" "}
						<span className={`ta-badge ${row.published ? "green" : "gray"}`}>{row.published ? "Published" : "Hidden"}</span>
					</p>
				</div>
				<button className="ta-btn" onClick={onClose}>
					Close
				</button>
			</div>

			<SaveStatus savedAt={savedAt} failure={failure} onRetry={() => void run(failure!.patch)} notice={notice} />

			<ScorePanel row={row} run={run} setNotice={setNotice} />
			<StreamPanel row={row} act={act} acting={acting} />
			<TimePanel row={row} act={act} acting={acting} />
			<EndPanel row={row} act={act} acting={acting} onDelete={onDelete} canDelete={canDelete} />

			<div className="ta-live-section">
				<h3>Note shown to readers</h3>
				<input
					type="text"
					defaultValue={row.note}
					placeholder="Senior night · Delayed to 7:15, lightning"
					key={`note-${row.note}`}
					onBlur={e => e.target.value !== row.note && void act({ note: e.target.value })}
				/>
				<p className="ta-muted ta-small">The only free text the app can carry for this game. Saved when you click away from the box.</p>
			</div>

			<div className="ta-live-section">
				<h3>Visibility</h3>
				<div className="ta-row">
					<button className="ta-btn" disabled={acting} onClick={() => void act({ published: !row.published })}>
						{row.published ? "Unpublish (hide from readers)" : "Publish (show to readers)"}
					</button>
				</div>
				<p className="ta-muted ta-small">
					{row.published
						? "Readers can see this game. Unpublishing removes it from the Live tab entirely — cancel it instead if it was announced and then called off."
						: "No reader can see this game, live or not, until it is published."}
				</p>
			</div>
		</div>
	);
}

function SaveStatus({
	savedAt,
	failure,
	onRetry,
	notice,
}: {
	savedAt: number | null;
	failure: { message: string; patch: Partial<BroadcastRow> } | null;
	onRetry: () => void;
	notice: string | null;
}) {
	return (
		<div className="ta-live-savebar">
			{failure ? (
				<>
					<span className="ta-error" style={{ margin: 0 }}>
						Not saved: {failure.message} — the number on screen is still yours, the database has not got it yet.
					</span>
					<button className="ta-btn ta-btn-small ta-btn-danger" onClick={onRetry}>
						Retry
					</button>
				</>
			) : savedAt ? (
				<span className="ta-ok" style={{ margin: 0 }}>
					Saved {formatEasternClock(savedAt, true)} ET. {APP_POLL_NOTE}
				</span>
			) : (
				<span className="ta-muted ta-small">Every control here saves the moment you press it. {APP_POLL_NOTE}</span>
			)}
			{notice && !failure && <span className="ta-muted ta-small">{notice}</span>}
		</div>
	);
}

function ScorePanel({
	row,
	run,
	setNotice,
}: {
	row: BroadcastRow;
	run: (p: Partial<BroadcastRow>, note?: string) => Promise<string | null>;
	setNotice: (n: string | null) => void;
}) {
	const scoring = sportScoring(row.sport);
	const unit = scoreUnitLabel(row.sport);
	const hasScore = row.score_phs !== null || row.score_opponent !== null;
	const off = !row.show_score;

	const write = (phs: number | null, opponent: number | null, note?: string) => {
		const next = normalizeScorePair({ phs, opponent });
		void run({ score_phs: next.phs, score_opponent: next.opponent }, note);
	};

	const bump = (side: "phs" | "opponent", delta: number) => {
		const current = { phs: row.score_phs ?? 0, opponent: row.score_opponent ?? 0 };
		const value = Math.max(0, current[side] + delta);
		const next = { ...current, [side]: value };
		// The app shows nothing unless BOTH halves are set, so the first tap on
		// an unscored game sets the other side to 0. Say so; do not do it
		// silently and let the editor wonder where the 0 came from.
		const note = !hasScore
			? "Started the score — the other side was set to 0, because the app shows no score unless both halves are set."
			: undefined;
		write(next.phs, next.opponent, note);
	};

	const typed = (side: "phs" | "opponent", value: number | null) => {
		const next = side === "phs" ? { phs: value, opponent: row.score_opponent } : { phs: row.score_phs, opponent: value };
		const note = scorePairNeedsFill(next)
			? "The other side was set to 0, because the app shows no score unless both halves are set. Use “clear score” to remove it entirely."
			: undefined;
		write(next.phs, next.opponent, note);
	};

	return (
		<div className="ta-live-section ta-live-score-section">
			<h3>Score{unit ? ` · ${unit}` : ""}</h3>

			<label className="ta-live-inline-check">
				<input
					type="checkbox"
					checked={row.show_score}
					onChange={e => {
						// An independent write: the score columns are never touched here.
						// Empty score columns already mean "nobody has typed anything yet",
						// which is a different thing from "there is no score to keep", and
						// an editor has to be able to take a number down without losing it.
						setNotice(null);
						void run(
							{ show_score: e.target.checked },
							e.target.checked
								? undefined
								: "Scoreboard hidden. The score below is kept, not deleted. Turn this back on to show it again."
						);
					}}
				/>{" "}
				Show scoreboard
			</label>
			<p className="ta-muted ta-small">
				Off shows the video and the fixture only. Any score already entered is kept and hidden, not deleted.
			</p>

			{/* Cross country is the sum of the top five finishers' places and golf
			    is strokes: 23 beats 36. The app prints the two numbers with nothing
			    saying which way round it is, so a reader takes the smaller one for
			    a loss. Warn — do not block; an editor may still want them up. */}
			{scoring.lowWins && (
				<p className="ta-live-warn">
					<b>Low score wins in {row.sport.trim().toLowerCase()}.</b> The app prints these two numbers with nothing saying that, so{" "}
					<b>PHS 23 – 36</b> reads to a reader as a loss. Consider leaving the score blank and putting the result in the note instead.
				</p>
			)}
			{scoring.judged && (
				<p className="ta-live-warn">
					<b>This is judged, not head-to-head.</b> Scores are out of 100 with a decimal, and this column holds whole numbers only — 94.5
					cannot be stored. Put the score in the note.
				</p>
			)}

			<div className={`ta-live-scoreboard${off ? " ta-live-dimmed" : ""}`}>
				{[
					{ side: "phs" as const, label: "PHS", value: row.score_phs },
					{ side: "opponent" as const, label: row.opponent || "Opponent", value: row.score_opponent },
				].map(team => (
					<div key={team.side} className="ta-live-side">
						<div className="ta-live-side-name">{team.label}</div>
						<ScoreNumber value={team.value} disabled={off} onCommit={next => typed(team.side, next)} />
						{unit && <div className="ta-live-side-unit">{unit}</div>}
						<div className="ta-live-steps">
							<button className="ta-btn ta-live-step" disabled={off} onClick={() => bump(team.side, -1)}>
								−1
							</button>
							<button className="ta-btn ta-live-step" disabled={off} onClick={() => bump(team.side, 1)}>
								+1
							</button>
							{scoring.steps.map(step => (
								<button key={step} className="ta-btn ta-btn-primary ta-live-step" disabled={off} onClick={() => bump(team.side, step)}>
									+{step}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
			<div className="ta-row">
				<button
					className="ta-btn ta-btn-small"
					disabled={!hasScore || off}
					onClick={() => {
						setNotice(null);
						write(null, null, "Score cleared — the app will show this game with no score at all.");
					}}
				>
					Clear score
				</button>
				<span className="ta-muted ta-small">
					No save button on purpose: every tap is written the moment you press it. To fix a number outright, type over it and press Enter
					(or click away).
				</span>
			</div>
		</div>
	);
}

/**
 * The big number. Buttons write on the tap; typing does NOT, because a
 * keystroke-by-keystroke write turns "21" into a write of 2 and then 21 and
 * leaves a half-typed number in the database if the editor looks up at the
 * field mid-correction. Typed edits land on Enter or on leaving the box.
 */
function ScoreNumber({
	value,
	onCommit,
	disabled,
}: {
	value: number | null;
	onCommit: (next: number | null) => void;
	disabled?: boolean;
}) {
	const [text, setText] = useState(value === null ? "" : String(value));

	// A tap on +7 changes `value` under us; the box has to follow it.
	useEffect(() => {
		setText(value === null ? "" : String(value));
	}, [value]);

	const commit = () => {
		const trimmed = text.trim();
		if (trimmed === "") {
			onCommit(null);
			return;
		}
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed)) {
			setText(value === null ? "" : String(value));
			return;
		}
		if (parsed !== value) onCommit(parsed);
	};

	return (
		<input
			className="ta-live-num"
			type="number"
			min={0}
			inputMode="numeric"
			value={text}
			disabled={disabled}
			placeholder="–"
			onChange={e => setText(e.target.value)}
			onBlur={commit}
			onKeyDown={e => {
				if (e.key === "Enter") e.currentTarget.blur();
			}}
		/>
	);
}

function StreamPanel({
	row,
	act,
	acting,
}: {
	row: BroadcastRow;
	act: (p: Partial<BroadcastRow>, note?: string) => Promise<string | null>;
	acting: boolean;
}) {
	const [input, setInput] = useState(row.youtube_id ?? "");
	const [touched, setTouched] = useState(false);

	useEffect(() => {
		setInput(row.youtube_id ?? "");
		setTouched(false);
	}, [row.id, row.youtube_id]);

	const parsed = parseYouTubeId(input);
	const dirty = parsed !== row.youtube_id;

	return (
		<div className="ta-live-section">
			<h3>Stream</h3>
			<label>
				YouTube link or video id
				<input
					type="text"
					value={input}
					placeholder="https://www.youtube.com/watch?v=mKCieTImjvU"
					onChange={e => {
						setInput(e.target.value);
						setTouched(true);
					}}
				/>
			</label>
			{parsed ? (
				<div className="ta-live-video">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={youtubeThumbnail(parsed)} alt="" className="ta-live-thumb" />
					<div>
						<div>
							Video id <code className="ta-code">{parsed}</code>
						</div>
						<p className="ta-muted ta-small" style={{ margin: "0.25rem 0 0" }}>
							Pulled out of what you pasted. Only the id is stored — the app builds the player URL itself.
						</p>
					</div>
				</div>
			) : (
				touched &&
				input.trim() !== "" && (
					<p className="ta-error">
						That is not a YouTube link or video id. Paste the whole watch URL (or a youtu.be, /live/ or /embed/ link) and the id will be
						pulled out of it.
					</p>
				)
			)}

			<div className="ta-row">
				{row.status === "live" ? (
					<button className="ta-btn ta-btn-primary" disabled={acting || !parsed || !dirty} onClick={() => void act({ youtube_id: parsed })}>
						Swap the video
					</button>
				) : (
					<button
						className="ta-btn ta-btn-primary ta-btn-big"
						disabled={acting || !parsed}
						onClick={() => void act({ status: "live" as BroadcastStatus, youtube_id: parsed, published: true }, "On the air.")}
					>
						Go live
					</button>
				)}
				{row.status !== "live" && parsed && dirty && (
					<button className="ta-btn" disabled={acting} onClick={() => void act({ youtube_id: parsed })}>
						Save the video without going live
					</button>
				)}
			</div>
			{!parsed && row.status !== "live" && (
				<p className="ta-muted ta-small">
					<b>Go live needs a video.</b> The app renders a live card with no player as &ldquo;stream starts at kickoff&rdquo;, which is worse
					than a game it never announced.
				</p>
			)}
			{row.status !== "live" && parsed && (
				<p className="ta-muted ta-small">Going live also publishes the game, because a live game nobody can see is not live.</p>
			)}
		</div>
	);
}

function TimePanel({
	row,
	act,
	acting,
}: {
	row: BroadcastRow;
	act: (p: Partial<BroadcastRow>, note?: string) => Promise<string | null>;
	acting: boolean;
}) {
	const original = useRef(row.starts_at);
	const [form, setForm] = useState(isoToForm(row.starts_at));
	const [invalid, setInvalid] = useState(false);
	const [notePrompt, setNotePrompt] = useState<string | null>(null);
	const [noteDraft, setNoteDraft] = useState("");

	useEffect(() => {
		original.current = row.starts_at;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [row.id]);

	useEffect(() => {
		setForm(isoToForm(row.starts_at));
		setInvalid(false);
	}, [row.starts_at]);

	const moveTo = async (iso: string) => {
		const message = await act({ starts_at: iso });
		if (message) return;
		// A published schedule that changes with no word is how a reader ends
		// up standing in a car park. The note clause is the only place the app
		// can carry an explanation.
		if (row.published) {
			setNoteDraft(row.note ? row.note : `Delayed to ${formatEasternClock(iso)}`);
			setNotePrompt(`Kickoff moved to ${formatEasternStamp(iso)}.`);
		}
	};

	const delay = (minutes: number) => void moveTo(shiftIso(row.starts_at, minutes));

	const saveTyped = () => {
		const iso = formToIso(form);
		if (!iso) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		void moveTo(iso);
	};

	const changed = Date.parse(row.starts_at) !== Date.parse(original.current);
	const typedIso = formToIso(form);

	return (
		<div className="ta-live-section">
			<h3>Kickoff</h3>
			<p className="ta-live-kickoff-now">
				{formatEasternStamp(row.starts_at)}
				{row.status === "live" ? " · already on the air" : ""}
			</p>
			<div className="ta-row">
				{[
					{ label: "+15 min", minutes: 15 },
					{ label: "+30 min", minutes: 30 },
					{ label: "+1 hour", minutes: 60 },
				].map(option => (
					<button key={option.minutes} className="ta-btn ta-live-step" disabled={acting} onClick={() => delay(option.minutes)}>
						{option.label}
					</button>
				))}
				{changed && (
					<button className="ta-btn ta-btn-small" disabled={acting} onClick={() => void moveTo(original.current)}>
						Reset to {formatEasternClock(original.current)} ET
					</button>
				)}
			</div>
			<label>
				Or set it exactly (Eastern — this is what the reader sees, whatever your laptop&rsquo;s clock is set to)
				<input type="datetime-local" value={form} onChange={e => setForm(e.target.value)} />
			</label>
			<div className="ta-row">
				<button className="ta-btn" disabled={acting || !typedIso || typedIso === row.starts_at} onClick={saveTyped}>
					Move kickoff
				</button>
				<span className="ta-muted ta-small">
					{typedIso ? `Saves as ${formatEasternStamp(typedIso)}.` : "Pick a date and time."} Moving a game to another day is the same
					control — there is no separate reschedule.
				</span>
			</div>
			{invalid && <p className="ta-error">That is not a complete date and time.</p>}

			{notePrompt && (
				<div className="ta-live-noteprompt">
					<b>{notePrompt}</b>
					<p className="ta-muted ta-small" style={{ margin: "0.25rem 0" }}>
						This game is published, so readers already have the old time. The note is the only place the app can tell them why.
					</p>
					<input type="text" value={noteDraft} placeholder="Delayed to 7:15 · lightning" onChange={e => setNoteDraft(e.target.value)} />
					<div className="ta-row">
						<button
							className="ta-btn ta-btn-primary"
							disabled={acting}
							onClick={async () => {
								await act({ note: noteDraft });
								setNotePrompt(null);
							}}
						>
							Save note
						</button>
						<button className="ta-btn" onClick={() => setNotePrompt(null)}>
							No note needed
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function EndPanel({
	row,
	act,
	acting,
	onDelete,
	canDelete,
}: {
	row: BroadcastRow;
	act: (p: Partial<BroadcastRow>, note?: string) => Promise<string | null>;
	acting: boolean;
	onDelete: (id: number) => void;
	canDelete: boolean;
}) {
	return (
		<div className="ta-live-section">
			<h3>Ending the game</h3>
			<div className="ta-row">
				{row.status !== "ended" && (
					<button
						className="ta-btn ta-btn-big"
						disabled={acting}
						onClick={() => void act({ status: "ended" as BroadcastStatus }, "Ended. It is a replay in the app now.")}
					>
						End broadcast
					</button>
				)}
				{row.status !== "canceled" && (
					<button className="ta-btn" disabled={acting} onClick={() => void act({ status: "canceled" as BroadcastStatus })}>
						Cancel game
					</button>
				)}
				{row.status !== "scheduled" && (
					<button className="ta-btn ta-btn-small" disabled={acting} onClick={() => void act({ status: "scheduled" as BroadcastStatus })}>
						Put back to scheduled
					</button>
				)}
				{row.youtube_id && (
					<button
						className="ta-btn ta-btn-small"
						disabled={acting}
						onClick={() => void act({ youtube_id: null }, "Video removed. The game stays as a result with no replay.")}
					>
						Remove video
					</button>
				)}
			</div>
			<p className="ta-muted ta-small">
				<b>Ending is not deleting the video.</b> End broadcast keeps the video attached, and that is exactly what turns this row into a replay
				in the app. Remove video is the separate case where the stream came down: the row stays as a result with no video.
			</p>
			<p className="ta-muted ta-small">
				<b>Cancelling is not deleting the game.</b> A canceled game stays on the reader&rsquo;s schedule, struck through and tagged — deleting
				it would leave somebody who saw it announced with no idea what happened.
			</p>
			{canDelete ? (
				<div className="ta-row">
					<button
						className="ta-btn ta-btn-danger"
						disabled={acting}
						onClick={() => {
							if (
								window.confirm(
									`Delete "${matchupLabel(row)}" outright? Cancelling is what you want unless this row was entered by mistake.`
								)
							)
								onDelete(row.id);
						}}
					>
						Delete this row
					</button>
					<span className="ta-muted ta-small">For a row entered by mistake, nothing else.</span>
				</div>
			) : (
				<p className="ta-muted ta-small">
					Deleting a row outright is an admin action. Cancel the game instead — that is the right tool anyway.
				</p>
			)}
		</div>
	);
}

// ─── Part 3: announcing a game ──────────────────────────────────────────────

interface Draft {
	sport: string;
	level: string;
	opponent: string;
	home: boolean;
	venue: string;
	kickoff: string;
	note: string;
	video: string;
	published: boolean;
	showScore: boolean;
}

function blankDraft(): Draft {
	// Default to this evening: the common case is announcing a week out, but a
	// date already in the box is one less thing to type at a field.
	return {
		sport: "Football",
		level: "Boys Varsity",
		opponent: "",
		home: true,
		venue: "",
		kickoff: `${isoToForm(Date.now()).slice(0, 10)}T18:30`,
		note: "",
		video: "",
		published: true,
		// Matches the column default, so a new game behaves like every existing one.
		showScore: true,
	};
}

/**
 * A dropdown of the teams PHS actually fields, with an escape hatch.
 *
 * The list is the point: the quick-score buttons key off the `sport` string,
 * so a typo silently costs an editor their +7. But `sport` is free text in the
 * database and a scrimmage against something not on the list has to be
 * announceable, so "Something else…" reveals a plain box rather than a dead
 * end. A value that is not on the list — a duplicated old row, say — opens in
 * that box on its own instead of being quietly rewritten to the first option.
 */
const OTHER = " other";

function PickOne({
	label,
	value,
	options,
	placeholder,
	onChange,
}: {
	label: string;
	value: string;
	options: string[];
	placeholder: string;
	onChange: (next: string) => void;
}) {
	const [wantsOther, setWantsOther] = useState(false);
	const known = options.includes(value);
	const typing = wantsOther || (value !== "" && !known);

	return (
		<label>
			{label}
			<select
				value={typing ? OTHER : value}
				onChange={e => {
					if (e.target.value === OTHER) {
						setWantsOther(true);
						onChange("");
					} else {
						setWantsOther(false);
						onChange(e.target.value);
					}
				}}
			>
				{options.map(option => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
				<option value={OTHER}>Something else…</option>
			</select>
			{typing && (
				<input
					type="text"
					value={value}
					placeholder={placeholder}
					autoFocus={wantsOther}
					style={{ marginTop: "0.35rem" }}
					onChange={e => onChange(e.target.value)}
				/>
			)}
		</label>
	);
}

function Announce({
	draft,
	setDraft,
	supabase,
	onCreated,
}: {
	draft: Draft;
	setDraft: (d: Draft) => void;
	supabase: ReturnType<typeof useAdmin>["supabase"];
	onCreated: () => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	const iso = formToIso(draft.kickoff);
	const video = draft.video.trim() ? parseYouTubeId(draft.video) : null;
	const videoBad = draft.video.trim() !== "" && video === null;

	const preview = iso
		? previewLine({ sport: draft.sport, level: draft.level, opponent: draft.opponent || "Opponent", home: draft.home, starts_at: iso })
		: "Pick a kickoff time to see the reader's version.";

	const submit = async () => {
		setError(null);
		setOk(null);
		if (!draft.sport.trim() || !draft.opponent.trim()) {
			setError("A sport and an opponent are the two things the app cannot print without.");
			return;
		}
		if (!iso) {
			setError("That kickoff is not a complete date and time.");
			return;
		}
		if (videoBad) {
			setError("That is not a YouTube link or video id. Leave it blank if there is no stream yet — that is the usual case.");
			return;
		}
		setBusy(true);
		const { error: err } = await supabase.from("broadcast").insert({
			sport: draft.sport.trim(),
			level: draft.level.trim() || "Varsity",
			opponent: draft.opponent.trim(),
			home: draft.home,
			venue: draft.venue.trim(),
			starts_at: iso,
			status: "scheduled",
			youtube_id: video,
			note: draft.note.trim(),
			published: draft.published,
			show_score: draft.showScore,
		});
		setBusy(false);
		if (err) {
			setError(err.message);
			return;
		}
		setOk(`Announced: ${preview}`);
		setDraft({ ...blankDraft(), sport: draft.sport, level: draft.level, kickoff: draft.kickoff });
		await onCreated();
	};

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

	return (
		<div className="ta-card">
			<h2>Announce a game</h2>
			<p className="ta-muted ta-small">
				A stream link is optional — the usual case is announcing a week out with no video yet. Attach it later and press <b>Go live</b>.
			</p>
			<div className="ta-live-form">
				<PickOne
					label="Sport"
					value={draft.sport}
					options={PHS_SPORTS}
					placeholder="Ultimate, a scrimmage, something new"
					onChange={next => set("sport", next)}
				/>
				<PickOne label="Level" value={draft.level} options={PHS_LEVELS} placeholder="Boys Varsity" onChange={next => set("level", next)} />
				<label>
					Opponent
					<input type="text" value={draft.opponent} placeholder="Hopewell Valley" onChange={e => set("opponent", e.target.value)} />
				</label>
				<label>
					Home or away
					<select value={draft.home ? "home" : "away"} onChange={e => set("home", e.target.value === "home")}>
						<option value="home">Home (PHS vs. …)</option>
						<option value="away">Away (PHS at …)</option>
					</select>
				</label>
				<label>
					Venue
					<input type="text" value={draft.venue} placeholder="Princeton Stadium" onChange={e => set("venue", e.target.value)} />
				</label>
				<label>
					Kickoff (Eastern)
					<input type="datetime-local" value={draft.kickoff} onChange={e => set("kickoff", e.target.value)} />
				</label>
				<label>
					Note (optional)
					<input type="text" value={draft.note} placeholder="Senior night" onChange={e => set("note", e.target.value)} />
				</label>
				<label>
					Stream link or id (optional)
					<input
						type="text"
						value={draft.video}
						placeholder="https://www.youtube.com/watch?v=…"
						onChange={e => set("video", e.target.value)}
					/>
				</label>
			</div>

			<div className="ta-live-preview">
				<div className="ta-muted ta-small">How the app will print it</div>
				<div className="ta-live-matchup">{preview}</div>
				{iso && <div className="ta-muted ta-small">Stored as {iso}</div>}
				{video && (
					<div className="ta-muted ta-small">
						Video id <code className="ta-code">{video}</code>
					</div>
				)}
				{videoBad && <p className="ta-error">That is not a YouTube link or video id.</p>}
				{!draft.showScore && <div className="ta-muted ta-small">No scoreboard: readers see the video and this line only.</div>}
			</div>

			<div className="ta-row">
				<label className="ta-live-inline-check">
					<input type="checkbox" checked={draft.published} onChange={e => set("published", e.target.checked)} /> Publish it now
				</label>
				<label className="ta-live-inline-check">
					<input type="checkbox" checked={draft.showScore} onChange={e => set("showScore", e.target.checked)} /> Show scoreboard
				</label>
				<button className="ta-btn ta-btn-primary" disabled={busy} onClick={() => void submit()}>
					{busy ? "Announcing…" : "Announce game"}
				</button>
				<button className="ta-btn" disabled={busy} onClick={() => setDraft(blankDraft())}>
					Clear
				</button>
			</div>
			{error && <p className="ta-error">{error}</p>}
			{ok && <p className="ta-ok">{ok}</p>}
		</div>
	);
}

export default function LivePage() {
	return (
		<AdminShell title="Live broadcasts" wide>
			<LiveConsole />
		</AdminShell>
	);
}
