-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: rename an Ascent answer
--
-- ascent_rename_answer(answer, new name) changes an answer's canonical name:
-- what the board shows and what a "Did you mean …?" offers.
--
--   * The old name becomes an alias, so a reader who types it still matches.
--     A capitalization-only change (same ascent_normalize) adds no alias.
--   * Like ascent_add_alias it reaches the answer's twin in the bank, and
--     also its copies that haven't closed, so a scheduled day and the bank
--     never disagree on a name. A twin whose prompt already has the new name
--     on another answer is skipped rather than failing the whole rename.
--   * tower_mentions is recounted for the new name unless a search term
--     overrides it. The console then refetches the Wikipedia count.
--   * Refused on a closed prompt (unless unlocked for testing): recounting
--     mentions would move its final scores. Rename it on the bank prompt.
--
-- ⚠ Copy into the app repo's supabase/ascent.sql. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ascent_rename_answer(p_answer_id bigint, p_canonical text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_answer public.ascent_answer%rowtype;
  v_prompt public.ascent_prompt%rowtype;
  v_new    text := trim(p_canonical);
  v_norm   text := public.ascent_normalize(p_canonical);
begin
  if not public.is_editor() then
    raise exception 'editors only';
  end if;
  select * into v_answer from public.ascent_answer where id = p_answer_id;
  if not found then
    raise exception 'no answer %', p_answer_id;
  end if;
  select * into v_prompt from public.ascent_prompt where id = v_answer.prompt_id;
  if v_prompt.closes_at <= now() and not v_prompt.unlocked then
    raise exception 'that prompt has closed, so its answers are final: rename it on the bank prompt';
  end if;
  if v_norm is null then
    raise exception 'empty name';
  end if;
  if v_new = v_answer.canonical then
    return;
  end if;
  if public.ascent_claimed(v_answer.prompt_id, v_norm, v_answer.id) then
    raise exception '"%" already matches another answer', v_new;
  end if;

  update public.ascent_answer a
     set canonical = v_new,
         aliases = case
                     when v_norm = a.canonical_norm then a.aliases
                     else array_append(
                            array(select x from unnest(a.aliases) x
                                   where public.ascent_normalize(x) is distinct from v_norm),
                            a.canonical)
                   end,
         tower_mentions = case when a.term is null then public.ascent_mentions(v_new)
                               else a.tower_mentions end
    from public.ascent_prompt p
   where p.id = a.prompt_id
     and (a.id = v_answer.id
          or (p.key = v_prompt.key
              and a.canonical_norm = v_answer.canonical_norm
              and (p.day is null or p.closes_at is null or now() < p.closes_at)
              and not public.ascent_claimed(a.prompt_id, v_norm, a.id)));
end;
$function$;

revoke execute on function public.ascent_rename_answer(bigint, text) from public, anon;
grant  execute on function public.ascent_rename_answer(bigint, text) to authenticated;
