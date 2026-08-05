/** @format */

import { useCallback, useEffect, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";

// Letters arrive from the app (INSERT-open to signed-in readers). The app's
// account-deletion flow nulls author_name/email/id on old letters — those
// render as "(account deleted)".

type LetterStatus = "new" | "reviewed" | "archived";

interface LetterRow {
	id: number;
	subject: string | null;
	body: string | null;
	author_name: string | null;
	author_email: string | null;
	status: LetterStatus;
	created_at: string | null;
}

const STATUSES: LetterStatus[] = ["new", "reviewed", "archived"];
const BADGE: Record<LetterStatus, string> = { new: "red", reviewed: "green", archived: "gray" };

function LettersInbox() {
	const { supabase } = useAdmin();
	const [letters, setLetters] = useState<LetterRow[]>([]);
	const [filter, setFilter] = useState<"all" | LetterStatus>("all");
	const [search, setSearch] = useState("");
	const [expanded, setExpanded] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		let query = supabase
			.from("letter")
			.select("id, subject, body, author_name, author_email, status, created_at")
			.order("created_at", { ascending: false })
			.order("id", { ascending: false })
			.limit(300);
		if (filter !== "all") query = query.eq("status", filter);
		const term = search.trim();
		if (term) {
			const like = `%${term.replace(/[%_]/g, "")}%`;
			query = query.or(`subject.ilike.${like},body.ilike.${like},author_name.ilike.${like},author_email.ilike.${like}`);
		}
		const { data, error: err } = await query;
		setLoading(false);
		if (err) {
			setError(err.message);
			return;
		}
		setLetters((data ?? []) as LetterRow[]);
	}, [supabase, filter, search]);

	useEffect(() => {
		const t = setTimeout(() => void load(), search ? 250 : 0);
		return () => clearTimeout(t);
	}, [load, search]);

	const setStatus = async (id: number, status: LetterStatus) => {
		setError(null);
		const { error: err, data } = await supabase.from("letter").update({ status }).eq("id", id).select("id");
		if (err || !data?.length) {
			setError(err?.message ?? "Update was blocked — are you signed in as an editor?");
			return;
		}
		setLetters(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
	};

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<input type="search" placeholder="Search letters…" value={search} onChange={e => setSearch(e.target.value)} />
				<div className="ta-tabs" style={{ margin: 0, borderBottom: "none" }}>
					{(["all", ...STATUSES] as const).map(s => (
						<button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
							{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
						</button>
					))}
				</div>
			</div>
			{error && <p className="ta-error">{error}</p>}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th style={{ width: 130 }}>Received</th>
							<th>From</th>
							<th>Subject</th>
							<th style={{ width: 100 }}>Status</th>
							<th style={{ width: 220 }}>Triage</th>
						</tr>
					</thead>
					<tbody>
						{letters.map(l => {
							const isOpen = expanded === l.id;
							const from = l.author_name || l.author_email ? `${l.author_name ?? "(no name)"}` : "(account deleted)";
							return (
								<tr key={l.id} className={`ta-letter${isOpen ? " expanded" : ""}`} onClick={() => setExpanded(isOpen ? null : l.id)}>
									<td className="ta-muted ta-small">{l.created_at ? new Date(l.created_at).toLocaleDateString() : "—"}</td>
									<td>
										{from}
										{l.author_email && <div className="ta-muted ta-small">{l.author_email}</div>}
									</td>
									<td>
										<b>{l.subject?.trim() || "(no subject)"}</b>
										{isOpen ? (
											<div className="ta-letter-body">{l.body?.trim() || "(empty)"}</div>
										) : (
											<div className="ta-muted ta-small">
												{(l.body ?? "").slice(0, 120)}
												{(l.body ?? "").length > 120 ? "…" : ""}
											</div>
										)}
									</td>
									<td>
										<span className={`ta-badge ${BADGE[l.status] ?? "gray"}`}>{l.status}</span>
									</td>
									<td onClick={e => e.stopPropagation()}>
										{STATUSES.filter(s => s !== l.status).map(s => (
											<button
												key={s}
												className="ta-btn ta-btn-small"
												style={{ marginRight: 6 }}
												onClick={() => void setStatus(l.id, s)}
											>
												{s === "new" ? "Mark new" : s === "reviewed" ? "Reviewed" : "Archive"}
											</button>
										))}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{!loading && letters.length === 0 && <p className="ta-muted">No letters{filter !== "all" ? ` with status “${filter}”` : ""}.</p>}
			{loading && <p className="ta-muted">Loading…</p>}
		</div>
	);
}

export default function LettersPage() {
	return (
		<AdminShell title="Letters to the editor" wide>
			<LettersInbox />
		</AdminShell>
	);
}
