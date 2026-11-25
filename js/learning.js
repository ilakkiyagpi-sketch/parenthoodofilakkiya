// Learning-time suggestions and wake windows, by age.
// Books are well-known, widely available titles (check the age on the cover).
// Tamil rhymes are traditional. Pratham Books' StoryWeaver (storyweaver.org.in) has
// thousands of free picture books in Tamil and English.

// How long a child usually stays happily awake between sleeps (minutes).
// General guidance only: every child is different, watch his sleepy cues too.
export const WAKE_WINDOWS = [
  { max: 1, range: [35, 60] }, { max: 2, range: [60, 90] }, { max: 4, range: [75, 120] },
  { max: 6, range: [105, 150] }, { max: 9, range: [150, 180] }, { max: 12, range: [180, 240] },
  { max: 18, range: [210, 300] }, { max: 36, range: [300, 360] },
];
export const wakeWindowFor = months => WAKE_WINDOWS.find(w => months < w.max)?.range || null;

export const LEARNING = [
  {
    max: 6,
    morning: ['Hold him face to face and talk slowly for 5 minutes: wait for his coos and reply.',
      'Show a black-and-white picture card 25 cm from his face and move it slowly side to side.',
      'Sing one rhyme with actions while he lies on his back.',
      'Tummy time on your chest: talk to him as he lifts his head.'],
    types: ['High-contrast black, white and red pictures', 'Talking and singing (he loves your voice most)', 'Soft cloth or crinkle book to touch', 'Face-to-face "conversation"'],
    books: [['Look, Look!', 'Peter Linenthal', 'bold black-and-white faces'], ['Black & White', 'Tana Hoban', 'high-contrast pictures'],
      ['Hello, Animals!', 'Smriti Prasadam-Halls', 'high-contrast board book'], ['Global Babies', 'The Global Fund for Children', 'photos of baby faces from around the world']],
    materials: ['High-contrast cards (draw thick black shapes on white card)', 'Unbreakable baby mirror for tummy time', 'Rattle to follow with his eyes', 'Soft crinkle book'],
    rhymes: ['Nila Nila Odi Vaa', 'Chinna Chinna Kannukku', 'Twinkle Twinkle Little Star', 'Rock-a-bye Baby'],
  },
  {
    max: 12,
    morning: ['5 minutes of "point and name": carry him round the house and name 5 things he looks at.',
      'One short board book while he sits on your lap. Let him turn (and chew!) the pages.',
      'Peek-a-boo with a cloth for a few minutes, then say "Where is {name}? There he is!"',
      'Sing one action rhyme (Kai Veesamma) and pause so he can do the action.'],
    types: ['Board books with one big picture per page', 'Lift-the-flap and touch-and-feel books', 'Naming pictures: point, say the word, wait', 'Action rhymes and songs', 'Real objects: show a banana, say "banana", let him hold it'],
    books: [['Dear Zoo', 'Rod Campbell', 'lift-the-flap animals'], ["Where's Spot?", 'Eric Hill', 'lift-the-flap hide and seek'],
      ['Brown Bear, Brown Bear, What Do You See?', 'Bill Martin Jr. & Eric Carle', 'colours and animals, repeating words'],
      ["That's Not My Puppy", 'Fiona Watt (Usborne)', 'touch-and-feel textures'], ['Peek-a-Who?', 'Nina Laden', 'peek-a-boo with rhymes'],
      ['Moo, Baa, La La La!', 'Sandra Boynton', 'animal sounds'], ['Goodnight Moon', 'Margaret Wise Brown', 'calm bedtime words'],
      ['Tulika board books (Tamil / English)', 'Tulika Books', 'Indian pictures and words']],
    materials: ['Picture cards of fruits and animals', 'Stacking cups', 'Soft ball to roll back and forth', 'Shape sorter (show, don\'t test)', 'Steel bowls and a spoon to bang (music!)', 'Cloth for peek-a-boo'],
    rhymes: ['Kai Veesamma Kai Veesu', 'Aana Aana Azhagar Aana', 'Nila Nila Odi Vaa', 'Wheels on the Bus', 'Pat-a-cake', 'Head, Shoulders, Knees and Toes'],
  },
  {
    max: 24,
    morning: ['Read one book and ask "Where is the dog?" — let him point.', 'Name 3 body parts with a song.', 'Sort 5 toys into two baskets by colour together.', 'Let him "help" water a plant and name what you do.'],
    types: ['"Where is…?" pointing books', 'First-words picture books', 'Repeating, rhyming stories he can join in', 'Simple stories about his day (eating, bath, sleep)', 'Songs with actions'],
    books: [['The Very Hungry Caterpillar', 'Eric Carle', 'food, counting, days'], ['Where Is the Green Sheep?', 'Mem Fox', 'opposites and colours'],
      ['Hand, Hand, Fingers, Thumb', 'Al Perkins', 'rhythm and body parts'], ['First 100 Words', 'Roger Priddy', 'naming pictures'],
      ['Each Peach Pear Plum', 'Janet & Allan Ahlberg', 'I-spy rhymes'], ['Pat the Bunny', 'Dorothy Kunhardt', 'touch-and-do'],
      ['Polar Bear, Polar Bear, What Do You Hear?', 'Bill Martin Jr. & Eric Carle', 'animal sounds'], ['Pratham Books Level 1 (free)', 'StoryWeaver', 'short Tamil and English picture stories']],
    materials: ['Big crayons and paper', 'Chunky wooden puzzles (3–4 pieces)', 'Blocks to stack and knock down', 'Picture cards: animals, vehicles, family', 'Toy phone for pretend talk'],
    rhymes: ['Aana Aana Azhagar Aana', 'Thosai Amma Thosai', 'Kai Veesamma Kai Veesu', 'Old MacDonald', 'If You\'re Happy and You Know It'],
  },
  {
    max: 48,
    morning: ['Sing the days of the week and talk about today.', 'Count 5 things at breakfast together.', 'Find 3 things of one colour in the house.', 'Draw for 5 minutes and let him tell you about it.'],
    types: ['Stories with a simple problem and happy ending', 'Feelings books (name the emotion on each page)', 'Counting and colour books', 'Retelling: let him tell the story back with the pictures', 'Rhyming books — leave out the last word for him'],
    books: [['The Gruffalo', 'Julia Donaldson', 'rhymes and a clever mouse'], ["We're Going on a Bear Hunt", 'Michael Rosen', 'actions and sounds'],
      ['The Colour Monster', 'Anna Llenas', 'naming feelings with colours'], ['Owl Babies', 'Martin Waddell', 'missing Amma and her coming back'],
      ['Guess How Much I Love You', 'Sam McBratney', 'love and comparing sizes'], ['The Very Busy Spider', 'Eric Carle', 'farm animals and patience'],
      ['Room on the Broom', 'Julia Donaldson', 'kindness and sharing'], ['Pratham Books Level 1–2 (free)', 'StoryWeaver', 'Tamil and English stories']],
    materials: ['Playdough', 'Puzzles (6–12 pieces)', 'Counting with beads or pebbles', 'Letter and number cards', 'Feelings faces cards', 'Water and sand play with cups'],
    rhymes: ['Thosai Amma Thosai', 'Chinna Chinna Vanna Kuyil', 'Five Little Monkeys', 'Baa Baa Black Sheep', 'One, Two, Buckle My Shoe'],
  },
  {
    max: 84,
    morning: ['Read one page together: he points to words he knows.', 'Two quick sums with fingers or toys.', 'Write his name or one letter with a finger in rice.', '"Word of the day": learn and use one new word.'],
    types: ['Early readers: he reads a few words, you read the rest', 'Stories with a moral (Panchatantra, Tenali Raman)', 'Picture books about feelings and friendship', 'Simple science and nature books', 'Tamil letters with picture words'],
    books: [['Where the Wild Things Are', 'Maurice Sendak', 'anger and calming down'], ['The Way I Feel', 'Janan Cain', 'feelings vocabulary'],
      ['Panchatantra picture stories', 'various', 'animal fables with a lesson'], ['Tenali Raman stories', 'various', 'clever thinking'],
      ['The Gruffalo\'s Child', 'Julia Donaldson', 'courage'], ['Grandma\'s Bag of Stories', 'Sudha Murty', 'Indian stories to read aloud'],
      ['Pratham Books Level 2–3 (free)', 'StoryWeaver', 'Tamil and English early readers']],
    materials: ['Phonics / Tamil uyir ezhuthu cards', 'Simple board games (snakes and ladders)', 'Number line and counters', 'Colouring and tracing books', 'Library card — visit weekly'],
    rhymes: ['Aathichoodi lines (Avvaiyar)', 'Chinna Chinna Vanna Kuyil', 'Days of the week song', 'Months of the year song'],
  },
  {
    max: 999,
    morning: ['10 minutes of reading on his own, then tell you what happened.', 'Mental maths: 5 quick questions at breakfast.', 'Look up one interesting fact together.', 'Write 3 lines in a diary.'],
    types: ['Chapter books he reads alone (15–20 min)', 'Non-fiction he chooses: animals, space, history', 'Comics and graphic novels count too', 'Reading aloud together, then talking about the characters\' feelings', 'Tamil reading: one story or Thirukkural a day'],
    books: [['Malgudi Schooldays', 'R. K. Narayan', 'school life in South India'], ['Grandma\'s Bag of Stories', 'Sudha Murty', 'Indian stories'],
      ['Magic Tree House series', 'Mary Pope Osborne', 'adventure and history'], ['Fantastic Mr Fox', 'Roald Dahl', 'fun first chapter book'],
      ['Tinkle comics', 'Amar Chitra Katha', 'Indian comics'], ['The Room on the Roof', 'Ruskin Bond', 'for older children']],
    materials: ['Library visit each week', 'Thirukkural with meaning', 'Atlas or globe', 'Simple science kit', 'Journal / diary'],
    rhymes: ['Thirukkural of the day', 'Bharathiyar\'s children\'s poems (Odi Vilayaadu Paappa)', 'A poem to learn by heart'],
  },
];
export const learningFor = months => LEARNING.find(l => months < l.max) || LEARNING[LEARNING.length - 1];
