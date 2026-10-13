-- ═══════════════════════════════════════════════════════════════════════════
-- COPIED VERBATIM from the app repo (phs-tower/supabase/gamecast.sql) so this
-- repo's record of the schema is complete. The app repo is the source of
-- truth for this file; if it changes there, copy it again. Safe to re-run.
--
-- The console's own write policies and the roster table are in the NEXT
-- migration, 20261012000002_gamecast_console.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- The Tower: Gamecast (play-by-play, team stats, player stats)
--
-- Apply in Supabase Dashboard → SQL Editor, after the broadcast table exists.
-- Safe to re-run. Apply BEFORE shipping an app build that reads `gamecast`:
-- the Live tab selects the new column, and a missing column fails the query.
--
-- ── WHAT THIS IS ───────────────────────────────────────────────────────────
--
-- A switch on a broadcast row that gives the game page a richer view: the
-- situation (quarter, clock, possession, down and distance), a play-by-play
-- feed, team stats and player stats. Off by default, so every game that exists
-- today, and every game added without thinking about it, stays as it was.
-- It is meant for the games the paper staffs properly: homecoming first.
--
-- ── THE APP ONLY DISPLAYS ──────────────────────────────────────────────────
--
-- Every number the app shows is computed by the Tower Console and written
-- here as display-ready text. The app does no football arithmetic: it prints
-- `team_stats` and `player_stats` as tables and `gamecast_play` as a feed.
-- That is deliberate, so the stats can be changed from the console without
-- shipping an app update. The shapes are documented on the columns below and
-- in GAMECAST_CONSOLE_PROMPT.md; the app tolerates missing or extra keys.
--
-- ── ⚠ THIS STORES PLAYERS' NAMES ───────────────────────────────────────────
--
-- README.md says `broadcast` must never hold a roster or player stats, because
-- that puts minors' names on a third-party server. Gamecast does exactly that:
-- play descriptions and player stat rows name players ("#12 J. Smith 8 yd
-- run"). This was a deliberate decision by the app's maintainer, and it is an
-- exception in the same sense as crossword_leaderboard.sql, not a precedent.
-- Keep it to what a newspaper box score prints: a number, a name, and what
-- they did on the field. No grades, ages, photos, contact details or anything
-- else about a player goes in these tables.
--
-- Nothing here is about the READER. No row is written when somebody watches a
-- game, and the app never writes to any of these tables.
--
-- ── WRITES ─────────────────────────────────────────────────────────────────
--
-- SELECT only, for anon and authenticated, like every published-content table.
-- The console adds its own editor-only write policies (gated on is_editor(),
-- the same shape it uses for `form`); no policy here ever grants anon a write.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- The switch
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.broadcast
  add column if not exists gamecast boolean not null default false;

comment on column public.broadcast.gamecast is
  'Whether the app shows the Gamecast view (play-by-play and stats) for this game. Off by default.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The game's current state and its computed stats: one row per game
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gamecast (
  broadcast_id  bigint primary key references public.broadcast (id) on delete cascade,

  -- All display text, formatted by the console. Empty means "do not show".
  period        text not null default '',   -- 'Q2', 'HALF', 'OT', 'FINAL'
  clock         text not null default '',   -- '8:42'
  possession    text check (possession in ('phs', 'opponent')),
  down_distance text not null default '',   -- '3rd & 7'
  ball_on       text not null default '',   -- 'PHS 34'

  -- [{"label": "Total yards", "phs": "312", "opponent": "245"}, ...]
  team_stats    jsonb not null default '[]'::jsonb,

  -- [{"title": "Passing", "columns": ["C/ATT", "YDS", "TD", "INT"],
  --   "rows": [{"team": "phs", "number": 12, "name": "J. Smith",
  --             "values": ["12/18", "164", "2", "0"]}]}, ...]
  player_stats  jsonb not null default '[]'::jsonb,

  -- Bumped by the console and by the trigger below on every play change. The
  -- app subscribes to this row alone and re-reads the plays when it moves.
  updated_at    timestamptz not null default now()
);

comment on column public.gamecast.team_stats is
  'Display-ready team stats: [{label, phs, opponent}] with string values. Written by the console.';
comment on column public.gamecast.player_stats is
  'Display-ready player stats: [{title, columns[], rows[{team, number, name, values[]}]}]. Written by the console.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The play-by-play feed
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gamecast_play (
  id             bigint generated always as identity primary key,
  broadcast_id   bigint not null references public.broadcast (id) on delete cascade,

  period         text not null default '',  -- 'Q1'
  clock          text not null default '',  -- '11:20'
  team           text check (team in ('phs', 'opponent')),

  -- Picks the icon and decides whether the play is highlighted as scoring.
  -- Unknown values display as an ordinary play.
  kind           text not null default 'play' check (kind in (
                   'play', 'touchdown', 'field_goal', 'extra_point',
                   'two_point', 'safety', 'turnover', 'penalty', 'punt',
                   'kickoff', 'timeout', 'period_end', 'note')),

  description    text not null,              -- '#12 J. Smith pass to #4 A. Lee for 23 yds'
  down_distance  text not null default '',   -- '2nd & 4 at PHS 46', as it stood before the play

  -- The score after this play, filled in on scoring plays.
  score_phs      integer,
  score_opponent integer,

  -- Structured play data for the console's own stat computation (yards,
  -- player numbers, result). The app never reads it.
  data           jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now()
);

create index if not exists gamecast_play_feed
  on public.gamecast_play (broadcast_id, id desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Any change to a play touches the game's gamecast row
--
-- The app listens to `gamecast` only. Realtime cannot filter DELETE events by
-- column, so listening to `gamecast_play` directly would miss an editor undoing
-- a play. Touching the parent row covers insert, edit and delete alike, and
-- creates the row if the console has not yet.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_gamecast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := coalesce(new.broadcast_id, old.broadcast_id);
begin
  insert into public.gamecast (broadcast_id) values (v_id)
  on conflict (broadcast_id) do update set updated_at = now();
  return null;
end;
$$;

drop trigger if exists gamecast_play_touch on public.gamecast_play;
create trigger gamecast_play_touch
  after insert or update or delete on public.gamecast_play
  for each row execute function public.touch_gamecast();

-- ─────────────────────────────────────────────────────────────────────────────
-- Reads
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.gamecast      enable row level security;
alter table public.gamecast_play enable row level security;

drop policy if exists "read gamecast" on public.gamecast;
create policy "read gamecast" on public.gamecast
  for select to anon, authenticated using (true);

drop policy if exists "read gamecast_play" on public.gamecast_play;
create policy "read gamecast_play" on public.gamecast_play
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: push the gamecast row the moment it changes
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gamecast'
  ) then
    alter publication supabase_realtime add table public.gamecast;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Editing recipes (until the console has a screen for it)
-- ─────────────────────────────────────────────────────────────────────────────

-- Turn Gamecast on for a game:
--   update public.broadcast set gamecast = true where id = <id>;

-- Add a play:
--   insert into public.gamecast_play (broadcast_id, period, clock, team, kind, description)
--   values (<id>, 'Q1', '9:12', 'phs', 'touchdown', '#22 M. Ortiz 14 yd run');

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify. Run these after applying.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. The switch exists, default false.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'broadcast' and column_name = 'gamecast';

-- 2. No policy here lets the client write. Zero rows (until the console adds
--    its editor-only policies, which must not include anon).
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('gamecast', 'gamecast_play')
  and cmd <> 'SELECT';

-- 3. gamecast is in the realtime publication. One row.
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'gamecast';
