-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — shareable crossword rooms
-- Apply in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- A room is a crossword draft that anyone holding its link can edit, with no
-- sign-in. The link is the credential, so the whole design turns on one rule:
--
--   anon has NO privilege on public.crossword_room at all.
--
-- Every anonymous read and write goes through a SECURITY DEFINER function that
-- demands the room's token. There is deliberately no function that lists rooms
-- or looks one up by anything but its token, so a caller who does not already
-- hold a link cannot discover, enumerate, read or damage any room. The token
-- is 256 bits of randomness from gen_random_uuid(), which is not guessable.
--
-- What a link DOES let its holder do is edit that one draft, and that is the
-- point. Treat a room link like the draft itself: anyone it reaches can change
-- the puzzle. Publishing to public.crossword stays editor-only, unchanged.
--
-- Editors keep ordinary table access so the console can list rooms, re-copy a
-- link and close one; that path runs through is_editor() exactly like the rest
-- of the console.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.crossword_room (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  -- The draft: the last-write-wins document described in
  -- lib/console/crossword-room.ts. Merging is done by the clients.
  doc          jsonb not null default '{}'::jsonb,
  -- Bumped on every accepted save, so a client that saved from a stale read is
  -- told to merge and retry instead of overwriting.
  rev          bigint not null default 0,
  label        text,
  -- The archive row this draft publishes to, when it was opened from one.
  crossword_id bigint,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  closed       boolean not null default false
);

alter table public.crossword_room enable row level security;

-- Anon gets nothing on the table. Supabase grants privileges to anon by
-- default, so this revoke is what actually closes the door; RLS alone would
-- still allow a policy to be added later by mistake.
revoke all on table public.crossword_room from anon;
grant select, update, delete on table public.crossword_room to authenticated;

drop policy if exists "editors manage crossword rooms" on public.crossword_room;
create policy "editors manage crossword rooms" on public.crossword_room
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

create index if not exists crossword_room_updated_at_idx
  on public.crossword_room (updated_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Anonymous access, token only
-- ─────────────────────────────────────────────────────────────────────────────

-- Dropped first rather than replaced: a `create or replace` cannot change a
-- function's return type, so re-running an edited version of this file would
-- fail against an older deployment.
drop function if exists public.crossword_room_open(text);
drop function if exists public.crossword_room_save(text, jsonb, bigint);
drop function if exists public.crossword_room_create(jsonb, text, bigint);

-- Open a room by its link. Returns no row for an unknown token; a closed room
-- returns its state without the draft, so the page can say so plainly.
create or replace function public.crossword_room_open(p_token text)
returns table (id uuid, doc jsonb, rev bigint, label text, closed boolean, crossword_id bigint)
language sql stable security definer set search_path = ''
as $$
  select r.id,
         case when r.closed then '{}'::jsonb else r.doc end,
         r.rev,
         r.label,
         r.closed,
         r.crossword_id
  from public.crossword_room r
  where r.token = p_token;
$$;

-- Save a draft. The caller passes the rev it last saw; a mismatch means
-- somebody else saved first, so the stored doc comes back for the caller to
-- merge and retry rather than being overwritten.
--
-- status: 'saved' | 'conflict' | 'missing' | 'closed' | 'too_large'
create or replace function public.crossword_room_save(p_token text, p_doc jsonb, p_rev bigint)
returns table (status text, doc jsonb, rev bigint)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  room public.crossword_room%rowtype;
begin
  -- A room is one crossword. This is about 50x the largest real draft and is
  -- here so a link that leaks cannot be used to pour data into the database.
  -- A null doc is rejected here too: comparisons against null are null, so an
  -- omitted argument would otherwise fall straight through to the update and
  -- fail on the not-null constraint.
  if p_doc is null or pg_catalog.octet_length(p_doc::text) > 262144 then
    return query select 'too_large'::text, '{}'::jsonb, 0::bigint;
    return;
  end if;

  select * into room from public.crossword_room r where r.token = p_token for update;

  if not found then
    return query select 'missing'::text, '{}'::jsonb, 0::bigint;
    return;
  end if;
  if room.closed then
    return query select 'closed'::text, '{}'::jsonb, room.rev;
    return;
  end if;
  -- `is distinct from` rather than `<>`: a null p_rev must be a conflict, not
  -- a null condition that falls through and overwrites the draft.
  if room.rev is distinct from p_rev then
    return query select 'conflict'::text, room.doc, room.rev;
    return;
  end if;

  -- Aliased because this function's OUT parameters are named `doc` and `rev`;
  -- an unqualified column reference would be ambiguous inside plpgsql.
  update public.crossword_room as cr
     set doc = p_doc, rev = room.rev + 1, updated_at = pg_catalog.now()
   where cr.id = room.id;

  return query select 'saved'::text, p_doc, room.rev + 1;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opening a room, editors only
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.crossword_room_create(p_doc jsonb, p_label text, p_crossword_id bigint)
returns table (id uuid, token text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  new_token text;
begin
  if not public.is_editor() then
    raise exception 'only editors may open a crossword room';
  end if;

  -- 256 bits. Two uuids rather than gen_random_bytes() so this needs no
  -- extension beyond what the database already has.
  new_token := pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')
            || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');

  -- Aliased for the same reason as in _save: `id` and `token` are also this
  -- function's OUT parameter names.
  return query
    insert into public.crossword_room as cr (token, doc, label, crossword_id, created_by)
    values (new_token, coalesce(p_doc, '{}'::jsonb), p_label, p_crossword_id, (select auth.jwt() ->> 'email'))
    returning cr.id, cr.token;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants. The create function is the only one anon must not reach.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.crossword_room_open(text)                      from public, anon, authenticated;
revoke all on function public.crossword_room_save(text, jsonb, bigint)       from public, anon, authenticated;
revoke all on function public.crossword_room_create(jsonb, text, bigint)     from public, anon, authenticated;

grant execute on function public.crossword_room_open(text)                   to anon, authenticated;
grant execute on function public.crossword_room_save(text, jsonb, bigint)    to anon, authenticated;
grant execute on function public.crossword_room_create(jsonb, text, bigint)  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify (run as anon, e.g. from the SQL editor with role set, or just read)
--
-- 1. anon cannot touch the table:
--      set local role anon;
--      select * from public.crossword_room;        -- permission denied
--      reset role;
--
-- 2. anon cannot open a room it has no token for:
--      set local role anon;
--      select * from public.crossword_room_open('not-a-real-token');  -- 0 rows
--      reset role;
--
-- 3. anon cannot open a room:
--      set local role anon;
--      select * from public.crossword_room_create('{}'::jsonb, null, null);
--      -- permission denied for function crossword_room_create
--      reset role;
--
-- 4. a save with a stale rev is refused rather than applied:
--      select status from public.crossword_room_save('<token>', '{}'::jsonb, -1);
--      -- 'conflict'
-- ═══════════════════════════════════════════════════════════════════════════
