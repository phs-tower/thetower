-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — school map versions
-- The console's map editor saves versions here; the app will fetch the single
-- PUBLISHED row. Exactly one published version is enforced by a partial
-- unique index (publish = transactionally unpublish-then-publish in the UI).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.map_version (
  id         bigint generated always as identity primary key,
  json       jsonb not null,
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  published  boolean not null default false
);
alter table public.map_version enable row level security;

create unique index if not exists map_version_one_published
  on public.map_version (published) where published;

-- The app (and site) read only the published map.
drop policy if exists "anyone reads the published map" on public.map_version;
create policy "anyone reads the published map" on public.map_version
  for select to anon, authenticated
  using (published);

drop policy if exists "editors write map versions" on public.map_version;
create policy "editors write map versions" on public.map_version
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());
