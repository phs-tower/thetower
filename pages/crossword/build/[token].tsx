/** @format */

// The shareable crossword room: /crossword/build/<token>
//
// Anyone holding the link edits the same draft, with no sign-in. The link IS
// the credential, so this page never asks who you are and never needs to; the
// database refuses every request that does not carry the token (see
// supabase/migrations/20261116000001_crossword_room.sql).
//
// Keeping two browsers in step is split in two:
//   * a realtime channel carries each edit to the other people in the room,
//     for the feel of typing together
//   * a debounced save writes the whole draft to the row, so a reload, a late
//     arrival or a dropped message all recover
// Both go through the same last-write-wins merge in lib/console/crossword-room,
// so neither is trusted to arrive, or to arrive in order.

import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ClueDialog, GridEditor, type PeerCursor } from "~/components/admin/CrosswordParts";
import { consoleSupabase } from "~/lib/console/supabase";
import {
	BLACK,
	buildCluesJson,
	clueKey,
	computeEntries,
	isBlack,
	MAX_SIZE,
	MIN_SIZE,
	orphanCells,
	type Dir,
} from "~/lib/console/crossword-grid";
import {
	cellKey,
	clampSize,
	clearGrid,
	cluesFromDoc,
	emptyDoc,
	gridFromDoc,
	mergeDoc,
	metaFromDoc,
	newAuthorId,
	parseDoc,
	parsePatch,
	peerColor,
	setCell,
	setCells,
	setClue,
	setMeta,
	setSize,
	type Edit,
	type MetaField,
	type RoomDoc,
	type RoomPatch,
} from "~/lib/console/crossword-room";

type Step = "size" | "blocks" | "letters";
type Phase = "loading" | "open" | "closed" | "missing" | "error";

const SAVE_DEBOUNCE_MS = 1200;
const CURSOR_THROTTLE_MS = 200;
const NAME_KEY = "tower:crossword-room-name";

interface OpenRow {
	id: string;
	doc: unknown;
	rev: number;
	label: string | null;
	closed: boolean;
	crossword_id: number | null;
}

interface SaveRow {
	status: "saved" | "conflict" | "missing" | "closed" | "too_large";
	doc: unknown;
	rev: number;
}

export default function CrosswordRoomPage() {
	const router = useRouter();
	const token = typeof router.query.token === "string" ? router.query.token : null;
	const supabase = useMemo(() => consoleSupabase(), []);
	const authorId = useMemo(() => newAuthorId(), []);

	const [phase, setPhase] = useState<Phase>("loading");
	const [fatal, setFatal] = useState<string | null>(null);
	const [roomId, setRoomId] = useState<string | null>(null);
	const [label, setLabel] = useState<string | null>(null);
	const [crosswordId, setCrosswordId] = useState<number | null>(null);

	const [doc, setDoc] = useState<RoomDoc>(() => emptyDoc(authorId, Date.now()));
	const docRef = useRef(doc);
	const revRef = useRef(0);

	const [name, setName] = useState("Guest");
	const [peers, setPeers] = useState<PeerCursor[]>([]);
	const [live, setLive] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [dirty, setDirty] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const [step, setStep] = useState<Step>("letters");
	const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);
	const [dir, setDir] = useState<Dir>("across");
	const [showClues, setShowClues] = useState(false);
	const [sizeDraft, setSizeDraft] = useState({ rows: 5, cols: 5 });
	const [symmetry, setSymmetry] = useState(true);

	const [editorEmail, setEditorEmail] = useState<string | null>(null);
	const [publishing, setPublishing] = useState(false);
	const [publishMsg, setPublishMsg] = useState<{ ok?: string; err?: string }>({});
	const [copied, setCopied] = useState(false);

	const channelRef = useRef<RealtimeChannel | null>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savingRef = useRef(false);
	const pendingRef = useRef(false);
	const cursorSentAt = useRef(0);

	const grid = useMemo(() => gridFromDoc(doc), [doc]);
	const clues = useMemo(() => cluesFromDoc(doc), [doc]);
	const meta = useMemo(() => metaFromDoc(doc), [doc]);
	const { entries, numbers } = useMemo(() => computeEntries(grid), [grid]);
	const orphans = useMemo(() => orphanCells(grid, entries), [grid, entries]);
	const blanks = useMemo(() => grid.flat().filter(cell => cell === "").length, [grid]);
	const missingClues = entries.filter(e => !(clues[clueKey(e.dir, e.row, e.col)] ?? "").trim());
	const gridReady = entries.length > 0 && blanks === 0 && orphans.length === 0;

	// ─── name ────────────────────────────────────────────────────────────────

	useEffect(() => {
		try {
			const stored = localStorage.getItem(NAME_KEY);
			if (stored) setName(stored);
		} catch {
			// Private browsing: the default name is fine.
		}
	}, []);

	const rename = (next: string) => {
		setName(next);
		try {
			localStorage.setItem(NAME_KEY, next);
		} catch {
			// Not worth surfacing; the name still applies for this visit.
		}
	};

	// ─── saving ──────────────────────────────────────────────────────────────

	const flush = useCallback(async () => {
		if (!token) return;
		if (savingRef.current) {
			pendingRef.current = true;
			return;
		}
		savingRef.current = true;
		try {
			// A conflict means somebody saved between our read and our write. The
			// merge is symmetric, so adopting their doc and retrying cannot lose
			// our edits; the bound is here only so a pathological room cannot
			// spin forever.
			for (let attempt = 0; attempt < 5; attempt++) {
				const { data, error } = await supabase.rpc("crossword_room_save", {
					p_token: token,
					p_doc: docRef.current,
					p_rev: revRef.current,
				});
				if (error) {
					setSaveError(error.message);
					return;
				}
				const row = (data as SaveRow[] | null)?.[0];
				if (!row) {
					setSaveError("The server did not answer the save.");
					return;
				}
				if (row.status === "saved") {
					revRef.current = Number(row.rev);
					setSaveError(null);
					setSavedAt(Date.now());
					setDirty(false);
					return;
				}
				if (row.status === "conflict") {
					const theirs = parseDoc(row.doc, authorId, Date.now());
					const merged = mergeDoc(docRef.current, theirs);
					docRef.current = merged;
					setDoc(merged);
					revRef.current = Number(row.rev);
					continue;
				}
				setSaveError(
					row.status === "closed"
						? "This room has been closed, so nothing more can be saved."
						: row.status === "missing"
						? "This room no longer exists."
						: "This puzzle is too large to save."
				);
				if (row.status === "closed") setPhase("closed");
				return;
			}
			setSaveError("Could not settle the save against other edits. It will try again on the next change.");
		} finally {
			savingRef.current = false;
			if (pendingRef.current) {
				pendingRef.current = false;
				void flush();
			}
		}
	}, [authorId, supabase, token]);

	const scheduleSave = useCallback(() => {
		setDirty(true);
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
	}, [flush]);

	// ─── applying an edit ────────────────────────────────────────────────────

	const broadcast = useCallback((patch: RoomPatch) => {
		const channel = channelRef.current;
		if (!channel) return;
		void channel.send({ type: "broadcast", event: "patch", payload: patch });
	}, []);

	/** Apply locally, tell the room, and queue the save. */
	const apply = useCallback(
		(edit: Edit) => {
			docRef.current = edit.doc;
			setDoc(edit.doc);
			broadcast(edit.patch);
			scheduleSave();
		},
		[broadcast, scheduleSave]
	);

	const now = () => Date.now();

	// ─── loading the room ────────────────────────────────────────────────────

	useEffect(() => {
		if (!router.isReady) return;
		if (!token) {
			setPhase("missing");
			return;
		}
		let cancelled = false;

		void (async () => {
			const { data, error } = await supabase.rpc("crossword_room_open", { p_token: token });
			if (cancelled) return;
			if (error) {
				setFatal(error.message);
				setPhase("error");
				return;
			}
			const row = (data as OpenRow[] | null)?.[0];
			if (!row) {
				setPhase("missing");
				return;
			}
			if (row.closed) {
				setLabel(row.label);
				setPhase("closed");
				return;
			}
			const loaded = parseDoc(row.doc, authorId, Date.now());
			docRef.current = loaded;
			setDoc(loaded);
			revRef.current = Number(row.rev);
			setRoomId(row.id);
			setLabel(row.label);
			setCrosswordId(row.crossword_id ?? null);
			setSizeDraft(clampSize(loaded.size.v));
			setStep(Object.keys(loaded.cells).length ? "letters" : "size");
			setPhase("open");
		})();

		return () => {
			cancelled = true;
		};
	}, [authorId, router.isReady, supabase, token]);

	// Whoever is signed in as an editor may publish; everyone else just builds.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const { data: sessionData } = await supabase.auth.getSession();
			const email = sessionData.session?.user?.email;
			if (!email || cancelled) return;
			const { data } = await supabase.from("editor").select("email").eq("email", email).maybeSingle();
			if (!cancelled && data) {
				setEditorEmail(email);
				setName(current => (current === "Guest" ? email.split("@")[0] : current));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [supabase]);

	// ─── the realtime channel ────────────────────────────────────────────────

	useEffect(() => {
		if (!roomId) return;
		// The channel is named for the room id, not the token, so the secret
		// never leaves this browser except in the database call itself.
		const channel = supabase.channel(`xw:${roomId}`, {
			config: { broadcast: { self: false }, presence: { key: authorId } },
		});
		channelRef.current = channel;

		channel.on("broadcast", { event: "patch" }, ({ payload }) => {
			const patch = parsePatch(payload);
			const next = mergeDoc(docRef.current, patch);
			docRef.current = next;
			setDoc(next);
			// Everyone in the room saves. A redundant save costs one request and
			// resolves as a no-op merge; a draft that nobody saved because the one
			// person responsible closed their laptop costs the puzzle.
			scheduleSave();
		});

		const readPresence = () => {
			const state = channel.presenceState<{ authorId: string; name: string; r: number; c: number }>();
			const out: PeerCursor[] = [];
			for (const key of Object.keys(state)) {
				for (const entry of state[key]) {
					if (!entry?.authorId || entry.authorId === authorId) continue;
					out.push({
						authorId: entry.authorId,
						name: entry.name || "Guest",
						color: peerColor(entry.authorId),
						r: entry.r ?? -1,
						c: entry.c ?? -1,
					});
				}
			}
			setPeers(out);
		};

		channel.on("presence", { event: "sync" }, readPresence);
		channel.on("presence", { event: "join" }, readPresence);
		channel.on("presence", { event: "leave" }, readPresence);

		channel.subscribe(status => {
			if (status === "SUBSCRIBED") {
				setLive(true);
				void channel.track({ authorId, name, r: -1, c: -1 });
			} else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
				setLive(false);
			}
		});

		return () => {
			channelRef.current = null;
			setLive(false);
			void supabase.removeChannel(channel);
		};
		// `name` is tracked separately below so a rename does not tear down the
		// channel mid-edit.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [authorId, roomId, scheduleSave, supabase]);

	// Push the cursor and name into presence, throttled: arrow keys would
	// otherwise send a message per keypress.
	useEffect(() => {
		const channel = channelRef.current;
		if (!channel || !live) return;
		const send = () => {
			cursorSentAt.current = Date.now();
			void channel.track({ authorId, name, r: cursor?.r ?? -1, c: cursor?.c ?? -1 });
		};
		const since = Date.now() - cursorSentAt.current;
		if (since >= CURSOR_THROTTLE_MS) {
			send();
			return;
		}
		const timer = setTimeout(send, CURSOR_THROTTLE_MS - since);
		return () => clearTimeout(timer);
	}, [authorId, cursor, live, name]);

	// Re-read the row on a timer and merge it in. The realtime channel is the
	// fast path, not the guarantee: it can be unavailable, drop a message, or
	// miss everything sent while a laptop was shut. Merging is last-write-wins,
	// so pulling the stored draft in can only add what this browser has not
	// seen, never undo what it has. Slow while the channel is up, brisk when it
	// is not, because then this is the only way anything arrives.
	useEffect(() => {
		if (phase !== "open" || !token) return;
		const period = live ? 10000 : 4000;
		const timer = setInterval(() => {
			void (async () => {
				const { data, error } = await supabase.rpc("crossword_room_open", { p_token: token });
				if (error) return;
				const row = (data as OpenRow[] | null)?.[0];
				if (!row) return;
				if (row.closed) {
					setPhase("closed");
					return;
				}
				const theirs = parseDoc(row.doc, authorId, Date.now());
				const merged = mergeDoc(docRef.current, theirs);
				docRef.current = merged;
				setDoc(merged);
				// Only adopt their rev when no save is in flight, or the save would
				// be racing a number it did not read.
				if (!savingRef.current) revRef.current = Number(row.rev);
			})();
		}, period);
		return () => clearInterval(timer);
	}, [authorId, live, phase, supabase, token]);

	// A refresh or a closed tab should not drop the last keystrokes.
	useEffect(() => {
		const onHide = () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
			void flush();
		};
		const onVisibility = () => {
			if (document.visibilityState === "hidden") onHide();
		};
		window.addEventListener("pagehide", onHide);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("pagehide", onHide);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [flush]);

	useEffect(
		() => () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		},
		[]
	);

	// ─── editing ─────────────────────────────────────────────────────────────

	const wordCells = useMemo(() => {
		const set = new Set<string>();
		if (!cursor || isBlack(grid, cursor.r, cursor.c)) return set;
		if (dir === "across") {
			let c = cursor.c;
			while (!isBlack(grid, cursor.r, c - 1)) c--;
			for (; !isBlack(grid, cursor.r, c); c++) set.add(cellKey(cursor.r, c));
		} else {
			let r = cursor.r;
			while (!isBlack(grid, r - 1, cursor.c)) r--;
			for (; !isBlack(grid, r, cursor.c); r++) set.add(cellKey(r, cursor.c));
		}
		return set;
	}, [cursor, dir, grid]);

	const toggleBlack = (r: number, c: number) => {
		const becomingBlack = grid[r][c] !== BLACK;
		const value = becomingBlack ? BLACK : "";
		const cells = [{ r, c, v: value }];
		if (symmetry) {
			// Crosswords are conventionally symmetric under a 180 degree turn.
			const sr = grid.length - 1 - r;
			const sc = (grid[0]?.length ?? 0) - 1 - c;
			if (sr !== r || sc !== c) cells.push({ r: sr, c: sc, v: value });
		}
		// One edit, so the pair travels in a single message and cannot be split
		// across a merge.
		apply(setCells(docRef.current, cells, authorId, now()));
	};

	const onCellClick = (r: number, c: number) => {
		gridRef.current?.focus();
		if (step === "blocks") {
			toggleBlack(r, c);
			return;
		}
		if (isBlack(grid, r, c)) return;
		if (cursor && cursor.r === r && cursor.c === c) setDir(d => (d === "across" ? "down" : "across"));
		else setCursor({ r, c });
	};

	const advance = (r: number, c: number, back: boolean) => {
		const d = back ? -1 : 1;
		return dir === "across" ? { r, c: c + d } : { r: r + d, c };
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (step !== "letters" || !cursor) return;
		const { r, c } = cursor;
		const rows = grid.length;
		const cols = grid[0]?.length ?? 0;
		const inside = (p: { r: number; c: number }) => p.r >= 0 && p.c >= 0 && p.r < rows && p.c < cols;

		if (e.key === " ") {
			e.preventDefault();
			setDir(d => (d === "across" ? "down" : "across"));
			return;
		}
		if (e.key.startsWith("Arrow")) {
			e.preventDefault();
			const delta =
				e.key === "ArrowLeft"
					? { r: 0, c: -1 }
					: e.key === "ArrowRight"
					? { r: 0, c: 1 }
					: e.key === "ArrowUp"
					? { r: -1, c: 0 }
					: { r: 1, c: 0 };
			const next = { r: r + delta.r, c: c + delta.c };
			if (inside(next)) setCursor(next);
			return;
		}
		if (e.key === "Backspace" || e.key === "Delete") {
			e.preventDefault();
			const back = advance(r, c, true);
			if (grid[r][c]) {
				apply(setCell(docRef.current, r, c, "", authorId, now()));
			} else if (inside(back) && !isBlack(grid, back.r, back.c)) {
				apply(setCell(docRef.current, back.r, back.c, "", authorId, now()));
				setCursor(back);
			}
			return;
		}
		if (/^[a-zA-Z]$/.test(e.key)) {
			e.preventDefault();
			apply(setCell(docRef.current, r, c, e.key.toUpperCase(), authorId, now()));
			const forward = advance(r, c, false);
			if (inside(forward) && !isBlack(grid, forward.r, forward.c)) setCursor(forward);
		}
	};

	const applySize = () => {
		const next = clampSize(sizeDraft);
		setSizeDraft(next);
		apply(setSize(docRef.current, next, authorId, now()));
		setCursor(null);
		setStep("blocks");
	};

	const editMeta = (field: MetaField, value: string) => apply(setMeta(docRef.current, field, value, authorId, now()));
	const editClue = (key: string, value: string) => apply(setClue(docRef.current, key, value, authorId, now()));

	// ─── publishing, editors only ────────────────────────────────────────────

	const publish = async () => {
		setPublishing(true);
		setPublishMsg({});
		try {
			if (!meta.date) throw new Error("A publish date is required (the archive is dated).");
			if (!meta.author.trim()) throw new Error("Author is required.");
			if (!entries.length) throw new Error("The grid has no entries yet.");
			if (blanks > 0) throw new Error(`${blanks} square${blanks === 1 ? " is" : "s are"} still empty.`);
			if (orphans.length) throw new Error(`A white square at row ${orphans[0].r + 1}, column ${orphans[0].c + 1} is not part of any word.`);
			if (missingClues.length) throw new Error(`${missingClues.length} clue${missingClues.length === 1 ? "" : "s"} still need writing.`);

			const payload = {
				date: meta.date,
				title: meta.title.trim() || null,
				author: meta.author.trim(),
				clues: buildCluesJson(entries, clues),
			};

			if (crosswordId) {
				const { data, error } = await supabase.from("crossword").update(payload).eq("id", crosswordId).select("id");
				if (error) throw error;
				if (!data?.length) throw new Error("The archive refused the update. Are you still signed in as an editor?");
			} else {
				const { data, error } = await supabase.from("crossword").insert(payload).select("id");
				if (error) throw error;
				const id = data?.[0]?.id as number | undefined;
				if (id) {
					setCrosswordId(id);
					// Best effort: links the room to the row it published, so a later
					// publish updates rather than duplicates.
					await supabase.from("crossword_room").update({ crossword_id: id }).eq("id", roomId);
				}
			}
			setPublishMsg({ ok: "Published to the crossword archive." });
		} catch (e) {
			setPublishMsg({ err: e instanceof Error ? e.message : String(e) });
		}
		setPublishing(false);
	};

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setPublishMsg({ err: "Could not copy. Select the address bar and copy the link by hand." });
		}
	};

	// ─── render ──────────────────────────────────────────────────────────────

	const shell = (children: React.ReactNode) => (
		<div className="ta-root">
			<Head>
				<title>Crossword room | The Tower</title>
				<meta name="robots" content="noindex, nofollow" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			{children}
		</div>
	);

	if (phase !== "open") {
		const headline =
			phase === "loading"
				? "Opening the room…"
				: phase === "closed"
				? "This room is closed"
				: phase === "missing"
				? "That link does not open anything"
				: "Something went wrong";
		const body =
			phase === "loading"
				? "One moment."
				: phase === "closed"
				? "An editor has closed this draft. Ask them for a fresh link if you still need to work on it."
				: phase === "missing"
				? "The link may be mistyped, or the room may have been deleted. Ask whoever shared it for a new one."
				: fatal;
		return shell(
			<div className="ta-gate">
				<div className="ta-gate-inner">
					<div className="ta-gate-wordmark">The Tower</div>
					<div className="ta-gate-rules">Crossword room</div>
					<p className="ta-gate-body">{headline}</p>
					{body && <p className="ta-gate-body ta-muted ta-small">{body}</p>}
				</div>
			</div>
		);
	}

	const saveLabel = saveError ? "Not saved" : dirty ? "Saving…" : savedAt ? "Saved" : "Ready";

	return shell(
		<>
			<header className="ta-masthead">
				<span className="ta-masthead-logo">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/assets/tower-short.png" alt="" draggable="false" />
					<h1>The Tower</h1>
				</span>
				<span className="ta-masthead-tag">Crossword room</span>
				<div className="ta-masthead-sides">
					<p className="ta-masthead-date">{label || "Shared draft"}</p>
					<div className="ta-masthead-user">
						<span className={`ta-room-save${saveError ? " bad" : dirty ? " busy" : ""}`}>{saveLabel}</span>
						<button className="ta-btn ta-btn-small" onClick={() => void copyLink()}>
							{copied ? "Link copied" : "Copy link"}
						</button>
					</div>
				</div>
			</header>

			<main className="ta-content wide">
				<h1 className="ta-page-title">Build a crossword together</h1>

				<div className="ta-room-bar">
					<label className="ta-room-name">
						You are
						<input type="text" value={name} onChange={e => rename(e.target.value)} maxLength={24} aria-label="Your display name" />
					</label>
					<span className={`ta-room-live${live ? " on" : ""}`}>{live ? "Live" : "Reconnecting…"}</span>
					<div className="ta-room-peers">
						{peers.length === 0 && <span className="ta-muted ta-small">Nobody else is here yet. Send them the link.</span>}
						{peers.map(peer => (
							<span key={peer.authorId} className="ta-room-peer" style={{ ["--peer" as string]: peer.color }}>
								{peer.name}
							</span>
						))}
					</div>
				</div>

				{saveError && <p className="ta-error">{saveError}</p>}

				<div className="ta-card ta-row">
					<label style={{ margin: 0 }}>
						Publish date
						<input type="date" value={meta.date} onChange={e => editMeta("date", e.target.value)} />
					</label>
					<label style={{ margin: 0, minWidth: "14rem" }}>
						Title
						<input type="text" value={meta.title} placeholder="(optional)" onChange={e => editMeta("title", e.target.value)} />
					</label>
					<label style={{ margin: 0, minWidth: "12rem" }}>
						Author
						<input type="text" value={meta.author} onChange={e => editMeta("author", e.target.value)} />
					</label>
				</div>

				<div className="ta-tabs">
					<button className={step === "size" ? "active" : ""} onClick={() => setStep("size")}>
						1. Size
					</button>
					<button className={step === "blocks" ? "active" : ""} onClick={() => setStep("blocks")}>
						2. Black squares
					</button>
					<button className={step === "letters" ? "active" : ""} onClick={() => setStep("letters")}>
						3. Letters
					</button>
					<button className={showClues ? "active" : ""} onClick={() => setShowClues(true)} disabled={!gridReady}>
						4. Clues
					</button>
				</div>

				{step === "size" && (
					<div className="ta-card ta-stack" style={{ maxWidth: "34rem" }}>
						<b>How big is the puzzle?</b>
						<p className="ta-muted ta-small">Resizing changes it for everyone in the room. Squares outside a smaller grid come back if you grow it again.</p>
						<div className="ta-row">
							<label style={{ margin: 0, maxWidth: "7rem" }}>
								Rows
								<input
									type="number"
									min={MIN_SIZE}
									max={MAX_SIZE}
									value={sizeDraft.rows}
									onChange={e => setSizeDraft({ ...sizeDraft, rows: Number(e.target.value) })}
								/>
							</label>
							<label style={{ margin: 0, maxWidth: "7rem" }}>
								Columns
								<input
									type="number"
									min={MIN_SIZE}
									max={MAX_SIZE}
									value={sizeDraft.cols}
									onChange={e => setSizeDraft({ ...sizeDraft, cols: Number(e.target.value) })}
								/>
							</label>
							<span className="ta-muted ta-small">
								{MIN_SIZE} to {MAX_SIZE} each way.
							</span>
						</div>
						<div className="ta-row">
							{[
								[5, 5],
								[7, 7],
								[11, 11],
								[15, 15],
							].map(([r, c]) => (
								<button key={`${r}x${c}`} className="ta-btn ta-btn-small" onClick={() => setSizeDraft({ rows: r, cols: c })}>
									{r}x{c}
								</button>
							))}
						</div>
						<div>
							<button className="ta-btn ta-btn-primary" onClick={applySize}>
								Apply size
							</button>
						</div>
					</div>
				)}

				{(step === "blocks" || step === "letters") && (
					<div className="ta-xw-layout">
						<div>
							<GridEditor
								grid={grid}
								numbers={numbers}
								mode={step}
								selected={step === "letters" ? cursor : null}
								highlight={step === "letters" ? wordCells : new Set()}
								peers={peers.filter(p => p.r >= 0)}
								onCellClick={onCellClick}
								onKeyDown={onKeyDown}
								gridRef={gridRef}
							/>
						</div>

						<div className="ta-stack">
							{step === "blocks" ? (
								<div className="ta-card ta-stack">
									<b>Click squares to black them out</b>
									<p className="ta-muted ta-small">
										Numbering updates as you go. Every white square has to belong to a word at least two squares long.
									</p>
									<label style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
										<input
											type="checkbox"
											checked={symmetry}
											onChange={e => setSymmetry(e.target.checked)}
											style={{ width: "auto" }}
										/>
										Mirror each square (180 degree symmetry)
									</label>
									<div className="ta-row">
										<button className="ta-btn" onClick={() => apply(clearGrid(docRef.current, authorId, now()))}>
											Clear all
										</button>
										<button className="ta-btn ta-btn-primary" onClick={() => setStep("letters")}>
											Next: fill in letters
										</button>
									</div>
								</div>
							) : (
								<div className="ta-card ta-stack">
									<b>Type the answers</b>
									<p className="ta-muted ta-small">
										Click a square and type. Clicking the same square again switches between across and down, as does the space
										bar. Arrow keys move, backspace clears.
									</p>
									<p style={{ margin: 0 }}>
										Direction: <b>{dir === "across" ? "Across" : "Down"}</b> ·{" "}
										{blanks > 0 ? (
											<span className="ta-muted">
												{blanks} square{blanks === 1 ? "" : "s"} left
											</span>
										) : (
											<span className="ta-ok">grid complete</span>
										)}
									</p>
									<div className="ta-row">
										<button className="ta-btn" onClick={() => setStep("blocks")}>
											Back to black squares
										</button>
										<button className="ta-btn ta-btn-primary" onClick={() => setShowClues(true)} disabled={!gridReady}>
											Next: write the clues
										</button>
									</div>
								</div>
							)}

							<div className="ta-card">
								<b>
									{entries.length} entr{entries.length === 1 ? "y" : "ies"}
								</b>
								<p className="ta-muted ta-small" style={{ margin: 0 }}>
									{entries.filter(e => e.dir === "across").length} across, {entries.filter(e => e.dir === "down").length} down
								</p>
							</div>

							{orphans.length > 0 && (
								<p className="ta-error">
									{orphans.length} white square{orphans.length === 1 ? "" : "s"} belong to no word (first at row {orphans[0].r + 1},
									column {orphans[0].c + 1}). The app would drop {orphans.length === 1 ? "it" : "them"}.
								</p>
							)}

							{editorEmail ? (
								<div className="ta-card ta-stack">
									<b>Publish</b>
									<p className="ta-muted ta-small" style={{ margin: 0 }}>
										Signed in as {editorEmail}. {crosswordId ? "This room publishes to an existing archive entry." : "This will add a new entry to the crossword archive."}
									</p>
									<div>
										<button className="ta-btn ta-btn-primary" onClick={() => void publish()} disabled={publishing || !gridReady}>
											{publishing ? "Publishing…" : crosswordId ? "Update the archive entry" : "Publish to the archive"}
										</button>
									</div>
									{publishMsg.ok && <p className="ta-ok">{publishMsg.ok}</p>}
									{publishMsg.err && <p className="ta-error">{publishMsg.err}</p>}
								</div>
							) : (
								<p className="ta-muted ta-small">
									Everything here saves automatically. A Tower editor publishes it to the site when the puzzle is finished.
								</p>
							)}
						</div>
					</div>
				)}

				{showClues && (
					<ClueDialog
						entries={entries}
						clues={clues}
						onChange={editClue}
						onClose={() => setShowClues(false)}
						onSave={editorEmail ? () => void publish() : undefined}
						canSave={Boolean(editorEmail)}
						saveLabel={crosswordId ? "Update the archive entry" : "Publish to the archive"}
						busy={publishing}
						error={publishMsg.err ?? null}
						footerNote={editorEmail ? undefined : "Clues save as you type. An editor publishes the finished puzzle."}
					/>
				)}
			</main>
		</>
	);
}
