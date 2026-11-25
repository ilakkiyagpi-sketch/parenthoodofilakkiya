// The guidance content is written with "he/his/him". For a girl, the same objects are
// rewritten in place to "she/her" (and restored when switching back to a boy).
import { LOG_TYPES, AGE_OPTIONS, POSITIVE_BEHAVIOURS, CHALLENGING_BEHAVIOURS } from './catalog.js';
import { STAGES, MILESTONES, MILESTONE_TIPS } from './stages.js';
import { GUIDE, DAILY_TIPS } from './guide.js';
import { MONTH_THEMES, STAGE_THEMES, MONTHLY_PHYSICAL, EI_ROADMAP } from './devdata.js';
import { LEARNING } from './learning.js';

const TARGETS = { LOG_TYPES, AGE_OPTIONS, POSITIVE_BEHAVIOURS, CHALLENGING_BEHAVIOURS, STAGES, MILESTONES, MILESTONE_TIPS, GUIDE, DAILY_TIPS, MONTH_THEMES, STAGE_THEMES, MONTHLY_PHYSICAL, EI_ROADMAP, LEARNING };
const ORIGINAL = JSON.parse(JSON.stringify(TARGETS));

const toGirl = s => s
  .replace(/\bhimself\b/g, 'herself').replace(/\bHimself\b/g, 'Herself')
  .replace(/\bhe\b/g, 'she').replace(/\bHe\b/g, 'She')
  .replace(/\bhis\b/g, 'her').replace(/\bHis\b/g, 'Her')
  .replace(/\bhim\b/g, 'her').replace(/\bHim\b/g, 'Her');

function transform(v, f) {
  if (typeof v === 'string') return f(v);
  if (Array.isArray(v)) return v.map(x => transform(x, f));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, transform(x, f)]));
  return v;
}

function replaceInPlace(target, fresh) {
  if (Array.isArray(target)) target.splice(0, target.length, ...fresh);
  else { Object.keys(target).forEach(k => delete target[k]); Object.assign(target, fresh); }
}

let current = 'boy';
export function applyPronouns(sex) {
  const want = sex === 'girl' ? 'girl' : 'boy';
  if (want === current) return;
  const f = want === 'girl' ? toGirl : (s => s);
  for (const [k, target] of Object.entries(TARGETS)) replaceInPlace(target, transform(ORIGINAL[k], f));
  current = want;
}

// For short UI strings in app.js
export const pr = sex => sex === 'girl'
  ? { he: 'she', He: 'She', his: 'her', His: 'Her', him: 'her', himself: 'herself' }
  : { he: 'he', He: 'He', his: 'his', His: 'His', him: 'him', himself: 'himself' };
