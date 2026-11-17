-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: let editors see Ascent's AI suggestions on any prompt
--
-- ascent_nearest (the app's, supabase/ascent.sql) answers "Did you mean …?"
-- only for a published prompt that has opened, or for a tester key, so that
-- nobody can fish the answers out of a prompt before it runs. The console's
-- "Test an answer" box is used on bank prompts and on prompts that have not
-- opened, which is exactly where that check made it silent.
--
-- p_editor skips the check. It is safe to take on trust because only
-- service_role may execute this function: the ascent-suggest edge function is
-- the one caller, and it passes true only after is_editor() returned true
-- under the caller's own JWT. The grants below are what keeps it that way.
--
-- Apply BEFORE deploying the ascent-suggest that sends p_editor. The old
-- function's calls still work against this one (p_editor defaults to false).
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

drop function if exists public.ascent_nearest(bigint, extensions.vector, text);

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
  )
  select case
           when not p_editor
            and not exists (select 1 from public.ascent_prompt p
                             where p.id = p_prompt_id and p.published
                               and (p.opens_at <= now() or public.ascent_is_tester(p_tester_key)))
             then '{}'::jsonb
           else coalesce((select jsonb_build_object(
                    'suggest', case when b.sim >= 0.88 and b.lead >= 0.03 then b.canonical end,
                    'similarity', round(b.sim::numeric, 3),
                    'lead', round(b.lead::numeric, 3))
                  from best b), '{}')
         end;
$function$;

revoke execute on function public.ascent_nearest(bigint, extensions.vector, text, boolean) from public, anon, authenticated;
grant  execute on function public.ascent_nearest(bigint, extensions.vector, text, boolean) to service_role;

commit;
