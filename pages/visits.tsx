/** @format */
import { Fragment, useEffect, useMemo, useState } from "react";
import { months } from "~/lib/constants";

type SiteRow = { year: number; month: number; visits: number };
const CURRENT_YEAR = new Date().getFullYear();

export default function VisitsPage() {
	const [site, setSite] = useState<SiteRow[]>([]);

	useEffect(() => {
		(async () => {
			const res = await fetch("/api/track"); // GET -> returns analytics
			const data = await res.json();
			setSite(data.site ?? []);
		})();
	}, []);

	const siteTotal = useMemo(() => site.reduce((s, r) => s + (r.visits ?? 0), 0), [site]);
	const siteAvgMonthly = useMemo(() => (site.length ? Math.round(siteTotal / site.length) : 0), [site, siteTotal]);
	const siteByRecent = useMemo(() => [...site].sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month)), [site]);
	const yearlyBreakdown = useMemo(() => {
		const groups = new Map<number, SiteRow[]>();
		for (const row of siteByRecent) {
			const current = groups.get(row.year) ?? [];
			current.push(row);
			groups.set(row.year, current);
		}
		return Array.from(groups.entries()).map(([year, rows]) => {
			const total = rows.reduce((sum, r) => sum + (r.visits ?? 0), 0);
			const avg = rows.length ? Math.round(total / rows.length) : 0;
			return { year, rows, total, avg, isCurrentYear: year === CURRENT_YEAR };
		});
	}, [siteByRecent]);

	return (
		<div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
			<h1 style={{ marginBottom: 8 }}>Visits Dashboard</h1>
			<p style={{ marginTop: 0, color: "#666" }}>Site-wide monthly visits pulled from Supabase.</p>

			<section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, margin: "16px 0 24px" }}>
				<KpiCard label="Total Site Views (All Time)" value={siteTotal} />
				<KpiCard label="Average Monthly Site Views" value={siteAvgMonthly} />
				<KpiCard label="Tracked Months" value={site.length} />
			</section>

			<h2>Site - Monthly Breakdown</h2>
			<YearlyTable yearlyBreakdown={yearlyBreakdown} />
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

type YearGroup = { year: number; rows: SiteRow[]; total: number; avg: number; isCurrentYear: boolean };

function YearlyTable({ yearlyBreakdown }: { yearlyBreakdown: YearGroup[] }) {
	return (
		<div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
			<table style={{ width: "100%", borderCollapse: "collapse" }}>
				<thead>
					<tr>
						{["Year", "Month", "Visits"].map((c, i) => (
							<th key={i} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee", background: "#fafafa" }}>
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{yearlyBreakdown.map((group, gi) => (
						<Fragment key={group.year}>
							{!group.isCurrentYear && (
								<tr key={`${group.year}-summary`} style={{ background: "#fafcff" }}>
									<td style={{ padding: "10px 12px", borderTop: "1px solid #e7edf5", fontWeight: 700 }}>
										{group.year.toLocaleString()} Summary
									</td>
									<td style={{ padding: "10px 12px", borderTop: "1px solid #e7edf5" }}>Avg: {group.avg.toLocaleString()}</td>
									<td style={{ padding: "10px 12px", borderTop: "1px solid #e7edf5", fontWeight: 700 }}>
										Total: {group.total.toLocaleString()}
									</td>
								</tr>
							)}
							{group.rows.map((row, ri) => (
								<tr key={`${group.year}-${ri}`}>
									<td style={{ padding: "10px 12px", borderBottom: "1px solid #f2f2f2" }}>{row.year.toLocaleString()}</td>
									<td style={{ padding: "10px 12px", borderBottom: "1px solid #f2f2f2" }}>
										{months[row.month] ?? `Month ${row.month}`}
									</td>
									<td style={{ padding: "10px 12px", borderBottom: "1px solid #f2f2f2" }}>{row.visits.toLocaleString()}</td>
								</tr>
							))}
							{gi < yearlyBreakdown.length - 1 && (
								<tr key={`${group.year}-divider`}>
									<td colSpan={3} style={{ padding: 0, borderTop: "3px solid #d7dce3" }} />
								</tr>
							)}
						</Fragment>
					))}
					{!yearlyBreakdown.length && (
						<tr>
							<td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#888" }}>
								No data yet
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
