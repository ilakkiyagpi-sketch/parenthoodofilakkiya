// Tamil interface. The screens are written in English; when Tamil is chosen (per phone),
// every label, button and heading that matches an entry below is shown in Tamil as soon
// as it appears on screen. Long articles, milestones and guidance stay in English for now.

const TA = {
  // bottom bar and header
  'Home': 'முகப்பு', 'Diary': 'குறிப்பேடு', 'Health': 'நலம்', 'Heart': 'மனம்', 'More': 'மேலும்', 'Settings': 'அமைப்புகள்',
  // categories
  'Sleep': 'தூக்கம்', 'Food': 'உணவு', 'Toilet': 'கழிவு', 'Play': 'விளையாட்டு', 'Care': 'பராமரிப்பு', 'Learn': 'கற்றல்',
  'Feelings': 'உணர்வு', 'All': 'எல்லாம்',
  // one-tap buttons
  'Night sleep': 'இரவுத் தூக்கம்', 'Nap': 'குட்டித் தூக்கம்', 'Eating': 'சாப்பாடு', 'Breastfeed': 'தாய்ப்பால்', 'Pee': 'சிறுநீர்', 'Poop': 'மலம்',
  'Bath': 'குளியல்', 'New today': 'இன்று புதிது', 'Walk': 'நடை', 'Learning': 'கற்றல்', 'Story': 'கதை', 'Crawl time': 'தவழும் நேரம்',
  'Massage': 'மசாஜ்', 'Homework': 'வீட்டுப்பாடம்', 'Sport': 'விளையாட்டு / உடற்பயிற்சி', 'Screen': 'திரை', 'Woke up': 'எழுந்தாச்சு',
  'Bottle': 'பாட்டில்', 'Water': 'தண்ணீர்', 'Temp': 'காய்ச்சல்', 'Medicine': 'மருந்து', 'Mood': 'மனநிலை', 'Kind act': 'நல்ல செயல்',
  'Note': 'குறிப்பு', 'Teeth': 'பற்கள்', 'Potty try': 'பாட் பயிற்சி', 'Weight/height': 'எடை/உயரம்', 'Doctor visit': 'மருத்துவர் சந்திப்பு',
  'Tough moment': 'கடினமான நேரம்',
  'tap to start': 'தொடங்க தட்டவும்', 'tap to stop': 'நிறுத்த தட்டவும்', 'tap': 'தட்டவும்', 'add': 'சேர்', 'Stop': 'நிறுத்து',
  // log types (full names)
  'Meal / food': 'சாப்பாடு', 'Milk / bottle': 'பால் / பாட்டில்', 'Potty practice': 'பாட் பயிற்சி', 'Oil massage': 'எண்ணெய் மசாஜ்',
  'Brushed teeth': 'பல் துலக்கியது', 'Morning learning': 'காலைக் கற்றல்', 'Story / book': 'கதை / புத்தகம்', 'Play time': 'விளையாட்டு நேரம்',
  'Floor / crawl time': 'தவழும் நேரம்', 'Evening walk / outdoors': 'மாலை நடை / வெளியே', 'Sport / exercise': 'விளையாட்டு / உடற்பயிற்சி',
  'Screen time': 'திரை நேரம்', 'Hobby / class': 'பொழுதுபோக்கு / வகுப்பு', 'Helped at home': 'வீட்டில் உதவி', 'Weight / height': 'எடை / உயரம்',
  'Illness': 'உடல்நலக் குறைவு', 'Temperature / symptoms': 'காய்ச்சல் / அறிகுறிகள்', 'Medicine given': 'மருந்து கொடுத்தது',
  'Prescription': 'மருந்துச் சீட்டு', 'New tooth': 'புதிய பல்', 'Talk / bonding time': 'பேச்சு / அன்பு நேரம்', 'Behaviour': 'நடத்தை',
  'New thing / memory': 'புதிய விஷயம் / நினைவு',
  // home cards
  'Tell me what happened': 'என்ன நடந்தது என்று சொல்லுங்கள்', 'Last feed': 'கடைசியாக பால்', 'Last meal': 'கடைசி சாப்பாடு',
  'Feeding now': 'இப்போது பால் கொடுக்கிறோம்', 'Awake': 'விழித்திருக்கும் நேரம்', 'Learning time': 'கற்றல் நேரம்',
  'Feelings activity': 'உணர்வுச் செயல்பாடு', 'Book, material & rhyme': 'புத்தகம், பொருள், பாடல்', "Today's activity": 'இன்றைய செயல்பாடு',
  'Summary': 'சுருக்கம்', 'Today vs aim': 'இன்று vs இலக்கு', 'Pattern': 'பழக்க முறை', 'Day by day': 'நாள் வாரியாக',
  'This month': 'இந்த மாதம்', 'Milestones & tips': 'வளர்ச்சிப் படிகள் & குறிப்புகள்',
  'sleep': 'தூக்கம்', 'feeds+meals': 'பால்+சாப்பாடு', 'wet': 'ஈரம்', 'play': 'விளையாட்டு', 'meals': 'சாப்பாடு', 'pee': 'சிறுநீர்',
  'outdoor': 'வெளியே', 'screen': 'திரை', 'study': 'படிப்பு', 'active': 'சுறுசுறுப்பு',
  "Today's full timeline is in": 'இன்றைய முழு நேரவரிசை இங்கே:',
  // sheets and common buttons
  "Today's summary": 'இன்றைய சுருக்கம்', 'Daily pattern': 'தினசரி பழக்க முறை', "Today's feelings activity": 'இன்றைய உணர்வுச் செயல்பாடு',
  "Today's kind of reading": 'இன்றைய வாசிப்பு வகை', 'Books to read': 'படிக்க வேண்டிய புத்தகங்கள்', 'Material to use': 'பயன்படுத்த வேண்டிய பொருள்',
  'Rhyme / song': 'பாடல்', 'Feelings activity today': 'இன்றைய உணர்வுச் செயல்பாடு', 'More feelings ideas': 'மேலும் உணர்வு யோசனைகள்',
  'Other ideas': 'வேறு யோசனைகள்', 'Start learning': 'கற்றலைத் தொடங்கு', 'We did it': 'செய்தோம்', '✓ Done today': '✓ இன்று செய்தாச்சு',
  'Serve and return': 'பேசி-பதில் விளையாட்டு', 'Good morning': 'காலை வணக்கம்', 'Awake again': 'மீண்டும் விழித்தாச்சு',
  'Quick learning (5 min)': 'சிறு கற்றல் (5 நிமிடம்)', 'Close': 'மூடு', 'Save': 'சேமி', 'Delete': 'நீக்கு', 'Undo': 'திரும்பப் பெறு',
  'Add details': 'விவரம் சேர்', 'Details': 'விவரம்', 'Done': 'முடிந்தது', 'Cancel': 'ரத்து', 'Back': 'பின்', 'Open': 'திற',
  'Start': 'தொடங்கு', 'End': 'முடிவு', 'Show all': 'அனைத்தையும் காட்டு', '7 days': '7 நாட்கள்', '14 days': '14 நாட்கள்',
  'Average': 'சராசரி', 'This week': 'இந்த வாரம்', 'Last week': 'கடந்த வாரம்', 'Wakes up': 'எழும் நேரம்', 'Bedtime': 'தூங்கும் நேரம்',
  'Total sleep': 'மொத்தத் தூக்கம்', 'Naps': 'குட்டித் தூக்கங்கள்', 'Milk feeds': 'பால் கொடுத்தது', 'Meals': 'சாப்பாடுகள்',
  'Month theme': 'மாதக் கருப்பொருள்', 'Working towards': 'அடுத்து கற்றுக்கொள்வது', 'Should be doing now': 'இப்போது செய்ய வேண்டியவை',
  'Body checks': 'உடல் பரிசோதனைகள்', 'New things': 'புதிய விஷயங்கள்', 'Tip of the day': 'இன்றைய குறிப்பு', 'Next in routine': 'அடுத்த வழக்கம்',
  'Month card': 'மாத அட்டை',
  // diary / timeline
  'in between': 'இடைவெளி', 'carried on': 'தொடர்ந்தது', 'now': 'இப்போது', 'yesterday': 'நேற்று', 'Select to delete': 'நீக்கத் தேர்ந்தெடு',
  'Select all': 'அனைத்தையும் தேர்ந்தெடு', 'selected': 'தேர்ந்தெடுக்கப்பட்டது', 'Add entry to this day': 'இந்த நாளில் பதிவு சேர்',
  'naps': 'குட்டித் தூக்கம்', 'milk': 'பால்', 'pee/poop': 'சிறுநீர்/மலம்',
  // more / settings
  'Ask': 'கேள்', 'Routine': 'வழக்கம்', 'Milestones': 'வளர்ச்சிப் படிகள்', 'Trends': 'போக்குகள்', 'Physical growth': 'உடல் வளர்ச்சி',
  'Foods tried': 'சாப்பிட்ட உணவுகள்', 'Foods': 'உணவுகள்', 'Vaccines': 'தடுப்பூசிகள்', 'Guide': 'வழிகாட்டி', 'Weekly report': 'வார அறிக்கை',
  'Doctor summary': 'மருத்துவர் சுருக்கம்', 'Install app': 'செயலியை நிறுவு', "Amma's wellbeing": 'அம்மாவின் நலம்',
  'Child profile': 'குழந்தை விவரம்', 'Children': 'குழந்தைகள்', 'Family & voice': 'குடும்பம் & குரல்', 'Reminders & alarms': 'நினைவூட்டல்கள் & அலாரம்',
  'Look & theme': 'தோற்றம் & கருப்பொருள்', 'Online backup': 'ஆன்லைன் காப்பு', 'Files & data': 'கோப்புகள் & தரவு', 'About': 'பற்றி',
  'Language': 'மொழி', 'Turn on alarms': 'அலாரத்தை இயக்கு', 'Test alarm': 'அலாரம் சோதனை', 'Turn off': 'நிறுத்து',
  'Alarms are on for this phone': 'இந்த போனில் அலாரம் இயங்குகிறது', 'My daily reminders': 'என் தினசரி நினைவூட்டல்கள்',
  'What to remind me about': 'எதை நினைவூட்ட வேண்டும்', 'Daily learning alarm': 'தினசரி கற்றல் அலாரம்', 'Time': 'நேரம்',
  'Nap time': 'தூக்க நேரம்', 'Feed reminder': 'பால் நினைவூட்டல்', 'Medicines': 'மருந்துகள்',
};
// Phrases inside longer text (numbers stay as they are)
const PHRASES = [
  [/\bNext nap around\b/g, 'அடுத்த தூக்கம் சுமார்'], [/\bNext sleep around\b/g, 'தூக்கம் சுமார்'], [/\bago\b/g, 'முன்பு'],
  [/\bjust now\b/g, 'இப்போதுதான்'], [/\bEvery day\b/g, 'தினமும்'], [/\bnext today at\b/g, 'அடுத்து இன்று'], [/\bnext tomorrow at\b/g, 'அடுத்து நாளை'],
  [/\bNap time now\b/g, 'இப்போது தூங்கும் நேரம்'], [/\bwatch for yawns and eye-rubbing\b/g, 'கொட்டாவி, கண் தேய்ப்பதைக் கவனியுங்கள்'],
  [/\bPast (his|her) usual awake time\b/g, 'வழக்கமான விழிப்பு நேரத்தைத் தாண்டியது'], [/\btry to settle (him|her) soon\b/g, 'விரைவில் தூங்க வையுங்கள்'],
  [/\btoday\b/g, 'இன்று'], [/\bentries\b/g, 'பதிவுகள்'], [/\bentry\b/g, 'பதிவு'],
];

let lang = 'en';
try { lang = localStorage.getItem('hp-lang') || 'en'; } catch (e) { /* private mode */ }
export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'ta' ? 'ta' : 'en';
  try { localStorage.setItem('hp-lang', lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'svg', 'text', 'title']);
function trText(s) {
  const m = s.match(/^(\s*[^\p{L}\p{N}]*?)([\p{L}\p{N}][\s\S]*?)?(\s*[:·.…]?\s*)$/u);
  if (!m || !m[2]) return null;
  const core = m[2].trim();
  if (TA[core]) return m[1] + TA[core] + m[3];
  let out = s, hit = false;
  for (const [re, rep] of PHRASES) { re.lastIndex = 0; if (re.test(out)) { re.lastIndex = 0; out = out.replace(re, rep); hit = true; } }
  return hit ? out : null;
}
function translate(root) {
  if (lang !== 'ta' || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && !SKIP.has(n.parentElement.tagName) && !n.parentElement.closest('[data-since],[data-ago],.no-tr') && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) { const t = trText(n.nodeValue); if (t != null && t !== n.nodeValue) n.nodeValue = t; }
  root.querySelectorAll?.('[aria-label],[placeholder]').forEach(el => {
    for (const a of ['aria-label', 'placeholder']) { const v = el.getAttribute(a); if (v && TA[v]) el.setAttribute(a, TA[v]); }
  });
}
// Translate whatever the app draws (screens, pop-ups, messages)
export function startTranslating() {
  document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
  let queued = false;
  const run = () => { queued = false; ['hdr', 'main', 'sheet', 'toast'].forEach(id => translate(document.getElementById(id))); translate(document.querySelector('nav.tabs')); };
  new MutationObserver(() => { if (lang === 'ta' && !queued) { queued = true; requestAnimationFrame(run); } })
    .observe(document.body, { childList: true, subtree: true });
  run();
}
