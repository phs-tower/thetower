-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: how close a reader's answer must be for the AI to suggest one
--
-- ascent_nearest suggested an answer only at similarity >= 0.88 with a lead of
-- 0.03 over the runner-up. On wordy or vague prompts that is too strict: of
-- the live answer lists' own aliases, a quarter sit below 0.88 from their
-- canonical name. Different answers in one prompt sit at a median of 0.76 and
-- nine in ten below 0.82, which is why no level goes under 0.82.
--
--   level       similarity  lead
--   strict      0.92        0.04
--   normal      0.88        0.03   (what every prompt had before; the default)
--   loose       0.85        0.03
--   very_loose  0.82        0.025
--
-- It belongs to the question, not the day: ascent_set_leniency sets the
-- prompt, its bank prompt and every copy of it that hasn't closed, and
-- ascent_schedule copies it from the bank. It never changes a score, only
-- which "Did you mean …?" a reader is offered, so a closed prompt may change.
--
-- ⚠ Copy into the app repo's supabase/ascent.sql: re-running that file as it
-- stands would put ascent_nearest and ascent_schedule back without this.
-- Apply after 20261116000001_ascent_nearest_editor.sql. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.ascent_prompt
  add column if not exists ai_leniency text not null default 'normal';

alter table public.ascent_prompt drop constraint if exists ascent_prompt_ai_leniency_check;
alter table public.ascent_prompt
  add constraint ascent_prompt_ai_leniency_check
  check (ai_leniency in ('strict', 'normal', 'loose', 'very_loose'));

-- ─── ascent_nearest: read the prompt's level ───────────────────────────────

create or replace function public.ascent_nearest(
  p_prompt_id  bigint,
  p_embedding  extensions.vector,
  p_tester_key text    default null,
  p_editor     boolean default false
)
returns jsonb
language sql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  with sims as (
    select f.answer_id, max(1 - (e.embedding <=> p_embedding)) as sim
      from public.ascent_forms(p_prompt_id) f
      join public.ascent_embedding e on e.norm = f.norm
     group by f.answer_id
  ), ranked as (
    select s.*, row_number() over (order by s.sim desc) as rn from sims s
  ), best as (
    select r.sim,
           r.sim - coalesce((select sim from ranked where rn = 2), 0) as lead,
           a.canonical
      from ranked r join public.ascent_answer a on a.id = r.answer_id
     where r.rn = 1
  ), bar as (
    select case p.ai_leniency
             when 'strict'     then 0.92
             when 'loose'      then 0.85
             when 'very_loose' then 0.82
             else 0.88
           end as min_sim,
           case p.ai_leniency
             when 'strict'     then 0.04
             when 'very_loose' then 0.025
             else 0.03
           end as min_lead
      from public.ascent_prompt p where p.id = p_prompt_id
  )
  select case
           when not p_editor
            and not exists (select 1 from public.ascent_prompt p
                             where p.id = p_prompt_id and p.published
                               and (p.opens_at <= now() or public.ascent_is_tester(p_tester_key)))
             then '{}'::jsonb
           else coalesce((select jsonb_build_object(
                    'suggest', case when b.sim >= bar.min_sim and b.lead >= bar.min_lead then b.canonical end,
                    'similarity', round(b.sim::numeric, 3),
                    'lead', round(b.lead::numeric, 3))
                  from best b, bar), '{}')
         end;
$function$;

revoke execute on function public.ascent_nearest(bigint, extensions.vector, text, boolean) from public, anon, authenticated;
grant  execute on function public.ascent_nearest(bigint, extensions.vector, text, boolean) to service_role;

-- ─── ascent_set_leniency: editors set it from the console ──────────────────

create or replace function public.ascent_set_leniency(p_prompt_id bigint, p_level text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_key text;
begin
  if not public.is_editor() then
    raise exception 'editors only';
  end if;
  if p_level not in ('strict', 'normal', 'loose', 'very_loose') then
    raise exception 'unknown leniency %', p_level;
  end if;
  select key into v_key from public.ascent_prompt where id = p_prompt_id;
  if not found then
    raise exception 'no prompt %', p_prompt_id;
  end if;
  update public.ascent_prompt
     set ai_leniency = p_level
   where id = p_prompt_id
      or (v_key is not null and key = v_key
          and (day is null or closes_at is null or now() < closes_at));
end;
$function$;

revoke execute on function public.ascent_set_leniency(bigint, text) from public, anon;
grant  execute on function public.ascent_set_leniency(bigint, text) to authenticated;

-- ─── ascent_schedule: copy the level from the bank ─────────────────────────
-- Unchanged apart from ai_leniency in the insert.

create or replace function public.ascent_schedule(p_key text, p_day date)
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
     true, v_bank.key, v_bank.family, v_bank.wiki_weight, v_bank.ai_leniency)
  returning id into v_id;

  insert into public.ascent_answer
    (prompt_id, canonical, aliases, article_id, term, tower_mentions, wiki_hits, manual_prior)
  select v_id, canonical, aliases, article_id, term, tower_mentions, wiki_hits, manual_prior
    from public.ascent_answer where prompt_id = v_bank.id;

  return v_id;
end;
$function$;

commit;
