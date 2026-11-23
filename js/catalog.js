// Every kind of thing you can log. Each type declares the age window (in months)
// during which it is shown, so the app grows with the child automatically.
// Field kinds: text, number, select, chips (multi-select), foods, textarea, check, rating

export const SYMPTOMS = ['Fever', 'Cold / runny nose', 'Cough', 'Vomiting', 'Loose motion', 'Constipation', 'Rash', 'Ear pain', 'Teething', 'Not eating', 'Breathing difficulty', 'Very sleepy / dull'];
export const MED_FREQ = ['Once a day', 'Twice a day', '3 times a day', '4 times a day', 'Every 6 hours', 'Every 8 hours', 'At night', 'Only when needed (SOS)'];
export const FOOD_UNITS = ['tsp', 'tbsp', 'ml', 'g', 'small bowl', 'cup', 'piece', 'slice', 'handful', 'katori'];

export const LOG_TYPES = [
  // ---------- Sleep ----------
  { key: 'wake', label: 'Woke up', icon: '🌅', group: 'Sleep', timed: false,
    fields: [{ k: 'mood', label: 'Mood on waking', kind: 'select', options: ['Happy', 'Calm', 'Fussy', 'Crying', 'Sleepy'] }] },
  { key: 'sleep', label: 'Night sleep', icon: '🌙', group: 'Sleep', timed: true,
    fields: [
      { k: 'settle', label: 'How he fell asleep', kind: 'select', options: ['Fed to sleep', 'Rocked', 'Patted', 'Story / song', 'Self-settled', 'Co-slept'] },
      { k: 'wakeups', label: 'Night wake-ups', kind: 'number', unit: 'times' },
      { k: 'quality', label: 'Quality', kind: 'select', options: ['Great', 'Good', 'Restless', 'Poor'] }] },
  { key: 'nap', label: 'Nap', icon: '😴', group: 'Sleep', timed: true, max: 72,
    fields: [
      { k: 'where', label: 'Where', kind: 'select', options: ['Cot / bed', 'Lap', 'Carrier', 'Pram / car', 'Cradle'] },
      { k: 'quality', label: 'Quality', kind: 'select', options: ['Great', 'Good', 'Short', 'Fought it'] }] },

  // ---------- Food ----------
  { key: 'breastfeed', label: 'Breastfeed', icon: '🤱', group: 'Food', timed: true, max: 30,
    fields: [{ k: 'side', label: 'Side', kind: 'select', options: ['Left', 'Right', 'Both'] }] },
  { key: 'bottle', label: 'Milk / bottle', icon: '🍼', group: 'Food', timed: false, max: 48,
    fields: [
      { k: 'milk', label: 'Milk', kind: 'select', options: ['Formula', 'Expressed breast milk', 'Cow milk', 'Other'] },
      { k: 'amount', label: 'Amount', kind: 'number', unit: 'ml' }] },
  { key: 'meal', label: 'Meal / food', icon: '🥣', group: 'Food', timed: true, min: 5,
    fields: [
      { k: 'meal', label: 'Meal', kind: 'select', options: ['Breakfast', 'Mid-morning snack', 'Lunch', 'Evening snack', 'Dinner', 'Extra / other'] },
      { k: 'foods', label: 'What & how much', kind: 'foods' },
      { k: 'appetite', label: 'How much he ate', kind: 'select', options: ['All of it', 'Most', 'Half', 'A little', 'Refused'] },
      { k: 'selffed', label: 'Self-fed (finger food / spoon)', kind: 'check' },
      { k: 'reaction', label: 'Any reaction? (rash, vomiting, gas)', kind: 'text' }] },
  { key: 'water', label: 'Water', icon: '💧', group: 'Food', timed: false, min: 6,
    fields: [{ k: 'amount', label: 'Amount', kind: 'number', unit: 'ml' }] },

  // ---------- Hygiene / toilet ----------
  { key: 'pee', label: 'Pee', icon: '💛', group: 'Toilet', timed: false, quick: true,
    fields: [{ k: 'how', label: 'Where', kind: 'select', options: ['Diaper / nappy', 'Potty', 'Toilet', 'Accident', 'Cloth / langot'] }] },
  { key: 'poop', label: 'Poop', icon: '💩', group: 'Toilet', timed: false,
    fields: [
      { k: 'how', label: 'Where', kind: 'select', options: ['Diaper / nappy', 'Potty', 'Toilet', 'Accident'] },
      { k: 'consistency', label: 'Consistency', kind: 'select', options: ['Normal / soft', 'Runny', 'Hard / pellets', 'Mucus', 'Unusual colour'] }] },
  { key: 'potty', label: 'Potty practice', icon: '🚽', group: 'Toilet', timed: false, min: 15, max: 60,
    fields: [{ k: 'result', label: 'Result', kind: 'select', options: ['Peed in potty', 'Pooped in potty', 'Sat, nothing', 'Refused'] },
      { k: 'asked', label: 'He asked / signalled himself', kind: 'check' }] },
  { key: 'bath', label: 'Bath', icon: '🛁', group: 'Care', timed: true,
    fields: [{ k: 'kind', label: 'Type', kind: 'select', options: ['Full bath', 'Oil massage + bath', 'Head bath / hair wash', 'Sponge bath', 'Shower'] }] },
  { key: 'massage', label: 'Oil massage', icon: '🫗', group: 'Care', timed: true, max: 36,
    fields: [{ k: 'oil', label: 'Oil used', kind: 'text' }] },
  { key: 'teeth', label: 'Brushed teeth', icon: '🪥', group: 'Care', timed: false, min: 6,
    fields: [{ k: 'when', label: 'When', kind: 'select', options: ['Morning', 'Night'] }, { k: 'self', label: 'Brushed by himself', kind: 'check' }] },

  // ---------- Learning ----------
  { key: 'study', label: 'Morning learning', icon: '📚', group: 'Learning', timed: true,
    fields: [
      { k: 'activity', label: 'Activity', kind: 'select', ageOptions: true },
      { k: 'details', label: 'What exactly (book, rhyme, topic, words learnt)', kind: 'textarea' },
      { k: 'focus', label: 'Attention / interest', kind: 'rating' }] },
  { key: 'reading', label: 'Story / book', icon: '📖', group: 'Learning', timed: true,
    fields: [
      { k: 'title', label: 'Book title', kind: 'text' },
      { k: 'by', label: 'Who read', kind: 'select', options: ['Amma', 'Appa', 'Grandparent', 'Read himself', 'Read together', 'Other'] }] },
  { key: 'homework', label: 'Homework', icon: '✏️', group: 'Learning', timed: true, min: 60,
    fields: [
      { k: 'subject', label: 'Subject', kind: 'select', options: ['Maths', 'English', 'Tamil', 'Hindi', 'Science', 'Social', 'Computer', 'Project', 'Other'] },
      { k: 'independent', label: 'Did it independently', kind: 'check' },
      { k: 'details', label: 'Details', kind: 'textarea' }] },
  { key: 'score', label: 'Test / exam score', icon: '🏅', group: 'Learning', timed: false, min: 66,
    fields: [
      { k: 'subject', label: 'Subject', kind: 'text' },
      { k: 'marks', label: 'Marks scored', kind: 'number' },
      { k: 'outof', label: 'Out of', kind: 'number' },
      { k: 'reflection', label: 'What went well / what to improve', kind: 'textarea' }] },

  // ---------- Play & movement ----------
  { key: 'play', label: 'Play time', icon: '🧸', group: 'Play', timed: true,
    fields: [
      { k: 'where', label: 'Where', kind: 'select', options: ['Indoor', 'Outdoor'] },
      { k: 'kind', label: 'Kind of play', kind: 'select', ageOptions: true },
      { k: 'with', label: 'With', kind: 'select', options: ['Amma', 'Appa', 'Grandparents', 'Other children', 'Alone (supervised)', 'Whole family'] },
      { k: 'details', label: 'Details', kind: 'text' }] },
  { key: 'floor', label: 'Floor / crawl time', icon: '🐛', group: 'Play', timed: true, max: 15,
    fields: [{ k: 'skill', label: 'Practising', kind: 'select', options: ['Crawling', 'Pulling to stand', 'Cruising', 'Sitting', 'Reaching / grasping'] }] },
  { key: 'walk', label: 'Evening walk / outdoors', icon: '🌳', group: 'Play', timed: true,
    fields: [
      { k: 'place', label: 'Place', kind: 'text' },
      { k: 'mode', label: 'How', kind: 'select', options: ['Pram / stroller', 'Carried', 'Walked himself', 'Cycle / scooter', 'Mixed'] }] },
  { key: 'exercise', label: 'Sport / exercise', icon: '⚽', group: 'Play', timed: true, min: 42,
    fields: [{ k: 'sport', label: 'Activity', kind: 'text' }, { k: 'effort', label: 'Effort', kind: 'rating' }] },
  { key: 'screen', label: 'Screen time', icon: '📱', group: 'Play', timed: true,
    fields: [
      { k: 'content', label: 'What was watched / played', kind: 'text' },
      { k: 'coviewing', label: 'Watched together with a parent', kind: 'check' }] },
  { key: 'hobby', label: 'Hobby / class', icon: '🎨', group: 'Play', timed: true, min: 36,
    fields: [{ k: 'hobby', label: 'Hobby', kind: 'text' }, { k: 'details', label: 'Details', kind: 'text' }] },
  { key: 'chore', label: 'Helped at home', icon: '🧹', group: 'Character', timed: false, min: 24,
    fields: [{ k: 'task', label: 'Task', kind: 'text' }, { k: 'asked', label: 'Did it without being asked', kind: 'check' }] },

  // ---------- Health ----------
  { key: 'growth', label: 'Weight / height', icon: '📏', group: 'Health', timed: false,
    fields: [
      { k: 'weight', label: 'Weight', kind: 'number', unit: 'kg', step: '0.01' },
      { k: 'height', label: 'Height / length', kind: 'number', unit: 'cm', step: '0.1' },
      { k: 'head', label: 'Head circumference', kind: 'number', unit: 'cm', step: '0.1', max: 36 }] },
  { key: 'illness', label: 'Illness', icon: '🤒', group: 'Health', timed: false,
    fields: [
      { k: 'title', label: 'What is it? (e.g. Cold & fever)', kind: 'text' },
      { k: 'symptoms', label: 'Symptoms', kind: 'chips', options: SYMPTOMS },
      { k: 'diagnosis', label: "Doctor's diagnosis", kind: 'text' },
      { k: 'recovered', label: 'Recovered on (leave empty while still sick)', kind: 'date' },
      { k: 'notes', label: 'Notes', kind: 'textarea' }] },
  { key: 'sick', label: 'Temperature / symptoms', icon: '🌡️', group: 'Health', timed: false,
    fields: [
      { k: 'temp', label: 'Temperature', kind: 'number', unit: '°F', step: '0.1' },
      { k: 'symptoms', label: 'Symptoms', kind: 'chips', options: SYMPTOMS },
      { k: 'illness', label: 'Part of which illness', kind: 'illness' },
      { k: 'action', label: 'What we did', kind: 'textarea' }] },
  { key: 'medicine', label: 'Medicine given', icon: '💊', group: 'Health', timed: false,
    fields: [
      { k: 'name', label: 'Medicine', kind: 'text', list: 'medlist' },
      { k: 'dose', label: 'Dose (e.g. 2.5 ml, 1 drop)', kind: 'text' },
      { k: 'illness', label: 'For which illness', kind: 'illness' }] },
  { key: 'prescription', label: 'Prescription', icon: '📄', group: 'Health', timed: false,
    fields: [
      { k: 'doctor', label: 'Doctor', kind: 'text', list: 'doclist' },
      { k: 'clinic', label: 'Hospital / clinic', kind: 'text' },
      { k: 'diagnosis', label: 'Diagnosis / reason', kind: 'text' },
      { k: 'meds', label: 'Medicines prescribed', kind: 'meds' },
      { k: 'advice', label: 'Advice / instructions', kind: 'textarea' },
      { k: 'nextVisit', label: 'Next visit / review date', kind: 'date' },
      { k: 'illness', label: 'For which illness', kind: 'illness' }] },
  { key: 'tooth', label: 'New tooth', icon: '🦷', group: 'Health', timed: false, max: 36,
    fields: [{ k: 'which', label: 'Which tooth', kind: 'text' }] },
  { key: 'doctor', label: 'Doctor visit', icon: '🩺', group: 'Health', timed: false,
    fields: [
      { k: 'reason', label: 'Reason (check-up, vaccine, illness…)', kind: 'text' },
      { k: 'doctor', label: 'Doctor', kind: 'text', list: 'doclist' },
      { k: 'advice', label: 'What the doctor said', kind: 'textarea' },
      { k: 'nextVisit', label: 'Next visit date', kind: 'date' },
      { k: 'illness', label: 'Related illness', kind: 'illness' }] },

  // ---------- Feelings & memories ----------
  { key: 'mood', label: 'Mood check', icon: '🙂', group: 'Feelings', timed: false,
    fields: [
      { k: 'mood', label: 'Main feeling', kind: 'select', ageOptions: true },
      { k: 'intensity', label: 'How strong', kind: 'rating' },
      { k: 'why', label: 'What caused it (if known)', kind: 'text' },
      { k: 'named', label: 'We named the feeling together', kind: 'check' }] },
  { key: 'bond', label: 'Talk / bonding time', icon: '💞', group: 'Feelings', timed: true,
    fields: [{ k: 'what', label: 'What we did', kind: 'select', ageOptions: true }, { k: 'details', label: 'Details', kind: 'text' }] },
  { key: 'gratitude', label: 'Gratitude / good thing', icon: '🙏', group: 'Feelings', timed: false, min: 36,
    fields: [{ k: 'text', label: 'Today he was thankful for…', kind: 'textarea' }] },
  { key: 'journal', label: 'Child journal', icon: '📓', group: 'Feelings', timed: false, min: 96,
    fields: [{ k: 'text', label: 'Entry (his own words)', kind: 'textarea' }] },
  { key: 'memory', label: 'New thing / memory', icon: '✨', group: 'Feelings', timed: false,
    fields: [
      { k: 'text', label: 'What did he do? (e.g. clapped, said "amma", stood alone)', kind: 'textarea' },
      { k: 'area', label: 'Area', kind: 'select', options: ['Movement', 'Language / words', 'Social & feelings', 'Thinking / play', 'Eating', 'Self-care', 'Other'] },
      { k: 'first', label: 'This is a "first" ⭐', kind: 'check' }] },
  { key: 'note', label: 'Quick note', icon: '📝', group: 'Feelings', timed: false,
    fields: [{ k: 'text', label: 'Note', kind: 'textarea' }] },
];

// Options that change with age. Resolved by fieldOptions(type, field, months).
export const AGE_OPTIONS = {
  'study.activity': [
    { max: 24, options: ['Reading aloud', 'Rhymes / songs', 'Picture cards / naming', 'Serve-and-return talk', 'Sensory play', 'Music & movement', 'Shapes / stacking', 'Mirror play'] },
    { max: 48, options: ['Reading aloud', 'Rhymes / songs', 'Colours & shapes', 'Counting', 'Letters / phonics', 'Puzzles', 'Drawing / scribbling', 'Nature talk', 'Pretend play'] },
    { max: 84, options: ['Phonics / reading', 'Writing practice', 'Numbers / maths', 'Story reading', 'Puzzles / logic', 'Drawing / art', 'Science exploring', 'Second language'] },
    { max: 999, options: ['Reading', 'Maths', 'Science', 'Languages', 'Writing', 'Revision', 'General knowledge', 'Coding / logic', 'Music practice'] }],
  'play.kind': [
    { max: 18, options: ['Toys / rattles', 'Peek-a-boo', 'Stacking / blocks', 'Ball play', 'Water / sand play', 'Musical toys', 'Crawling games', 'Books to chew'] },
    { max: 48, options: ['Blocks / building', 'Pretend play', 'Ball games', 'Art / colouring', 'Playground', 'Water / sand play', 'Music & dance', 'Puzzles', 'Play with other kids'] },
    { max: 999, options: ['Board games', 'Building / Lego', 'Pretend / role play', 'Sports', 'Art & craft', 'Cycling', 'Playground', 'Outdoor games', 'Music', 'Video games'] }],
  'mood.mood': [
    { max: 24, options: ['Happy', 'Calm', 'Curious', 'Excited', 'Fussy', 'Frustrated', 'Scared', 'Sad', 'Clingy', 'Tired'] },
    { max: 999, options: ['Happy', 'Calm', 'Excited', 'Proud', 'Loved', 'Curious', 'Frustrated', 'Angry', 'Sad', 'Scared', 'Worried', 'Jealous', 'Embarrassed', 'Disappointed', 'Bored', 'Tired'] }],
  'bond.what': [
    { max: 24, options: ['Serve & return talk', 'Cuddles / skin-to-skin', 'Singing', 'Peek-a-boo', 'Baby massage', 'Naming things on a walk'] },
    { max: 96, options: ['Special 1-on-1 time', 'Feelings talk', 'Bedtime chat', 'Cooking together', 'Story telling', 'Nature walk'] },
    { max: 999, options: ['1-on-1 outing', 'Deep talk', 'Shared hobby', 'Family meeting', 'Cooking together', 'Walk & talk'] }],
};

export function typeByKey(key) { return LOG_TYPES.find(t => t.key === key); }

export function typesForAge(months) {
  return LOG_TYPES.filter(t => (t.min ?? 0) <= months && months < (t.max ?? 9999));
}

export function fieldOptions(type, field, months) {
  if (!field.ageOptions) return field.options || [];
  const bands = AGE_OPTIONS[`${type.key}.${field.k}`] || [];
  return (bands.find(b => months < b.max) || bands[bands.length - 1] || { options: [] }).options;
}

export function fieldsForAge(type, months) {
  return type.fields.filter(f => (f.min ?? 0) <= months && months < (f.max ?? 9999));
}

// Behaviour logging (the "Heart" tab)
export const POSITIVE_BEHAVIOURS = [
  { k: 'kindness', label: 'Kindness', icon: '💗' }, { k: 'sharing', label: 'Sharing', icon: '🤝' },
  { k: 'empathy', label: 'Comforted someone', icon: '🫂' }, { k: 'helping', label: 'Helping', icon: '🙌' },
  { k: 'gratitude', label: 'Said thank you / grateful', icon: '🙏' }, { k: 'patience', label: 'Patience / waited', icon: '⏳' },
  { k: 'calming', label: 'Calmed himself', icon: '🌬️' }, { k: 'honesty', label: 'Honesty', icon: '🗣️' },
  { k: 'courage', label: 'Tried something hard', icon: '🦁' }, { k: 'respect', label: 'Respect / manners', icon: '🎩' },
  { k: 'curiosity', label: 'Curiosity / asked why', icon: '🔍' }, { k: 'social', label: 'Social smile / engaged', icon: '😊' },
];
export const CHALLENGING_BEHAVIOURS = [
  { k: 'crying', label: 'Inconsolable crying', icon: '😭' }, { k: 'tantrum', label: 'Tantrum / meltdown', icon: '🌋' },
  { k: 'hitting', label: 'Hitting / biting / pushing', icon: '✋' }, { k: 'throwing', label: 'Throwing things', icon: '🧱' },
  { k: 'defiance', label: 'Refusing / defiance', icon: '🙅' }, { k: 'whining', label: 'Whining', icon: '😩' },
  { k: 'separation', label: 'Separation distress', icon: '🚪' }, { k: 'food', label: 'Food refusal', icon: '🥦' },
  { k: 'sleepfight', label: 'Fighting sleep', icon: '🛏️' }, { k: 'screen', label: 'Screen battle', icon: '📺' },
  { k: 'lying', label: 'Lying', icon: '🤥' }, { k: 'rude', label: 'Rude words / back-talk', icon: '💢' },
  { k: 'sibling', label: 'Conflict with other kids', icon: '⚔️' },
];
export const TRIGGERS = ['Hungry', 'Tired / overdue nap', 'Transition (stopping play, leaving)', 'Wanted something & told no', 'Frustrated with a task',
  'Overstimulated / crowd / noise', 'Wanted attention', 'Unwell / teething', 'Change in routine', 'Another child', 'Screen ended', "Don't know"];
export const RESPONSES = ['Stayed calm & close', 'Named the feeling', 'Emotion coaching (5 steps)', 'Hug / time-in', 'Redirected', 'Offered a choice',
  'Calm-down breathing', 'Ignored minor behaviour', 'Set a clear limit', 'Natural / logical consequence', 'Praised effort', 'Problem-solved together', 'Lost my temper (it happens — repair!)'];
export const OUTCOMES = ['Calmed within 2 min', 'Calmed in 2–10 min', 'Took over 10 min', 'Escalated', 'Repaired & reconnected after'];

// Behaviours worth logging only from a certain age
export const BEHAVIOUR_MIN = { lying: 36, rude: 36, sibling: 18, screen: 18, honesty: 36, respect: 24, sharing: 15, patience: 18, calming: 24, gratitude: 18, empathy: 15, hitting: 9, throwing: 9, whining: 15, defiance: 15, tantrum: 12, helping: 12, courage: 9 };
export const BEHAVIOUR_MAX = { crying: 24, social: 24, separation: 72 };
export function behaviourForAge(list, months) {
  return list.filter(b => (BEHAVIOUR_MIN[b.k] ?? 0) <= months && months < (BEHAVIOUR_MAX[b.k] ?? 9999));
}
