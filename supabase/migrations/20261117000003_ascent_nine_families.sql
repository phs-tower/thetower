-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: nine more Ascent families
--
-- Room for the bank to grow toward 150 prompts. Each family gets the same
-- one-a-day / four-a-week allowance in ascent_bank as the others; the rules
-- themselves don't change.
--
--   arts      music, theater and visual art
--   college   colleges, conferences and majors
--   people    famous Princetonians and other people readers can name
--   events    PHS traditions and the school calendar
--   science   elements, the body, space, computing
--   history   presidents, wars, monarchs, court cases
--   culture   films, music, games, apps, food brands
--   world     countries, cities, languages, geography
--   seasonal  prompts meant for one time of year (schedule them then)
--
-- Also ascent_seed_prompt, which the seed files in supabase/seed/ascent-bank/
-- use to add the prompts themselves. Run those after this.
-- The console's FAMILIES (lib/console/ascent.ts) and $asc-families
-- (styles/admin.scss) list the same names.
--
-- ⚠ Copy into the app repo's supabase/ascent.sql, and check the app shows a
-- family it doesn't know before one of these is published. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.ascent_prompt drop constraint if exists ascent_prompt_family_check;
alter table public.ascent_prompt
  add constraint ascent_prompt_family_check
  check (family in ('club', 'sport', 'archive', 'nj', 'princeton', 'reading', 'courses',
                    'arts', 'college', 'people', 'events', 'science', 'history',
                    'culture', 'world', 'seasonal'));

-- ascent_seed_prompt(key, family, text, wiki share, answers) adds one bank
-- prompt with its word list, for the seed files. Each answer is
-- 'Canonical' or 'Canonical|alias|alias'. Answers go through
-- ascent_add_answer and ascent_add_alias, so names are normalized and Tower
-- mentions counted exactly as the console's "Add answer" does. Wikipedia
-- counts are not: fetch them from each prompt's word list in the console.
-- A prompt whose key or text is already in the bank is skipped, so a seed
-- file can be re-run; an answer that fails (a duplicate, say) is reported
-- and the rest still go in. Returns the new prompt's id, or null if skipped.
create or replace function public.ascent_seed_prompt(
  p_key text, p_family text, p_text text, p_wiki numeric, p_answers text[])
returns bigint
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id    bigint;
  v_entry text;
  v_names text[];
  v_answer bigint;
  v_alias text;
begin
  if not public.is_editor() then
    raise exception 'editors only';
  end if;
  if exists (select 1 from public.ascent_prompt
              where day is null and (key = p_key or lower(trim(text)) = lower(trim(p_text)))) then
    raise notice 'skipped %: already in the bank', p_key;
    return null;
  end if;

  insert into public.ascent_prompt (key, family, text, wiki_weight, published)
  values (p_key, p_family, p_text, p_wiki, false)
  returning id into v_id;

  foreach v_entry in array p_answers loop
    v_names := string_to_array(v_entry, '|');
    begin
      perform public.ascent_add_answer(v_id, trim(v_names[1]));
      select id into v_answer from public.ascent_answer
       where prompt_id = v_id and canonical_norm = public.ascent_normalize(v_names[1]);
      foreach v_alias in array coalesce(v_names[2:], '{}') loop
        perform public.ascent_add_alias(v_answer, trim(v_alias));
      end loop;
    exception when others then
      raise notice '%: "%" not added: %', p_key, v_entry, sqlerrm;
    end;
  end loop;
  return v_id;
end;
$function$;

revoke execute on function public.ascent_seed_prompt(text, text, text, numeric, text[]) from public, anon;
grant  execute on function public.ascent_seed_prompt(text, text, text, numeric, text[]) to authenticated;

commit;
