-- ═══════════════════════════════════════════════════════════════════════════
-- The Ascent bank: events prompts
--
-- Generated; edit the lists in the console's word list once they're in.
-- Run in the Supabase SQL editor after
-- migrations/20261117000003_ascent_nine_families.sql. It acts as the first
-- admin in public.editor so ascent_add_answer's editors-only check passes.
-- A prompt already in the bank (same key or text) is skipped, so re-running
-- is safe. Then fetch each new prompt's Wikipedia counts from its word list.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

select set_config('request.jwt.claims',
  json_build_object('email', (select email from public.editor where role = 'admin' order by email limit 1))::text,
  true);

-- 11 answers
select public.ascent_seed_prompt('events-federal-holidays', 'events', 'Name a U.S. federal holiday.', 0.4, array[
    'New Year''s Day',
    'Martin Luther King Jr. Day|MLK Day',
    'Presidents'' Day|Washington''s Birthday',
    'Memorial Day',
    'Juneteenth',
    'Independence Day|Fourth of July|July 4th',
    'Labor Day',
    'Columbus Day|Indigenous Peoples'' Day',
    'Veterans Day',
    'Thanksgiving',
    'Christmas'
]);

-- 26 answers
select public.ascent_seed_prompt('events-awards', 'events', 'Name a major awards show or prize.', 0.5, array[
    'Academy Awards|Oscars',
    'Grammy Awards|Grammys',
    'Emmy Awards|Emmys',
    'Tony Awards|Tonys',
    'Golden Globe Awards|Golden Globes',
    'BAFTA Awards|BAFTAs',
    'MTV Video Music Awards|VMAs',
    'American Music Awards|AMAs',
    'Billboard Music Awards',
    'BET Awards',
    'Kids'' Choice Awards',
    'CMA Awards|Country Music Association Awards',
    'People''s Choice Awards',
    'SAG Awards|Screen Actors Guild Awards',
    'Critics'' Choice Awards',
    'ESPY Awards|ESPYs',
    'iHeartRadio Music Awards',
    'Teen Choice Awards',
    'Nobel Prize',
    'Pulitzer Prize',
    'Peabody Award',
    'Webby Awards',
    'The Game Awards',
    'Brit Awards',
    'Independent Spirit Awards',
    'Heisman Trophy'
]);

-- 33 answers
select public.ascent_seed_prompt('events-religious-holidays', 'events', 'Name a religious holiday.', 0.4, array[
    'Christmas',
    'Easter',
    'Good Friday',
    'Ash Wednesday',
    'Pentecost',
    'Epiphany',
    'All Saints'' Day',
    'Rosh Hashanah',
    'Yom Kippur',
    'Passover|Pesach',
    'Hanukkah|Chanukah',
    'Purim',
    'Sukkot',
    'Shavuot',
    'Eid al-Fitr',
    'Eid al-Adha',
    'Ramadan',
    'Mawlid',
    'Ashura',
    'Diwali',
    'Holi',
    'Navratri',
    'Dussehra',
    'Janmashtami',
    'Raksha Bandhan',
    'Ganesh Chaturthi',
    'Vesak',
    'Bodhi Day',
    'Vaisakhi|Baisakhi',
    'Guru Nanak Gurpurab|Guru Nanak Jayanti',
    'Losar',
    'Obon',
    'Nowruz'
]);

commit;
