// Voice: speech-to-text (browser's built-in recogniser) + a simple parser that turns
// sentences like "he ate 4 spoons of ragi porridge and half a banana at 8" into log entries.
// The parent always sees a preview and can edit before saving.

const Rec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const voiceSupported = !!Rec;

let active = null;
export function stopListening() { try { active?.stop(); } catch (e) { /* ignore */ } active = null; }

// onText(finalTextSoFar, interimText) is called as words arrive; onEnd() when stopped.
export function listen({ lang = 'en-IN', onText, onEnd, onError }) {
  if (!Rec) { onError?.('not-supported'); return null; }
  stopListening();
  const r = new Rec();
  r.lang = lang; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
  let finalText = '';
  r.onresult = ev => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalText += (finalText ? ' ' : '') + t.trim();
      else interim += t;
    }
    onText?.(finalText, interim);
  };
  r.onerror = ev => onError?.(ev.error);
  r.onend = () => { if (active === r) active = null; onEnd?.(finalText); };
  r.start();
  active = r;
  return r;
}

// ------------------------------------------------------------------ parser
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, fifty: 50, sixty: 60, hundred: 100, half: 0.5, quarter: 0.25, once: 1, twice: 2, thrice: 3 };
const UNIT = [
  [/^(table ?spoons?|tbsps?|big spoons?)$/, 'tbsp'], [/^(tea ?spoons?|tsps?|small spoons?)$/, 'tsp'], [/^spoons?(ful)?s?$/, 'tbsp'],
  [/^(ml|millilit(er|re)s?|mls)$/, 'ml'], [/^(g|grams?|gms?)$/, 'g'], [/^bowls?$/, 'small bowl'], [/^cups?$/, 'cup'],
  [/^(pieces?|pcs?)$/, 'piece'], [/^slices?$/, 'slice'], [/^handfuls?$/, 'handful'], [/^katoris?$/, 'katori'],
];
const FILLER = /\b(some|little bit of|a little|of|the|his|her|him|he|she|my|baby|food|then|also|just|only|about|around|nearly)\b/g;

function toNum(w) {
  if (w == null) return null;
  w = String(w).toLowerCase().trim();
  if (/^\d+(\.\d+)?$/.test(w)) return Number(w);
  if (/^\d+\/\d+$/.test(w)) { const [a, b] = w.split('/').map(Number); return a / b; }
  return NUM[w] ?? null;
}
const NUMWORD = '(\\d+(?:\\.\\d+)?|\\d+\\/\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|half|quarter)';

// ---- time helpers
function atClock(h, m, ampm, now, daytime = false) {
  const d = new Date(now);
  if (ampm) {
    if (/p/.test(ampm) && h < 12) h += 12;
    if (/a/.test(ampm) && h === 12) h = 0;
    d.setHours(h, m, 0, 0);
    if (d.getTime() > now + 5 * 60000) d.setDate(d.getDate() - 1);
    return d.getTime();
  }
  // no am/pm: pick the most recent past time that matches (h or h+12)
  let cands = [h % 12, (h % 12) + 12].map(hh => { const x = new Date(now); x.setHours(hh, m, 0, 0); if (x.getTime() > now + 5 * 60000) x.setDate(x.getDate() - 1); return x.getTime(); });
  if (daytime) { const day = cands.filter(c => { const hh = new Date(c).getHours(); return hh >= 6 && hh < 22; }); if (day.length) cands = day; }
  return Math.max(...cands);
}
const CLOCK = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?|in the morning|in the evening|at night|in the afternoon)?';
function ampmOf(s) { if (!s) return ''; return /p\.?m|evening|night|afternoon/.test(s) ? 'pm' : 'am'; }

function parseTimes(t, now, daytime = false) {
  const out = {};
  let m;
  if ((m = t.match(new RegExp(`from\\s+${CLOCK}\\s+(?:to|till|until)\\s+${CLOCK}`)))) {
    const ap2 = ampmOf(m[6]);
    out.end = atClock(+m[4], +(m[5] || 0), ap2, now, daytime);
    out.start = atClock(+m[1], +(m[2] || 0), ampmOf(m[3]) || ap2, out.end);
    if (out.start > out.end) out.start -= 86400000;
    return out;
  }
  if ((m = t.match(new RegExp(`for\\s+(?:about\\s+)?${NUMWORD}\\s*(?:and a half\\s+)?(hours?|hrs?|minutes?|mins?)`)))) {
    let n = toNum(m[1]) || 0;
    if (/and a half/.test(m[0])) n += 0.5;
    out.dur = /h/.test(m[2]) ? n * 60 : n;
  } else if (/for (an|one) hour/.test(t)) out.dur = 60;
  else if (/for half an hour/.test(t)) out.dur = 30;
  if ((m = t.match(new RegExp(`${NUMWORD}\\s*(minutes?|mins?|hours?|hrs?)\\s+ago`)))) {
    const n = (toNum(m[1]) || 0) * (/h/.test(m[2]) ? 60 : 1);
    out.start = now - n * 60000;
  } else if ((m = t.match(new RegExp(`(?:at|around|by|since)\\s+${CLOCK}`)))) {
    out.start = atClock(+m[1], +(m[2] || 0), ampmOf(m[3]), now, daytime);
  } else if (/\b(just now|right now|now)\b/.test(t)) out.start = now;
  return out;
}

// ---- foods: "4 spoons of ragi porridge, half a banana and 2 idlis"
function parseFoods(t) {
  let m = t.match(/\b(?:ate|eaten|eat|had|has|fed|feed|gave|given|finished|took)\b(?:\s+(?:him|her|baby))?\s+(.*)/);
  let body = m ? m[1] : t;
  body = body.replace(/\b(for|at|around|from|since)\b\s+(breakfast|lunch|dinner|snack|\d.*|about.*|one.*|two.*|half an hour.*|an hour.*)$/, '')
    .replace(/\b(for|at)\s+(breakfast|lunch|dinner|snack)\b/g, '')
    .replace(/\b(he|she)\s+(ate|liked|loved|enjoyed|refused|did not|didn't).*$/, '');
  const parts = body.split(/\s*(?:,|\band\b|\bwith\b|\bplus\b|&)\s*/).map(x => x.trim()).filter(Boolean);
  const foods = [];
  for (let p of parts) {
    let qty = '', unit = '';
    let q = p.match(new RegExp(`^${NUMWORD}\\s+(?:a\\s+|an\\s+)?(?:and a half\\s+)?(\\S+)?\\s*(?:of\\s+)?(.*)$`));
    if (q) {
      let n = toNum(q[1]);
      if (/and a half/.test(p)) n += 0.5;
      const maybeUnit = (q[2] || '').toLowerCase();
      const u = UNIT.find(([re]) => re.test(maybeUnit));
      if (u) { unit = u[1]; p = q[3]; } else { unit = 'piece'; p = `${q[2] || ''} ${q[3] || ''}`; }
      qty = n;
    }
    if (/\b(finished|everything|all of it|refused|liked|loved|enjoyed|happily|spat)\b/.test(p)) continue;
    let name = p.replace(/^(a|an)\s+/, '').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2 || /^(it|that|this|all|everything|food)$/.test(name)) continue;
    if (unit === 'piece') name = name.replace(/(i|e)s$/, '$1').replace(/([^s])s$/, '$1'); // "idlis" -> "idli"
    foods.push({ name: name.replace(/^\w/, c => c.toUpperCase()), qty: qty === '' ? '' : String(qty), unit: unit || 'tbsp' });
  }
  return foods.slice(0, 8);
}

const RULES = [
  { type: 'pee', re: /\b(pee|peed|peeing|wee|weed|urin\w*|wet (diaper|nappy))\b/ },
  { type: 'poop', re: /\b(poop\w*|potty|stool|motion|bowel|dirty (diaper|nappy)|passed motion)\b/ },
  { type: 'medicine', re: /\b(medicine|syrup|drops?|tablet|paracetamol|calpol|crocin|dolo|antibiotic|vitamin d|iron drops|gave .*\d+(\.\d+)?\s*ml of)\b/ },
  { type: 'sick', re: /\b(fever|temperature|temp|cough\w*|cold|runny nose|vomit\w*|threw up|loose motion|diarrh\w*|rash|sneez\w*)\b/ },
  { type: 'breastfeed', re: /\b(breast ?fe(e)?d\w*|nursed|nursing|feed(ing)? on (the )?(left|right))\b/ },
  { type: 'bottle', re: /\b(bottle|formula|\d+\s*ml (of )?milk|milk \d+\s*ml)\b/ },
  { type: 'water', re: /\b(water)\b/ },
  { type: 'meal', re: /\b(ate|eaten|eat|had|fed|breakfast|lunch|dinner|snack|porridge|idli|dosa|rice|khichdi|banana|apple|fruit|puree|cerelac|ragi|dal|curd)\b/ },
  { type: 'wake', re: /\b(woke|wake up|woken|got up)\b/ },
  { type: 'nap', re: /\b(nap\w*|slept|sleep|asleep|dozed)\b/ },
  { type: 'bath', re: /\b(bath\w*|shower\w*)\b/ },
  { type: 'massage', re: /\b(massage\w*|oil(ed)?)\b/ },
  { type: 'walk', re: /\b(walk\w*|park|stroll\w*|outside|outdoor)\b/ },
  { type: 'reading', re: /\b(read|story|stories|book)\b/ },
  { type: 'study', re: /\b(rhymes?|flash ?cards?|learning|learnt|learned|study|studied|alphabet|numbers|colou?rs)\b/ },
  { type: 'screen', re: /\b(tv|television|phone|video|youtube|screen|cartoon)\b/ },
  { type: 'play', re: /\b(play\w*|toys?|blocks|ball)\b/ },
  { type: 'growth', re: /\b(weigh\w*|kg|kilos?|height|length|cm)\b/ },
  { type: 'mood', re: /\b(happy|cranky|fussy|irritable|crying|cried|clingy|grumpy|calm|cheerful|sad|angry)\b/ },
];

function mealName(start) {
  const h = new Date(start).getHours();
  return h < 10.5 ? 'Breakfast' : h < 11.5 ? 'Mid-morning snack' : h < 15 ? 'Lunch' : h < 18 ? 'Evening snack' : 'Dinner';
}

function parseOne(sentence, now) {
  const t = ' ' + sentence.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim() + ' ';
  const rule = RULES.find(r => r.re.test(t));
  if (!rule) return [{ type: 'note', start: now, end: null, data: { text: sentence.trim() }, note: '' }];
  let type = rule.type;
  const tm = parseTimes(t, now, ['meal', 'bath', 'massage', 'walk', 'play', 'study', 'reading', 'screen', 'water'].includes(type));
  const data = {};
  let count = 1;
  // night sleep vs nap
  if (type === 'nap' && (/\b(night|bed ?time|went to bed|night sleep)\b/.test(t) || (tm.start && new Date(tm.start).getHours() >= 19))) type = 'sleep';
  const timedTypes = ['nap', 'sleep', 'breastfeed', 'meal', 'bath', 'massage', 'walk', 'reading', 'study', 'screen', 'play'];
  let start = tm.start ?? null, end = tm.end ?? null;
  if (timedTypes.includes(type)) {
    if (tm.dur) {
      if (start == null) { end = now; start = now - tm.dur * 60000; } else end = start + tm.dur * 60000;
    } else if (start == null) start = now;
    if (end == null && type !== 'sleep' && type !== 'nap') end = start; // a past activity without duration
    if (end == null && (type === 'sleep' || type === 'nap')) end = /\b(woke|still|sleeping now|is sleeping)\b/.test(t) ? null : start;
  } else if (start == null) start = now;

  let m;
  switch (type) {
    case 'pee': case 'poop': {
      if ((m = t.match(new RegExp(`${NUMWORD}\\s*times`)))) count = toNum(m[1]) || 1;
      else if (/\btwice\b/.test(t)) count = 2; else if (/\bthrice\b/.test(t)) count = 3;
      if (/potty/.test(t) && type === 'pee') data.how = 'Potty';
      else if (/toilet/.test(t)) data.how = 'Toilet';
      if (type === 'poop') {
        if (/runny|loose|watery/.test(t)) data.consistency = 'Runny';
        else if (/hard|pellet|constipat/.test(t)) data.consistency = 'Hard / pellets';
        else data.consistency = 'Normal / soft';
      }
      count = Math.min(count, 10);
      break;
    }
    case 'meal': {
      data.foods = parseFoods(t);
      data.meal = /breakfast/.test(t) ? 'Breakfast' : /lunch/.test(t) ? 'Lunch' : /dinner|supper/.test(t) ? 'Dinner' : /snack/.test(t) ? 'Evening snack' : mealName(start);
      if (/\b(finished|all of it|ate (it )?all|everything|full)\b/.test(t)) data.appetite = 'All of it';
      else if (/\b(refused|didn't eat|did not eat|spat)\b/.test(t)) data.appetite = 'Refused';
      else if (/\bhalf of it|ate half\b/.test(t)) data.appetite = 'Half';
      else if (/\b(little|few bites)\b/.test(t)) data.appetite = 'A little';
      if (/\b(himself|by himself|self[- ]fed|on his own|herself)\b/.test(t)) data.selffed = true;
      break;
    }
    case 'breastfeed':
      data.side = /\bboth\b/.test(t) ? 'Both' : /\bleft\b/.test(t) ? 'Left' : /\bright\b/.test(t) ? 'Right' : undefined;
      break;
    case 'bottle': case 'water': {
      if ((m = t.match(/(\d+)\s*(ml|millilit)/))) data.amount = Number(m[1]);
      if (type === 'bottle') data.milk = /formula/.test(t) ? 'Formula' : /cow/.test(t) ? 'Cow milk' : /breast|expressed/.test(t) ? 'Expressed breast milk' : undefined;
      break;
    }
    case 'medicine': {
      if ((m = t.match(/(\d+(?:\.\d+)?)\s*(ml|drops?|tablets?|mg)/))) data.dose = `${m[1]} ${m[2]}`;
      m = t.match(/\b(paracetamol|calpol|crocin|dolo|ibuprofen|meftal|vitamin d\w*|iron drops?|zinc|ors|cetirizine|antibiotic|amoxicillin|azithromycin|[a-z]+ (?:syrup|drops))\b/);
      data.name = m ? m[1].replace(/^\w/, c => c.toUpperCase()) : '';
      break;
    }
    case 'sick': {
      if ((m = t.match(/\b(9[5-9]|10[0-6])(\.\d)?\b/))) data.temp = Number(m[0]);
      else if ((m = t.match(/\b(3[5-9]|4[0-2])(\.\d)?\s*(degrees?\s*)?(c|celsius)\b/))) data.temp = Math.round((Number(m[1] + (m[2] || '')) * 9 / 5 + 32) * 10) / 10;
      const sym = [];
      if (/fever|temperature|temp/.test(t)) sym.push('Fever');
      if (/cough/.test(t)) sym.push('Cough');
      if (/cold|runny nose|sneez/.test(t)) sym.push('Cold / runny nose');
      if (/vomit|threw up/.test(t)) sym.push('Vomiting');
      if (/loose motion|diarrh/.test(t)) sym.push('Loose motion');
      if (/rash/.test(t)) sym.push('Rash');
      data.symptoms = sym;
      break;
    }
    case 'growth': {
      if ((m = t.match(/(\d+(?:\.\d+)?)\s*(kg|kilo)/))) data.weight = Number(m[1]);
      if ((m = t.match(/(\d+(?:\.\d+)?)\s*(cm|centimet)/))) data.height = Number(m[1]);
      break;
    }
    case 'mood': {
      const map = [['happy|cheerful', 'Happy'], ['calm', 'Calm'], ['cranky|fussy|irritable|grumpy', 'Fussy'], ['crying|cried|sad', 'Sad'], ['angry', 'Frustrated'], ['clingy', 'Clingy']];
      data.mood = (map.find(([re]) => new RegExp(re).test(t)) || [])[1];
      break;
    }
    case 'walk': if ((m = t.match(/\b(?:to|in|at) the ([a-z ]+?)(?: for| at| around|$)/))) data.place = m[1].trim(); data.mode = /pram|stroller/.test(t) ? 'Pram / stroller' : /carried/.test(t) ? 'Carried' : undefined; break;
    case 'play': data.where = /outside|outdoor|park|garden/.test(t) ? 'Outdoor' : 'Indoor'; break;
    case 'reading': if ((m = t.match(/read (?:the |a )?(?:book )?"?([a-z ]+?)"?(?: book| for| at|$)/))) data.title = m[1].trim().replace(/\b\w/g, c => c.toUpperCase()); break;
    case 'bath': data.kind = /oil|massage/.test(t) ? 'Oil massage + bath' : /head|hair/.test(t) ? 'Head bath / hair wash' : 'Full bath'; break;
  }
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  const entry = { type, start, end, data, note: sentence.trim() };
  return Array.from({ length: count }, () => ({ ...entry, data: { ...data } }));
}

// Split a spoken paragraph into separate events, then parse each one.
export function parseVoice(text, now = Date.now()) {
  const clean = String(text || '').trim();
  if (!clean) return [];
  const pieces = clean.split(/(?:[.!?;]+(?=\s|$)\s*|\s+(?:and then|after that|then|also|later)\s+)/i).map(x => x.trim()).filter(x => x.length > 1);
  return pieces.flatMap(p => parseOne(p, now));
}
