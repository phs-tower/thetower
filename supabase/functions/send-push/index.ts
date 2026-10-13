/** @format */

// Tower Console — send-push Edge Function
//
// Relays {title, message, article_id?} to OneSignal. The REST API key is a
// real secret and lives ONLY here:
//   supabase secrets set ONESIGNAL_REST_API_KEY=...
// Deploy:
//   supabase functions deploy send-push
//
// Authorization: the caller's JWT must belong to an email in public.editor.
// The editor check and the push_log insert both run through a client scoped
// to the CALLER's JWT, so RLS does the enforcement — this function holds no
// service-role key.

import { createClient } from "npm:@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = "2297527a-75df-4f38-9241-ebb50e93b268"; // public
const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS, "Content-Type": "application/json" },
	});
}

Deno.serve(async req => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
	if (req.method !== "POST") return json(405, { error: "POST only" });

	const authHeader = req.headers.get("Authorization") ?? "";
	const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
		global: { headers: { Authorization: authHeader } },
		auth: { persistSession: false },
	});

	const { data: userData, error: userError } = await supabase.auth.getUser();
	const email = userData?.user?.email;
	if (userError || !email) return json(401, { error: "not signed in" });

	// RLS on public.editor: a non-editor sees zero rows, including their own.
	const { data: editorRow } = await supabase.from("editor").select("email").eq("email", email).maybeSingle();
	if (!editorRow) return json(403, { error: "not an editor" });

	let payload: { title?: unknown; message?: unknown; article_id?: unknown };
	try {
		payload = await req.json();
	} catch {
		return json(400, { error: "invalid JSON body" });
	}

	const title = typeof payload.title === "string" ? payload.title.trim() : "";
	const message = typeof payload.message === "string" ? payload.message.trim() : "";
	const articleId =
		payload.article_id === undefined || payload.article_id === null || payload.article_id === "" ? null : Number(payload.article_id);
	if (!title || !message) return json(400, { error: "title and message are required" });
	if (articleId !== null && !Number.isInteger(articleId)) return json(400, { error: "article_id must be an integer" });

	const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
	if (!restKey) return json(500, { error: "ONESIGNAL_REST_API_KEY is not configured" });

	const notification: Record<string, unknown> = {
		app_id: ONESIGNAL_APP_ID,
		included_segments: ["Total Subscriptions"],
		headings: { en: title },
		contents: { en: message },
	};
	// The app deep-links articles from additionalData.article_id.
	if (articleId !== null) notification.data = { article_id: articleId };

	const osRes = await fetch("https://api.onesignal.com/notifications", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Key ${restKey}`,
		},
		body: JSON.stringify(notification),
	});
	const osBody = await osRes.json().catch(() => ({}));
	if (!osRes.ok || osBody.errors) {
		return json(502, { error: "OneSignal rejected the send", detail: osBody });
	}

	const { error: logError } = await supabase.from("push_log").insert({
		title,
		message,
		article_id: articleId,
		sent_by: email,
		onesignal_id: typeof osBody.id === "string" ? osBody.id : null,
		recipients: typeof osBody.recipients === "number" ? osBody.recipients : null,
	});

	return json(200, {
		ok: true,
		onesignal_id: osBody.id ?? null,
		recipients: osBody.recipients ?? null,
		log_error: logError?.message ?? null,
	});
});
