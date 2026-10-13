-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: Gamecast write policies + per-game rosters
--
-- Apply AFTER 20261012000001_gamecast.sql (the app's schema). Safe to re-run:
-- every policy is dropped before it is created.
--
-- ── WHO MAY WRITE ──────────────────────────────────────────────────────────
--
-- Editors only, gated on public.is_editor(), in the same FOR ALL shape the
-- console uses for `form`. NOTHING here grants anon anything, and nothing is
-- gated on merely being authenticated: app users sign in with tokens that are
-- `authenticated` but carry no email, so is_editor() is false for them, and
-- that is the whole of what keeps them out. The SELECT policies for readers
-- come from the app's migration and are not touched here.
--
-- ── ROSTERS ────────────────────────────────────────────────────────────────
--
-- Console-only: the app never reads gamecast_roster, so it has no reader
-- policy at all. It is per game rather than per season because the opponent
-- changes every week and PHS's numbers can too; the console copies the PHS
-- roster forward from an earlier game so nobody types it twice.
--
-- Box-score sized, deliberately: a number, the name as it prints ('J. Smith')
-- and a position. Names on this server are the documented exception in the
-- header of gamecast.sql, not a precedent. No photos, grades, ages, contact
-- details or anything else about a player belongs in this table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Editor writes on the app's two tables
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "editors write gamecast" on public.gamecast;
create policy "editors write gamecast" on public.gamecast
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists "editors write gamecast_play" on public.gamecast_play;
create policy "editors write gamecast_play" on public.gamecast_play
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- ─────────────────────────────────────────────────────────────────────────────
-- Rosters
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gamecast_roster (
  broadcast_id bigint  not null references public.broadcast (id) on delete cascade,
  team         text    not null check (team in ('phs', 'opponent')),
  number       integer not null check (number between 0 and 99),
  name         text    not null,   -- as it should print: 'J. Smith'
  position     text    not null default '',
  primary key (broadcast_id, team, number)
);
alter table public.gamecast_roster enable row level security;

-- SELECT is editor-only too: the app has no business reading this table.
drop policy if exists "editors manage gamecast_roster" on public.gamecast_roster;
create policy "editors manage gamecast_roster" on public.gamecast_roster
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify. Run these after applying.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. "Nothing writable from the client." Every non-SELECT policy on these
--    tables must be one of the three above: roles {authenticated}, and the
--    qual / with_check both public.is_editor(). Any row naming anon, public,
--    or a qual of `true` is a hole.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('gamecast', 'gamecast_play', 'gamecast_roster')
  and cmd <> 'SELECT'
order by tablename, policyname;

-- 2. Same check, phrased as a failure: zero rows.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('gamecast', 'gamecast_play', 'gamecast_roster')
  and cmd <> 'SELECT'
  and ('anon' = any (roles) or 'public' = any (roles)
       or coalesce(qual, '') not like '%is_editor()%'
       or coalesce(with_check, '') not like '%is_editor()%');

-- 3. The roster is invisible to anon (expect: ERROR or 0; anon cannot call
--    is_editor(), so the policy fails closed).
-- begin; set local role anon; select count(*) from public.gamecast_roster; rollback;
