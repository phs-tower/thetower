-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: The Ascent's test week
--
-- A sandbox week, Monday 2099-01-05 to Sunday 2099-01-11, where editors
-- schedule prompts to try them out: seven days, two slots each, weekends
-- included. The console's "Test week" tab shows it.
--
-- Readers never see it. ascent_schedule_test makes the same copy
-- ascent_schedule does (text, family, weights, leniency, word list) but
-- unpublished, and readers can only read published prompts that have opened
-- ("read opened prompts"); ascent_submit, ascent_reveal, ascent_preview and
-- ascent_tester_week all ask for published too. 2099 also never opens.
--
-- The rules are the real ones: it asks ascent_bank, so a day still takes two
-- different families and a week at most four of one.
--
-- ascent_bank's last_ran now counts published copies only, so trying a prompt
-- in 2099 doesn't make the bank say it last ran in 2099. Everything else in
-- ascent_bank is unchanged.
--
-- TEST_WEEK in lib/console/ascent.ts must name the same Monday.
--
-- ⚠ Copy into the app repo's supabase/ascent.sql. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.ascent_test_monday()
returns date
language sql immutable as $fn$ select date '2099-01-05' $fn$;

grant execute on function public.ascent_test_monday() to authenticated;

-- ─── ascent_bank: last_ran from published copies only ──────────────────────

create or replace function public.ascent_bank(p_day date)
returns table (key text, family text, text text, last_ran date, blocked text)
language sql stable security definer set search_path = public, pg_temp as $fn$
  select b.key, b.family, b.text,
         (select max(c.day) from public.ascent_prompt c where c.key = b.key and c.published),
         case
           -- No cooldown for now: a prompt may run again whenever, and
           -- last_ran is there so the Console can show when it last did.
           when exists (select 1 from public.ascent_prompt c
                         where c.family = b.family and c.day = p_day)
             then 'already a ' || b.family || ' prompt that day'
           when (select count(*) from public.ascent_prompt c
                  where c.family = b.family and c.day is not null
                    and date_trunc('week', c.day) = date_trunc('week', p_day)) >= 4
             then 'four ' || b.family || ' prompts already that week'
         end
    from public.ascent_prompt b
   where b.day is null and public.is_editor()
   order by b.family, b.key;
$fn$;

-- ─── ascent_schedule_test: an unpublished copy in the test week ────────────
-- ascent_schedule, but published = false and only for the test week.

create or replace function public.ascent_schedule_test(p_key text, p_day date)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_bank    public.ascent_prompt%rowtype;
  v_blocked text;
  v_opens   timestamptz := (p_day + time '07:00') at time zone 'America/New_York';
  v_slot    smallint;
  v_id      bigint;
begin
  if not public.is_editor() then
    raise exception 'editors only';
  end if;
  if p_day not between public.ascent_test_monday() and public.ascent_test_monday() + 6 then
    raise exception '% is not in the test week', p_day;
  end if;

  select * into v_bank from public.ascent_prompt where key = p_key and day is null;
  if not found then
    raise exception 'no bank prompt %', p_key;
  end if;
  select s into v_slot
    from unnest(array[1, 2]::smallint[]) s
   where not exists (select 1 from public.ascent_prompt where day = p_day and slot = s)
   order by s limit 1;
  if v_slot is null then
    raise exception '% already has two prompts', p_day;
  end if;
  select blocked into v_blocked from public.ascent_bank(p_day) where key = p_key;
  if v_blocked is not null then
    raise exception '% cannot run on %: %', p_key, p_day, v_blocked;
  end if;

  insert into public.ascent_prompt
    (day, slot, opens_at, closes_at, text, scope_note, published, key, family,
     wiki_weight, ai_leniency)
  values
    (p_day, v_slot, v_opens, v_opens + interval '1 day', v_bank.text, v_bank.scope_note,
     false, v_bank.key, v_bank.family, v_bank.wiki_weight, v_bank.ai_leniency)
  returning id into v_id;

  insert into public.ascent_answer
    (prompt_id, canonical, aliases, article_id, term, tower_mentions, wiki_hits, manual_prior)
  select v_id, canonical, aliases, article_id, term, tower_mentions, wiki_hits, manual_prior
    from public.ascent_answer where prompt_id = v_bank.id;

  return v_id;
end;
$function$;

revoke execute on function public.ascent_schedule_test(text, date) from public, anon;
grant  execute on function public.ascent_schedule_test(text, date) to authenticated;

commit;
