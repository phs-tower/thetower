/** @format */

import { useCallback, useEffect, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { monthName, SEND_PUSH_URL } from "~/lib/console/supabase";

// Composes a OneSignal push to EVERY device via the send-push Edge Function
// (which holds the REST key and re-verifies that the caller is an editor).
// article_id rides in additionalData — the app deep-links the article from it.

interface PushLogRow {
	id: number;
	title: string;
	message: string;
	article_id: number | null;
	sent_by: string | null;
	recipients: number | null;
	created_at: string;
}

interface ArticleLite {
	id: number;
	title: string;
	month: number;
	year: number;
}

function PushComposer() {
	const { supabase } = useAdmin();
	const [title, setTitle] = useState("");
	const [message, setMessage] = useState("");
	const [articleTerm, setArticleTerm] = useState("");
	const [article, setArticle] = useState<ArticleLite | null>(null);
	const [results, setResults] = useState<ArticleLite[]>([]);
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
	const [log, setLog] = useState<PushLogRow[]>([]);

	const loadLog = useCallback(async () => {
		const { data } = await supabase
			.from("push_log")
			.select("id, title, message, article_id, sent_by, recipients, created_at")
			.order("id", { ascending: false })
			.limit(25);
		setLog((data ?? []) as PushLogRow[]);
	}, [supabase]);

	useEffect(() => {
		void loadLog();
	}, [loadLog]);

	useEffect(() => {
		const t = setTimeout(async () => {
			const q = articleTerm.trim();
			if (!q) {
				setResults([]);
				return;
			}
			let query = supabase.from("article").select("id, title, month, year").eq("published", true).order("id", { ascending: false }).limit(8);
			query = /^\d+$/.test(q) ? query.eq("id", Number(q)) : query.ilike("title", `%${q}%`);
			const { data } = await query;
			setResults((data ?? []) as ArticleLite[]);
		}, 220);
		return () => clearTimeout(t);
	}, [supabase, articleTerm]);

	const send = async () => {
		setBusy(true);
		setMsg({});
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const token = sessionData.session?.access_token;
			if (!token) throw new Error("Session expired — sign in again.");
			const res = await fetch(SEND_PUSH_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ title: title.trim(), message: message.trim(), article_id: article?.id ?? null }),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok)
				throw new Error(body.error ? `${body.error}${body.detail ? ` — ${JSON.stringify(body.detail)}` : ""}` : `HTTP ${res.status}`);
			setMsg({ ok: `Sent${typeof body.recipients === "number" ? ` to ~${body.recipients} devices` : ""}.` });
			setTitle("");
			setMessage("");
			setArticle(null);
			setConfirming(false);
			await loadLog();
		} catch (e) {
			setMsg({ err: e instanceof Error ? e.message : String(e) });
		}
		setBusy(false);
	};

	const ready = title.trim().length > 0 && message.trim().length > 0;

	return (
		<div className="ta-stack">
			<div className="ta-card ta-stack" style={{ maxWidth: 640 }}>
				<label style={{ margin: 0 }}>
					Title
					<input type="text" value={title} maxLength={80} placeholder="New issue out now!" onChange={e => setTitle(e.target.value)} />
				</label>
				<label style={{ margin: 0 }}>
					Message
					<textarea
						rows={3}
						value={message}
						maxLength={300}
						placeholder="The May issue of The Tower is live in the app."
						onChange={e => setMessage(e.target.value)}
					/>
				</label>
				<div className="ta-picker">
					<label style={{ margin: 0 }}>
						Link an article (optional — the app opens it when the notification is tapped)
						<input
							type="search"
							value={article ? `#${article.id} ${article.title}` : articleTerm}
							disabled={!!article}
							placeholder="Search by title or id…"
							onChange={e => setArticleTerm(e.target.value)}
						/>
					</label>
					{article && (
						<button className="ta-btn ta-btn-small" style={{ marginTop: 6 }} onClick={() => setArticle(null)}>
							✕ Unlink article
						</button>
					)}
					{!article && results.length > 0 && (
						<div className="ta-picker-results">
							{results.map(a => (
								<button
									key={a.id}
									type="button"
									onClick={() => {
										setArticle(a);
										setArticleTerm("");
										setResults([]);
									}}
								>
									<b>#{a.id}</b> {a.title}{" "}
									<span className="ta-muted">
										{monthName(a.month)} {a.year}
									</span>
								</button>
							))}
						</div>
					)}
				</div>

				{!confirming ? (
					<button className="ta-btn ta-btn-primary" disabled={!ready || busy} onClick={() => setConfirming(true)}>
						Review &amp; send…
					</button>
				) : (
					<div className="ta-card" style={{ borderLeft: "4px solid #a31621" }}>
						<p style={{ marginTop: 0 }}>
							<b>This sends to EVERY device with the app installed.</b> There is no undo.
						</p>
						<p style={{ background: "#f4f6f8", borderRadius: 8, padding: "10px 12px" }}>
							<b>{title.trim()}</b>
							<br />
							{message.trim()}
							{article && (
								<span className="ta-muted ta-small">
									<br />↳ opens article #{article.id}: {article.title}
								</span>
							)}
						</p>
						<div className="ta-row">
							<button className="ta-btn ta-btn-danger" disabled={busy} onClick={() => void send()}>
								{busy ? "Sending…" : "Yes — send to everyone"}
							</button>
							<button className="ta-btn" disabled={busy} onClick={() => setConfirming(false)}>
								Back
							</button>
						</div>
					</div>
				)}
				{msg.ok && <p className="ta-ok">{msg.ok}</p>}
				{msg.err && <p className="ta-error">{msg.err}</p>}
			</div>

			<h3 style={{ fontSize: 15 }}>Recent sends</h3>
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th style={{ width: 160 }}>When</th>
							<th>Notification</th>
							<th style={{ width: 200 }}>By</th>
							<th style={{ width: 110 }}>Devices</th>
						</tr>
					</thead>
					<tbody>
						{log.map(l => (
							<tr key={l.id}>
								<td className="ta-muted ta-small">{new Date(l.created_at).toLocaleString()}</td>
								<td>
									<b>{l.title}</b>
									<div className="ta-muted ta-small">
										{l.message}
										{l.article_id ? ` · ↳ article #${l.article_id}` : ""}
									</div>
								</td>
								<td className="ta-muted ta-small">{l.sent_by ?? "—"}</td>
								<td>{l.recipients ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{log.length === 0 && <p className="ta-muted">No pushes logged yet.</p>}
		</div>
	);
}

export default function PushPage() {
	return (
		<AdminShell title="Push notifications">
			<PushComposer />
		</AdminShell>
	);
}
