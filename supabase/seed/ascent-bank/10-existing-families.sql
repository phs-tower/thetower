-- ═══════════════════════════════════════════════════════════════════════════
-- The Ascent bank: more prompts for nj, sport and reading
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

-- 12 answers
select public.ascent_seed_prompt('nj-turnpike-service-areas', 'nj', 'Name a New Jersey Turnpike service area.', 0.3, array[
    'Clara Barton',
    'John Fenwick',
    'Walt Whitman',
    'James Fenimore Cooper',
    'Richard Stockton',
    'Woodrow Wilson',
    'Molly Pitcher',
    'Joyce Kilmer',
    'Thomas Edison',
    'Grover Cleveland',
    'Vince Lombardi',
    'Alexander Hamilton'
]);

-- 16 answers
select public.ascent_seed_prompt('nj-nec-stations', 'nj', 'Name an NJ Transit station on the Northeast Corridor Line.', 0.2, array[
    'Trenton',
    'Hamilton',
    'Princeton Junction',
    'Jersey Avenue',
    'New Brunswick',
    'Edison',
    'Metuchen',
    'Metropark',
    'Rahway',
    'Linden',
    'Elizabeth',
    'North Elizabeth',
    'Newark Airport|Newark Liberty International Airport',
    'Newark Penn Station|Newark Penn',
    'Secaucus Junction|Secaucus',
    'New York Penn Station|Penn Station'
]);

-- 45 answers
select public.ascent_seed_prompt('sport-summer-olympics', 'sport', 'Name a Summer Olympic sport.', 0.5, array[
    'Archery',
    'Artistic swimming|Synchronized swimming',
    'Track and field|Athletics',
    'Badminton',
    'Basketball',
    '3x3 basketball',
    'Beach volleyball',
    'Boxing',
    'Breaking|Breakdancing',
    'Canoeing|Kayaking',
    'Cycling',
    'Diving',
    'Equestrian',
    'Fencing',
    'Field hockey',
    'Soccer|Football',
    'Golf',
    'Gymnastics',
    'Handball',
    'Judo',
    'Marathon swimming',
    'Modern pentathlon',
    'Rowing',
    'Rugby sevens|Rugby',
    'Sailing',
    'Shooting',
    'Skateboarding',
    'Sport climbing|Climbing',
    'Surfing',
    'Swimming',
    'Table tennis|Ping pong',
    'Taekwondo',
    'Tennis',
    'Trampoline',
    'Triathlon',
    'Volleyball',
    'Water polo',
    'Weightlifting',
    'Wrestling',
    'Baseball',
    'Softball',
    'Cricket',
    'Flag football',
    'Lacrosse',
    'Squash'
]);

-- 38 answers
select public.ascent_seed_prompt('sr-shakespeare', 'reading', 'Name a play by Shakespeare.', 0.5, array[
    'Hamlet',
    'Macbeth',
    'Romeo and Juliet',
    'Othello',
    'King Lear',
    'Julius Caesar',
    'A Midsummer Night''s Dream',
    'The Tempest',
    'Twelfth Night',
    'Much Ado About Nothing',
    'The Merchant of Venice',
    'As You Like It',
    'The Taming of the Shrew',
    'Antony and Cleopatra',
    'Richard III',
    'Henry V',
    'Richard II',
    'Henry IV, Part 1',
    'Henry IV, Part 2',
    'Henry VI, Part 1',
    'Henry VI, Part 2',
    'Henry VI, Part 3',
    'Henry VIII',
    'King John',
    'The Comedy of Errors',
    'The Two Gentlemen of Verona',
    'The Merry Wives of Windsor',
    'Measure for Measure',
    'Love''s Labour''s Lost',
    'All''s Well That Ends Well',
    'The Winter''s Tale',
    'Pericles',
    'Cymbeline',
    'The Two Noble Kinsmen',
    'Troilus and Cressida',
    'Coriolanus',
    'Titus Andronicus',
    'Timon of Athens'
]);

-- 40 answers
select public.ascent_seed_prompt('sr-greek-gods', 'reading', 'Name a Greek god, goddess or Titan.', 0.5, array[
    'Zeus',
    'Hera',
    'Poseidon',
    'Demeter',
    'Athena',
    'Apollo',
    'Artemis',
    'Ares',
    'Aphrodite',
    'Hephaestus',
    'Hermes',
    'Dionysus',
    'Hades',
    'Hestia',
    'Persephone',
    'Eros',
    'Nike',
    'Hecate',
    'Pan',
    'Helios',
    'Selene',
    'Eos',
    'Gaia',
    'Uranus',
    'Cronus|Kronos',
    'Rhea',
    'Nemesis',
    'Hypnos',
    'Thanatos',
    'Iris',
    'Hebe',
    'Tyche',
    'Asclepius',
    'Morpheus',
    'Nyx',
    'Prometheus',
    'Atlas',
    'Themis',
    'Mnemosyne',
    'Oceanus'
]);

-- 24 answers
select public.ascent_seed_prompt('sr-hogwarts-professors', 'reading', 'Name a Hogwarts professor.', 0.5, array[
    'Albus Dumbledore|Dumbledore',
    'Minerva McGonagall|McGonagall',
    'Severus Snape|Snape',
    'Remus Lupin|Lupin',
    'Gilderoy Lockhart|Lockhart',
    'Quirinus Quirrell|Quirrell',
    'Mad-Eye Moody|Alastor Moody',
    'Dolores Umbridge|Umbridge',
    'Horace Slughorn|Slughorn',
    'Filius Flitwick|Flitwick',
    'Pomona Sprout|Sprout',
    'Sybill Trelawney|Trelawney',
    'Rubeus Hagrid|Hagrid',
    'Cuthbert Binns|Binns',
    'Aurora Sinistra|Sinistra',
    'Septima Vector|Vector',
    'Charity Burbage|Burbage',
    'Wilhelmina Grubbly-Plank|Grubbly-Plank',
    'Firenze',
    'Madam Hooch|Rolanda Hooch',
    'Amycus Carrow',
    'Alecto Carrow',
    'Silvanus Kettleburn|Kettleburn',
    'Bathsheba Babbling|Babbling'
]);

-- 31 answers
select public.ascent_seed_prompt('sr-dr-seuss', 'reading', 'Name a Dr. Seuss book.', 0.5, array[
    'The Cat in the Hat',
    'Green Eggs and Ham',
    'How the Grinch Stole Christmas!|The Grinch',
    'Oh, the Places You''ll Go!',
    'One Fish Two Fish Red Fish Blue Fish',
    'Horton Hears a Who!',
    'The Lorax',
    'Fox in Socks',
    'Hop on Pop',
    'Yertle the Turtle',
    'The Sneetches',
    'Horton Hatches the Egg',
    'And to Think That I Saw It on Mulberry Street',
    'The 500 Hats of Bartholomew Cubbins',
    'Bartholomew and the Oobleck',
    'If I Ran the Zoo',
    'If I Ran the Circus',
    'Thidwick the Big-Hearted Moose',
    'Did I Ever Tell You How Lucky You Are?',
    'Dr. Seuss''s ABC',
    'Mr. Brown Can Moo! Can You?',
    'The Foot Book',
    'There''s a Wocket in My Pocket!',
    'Oh, the Thinks You Can Think!',
    'Happy Birthday to You!',
    'The Cat in the Hat Comes Back',
    'The Butter Battle Book',
    'I Can Read with My Eyes Shut!',
    'Daisy-Head Mayzie',
    'McElligot''s Pool',
    'Scrambled Eggs Super!'
]);

-- 19 answers
select public.ascent_seed_prompt('sport-world-cup-hosts', 'sport', 'Name a country that has hosted the men''s FIFA World Cup.', 0.5, array[
    'Uruguay',
    'Italy',
    'France',
    'Brazil',
    'Switzerland',
    'Sweden',
    'Chile',
    'England',
    'Mexico',
    'Germany|West Germany',
    'Argentina',
    'Spain',
    'United States|USA',
    'South Korea',
    'Japan',
    'South Africa',
    'Russia',
    'Qatar',
    'Canada'
]);

-- 15 answers
select public.ascent_seed_prompt('sport-wnba', 'sport', 'Name a WNBA team.', 0.5, array[
    'Atlanta Dream|Dream',
    'Chicago Sky|Sky',
    'Connecticut Sun|Sun',
    'Indiana Fever|Fever',
    'New York Liberty|Liberty',
    'Washington Mystics|Mystics',
    'Dallas Wings|Wings',
    'Las Vegas Aces|Aces',
    'Los Angeles Sparks|Sparks',
    'Minnesota Lynx|Lynx',
    'Phoenix Mercury|Mercury',
    'Seattle Storm|Storm',
    'Golden State Valkyries|Valkyries',
    'Toronto Tempo|Tempo',
    'Portland Fire|Fire'
]);

-- 17 answers
select public.ascent_seed_prompt('nj-governors', 'nj', 'Name a governor of New Jersey.', 0.3, array[
    'Mikie Sherrill',
    'Phil Murphy',
    'Chris Christie',
    'Jon Corzine',
    'Richard Codey',
    'Jim McGreevey',
    'Donald DiFrancesco',
    'Christine Todd Whitman',
    'Jim Florio',
    'Tom Kean',
    'Brendan Byrne',
    'William T. Cahill',
    'Richard J. Hughes',
    'Robert B. Meyner',
    'Alfred E. Driscoll',
    'Woodrow Wilson',
    'William Livingston'
]);

commit;
