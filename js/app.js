import { db } from './db.js';
import { LOG_TYPES, FOOD_UNITS, typeByKey, typesForAge, fieldOptions, fieldsForAge,
  POSITIVE_BEHAVIOURS, CHALLENGING_BEHAVIOURS, TRIGGERS, RESPONSES, OUTCOMES, behaviourForAge } from './catalog.js';
import { STAGES, stageFor, nextStage, MILESTONES, RED_FLAGS, VACCINES } from './stages.js';
import { GUIDE, DAILY_TIPS } from './guide.js';
import { esc, uid, dateKey, parseKey, addDays, fmtTime, toLocalInput, fromLocalInput, fmtDur, fmtDateLong, fmtDateShort,
  hmToMin, minToHm, ageMonths, ageText, dayOfYear, entryMinutes } from './util.js';
import { barChart, pairChart, lineChart, wireTooltips } from './charts.js';

// ------------------------------------------------------------------ state
const S = {
  settings: null, months: 0, stage: null,
  view: 'today', diaryDate: dateKey(), growTab: 'milestones', trendDays: 7, guideAll: false,
};
const $ = sel => document.querySelector(sel);
const main = () => $('#main');

const DEFAULT_SETTINGS = { name: '', dob: '', premature: 0, wake: '06:30', caregivers: ['Amma', 'Appa', 'Paati', 'Thatha'], me: 'Amma', theme: 'auto' };

// Pseudo log types handled outside the catalog
const SPECIAL = {
  behaviour: { key: 'behaviour', label: 'Behaviour', icon: '🧭' },
  ei: { key: 'ei', label: 'EI activity', icon: '💛' },
};
const typeInfo = k => typeByKey(k) || SPECIAL[k] || { key: k, label: k, icon: '•' };

// ------------------------------------------------------------------ boot
async function boot() {
  S.settings = await db.getKV('settings');
  applyTheme();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  wireTooltips(document.body);
  setInterval(tickTimers, 1000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!S.settings?.dob) return renderOnboarding();
  await refreshAge();
  route();
}

async function refreshAge() {
  S.months = ageMonths(S.settings.dob, Date.now(), Number(S.settings.premature) || 0);
  S.stage = stageFor(S.months);
}

function applyTheme() {
  const t = S.settings?.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function route() {
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === S.view ? 'page' : 'false'));
  renderHeader();
  ({ today: renderToday, diary: renderDiary, routine: renderRoutine, heart: renderHeart, grow: renderGrow, guide: renderGuide, settings: renderSettings })[S.view]();
  window.scrollTo(0, 0);
}

function renderHeader() {
  const s = S.settings;
  $('#hdr').innerHTML = `<div class="who"><div class="avatar">${esc((s.name || '?')[0])}</div>
    <div><div class="name">${esc(s.name)}</div><div class="sub">${esc(ageText(s.dob))} · ${S.stage.emoji} ${esc(S.stage.name)}</div></div></div>
    <button class="icon-btn" data-act="view" data-view="settings" aria-label="Settings">⚙️</button>`;
}

// ------------------------------------------------------------------ data helpers
async function entriesAround(date) {
  // entries for date and the previous day (night sleep that ends on `date`)
  const list = await db.range(addDays(date, -1), date);
  return list.sort((a, b) => a.start - b.start);
}

function summarize(list, date) {
  const onDay = e => e.date === date;
  const sum = (arr, f) => arr.reduce((a, e) => a + f(e), 0);
  const of = k => list.filter(e => e.type === k && onDay(e));
  const night = list.filter(e => e.type === 'sleep' && e.end && dateKey(e.end) === date);
  const naps = of('nap');
  const play = of('play');
  const outdoor = [...of('walk'), ...of('exercise'), ...play.filter(e => e.data?.where === 'Outdoor')];
  const beh = of('behaviour');
  return {
    nightMin: sum(night, e => entryMinutes(e)),
    napMin: sum(naps.filter(e => e.end), e => entryMinutes(e)), napCount: naps.length,
    sleepMin: sum(night, e => entryMinutes(e)) + sum(naps.filter(e => e.end), e => entryMinutes(e)),
    feeds: of('breastfeed').length + of('bottle').length,
    milkMl: sum(of('bottle'), e => Number(e.data?.amount) || 0),
    meals: of('meal').length,
    foods: of('meal').flatMap(e => e.data?.foods || []),
    pee: of('pee').length, poop: of('poop').length,
    water: sum(of('water'), e => Number(e.data?.amount) || 0),
    outdoorMin: sum(outdoor, e => entryMinutes(e)),
    playMin: sum(play, e => entryMinutes(e)) + sum(of('floor'), e => entryMinutes(e)) + sum(of('exercise'), e => entryMinutes(e)),
    learnMin: sum([...of('study'), ...of('reading'), ...of('homework')], e => entryMinutes(e)),
    readMin: sum(of('reading'), e => entryMinutes(e)),
    screenMin: sum(of('screen'), e => entryMinutes(e)),
    bath: of('bath').length,
    pos: beh.filter(e => e.data?.kind === 'pos').length, neg: beh.filter(e => e.data?.kind === 'neg').length,
    ei: of('ei').length,
  };
}

function entrySummary(e) {
  const t = typeInfo(e.type), d = e.data || {};
  if (e.type === 'behaviour') {
    const b = [...POSITIVE_BEHAVIOURS, ...CHALLENGING_BEHAVIOURS].find(x => x.k === d.b);
    return [b ? `${b.icon} ${b.label}` : 'Behaviour', d.trigger && `trigger: ${d.trigger}`, d.responses?.length && `we: ${d.responses.join(', ')}`, d.outcome].filter(Boolean).join(' · ');
  }
  if (e.type === 'ei') return d.text || '';
  const parts = [];
  if (e.start && e.end && t.timed) parts.push(fmtDur(entryMinutes(e)));
  if (e.start && !e.end && t.timed) parts.push('⏱ running');
  for (const f of (t.fields || [])) {
    const v = d[f.k];
    if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    if (f.kind === 'foods') parts.push(v.map(x => `${x.name}${x.qty ? ` ${x.qty} ${x.unit || ''}` : ''}${x.isNew ? ' 🆕' : ''}`).join(', '));
    else if (f.kind === 'check') parts.push(f.label);
    else if (f.kind === 'rating') parts.push('★'.repeat(v));
    else if (Array.isArray(v)) parts.push(v.join(', '));
    else parts.push(`${v}${f.unit ? ' ' + f.unit : ''}`);
  }
  return parts.join(' · ');
}

// ------------------------------------------------------------------ TODAY
async function renderToday() {
  const today = dateKey();
  const list = await entriesAround(today);
  const sm = summarize(list, today);
  const st = S.stage, tg = st.targets;
  const running = (await db.all()).filter(e => typeInfo(e.type).timed && e.start && !e.end);
  const banner = await stageBanner();
  const tip = pickDaily(DAILY_TIPS.filter(t => S.months >= t.min && S.months < t.max), 1).text;
  const ei = pickDaily(st.ei.activities, 0);
  const eiDone = list.some(e => e.type === 'ei' && e.date === today && e.data?.text === ei);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const routine = await getRoutine();
  const next = routine.find(r => r.min >= nowMin - 10) || routine[0];

  const tiles = [
    tile('🌙', 'Sleep (night + naps)', fmtDur(sm.sleepMin), `${tg.sleep[0]}–${tg.sleep[1]} h`, rangeStatus(sm.sleepMin / 60, tg.sleep, true), `night ${fmtDur(sm.nightMin)} · naps ${sm.napCount} (${fmtDur(sm.napMin)})`),
    tg.naps[1] > 0 ? tile('😴', 'Naps', sm.napCount, `${tg.naps[0]}–${tg.naps[1]}`, rangeStatus(sm.napCount, tg.naps, true)) : '',
    tile('🥣', 'Meals', sm.meals, `${tg.meals}${S.months < 24 ? ' + snacks' : ''}`, tg.meals ? rangeStatus(sm.meals, [tg.meals, 9], true) : null,
      sm.foods.length ? sm.foods.map(f => f.name).slice(0, 4).join(', ') : ''),
    tg.feeds[1] > 0 ? tile('🍼', 'Milk feeds', sm.feeds, `${tg.feeds[0]}–${tg.feeds[1]}`, null, sm.milkMl ? `${sm.milkMl} ml bottle` : '') : '',
    tile('💛', 'Pee', sm.pee, S.months < 36 ? `${tg.pee[0]}+ wet` : '', S.months < 24 ? rangeStatus(sm.pee, tg.pee, true) : null, `poop ${sm.poop}`),
    tile('🌳', 'Outdoor / active', fmtDur(sm.outdoorMin), S.months < 12 ? 'daily fresh air' : `${tg.activeMin} min active`, null, `all play ${fmtDur(sm.playMin)}`),
    tile('📚', 'Learning & reading', fmtDur(sm.learnMin), `${tg.readMin}+ min`, rangeStatus(sm.learnMin, [tg.readMin, 999], true)),
    tile('📱', 'Screen time', fmtDur(sm.screenMin), tg.screenMax ? `max ${tg.screenMax} min` : 'none advised', sm.screenMin > tg.screenMax ? 'high' : 'ok'),
    tile('🧭', 'Behaviour', `${sm.pos} 💗 / ${sm.neg} 🌋`, 'notice the good', null),
  ].join('');

  main().innerHTML = `
    ${banner}
    ${running.map(e => `<div class="card running"><div><b>${typeInfo(e.type).icon} ${esc(typeInfo(e.type).label)}</b> since ${fmtTime(e.start)}
      <div class="big" data-since="${e.start}">${fmtDur(entryMinutes(e))}</div></div>
      <div class="row"><button class="btn primary" data-act="stop" data-id="${e.id}">Stop</button><button class="btn" data-act="edit" data-id="${e.id}">Edit</button></div></div>`).join('')}
    <section class="quick">
      ${quickBtn('pee', '💛', 'Pee +1')}${quickBtn('poop', '💩', 'Poop')}${quickBtn('meal', '🥣', 'Food')}
      ${S.months < 30 ? quickBtn('breastfeed', '🤱', 'Feed', true) : quickBtn('water', '💧', 'Water')}
      ${S.months < 72 ? quickBtn('nap', '😴', 'Nap', true) : quickBtn('homework', '✏️', 'Homework', true)}
      ${quickBtn('sleep', '🌙', 'Sleep', true)}${quickBtn('wake', '🌅', 'Woke up')}${quickBtn('study', '📚', 'Learning', true)}
      ${quickBtn('play', '🧸', 'Play', true)}${quickBtn('walk', '🌳', 'Walk', true)}${quickBtn('bath', '🛁', 'Bath')}
      <button class="qb" data-act="behaviour" data-kind="pos"><span>💗</span>Kind act</button>
    </section>
    <section class="card next">
      <div class="label">Next in his routine</div>
      <div class="row between"><div><b>${minToHm(next.min)}</b> · ${esc(next.label)}</div><button class="btn small" data-act="view" data-view="routine">Timetable</button></div>
    </section>
    <h2>Today · ${esc(fmtDateLong(today))}</h2>
    <section class="tiles">${tiles}</section>
    <section class="card ei">
      <div class="label">💛 Emotional intelligence · today's activity</div>
      <p>${esc(ei)}</p>
      <div class="muted small">Stage goal: ${esc(st.ei.goal)}</div>
      <button class="btn ${eiDone ? '' : 'primary'}" data-act="eidone" data-text="${esc(ei)}" ${eiDone ? 'disabled' : ''}>${eiDone ? '✓ Done today' : 'We did it'}</button>
    </section>
    <section class="card tip"><div class="label">🌱 Parenting tip of the day</div><p>${esc(tip)}</p></section>
    <h2>Today's log</h2>
    ${entryList(list.filter(e => e.date === today))}
  `;
}

function tile(icon, label, value, target, status, sub = '') {
  const st = status ? { ok: ['✓', 'On track'], low: ['↓', 'Below'], high: ['↑', 'Above'] }[status] : null;
  return `<div class="tile ${status || ''}"><div class="t-top"><span>${icon} ${esc(label)}</span>${st ? `<span class="badge ${status}" title="${st[1]}">${st[0]} ${st[1]}</span>` : ''}</div>
    <div class="t-val">${esc(value)}</div><div class="t-sub">${target ? `Aim: ${esc(target)}` : ''}${sub ? `<br>${esc(sub)}` : ''}</div></div>`;
}
function rangeStatus(v, [lo, hi], partialDay = false) {
  if (v > hi) return 'high';
  if (v < lo) return partialDay && new Date().getHours() < 20 ? null : 'low';
  return 'ok';
}
function quickBtn(type, icon, label, timed = false) {
  return `<button class="qb" data-act="${timed ? 'quickTimed' : 'quick'}" data-type="${type}"><span>${icon}</span>${esc(label)}</button>`;
}
function pickDaily(arr, salt) {
  if (!arr.length) return '';
  return arr[(dayOfYear() + salt * 7) % arr.length];
}

function entryList(list) {
  if (!list.length) return `<p class="empty">Nothing logged yet. Tap a button above or the ＋ to add an entry.</p>`;
  return `<ul class="entries">${list.map(e => {
    const t = typeInfo(e.type);
    return `<li data-act="edit" data-id="${e.id}"><span class="e-time">${fmtTime(e.start)}${e.end && t.timed ? `<br><span class="muted">${fmtTime(e.end)}</span>` : ''}</span>
      <span class="e-icon">${t.icon}</span><span class="e-body"><b>${esc(t.label)}</b>${e.by ? ` <span class="muted small">by ${esc(e.by)}</span>` : ''}<br><span class="muted">${esc(entrySummary(e))}</span>${e.note ? `<br><i>${esc(e.note)}</i>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

function tickTimers() {
  document.querySelectorAll('[data-since]').forEach(el => {
    const m = (Date.now() - Number(el.dataset.since)) / 60000;
    el.textContent = m < 60 ? `${Math.floor(m)}m ${Math.floor((m % 1) * 60)}s` : fmtDur(m);
  });
}

async function stageBanner() {
  const last = await db.getKV('lastStage');
  if (last === S.stage.id) return '';
  if (!last) { await db.setKV('lastStage', S.stage.id); return ''; }
  return `<section class="card upgrade"><div class="label">🎉 New stage unlocked</div>
    <h3>${S.stage.emoji} ${esc(S.stage.name)}</h3><p>${esc(S.stage.tagline)}</p>
    <p><b>The app has adapted:</b></p><ul>${S.stage.newFeatures.map(f => `<li>${esc(f)}</li>`).join('')}<li>New timetable, targets, milestones and guidance for this age</li></ul>
    <button class="btn primary" data-act="ackStage">Got it</button></section>`;
}

// ------------------------------------------------------------------ LOG FORM
function openSheet(html) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-inner">${html}</div>`;
  sh.hidden = false;
  document.body.classList.add('locked');
  sh.querySelector('input:not([type=hidden]),select,textarea')?.focus({ preventScroll: true });
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; document.body.classList.remove('locked'); }

function openPicker() {
  const types = typesForAge(S.months);
  const groups = [...new Set(types.map(t => t.group))];
  openSheet(`<div class="sheet-hd"><h3>What happened?</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    ${groups.map(g => `<div class="label">${esc(g)}</div><div class="grid-types">${types.filter(t => t.group === g).map(t =>
      `<button class="tt" data-act="form" data-type="${t.key}"><span>${t.icon}</span>${esc(t.label)}</button>`).join('')}</div>`).join('')}
    <div class="label">Behaviour</div><div class="grid-types">
      <button class="tt" data-act="behaviour" data-kind="pos"><span>💗</span>Positive behaviour</button>
      <button class="tt" data-act="behaviour" data-kind="neg"><span>🌋</span>Challenging behaviour</button></div>`);
}

async function openForm(typeKey, entry = null, opts = {}) {
  const t = typeByKey(typeKey);
  if (!t) return;
  const e = entry || { id: null, type: typeKey, start: Date.now(), end: t.timed ? null : null, data: {}, note: '', by: S.settings.me };
  const fields = fieldsForAge(t, S.months);
  const foodsKnown = Object.keys(await db.getKV('foods', {})).sort();
  const durDefault = e.end ? Math.round(entryMinutes(e)) : '';
  openSheet(`<form id="logform" data-type="${t.key}" data-id="${e.id || ''}">
    <div class="sheet-hd"><h3>${t.icon} ${esc(t.label)}</h3><button type="button" class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <label>${t.timed ? 'Start' : 'Time'}<input type="datetime-local" name="start" value="${toLocalInput(e.start)}" required></label>
    ${t.timed ? `<div class="row two"><label>End<input type="datetime-local" name="end" value="${e.end ? toLocalInput(e.end) : ''}"></label>
      <label>or duration (min)<input type="number" inputmode="numeric" name="dur" min="0" value="${durDefault}"></label></div>
      <p class="muted small">Leave end empty and press <b>Start timer</b> to time it live.</p>` : ''}
    ${fields.map(f => fieldHtml(t, f, e.data?.[f.k], foodsKnown)).join('')}
    <label>Notes<textarea name="note" rows="2" placeholder="Anything else worth remembering">${esc(e.note || '')}</textarea></label>
    <label>Logged by<select name="by">${S.settings.caregivers.map(c => `<option ${c === (e.by || S.settings.me) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    ${typeKey === 'screen' && S.months < 24 ? `<p class="warn">ⓘ WHO and AAP advise avoiding screens under 2 years (video calls with family are fine).</p>` : ''}
    <div class="row actions">
      ${e.id ? `<button type="button" class="btn danger" data-act="delete" data-id="${e.id}">Delete</button>` : ''}
      ${t.timed && !e.id ? `<button type="button" class="btn" data-act="startTimer">⏱ Start timer</button>` : ''}
      <button type="submit" class="btn primary">Save</button>
    </div>
    <datalist id="foodlist">${foodsKnown.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
  </form>`);
  $('#logform').addEventListener('submit', ev => { ev.preventDefault(); saveForm(false); });
  if (opts.focusFoods) $('#logform .food-row input')?.focus();
}

function fieldHtml(t, f, v, foodsKnown) {
  const name = `f_${f.k}`;
  const unit = f.unit ? ` <span class="muted">(${esc(f.unit)})</span>` : '';
  switch (f.kind) {
    case 'select': {
      const opts = fieldOptions(t, f, S.months);
      return `<label>${esc(f.label)}<select name="${name}"><option value="">—</option>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}${v && !opts.includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select></label>`;
    }
    case 'chips': {
      const opts = fieldOptions(t, f, S.months);
      return `<fieldset><legend>${esc(f.label)}</legend><div class="chips">${opts.map(o => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
    }
    case 'number': return `<label>${esc(f.label)}${unit}<input type="number" inputmode="decimal" step="${f.step || 'any'}" name="${name}" value="${esc(v ?? '')}"></label>`;
    case 'textarea': return `<label>${esc(f.label)}<textarea name="${name}" rows="2">${esc(v || '')}</textarea></label>`;
    case 'check': return `<label class="check"><input type="checkbox" name="${name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'rating': return `<fieldset><legend>${esc(f.label)}</legend><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${name}" value="${n}" ${Number(v) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>`;
    case 'foods': {
      const rows = (v && v.length ? v : [{ name: '', qty: '', unit: 'tbsp' }]);
      return `<fieldset><legend>${esc(f.label)}</legend><div id="foods">${rows.map(foodRow).join('')}</div>
        <button type="button" class="btn small" data-act="addFood">＋ Add another food</button></fieldset>`;
    }
    default: return `<label>${esc(f.label)}<input type="text" name="${name}" value="${esc(v || '')}"></label>`;
  }
}
function foodRow(x = { name: '', qty: '', unit: 'tbsp' }) {
  return `<div class="food-row"><input list="foodlist" placeholder="Food (e.g. ragi porridge)" class="fname" value="${esc(x.name)}">
    <input type="number" inputmode="decimal" step="any" placeholder="Qty" class="fqty" value="${esc(x.qty)}">
    <select class="funit">${FOOD_UNITS.map(u => `<option ${u === x.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
    <button type="button" class="icon-btn" data-act="rmFood" aria-label="Remove">✕</button></div>`;
}

async function saveForm(startTimer) {
  const form = $('#logform');
  const t = typeByKey(form.dataset.type);
  const fd = new FormData(form);
  const id = form.dataset.id;
  const old = id ? await db.get(id) : null;
  const start = fromLocalInput(fd.get('start')) || Date.now();
  let end = null;
  if (t.timed && !startTimer) {
    end = fromLocalInput(fd.get('end'));
    const dur = Number(fd.get('dur'));
    if (!end && dur > 0) end = start + dur * 60000;
    if (!end && !old) end = start; // saved without timer or duration → point-in-time
    if (!end && old && !old.end) end = null; // still running
    if (end && end < start) return alert('End time is before start time.');
  }
  const data = {};
  for (const f of fieldsForAge(t, S.months)) {
    const n = `f_${f.k}`;
    if (f.kind === 'chips') data[f.k] = fd.getAll(n);
    else if (f.kind === 'check') data[f.k] = fd.get(n) === 'on';
    else if (f.kind === 'number' || f.kind === 'rating') { const v = fd.get(n); if (v !== null && v !== '') data[f.k] = Number(v); }
    else if (f.kind === 'foods') {
      data.foods = [...form.querySelectorAll('.food-row')].map(r => ({
        name: r.querySelector('.fname').value.trim(), qty: r.querySelector('.fqty').value, unit: r.querySelector('.funit').value,
      })).filter(x => x.name);
    } else { const v = fd.get(n); if (v) data[f.k] = v; }
  }
  if (data.foods) await trackFoods(data.foods, dateKey(start), data.reaction, old);
  const entry = { ...(old || {}), id: id || uid(), type: t.key, start, end: startTimer ? null : end, date: dateKey(start), data,
    note: fd.get('note') || '', by: fd.get('by') || S.settings.me, updatedAt: Date.now(), createdAt: old?.createdAt || Date.now() };
  await db.put(entry);
  closeSheet();
  toast(startTimer ? `⏱ ${t.label} timer started` : `Saved ${t.icon} ${t.label}`);
  route();
}

async function trackFoods(foods, date, reaction, old) {
  const map = await db.getKV('foods', {});
  const prev = new Set((old?.data?.foods || []).map(f => f.name.toLowerCase()));
  for (const f of foods) {
    const k = Object.keys(map).find(n => n.toLowerCase() === f.name.toLowerCase()) || f.name;
    if (!map[k]) { map[k] = { first: date, count: 0, reactions: [] }; f.isNew = true; }
    else if (map[k].first === date && !prev.has(f.name.toLowerCase())) f.isNew = true;
    if (!prev.has(f.name.toLowerCase())) map[k].count++;
    if (reaction && !map[k].reactions.includes(reaction)) map[k].reactions.push(reaction);
  }
  await db.setKV('foods', map);
}

// ------------------------------------------------------------------ BEHAVIOUR FORM
async function openBehaviour(kind, entry = null) {
  const d = entry?.data || { kind };
  kind = d.kind;
  const list = behaviourForAge(kind === 'pos' ? POSITIVE_BEHAVIOURS : CHALLENGING_BEHAVIOURS, S.months);
  openSheet(`<form id="behform" data-id="${entry?.id || ''}" data-kind="${kind}">
    <div class="sheet-hd"><h3>${kind === 'pos' ? '💗 Positive behaviour' : '🌋 Challenging moment'}</h3><button type="button" class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <label>Time<input type="datetime-local" name="start" value="${toLocalInput(entry?.start || Date.now())}"></label>
    <fieldset><legend>What happened</legend><div class="chips">${list.map(b => `<label class="chip"><input type="radio" name="b" value="${b.k}" ${d.b === b.k ? 'checked' : ''} required><span>${b.icon} ${esc(b.label)}</span></label>`).join('')}</div></fieldset>
    <label>Details<textarea name="details" rows="2" placeholder="${kind === 'pos' ? 'e.g. offered his biscuit to cousin' : 'What exactly did he do?'}">${esc(d.details || '')}</textarea></label>
    ${kind === 'neg' ? `
      <label>Likely trigger<select name="trigger"><option value="">—</option>${TRIGGERS.map(x => `<option ${x === d.trigger ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <fieldset><legend>How strong (1 mild – 5 intense)</legend><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="intensity" value="${n}" ${Number(d.intensity) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>How we responded</legend><div class="chips">${RESPONSES.map(x => `<label class="chip"><input type="checkbox" name="responses" value="${esc(x)}" ${(d.responses || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>
      <label>Outcome<select name="outcome"><option value="">—</option>${OUTCOMES.map(x => `<option ${x === d.outcome ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    ` : `
      <fieldset><legend>How we responded</legend><div class="chips">${['Described what he did', 'Praised the effort', 'Hug / smile', 'Told the family', 'Thanked him'].map(x => `<label class="chip"><input type="checkbox" name="responses" value="${esc(x)}" ${(d.responses || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>`}
    <label>Logged by<select name="by">${S.settings.caregivers.map(c => `<option ${c === (entry?.by || S.settings.me) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <div class="row actions">${entry ? `<button type="button" class="btn danger" data-act="delete" data-id="${entry.id}">Delete</button>` : ''}<button class="btn primary">Save</button></div>
  </form>`);
  $('#behform').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, fd = new FormData(f);
    const start = fromLocalInput(fd.get('start')) || Date.now();
    const e = { ...(entry || {}), id: entry?.id || uid(), type: 'behaviour', start, end: null, date: dateKey(start), by: fd.get('by'),
      data: { kind, b: fd.get('b'), details: fd.get('details') || '', trigger: fd.get('trigger') || '', intensity: Number(fd.get('intensity')) || null,
        responses: fd.getAll('responses'), outcome: fd.get('outcome') || '' }, note: '', createdAt: entry?.createdAt || Date.now(), updatedAt: Date.now() };
    await db.put(e);
    closeSheet();
    toast(kind === 'pos' ? '💗 Noted — tell him what you noticed!' : 'Logged. Remember to reconnect after big feelings.');
    route();
  });
}

// ------------------------------------------------------------------ DIARY
async function renderDiary() {
  const d = S.diaryDate;
  const list = await entriesAround(d);
  const sm = summarize(list, d);
  main().innerHTML = `
    <div class="datebar"><button class="btn" data-act="day" data-delta="-1" aria-label="Previous day">‹</button>
      <input type="date" id="diaryDate" value="${d}" max="${dateKey()}"><button class="btn" data-act="day" data-delta="1" aria-label="Next day" ${d >= dateKey() ? 'disabled' : ''}>›</button></div>
    <h2>${esc(fmtDateLong(d))}</h2>
    <div class="card"><div class="summary-grid">
      <div><b>${fmtDur(sm.sleepMin)}</b><span>sleep</span></div><div><b>${sm.napCount}</b><span>naps</span></div>
      <div><b>${sm.meals}</b><span>meals</span></div><div><b>${sm.feeds}</b><span>milk feeds</span></div>
      <div><b>${sm.pee}</b><span>pee</span></div><div><b>${sm.poop}</b><span>poop</span></div>
      <div><b>${fmtDur(sm.outdoorMin)}</b><span>outdoor</span></div><div><b>${fmtDur(sm.learnMin)}</b><span>learning</span></div>
      <div><b>${fmtDur(sm.screenMin)}</b><span>screen</span></div><div><b>${sm.pos}/${sm.neg}</b><span>💗/🌋</span></div>
    </div>${sm.foods.length ? `<p class="small"><b>Foods:</b> ${esc(sm.foods.map(f => `${f.name}${f.qty ? ` (${f.qty} ${f.unit})` : ''}`).join(', '))}</p>` : ''}</div>
    ${entryList(list.filter(e => e.date === d))}
    <button class="btn wide" data-act="openPicker">＋ Add entry to this day</button>`;
}

// ------------------------------------------------------------------ ROUTINE
async function getRoutine() {
  const custom = await db.getKV(`routine:${S.stage.id}`);
  if (custom) return custom.map(r => ({ ...r, min: hmToMin(r.t) })).sort((a, b) => a.min - b.min);
  const base = S.stage.routine;
  const shift = hmToMin(S.settings.wake || base[0].t) - hmToMin(base[0].t);
  return base.map(r => ({ ...r, min: hmToMin(r.t) + shift, t: minToHm(hmToMin(r.t) + shift) }));
}

async function renderRoutine() {
  const routine = await getRoutine();
  const custom = await db.getKV(`routine:${S.stage.id}`);
  const today = await entriesAround(dateKey());
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const done = r => today.some(e => e.date === dateKey() && e.type === r.type && Math.abs((new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes()) - r.min) <= 90);
  const tg = S.stage.targets;
  const nx = nextStage(S.stage);
  main().innerHTML = `
    <h2>${S.stage.emoji} ${esc(S.stage.name)} timetable</h2>
    <p class="muted">${esc(S.stage.tagline)} ${custom ? '<b>(your customised version)</b>' : `Shifted to his usual wake-up time (${esc(S.settings.wake)}).`}</p>
    <div class="card targets"><div class="label">Daily targets for this age</div>
      <ul><li>🌙 Sleep ${tg.sleep[0]}–${tg.sleep[1]} h in 24 h${tg.naps[1] ? `, ${tg.naps[0]}–${tg.naps[1]} naps` : ''}</li>
      ${tg.meals ? `<li>🥣 ${tg.meals} meals${S.months < 24 ? ' + 1–2 snacks' : ' + 2 snacks'}</li>` : ''}
      <li>🌳 ${S.months < 12 ? 'Floor play & tummy time many times a day' : `${tg.activeMin}+ min active play`}</li>
      <li>📚 ${tg.readMin}+ min reading / learning</li>
      <li>📱 ${tg.screenMax ? `Max ${tg.screenMax} min screens` : 'No screens'}</li></ul></div>
    <ol class="timeline">${routine.map(r => {
      const isNow = nowMin >= r.min && nowMin < r.min + (r.dur || 30);
      return `<li class="${done(r) ? 'done' : ''} ${isNow ? 'now' : ''}"><span class="tl-time">${minToHm(r.min)}</span>
        <span class="tl-body">${typeInfo(r.type).icon} ${esc(r.label)} <span class="muted small">${r.dur && r.dur < 300 ? fmtDur(r.dur) : ''}</span>
        ${done(r) ? '<span class="badge ok">✓ logged</span>' : isNow ? '<span class="badge now">now</span>' : ''}</span>
        <button class="icon-btn" data-act="form" data-type="${r.type}" aria-label="Log ${esc(r.label)}">＋</button></li>`;
    }).join('')}</ol>
    <div class="row"><button class="btn" data-act="editRoutine">✏️ Customise timetable</button>${custom ? '<button class="btn" data-act="resetRoutine">Reset to recommended</button>' : ''}</div>
    <h2>Growing-up roadmap</h2>
    <p class="muted">The app changes its timetable, targets, log types, milestones and guidance automatically as he grows.</p>
    <ol class="roadmap">${STAGES.map(s => `<li class="${s === S.stage ? 'current' : s.to <= S.months ? 'past' : ''}">
      <b>${s.emoji} ${esc(s.name)}</b> <span class="muted">${ageRange(s)}</span>${s === S.stage ? ' <span class="badge now">now</span>' : ''}
      <div class="small muted">${esc(s.ei.goal)}</div></li>`).join('')}</ol>
    ${nx ? `<p class="small">Next: <b>${esc(nx.name)}</b> in about ${Math.max(0, Math.ceil(nx.from - S.months))} month(s) — new: ${esc(nx.newFeatures.join(', '))}.</p>` : ''}`;
}
const ageRange = s => `${s.from < 24 ? s.from + ' mo' : s.from / 12 + ' y'} – ${s.to < 24 ? s.to + ' mo' : s.to / 12 + ' y'}`;

async function openRoutineEditor() {
  const r = await getRoutine();
  const types = typesForAge(S.months);
  const row = x => `<div class="rt-row"><input type="time" value="${x.t}" class="rt-t"><input value="${esc(x.label)}" class="rt-l">
    <select class="rt-type">${types.map(t => `<option value="${t.key}" ${t.key === x.type ? 'selected' : ''}>${t.icon} ${esc(t.label)}</option>`).join('')}</select>
    <input type="number" class="rt-d" value="${x.dur || ''}" placeholder="min"><button type="button" class="icon-btn" data-act="rmRow" aria-label="Remove">✕</button></div>`;
  openSheet(`<div class="sheet-hd"><h3>Customise timetable</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <p class="muted small">Edit times, activities and durations. Saved for the ${esc(S.stage.name)} stage; when he moves to the next stage you get a fresh recommended timetable.</p>
    <div id="rtrows">${r.map(x => row({ ...x, t: minToHm(x.min) })).join('')}</div>
    <template id="rtTpl">${row({ t: '12:00', label: '', type: 'play', dur: 30 })}</template>
    <div class="row actions"><button class="btn" data-act="addRow">＋ Add row</button><button class="btn primary" data-act="saveRoutine">Save</button></div>`);
}

// ------------------------------------------------------------------ HEART (behaviour + EI)
async function renderHeart() {
  const to = dateKey(), from = addDays(to, -13);
  const list = (await db.range(from, to)).filter(e => e.type === 'behaviour').sort((a, b) => b.start - a.start);
  const days = [...Array(14)].map((_, i) => addDays(from, i));
  const data = days.map(d => ({ label: String(parseKey(d).getDate()), a: list.filter(e => e.date === d && e.data.kind === 'pos').length, b: list.filter(e => e.date === d && e.data.kind === 'neg').length }));
  const neg = list.filter(e => e.data.kind === 'neg');
  const count = (arr, f) => Object.entries(arr.reduce((m, e) => { [].concat(f(e) || []).forEach(k => { m[k] = (m[k] || 0) + 1; }); return m; }, {})).sort((a, b) => b[1] - a[1]);
  const triggers = count(neg, e => e.data.trigger);
  const quick = neg.filter(e => e.data.outcome === 'Calmed within 2 min');
  const worked = count(quick, e => e.data.responses);
  const pos = list.filter(e => e.data.kind === 'pos');
  const st = S.stage;
  const ratio = neg.length ? (pos.length / neg.length).toFixed(1) : null;
  main().innerHTML = `
    <h2>💛 Heart — emotions, kindness & behaviour</h2>
    <div class="row"><button class="btn primary grow" data-act="behaviour" data-kind="pos">💗 Log kind / positive</button><button class="btn grow" data-act="behaviour" data-kind="neg">🌋 Log challenging</button></div>
    <section class="card"><div class="label">This stage's emotional-intelligence goal</div><h3>${esc(st.ei.goal)}</h3>
      <div class="chips static">${st.ei.skills.map(s => `<span class="chip"><span>${esc(s)}</span></span>`).join('')}</div>
      <div class="label">Activities to practise</div><ul class="checklist">${st.ei.activities.map(a => `<li><button class="btn small" data-act="eidone" data-text="${esc(a)}">Did it</button> ${esc(a)}</li>`).join('')}</ul></section>
    <section class="card">${pairChart({ title: 'Last 14 days', data, names: ['Positive', 'Challenging'] })}
      <p class="small">${ratio ? `Positive moments noticed: <b>${pos.length}</b>, challenging: <b>${neg.length}</b> (≈${ratio} : 1). ` : `Positive moments noticed: <b>${pos.length}</b>. `}
      Try to notice and name many more good moments than you correct — what you pay attention to grows.</p></section>
    ${neg.length ? `<section class="card"><div class="label">Patterns</div>
      <p><b>Top triggers:</b> ${triggers.length ? triggers.slice(0, 4).map(([k, n]) => `${esc(k)} (${n})`).join(', ') : 'not recorded yet'}</p>
      <p><b>What calmed him fastest:</b> ${worked.length ? worked.slice(0, 4).map(([k, n]) => `${esc(k)} (${n})`).join(', ') : 'log responses + outcome to learn this'}</p>
      ${triggers[0] ? `<p class="small muted">${esc(triggerAdvice(triggers[0][0]))}</p>` : ''}</section>` : ''}
    <section class="card"><div class="label">Behaviour at this age</div><ul>${st.behaviour.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <button class="btn small" data-act="view" data-view="guide">Read the guides</button></section>
    <h2>Recent</h2>${entryList(list.slice(0, 20))}`;
}
function triggerAdvice(t) {
  return ({
    'Hungry': 'Tip: keep meals and snacks on a predictable schedule and carry a snack when going out.',
    'Tired / overdue nap': 'Tip: protect nap times and start the bedtime routine a little earlier.',
    'Transition (stopping play, leaving)': 'Tip: give a 5-minute and a 1-minute warning, and offer a choice for the next step.',
    'Wanted something & told no': 'Tip: validate the wish ("You really want it") while keeping the limit kind and firm.',
    'Overstimulated / crowd / noise': 'Tip: plan quiet breaks; a calm corner or a walk outside helps reset.',
    'Wanted attention': 'Tip: 10–15 minutes of daily one-on-one child-led play often reduces attention-seeking.',
    'Screen ended': 'Tip: use a timer he can see, and have a fun next activity ready.',
  })[t] || 'Tip: look for the need behind the behaviour — hunger, tiredness, connection, or skill to learn.';
}

// ------------------------------------------------------------------ GROW
async function renderGrow() {
  const tabs = [['milestones', 'Milestones'], ['trends', 'Trends'], ['growth', 'Growth'], ['foods', 'Foods'], ['vaccines', 'Vaccines'], ['memories', 'Memories']];
  const body = await ({ milestones: growMilestones, trends: growTrends, growth: growGrowth, foods: growFoods, vaccines: growVaccines, memories: growMemories })[S.growTab]();
  main().innerHTML = `<div class="seg">${tabs.map(([k, l]) => `<button data-act="growTab" data-tab="${k}" aria-pressed="${S.growTab === k}">${l}</button>`).join('')}</div>${body}`;
}

async function growMilestones() {
  const state = await db.getKV('milestones', {});
  const m = S.months;
  const cur = MILESTONES.find(c => c.at >= m - 1) || MILESTONES[MILESTONES.length - 1];
  const cats = { social: '💞 Social / emotional', language: '🗣️ Language', cognitive: '🧠 Thinking', movement: '🏃 Movement' };
  const block = c => {
    const doneN = c.items.filter((_, i) => state[`${c.at}:${i}`]).length;
    return `<details class="card ms" ${c === cur ? 'open' : ''}><summary><b>By ${c.at < 24 ? c.at + ' months' : c.at / 12 + ' years'}</b>
      <span class="muted"> · ${doneN}/${c.items.length}</span>${c === cur ? ' <span class="badge now">current</span>' : ''}</summary>
      ${Object.keys(cats).map(cat => {
        const items = c.items.map((it, i) => [it, i]).filter(([it]) => it[0] === cat);
        if (!items.length) return '';
        return `<div class="label">${cats[cat]}</div><ul class="checklist">${items.map(([it, i]) => {
          const k = `${c.at}:${i}`;
          return `<li><label class="check"><input type="checkbox" data-ms="${k}" ${state[k] ? 'checked' : ''}> ${esc(it[1])}</label>${state[k] ? `<span class="muted small"> ✓ ${esc(fmtDateShort(state[k]))}</span>` : ''}</li>`;
        }).join('')}</ul>`;
      }).join('')}</details>`;
  };
  const idx = MILESTONES.indexOf(cur);
  const shown = MILESTONES.slice(Math.max(0, idx - 1), idx + 2);
  return `<p class="muted small">${esc(RED_FLAGS)}</p>${shown.map(block).join('')}
    <details class="card"><summary>All other checkpoints</summary>${MILESTONES.filter(c => !shown.includes(c)).map(block).join('')}</details>`;
}

async function growTrends() {
  const n = S.trendDays, to = dateKey(), from = addDays(to, -(n - 1));
  const all = await db.range(addDays(from, -1), to);
  const days = [...Array(n)].map((_, i) => addDays(from, i));
  const sums = days.map(d => ({ d, s: summarize(all, d) }));
  const lab = d => n <= 7 ? parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }) : String(parseKey(d).getDate());
  const series = (f) => sums.map(({ d, s }) => ({ label: lab(d), value: f(s) }));
  const tg = S.stage.targets;
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b.value, 0) / arr.length : 0;
  const sleep = series(s => s.sleepMin / 60);
  return `<div class="seg small">${[7, 14, 30].map(k => `<button data-act="trendDays" data-days="${k}" aria-pressed="${n === k}">${k} days</button>`).join('')}</div>
    <p class="muted small">Average sleep ${avg(sleep).toFixed(1)} h · Days with no sleep logged count as zero.</p>
    ${barChart({ title: 'Total sleep (hours)', data: sleep, unit: ' h', target: tg.sleep })}
    ${tg.naps[1] ? barChart({ title: 'Naps', data: series(s => s.napCount), fmt: v => String(Math.round(v)) }) : ''}
    ${barChart({ title: 'Meals', data: series(s => s.meals), fmt: v => String(Math.round(v)) })}
    ${tg.feeds[1] ? barChart({ title: 'Milk feeds', data: series(s => s.feeds), fmt: v => String(Math.round(v)) }) : ''}
    ${barChart({ title: 'Pee count', data: series(s => s.pee), fmt: v => String(Math.round(v)) })}
    ${barChart({ title: 'Outdoor / active (min)', data: series(s => s.outdoorMin), unit: ' min', fmt: v => String(Math.round(v)) })}
    ${barChart({ title: 'Learning & reading (min)', data: series(s => s.learnMin), unit: ' min', fmt: v => String(Math.round(v)) })}
    ${barChart({ title: 'Screen time (min)', data: series(s => s.screenMin), unit: ' min', fmt: v => String(Math.round(v)) })}`;
}

async function growGrowth() {
  const g = (await db.byType('growth')).sort((a, b) => a.start - b.start);
  const pts = k => g.filter(e => e.data?.[k]).map(e => ({ label: fmtDateShort(e.date), x: e.start, value: e.data[k] }));
  const teeth = await db.byType('tooth');
  return `<button class="btn primary wide" data-act="form" data-type="growth">＋ Add weight / height</button>
    ${lineChart({ title: 'Weight (kg)', points: pts('weight'), unit: ' kg' })}
    ${lineChart({ title: 'Height / length (cm)', points: pts('height'), unit: ' cm' })}
    ${S.months < 36 ? lineChart({ title: 'Head circumference (cm)', points: pts('head'), unit: ' cm' }) : ''}
    <p class="muted small">Compare with the WHO growth charts in his health card at each paediatric visit — the trend over time matters more than one number.</p>
    ${S.months < 36 ? `<p>🦷 Teeth logged: <b>${teeth.length}</b> <button class="btn small" data-act="form" data-type="tooth">＋ New tooth</button></p>` : ''}`;
}

async function growFoods() {
  const map = await db.getKV('foods', {});
  const list = Object.entries(map).sort((a, b) => b[1].first.localeCompare(a[1].first));
  return `<p>${list.length} different foods tried so far. Variety in the first two years shapes lifelong eating habits.</p>
    ${list.length ? `<table class="foods"><thead><tr><th>Food</th><th>First tried</th><th>Times</th><th>Reaction</th></tr></thead><tbody>
    ${list.map(([n, f]) => `<tr><td>${esc(n)}</td><td>${esc(fmtDateShort(f.first))}</td><td>${f.count}</td><td>${esc(f.reactions.join('; ')) || '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Log a meal to start the food diary.</p>'}
    <p class="muted small">Introduce one new food at a time and wait 2–3 days to watch for reactions. Common allergens (egg, peanut paste, dairy, wheat, fish) are usually introduced early — ask your paediatrician, especially if there is eczema or family allergy.</p>`;
}

async function growVaccines() {
  const state = await db.getKV('vaccines', {});
  const dob = parseKey(S.settings.dob);
  return `<p class="warn">ⓘ Based on the Indian Academy of Pediatrics schedule. Schedules get updated — always follow your paediatrician's advice and the dates on his vaccination card.</p>
    <ul class="vax">${VACCINES.map(v => {
      const due = new Date(dob); due.setDate(due.getDate() + Math.round(v.at * 30.4375));
      const dk = dateKey(due), done = state[v.at];
      const status = done ? ['ok', '✓ Given'] : dk < dateKey() ? ['high', '! Due / overdue'] : (due - Date.now()) < 45 * 86400000 ? ['now', 'Coming up'] : ['', 'Later'];
      return `<li><label class="check"><input type="checkbox" data-vax="${v.at}" ${done ? 'checked' : ''}>
        <span><b>${v.at < 1 ? 'Birth' : v.at < 24 ? (v.at < 4 ? Math.round(v.at * 4.345) + ' weeks' : v.at + ' months') : Math.round(v.at / 12 * 10) / 10 + ' years'}</b> — ${esc(v.name)}<br>
        <span class="muted small">${done ? 'given ' + esc(fmtDateShort(done)) : 'due around ' + esc(fmtDateShort(dk))}</span></span></label>
        <span class="badge ${status[0]}">${status[1]}</span></li>`;
    }).join('')}</ul>`;
}

async function growMemories() {
  const list = (await db.byType('memory')).sort((a, b) => b.start - a.start);
  return `<button class="btn primary wide" data-act="form" data-type="memory">＋ Add a memory / first</button>
    ${list.length ? `<ul class="memories">${list.map(e => `<li data-act="edit" data-id="${e.id}"><div class="muted small">${esc(fmtDateLong(e.date))} · age ${esc(ageText(S.settings.dob, e.start))}</div>
      ${e.data?.first ? '<span class="badge now">⭐ First</span> ' : ''}${esc(e.data?.text || e.note)}</li>`).join('')}</ul>` : '<p class="empty">First smile, first word, first step… write them down here.</p>'}`;
}

// ------------------------------------------------------------------ GUIDE
async function renderGuide() {
  const m = S.months, st = S.stage;
  const arts = GUIDE.filter(g => S.guideAll || (m >= g.min && m < g.max));
  main().innerHTML = `
    <h2>${st.emoji} Guide for ${esc(st.name)} (${ageRange(st)})</h2>
    <section class="card"><p>${esc(st.tagline)}</p>
      <div class="label">Development focus</div><ul>${st.focus.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="label">Food & feeding</div><ul>${st.feeding.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="label">Learning (academic foundations)</div><ul>${st.academics.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="label">Emotional intelligence</div><p><b>${esc(st.ei.goal)}</b></p><ul>${st.ei.skills.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>
    <div class="row between"><h2>Parenting library</h2><label class="check small"><input type="checkbox" id="guideAll" ${S.guideAll ? 'checked' : ''}> Show all ages</label></div>
    ${arts.map(a => `<details class="card article"><summary><span class="a-icon">${a.icon}</span><span><b>${esc(a.title)}</b><br><span class="muted small">${esc(a.cat)}</span></span></summary>
      <p>${esc(a.intro)}</p>
      ${a.steps ? `<ol class="steps">${a.steps.map(([h, t]) => `<li><b>${esc(h)}.</b> ${esc(t)}</li>`).join('')}</ol>` : ''}
      ${a.list ? `<ul>${a.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${a.tips ? `<div class="label">Tips</div><ul>${a.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </details>`).join('')}
    <p class="muted small">This guidance is general information drawn from WHO, AAP/AASM, CDC, IAP, the Gottman Institute and Harvard's Center on the Developing Child. It does not replace your paediatrician.</p>`;
}

// ------------------------------------------------------------------ SETTINGS
async function renderSettings() {
  const s = S.settings;
  const count = (await db.all()).length;
  main().innerHTML = `
    <h2>Settings</h2>
    <form id="settingsForm" class="card">
      <label>Child's name<input name="name" value="${esc(s.name)}" required></label>
      <label>Date of birth<input type="date" name="dob" value="${esc(s.dob)}" max="${dateKey()}" required></label>
      <label>Born early by (weeks) <span class="muted small">— uses corrected age until 2 years if 3+ weeks</span><input type="number" name="premature" min="0" max="16" value="${esc(s.premature || 0)}"></label>
      <label>Usual wake-up time <span class="muted small">— the timetable shifts around this</span><input type="time" name="wake" value="${esc(s.wake)}"></label>
      <label>Caregivers (comma separated)<input name="caregivers" value="${esc(s.caregivers.join(', '))}"></label>
      <label>I am<select name="me">${s.caregivers.map(c => `<option ${c === s.me ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Theme<select name="theme">${['auto', 'light', 'dark'].map(t => `<option ${t === s.theme ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <button class="btn primary">Save settings</button>
    </form>
    <section class="card"><div class="label">Your data (${count} entries, stored only on this device)</div>
      <p class="small">Back up regularly — especially before changing phones. Import a backup on another phone to continue there.</p>
      <div class="row wrap"><button class="btn" data-act="export">⬇️ Backup (JSON)</button><button class="btn" data-act="csv">⬇️ Export CSV</button>
      <label class="btn">⬆️ Restore backup<input type="file" id="importFile" accept="application/json" hidden></label></div>
      <div class="row wrap"><button class="btn" data-act="demo">Load 7 days of sample data</button><button class="btn danger" data-act="wipe">Erase everything</button></div></section>
    <section class="card small muted"><b>About.</b> Parenthood Arena is a personal, offline-first app. Nothing is sent to any server.
      Content is general guidance based on WHO, AAP/AASM, CDC, IAP, Gottman Institute and Harvard Center on the Developing Child; always follow your paediatrician.</section>`;
  $('#settingsForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const caregivers = String(fd.get('caregivers')).split(',').map(x => x.trim()).filter(Boolean);
    S.settings = { ...S.settings, name: fd.get('name').trim(), dob: fd.get('dob'), premature: Number(fd.get('premature')) || 0, wake: fd.get('wake') || '06:30',
      caregivers: caregivers.length ? caregivers : ['Parent'], me: caregivers.includes(fd.get('me')) ? fd.get('me') : caregivers[0], theme: fd.get('theme') };
    await db.setKV('settings', S.settings);
    applyTheme(); await refreshAge();
    toast('Settings saved'); S.view = 'today'; route();
  });
}

function renderOnboarding() {
  $('#hdr').innerHTML = '';
  document.body.classList.add('onboarding');
  main().innerHTML = `<section class="card onboard">
    <h1>👶 Parenthood Arena</h1>
    <p>Track every part of your child's day, from wake-up to sleep, with guidance, timetable and milestones that change automatically as he grows from baby to teen.</p>
    <form id="obForm">
      <label>Child's name<input name="name" required placeholder="e.g. Aadhi"></label>
      <label>Date of birth<input type="date" name="dob" required max="${dateKey()}"></label>
      <label>Born early by (weeks, 0 if on time)<input type="number" name="premature" value="0" min="0" max="16"></label>
      <label>Usual wake-up time<input type="time" name="wake" value="06:30"></label>
      <label>I am<input name="me" value="Amma"></label>
      <button class="btn primary wide">Start</button>
    </form></section>`;
  $('#obForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const me = fd.get('me').trim() || 'Amma';
    const caregivers = [...new Set([me, ...DEFAULT_SETTINGS.caregivers])];
    S.settings = { ...DEFAULT_SETTINGS, name: fd.get('name').trim(), dob: fd.get('dob'), premature: Number(fd.get('premature')) || 0, wake: fd.get('wake') || '06:30', me, caregivers };
    await db.setKV('settings', S.settings);
    await refreshAge();
    await db.setKV('lastStage', S.stage.id);
    document.body.classList.remove('onboarding');
    route();
  });
}

// ------------------------------------------------------------------ backup / demo
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function exportJSON() {
  const data = { app: 'parenthood-arena', version: 1, exportedAt: new Date().toISOString(), kv: await db.allKV(), entries: await db.all() };
  download(`parenthood-backup-${dateKey()}.json`, JSON.stringify(data), 'application/json');
}
async function exportCSV() {
  const rows = (await db.all()).sort((a, b) => a.start - b.start);
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['date', 'start', 'end', 'duration_min', 'type', 'details', 'note', 'by'].join(',')]
    .concat(rows.map(e => [e.date, fmtTime(e.start), e.end ? fmtTime(e.end) : '', e.end ? Math.round(entryMinutes(e)) : '', typeInfo(e.type).label, entrySummary(e), e.note, e.by].map(q).join(',')));
  download(`parenthood-${dateKey()}.csv`, lines.join('\n'), 'text/csv');
}
async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'parenthood-arena' || !Array.isArray(data.entries)) throw new Error('Not a Parenthood Arena backup');
    if (!confirm(`Restore ${data.entries.length} entries from ${data.exportedAt?.slice(0, 10)}? Entries with the same id are overwritten; others are kept.`)) return;
    await db.bulkPut(data.entries);
    for (const [k, v] of Object.entries(data.kv || {})) await db.setKV(k, v);
    S.settings = await db.getKV('settings'); applyTheme(); await refreshAge();
    toast('Backup restored'); route();
  } catch (err) { alert('Could not import: ' + err.message); }
}
async function loadDemo() {
  if (!confirm('Add 7 days of sample entries so you can see how the app looks? You can delete them later with "Erase everything".')) return;
  const out = [];
  const at = (d, hm) => { const [h, m] = hm.split(':').map(Number); const x = parseKey(d); x.setHours(h, m, 0, 0); return x.getTime(); };
  const add = (type, d, s, e, data = {}) => out.push({ id: uid(), type, start: at(d, s), end: e ? at(e[0], e[1]) : null, date: d, data, note: '', by: S.settings.me, createdAt: Date.now(), demo: true });
  const foods = [['Ragi porridge', 4, 'tbsp'], ['Idli (mashed)', 1, 'piece'], ['Banana', 0.5, 'piece'], ['Dal rice with ghee', 6, 'tbsp'], ['Curd rice', 5, 'tbsp'], ['Carrot (steamed)', 3, 'tbsp'], ['Egg yolk', 1, 'piece'], ['Khichdi', 6, 'tbsp']];
  for (let i = 6; i >= 1; i--) {
    const d = addDays(dateKey(), -i), prev = addDays(d, -1);
    add('sleep', prev, '19:45', [d, `06:${10 + i * 3}`], { wakeups: i % 3, quality: 'Good', settle: 'Fed to sleep' });
    add('wake', d, `06:${10 + i * 3}`, null, { mood: 'Happy' });
    add('study', d, '07:00', [d, '07:15'], { activity: 'Reading aloud', details: 'Animal board book', focus: 4 });
    add('meal', d, '08:00', null, { meal: 'Breakfast', foods: [{ name: foods[i % 8][0], qty: foods[i % 8][1], unit: foods[i % 8][2] }], appetite: 'Most' });
    add('nap', d, '09:00', [d, i % 2 ? '10:10' : '10:30'], { quality: 'Good' });
    add('bath', d, '10:40', [d, '11:05'], { kind: 'Oil massage + bath' });
    add('meal', d, '12:15', null, { meal: 'Lunch', foods: [{ name: foods[(i + 3) % 8][0], qty: foods[(i + 3) % 8][1], unit: foods[(i + 3) % 8][2] }], appetite: i % 3 ? 'All of it' : 'Half' });
    add('nap', d, '13:15', [d, '14:45'], { quality: 'Great' });
    add('play', d, '15:30', [d, '16:15'], { where: 'Indoor', kind: 'Stacking / blocks', with: 'Amma' });
    add('walk', d, '16:30', [d, i % 2 ? '17:00' : '17:20'], { mode: 'Pram / stroller', place: 'Park' });
    add('meal', d, '18:30', null, { meal: 'Dinner', foods: [{ name: foods[(i + 5) % 8][0], qty: 5, unit: 'tbsp' }], appetite: 'Most' });
    add('reading', d, '19:15', [d, '19:30'], { title: 'Goodnight Moon', by: 'Appa' });
    for (let p = 0; p < 6 + (i % 3); p++) add('pee', d, `${String(7 + p * 2).padStart(2, '0')}:20`, null, { how: 'Diaper / nappy' });
    add('poop', d, '09:45', null, { how: 'Diaper / nappy', consistency: 'Normal / soft' });
    for (let f = 0; f < 4; f++) add('breastfeed', d, ['06:30', '11:15', '15:00', '19:30'][f], [d, ['06:45', '11:30', '15:15', '19:45'][f]], { side: 'Both' });
    if (i % 2) add('behaviour', d, '17:10', null, { kind: 'pos', b: 'social', details: 'Laughed and clapped at peek-a-boo', responses: ['Hug / smile'] });
    if (i % 3 === 0) add('behaviour', d, '18:00', null, { kind: 'neg', b: 'crying', trigger: 'Tired / overdue nap', intensity: 3, responses: ['Stayed calm & close', 'Named the feeling'], outcome: 'Calmed in 2–10 min' });
  }
  await db.bulkPut(out);
  for (const f of foods) await trackFoods([{ name: f[0] }], addDays(dateKey(), -6), '', null);
  toast('Sample data added'); route();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2500);
}

// ------------------------------------------------------------------ events
async function onClick(ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) { if (ev.target.id === 'sheet') closeSheet(); return; }
  const a = el.dataset.act;
  switch (a) {
    case 'view': S.view = el.dataset.view; closeSheet(); route(); break;
    case 'close': closeSheet(); break;
    case 'openPicker': openPicker(); break;
    case 'form': openForm(el.dataset.type, null, { focusFoods: el.dataset.type === 'meal' }); break;
    case 'behaviour': openBehaviour(el.dataset.kind); break;
    case 'edit': {
      const e = await db.get(el.dataset.id);
      if (!e) return;
      if (e.type === 'behaviour') openBehaviour(e.data.kind, e);
      else if (e.type === 'ei') { if (confirm('Remove this EI activity log?')) { await db.del(e.id); route(); } }
      else openForm(e.type, e);
      break;
    }
    case 'delete': if (confirm('Delete this entry?')) { await db.del(el.dataset.id); closeSheet(); toast('Deleted'); route(); } break;
    case 'startTimer': saveForm(true); break;
    case 'stop': { const e = await db.get(el.dataset.id); e.end = Date.now(); await db.put(e); toast(`${typeInfo(e.type).label}: ${fmtDur(entryMinutes(e))}`); route(); break; }
    case 'quick': {
      const type = el.dataset.type;
      if (type === 'pee' || type === 'wake') {
        const prev = (await db.byType(type)).sort((x, y) => y.start - x.start)[0];
        const data = type === 'pee' ? { how: prev?.data?.how || (S.months < 30 ? 'Diaper / nappy' : 'Toilet') } : {};
        await db.put({ id: uid(), type, start: Date.now(), end: null, date: dateKey(), data, note: '', by: S.settings.me, createdAt: Date.now() });
        toast(type === 'pee' ? '💛 Pee logged (+1)' : '🌅 Good morning!');
        if (type === 'wake') { // auto-stop a running night sleep
          const run = (await db.byType('sleep')).find(e => !e.end);
          if (run) { run.end = Date.now(); await db.put(run); }
        }
        route();
      } else openForm(type);
      break;
    }
    case 'quickTimed': {
      const type = el.dataset.type;
      const running = (await db.byType(type)).find(e => !e.end);
      if (running) { running.end = Date.now(); await db.put(running); toast(`${typeInfo(type).label}: ${fmtDur(entryMinutes(running))}`); route(); }
      else openForm(type);
      break;
    }
    case 'eidone': {
      await db.put({ id: uid(), type: 'ei', start: Date.now(), end: null, date: dateKey(), data: { text: el.dataset.text }, note: '', by: S.settings.me, createdAt: Date.now() });
      toast('💛 Lovely! Logged.'); route(); break;
    }
    case 'ackStage': await db.setKV('lastStage', S.stage.id); route(); break;
    case 'addFood': $('#foods').insertAdjacentHTML('beforeend', foodRow()); $('#foods .food-row:last-child input').focus(); break;
    case 'rmFood': el.closest('.food-row').remove(); break;
    case 'day': S.diaryDate = addDays(S.diaryDate, Number(el.dataset.delta)); if (S.diaryDate > dateKey()) S.diaryDate = dateKey(); route(); break;
    case 'growTab': S.growTab = el.dataset.tab; route(); break;
    case 'trendDays': S.trendDays = Number(el.dataset.days); route(); break;
    case 'editRoutine': openRoutineEditor(); break;
    case 'addRow': $('#rtrows').insertAdjacentHTML('beforeend', $('#rtTpl').innerHTML); break;
    case 'rmRow': el.closest('.rt-row').remove(); break;
    case 'saveRoutine': {
      const rows = [...document.querySelectorAll('.rt-row')].map(r => ({ t: r.querySelector('.rt-t').value, label: r.querySelector('.rt-l').value.trim(), type: r.querySelector('.rt-type').value, dur: Number(r.querySelector('.rt-d').value) || 0 })).filter(r => r.t && r.label);
      await db.setKV(`routine:${S.stage.id}`, rows); closeSheet(); toast('Timetable saved'); route(); break;
    }
    case 'resetRoutine': if (confirm('Go back to the recommended timetable?')) { await db.setKV(`routine:${S.stage.id}`, null); route(); } break;
    case 'export': exportJSON(); break;
    case 'csv': exportCSV(); break;
    case 'demo': loadDemo(); break;
    case 'wipe':
      if (confirm('Erase ALL data on this device? Make a backup first. This cannot be undone.') && prompt('Type ERASE to confirm') === 'ERASE') {
        await db.clearAll(); location.reload();
      }
      break;
  }
}

async function onChange(ev) {
  const t = ev.target;
  if (t.id === 'diaryDate' && t.value) { S.diaryDate = t.value > dateKey() ? dateKey() : t.value; route(); }
  if (t.id === 'guideAll') { S.guideAll = t.checked; route(); }
  if (t.id === 'importFile' && t.files[0]) importJSON(t.files[0]);
  if (t.dataset.ms) {
    const st = await db.getKV('milestones', {});
    if (t.checked) st[t.dataset.ms] = dateKey(); else delete st[t.dataset.ms];
    await db.setKV('milestones', st); route();
  }
  if (t.dataset.vax) {
    const st = await db.getKV('vaccines', {});
    if (t.checked) st[t.dataset.vax] = prompt('Date given (YYYY-MM-DD)', dateKey()) || dateKey(); else delete st[t.dataset.vax];
    await db.setKV('vaccines', st); route();
  }
}

boot();
