// Offline "Ask" assistant — rule-based, no AI, no internet.
// 1) Emergency words → urgent advice first.
// 2) Personal questions → answered from the child's own logs (via ctx functions from app.js).
// 3) Everything else → best-matching entry in the knowledge base, preferring the child's age.
import { KB, SYNONYMS } from './assistant-kb.js';

const STOP = new Set('a an the is are was were be been am i me my we our you your he she him her his hers it its they them their this that these those to of in on at for with and or but if so do does did can could should would will shall may might must how what when where why which who whom much many any some there here have has had not no yes very too just than then about from up down out over under again more most also please tell know want need get got make give take baby child kid son daughter month months year years old age now today'.split(' '));

const norm = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}\s]/gu, ' ');
// common phrases → one meaningful word before matching
const PHRASES = [
  [/\b(not|isn'?t|doesn'?t|does not|won'?t|refus\w*( to)?) (eating|eat|taking food|having food)\b/g, ' refuse '],
  [/\b(not|doesn'?t|does not|won'?t) (sleeping|sleep)\b/g, ' waking '],
  [/\b(not|isn'?t|doesn'?t) (talking|speaking|talk|speak)\b/g, ' delay '],
  [/\b(cries|crying) a lot\b|\bcolic\b/g, ' cry fussy settle '],
];
function tokens(s) {
  let t = norm(s);
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);
  return t.split(/\s+/).filter(Boolean).map(w => {
    w = SYNONYMS[w] || w;
    if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    return SYNONYMS[w] || w;
  }).filter(w => !STOP.has(w) && w.length > 1);
}

// Build a small weighted index once
const INDEX = KB.map((e, i) => {
  const w = {};
  const add = (text, weight) => tokens(text).forEach(t => { w[t] = Math.max(w[t] || 0, weight); });
  add(e.t, 1); add(e.k, 1.5); add(e.q, 2);
  return { i, w };
});
const DF = {};
INDEX.forEach(x => Object.keys(x.w).forEach(t => { DF[t] = (DF[t] || 0) + 1; }));
const idf = t => Math.log(1 + KB.length / (DF[t] || 1));

export function searchKB(question, months) {
  const q = [...new Set(tokens(question))];
  if (!q.length) return [];
  return INDEX.map(x => {
    let s = 0;
    for (const t of q) if (x.w[t]) s += x.w[t] * idf(t);
    const e = KB[x.i];
    if (months < e.min || months >= e.max) s *= 0.35; // other ages: still findable, ranked lower
    return { e, s };
  }).filter(r => r.s > 0).sort((a, b) => b.s - a.s);
}

const EMERGENCY = /\b(not breathing|can'?t breathe|cannot breathe|difficult(y)? (in )?breathing|breathing (fast|hard)|blue lips|turn(ed|ing)? blue|seizure|fits?\b|convulsion|unconscious|not waking|won'?t wake|fell .*head|head injury|swallow(ed)? .*(battery|coin|magnet|medicine|tablet|poison)|poison|kerosene|burn(ed|t)?\b|heavy bleeding|choking)/;

// Personal intents: [pattern, handler(ctx, text)] — handlers return answer lines
const INTENTS = [
  [/\b(how old|what is (his|her|my (baby|child|son|daughter)'?s?) age|age of)\b/, async c => [`${c.name} is ${c.ageText()} old (${c.stageName}).`]],
  [/(when|last|since).*(feed|fed|breastfe|nurs|milk|bottle)|(feed|fed).*(last|ago)/, async c => c.lastFeed()],
  [/(how many|count|number of).*(pee|wee|urin|wet|napp|diaper)|(pee|wet napp).*(today|count)/, async c => c.counts('pee')],
  [/(how many|count|number of).*(poop|potty|stool|motion|poo)|(poop|motion).*(today|count)/, async c => c.counts('poop')],
  [/(sleep|slept|nap).*(enough|this week|average|last week|7 days)|(enough|average) sleep|is .* sleeping enough/, async c => c.sleepWeek()],
  [/(how (much|long) (did|has)|did (he|she|\w+) (sleep|nap)).*|(sleep|slept|nap).*(today|yesterday|last night)/, async c => c.sleepDay(/yesterday|last night/.test(c.text) ? -1 : 0)],
  [/what did .* (eat|have)|(food|meals?|ate).*(today|yesterday)/, async c => c.foodDay(/yesterday/.test(c.text) ? -1 : 0)],
  [/(new|how many|which|what) foods?.*(tried|introduc|new|so far)|foods? (tried|introduced)/, async c => c.foodsTried()],
  [/percentile|(his|her|my (baby|child|son|daughter)'?s?|is (he|she)) .*(weight|height|heavy|tall|growth)|(weight|height) (now|currently|normal for (him|her))/, async c => c.growth()],
  [/(next|due|upcoming|pending|overdue|which).*(vaccin|injection|shot|thadupoosi)|vaccin.*(next|due|pending)/, async c => c.nextVaccine()],
  [/milestone|what should (he|she|my baby|my child|my son|my daughter) (be )?(do|doing)|what can (he|she) do (now|at this age)/, async c => c.milestones()],
  [/(what'?s next|what is next|next in (the )?routine|what should we do now|timetable)/, async c => c.nextRoutine()],
  [/(medicine|dose|syrup|paracetamol|drops).*(next|when|due|last|given)|next dose/, async c => c.meds()],
  [/(why|trigger|pattern|reason).*(tantrum|cry|angry|upset|behav|meltdown)/, async c => c.triggers()],
  [/screen.*(week|today|how much did|how long did)/, async c => c.screenWeek()],
  [/(how active|outdoor|active play|played).*(week|today)/, async c => c.activeWeek()],
];

const fill = (s, c) => s.replace(/\{name\}/g, c.name).replace(/\{he\}/g, c.P.he).replace(/\{his\}/g, c.P.his).replace(/\{him\}/g, c.P.him).replace(/\{himself\}/g, c.P.himself).replace(/\{age\}/g, c.ageText());

export async function answer(question, c) {
  const text = norm(question).replace(/\s+/g, ' ').trim();
  c.text = text;
  if (!text) return null;
  const hits = searchKB(question, c.months);
  const related = hits.slice(0, 4).map(h => h.e.q);
  // 1) emergencies
  if (EMERGENCY.test(text)) {
    const e = KB.find(x => x.q.startsWith('When should I take my child to the hospital'));
    const extra = hits.find(h => h.e !== e && h.s > 2)?.e;
    return { urgent: true, title: '🚨 This may be an emergency', lines: e.a.map(l => fill(l, c)), extra: extra ? { title: extra.q, lines: extra.a.map(l => fill(l, c)) } : null, related: related.filter(q => q !== e.q).slice(0, 3) };
  }
  // 2) personal questions from the logs
  for (const [re, fn] of INTENTS) {
    if (re.test(text)) {
      const lines = await fn(c, text);
      if (lines?.length) return { personal: true, title: `📒 From ${c.name}'s logs`, lines, related: related.slice(0, 3) };
    }
  }
  // 3) knowledge base
  const best = hits[0];
  if (best && best.s >= 2.2) {
    const outOfAge = c.months < best.e.min || c.months >= best.e.max;
    return { title: fill(best.e.q, c), topic: best.e.t, src: best.e.src, lines: best.e.a.map(l => fill(l, c)), note: outOfAge ? `(This is mainly for children ${ageRange(best.e)}.)` : '', related: hits.slice(1, 4).filter(h => h.s > 1).map(h => h.e.q) };
  }
  return { unknown: true, title: "I'm not sure about that one yet", lines: ['Try asking in a different way, or pick a topic below. For anything worrying about health, please ask your paediatrician.'], related: hits.slice(0, 4).map(h => h.e.q) };
}

const ageRange = e => `${e.min < 24 ? e.min + ' months' : e.min / 12 + ' years'} to ${e.max < 24 ? e.max + ' months' : e.max >= 240 ? '18+ years' : e.max / 12 + ' years'}`;

// Starter questions shown as chips, chosen for the child's age
export function suggestions(months) {
  const personal = months < 36 ? ['When was the last feed?', 'Is he sleeping enough?', 'What did he eat today?', 'Next vaccine?'] : ['Is he sleeping enough?', 'How much screen time this week?', 'Next vaccine?', 'What should he be doing now?'];
  const topical = KB.filter(e => months >= e.min && months < e.max && !/how to use/i.test(e.q)).map(e => e.q);
  const pick = [];
  const day = Math.floor(Date.now() / 86400000);
  for (let i = 0; i < 4 && topical.length; i++) pick.push(topical[(day * 7 + i * 11) % topical.length]);
  return [...personal, ...new Set(pick)];
}

export const TOPICS = [...new Set(KB.map(e => e.t))];
export const questionsFor = (topic, months) => KB.filter(e => e.t === topic).sort((a, b) => (months >= b.min && months < b.max) - (months >= a.min && months < a.max)).map(e => e.q);
