export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = n => String(n).padStart(2, '0');

export function dateKey(d = new Date()) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
export function fmtTime(ms) { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function toLocalInput(ms) { const d = new Date(ms); return `${dateKey(d)}T${fmtTime(d)}`; }
export function fromLocalInput(v) { return v ? new Date(v).getTime() : null; }
export function fmtDur(min) {
  min = Math.round(min);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
export function fmtDateLong(k) {
  return parseKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateShort(k) { return parseKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
export function hmToMin(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; }
export function minToHm(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

const MS_DAY = 86400000;
export function ageMonths(dob, at = Date.now(), prematureWeeks = 0) {
  if (!dob) return 0;
  let days = (at - parseKey(dob).getTime()) / MS_DAY;
  const chrono = days / 30.4375;
  // Use corrected age for premature babies (3+ weeks early) until 24 months
  if (prematureWeeks >= 3 && chrono < 24) days -= prematureWeeks * 7;
  return Math.max(0, days / 30.4375);
}
export function ageText(dob, at = Date.now()) {
  if (!dob) return '';
  const b = parseKey(dob), n = new Date(at);
  let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth(), d = n.getDate() - b.getDate();
  if (d < 0) { m -= 1; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
  if (m < 0) { y -= 1; m += 12; }
  const parts = [];
  if (y) parts.push(`${y} yr${y > 1 ? 's' : ''}`);
  if (m || !y) parts.push(`${m} mo`);
  if (y < 2) parts.push(`${Math.floor(d / 7)} wk`);
  return parts.join(' ');
}
export function dayOfYear(d = new Date()) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / MS_DAY); }
export function entryMinutes(e, now = Date.now()) { return e.start ? Math.max(0, ((e.end ?? now) - e.start) / 60000) : 0; }
