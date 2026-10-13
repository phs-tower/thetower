-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — editor allowlist + write policies on existing tables
-- Apply in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Safe to re-run: every policy is dropped before it is created.
--
-- Being AUTHENTICATED is not enough on this project — any student with a
-- school Google account holds a valid JWT. public.editor is the allowlist;
-- an account may write through the console only if its email is a row here.
--
-- NOTE (deviation from the build brief): is_editor() is SECURITY DEFINER, not
-- invoker, and the editor SELECT policy calls it rather than subquerying
-- public.editor directly. A policy on editor that subqueries editor recurses
-- (Postgres 42P17 — the same failure mode the schedule schema documents on
-- enrollment). DEFINER (owner bypasses RLS inside the function) is the
-- standard fix; search_path is pinned to '' so nothing unqualified resolves.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.editor (
  email    text primary key,
  role     text not null default 'editor' check (role in ('admin', 'editor')),
  added_at timestamptz not null default now()
);
alter table public.editor enable row level security;

create or replace function public.is_editor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.editor e
                 where e.email = (auth.jwt() ->> 'email'));
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.editor e
                 where e.email = (auth.jwt() ->> 'email')
                   and e.role = 'admin');
$$;

revoke execute on function public.is_editor() from public, anon;
revoke execute on function public.is_admin()  from public, anon;
grant  execute on function public.is_editor() to authenticated;
grant  execute on function public.is_admin()  to authenticated;

drop policy if exists "editors can see the editor list" on public.editor;
create policy "editors can see the editor list" on public.editor
  for select to authenticated
  using (public.is_editor());

-- Admins may manage the allowlist (also manageable from the dashboard).
drop policy if exists "admins manage the editor list" on public.editor;
create policy "admins manage the editor list" on public.editor
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Console write policies on EXISTING tables. Read policies for the app/site
-- are deliberately untouched. All tables below already have RLS enabled.
-- ─────────────────────────────────────────────────────────────────────────────

-- Front-page layout script: full editor control.
drop policy if exists "editors write app_layout" on public.app_layout;
create policy "editors write app_layout" on public.app_layout
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- Articles: console edits blurbs (and other fields inline) but never
-- creates/deletes — the website's upload flow owns that.
drop policy if exists "editors update article" on public.article;
create policy "editors update article" on public.article
  for update to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- Crosswords and Vanguard spreads: full editor CRUD.
drop policy if exists "editors write crossword" on public.crossword;
create policy "editors write crossword" on public.crossword
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists "editors write spreads" on public.spreads;
create policy "editors write spreads" on public.spreads
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- Schedule reference data: full editor CRUD. The app only ever reads these.
-- (teacher rows are never DELETEd by the console UI — enrollment FKs restrict
-- it — but the policy allows it so admins can remove a just-created typo row.)
drop policy if exists "editors write day_type"    on public.day_type;
drop policy if exists "editors write school_day"  on public.school_day;
drop policy if exists "editors write period_time" on public.period_time;
drop policy if exists "editors write teacher"     on public.teacher;
drop policy if exists "editors write term"        on public.term;
create policy "editors write day_type" on public.day_type
  for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors write school_day" on public.school_day
  for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors write period_time" on public.period_time
  for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors write teacher" on public.teacher
  for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors write term" on public.term
  for all to authenticated using (public.is_editor()) with check (public.is_editor());

-- Seed the first admin (edit the email, then uncomment):
-- insert into public.editor (email, role) values ('someone@princetonk12.org', 'admin')
--   on conflict (email) do update set role = excluded.role;
