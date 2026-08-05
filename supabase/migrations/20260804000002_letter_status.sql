-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — letters inbox: triage status + editor read access
-- The app INSERTs letters (existing policy, untouched). The console adds the
-- read/triage side. Account deletion nulls author_* columns (see the app
-- repo's supabase/delete_account.sql) — the console renders those as
-- "(account deleted)".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.letter
  add column if not exists status text not null default 'new';

do $$ begin
  alter table public.letter
    add constraint letter_status_check check (status in ('new', 'reviewed', 'archived'));
exception when duplicate_object then null;
end $$;

-- Reliable newest-first ordering for the inbox (additive; the app never reads
-- this column). Pre-existing rows all get the migration timestamp — the
-- console falls back to id desc as a tiebreaker.
alter table public.letter
  add column if not exists created_at timestamptz not null default now();

create index if not exists letter_status_idx on public.letter (status);

drop policy if exists "editors read letters" on public.letter;
create policy "editors read letters" on public.letter
  for select to authenticated
  using (public.is_editor());

drop policy if exists "editors triage letters" on public.letter;
create policy "editors triage letters" on public.letter
  for update to authenticated
  using (public.is_editor()) with check (public.is_editor());
