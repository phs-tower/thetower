-- ═══════════════════════════════════════════════════════════════════════════
-- Gamecast: let a game with plays be deleted
--
-- Apply AFTER 20261012000001_gamecast.sql. Safe to re-run.
--
-- THE BUG. Deleting a broadcast cascades to its gamecast_play rows, and each
-- of those deletes fires touch_gamecast(), which inserts a gamecast row for
-- the game "if needed". By then the broadcast row is already gone, so that
-- insert violates gamecast.broadcast_id's foreign key (23503) and Postgres
-- aborts the whole delete. Result: any game with even one play could not be
-- deleted, from the console or the dashboard.
--
-- THE FIX. Same function, plus one guard: if the game no longer exists there
-- is nothing to touch, so do nothing. The cascade's foreign-key check sees
-- the parent row as deleted, and so does this query, in the same statement.
-- Everything else (insert, edit and delete of single plays, which is what
-- the app listens for) behaves exactly as before.
--
-- The app repo's supabase/gamecast.sql has the same function and needs the
-- same guard, or re-running that file would bring the bug back. That file is
-- the app maintainer's to change; this migration only replaces the function.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.touch_gamecast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := coalesce(new.broadcast_id, old.broadcast_id);
begin
  -- The game itself is being deleted (the cascade from broadcast): there is
  -- no gamecast row to touch, and creating one would violate its foreign key.
  if not exists (select 1 from public.broadcast where id = v_id) then
    return null;
  end if;

  insert into public.gamecast (broadcast_id) values (v_id)
  on conflict (broadcast_id) do update set updated_at = now();
  return null;
end;
$$;

-- Verify. Creates an unpublished test game with one play, deletes it, and
-- then raises an error on purpose so the whole block rolls back and nothing
-- is kept. Expect the message "OK: a game with plays deletes cleanly".
-- Any other error means the fix did not take.
do $$
declare
  v_id bigint;
begin
  insert into public.broadcast (sport, level, opponent, home, venue, starts_at, status, youtube_id, note, published, show_score)
    values ('Football', 'Boys Varsity', 'DELETE TEST', true, '', now(), 'scheduled', null, 'TEST', false, true)
    returning id into v_id;
  insert into public.gamecast_play (broadcast_id, description) values (v_id, 'test');
  delete from public.broadcast where id = v_id;
  if exists (select 1 from public.gamecast where broadcast_id = v_id)
     or exists (select 1 from public.gamecast_play where broadcast_id = v_id) then
    raise exception 'FAIL: rows were left behind';
  end if;
  raise exception 'OK: a game with plays deletes cleanly (rolled back, nothing kept)';
end $$;
