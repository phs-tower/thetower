/** @format */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { SEND_PUSH_URL } from "~/lib/console/supabase";

function isoDate(d: Date) {
	return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function prettyDate(iso: string) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

interface SchoolDayRow {
	day: string;
	type_code: string;
	note: string | null;
}

function SnowDay() {
	const { supabase, email } = useAdmin();
	const today = isoDate(new Date());
	const tomorrow = isoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
	const [day, setDay] = useState(today);
	const [row, setRow] = useState<SchoolDayRow | null | "loading">("loading");
	const [undo, setUndo] = useState<{ day: string; prev: SchoolDayRow | null } | null>(null);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pushOffer, setPushOffer] = useState<{ title: string; message: string } | null>(null);

	const load = useCallback(async () => {
		setRow("loading");
		const { data, error: err } = await supabase.from("school_day").select("day, type_code, note").eq("day", day).maybeSingle();
		if (err) {
			setError(err.message);
			setRow(null);
			return;
		}
		setRow(data ?? null);
	}, [supabase, day]);

	useEffect(() => {
		setError(null);
		setNote(null);
		void load();
	}, [load]);

	const apply = async (action: "close" | "delay") => {
		if (row === "loading" || busy) return;
		setBusy(true);
		setError(null);
		setNote(null);
		const prev = row;
		try {
			if (action === "close") {
				// Absence of a school_day row means NO SCHOOL — closing IS deleting.
				const { error: err } = await supabase.from("school_day").delete().eq("day", day);
				if (err) throw err;
				setNote(`${prettyDate(day)} is now marked CLOSED (no school).`);
				setPushOffer({ title: "School closed", message: `PHS is closed ${prettyDate(day)}. Stay safe and warm!` });
			} else {
				const { error: err } = await supabase
					.from("school_day")
					.upsert(
						{ day, type_code: "DELAY2H", note: prev && prev.type_code !== "DELAY2H" ? `Was Day ${prev.type_code}` : null },
						{ onConflict: "day" }
					);
				if (err) throw err;
				setNote(`${prettyDate(day)} is now a 2-HOUR DELAY.`);
				setPushOffer({ title: "2-hour delayed opening", message: `PHS is on a 2-hour delay ${prettyDate(day)}.` });
			}
			setUndo({ day, prev });
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
		setBusy(false);
	};

	const applyUndo = async () => {
		if (!undo || busy) return;
		setBusy(true);
		setError(null);
		try {
			if (undo.prev) {
				const { error: err } = await supabase.from("school_day").upsert(undo.prev, { onConflict: "day" });
				if (err) throw err;
			} else {
				const { error: err } = await supabase.from("school_day").delete().eq("day", undo.day);
				if (err) throw err;
			}
			setNote("Restored.");
			setUndo(null);
			setPushOffer(null);
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
		setBusy(false);
	};

	const loaded = row !== "loading" ? row : null;
	const alreadyDelayed = loaded !== null && loaded.type_code === "DELAY2H";

	return (
		<div className="ta-card ta-snow-card">
			<h2>Snow day &amp; delayed opening</h2>
			<p className="ta-muted ta-small">
				&ldquo;Closed&rdquo; deletes the day&rsquo;s schedule row (no row = no school). The app picks changes up on its next refresh (it
				caches ~12h — send a push so people actually find out).
			</p>
			<div className="ta-snow-days">
				{[
					{ iso: today, label: `Today · ${prettyDate(today)}` },
					{ iso: tomorrow, label: `Tomorrow · ${prettyDate(tomorrow)}` },
				].map(opt => (
					<button key={opt.iso} className={`ta-snow-day-pick${day === opt.iso ? " selected" : ""}`} onClick={() => setDay(opt.iso)}>
						{opt.label}
					</button>
				))}
			</div>
			<p>
				Current status:{" "}
				{row === "loading" ? (
					<span className="ta-muted">checking…</span>
				) : row ? (
					<b>
						{row.type_code}
						{row.note ? ` — ${row.note}` : ""}
					</b>
				) : (
					<b>No school scheduled</b>
				)}
			</p>
			<div className="ta-snow-actions">
				<button
					className="ta-btn ta-btn-danger ta-btn-big"
					disabled={busy || row === "loading" || row === null}
					onClick={() => apply("close")}
				>
					Closed — no school
				</button>
				<button
					className="ta-btn ta-btn-primary ta-btn-big"
					disabled={busy || row === "loading" || alreadyDelayed}
					onClick={() => apply("delay")}
				>
					2-hour delay
				</button>
			</div>
			{note && <p className="ta-ok">{note}</p>}
			{error && <p className="ta-error">{error}</p>}
			{undo && (
				<button className="ta-btn ta-btn-small" disabled={busy} onClick={applyUndo}>
					Undo ({undo.prev ? `restore ${undo.prev.type_code}` : "remove the row again"})
				</button>
			)}
			{pushOffer && <SnowPush offer={pushOffer} onDone={() => setPushOffer(null)} email={email} />}
		</div>
	);
}

function SnowPush({ offer, onDone, email }: { offer: { title: string; message: string }; onDone: () => void; email: string }) {
	const { supabase } = useAdmin();
	const [title, setTitle] = useState(offer.title);
	const [message, setMessage] = useState(offer.message);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitle(offer.title);
		setMessage(offer.message);
		setResult(null);
		setError(null);
	}, [offer]);

	const send = async () => {
		if (!window.confirm("Send this push notification to EVERY device with the app installed?")) return;
		setBusy(true);
		setError(null);
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const token = sessionData.session?.access_token;
			const res = await fetch(SEND_PUSH_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ title, message }),
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
			setResult(`Sent${typeof body.recipients === "number" ? ` to ~${body.recipients} devices` : ""}.`);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
		setBusy(false);
	};

	return (
		<div className="ta-stack" style={{ marginTop: 12, borderTop: "1px solid gainsboro", paddingTop: 12 }}>
			<b>Notify everyone?</b>
			<label>
				Title
				<input type="text" value={title} onChange={e => setTitle(e.target.value)} />
			</label>
			<label>
				Message
				<textarea rows={2} value={message} onChange={e => setMessage(e.target.value)} />
			</label>
			<div className="ta-row">
				<button className="ta-btn ta-btn-danger" disabled={busy || !title.trim() || !message.trim()} onClick={send}>
					{busy ? "Sending…" : "Send push to all devices"}
				</button>
				<button className="ta-btn" onClick={onDone} disabled={busy}>
					Skip
				</button>
			</div>
			{result && (
				<p className="ta-ok">
					{result} Sent as {email}.
				</p>
			)}
			{error && <p className="ta-error">{error}</p>}
		</div>
	);
}

function Stats() {
	const { supabase } = useAdmin();
	const [stats, setStats] = useState<{ missingBlurbs?: number; newLetters?: number; teachers?: number }>({});

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const [blurbs, letters, teachers] = await Promise.all([
				supabase.from("article").select("id", { count: "exact", head: true }).eq("published", true).or('blurb.is.null,blurb.eq.""'),
				supabase.from("letter").select("id", { count: "exact", head: true }).eq("status", "new"),
				supabase.from("teacher").select("id", { count: "exact", head: true }).eq("active", true),
			]);
			if (cancelled) return;
			setStats({
				missingBlurbs: blurbs.count ?? undefined,
				newLetters: letters.count ?? undefined,
				teachers: teachers.count ?? undefined,
			});
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [supabase]);

	const cards = [
		{ href: "/admin/blurbs", label: "Published articles missing a blurb", value: stats.missingBlurbs },
		{ href: "/admin/letters", label: "New letters to the editor", value: stats.newLetters },
		{ href: "/admin/schedule", label: "Active teachers in the picker", value: stats.teachers },
	];

	return (
		<div className="ta-grid-cards">
			{cards.map(card => (
				<Link key={card.href} href={card.href} className="ta-card ta-stat">
					<span className="ta-stat-num">{card.value ?? "—"}</span>
					<span className="ta-stat-label">{card.label}</span>
				</Link>
			))}
		</div>
	);
}

export default function AdminHome() {
	return (
		<AdminShell title="Dashboard">
			<div className="ta-stack">
				<SnowDay />
				<Stats />
			</div>
		</AdminShell>
	);
}
