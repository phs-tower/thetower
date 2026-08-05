-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — RLS verification
-- Run in Supabase Dashboard → SQL Editor AFTER applying the migrations.
-- Each block simulates a role; expected results are in the comments.
-- Replace editor@princetonk12.org with an email that IS in public.editor.
-- Every block runs in a transaction and rolls back — nothing is persisted.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── (a) An EDITOR: can read letters, write app_layout, write schedule data ──
begin;
select set_config('request.jwt.claims',
  json_build_object('role', 'authenticated', 'email', 'editor@princetonk12.org')::text, true);
set local role authenticated;

select public.is_editor();                          -- expect: true
select count(*) from public.editor;                 -- expect: >= 1 (can see list)
select count(*) from public.letter;                 -- expect: no error
update public.app_layout set published = published; -- expect: UPDATE n (no error)
insert into public.school_day (day, type_code)      -- expect: INSERT 1
  values ('2099-01-04', (select code from public.day_type limit 1));
insert into public.form (title, url)                -- expect: INSERT 1
  values ('rls-test', 'https://example.com');
rollback;

-- ── (b) A random SCHOOL account (authenticated, NOT in editor) ─────────────
begin;
select set_config('request.jwt.claims',
  json_build_object('role', 'authenticated', 'email', 'student@princetonk12.org')::text, true);
set local role authenticated;

select public.is_editor();                          -- expect: false
select count(*) from public.editor;                 -- expect: 0 (list invisible)
select count(*) from public.letter;                 -- expect: 0 (letters invisible)
select count(*) from public.school_day;             -- expect: > 0 (app read intact)
select count(*) from public.period_time;            -- expect: > 0 (app read intact)
select count(*) from public.form where active;      -- expect: no error (app read)
select count(*) from public.push_log;               -- expect: 0

-- every one of these must FAIL with 42501 (row-level security):
-- update public.article set blurb = 'x' where id = 1;
-- insert into public.school_day (day, type_code) values ('2099-01-05', 'A');
-- insert into public.form (title, url) values ('x', 'https://x');
-- update public.app_layout set published = false;
-- insert into public.map_version (json) values ('{}');
do $$ begin
  begin
    update public.article set blurb = blurb where id in (select id from public.article limit 1);
    if found then raise exception 'FAIL: non-editor updated article'; end if;
  exception when insufficient_privilege then null;  -- also fine
  end;
end $$;                                             -- expect: no rows updated / no error raised
rollback;

-- ── (c) ANON: reads what the app needs, writes nothing ─────────────────────
begin;
set local role anon;

select count(*) from public.article;                -- expect: > 0 (site/app read intact)
select count(*) from public.app_layout;             -- expect: > 0 (app read intact)
select count(*) from public.form where active;      -- expect: no error
select count(*) from public.map_version;            -- expect: only published rows
select count(*) from public.editor;                 -- expect: ERROR or 0 (anon can't call is_editor -> policy fails closed)

-- must FAIL (RLS):
-- insert into public.form (title, url) values ('x', 'https://x');
-- update public.article set blurb = 'x' where id = 1;
rollback;

-- ── (d) Advisors ────────────────────────────────────────────────────────────
-- After running this file, also run Database → Advisors (security) in the
-- dashboard and confirm no NEW findings mention: editor, form, map_version,
-- push_log, is_editor, is_admin, or the console policies.
