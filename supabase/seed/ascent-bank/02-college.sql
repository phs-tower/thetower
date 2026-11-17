-- ═══════════════════════════════════════════════════════════════════════════
-- The Ascent bank: college prompts
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

-- 18 answers
select public.ascent_seed_prompt('college-big-ten', 'college', 'Name a school in the Big Ten.', 0.5, array[
    'University of Illinois|Illinois',
    'Indiana University|Indiana',
    'University of Iowa|Iowa',
    'University of Maryland|Maryland',
    'University of Michigan|Michigan',
    'Michigan State University|Michigan State',
    'University of Minnesota|Minnesota',
    'University of Nebraska|Nebraska',
    'Northwestern University|Northwestern',
    'Ohio State University|Ohio State',
    'Penn State University|Penn State',
    'Purdue University|Purdue',
    'Rutgers University|Rutgers',
    'University of Wisconsin|Wisconsin',
    'UCLA',
    'University of Southern California|USC',
    'University of Oregon|Oregon',
    'University of Washington|Washington'
]);

-- 18 answers
select public.ascent_seed_prompt('college-acc', 'college', 'Name a school in the ACC (Atlantic Coast Conference).', 0.5, array[
    'Boston College',
    'University of California, Berkeley|Cal|Berkeley',
    'Clemson University|Clemson',
    'Duke University|Duke',
    'Florida State University|Florida State',
    'Georgia Tech',
    'University of Louisville|Louisville',
    'University of Miami|Miami',
    'University of North Carolina|UNC|North Carolina',
    'NC State|North Carolina State',
    'University of Notre Dame|Notre Dame',
    'University of Pittsburgh|Pitt',
    'SMU|Southern Methodist University',
    'Stanford University|Stanford',
    'Syracuse University|Syracuse',
    'University of Virginia|UVA|Virginia',
    'Virginia Tech',
    'Wake Forest University|Wake Forest'
]);

-- 16 answers
select public.ascent_seed_prompt('college-sec', 'college', 'Name a school in the SEC (Southeastern Conference).', 0.5, array[
    'University of Alabama|Alabama',
    'University of Arkansas|Arkansas',
    'Auburn University|Auburn',
    'University of Florida|Florida',
    'University of Georgia|Georgia',
    'University of Kentucky|Kentucky',
    'LSU|Louisiana State',
    'Ole Miss|University of Mississippi',
    'Mississippi State University|Mississippi State',
    'University of Missouri|Missouri|Mizzou',
    'University of Oklahoma|Oklahoma',
    'University of South Carolina|South Carolina',
    'University of Tennessee|Tennessee',
    'University of Texas|Texas|UT Austin',
    'Texas A&M',
    'Vanderbilt University|Vanderbilt'
]);

-- 52 answers
select public.ascent_seed_prompt('college-majors', 'college', 'Name a college major.', 0.4, array[
    'Biology',
    'Chemistry',
    'Physics',
    'Mathematics|Math',
    'Computer Science|CS',
    'Economics',
    'Psychology',
    'English',
    'History',
    'Political Science|Poli Sci',
    'Philosophy',
    'Sociology',
    'Anthropology',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Biomedical Engineering',
    'Aerospace Engineering',
    'Business|Business Administration',
    'Finance',
    'Accounting',
    'Marketing',
    'Nursing',
    'Neuroscience',
    'Statistics',
    'Art History',
    'Music',
    'Theater|Theatre',
    'Film Studies|Film',
    'Journalism',
    'Communications',
    'Linguistics',
    'Classics',
    'Architecture',
    'Education',
    'Environmental Science',
    'Geology',
    'Astronomy',
    'Public Health',
    'Biochemistry',
    'International Relations',
    'Data Science',
    'Studio Art|Fine Arts',
    'Comparative Literature',
    'African American Studies',
    'Religious Studies|Religion',
    'Kinesiology',
    'Criminal Justice',
    'Graphic Design',
    'Nutrition',
    'Operations Research'
]);

-- 10 answers
select public.ascent_seed_prompt('college-uc', 'college', 'Name a University of California campus.', 0.5, array[
    'UC Berkeley|Berkeley',
    'UCLA|Los Angeles',
    'UC San Diego|UCSD|San Diego',
    'UC Davis|Davis',
    'UC Irvine|UCI|Irvine',
    'UC Santa Barbara|UCSB|Santa Barbara',
    'UC Santa Cruz|UCSC|Santa Cruz',
    'UC Riverside|UCR|Riverside',
    'UC Merced|Merced',
    'UC San Francisco|UCSF|San Francisco'
]);

-- 21 answers
select public.ascent_seed_prompt('college-boston', 'college', 'Name a college in or around Boston.', 0.5, array[
    'Harvard University|Harvard',
    'MIT|Massachusetts Institute of Technology',
    'Boston University|BU',
    'Boston College|BC',
    'Northeastern University|Northeastern',
    'Tufts University|Tufts',
    'Emerson College|Emerson',
    'Berklee College of Music|Berklee',
    'Suffolk University|Suffolk',
    'UMass Boston',
    'Simmons University|Simmons',
    'Wentworth Institute of Technology|Wentworth',
    'MassArt|Massachusetts College of Art and Design',
    'Lesley University|Lesley',
    'New England Conservatory',
    'Emmanuel College',
    'Brandeis University|Brandeis',
    'Wellesley College|Wellesley',
    'Babson College|Babson',
    'Bentley University|Bentley',
    'Olin College|Olin'
]);

-- 8 answers
select public.ascent_seed_prompt('college-ivy', 'college', 'Name an Ivy League school.', 0.3, array[
    'Princeton University|Princeton',
    'Harvard University|Harvard',
    'Yale University|Yale',
    'Columbia University|Columbia',
    'University of Pennsylvania|Penn|UPenn',
    'Brown University|Brown',
    'Dartmouth College|Dartmouth',
    'Cornell University|Cornell'
]);

-- 11 answers
select public.ascent_seed_prompt('college-big-east', 'college', 'Name a school in the Big East.', 0.5, array[
    'Butler University|Butler',
    'Creighton University|Creighton',
    'DePaul University|DePaul',
    'Georgetown University|Georgetown',
    'Marquette University|Marquette',
    'Providence College|Providence',
    'St. John''s University|St. John''s',
    'Seton Hall University|Seton Hall',
    'UConn|University of Connecticut',
    'Villanova University|Villanova',
    'Xavier University|Xavier'
]);

-- 45 answers
select public.ascent_seed_prompt('college-hbcu', 'college', 'Name a historically Black college or university (HBCU).', 0.5, array[
    'Howard University|Howard',
    'Spelman College|Spelman',
    'Morehouse College|Morehouse',
    'Hampton University|Hampton',
    'Tuskegee University|Tuskegee',
    'Florida A&M University|FAMU|Florida A&M',
    'North Carolina A&T|NC A&T',
    'Xavier University of Louisiana',
    'Fisk University|Fisk',
    'Clark Atlanta University|Clark Atlanta',
    'Jackson State University|Jackson State',
    'Grambling State University|Grambling',
    'Southern University',
    'Prairie View A&M|Prairie View',
    'Tennessee State University|Tennessee State',
    'Delaware State University|Delaware State',
    'Morgan State University|Morgan State',
    'Bowie State University|Bowie State',
    'Lincoln University (Pennsylvania)',
    'Cheyney University|Cheyney',
    'Alabama State University|Alabama State',
    'Alcorn State University|Alcorn State',
    'Bethune-Cookman University|Bethune-Cookman',
    'Dillard University|Dillard',
    'Norfolk State University|Norfolk State',
    'Virginia State University|Virginia State',
    'Winston-Salem State University|Winston-Salem State',
    'North Carolina Central University|NCCU',
    'Texas Southern University|Texas Southern',
    'Wilberforce University|Wilberforce',
    'Coppin State University|Coppin State',
    'Johnson C. Smith University',
    'Claflin University|Claflin',
    'South Carolina State University|SC State',
    'Savannah State University|Savannah State',
    'Fort Valley State University|Fort Valley State',
    'Albany State University|Albany State',
    'Kentucky State University|Kentucky State',
    'Langston University|Langston',
    'Mississippi Valley State University|Mississippi Valley State',
    'Tougaloo College|Tougaloo',
    'Elizabeth City State University|Elizabeth City State',
    'Fayetteville State University|Fayetteville State',
    'University of Arkansas at Pine Bluff|UAPB',
    'University of the District of Columbia|UDC'
]);

commit;
