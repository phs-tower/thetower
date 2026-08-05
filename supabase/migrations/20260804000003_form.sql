-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — forms manager (app Outreach → "Surveys & Forms")
-- The app and website list ACTIVE forms; editors manage the full set.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.form (
  id          bigint generated always as identity primary key,
  title       text not null,
  description text,
  url         text not null,            -- usually a Google Form link
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.form enable row level security;

drop policy if exists "anyone reads active forms" on public.form;
create policy "anyone reads active forms" on public.form
  for select to anon, authenticated
  using (active);

drop policy if exists "editors write forms" on public.form;
create policy "editors write forms" on public.form
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());
