/** @format */
import { useEffect, useMemo, useState } from "react";

type SiteRow = { year: number; month: number; visits: number };
type ArticleRow = { article_id: number; title: string; year: number; month: number; visits: number };

export default function VisitsPage() {
	const [site, setSite] = useState<SiteRow[]>([]);
	const [articles, setArticles] = useState<ArticleRow[]>([]);

	useEffect(() => {
		(async () => {
			const res = await fetch("/api/track"); // GET -> returns analytics
			const data = await res.json();
			setSite(data.site ?? []);
			setArticles(data.articles ?? []);
		})();
	}, []);

	// KPI helpers
	const siteTotal = useMemo(() => site.reduce((s, r) => s + (r.visits ?? 0), 0), [site]);
	const siteAvgMonthly = useMemo(() => (site.length ? Math.round(siteTotal / site.length) : 0), [site, siteTotal]);

	const perArticleTotals = useMemo(() => {
		const map = new Map<number, { title: string; total: number }>();
		for (const r of articles) {
			const cur = map.get(r.article_id) ?? { title: r.title, total: 0 };
			cur.total += r.visits ?? 0;
			map.set(r.article_id, cur);
		}
		return Array.from(map.entries())
			.map(([id, v]) => ({ article_id: id, title: v.title, total: v.total }))
			.sort((a, b) => b.total - a.total);
	}, [articles]);

	return (
		<div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
			<h1 style={{ marginBottom: 8 }}>Visits Dashboard</h1>
			<p style={{ marginTop: 0, color: "#666" }}>Site-wide and per-article monthly visits pulled from Supabase.</p>

			<section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, margin: "16px 0 24px" }}>
				<KpiCard label="Total Site Views (All Time)" value={siteTotal} />
				<KpiCard label="Average Monthly Site Views" value={siteAvgMonthly} />
				<KpiCard label="Tracked Months" value={site.length} />
			</section>

			<h2>Site — Monthly Breakdown</h2>
			<Table columns={["Year", "Month", "Visits"]} rows={site.map(r => [r.year, r.month, r.visits])} />

			<h2 style={{ marginTop: 32 }}>Articles — Monthly Breakdown</h2>
			<Table columns={["Title", "Year", "Month", "Visits"]} rows={articles.map(r => [r.title, r.year, r.month, r.visits])} />

			<h2 style={{ marginTop: 32 }}>Articles — Totals (All Time)</h2>
			<Table columns={["Title", "Total Visits"]} rows={perArticleTotals.map(r => [r.title, r.total])} />
		</div>
	);
}

function KpiCard({ label, value }: { label: string; value: number }) {
	return (
		<div style={{ border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
			<div style={{ fontSize: 12, color: "#777" }}>{label}</div>
			<div style={{ fontSize: 24, fontWeight: 700 }}>{value.toLocaleString()}</div>
		</div>
	);
}

function Table({ columns, rows }: { columns: (string | JSX.Element)[]; rows: (string | number | JSX.Element)[][] }) {
	return (
		<div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
			<table style={{ width: "100%", borderCollapse: "collapse" }}>
				<thead>
					<tr>
						{columns.map((c, i) => (
							<th key={i} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee", background: "#fafafa" }}>
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, ri) => (
						<tr key={ri}>
							{row.map((cell, ci) => (
								<td key={ci} style={{ padding: "10px 12px", borderBottom: "1px solid #f2f2f2" }}>
									{typeof cell === "number" ? cell.toLocaleString() : cell}
								</td>
							))}
						</tr>
					))}
					{!rows.length && (
						<tr>
							<td colSpan={columns.length} style={{ padding: 16, textAlign: "center", color: "#888" }}>
								No data yet
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
