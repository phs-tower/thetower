/** @format */

// pages/api/track.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// derive https://<ref>.supabase.co from the SERVICE_ROLE token
function supabaseUrlFromServiceRole(serviceRole?: string) {
	if (!serviceRole) throw new Error("Missing SERVICE_ROLE env");
	const parts = serviceRole.split(".");
	if (parts.length < 2) throw new Error("Invalid SERVICE_ROLE token");
	const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { ref?: string };
	if (!payload.ref) throw new Error("SERVICE_ROLE token missing 'ref'");
	return `https://${payload.ref}.supabase.co`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	try {
		const SERVICE_ROLE = process.env.SERVICE_ROLE!;
		const supabase = createClient(supabaseUrlFromServiceRole(SERVICE_ROLE), SERVICE_ROLE);

		if (req.method === "POST") {
			// increment site and article visits
			const { articleId } = (req.body || {}) as { articleId?: number };
			const now = new Date();
			const p_year = now.getFullYear();
			const p_month = now.getMonth() + 1;

			const { error: siteErr } = await supabase.rpc("increment_site_visit", { p_year, p_month });
			if (siteErr) throw siteErr;

			if (articleId) {
				const { error: artErr } = await supabase.rpc("increment_article_visit", {
					p_article_id: articleId,
					p_year,
					p_month,
				});
				if (artErr) throw artErr;
			}

			return res.status(204).end();
		}

		if (req.method === "GET") {
			// return analytics data
			const { data: site, error: siteErr } = await supabase
				.from("site_analytics")
				.select("year, month, visits")
				.order("year", { ascending: true })
				.order("month", { ascending: true });
			if (siteErr) throw siteErr;

			const { data: articleRows, error: aaErr } = await supabase
				.from("article_analytics")
				.select("article_id, year, month, visits")
				.order("year", { ascending: true })
				.order("month", { ascending: true });
			if (aaErr) throw aaErr;

			const ids = Array.from(new Set((articleRows ?? []).map(r => r.article_id)));
			let titles: Record<number, string> = {};
			if (ids.length) {
				const { data: articles, error: artErr } = await supabase.from("article").select("id, title").in("id", ids);
				if (artErr) throw artErr;
				titles = Object.fromEntries((articles ?? []).map(a => [a.id, a.title]));
			}

			const articles = (articleRows ?? []).map(r => ({
				...r,
				title: titles[r.article_id] ?? `Article ${r.article_id}`,
			}));

			return res.status(200).json({ site: site ?? [], articles });
		}

		res.setHeader("Allow", ["GET", "POST"]);
		res.status(405).end(`Method ${req.method} Not Allowed`);
	} catch (e: any) {
		console.error("TRACK/ANALYTICS_API_ERROR", e?.message || e);
		res.status(500).json({ error: String(e?.message || e) });
	}
}
