/** @format */

import { useCallback, useEffect, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";
import { monthName } from "~/lib/console/supabase";

// The app's hero cards fall back to lorem ipsum when blurb is empty, so this
// queue exists to be churned through fast: textarea + ⌘/Ctrl-Enter to save,
// newest articles first, filter defaults to "missing only".

interface ArticleRow {
	id: number;
	title: string;
	authors: string[];
	month: number;
	year: number;
	category: string;
	img: string | null;
	blurb: string | null;
	published: boolean;
}

const PAGE = 30;
const GUIDE = "1–2 sentences (~140–220 characters) that sell the story on the app's front page.";

function BlurbItem({ article, onSaved }: { article: ArticleRow; onSaved: (id: number, blurb: string) => void }) {
	const { supabase } = useAdmin();
	const [value, setValue] = useState(article.blurb ?? "");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedFlash, setSavedFlash] = useState(false);
	const dirty = value !== (article.blurb ?? "");

	const save = async () => {
		if (!dirty || busy) return;
		setBusy(true);
		setError(null);
		const { error: err, data } = await supabase.from("article").update({ blurb: value.trim() }).eq("id", article.id).select("id");
		setBusy(false);
		if (err) {
			setError(err.message);
			return;
		}
		if (!data || data.length === 0) {
			setError("Save was blocked (no rows updated) — are you still signed in as an editor?");
			return;
		}
		onSaved(article.id, value.trim());
		setSavedFlash(true);
		setTimeout(() => setSavedFlash(false), 1500);
	};

	const count = value.trim().length;

	return (
		<div className="ta-card ta-blurb-item">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			{article.img ? (
				<img src={article.img} alt="" />
			) : (
				<div style={{ width: 86, height: 60, borderRadius: 8, background: "#eceff2", flexShrink: 0 }} />
			)}
			<div className="ta-blurb-main">
				<div className="ta-row ta-spread">
					<b>
						{article.title} <span className="ta-muted">#{article.id}</span>
					</b>
					<span className="ta-badge gray">
						{article.category} · {monthName(article.month)} {article.year}
					</span>
				</div>
				<div className="ta-muted ta-small">{(article.authors || []).join(", ")}</div>
				<textarea
					rows={2}
					value={value}
					placeholder="Write a blurb…"
					onChange={e => setValue(e.target.value)}
					onKeyDown={e => {
						if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save();
					}}
				/>
				<div className="ta-row ta-spread" style={{ marginTop: 6 }}>
					<span className={`ta-charcount${count > 260 ? " long" : ""}`}>
						{count} chars — {GUIDE}
					</span>
					<span className="ta-row">
						{savedFlash && <span className="ta-ok">Saved ✓</span>}
						{error && <span className="ta-error">{error}</span>}
						<button className="ta-btn ta-btn-primary ta-btn-small" disabled={!dirty || busy} onClick={save}>
							{busy ? "Saving…" : dirty ? "Save" : "Saved"}
						</button>
					</span>
				</div>
			</div>
		</div>
	);
}

function BlurbQueue() {
	const { supabase } = useAdmin();
	const [articles, setArticles] = useState<ArticleRow[]>([]);
	const [missingOnly, setMissingOnly] = useState(true);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const pageRef = useRef(0);

	const load = useCallback(
		async (page: number, append: boolean) => {
			setLoading(true);
			setError(null);
			let query = supabase
				.from("article")
				.select("id, title, authors, month, year, category, img, blurb, published")
				.eq("published", true)
				.order("year", { ascending: false })
				.order("month", { ascending: false })
				.order("id", { ascending: false })
				.range(page * PAGE, page * PAGE + PAGE);
			if (missingOnly) query = query.or('blurb.is.null,blurb.eq.""');
			const term = search.trim();
			if (term) {
				const numeric = /^\d+$/.test(term);
				query = numeric ? query.eq("id", Number(term)) : query.ilike("title", `%${term}%`);
			}
			const { data, error: err } = await query;
			setLoading(false);
			if (err) {
				setError(err.message);
				return;
			}
			const rows = (data ?? []) as ArticleRow[];
			setHasMore(rows.length > PAGE);
			const pageRows = rows.slice(0, PAGE);
			setArticles(prev => (append ? [...prev, ...pageRows] : pageRows));
			pageRef.current = page;
		},
		[supabase, missingOnly, search]
	);

	useEffect(() => {
		const t = setTimeout(() => void load(0, false), search ? 250 : 0);
		return () => clearTimeout(t);
	}, [load, search]);

	const onSaved = (id: number, blurb: string) => {
		setArticles(prev => (missingOnly && blurb ? prev.filter(a => a.id !== id) : prev.map(a => (a.id === id ? { ...a, blurb } : a))));
	};

	return (
		<div className="ta-stack">
			<div className="ta-toolbar">
				<input type="search" placeholder="Search by title or id…" value={search} onChange={e => setSearch(e.target.value)} />
				<label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
					<input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} style={{ width: "auto" }} />
					Missing blurb only
				</label>
			</div>
			{error && <p className="ta-error">{error}</p>}
			{articles.map(a => (
				<BlurbItem key={a.id} article={a} onSaved={onSaved} />
			))}
			{!loading && articles.length === 0 && (
				<p className="ta-muted">{missingOnly ? "🎉 Every published article has a blurb." : "No articles match."}</p>
			)}
			{loading && <p className="ta-muted">Loading…</p>}
			{hasMore && !loading && (
				<button className="ta-btn" onClick={() => void load(pageRef.current + 1, true)}>
					Load more
				</button>
			)}
		</div>
	);
}

export default function BlurbsPage() {
	return (
		<AdminShell title="Blurb manager">
			<BlurbQueue />
		</AdminShell>
	);
}
