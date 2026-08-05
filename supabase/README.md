# The Tower Console — backend setup

The console UI lives at **towerphs.com/admin** and talks to the shared Supabase
project (`yusjougmsdnhcsksadaw`) with the public anon key. **RLS is the only
security boundary** — nothing works (and nothing is exposed) until the
migrations below are applied.

## 1. Apply the migrations (in order)

Dashboard → SQL Editor → paste & run each file in `supabase/migrations/`:

| # | File | What it does |
| - | ---- | ------------ |
| 1 | `20260804000001_console_auth.sql` | `editor` allowlist, `is_editor()` / `is_admin()`, editor write policies on `app_layout`, `article`, `crossword`, `spreads`, and the five schedule tables |
| 2 | `20260804000002_letter_status.sql` | `letter.status` + `created_at`, editor read/triage policies |
| 3 | `20260804000003_form.sql` | `form` table (app Outreach → Surveys & Forms) |
| 4 | `20260804000004_map_version.sql` | `map_version` table (console map page is deferred, table is ready) |
| 5 | `20260804000005_push_log.sql` | `push_log` table |
| 6 | `20260804000006_storage_spreads.sql` | editor storage policies on the private `spreads` bucket |

All are idempotent — safe to re-run. **Note:** `is_editor()` is SECURITY
DEFINER (not invoker as the original brief sketched): a policy on `editor`
that subqueries `editor` recurses (42P17), the same failure mode documented on
`enrollment`. DEFINER with `search_path = ''` is the standard fix.

## 2. Seed the first admin + invite editors

```sql
insert into public.editor (email, role) values ('you@princetonk12.org', 'admin');
```

Then Dashboard → Authentication → Users → **Add user / Invite user** for each
editor (email/password — there is deliberately no self-signup UI). An account
signs into the console only if its email is also a row in `public.editor`.
Do NOT disable global signups (the app's Google sign-in needs them).

## 3. Verify RLS

Run `supabase/verify_console_rls.sql` in the SQL editor and check the expected
results in its comments: an editor can write, a random school account and anon
can read only what the app needs and write nothing. Then run Database →
Advisors (Security) and confirm no new findings on console objects.

## 4. Deploy the push relay (one secret)

```sh
supabase link --project-ref yusjougmsdnhcsksadaw
supabase secrets set ONESIGNAL_REST_API_KEY=<the OneSignal REST API key>
supabase functions deploy send-push
```

The function verifies the caller's JWT email is in `editor`, relays to
OneSignal, and logs to `push_log`. It holds no service-role key.

## 5. What the console can do once live

Dashboard (snow-day/delay quick action + push), Blurbs, Letters, App layout,
Schedule (calendar paint + generate-year, bell schedules, teachers, terms),
Forms, Crosswords, Vanguard spreads, Push composer.

`profile` and `enrollment` are untouched and must stay that way — student
schedule data never appears in the console (see the app's privacy policy).
