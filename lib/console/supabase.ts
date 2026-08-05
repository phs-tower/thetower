/** @format */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "~/lib/storage";

// The anon key is public by design — it ships inside the mobile app. RLS is
// the only security boundary; the console gains write access solely because a
// signed-in editor's JWT satisfies public.is_editor() in the write policies.
const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1c2pvdWdtc2RuaGNza3NhZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU1NzI4NzQsImV4cCI6MTk2MTE0ODg3NH0.DHLgiswzK6Y_z5_mXAkRn1xy60zvhdb_iQH5gAyJorg";

let client: SupabaseClient | undefined;

export function consoleSupabase(): SupabaseClient {
	if (!client) {
		client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: false,
				// Distinct key so the console never collides with any other
				// supabase-js session on this origin.
				storageKey: "tower-console-auth",
			},
		});
	}
	return client;
}

export const SEND_PUSH_URL = `${SUPABASE_URL}/functions/v1/send-push`;

export function monthName(month: number) {
	return (
		["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month] ||
		`${month}`
	);
}
