-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — push notification send log
-- Written by the send-push Edge Function (as the calling editor) after each
-- OneSignal relay; read back in the console's push composer.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.push_log (
  id            bigint generated always as identity primary key,
  title         text not null,
  message       text not null,
  article_id    bigint,                 -- deep-link target, if any
  sent_by       text,                   -- editor email
  onesignal_id  text,                   -- OneSignal notification id
  recipients    int,                    -- OneSignal-reported recipient count
  created_at    timestamptz not null default now()
);
alter table public.push_log enable row level security;

drop policy if exists "editors read push log" on public.push_log;
create policy "editors read push log" on public.push_log
  for select to authenticated
  using (public.is_editor());

drop policy if exists "editors append push log" on public.push_log;
create policy "editors append push log" on public.push_log
  for insert to authenticated
  with check (public.is_editor());
