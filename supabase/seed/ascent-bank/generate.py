"""Writes the Ascent bank seed files (NN-<family>.sql) next to this script.

    python3 supabase/seed/ascent-bank/generate.py

Each prompt: (key, text, wiki share, [answers]); an answer is 'Canonical' or
'Canonical|alias|alias'. To add prompts, add them to a list below and re-run:
the SQL skips prompts already in the bank, so every file can be run again.
Only lists an editor could check against a public source belong here; build
PHS-only lists (musicals staged, Spirit Week themes) in the console.
"""
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))

def battles(names):
    out = []
    for n in names:
        first = n.split("|")[0]
        out.append(f"{n}|Battle of {first}")
    return out

P = {}

P["arts"] = [
    ("arts-orchestra", "Name an instrument in a symphony orchestra.", 0.6, [
        "Violin", "Viola", "Cello|Violoncello", "Double bass|Bass|Contrabass|Upright bass", "Harp", "Flute", "Piccolo",
        "Oboe", "English horn|Cor anglais", "Clarinet", "Bass clarinet", "Bassoon", "Contrabassoon", "French horn|Horn",
        "Trumpet", "Trombone", "Tuba", "Timpani|Kettle drum", "Snare drum", "Bass drum", "Cymbals", "Triangle",
        "Xylophone", "Glockenspiel", "Celesta", "Piano", "Tam-tam|Gong", "Tambourine", "Tubular bells|Chimes",
        "Marimba", "Saxophone", "Harpsichord", "Organ", "Castanets", "Wood block",
    ]),
    ("arts-composers", "Name a classical composer.", 0.6, [
        "Johann Sebastian Bach|Bach", "Wolfgang Amadeus Mozart|Mozart", "Ludwig van Beethoven|Beethoven",
        "Frédéric Chopin|Chopin", "Pyotr Ilyich Tchaikovsky|Tchaikovsky", "Antonio Vivaldi|Vivaldi",
        "George Frideric Handel|Handel", "Joseph Haydn|Haydn", "Franz Schubert|Schubert", "Johannes Brahms|Brahms",
        "Claude Debussy|Debussy", "Maurice Ravel|Ravel", "Richard Wagner|Wagner", "Giuseppe Verdi|Verdi",
        "Giacomo Puccini|Puccini", "Sergei Rachmaninoff|Rachmaninoff", "Franz Liszt|Liszt",
        "Felix Mendelssohn|Mendelssohn", "Robert Schumann|Schumann", "Clara Schumann", "Antonín Dvořák|Dvorak|Dvořák",
        "Gustav Mahler|Mahler", "Igor Stravinsky|Stravinsky", "Sergei Prokofiev|Prokofiev",
        "Dmitri Shostakovich|Shostakovich", "Edvard Grieg|Grieg", "Gioachino Rossini|Rossini", "Georges Bizet|Bizet",
        "Erik Satie|Satie", "Camille Saint-Saëns|Saint-Saens", "Gustav Holst|Holst", "Edward Elgar|Elgar",
        "Aaron Copland|Copland", "George Gershwin|Gershwin", "Leonard Bernstein|Bernstein", "Jean Sibelius|Sibelius",
        "Modest Mussorgsky|Mussorgsky", "Nikolai Rimsky-Korsakov|Rimsky-Korsakov", "Johann Pachelbel|Pachelbel",
        "Claudio Monteverdi|Monteverdi", "Henry Purcell|Purcell", "Johann Strauss II", "Richard Strauss",
        "Philip Glass", "John Williams", "Samuel Barber|Barber", "Hildegard of Bingen", "Fanny Mendelssohn",
    ]),
    ("arts-renaissance", "Name a Renaissance artist.", 0.6, [
        "Leonardo da Vinci|Leonardo|da Vinci", "Michelangelo", "Raphael", "Donatello", "Sandro Botticelli|Botticelli",
        "Titian", "Jan van Eyck|van Eyck", "Albrecht Dürer|Durer|Dürer", "Giotto", "Masaccio",
        "Filippo Brunelleschi|Brunelleschi", "Hieronymus Bosch|Bosch", "Pieter Bruegel the Elder|Bruegel|Brueghel",
        "Hans Holbein the Younger|Holbein", "Tintoretto", "Fra Angelico", "Lorenzo Ghiberti|Ghiberti", "Giorgione",
        "Piero della Francesca", "Andrea Mantegna|Mantegna", "Correggio", "Paolo Veronese|Veronese",
        "Andrea del Verrocchio|Verrocchio", "Filippo Lippi", "Perugino", "Giovanni Bellini|Bellini", "El Greco",
        "Parmigianino", "Sofonisba Anguissola", "Benvenuto Cellini|Cellini",
    ]),
    ("arts-impressionists", "Name an Impressionist or Post-Impressionist painter.", 0.6, [
        "Claude Monet|Monet", "Édouard Manet|Manet|Edouard Manet", "Pierre-Auguste Renoir|Renoir", "Edgar Degas|Degas",
        "Camille Pissarro|Pissarro", "Berthe Morisot|Morisot", "Alfred Sisley|Sisley", "Mary Cassatt|Cassatt",
        "Gustave Caillebotte|Caillebotte", "Vincent van Gogh|Van Gogh", "Paul Cézanne|Cezanne|Cézanne",
        "Paul Gauguin|Gauguin", "Georges Seurat|Seurat", "Henri de Toulouse-Lautrec|Toulouse-Lautrec",
        "Paul Signac|Signac", "Frédéric Bazille|Bazille", "Henri Rousseau|Rousseau", "Childe Hassam|Hassam",
        "Armand Guillaumin", "Pierre Bonnard|Bonnard",
    ]),
    ("arts-tony-musicals", "Name a musical that won the Tony Award for Best Musical.", 0.6, [
        "Kiss Me, Kate", "South Pacific", "Guys and Dolls", "The King and I", "Wonderful Town", "Kismet",
        "The Pajama Game", "Damn Yankees", "My Fair Lady", "The Music Man", "Redhead", "Fiorello!",
        "The Sound of Music", "Bye Bye Birdie", "How to Succeed in Business Without Really Trying",
        "A Funny Thing Happened on the Way to the Forum", "Hello, Dolly!", "Fiddler on the Roof", "Man of La Mancha",
        "Cabaret", "Hallelujah, Baby!", "1776", "Applause", "Company", "Two Gentlemen of Verona",
        "A Little Night Music", "Raisin", "The Wiz", "A Chorus Line", "Annie", "Ain't Misbehavin'", "Sweeney Todd",
        "Evita", "42nd Street", "Nine", "Cats", "La Cage aux Folles", "Big River", "The Mystery of Edwin Drood",
        "Les Misérables|Les Mis|Les Miserables", "The Phantom of the Opera|Phantom of the Opera",
        "Jerome Robbins' Broadway", "City of Angels", "The Will Rogers Follies", "Crazy for You",
        "Kiss of the Spider Woman", "Passion", "Sunset Boulevard", "Rent", "Titanic", "The Lion King", "Fosse",
        "Contact", "The Producers", "Thoroughly Modern Millie", "Hairspray", "Avenue Q", "Monty Python's Spamalot|Spamalot",
        "Jersey Boys", "Spring Awakening", "In the Heights", "Billy Elliot the Musical|Billy Elliot", "Memphis",
        "The Book of Mormon|Book of Mormon", "Once", "Kinky Boots", "A Gentleman's Guide to Love and Murder", "Fun Home",
        "Hamilton", "Dear Evan Hansen", "The Band's Visit", "Hadestown", "Moulin Rouge!|Moulin Rouge",
        "A Strange Loop", "Kimberly Akimbo", "The Outsiders", "Maybe Happy Ending",
    ]),
    ("arts-movements", "Name an art movement.", 0.6, [
        "Renaissance", "Baroque", "Rococo", "Neoclassicism", "Romanticism", "Realism", "Impressionism",
        "Post-Impressionism", "Pointillism", "Art Nouveau", "Fauvism", "Expressionism", "Cubism", "Futurism",
        "Dada|Dadaism", "Surrealism", "Bauhaus", "Art Deco", "De Stijl", "Constructivism", "Abstract Expressionism",
        "Pop Art", "Minimalism", "Op Art", "Conceptual art", "Street art|Graffiti", "Mannerism", "Gothic art|Gothic",
        "Pre-Raphaelite Brotherhood|Pre-Raphaelites", "Hudson River School", "Harlem Renaissance", "Photorealism",
        "Suprematism", "Symbolism", "Neo-expressionism", "Arts and Crafts movement|Arts and Crafts",
    ]),
    ("arts-dance", "Name a style of dance.", 0.6, [
        "Ballet", "Tap", "Jazz", "Hip-hop", "Contemporary", "Modern", "Salsa", "Tango", "Waltz", "Foxtrot", "Swing",
        "Lindy Hop", "Cha-cha|Cha-cha-cha", "Rumba", "Samba", "Quickstep", "Paso doble", "Jive",
        "Breakdancing|Breaking", "Bachata", "Merengue", "Flamenco", "Irish dance|Irish step dance", "Bharatanatyam",
        "Kathak", "Bollywood", "Belly dance", "Line dancing", "Square dance", "Polka", "Charleston", "Disco", "Hula",
        "Capoeira", "Voguing|Vogue", "Clogging", "Popping", "Locking", "Krumping|Krump", "Bhangra", "K-pop",
    ]),
]

P["college"] = [
    ("college-big-ten", "Name a school in the Big Ten.", 0.5, [
        "University of Illinois|Illinois", "Indiana University|Indiana", "University of Iowa|Iowa",
        "University of Maryland|Maryland", "University of Michigan|Michigan", "Michigan State University|Michigan State",
        "University of Minnesota|Minnesota", "University of Nebraska|Nebraska", "Northwestern University|Northwestern",
        "Ohio State University|Ohio State", "Penn State University|Penn State", "Purdue University|Purdue",
        "Rutgers University|Rutgers", "University of Wisconsin|Wisconsin", "UCLA",
        "University of Southern California|USC", "University of Oregon|Oregon", "University of Washington|Washington",
    ]),
    ("college-acc", "Name a school in the ACC (Atlantic Coast Conference).", 0.5, [
        "Boston College", "University of California, Berkeley|Cal|Berkeley", "Clemson University|Clemson",
        "Duke University|Duke", "Florida State University|Florida State", "Georgia Tech",
        "University of Louisville|Louisville", "University of Miami|Miami", "University of North Carolina|UNC|North Carolina",
        "NC State|North Carolina State", "University of Notre Dame|Notre Dame", "University of Pittsburgh|Pitt",
        "SMU|Southern Methodist University", "Stanford University|Stanford", "Syracuse University|Syracuse",
        "University of Virginia|UVA|Virginia", "Virginia Tech", "Wake Forest University|Wake Forest",
    ]),
    ("college-sec", "Name a school in the SEC (Southeastern Conference).", 0.5, [
        "University of Alabama|Alabama", "University of Arkansas|Arkansas", "Auburn University|Auburn",
        "University of Florida|Florida", "University of Georgia|Georgia", "University of Kentucky|Kentucky",
        "LSU|Louisiana State", "Ole Miss|University of Mississippi", "Mississippi State University|Mississippi State",
        "University of Missouri|Missouri|Mizzou", "University of Oklahoma|Oklahoma", "University of South Carolina|South Carolina",
        "University of Tennessee|Tennessee", "University of Texas|Texas|UT Austin", "Texas A&M",
        "Vanderbilt University|Vanderbilt",
    ]),
    ("college-majors", "Name a college major.", 0.4, [
        "Biology", "Chemistry", "Physics", "Mathematics|Math", "Computer Science|CS", "Economics", "Psychology",
        "English", "History", "Political Science|Poli Sci", "Philosophy", "Sociology", "Anthropology",
        "Mechanical Engineering", "Electrical Engineering", "Civil Engineering", "Chemical Engineering",
        "Biomedical Engineering", "Aerospace Engineering", "Business|Business Administration", "Finance",
        "Accounting", "Marketing", "Nursing", "Neuroscience", "Statistics", "Art History", "Music",
        "Theater|Theatre", "Film Studies|Film", "Journalism", "Communications", "Linguistics", "Classics",
        "Architecture", "Education", "Environmental Science", "Geology", "Astronomy", "Public Health",
        "Biochemistry", "International Relations", "Data Science", "Studio Art|Fine Arts",
        "Comparative Literature", "African American Studies", "Religious Studies|Religion", "Kinesiology",
        "Criminal Justice", "Graphic Design", "Nutrition", "Operations Research",
    ]),
    ("college-uc", "Name a University of California campus.", 0.5, [
        "UC Berkeley|Berkeley", "UCLA|Los Angeles", "UC San Diego|UCSD|San Diego", "UC Davis|Davis",
        "UC Irvine|UCI|Irvine", "UC Santa Barbara|UCSB|Santa Barbara", "UC Santa Cruz|UCSC|Santa Cruz",
        "UC Riverside|UCR|Riverside", "UC Merced|Merced", "UC San Francisco|UCSF|San Francisco",
    ]),
    ("college-boston", "Name a college in or around Boston.", 0.5, [
        "Harvard University|Harvard", "MIT|Massachusetts Institute of Technology", "Boston University|BU",
        "Boston College|BC", "Northeastern University|Northeastern", "Tufts University|Tufts",
        "Emerson College|Emerson", "Berklee College of Music|Berklee", "Suffolk University|Suffolk",
        "UMass Boston", "Simmons University|Simmons", "Wentworth Institute of Technology|Wentworth",
        "MassArt|Massachusetts College of Art and Design", "Lesley University|Lesley",
        "New England Conservatory", "Emmanuel College", "Brandeis University|Brandeis",
        "Wellesley College|Wellesley", "Babson College|Babson", "Bentley University|Bentley", "Olin College|Olin",
    ]),
]

P["people"] = [
    ("people-pu-alumni", "Name a famous Princeton University alum.", 0.5, [
        "James Madison", "Woodrow Wilson", "Michelle Obama", "Jeff Bezos", "Jimmy Stewart|James Stewart",
        "Brooke Shields", "Sonia Sotomayor", "Samuel Alito", "Elena Kagan", "F. Scott Fitzgerald|Scott Fitzgerald",
        "Alan Turing", "John Nash", "Richard Feynman", "Aaron Burr", "Ted Cruz", "Eric Schmidt", "Wendy Kopp",
        "David Duchovny", "Ethan Coen", "Bill Bradley", "Dean Cain", "Ellie Kemper", "José Ferrer|Jose Ferrer",
        "Ralph Nader", "Steve Forbes", "Donald Rumsfeld", "James Baker", "John Foster Dulles", "George Shultz",
        "Meg Whitman", "John Bogle", "Queen Noor", "Mitch Daniels", "John Bardeen", "Pete Conrad",
    ]),
    ("people-princetonians", "Name a famous person who lived in Princeton.", 0.4, [
        "Albert Einstein|Einstein", "Toni Morrison", "John Nash", "Paul Robeson", "Grover Cleveland",
        "Woodrow Wilson", "Aaron Burr", "Richard Stockton", "John Witherspoon", "Kurt Gödel|Kurt Godel",
        "John von Neumann", "Joyce Carol Oates", "Thomas Mann", "J. Robert Oppenheimer|Oppenheimer",
        "Freeman Dyson", "Paul Muldoon", "Ben Bernanke", "Peter Singer", "Cornel West", "Michael Graves",
        "John McPhee", "Hermann Weyl", "Alan Turing",
    ]),
    ("people-nj-born", "Name a famous person born in New Jersey.", 0.5, [
        "Bruce Springsteen", "Frank Sinatra", "Whitney Houston", "Jon Bon Jovi", "Meryl Streep", "Jack Nicholson",
        "Danny DeVito", "Queen Latifah", "Shaquille O'Neal|Shaq", "Derek Jeter", "Buzz Aldrin", "Aaron Burr",
        "Grover Cleveland", "Paul Robeson", "Lauryn Hill", "John Travolta", "Kirsten Dunst", "Zach Braff",
        "Michael Douglas", "Count Basie", "Allen Ginsberg", "Philip Roth", "Stephen Crane", "Dorothy Parker",
        "Halsey", "Carli Lloyd", "Mike Trout", "Ray Liotta", "Eva Marie Saint", "Kelly Ripa", "Jason Alexander",
        "Martha Stewart", "Sarah Vaughan", "Ice-T", "Joe Pesci", "James Gandolfini", "William Carlos Williams",
        "Wally Schirra", "Chris Christie",
    ]),
    ("people-first-ladies", "Name a First Lady of the United States.", 0.5, [
        "Martha Washington", "Abigail Adams", "Dolley Madison", "Elizabeth Monroe", "Louisa Adams", "Anna Harrison",
        "Letitia Tyler", "Julia Tyler", "Sarah Polk", "Margaret Taylor", "Abigail Fillmore", "Jane Pierce",
        "Harriet Lane", "Mary Todd Lincoln", "Eliza Johnson", "Julia Grant", "Lucy Hayes", "Lucretia Garfield",
        "Frances Cleveland", "Caroline Harrison", "Ida McKinley", "Edith Roosevelt", "Helen Taft", "Ellen Wilson",
        "Edith Wilson", "Florence Harding", "Grace Coolidge", "Lou Hoover", "Eleanor Roosevelt", "Bess Truman",
        "Mamie Eisenhower", "Jacqueline Kennedy|Jackie Kennedy|Jackie O", "Lady Bird Johnson", "Pat Nixon",
        "Betty Ford", "Rosalynn Carter", "Nancy Reagan", "Barbara Bush", "Hillary Clinton", "Laura Bush",
        "Michelle Obama", "Melania Trump", "Jill Biden",
    ]),
]

P["events"] = [
    ("events-federal-holidays", "Name a U.S. federal holiday.", 0.4, [
        "New Year's Day", "Martin Luther King Jr. Day|MLK Day", "Presidents' Day|Washington's Birthday",
        "Memorial Day", "Juneteenth", "Independence Day|Fourth of July|July 4th", "Labor Day",
        "Columbus Day|Indigenous Peoples' Day", "Veterans Day", "Thanksgiving", "Christmas",
    ]),
    ("events-awards", "Name a major awards show or prize.", 0.5, [
        "Academy Awards|Oscars", "Grammy Awards|Grammys", "Emmy Awards|Emmys", "Tony Awards|Tonys",
        "Golden Globe Awards|Golden Globes", "BAFTA Awards|BAFTAs", "MTV Video Music Awards|VMAs",
        "American Music Awards|AMAs", "Billboard Music Awards", "BET Awards", "Kids' Choice Awards",
        "CMA Awards|Country Music Association Awards", "People's Choice Awards", "SAG Awards|Screen Actors Guild Awards",
        "Critics' Choice Awards", "ESPY Awards|ESPYs", "iHeartRadio Music Awards", "Teen Choice Awards",
        "Nobel Prize", "Pulitzer Prize", "Peabody Award", "Webby Awards", "The Game Awards", "Brit Awards",
        "Independent Spirit Awards", "Heisman Trophy",
    ]),
]

ELEMENTS = """Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium
Aluminum|Aluminium Silicon Phosphorus Sulfur|Sulphur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium
Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium
Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin
Antimony Tellurium Iodine Xenon Cesium|Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium
Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium
Osmium Iridium Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium
Protactinium Uranium Neptunium Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium
Nobelium Lawrencium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium
Copernicium Nihonium Flerovium Moscovium Livermorium Tennessine Oganesson""".split()
assert len(ELEMENTS) == 118, len(ELEMENTS)

CONSTELLATIONS = [
    "Andromeda", "Antlia", "Apus", "Aquarius", "Aquila", "Ara", "Aries", "Auriga", "Boötes|Bootes", "Caelum",
    "Camelopardalis", "Cancer", "Canes Venatici", "Canis Major", "Canis Minor", "Capricornus|Capricorn", "Carina",
    "Cassiopeia", "Centaurus", "Cepheus", "Cetus", "Chamaeleon", "Circinus", "Columba", "Coma Berenices",
    "Corona Australis", "Corona Borealis", "Corvus", "Crater", "Crux|Southern Cross", "Cygnus", "Delphinus",
    "Dorado", "Draco", "Equuleus", "Eridanus", "Fornax", "Gemini", "Grus", "Hercules", "Horologium", "Hydra",
    "Hydrus", "Indus", "Lacerta", "Leo", "Leo Minor", "Lepus", "Libra", "Lupus", "Lynx", "Lyra", "Mensa",
    "Microscopium", "Monoceros", "Musca", "Norma", "Octans", "Ophiuchus", "Orion", "Pavo", "Pegasus", "Perseus",
    "Phoenix", "Pictor", "Pisces", "Piscis Austrinus", "Puppis", "Pyxis", "Reticulum", "Sagitta", "Sagittarius",
    "Scorpius|Scorpio", "Sculptor", "Scutum", "Serpens", "Sextans", "Taurus", "Telescopium", "Triangulum",
    "Triangulum Australe", "Tucana", "Ursa Major|Big Dipper|Great Bear", "Ursa Minor|Little Dipper|Little Bear",
    "Vela", "Virgo", "Volans", "Vulpecula",
]
assert len(CONSTELLATIONS) == 88, len(CONSTELLATIONS)

P["science"] = [
    ("sci-elements", "Name a chemical element.", 0.7, ELEMENTS),
    ("sci-organs", "Name an organ of the human body.", 0.6, [
        "Heart", "Lungs|Lung", "Liver", "Kidneys|Kidney", "Brain", "Stomach", "Skin", "Small intestine",
        "Large intestine|Colon", "Pancreas", "Spleen", "Gallbladder", "Bladder|Urinary bladder", "Appendix",
        "Esophagus", "Thyroid|Thyroid gland", "Adrenal glands|Adrenal gland", "Pituitary gland|Pituitary", "Thymus",
        "Eyes|Eye", "Tongue", "Ovaries|Ovary", "Testes|Testicles", "Uterus", "Prostate", "Larynx|Voice box",
        "Trachea|Windpipe", "Pineal gland", "Tonsils", "Bone marrow", "Spinal cord", "Ears|Ear", "Nose",
        "Rectum", "Diaphragm",
    ]),
    ("sci-bones", "Name a bone in the human body.", 0.6, [
        "Skull|Cranium", "Mandible|Jawbone|Jaw", "Maxilla", "Clavicle|Collarbone", "Scapula|Shoulder blade",
        "Sternum|Breastbone", "Ribs|Rib", "Vertebrae|Vertebra|Spine", "Humerus", "Radius", "Ulna",
        "Carpals|Carpal", "Metacarpals|Metacarpal", "Phalanges|Phalanx", "Pelvis|Hip bone", "Femur|Thigh bone",
        "Patella|Kneecap", "Tibia|Shinbone", "Fibula", "Tarsals|Tarsal", "Metatarsals|Metatarsal",
        "Calcaneus|Heel bone", "Talus", "Coccyx|Tailbone", "Sacrum", "Hyoid", "Stapes|Stirrup", "Incus|Anvil",
        "Malleus|Hammer", "Nasal bone", "Zygomatic bone|Cheekbone", "Frontal bone", "Parietal bone",
        "Occipital bone", "Temporal bone", "Sphenoid", "Ethmoid", "Scaphoid", "Atlas", "Axis", "Ilium",
        "Ischium", "Pubis",
    ]),
    ("sci-solar-system", "Name a planet, dwarf planet or moon in our solar system.", 0.7, [
        "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Ceres", "Eris",
        "Haumea", "Makemake", "The Moon|Moon|Luna", "Phobos", "Deimos", "Io", "Europa", "Ganymede", "Callisto",
        "Amalthea", "Titan", "Enceladus", "Mimas", "Rhea", "Iapetus", "Dione", "Tethys", "Hyperion", "Phoebe",
        "Miranda", "Ariel", "Umbriel", "Titania", "Oberon", "Triton", "Nereid", "Proteus", "Charon",
    ]),
    ("sci-dinosaurs", "Name a dinosaur.", 0.7, [
        "Tyrannosaurus rex|T. rex|T-Rex|Tyrannosaurus", "Triceratops", "Stegosaurus", "Velociraptor|Raptor",
        "Brachiosaurus", "Diplodocus", "Apatosaurus", "Brontosaurus", "Spinosaurus", "Ankylosaurus", "Allosaurus",
        "Iguanodon", "Parasaurolophus", "Pachycephalosaurus", "Archaeopteryx", "Dilophosaurus", "Carnotaurus",
        "Gallimimus", "Compsognathus", "Oviraptor", "Deinonychus", "Giganotosaurus", "Argentinosaurus",
        "Therizinosaurus", "Hadrosaurus", "Maiasaura", "Protoceratops", "Baryonyx", "Microraptor", "Edmontosaurus",
        "Styracosaurus", "Utahraptor", "Coelophysis", "Plateosaurus", "Troodon", "Corythosaurus",
    ]),
    ("sci-constellations", "Name a constellation.", 0.7, CONSTELLATIONS),
    ("sci-programming", "Name a programming language.", 0.6, [
        "Python", "Java", "JavaScript|JS", "TypeScript", "C", "C plus plus|CPP", "C sharp", "Go|Golang", "Rust", "Swift",
        "Kotlin", "Ruby", "PHP", "R", "MATLAB", "SQL", "Scratch", "Perl", "Haskell", "Lisp", "Scala", "Dart",
        "Julia", "Fortran", "COBOL", "Assembly", "Lua", "Objective-C", "Visual Basic", "Pascal", "BASIC", "Elixir",
        "Erlang", "Clojure", "OCaml", "Prolog", "Bash", "Zig", "Racket", "Snap!|Snap",
    ]),
    ("sci-scientists", "Name a famous scientist.", 0.6, [
        "Isaac Newton|Newton", "Albert Einstein|Einstein", "Marie Curie", "Charles Darwin|Darwin",
        "Galileo Galilei|Galileo", "Nikola Tesla|Tesla", "Thomas Edison|Edison", "Stephen Hawking|Hawking",
        "Richard Feynman|Feynman", "Niels Bohr|Bohr", "Max Planck|Planck", "Gregor Mendel|Mendel",
        "Louis Pasteur|Pasteur", "Rosalind Franklin", "Alan Turing|Turing", "Ada Lovelace",
        "Nicolaus Copernicus|Copernicus", "Johannes Kepler|Kepler", "Michael Faraday|Faraday",
        "James Clerk Maxwell|Maxwell", "Dmitri Mendeleev|Mendeleev", "Carl Sagan", "Neil deGrasse Tyson",
        "Jane Goodall", "Rachel Carson", "Alexander Fleming", "Edwin Hubble|Hubble", "Werner Heisenberg|Heisenberg",
        "Erwin Schrödinger|Schrodinger|Schrödinger", "Enrico Fermi|Fermi", "J. Robert Oppenheimer|Oppenheimer",
        "Robert Hooke|Hooke", "Antoine Lavoisier|Lavoisier", "Archimedes", "Katherine Johnson", "Jennifer Doudna",
        "Barbara McClintock", "Lise Meitner", "Ernest Rutherford|Rutherford", "Paul Dirac|Dirac",
        "John Dalton|Dalton", "Edward Jenner", "Jonas Salk",
    ]),
    ("sci-clouds", "Name a type of cloud.", 0.6, [
        "Cirrus", "Cirrocumulus", "Cirrostratus", "Altocumulus", "Altostratus", "Nimbostratus", "Stratocumulus",
        "Stratus", "Cumulus", "Cumulonimbus", "Lenticular", "Mammatus", "Contrail", "Fog",
    ]),
    ("sci-body-systems", "Name an organ system of the human body.", 0.5, [
        "Circulatory system|Circulatory|Cardiovascular system", "Respiratory system|Respiratory",
        "Digestive system|Digestive", "Nervous system|Nervous", "Skeletal system|Skeletal",
        "Muscular system|Muscular", "Endocrine system|Endocrine", "Immune system|Immune",
        "Lymphatic system|Lymphatic", "Integumentary system|Integumentary",
        "Urinary system|Urinary|Excretory system", "Reproductive system|Reproductive",
    ]),
    ("sci-units", "Name a unit of measurement.", 0.6, [
        "Meter|Metre", "Kilogram", "Second", "Ampere|Amp", "Kelvin", "Mole", "Candela", "Newton", "Joule", "Watt",
        "Volt", "Ohm", "Pascal", "Hertz", "Coulomb", "Tesla", "Henry", "Farad", "Liter|Litre", "Gram", "Kilometer",
        "Centimeter", "Millimeter", "Inch", "Foot|Feet", "Yard", "Mile", "Ounce", "Pound", "Ton", "Gallon", "Quart",
        "Pint", "Cup", "Teaspoon", "Tablespoon", "Acre", "Hectare", "Calorie", "Degree Celsius|Celsius",
        "Degree Fahrenheit|Fahrenheit", "Light-year|Light year", "Astronomical unit|AU", "Horsepower", "Decibel",
        "Byte", "Bit", "Knot", "Fathom", "Furlong", "Nautical mile", "Minute", "Hour", "Milliliter",
    ]),
]

P["history"] = [
    ("hist-presidents", "Name a U.S. president.", 0.5, [
        "George Washington|Washington", "John Adams", "Thomas Jefferson|Jefferson", "James Madison|Madison",
        "James Monroe|Monroe", "John Quincy Adams", "Andrew Jackson|Jackson", "Martin Van Buren|Van Buren",
        "William Henry Harrison", "John Tyler|Tyler", "James K. Polk|Polk", "Zachary Taylor|Taylor",
        "Millard Fillmore|Fillmore", "Franklin Pierce|Pierce", "James Buchanan|Buchanan", "Abraham Lincoln|Lincoln",
        "Andrew Johnson", "Ulysses S. Grant|Grant", "Rutherford B. Hayes|Hayes", "James A. Garfield|Garfield",
        "Chester A. Arthur|Arthur", "Grover Cleveland|Cleveland", "Benjamin Harrison",
        "William McKinley|McKinley", "Theodore Roosevelt|Teddy Roosevelt", "William Howard Taft|Taft",
        "Woodrow Wilson|Wilson", "Warren G. Harding|Harding", "Calvin Coolidge|Coolidge", "Herbert Hoover|Hoover",
        "Franklin D. Roosevelt|FDR", "Harry S. Truman|Truman", "Dwight D. Eisenhower|Eisenhower|Ike",
        "John F. Kennedy|JFK|Kennedy", "Lyndon B. Johnson|LBJ", "Richard Nixon|Nixon", "Gerald Ford|Ford",
        "Jimmy Carter|Carter", "Ronald Reagan|Reagan", "George H. W. Bush", "Bill Clinton|Clinton",
        "George W. Bush", "Barack Obama|Obama", "Donald Trump|Trump", "Joe Biden|Biden",
    ]),
    ("hist-declaration", "Name a signer of the Declaration of Independence.", 0.5, [
        "Josiah Bartlett", "William Whipple", "Matthew Thornton", "John Hancock", "Samuel Adams", "John Adams",
        "Robert Treat Paine", "Elbridge Gerry", "Stephen Hopkins", "William Ellery", "Roger Sherman",
        "Samuel Huntington", "William Williams", "Oliver Wolcott", "William Floyd", "Philip Livingston",
        "Francis Lewis", "Lewis Morris", "Richard Stockton", "John Witherspoon", "Francis Hopkinson", "John Hart",
        "Abraham Clark", "Robert Morris", "Benjamin Rush", "Benjamin Franklin|Franklin", "John Morton",
        "George Clymer", "James Smith", "George Taylor", "James Wilson", "George Ross", "Caesar Rodney",
        "George Read", "Thomas McKean", "Samuel Chase", "William Paca", "Thomas Stone",
        "Charles Carroll of Carrollton|Charles Carroll", "George Wythe", "Richard Henry Lee",
        "Thomas Jefferson|Jefferson", "Benjamin Harrison V|Benjamin Harrison", "Thomas Nelson Jr.|Thomas Nelson",
        "Francis Lightfoot Lee", "Carter Braxton", "William Hooper", "Joseph Hewes", "John Penn",
        "Edward Rutledge", "Thomas Heyward Jr.|Thomas Heyward", "Thomas Lynch Jr.|Thomas Lynch",
        "Arthur Middleton", "Button Gwinnett", "Lyman Hall", "George Walton",
    ]),
    ("hist-colonies", "Name one of the Thirteen Colonies.", 0.4, [
        "Virginia", "Massachusetts|Massachusetts Bay", "New Hampshire", "Maryland", "Connecticut", "Rhode Island",
        "Delaware", "North Carolina", "South Carolina", "New York", "New Jersey", "Pennsylvania", "Georgia",
    ]),
    ("hist-revolution-battles", "Name a battle of the American Revolution.", 0.5, battles([
        "Lexington and Concord|Lexington|Concord", "Bunker Hill", "Saratoga", "Trenton", "Princeton", "Yorktown",
        "Brandywine", "Germantown", "Monmouth", "Long Island|Brooklyn", "White Plains", "Harlem Heights",
        "Fort Washington", "Camden", "Cowpens", "Guilford Court House", "Kings Mountain", "Bennington", "Oriskany",
        "Fort Ticonderoga|Ticonderoga", "Quebec", "Moore's Creek Bridge", "Charleston", "Savannah", "Stony Point",
        "Red Bank", "Springfield", "Assunpink Creek|Second Trenton", "Chesapeake|Virginia Capes", "Eutaw Springs",
        "Bound Brook", "Paoli", "Fort Mercer",
    ])),
    ("hist-civil-war-battles", "Name a battle of the Civil War.", 0.5, battles([
        "Fort Sumter", "First Bull Run|First Manassas|Bull Run", "Shiloh", "Antietam|Sharpsburg", "Fredericksburg",
        "Chancellorsville", "Gettysburg", "Vicksburg", "Chickamauga", "Chattanooga", "The Wilderness|Wilderness",
        "Spotsylvania Court House|Spotsylvania", "Cold Harbor", "Petersburg", "Atlanta", "Franklin", "Nashville",
        "Appomattox Court House|Appomattox", "Second Bull Run|Second Manassas", "Seven Pines",
        "Seven Days", "Fort Donelson", "Stones River|Murfreesboro", "Mobile Bay", "Hampton Roads",
        "Fort Wagner", "Cedar Creek", "Pea Ridge", "Wilson's Creek", "Kennesaw Mountain", "Bentonville",
        "Fort Henry", "New Orleans", "Port Hudson", "Brandy Station",
    ])),
    ("hist-scotus", "Name a landmark Supreme Court case.", 0.5, [
        "Marbury v. Madison", "McCulloch v. Maryland", "Gibbons v. Ogden", "Dred Scott v. Sandford|Dred Scott",
        "Plessy v. Ferguson", "Brown v. Board of Education|Brown v. Board", "Roe v. Wade", "Miranda v. Arizona",
        "Gideon v. Wainwright", "Mapp v. Ohio", "Tinker v. Des Moines|Tinker", "New Jersey v. T.L.O.|NJ v. TLO",
        "Korematsu v. United States|Korematsu", "Engel v. Vitale", "Loving v. Virginia", "Obergefell v. Hodges",
        "Citizens United v. FEC|Citizens United", "Bush v. Gore", "Dobbs v. Jackson Women's Health Organization|Dobbs",
        "United States v. Nixon", "Schenck v. United States", "Worcester v. Georgia", "Lochner v. New York",
        "Griswold v. Connecticut", "Texas v. Johnson", "Hazelwood v. Kuhlmeier|Hazelwood", "Bethel v. Fraser",
        "Morse v. Frederick", "District of Columbia v. Heller|Heller", "Baker v. Carr",
        "Regents of the University of California v. Bakke|Bakke", "Students for Fair Admissions v. Harvard|SFFA",
        "New York Times v. Sullivan", "New York Times v. United States|Pentagon Papers case",
        "Shelby County v. Holder", "Terry v. Ohio", "West Virginia v. Barnette|Barnette", "Mahanoy v. B.L.|Mahanoy",
    ]),
    ("hist-roman-emperors", "Name a Roman emperor.", 0.6, [
        "Augustus", "Tiberius", "Caligula", "Claudius", "Nero", "Galba", "Otho", "Vitellius", "Vespasian", "Titus",
        "Domitian", "Nerva", "Trajan", "Hadrian", "Antoninus Pius", "Marcus Aurelius", "Lucius Verus", "Commodus",
        "Pertinax", "Septimius Severus", "Caracalla", "Geta", "Elagabalus", "Severus Alexander", "Decius",
        "Valerian", "Gallienus", "Aurelian", "Diocletian", "Maximian", "Constantine the Great|Constantine",
        "Constantius II", "Julian the Apostate|Julian", "Valentinian I", "Valens", "Theodosius I|Theodosius",
        "Honorius", "Romulus Augustulus", "Philip the Arab",
    ]),
    ("hist-english-monarchs", "Name a king or queen of England or Great Britain.", 0.6, [
        "William the Conqueror|William I", "William II", "Henry I", "Stephen", "Henry II", "Richard the Lionheart|Richard I",
        "King John|John", "Henry III", "Edward I", "Edward II", "Edward III", "Richard II", "Henry IV", "Henry V",
        "Henry VI", "Edward IV", "Edward V", "Richard III", "Henry VII", "Henry VIII", "Edward VI", "Lady Jane Grey",
        "Mary I|Bloody Mary", "Elizabeth I", "James I", "Charles I", "Charles II", "James II",
        "William III|William of Orange", "Mary II", "Queen Anne|Anne", "George I", "George II", "George III",
        "George IV", "William IV", "Queen Victoria|Victoria", "Edward VII", "George V", "Edward VIII", "George VI",
        "Elizabeth II", "Charles III",
    ]),
    ("hist-us-wars", "Name a war the United States fought.", 0.5, [
        "Revolutionary War|American Revolution", "Quasi-War", "War of 1812", "Mexican-American War",
        "Civil War", "Spanish-American War", "Philippine-American War", "World War I|WWI|First World War",
        "World War II|WWII|Second World War", "Korean War", "Vietnam War", "Gulf War|Persian Gulf War",
        "War in Afghanistan|Afghanistan War", "Iraq War", "Barbary Wars", "Seminole Wars", "Black Hawk War",
        "Kosovo War",
    ]),
]

P["culture"] = [
    ("cult-pixar", "Name a Pixar movie.", 0.7, [
        "Toy Story", "A Bug's Life", "Toy Story 2", "Monsters, Inc.", "Finding Nemo", "The Incredibles", "Cars",
        "Ratatouille", "WALL-E", "Up", "Toy Story 3", "Cars 2", "Brave", "Monsters University", "Inside Out",
        "The Good Dinosaur", "Finding Dory", "Cars 3", "Coco", "Incredibles 2", "Toy Story 4", "Onward", "Soul",
        "Luca", "Turning Red", "Lightyear", "Elemental", "Inside Out 2", "Elio", "Hoppers", "Toy Story 5",
    ]),
    ("cult-taylor-swift", "Name a Taylor Swift album.", 0.7, [
        "Taylor Swift|Debut", "Fearless", "Speak Now", "Red", "1989", "Reputation", "Lover", "Folklore", "Evermore",
        "Midnights", "The Tortured Poets Department|TTPD", "The Life of a Showgirl",
    ]),
    ("cult-consoles", "Name a video game console.", 0.7, [
        "Atari 2600", "Nintendo Entertainment System|NES", "Super Nintendo|SNES", "Nintendo 64|N64", "GameCube",
        "Wii", "Wii U", "Nintendo Switch|Switch", "Nintendo Switch 2|Switch 2", "Game Boy", "Game Boy Color",
        "Game Boy Advance|GBA", "Nintendo DS|DS", "Nintendo 3DS|3DS", "Virtual Boy", "PlayStation|PS1",
        "PlayStation 2|PS2", "PlayStation 3|PS3", "PlayStation 4|PS4", "PlayStation 5|PS5",
        "PlayStation Portable|PSP", "PlayStation Vita|PS Vita", "Xbox", "Xbox 360", "Xbox One",
        "Xbox Series X|Series X", "Xbox Series S|Series S", "Sega Genesis|Mega Drive", "Dreamcast", "Sega Saturn",
        "Sega Master System", "Game Gear", "Steam Deck", "Atari Jaguar", "ColecoVision", "Intellivision",
        "Magnavox Odyssey", "Neo Geo", "TurboGrafx-16", "Meta Quest|Oculus Quest",
    ]),
    ("cult-social-apps", "Name a social media app.", 0.6, [
        "Instagram", "TikTok", "Snapchat", "Facebook", "X|Twitter", "YouTube", "Reddit", "Pinterest", "LinkedIn",
        "Discord", "WhatsApp", "BeReal", "Threads", "Tumblr", "Bluesky", "Twitch", "Telegram", "WeChat", "Weibo",
        "Vine", "Myspace", "Musical.ly", "Quora", "Clubhouse", "Mastodon", "VSCO", "Lemon8", "GroupMe",
        "Messenger|Facebook Messenger", "Google+", "Signal",
    ]),
    ("cult-fast-food", "Name a fast-food chain.", 0.5, [
        "McDonald's", "Burger King", "Wendy's", "Taco Bell", "KFC", "Subway", "Chick-fil-A", "Chipotle", "Popeyes",
        "Five Guys", "Shake Shack", "In-N-Out", "Panera Bread|Panera", "Domino's", "Pizza Hut", "Papa John's",
        "Little Caesars", "Dunkin'|Dunkin' Donuts|Dunkin", "Starbucks", "Arby's", "Sonic", "Jack in the Box",
        "Dairy Queen", "Panda Express", "Wingstop", "Raising Cane's", "Jersey Mike's", "Wawa", "White Castle",
        "Carl's Jr.", "Hardee's", "Whataburger", "Culver's", "Qdoba", "Moe's", "Cava", "Sweetgreen", "Potbelly",
        "Jimmy John's", "Firehouse Subs", "Bojangles", "Checkers", "Del Taco", "Zaxby's", "Krispy Kreme",
        "Tim Hortons", "Auntie Anne's", "Cinnabon", "Steak 'n Shake", "Long John Silver's",
        "Nathan's Famous|Nathan's", "Crumbl",
    ]),
    ("cult-board-games", "Name a board game.", 0.6, [
        "Monopoly", "Scrabble", "Chess", "Checkers", "Clue|Cluedo", "Risk", "Sorry!|Sorry", "Trouble",
        "Candy Land", "Chutes and Ladders", "The Game of Life|Life", "Battleship", "Connect Four|Connect 4",
        "Guess Who?|Guess Who", "Operation", "Catan|Settlers of Catan", "Ticket to Ride", "Pandemic",
        "Carcassonne", "Codenames", "Stratego", "Othello", "Go", "Backgammon", "Mancala", "Pictionary",
        "Trivial Pursuit", "Boggle", "Mouse Trap", "Hungry Hungry Hippos", "Azul", "Splendor", "Wingspan",
        "Chinese checkers", "Parcheesi", "Sequence", "Mastermind", "Diplomacy", "Axis & Allies", "Scattergories",
        "Twister", "Yahtzee", "Uno",
    ]),
    ("cult-marvel", "Name a Marvel Cinematic Universe movie.", 0.7, [
        "Iron Man", "The Incredible Hulk", "Iron Man 2", "Thor", "Captain America: The First Avenger",
        "The Avengers|Avengers", "Iron Man 3", "Thor: The Dark World", "Captain America: The Winter Soldier",
        "Guardians of the Galaxy", "Avengers: Age of Ultron", "Ant-Man", "Captain America: Civil War",
        "Doctor Strange", "Guardians of the Galaxy Vol. 2", "Spider-Man: Homecoming", "Thor: Ragnarok",
        "Black Panther", "Avengers: Infinity War", "Ant-Man and the Wasp", "Captain Marvel", "Avengers: Endgame",
        "Spider-Man: Far From Home", "Black Widow", "Shang-Chi and the Legend of the Ten Rings|Shang-Chi", "Eternals",
        "Spider-Man: No Way Home", "Doctor Strange in the Multiverse of Madness", "Thor: Love and Thunder",
        "Black Panther: Wakanda Forever", "Ant-Man and the Wasp: Quantumania", "Guardians of the Galaxy Vol. 3",
        "The Marvels", "Deadpool & Wolverine", "Captain America: Brave New World", "Thunderbolts*|Thunderbolts",
        "The Fantastic Four: First Steps|Fantastic Four", "Spider-Man: Brand New Day",
    ]),
    ("cult-streaming", "Name a streaming service.", 0.5, [
        "Netflix", "Hulu", "Disney+|Disney Plus", "HBO Max|Max", "Prime Video|Amazon Prime Video|Amazon Prime",
        "Apple TV+|Apple TV", "Paramount+|Paramount Plus", "Peacock", "YouTube TV", "Spotify", "Apple Music",
        "Crunchyroll", "Tubi", "Pluto TV", "ESPN+", "Sling TV|Sling", "Fubo", "Starz", "Showtime", "SoundCloud",
        "Pandora", "Tidal", "Amazon Music", "YouTube Music", "Mubi", "Criterion Channel", "BritBox", "AMC+",
        "Discovery+", "Funimation", "The Roku Channel", "Fandango at Home|Vudu",
    ]),
    ("cult-disney-animated", "Name a Walt Disney Animation Studios movie.", 0.7, [
        "Snow White and the Seven Dwarfs|Snow White", "Pinocchio", "Fantasia", "Dumbo", "Bambi", "Saludos Amigos",
        "The Three Caballeros", "Make Mine Music", "Fun and Fancy Free", "Melody Time",
        "The Adventures of Ichabod and Mr. Toad", "Cinderella", "Alice in Wonderland", "Peter Pan",
        "Lady and the Tramp", "Sleeping Beauty", "One Hundred and One Dalmatians|101 Dalmatians",
        "The Sword in the Stone", "The Jungle Book", "The Aristocats", "Robin Hood",
        "The Many Adventures of Winnie the Pooh", "The Rescuers", "The Fox and the Hound", "The Black Cauldron",
        "The Great Mouse Detective", "Oliver & Company", "The Little Mermaid", "The Rescuers Down Under",
        "Beauty and the Beast", "Aladdin", "The Lion King", "Pocahontas", "The Hunchback of Notre Dame", "Hercules",
        "Mulan", "Tarzan", "Fantasia 2000", "Dinosaur", "The Emperor's New Groove", "Atlantis: The Lost Empire",
        "Lilo & Stitch", "Treasure Planet", "Brother Bear", "Home on the Range", "Chicken Little",
        "Meet the Robinsons", "Bolt", "The Princess and the Frog", "Tangled", "Winnie the Pooh", "Wreck-It Ralph",
        "Frozen", "Big Hero 6", "Zootopia", "Moana", "Ralph Breaks the Internet", "Frozen II|Frozen 2",
        "Raya and the Last Dragon", "Encanto", "Strange World", "Wish", "Moana 2", "Zootopia 2",
    ]),
    ("cult-sneakers", "Name a sneaker brand.", 0.5, [
        "Nike", "Adidas", "New Balance", "Puma", "Reebok", "Converse", "Vans", "Asics", "Under Armour", "Skechers",
        "Saucony", "Brooks", "Hoka", "On|On Running", "Fila", "Jordan|Air Jordan", "Salomon", "Mizuno", "Allbirds",
        "K-Swiss", "Le Coq Sportif", "Diadora", "Onitsuka Tiger", "Veja", "Golden Goose", "Common Projects", "Keds",
        "Etnies", "DC Shoes", "Altra", "Merrell", "Lululemon",
    ]),
]

US_STATES = """Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho
Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota Mississippi Missouri
Montana Nebraska Nevada New_Hampshire New_Jersey New_Mexico New_York North_Carolina North_Dakota Ohio Oklahoma
Oregon Pennsylvania Rhode_Island South_Carolina South_Dakota Tennessee Texas Utah Vermont Virginia Washington
West_Virginia Wisconsin Wyoming""".split()
US_STATES = [s.replace("_", " ") for s in US_STATES]
assert len(US_STATES) == 50

AFRICA = [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde|Cape Verde", "Cameroon",
    "Central African Republic", "Chad", "Comoros", "Democratic Republic of the Congo|DRC|DR Congo",
    "Republic of the Congo|Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Eswatini|Swaziland",
    "Ethiopia", "Gabon", "The Gambia|Gambia", "Ghana", "Guinea", "Guinea-Bissau",
    "Ivory Coast|Côte d'Ivoire|Cote d'Ivoire", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi",
    "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
    "São Tomé and Príncipe|Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
    "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
]
assert len(AFRICA) == 54, len(AFRICA)

P["world"] = [
    ("world-us-states", "Name a U.S. state.", 0.4, US_STATES),
    ("world-europe", "Name a country in Europe.", 0.5, [
        "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina|Bosnia", "Bulgaria",
        "Croatia", "Cyprus", "Czech Republic|Czechia", "Denmark", "Estonia", "Finland", "France", "Germany",
        "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania",
        "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands|Holland",
        "North Macedonia|Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia",
        "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine",
        "United Kingdom|UK|Britain|Great Britain", "Vatican City|Vatican|Holy See", "Turkey|Türkiye",
    ]),
    ("world-africa", "Name a country in Africa.", 0.5, AFRICA),
    ("world-asia", "Name a country in Asia.", 0.5, [
        "Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China",
        "Georgia", "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait",
        "Kyrgyzstan", "Laos", "Lebanon", "Malaysia", "Maldives", "Mongolia", "Myanmar|Burma", "Nepal",
        "North Korea", "Oman", "Pakistan", "Palestine", "Philippines", "Qatar", "Saudi Arabia", "Singapore",
        "South Korea|Korea", "Sri Lanka", "Syria", "Taiwan", "Tajikistan", "Thailand", "Timor-Leste|East Timor",
        "Turkey|Türkiye", "Turkmenistan", "United Arab Emirates|UAE", "Uzbekistan", "Vietnam", "Yemen", "Russia",
    ]),
    ("world-south-america", "Name a country in South America.", 0.4, [
        "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname",
        "Uruguay", "Venezuela", "French Guiana",
    ]),
    ("world-europe-capitals", "Name a capital city in Europe.", 0.5, [
        "Tirana", "Andorra la Vella", "Vienna", "Minsk", "Brussels", "Sarajevo", "Sofia", "Zagreb", "Nicosia",
        "Prague", "Copenhagen", "Tallinn", "Helsinki", "Paris", "Berlin", "Athens", "Budapest", "Reykjavík|Reykjavik",
        "Dublin", "Rome", "Pristina", "Riga", "Vaduz", "Vilnius", "Luxembourg City|Luxembourg", "Valletta",
        "Chișinău|Chisinau", "Monaco", "Podgorica", "Amsterdam", "Skopje", "Oslo", "Warsaw", "Lisbon", "Bucharest",
        "Moscow", "San Marino", "Belgrade", "Bratislava", "Ljubljana", "Madrid", "Stockholm", "Bern", "Kyiv|Kiev",
        "London", "Vatican City", "Ankara",
    ]),
    ("world-olympic-cities", "Name a city that has hosted the Summer Olympics.", 0.5, [
        "Athens", "Paris", "St. Louis", "London", "Stockholm", "Antwerp", "Amsterdam", "Los Angeles", "Berlin",
        "Helsinki", "Melbourne", "Rome", "Tokyo", "Mexico City", "Munich", "Montreal", "Moscow", "Seoul",
        "Barcelona", "Atlanta", "Sydney", "Beijing", "Rio de Janeiro|Rio",
    ]),
    ("world-rivers", "Name one of the world's major rivers.", 0.6, [
        "Nile", "Amazon", "Yangtze", "Mississippi", "Missouri", "Yellow River|Huang He", "Ob", "Paraná|Parana",
        "Congo", "Amur", "Lena", "Mekong", "Mackenzie", "Niger", "Yenisei", "Murray", "Volga", "Danube", "Rhine",
        "Thames", "Seine", "Ganges|Ganga", "Indus", "Brahmaputra", "Tigris", "Euphrates", "Colorado", "Rio Grande",
        "St. Lawrence|Saint Lawrence", "Columbia", "Ohio", "Hudson", "Delaware", "Zambezi", "Orinoco", "Jordan",
        "Tiber", "Elbe", "Loire", "Po", "Dnieper", "Don", "Irrawaddy", "Yukon", "Snake", "Arkansas", "Tennessee",
        "Potomac",
    ]),
    ("world-mountain-ranges", "Name a mountain range.", 0.6, [
        "Himalayas", "Andes", "Rocky Mountains|Rockies", "Alps", "Appalachian Mountains|Appalachians",
        "Ural Mountains|Urals", "Pyrenees", "Atlas Mountains", "Carpathian Mountains|Carpathians", "Sierra Nevada",
        "Cascade Range|Cascades", "Hindu Kush", "Karakoram", "Tian Shan", "Caucasus Mountains|Caucasus",
        "Apennines", "Great Dividing Range", "Drakensberg", "Scandinavian Mountains", "Zagros Mountains|Zagros",
        "Altai Mountains|Altai", "Kunlun Mountains|Kunlun", "Brooks Range", "Alaska Range", "Coast Mountains",
        "Sierra Madre", "Adirondack Mountains|Adirondacks", "Blue Ridge Mountains|Blue Ridge",
        "Great Smoky Mountains|Smoky Mountains|Smokies", "Pocono Mountains|Poconos", "Catskill Mountains|Catskills",
        "White Mountains", "Green Mountains", "Ramapo Mountains", "Kittatinny Mountains|Kittatinny Ridge",
        "Transantarctic Mountains", "Ozark Mountains|Ozarks",
    ]),
    ("world-currencies", "Name a currency.", 0.5, [
        "U.S. dollar|US dollar|Dollar", "Euro", "Japanese yen|Yen", "British pound|Pound sterling|Pound",
        "Chinese yuan|Yuan|Renminbi", "Swiss franc", "Canadian dollar", "Australian dollar", "Indian rupee|Rupee",
        "Mexican peso|Peso", "Russian ruble|Ruble", "South Korean won|Won", "Brazilian real|Real",
        "South African rand|Rand", "Turkish lira|Lira", "Swedish krona|Krona", "Norwegian krone", "Danish krone",
        "Polish złoty|Zloty|Polish zloty", "Israeli shekel|Shekel", "Saudi riyal|Riyal", "UAE dirham|Dirham",
        "Egyptian pound", "Thai baht|Baht", "Vietnamese dong|Dong", "Indonesian rupiah|Rupiah", "Philippine peso",
        "Nigerian naira|Naira", "Kenyan shilling", "Hong Kong dollar", "Singapore dollar", "New Zealand dollar",
        "Argentine peso", "Chilean peso", "Colombian peso", "Ukrainian hryvnia|Hryvnia", "Pakistani rupee",
    ]),
]

P["seasonal"] = [
    ("seas-thanksgiving", "Name a Thanksgiving dish.", 0.3, [
        "Turkey", "Stuffing|Dressing", "Mashed potatoes", "Gravy", "Cranberry sauce", "Pumpkin pie", "Apple pie",
        "Pecan pie", "Sweet potato casserole|Sweet potatoes|Candied yams", "Green bean casserole|Green beans",
        "Dinner rolls|Rolls", "Cornbread", "Mac and cheese|Macaroni and cheese", "Corn", "Ham", "Deviled eggs",
        "Brussels sprouts", "Butternut squash", "Collard greens", "Sweet potato pie", "Biscuits", "Creamed corn",
        "Salad", "Carrots", "Pumpkin bread",
    ]),
    ("seas-winter-holidays", "Name a holiday celebrated between November and January.", 0.4, [
        "Thanksgiving", "Christmas", "Hanukkah|Chanukah", "Kwanzaa", "New Year's Day", "New Year's Eve", "Diwali",
        "Christmas Eve", "Boxing Day", "Epiphany|Three Kings' Day", "Winter solstice|Yule", "St. Nicholas Day",
        "St. Lucia Day", "Bodhi Day", "Las Posadas", "Martin Luther King Jr. Day|MLK Day", "Orthodox Christmas",
        "Veterans Day", "Lunar New Year|Chinese New Year", "Día de los Muertos|Day of the Dead",
        "All Saints' Day", "Guy Fawkes Night", "Election Day", "Festivus",
    ]),
    ("seas-super-bowl", "Name a team that has won the Super Bowl.", 0.4, [
        "Green Bay Packers|Packers", "Kansas City Chiefs|Chiefs", "New York Jets|Jets",
        "Indianapolis Colts|Baltimore Colts|Colts", "Dallas Cowboys|Cowboys", "Miami Dolphins|Dolphins",
        "Pittsburgh Steelers|Steelers", "Las Vegas Raiders|Oakland Raiders|Raiders",
        "San Francisco 49ers|49ers|Niners", "Washington Commanders|Washington Redskins|Commanders",
        "New York Giants|Giants", "Chicago Bears|Bears", "Denver Broncos|Broncos", "Los Angeles Rams|St. Louis Rams|Rams",
        "Baltimore Ravens|Ravens", "Tampa Bay Buccaneers|Buccaneers|Bucs", "New England Patriots|Patriots",
        "New Orleans Saints|Saints", "Seattle Seahawks|Seahawks", "Philadelphia Eagles|Eagles",
    ]),
    ("seas-christmas-songs", "Name a Christmas song.", 0.4, [
        "Jingle Bells", "Silent Night", "White Christmas", "Rudolph the Red-Nosed Reindeer", "Frosty the Snowman",
        "Deck the Halls", "Joy to the World", "O Holy Night", "Hark! The Herald Angels Sing",
        "O Come, All Ye Faithful", "The First Noel", "We Wish You a Merry Christmas", "Santa Claus Is Comin' to Town",
        "Let It Snow! Let It Snow! Let It Snow!|Let It Snow", "All I Want for Christmas Is You", "Last Christmas",
        "Jingle Bell Rock", "Rockin' Around the Christmas Tree", "Feliz Navidad",
        "Have Yourself a Merry Little Christmas", "It's the Most Wonderful Time of the Year", "Winter Wonderland",
        "Sleigh Ride", "The Little Drummer Boy|Little Drummer Boy", "Carol of the Bells", "O Christmas Tree",
        "The Twelve Days of Christmas|12 Days of Christmas", "Away in a Manger", "God Rest Ye Merry Gentlemen",
        "Go Tell It on the Mountain", "Blue Christmas", "Here Comes Santa Claus", "A Holly Jolly Christmas",
        "Santa Baby", "Baby, It's Cold Outside", "Christmas (Baby Please Come Home)", "Do They Know It's Christmas?",
        "Happy Xmas (War Is Over)", "Wonderful Christmastime", "Mistletoe", "Underneath the Tree", "Santa Tell Me",
        "The Christmas Song|Chestnuts Roasting on an Open Fire", "I'll Be Home for Christmas",
        "It's Beginning to Look a Lot Like Christmas", "Silver Bells", "Up on the Housetop",
        "O Little Town of Bethlehem", "Angels We Have Heard on High", "We Three Kings",
        "Grandma Got Run Over by a Reindeer", "You're a Mean One, Mr. Grinch", "Run Rudolph Run",
        "Christmas Tree Farm",
    ]),
    ("seas-halloween-candy", "Name a candy you might get trick-or-treating.", 0.3, [
        "Reese's|Reese's Peanut Butter Cups", "Kit Kat", "Snickers", "M&M's|M&Ms", "Twix", "Milky Way",
        "3 Musketeers|Three Musketeers", "Hershey's|Hershey bar", "Butterfinger", "Skittles", "Starburst",
        "Candy corn", "Tootsie Roll", "Tootsie Pop", "Smarties", "Nerds", "Sour Patch Kids", "Swedish Fish",
        "Laffy Taffy", "Airheads", "Jolly Rancher", "Dum Dums", "Milk Duds", "Whoppers", "Almond Joy", "Mounds",
        "Baby Ruth", "Crunch", "100 Grand", "PayDay", "Twizzlers", "Hot Tamales", "Mike and Ike", "Lemonheads",
        "Junior Mints", "Raisinets", "SweeTarts", "Pixy Stix", "Charleston Chew", "Heath",
        "York Peppermint Pattie|York", "Rolo", "Hershey's Kisses|Kisses", "Gummy bears", "Warheads", "Ring Pop",
        "Blow Pop", "Bazooka", "Mr. Goodbar", "Whatchamacallit",
    ]),
    ("seas-reindeer", "Name one of Santa's reindeer.", 0.3, [
        "Dasher", "Dancer", "Prancer", "Vixen", "Comet", "Cupid", "Donner|Donder", "Blitzen", "Rudolph",
    ]),
    ("seas-winter-olympics", "Name a Winter Olympic sport.", 0.5, [
        "Alpine skiing", "Biathlon", "Bobsled|Bobsleigh", "Cross-country skiing", "Curling", "Figure skating",
        "Freestyle skiing", "Ice hockey|Hockey", "Luge", "Nordic combined", "Short track speed skating|Short track",
        "Skeleton", "Ski jumping", "Snowboarding", "Speed skating", "Ski mountaineering",
    ]),
    ("seas-spring-holidays", "Name a holiday celebrated in the spring.", 0.4, [
        "Easter", "Passover", "Holi", "Eid al-Fitr|Eid", "St. Patrick's Day", "Mother's Day", "Memorial Day",
        "Earth Day", "April Fools' Day", "Cinco de Mayo", "Mardi Gras", "Nowruz|Persian New Year", "Vaisakhi|Baisakhi",
        "Good Friday", "Palm Sunday", "Arbor Day", "Ash Wednesday", "Vesak|Buddha Day", "Ramadan", "Purim",
        "Father's Day", "Juneteenth", "May Day",
    ]),
]

# Existing families: prompts built only from public facts. Checked against the
# live bank on 2026-11-17; prompts it already had (nj-colleges, nj-shore,
# nj-counties, pu-colleges, pu-eating-clubs, pos-ap) were left out.
P["existing"] = [
    ("nj", "nj-turnpike-service-areas", "Name a New Jersey Turnpike service area.", 0.3, [
        "Clara Barton", "John Fenwick", "Walt Whitman", "James Fenimore Cooper", "Richard Stockton",
        "Woodrow Wilson", "Molly Pitcher", "Joyce Kilmer", "Thomas Edison", "Grover Cleveland", "Vince Lombardi",
        "Alexander Hamilton",
    ]),
    ("nj", "nj-nec-stations", "Name an NJ Transit station on the Northeast Corridor Line.", 0.2, [
        "Trenton", "Hamilton", "Princeton Junction", "Jersey Avenue", "New Brunswick", "Edison", "Metuchen",
        "Metropark", "Rahway", "Linden", "Elizabeth", "North Elizabeth", "Newark Airport|Newark Liberty International Airport",
        "Newark Penn Station|Newark Penn", "Secaucus Junction|Secaucus", "New York Penn Station|Penn Station",
    ]),
    ("sport", "sport-summer-olympics", "Name a Summer Olympic sport.", 0.5, [
        "Archery", "Artistic swimming|Synchronized swimming", "Track and field|Athletics", "Badminton", "Basketball",
        "3x3 basketball", "Beach volleyball", "Boxing", "Breaking|Breakdancing", "Canoeing|Kayaking", "Cycling",
        "Diving", "Equestrian", "Fencing", "Field hockey", "Soccer|Football", "Golf", "Gymnastics", "Handball",
        "Judo", "Marathon swimming", "Modern pentathlon", "Rowing", "Rugby sevens|Rugby", "Sailing", "Shooting",
        "Skateboarding", "Sport climbing|Climbing", "Surfing", "Swimming", "Table tennis|Ping pong", "Taekwondo",
        "Tennis", "Trampoline", "Triathlon", "Volleyball", "Water polo", "Weightlifting", "Wrestling",
        "Baseball", "Softball", "Cricket", "Flag football", "Lacrosse", "Squash",
    ]),
]

# ─── Second batch ────────────────────────────────────────────────────────────

POKEMON = """Bulbasaur Ivysaur Venusaur Charmander Charmeleon Charizard Squirtle Wartortle Blastoise Caterpie Metapod
Butterfree Weedle Kakuna Beedrill Pidgey Pidgeotto Pidgeot Rattata Raticate Spearow Fearow Ekans Arbok Pikachu Raichu
Sandshrew Sandslash Nidoran_(female)|Nidoran Nidorina Nidoqueen Nidoran_(male) Nidorino Nidoking Clefairy Clefable
Vulpix Ninetales Jigglypuff Wigglytuff Zubat Golbat Oddish Gloom Vileplume Paras Parasect Venonat Venomoth Diglett
Dugtrio Meowth Persian Psyduck Golduck Mankey Primeape Growlithe Arcanine Poliwag Poliwhirl Poliwrath Abra Kadabra
Alakazam Machop Machoke Machamp Bellsprout Weepinbell Victreebel Tentacool Tentacruel Geodude Graveler Golem Ponyta
Rapidash Slowpoke Slowbro Magnemite Magneton Farfetch'd Doduo Dodrio Seel Dewgong Grimer Muk Shellder Cloyster Gastly
Haunter Gengar Onix Drowzee Hypno Krabby Kingler Voltorb Electrode Exeggcute Exeggutor Cubone Marowak Hitmonlee
Hitmonchan Lickitung Koffing Weezing Rhyhorn Rhydon Chansey Tangela Kangaskhan Horsea Seadra Goldeen Seaking Staryu
Starmie Mr._Mime Scyther Jynx Electabuzz Magmar Pinsir Tauros Magikarp Gyarados Lapras Ditto Eevee Vaporeon Jolteon
Flareon Porygon Omanyte Omastar Kabuto Kabutops Aerodactyl Snorlax Articuno Zapdos Moltres Dratini Dragonair Dragonite
Mewtwo Mew""".split()
POKEMON = [x.replace("_", " ") for x in POKEMON]
assert len(POKEMON) == 151, len(POKEMON)

STATE_CAPITALS = """Montgomery Juneau Phoenix Little_Rock Sacramento Denver Hartford Dover Tallahassee Atlanta Honolulu Boise
Springfield Indianapolis Des_Moines Topeka Frankfort Baton_Rouge Augusta Annapolis Boston Lansing Saint_Paul|St._Paul
Jackson Jefferson_City Helena Lincoln Carson_City Concord Trenton Santa_Fe Albany Raleigh Bismarck Columbus
Oklahoma_City Salem Harrisburg Providence Columbia Pierre Nashville Austin Salt_Lake_City Montpelier Richmond Olympia
Charleston Madison Cheyenne""".split()
STATE_CAPITALS = [x.replace("_", " ") for x in STATE_CAPITALS]
assert len(STATE_CAPITALS) == 50, len(STATE_CAPITALS)

P["arts"] += [
    ("arts-operas", "Name an opera.", 0.6, [
        "La Bohème|La Boheme", "Carmen", "The Magic Flute|Die Zauberflöte", "Don Giovanni",
        "The Marriage of Figaro|Le nozze di Figaro", "La Traviata", "Aida", "Rigoletto", "Madama Butterfly",
        "Tosca", "Turandot", "The Barber of Seville", "Die Fledermaus", "Fidelio", "Tristan und Isolde",
        "The Ring Cycle|Der Ring des Nibelungen", "Lohengrin", "Parsifal", "Otello", "Falstaff", "Nabucco",
        "Il Trovatore", "Lucia di Lammermoor", "Porgy and Bess", "Pagliacci", "Cavalleria rusticana",
        "Eugene Onegin", "Salome", "Der Rosenkavalier", "Dido and Aeneas", "L'Orfeo", "Così fan tutte|Cosi fan tutte",
        "Peter Grimes", "Nixon in China", "Einstein on the Beach", "Hansel and Gretel", "Faust",
        "Samson and Delilah", "Boris Godunov", "Wozzeck",
    ]),
    ("arts-sondheim", "Name a musical Stephen Sondheim wrote music or lyrics for.", 0.5, [
        "West Side Story", "Gypsy", "A Funny Thing Happened on the Way to the Forum", "Anyone Can Whistle",
        "Do I Hear a Waltz?", "Company", "Follies", "A Little Night Music", "The Frogs", "Pacific Overtures",
        "Sweeney Todd", "Merrily We Roll Along", "Sunday in the Park with George", "Into the Woods", "Assassins",
        "Passion", "Road Show|Bounce", "Saturday Night", "Here We Are",
    ]),
]

P["college"] += [
    ("college-ivy", "Name an Ivy League school.", 0.3, [
        "Princeton University|Princeton", "Harvard University|Harvard", "Yale University|Yale",
        "Columbia University|Columbia", "University of Pennsylvania|Penn|UPenn", "Brown University|Brown",
        "Dartmouth College|Dartmouth", "Cornell University|Cornell",
    ]),
    ("college-big-east", "Name a school in the Big East.", 0.5, [
        "Butler University|Butler", "Creighton University|Creighton", "DePaul University|DePaul",
        "Georgetown University|Georgetown", "Marquette University|Marquette", "Providence College|Providence",
        "St. John's University|St. John's", "Seton Hall University|Seton Hall", "UConn|University of Connecticut",
        "Villanova University|Villanova", "Xavier University|Xavier",
    ]),
    ("college-hbcu", "Name a historically Black college or university (HBCU).", 0.5, [
        "Howard University|Howard", "Spelman College|Spelman", "Morehouse College|Morehouse",
        "Hampton University|Hampton", "Tuskegee University|Tuskegee", "Florida A&M University|FAMU|Florida A&M",
        "North Carolina A&T|NC A&T", "Xavier University of Louisiana", "Fisk University|Fisk",
        "Clark Atlanta University|Clark Atlanta", "Jackson State University|Jackson State",
        "Grambling State University|Grambling", "Southern University", "Prairie View A&M|Prairie View",
        "Tennessee State University|Tennessee State", "Delaware State University|Delaware State",
        "Morgan State University|Morgan State", "Bowie State University|Bowie State",
        "Lincoln University (Pennsylvania)", "Cheyney University|Cheyney", "Alabama State University|Alabama State",
        "Alcorn State University|Alcorn State", "Bethune-Cookman University|Bethune-Cookman",
        "Dillard University|Dillard", "Norfolk State University|Norfolk State", "Virginia State University|Virginia State",
        "Winston-Salem State University|Winston-Salem State", "North Carolina Central University|NCCU",
        "Texas Southern University|Texas Southern", "Wilberforce University|Wilberforce", "Coppin State University|Coppin State",
        "Johnson C. Smith University", "Claflin University|Claflin", "South Carolina State University|SC State",
        "Savannah State University|Savannah State", "Fort Valley State University|Fort Valley State",
        "Albany State University|Albany State", "Kentucky State University|Kentucky State", "Langston University|Langston",
        "Mississippi Valley State University|Mississippi Valley State", "Tougaloo College|Tougaloo",
        "Elizabeth City State University|Elizabeth City State", "Fayetteville State University|Fayetteville State",
        "University of Arkansas at Pine Bluff|UAPB", "University of the District of Columbia|UDC",
    ]),
]

P["people"] += [
    ("people-justices", "Name a U.S. Supreme Court justice, past or present.", 0.5, [
        "John Roberts", "Clarence Thomas", "Samuel Alito", "Sonia Sotomayor", "Elena Kagan", "Neil Gorsuch",
        "Brett Kavanaugh", "Amy Coney Barrett", "Ketanji Brown Jackson", "Ruth Bader Ginsburg|RBG",
        "Antonin Scalia", "Thurgood Marshall", "Sandra Day O'Connor", "Anthony Kennedy", "Stephen Breyer",
        "David Souter", "John Paul Stevens", "Earl Warren", "William Rehnquist", "Oliver Wendell Holmes Jr.",
        "Louis Brandeis", "John Marshall", "Roger Taney", "Warren Burger", "Felix Frankfurter", "Hugo Black",
        "William O. Douglas", "Harry Blackmun", "Byron White", "Lewis Powell", "William Brennan",
        "Benjamin Cardozo", "Charles Evans Hughes", "William Howard Taft", "John Jay", "Joseph Story",
    ]),
    ("people-astronauts", "Name an astronaut.", 0.5, [
        "Neil Armstrong", "Buzz Aldrin", "Michael Collins", "Yuri Gagarin", "John Glenn", "Alan Shepard",
        "Sally Ride", "Mae Jemison", "Valentina Tereshkova", "Chris Hadfield", "Scott Kelly", "Mark Kelly",
        "Peggy Whitson", "Christina Koch", "Jim Lovell", "Gus Grissom", "Ed White", "Roger Chaffee", "Gene Cernan",
        "Pete Conrad", "Alan Bean", "Edgar Mitchell", "Harrison Schmitt", "John Young", "Charlie Duke",
        "Dave Scott", "Jim Irwin", "Eileen Collins", "Christa McAuliffe", "Judith Resnik", "Ellison Onizuka",
        "Ronald McNair", "Kalpana Chawla", "Guion Bluford", "Sunita Williams|Suni Williams", "Butch Wilmore",
        "Jessica Meir", "Victor Glover", "Reid Wiseman", "Jeremy Hansen", "Wally Schirra", "Scott Carpenter",
        "Gordon Cooper", "Deke Slayton", "Tim Peake", "Samantha Cristoforetti",
    ]),
]

P["events"] += [
    ("events-religious-holidays", "Name a religious holiday.", 0.4, [
        "Christmas", "Easter", "Good Friday", "Ash Wednesday", "Pentecost", "Epiphany", "All Saints' Day",
        "Rosh Hashanah", "Yom Kippur", "Passover|Pesach", "Hanukkah|Chanukah", "Purim", "Sukkot", "Shavuot",
        "Eid al-Fitr", "Eid al-Adha", "Ramadan", "Mawlid", "Ashura", "Diwali", "Holi", "Navratri",
        "Dussehra", "Janmashtami", "Raksha Bandhan", "Ganesh Chaturthi", "Vesak", "Bodhi Day",
        "Vaisakhi|Baisakhi", "Guru Nanak Gurpurab|Guru Nanak Jayanti", "Losar", "Obon", "Nowruz",
    ]),
]

P["science"] += [
    ("sci-muscles", "Name a muscle in the human body.", 0.6, [
        "Biceps", "Triceps", "Deltoid|Delts", "Pectoralis major|Pecs", "Latissimus dorsi|Lats",
        "Trapezius|Traps", "Rhomboids", "Rectus abdominis|Abs|Abdominals", "Obliques", "Quadriceps|Quads",
        "Hamstrings", "Gluteus maximus|Glutes", "Gastrocnemius|Calf", "Soleus", "Tibialis anterior",
        "Hip flexors", "Adductors", "Diaphragm", "Masseter", "Sternocleidomastoid", "Rotator cuff",
        "Erector spinae", "Serratus anterior", "Sartorius", "Iliopsoas", "Brachioradialis", "Temporalis",
        "Orbicularis oculi", "Buccinator", "Platysma", "Heart|Cardiac muscle", "Tongue",
    ]),
    ("sci-shapes", "Name a geometric shape.", 0.5, [
        "Triangle", "Square", "Rectangle", "Pentagon", "Hexagon", "Heptagon", "Octagon", "Nonagon", "Decagon",
        "Dodecagon", "Rhombus", "Trapezoid", "Parallelogram", "Kite", "Circle", "Ellipse|Oval", "Cube", "Sphere",
        "Cylinder", "Cone", "Pyramid", "Prism", "Tetrahedron", "Octahedron", "Dodecahedron", "Icosahedron",
        "Torus", "Hemisphere", "Semicircle", "Star", "Heart",
    ]),
    ("sci-mathematicians", "Name a famous mathematician.", 0.6, [
        "Euclid", "Pythagoras", "Archimedes", "Leonhard Euler|Euler", "Carl Friedrich Gauss|Gauss",
        "Isaac Newton|Newton", "Gottfried Leibniz|Leibniz", "Pierre de Fermat|Fermat", "Blaise Pascal|Pascal",
        "René Descartes|Descartes|Rene Descartes", "Bernhard Riemann|Riemann", "David Hilbert|Hilbert",
        "Kurt Gödel|Godel|Gödel", "Alan Turing|Turing", "Srinivasa Ramanujan|Ramanujan", "Emmy Noether|Noether",
        "Évariste Galois|Galois", "Georg Cantor|Cantor", "Fibonacci", "Al-Khwarizmi", "Hypatia", "Ada Lovelace",
        "John Nash", "Henri Poincaré|Poincare", "Joseph-Louis Lagrange|Lagrange", "Pierre-Simon Laplace|Laplace",
        "Joseph Fourier|Fourier", "Augustin-Louis Cauchy|Cauchy", "Jacob Bernoulli|Bernoulli", "John Napier|Napier",
        "G. H. Hardy|Hardy", "Paul Erdős|Erdos", "Grigori Perelman|Perelman", "Andrew Wiles|Wiles",
        "Terence Tao|Tao", "Maryam Mirzakhani|Mirzakhani", "John von Neumann|von Neumann",
        "John Horton Conway|John Conway", "Benoit Mandelbrot|Mandelbrot", "Katherine Johnson",
    ]),
    ("sci-dog-breeds", "Name a dog breed.", 0.5, [
        "Labrador Retriever|Lab|Labrador", "Golden Retriever", "German Shepherd", "French Bulldog|Frenchie",
        "Bulldog|English Bulldog", "Poodle", "Beagle", "Rottweiler", "Dachshund", "German Shorthaired Pointer",
        "Corgi|Pembroke Welsh Corgi", "Australian Shepherd", "Yorkshire Terrier|Yorkie",
        "Cavalier King Charles Spaniel", "Doberman|Doberman Pinscher", "Boxer", "Schnauzer|Miniature Schnauzer",
        "Cane Corso", "Great Dane", "Shih Tzu", "Siberian Husky|Husky", "Bernese Mountain Dog", "Pomeranian",
        "Boston Terrier", "Havanese", "Shetland Sheepdog|Sheltie", "Brittany", "English Springer Spaniel",
        "Cocker Spaniel", "Border Collie", "Chihuahua", "Maltese", "Pug", "Bichon Frise", "Basset Hound",
        "Bloodhound", "Newfoundland", "Saint Bernard|St. Bernard", "Akita", "Shiba Inu", "Greyhound", "Whippet",
        "Dalmatian", "Chow Chow", "Samoyed", "Weimaraner", "Vizsla", "Bull Terrier",
        "Pit Bull|American Pit Bull Terrier", "Jack Russell Terrier", "Papillon", "Irish Wolfhound",
        "Afghan Hound", "Mastiff", "Collie",
    ]),
]

P["history"] += [
    ("hist-vice-presidents", "Name a U.S. vice president.", 0.5, [
        "John Adams", "Thomas Jefferson", "Aaron Burr", "George Clinton", "Elbridge Gerry", "Daniel D. Tompkins",
        "John C. Calhoun", "Martin Van Buren", "Richard Mentor Johnson", "John Tyler", "George M. Dallas",
        "Millard Fillmore", "William R. King", "John C. Breckinridge", "Hannibal Hamlin", "Andrew Johnson",
        "Schuyler Colfax", "Henry Wilson", "William A. Wheeler", "Chester A. Arthur", "Thomas A. Hendricks",
        "Levi P. Morton", "Adlai Stevenson I", "Garret Hobart", "Theodore Roosevelt", "Charles W. Fairbanks",
        "James S. Sherman", "Thomas R. Marshall", "Calvin Coolidge", "Charles G. Dawes", "Charles Curtis",
        "John Nance Garner", "Henry A. Wallace", "Harry S. Truman", "Alben W. Barkley", "Richard Nixon",
        "Lyndon B. Johnson|LBJ", "Hubert Humphrey", "Spiro Agnew", "Gerald Ford", "Nelson Rockefeller",
        "Walter Mondale", "George H. W. Bush", "Dan Quayle", "Al Gore", "Dick Cheney", "Joe Biden", "Mike Pence",
        "Kamala Harris", "JD Vance|J. D. Vance",
    ]),
    ("hist-ancient-civilizations", "Name an ancient civilization.", 0.6, [
        "Ancient Egypt|Egyptians", "Mesopotamia", "Sumer|Sumerians", "Babylon|Babylonians", "Assyria|Assyrians",
        "Persian Empire|Persia|Persians", "Ancient Greece|Greeks", "Ancient Rome|Romans|Roman Empire",
        "Indus Valley Civilization|Indus Valley|Harappa", "Shang dynasty", "Zhou dynasty", "Han dynasty",
        "Maya|Mayans", "Aztec|Aztecs", "Inca|Incas", "Olmec|Olmecs", "Phoenicia|Phoenicians", "Carthage",
        "Hittites", "Minoans", "Mycenaeans", "Etruscans", "Kingdom of Kush|Kush|Nubia", "Aksum|Axum",
        "Celts", "Akkadian Empire|Akkadians", "Norte Chico|Caral", "Maurya Empire|Mauryans", "Gupta Empire",
        "Byzantine Empire|Byzantines",
    ]),
    ("hist-explorers", "Name a famous explorer.", 0.6, [
        "Christopher Columbus|Columbus", "Ferdinand Magellan|Magellan", "Vasco da Gama", "Marco Polo",
        "Leif Erikson", "Amerigo Vespucci", "Hernán Cortés|Cortes|Hernan Cortes", "Francisco Pizarro|Pizarro",
        "Juan Ponce de León|Ponce de Leon", "Hernando de Soto", "Henry Hudson", "Jacques Cartier",
        "Samuel de Champlain", "John Cabot", "Bartolomeu Dias", "James Cook|Captain Cook", "Meriwether Lewis",
        "William Clark", "Sacagawea", "Roald Amundsen", "Robert Falcon Scott", "Ernest Shackleton",
        "Edmund Hillary", "Tenzing Norgay", "Zheng He", "Ibn Battuta", "Francis Drake", "Walter Raleigh",
        "Giovanni da Verrazzano|Verrazzano", "Robert Peary", "Matthew Henson", "David Livingstone", "Abel Tasman",
        "Vitus Bering", "Francisco Vázquez de Coronado|Coronado", "La Salle|René-Robert Cavelier, Sieur de La Salle",
        "Juan Sebastián Elcano", "Pedro Álvares Cabral|Cabral", "Jacques Marquette", "Louis Jolliet",
        "Daniel Boone", "Zebulon Pike", "John Smith",
    ]),
]

P["culture"] += [
    ("cult-beatles-albums", "Name a Beatles album.", 0.6, [
        "Please Please Me", "With the Beatles", "A Hard Day's Night", "Beatles for Sale", "Help!", "Rubber Soul",
        "Revolver", "Sgt. Pepper's Lonely Hearts Club Band|Sgt. Pepper", "Magical Mystery Tour",
        "The White Album|The Beatles", "Yellow Submarine", "Abbey Road", "Let It Be",
    ]),
    ("cult-star-wars", "Name a Star Wars movie.", 0.6, [
        "A New Hope|Star Wars", "The Empire Strikes Back", "Return of the Jedi", "The Phantom Menace",
        "Attack of the Clones", "Revenge of the Sith", "The Force Awakens", "The Last Jedi", "The Rise of Skywalker",
        "Rogue One", "Solo", "The Clone Wars", "The Mandalorian and Grogu",
    ]),
    ("cult-pokemon", "Name one of the original 151 Pokémon.", 0.7, POKEMON),
    ("cult-mario", "Name a character from the Super Mario games.", 0.6, [
        "Mario", "Luigi", "Princess Peach|Peach", "Bowser", "Toad", "Yoshi", "Donkey Kong", "Wario", "Waluigi",
        "Princess Daisy|Daisy", "Rosalina", "Bowser Jr.", "Koopa Troopa", "Goomba", "Boo", "Shy Guy", "Lakitu",
        "Kamek", "Toadette", "Birdo", "Diddy Kong", "Dry Bones", "Piranha Plant", "Chain Chomp", "Bullet Bill",
        "Hammer Bro", "Blooper", "Pauline", "Cappy", "Nabbit", "Larry Koopa", "Morton Koopa Jr.", "Wendy O. Koopa",
        "Iggy Koopa", "Roy Koopa", "Lemmy Koopa", "Ludwig von Koopa", "King Boo", "Petey Piranha", "Funky Kong",
        "Cranky Kong", "Dixie Kong", "Baby Mario", "Baby Luigi", "Toadsworth",
    ]),
    ("cult-cereal", "Name a breakfast cereal.", 0.4, [
        "Cheerios", "Honey Nut Cheerios", "Frosted Flakes", "Froot Loops", "Lucky Charms", "Cinnamon Toast Crunch",
        "Cap'n Crunch", "Rice Krispies", "Corn Flakes", "Raisin Bran", "Special K", "Frosted Mini-Wheats",
        "Cocoa Puffs", "Trix", "Apple Jacks", "Honey Bunches of Oats", "Kix", "Life", "Golden Grahams",
        "Reese's Puffs", "Fruity Pebbles", "Cocoa Pebbles", "Chex", "Wheaties", "Corn Pops", "Honey Smacks",
        "Cookie Crisp", "Count Chocula", "Grape-Nuts", "Shredded Wheat", "Cracklin' Oat Bran", "Cocoa Krispies",
        "Crispix", "Fiber One", "Oatmeal Squares", "Golden Crisp", "Honeycomb",
    ]),
    ("cult-zodiac", "Name a sign of the zodiac.", 0.4, [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn",
        "Aquarius", "Pisces",
    ]),
]

P["world"] += [
    ("world-us-capitals", "Name a U.S. state capital.", 0.4, STATE_CAPITALS),
    ("world-nyc-landmarks", "Name a New York City landmark.", 0.4, [
        "Statue of Liberty", "Empire State Building", "Central Park", "Times Square", "Brooklyn Bridge",
        "Rockefeller Center", "Chrysler Building", "One World Trade Center|Freedom Tower",
        "9/11 Memorial|National September 11 Memorial", "Metropolitan Museum of Art|The Met",
        "Museum of Modern Art|MoMA", "Guggenheim Museum|Guggenheim", "American Museum of Natural History",
        "Grand Central Terminal|Grand Central", "Flatiron Building", "The High Line|High Line",
        "Madison Square Garden|MSG", "Yankee Stadium", "Citi Field", "Wall Street", "Ellis Island", "Coney Island",
        "Carnegie Hall", "Lincoln Center", "St. Patrick's Cathedral", "New York Public Library", "Bryant Park",
        "Washington Square Park", "The Vessel|Vessel", "Hudson Yards", "Radio City Music Hall", "Apollo Theater",
        "Barclays Center", "Prospect Park", "Chelsea Market", "Bronx Zoo", "United Nations Headquarters|UN",
        "Stonewall Inn", "Intrepid Museum", "Battery Park", "Staten Island Ferry", "Broadway",
    ]),
    ("world-landmarks", "Name a famous landmark outside the United States.", 0.6, [
        "Eiffel Tower", "Great Wall of China", "Taj Mahal", "Colosseum", "Machu Picchu", "Pyramids of Giza",
        "Stonehenge", "Big Ben", "Leaning Tower of Pisa", "Sydney Opera House", "Christ the Redeemer", "Petra",
        "Chichén Itzá|Chichen Itza", "Angkor Wat", "Acropolis|Parthenon", "Burj Khalifa", "Sagrada Família",
        "Neuschwanstein Castle", "Kremlin", "Red Square", "St. Basil's Cathedral", "Forbidden City", "Alhambra",
        "Louvre", "Notre-Dame|Notre Dame", "Buckingham Palace", "Tower of London", "Arc de Triomphe",
        "Brandenburg Gate", "Hagia Sophia", "Moai|Easter Island statues", "Great Sphinx|Sphinx", "Mount Fuji",
        "Victoria Falls", "St. Peter's Basilica", "Sistine Chapel", "Trevi Fountain", "Pantheon", "CN Tower",
        "Petronas Towers", "Marina Bay Sands", "Tower Bridge", "London Eye", "Mount Everest",
    ]),
    ("world-caribbean", "Name a country or territory in the Caribbean.", 0.5, [
        "Antigua and Barbuda", "The Bahamas|Bahamas", "Barbados", "Cuba", "Dominica", "Dominican Republic",
        "Grenada", "Haiti", "Jamaica", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
        "Trinidad and Tobago", "Puerto Rico", "Aruba", "Curaçao|Curacao", "Cayman Islands",
        "U.S. Virgin Islands", "British Virgin Islands", "Turks and Caicos", "Guadeloupe", "Martinique",
        "Bonaire", "Sint Maarten|Saint Martin", "Anguilla", "Montserrat",
    ]),
]

P["seasonal"] += [
    ("seas-chinese-zodiac", "Name an animal of the Chinese zodiac.", 0.4, [
        "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat|Sheep|Ram", "Monkey", "Rooster", "Dog",
        "Pig",
    ]),
]

P["existing"] += [
    ("reading", "sr-shakespeare", "Name a play by Shakespeare.", 0.5, [
        "Hamlet", "Macbeth", "Romeo and Juliet", "Othello", "King Lear", "Julius Caesar", "A Midsummer Night's Dream",
        "The Tempest", "Twelfth Night", "Much Ado About Nothing", "The Merchant of Venice", "As You Like It",
        "The Taming of the Shrew", "Antony and Cleopatra", "Richard III", "Henry V", "Richard II",
        "Henry IV, Part 1", "Henry IV, Part 2", "Henry VI, Part 1", "Henry VI, Part 2", "Henry VI, Part 3",
        "Henry VIII", "King John", "The Comedy of Errors", "The Two Gentlemen of Verona",
        "The Merry Wives of Windsor", "Measure for Measure", "Love's Labour's Lost", "All's Well That Ends Well",
        "The Winter's Tale", "Pericles", "Cymbeline", "The Two Noble Kinsmen", "Troilus and Cressida",
        "Coriolanus", "Titus Andronicus", "Timon of Athens",
    ]),
    ("reading", "sr-greek-gods", "Name a figure from Greek mythology's gods and Titans.", 0.5, [
        "Zeus", "Hera", "Poseidon", "Demeter", "Athena", "Apollo", "Artemis", "Ares", "Aphrodite", "Hephaestus",
        "Hermes", "Dionysus", "Hades", "Hestia", "Persephone", "Eros", "Nike", "Hecate", "Pan", "Helios",
        "Selene", "Eos", "Gaia", "Uranus", "Cronus|Kronos", "Rhea", "Nemesis", "Hypnos", "Thanatos", "Iris",
        "Hebe", "Tyche", "Asclepius", "Morpheus", "Nyx", "Prometheus", "Atlas", "Themis", "Mnemosyne", "Oceanus",
    ]),
    ("reading", "sr-hogwarts-professors", "Name a Hogwarts professor.", 0.5, [
        "Albus Dumbledore|Dumbledore", "Minerva McGonagall|McGonagall", "Severus Snape|Snape", "Remus Lupin|Lupin",
        "Gilderoy Lockhart|Lockhart", "Quirinus Quirrell|Quirrell", "Mad-Eye Moody|Alastor Moody",
        "Dolores Umbridge|Umbridge", "Horace Slughorn|Slughorn", "Filius Flitwick|Flitwick",
        "Pomona Sprout|Sprout", "Sybill Trelawney|Trelawney", "Rubeus Hagrid|Hagrid", "Cuthbert Binns|Binns",
        "Aurora Sinistra|Sinistra", "Septima Vector|Vector", "Charity Burbage|Burbage",
        "Wilhelmina Grubbly-Plank|Grubbly-Plank", "Firenze", "Madam Hooch|Rolanda Hooch", "Amycus Carrow",
        "Alecto Carrow", "Silvanus Kettleburn|Kettleburn", "Bathsheba Babbling|Babbling",
    ]),
    ("reading", "sr-dr-seuss", "Name a Dr. Seuss book.", 0.5, [
        "The Cat in the Hat", "Green Eggs and Ham", "How the Grinch Stole Christmas!|The Grinch",
        "Oh, the Places You'll Go!", "One Fish Two Fish Red Fish Blue Fish", "Horton Hears a Who!", "The Lorax",
        "Fox in Socks", "Hop on Pop", "Yertle the Turtle", "The Sneetches", "Horton Hatches the Egg",
        "And to Think That I Saw It on Mulberry Street", "The 500 Hats of Bartholomew Cubbins",
        "Bartholomew and the Oobleck", "If I Ran the Zoo", "If I Ran the Circus", "Thidwick the Big-Hearted Moose",
        "Did I Ever Tell You How Lucky You Are?", "Dr. Seuss's ABC", "Mr. Brown Can Moo! Can You?", "The Foot Book",
        "There's a Wocket in My Pocket!", "Oh, the Thinks You Can Think!", "Happy Birthday to You!",
        "The Cat in the Hat Comes Back", "The Butter Battle Book", "I Can Read with My Eyes Shut!",
        "Daisy-Head Mayzie", "McElligot's Pool", "Scrambled Eggs Super!",
    ]),
    ("sport", "sport-world-cup-hosts", "Name a country that has hosted the men's FIFA World Cup.", 0.5, [
        "Uruguay", "Italy", "France", "Brazil", "Switzerland", "Sweden", "Chile", "England", "Mexico",
        "Germany|West Germany", "Argentina", "Spain", "United States|USA", "South Korea", "Japan", "South Africa",
        "Russia", "Qatar", "Canada",
    ]),
    ("sport", "sport-wnba", "Name a WNBA team.", 0.5, [
        "Atlanta Dream|Dream", "Chicago Sky|Sky", "Connecticut Sun|Sun", "Indiana Fever|Fever",
        "New York Liberty|Liberty", "Washington Mystics|Mystics", "Dallas Wings|Wings", "Las Vegas Aces|Aces",
        "Los Angeles Sparks|Sparks", "Minnesota Lynx|Lynx", "Phoenix Mercury|Mercury", "Seattle Storm|Storm",
        "Golden State Valkyries|Valkyries", "Toronto Tempo|Tempo", "Portland Fire|Fire",
    ]),
    ("nj", "nj-governors", "Name a governor of New Jersey.", 0.3, [
        "Mikie Sherrill", "Phil Murphy", "Chris Christie", "Jon Corzine", "Richard Codey", "Jim McGreevey",
        "Donald DiFrancesco", "Christine Todd Whitman", "Jim Florio", "Tom Kean", "Brendan Byrne",
        "William T. Cahill", "Richard J. Hughes", "Robert B. Meyner", "Alfred E. Driscoll", "Woodrow Wilson",
        "William Livingston",
    ]),
]


def q(s):
    return "'" + s.replace("'", "''") + "'"


HEAD = """-- ═══════════════════════════════════════════════════════════════════════════
-- The Ascent bank: {title}
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
"""


def write(name, title, rows):
    os.makedirs(OUT, exist_ok=True)
    keys = set()
    lines = [HEAD.format(title=title)]
    for family, key, text, wiki, answers in rows:
        assert key not in keys, key
        keys.add(key)
        norms = [a.split("|")[0].lower() for a in answers]
        dup = {n for n in norms if norms.count(n) > 1}
        assert not dup, (key, dup)
        arr = ",\n    ".join(q(a) for a in answers)
        lines.append(f"\n-- {len(answers)} answers\nselect public.ascent_seed_prompt({q(key)}, {q(family)}, {q(text)}, {wiki}, array[\n    {arr}\n]);\n")
    lines.append("\ncommit;\n")
    with open(os.path.join(OUT, name), "w") as f:
        f.write("".join(lines))
    return len(rows)


total = 0
order = ["arts", "college", "people", "events", "science", "history", "culture", "world", "seasonal"]
for i, fam in enumerate(order, 1):
    total += write(f"{i:02d}-{fam}.sql", f"{fam} prompts", [(fam, *p) for p in P[fam]])
total += write("10-existing-families.sql", "more prompts for nj, sport and reading", P["existing"])
print("prompts:", total)
for fam in order:
    print(fam, len(P[fam]))
print("existing", len(P["existing"]))
