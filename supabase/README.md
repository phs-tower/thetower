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
| 7 | `20260908000001_broadcast_show_score.sql` | `broadcast.show_score` (already applied to the live project) |
| 8 | `20261012000001_gamecast.sql` | **Copied from the app repo** (`supabase/gamecast.sql`): `broadcast.gamecast`, the `gamecast` and `gamecast_play` tables, the touch trigger, reader SELECT policies, realtime |
| 9 | `20261012000002_gamecast_console.sql` | editor-only write policies on `gamecast` / `gamecast_play`, and the console-only `gamecast_roster` table |
| 10 | `20261012000003_gamecast_delete_fix.sql` | fixes the touch trigger so a game with plays can be deleted (the cascade used to violate a foreign key) |
| 11 | `20261116000001_ascent_nearest_editor.sql` | `ascent_nearest(…, p_editor)` so the console's "Test an answer" box gets AI suggestions on prompts that haven't opened (already applied to the live project). Needs the `ascent-suggest` in the app repo that passes `p_editor` |
| 12 | `20261116000002_ascent_ai_leniency.sql` | `ascent_prompt.ai_leniency` (strict / normal / loose / very_loose), read by `ascent_nearest` and copied by `ascent_schedule`, plus `ascent_set_leniency` for the console (already applied to the live project). Copy into the app repo's `supabase/ascent.sql` |
| 13 | `20261116000003_crossword_room.sql` | `crossword_room` + the three token functions behind the shareable crossword builder |
| 14 | `20261117000001_ascent_rename_answer.sql` | `ascent_rename_answer` for the console's "rename" on a word-list row: the old name becomes an alias, and the bank prompt and unclosed copies follow (already applied to the live project). Copy into the app repo's `supabase/ascent.sql` |
| 15 | `20261117000002_ascent_more_families.sql` | Ascent families `nj`, `princeton`, `reading`, `courses`, each with its own one-a-day / four-a-week allowance; moves the bank prompts out of `archive` (already applied to the live project). Copy into the app repo's `supabase/ascent.sql` |
| 16 | `20261117000003_ascent_nine_families.sql` | Ascent families `arts`, `college`, `people`, `events`, `science`, `history`, `culture`, `world`, `seasonal`, and `ascent_seed_prompt` for the bank seeds below. Copy into the app repo's `supabase/ascent.sql` |
| 17 | `20261117000004_ascent_set_text.sql` | `ascent_set_text` for the word list's "Reword": changes a prompt's question on the bank prompt and every copy that hasn't opened. Copy into the app repo's `supabase/ascent.sql` |

Then, for The Ascent's bank, run each file in `supabase/seed/ascent-bank/`
(109 prompts with word lists; any already in the bank are skipped), then
press **Fill missing Wikipedia counts** on the console's Ascent → Bank tab. To
add more, edit the lists in `generate.py` there and re-run it.

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

## 6. Shared crossword rooms — the one anonymous write path

Migration 13 adds the only place on this project where someone with **no
account** can write. It is worth understanding before you hand a link out.

An editor opens a room from **Crosswords → Open a shared room**. That mints a
256-bit token and gives back `towerphs.com/crossword/build/<token>`. Anyone
holding that URL can edit that one draft, live, without signing in.

What keeps it contained:

- **`anon` has no privilege on `crossword_room` at all** (`revoke all`), so the
  table cannot be read, listed or written directly.
- Every anonymous call goes through a `SECURITY DEFINER` function that requires
  the token. There is deliberately **no function that lists rooms or finds one
  by anything but its token**, so a caller without a link cannot discover one.
- `crossword_room_create` checks `is_editor()` and is granted only to
  `authenticated`. Guests join rooms; they cannot open them.
- Publishing to `public.crossword` is unchanged and still editor-only. A guest
  builds the puzzle; an editor puts it on the site.
- Saves are size-capped and `rev`-checked, so a leaked link cannot be used to
  fill the database or to clobber a draft from stale state.

What it does **not** do is authenticate the person at the other end. The link
is the credential: whoever receives it, including whoever it gets forwarded to,
can edit that puzzle. Close the room from the console when the puzzle is done,
which makes the link inert.
