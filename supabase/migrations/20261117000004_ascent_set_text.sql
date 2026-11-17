-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: reword an Ascent prompt
--
-- ascent_set_text(prompt, new wording) changes the question readers see.
--
--   * It belongs to the question, not the day: it sets the prompt, its bank
--     prompt (same key) and every copy of it that hasn't opened, so the bank
--     and the days already scheduled never disagree.
--   * Refused once the prompt has opened (unless unlocked for testing):
--     readers answered the old wording. Copies that have opened keep theirs.
--   * Refused if another bank prompt already has that wording, which would
--     make two prompts look the same in the picker.
--
-- The word list doesn't change: if the new wording asks for something
-- different, fix the answers too.
--
-- ⚠ Copy into the app repo's supabase/ascent.sql. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.ascent_set_text(p_prompt_id bigint, p_text text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prompt public.ascent_prompt%rowtype;
  v_text   text := regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g');
begin
  if not public.is_editor() then
    raise exception 'editors only';
  end if;
  select * into v_prompt from public.ascent_prompt where id = p_prompt_id;
  if not found then
    raise exception 'no prompt %', p_prompt_id;
  end if;
  if v_text = '' then
    raise exception 'the question can''t be empty';
  end if;
  if length(v_text) > 300 then
    raise exception 'keep the question under 300 characters';
  end if;
  if v_prompt.day is not null and v_prompt.opens_at <= now() and not v_prompt.unlocked then
    raise exception 'this prompt has opened, so readers answered its wording: reword the bank prompt for next time';
  end if;
  if exists (select 1 from public.ascent_prompt
              where day is null and lower(text) = lower(v_text)
                and key is distinct from v_prompt.key and id <> v_prompt.id) then
    raise exception 'another bank prompt already asks "%"', v_text;
  end if;

  update public.ascent_prompt p
     set text = v_text
   where p.id = v_prompt.id
      or (v_prompt.key is not null
          and p.key = v_prompt.key
          and (p.day is null or p.opens_at > now()));
end;
$function$;

revoke execute on function public.ascent_set_text(bigint, text) from public, anon;
grant  execute on function public.ascent_set_text(bigint, text) to authenticated;

commit;
