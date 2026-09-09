-- ═══════════════════════════════════════════════════════════════════════════
-- broadcast.show_score — whether the app draws a scoreboard for a game
--
-- ALREADY APPLIED to the live project; this file exists so the repo's record
-- of the schema stays complete. Safe to re-run.
--
-- No RLS change is needed: the existing "editors write broadcast" policy is
-- FOR ALL gated on is_editor(), so it already covers this column.
--
-- Turning the toggle off must NOT clear score_phs / score_opponent. Empty
-- score columns already mean something different ("the game has started and
-- nobody has typed anything in yet"), and a reader cannot tell that from
-- "there is no score to keep".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.broadcast
  add column if not exists show_score boolean not null default true;

comment on column public.broadcast.show_score is
  'Whether the app draws a scoreboard for this game. False shows the video and
   the fixture only; the score columns are ignored, not cleared.';
