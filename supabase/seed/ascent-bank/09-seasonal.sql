-- ═══════════════════════════════════════════════════════════════════════════
-- The Ascent bank: seasonal prompts
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

-- 25 answers
select public.ascent_seed_prompt('seas-thanksgiving', 'seasonal', 'Name a Thanksgiving dish.', 0.3, array[
    'Turkey',
    'Stuffing|Dressing',
    'Mashed potatoes',
    'Gravy',
    'Cranberry sauce',
    'Pumpkin pie',
    'Apple pie',
    'Pecan pie',
    'Sweet potato casserole|Sweet potatoes|Candied yams',
    'Green bean casserole|Green beans',
    'Dinner rolls|Rolls',
    'Cornbread',
    'Mac and cheese|Macaroni and cheese',
    'Corn',
    'Ham',
    'Deviled eggs',
    'Brussels sprouts',
    'Butternut squash',
    'Collard greens',
    'Sweet potato pie',
    'Biscuits',
    'Creamed corn',
    'Salad',
    'Carrots',
    'Pumpkin bread'
]);

-- 24 answers
select public.ascent_seed_prompt('seas-winter-holidays', 'seasonal', 'Name a holiday celebrated between November and January.', 0.4, array[
    'Thanksgiving',
    'Christmas',
    'Hanukkah|Chanukah',
    'Kwanzaa',
    'New Year''s Day',
    'New Year''s Eve',
    'Diwali',
    'Christmas Eve',
    'Boxing Day',
    'Epiphany|Three Kings'' Day',
    'Winter solstice|Yule',
    'St. Nicholas Day',
    'St. Lucia Day',
    'Bodhi Day',
    'Las Posadas',
    'Martin Luther King Jr. Day|MLK Day',
    'Orthodox Christmas',
    'Veterans Day',
    'Lunar New Year|Chinese New Year',
    'Día de los Muertos|Day of the Dead',
    'All Saints'' Day',
    'Guy Fawkes Night',
    'Election Day',
    'Festivus'
]);

-- 20 answers
select public.ascent_seed_prompt('seas-super-bowl', 'seasonal', 'Name a team that has won the Super Bowl.', 0.4, array[
    'Green Bay Packers|Packers',
    'Kansas City Chiefs|Chiefs',
    'New York Jets|Jets',
    'Indianapolis Colts|Baltimore Colts|Colts',
    'Dallas Cowboys|Cowboys',
    'Miami Dolphins|Dolphins',
    'Pittsburgh Steelers|Steelers',
    'Las Vegas Raiders|Oakland Raiders|Raiders',
    'San Francisco 49ers|49ers|Niners',
    'Washington Commanders|Washington Redskins|Commanders',
    'New York Giants|Giants',
    'Chicago Bears|Bears',
    'Denver Broncos|Broncos',
    'Los Angeles Rams|St. Louis Rams|Rams',
    'Baltimore Ravens|Ravens',
    'Tampa Bay Buccaneers|Buccaneers|Bucs',
    'New England Patriots|Patriots',
    'New Orleans Saints|Saints',
    'Seattle Seahawks|Seahawks',
    'Philadelphia Eagles|Eagles'
]);

-- 54 answers
select public.ascent_seed_prompt('seas-christmas-songs', 'seasonal', 'Name a Christmas song.', 0.4, array[
    'Jingle Bells',
    'Silent Night',
    'White Christmas',
    'Rudolph the Red-Nosed Reindeer',
    'Frosty the Snowman',
    'Deck the Halls',
    'Joy to the World',
    'O Holy Night',
    'Hark! The Herald Angels Sing',
    'O Come, All Ye Faithful',
    'The First Noel',
    'We Wish You a Merry Christmas',
    'Santa Claus Is Comin'' to Town',
    'Let It Snow! Let It Snow! Let It Snow!|Let It Snow',
    'All I Want for Christmas Is You',
    'Last Christmas',
    'Jingle Bell Rock',
    'Rockin'' Around the Christmas Tree',
    'Feliz Navidad',
    'Have Yourself a Merry Little Christmas',
    'It''s the Most Wonderful Time of the Year',
    'Winter Wonderland',
    'Sleigh Ride',
    'The Little Drummer Boy|Little Drummer Boy',
    'Carol of the Bells',
    'O Christmas Tree',
    'The Twelve Days of Christmas|12 Days of Christmas',
    'Away in a Manger',
    'God Rest Ye Merry Gentlemen',
    'Go Tell It on the Mountain',
    'Blue Christmas',
    'Here Comes Santa Claus',
    'A Holly Jolly Christmas',
    'Santa Baby',
    'Baby, It''s Cold Outside',
    'Christmas (Baby Please Come Home)',
    'Do They Know It''s Christmas?',
    'Happy Xmas (War Is Over)',
    'Wonderful Christmastime',
    'Mistletoe',
    'Underneath the Tree',
    'Santa Tell Me',
    'The Christmas Song|Chestnuts Roasting on an Open Fire',
    'I''ll Be Home for Christmas',
    'It''s Beginning to Look a Lot Like Christmas',
    'Silver Bells',
    'Up on the Housetop',
    'O Little Town of Bethlehem',
    'Angels We Have Heard on High',
    'We Three Kings',
    'Grandma Got Run Over by a Reindeer',
    'You''re a Mean One, Mr. Grinch',
    'Run Rudolph Run',
    'Christmas Tree Farm'
]);

-- 50 answers
select public.ascent_seed_prompt('seas-halloween-candy', 'seasonal', 'Name a candy you might get trick-or-treating.', 0.3, array[
    'Reese''s|Reese''s Peanut Butter Cups',
    'Kit Kat',
    'Snickers',
    'M&M''s|M&Ms',
    'Twix',
    'Milky Way',
    '3 Musketeers|Three Musketeers',
    'Hershey''s|Hershey bar',
    'Butterfinger',
    'Skittles',
    'Starburst',
    'Candy corn',
    'Tootsie Roll',
    'Tootsie Pop',
    'Smarties',
    'Nerds',
    'Sour Patch Kids',
    'Swedish Fish',
    'Laffy Taffy',
    'Airheads',
    'Jolly Rancher',
    'Dum Dums',
    'Milk Duds',
    'Whoppers',
    'Almond Joy',
    'Mounds',
    'Baby Ruth',
    'Crunch',
    '100 Grand',
    'PayDay',
    'Twizzlers',
    'Hot Tamales',
    'Mike and Ike',
    'Lemonheads',
    'Junior Mints',
    'Raisinets',
    'SweeTarts',
    'Pixy Stix',
    'Charleston Chew',
    'Heath',
    'York Peppermint Pattie|York',
    'Rolo',
    'Hershey''s Kisses|Kisses',
    'Gummy bears',
    'Warheads',
    'Ring Pop',
    'Blow Pop',
    'Bazooka',
    'Mr. Goodbar',
    'Whatchamacallit'
]);

-- 9 answers
select public.ascent_seed_prompt('seas-reindeer', 'seasonal', 'Name one of Santa''s reindeer.', 0.3, array[
    'Dasher',
    'Dancer',
    'Prancer',
    'Vixen',
    'Comet',
    'Cupid',
    'Donner|Donder',
    'Blitzen',
    'Rudolph'
]);

-- 16 answers
select public.ascent_seed_prompt('seas-winter-olympics', 'seasonal', 'Name a Winter Olympic sport.', 0.5, array[
    'Alpine skiing',
    'Biathlon',
    'Bobsled|Bobsleigh',
    'Cross-country skiing',
    'Curling',
    'Figure skating',
    'Freestyle skiing',
    'Ice hockey|Hockey',
    'Luge',
    'Nordic combined',
    'Short track speed skating|Short track',
    'Skeleton',
    'Ski jumping',
    'Snowboarding',
    'Speed skating',
    'Ski mountaineering'
]);

-- 23 answers
select public.ascent_seed_prompt('seas-spring-holidays', 'seasonal', 'Name a holiday celebrated in the spring.', 0.4, array[
    'Easter',
    'Passover',
    'Holi',
    'Eid al-Fitr|Eid',
    'St. Patrick''s Day',
    'Mother''s Day',
    'Memorial Day',
    'Earth Day',
    'April Fools'' Day',
    'Cinco de Mayo',
    'Mardi Gras',
    'Nowruz|Persian New Year',
    'Vaisakhi|Baisakhi',
    'Good Friday',
    'Palm Sunday',
    'Arbor Day',
    'Ash Wednesday',
    'Vesak|Buddha Day',
    'Ramadan',
    'Purim',
    'Father''s Day',
    'Juneteenth',
    'May Day'
]);

-- 12 answers
select public.ascent_seed_prompt('seas-chinese-zodiac', 'seasonal', 'Name an animal of the Chinese zodiac.', 0.4, array[
    'Rat',
    'Ox',
    'Tiger',
    'Rabbit',
    'Dragon',
    'Snake',
    'Horse',
    'Goat|Sheep|Ram',
    'Monkey',
    'Rooster',
    'Dog',
    'Pig'
]);

commit;
