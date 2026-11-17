-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console: four more Ascent families
--
-- ascent_bank allows one prompt of a family a day and four a week. The NJ,
-- Princeton, summer reading and course catalog prompts were all filed as
-- archive, so they fought over archive's slots and mostly showed as blocked.
-- Each now has its own family, and its own one-a-day / four-a-week allowance.
-- The rules themselves don't change: ascent_bank works for any family.
--
-- Only bank prompts move. Copies already scheduled keep the family they were
-- published with (sr-10 on 2026-11-19 stays archive) until the app is known
-- to handle the new names; ascent_schedule copies the bank's family from now on.
--
-- The console's FAMILIES (lib/console/ascent.ts) must list the same names, or
-- its bank and schedule picker won't show these prompts.
--
-- ⚠ Copy into the app repo's supabase/ascent.sql, and check the app shows a
-- family it doesn't know before one of these is published. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.ascent_prompt drop constraint if exists ascent_prompt_family_check;
alter table public.ascent_prompt
  add constraint ascent_prompt_family_check
  check (family in ('club', 'sport', 'archive', 'nj', 'princeton', 'reading', 'courses'));

update public.ascent_prompt set family = 'nj'        where key like 'nj-%'   and family = 'archive' and day is null;
update public.ascent_prompt set family = 'princeton' where (key like 'pton-%' or key like 'pu-%') and family = 'archive' and day is null;
update public.ascent_prompt set family = 'reading'   where key like 'sr-%'   and family = 'archive' and day is null;
update public.ascent_prompt set family = 'courses'   where key like 'pos-%'  and family = 'archive' and day is null;

commit;
