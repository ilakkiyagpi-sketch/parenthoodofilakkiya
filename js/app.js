import { db } from './db.js';
import { LOG_TYPES, FOOD_UNITS, MED_FREQ, typeByKey, typesForAge, fieldOptions, fieldsForAge,
  POSITIVE_BEHAVIOURS, CHALLENGING_BEHAVIOURS, TRIGGERS, RESPONSES, OUTCOMES, behaviourForAge } from './catalog.js';
import { STAGES, stageFor, nextStage, MILESTONES, RED_FLAGS, VACCINES, MILESTONE_TIPS, milestoneFocus } from './stages.js';
import { GUIDE, DAILY_TIPS } from './guide.js';
import { esc, uid, dateKey, parseKey, addDays, fmtTime, toLocalInput, fromLocalInput, fmtDur, fmtDateLong, fmtDateShort,
  hmToMin, minToHm, ageMonths, ageText, dayOfYear, entryMinutes } from './util.js';
import { barChart, pairChart, lineChart, wireTooltips } from './charts.js';
import { startAutoSync, syncNow, getConfig, setConfig, getState, pendingCount, testConnection, restoreFromSheet } from './sync.js';
import { savePhotoFile, thumbHtml, watchPhotos } from './photos.js';
import { voiceSupported, listen, stopListening, parseVoice } from './voice.js';

const APP_NAME = 'Happy Parenthood';

// ------------------------------------------------------------------ state
const S = {
  settings: null, months: 0, stage: null,
  view: 'home', homeTab: 'log', moreOpen: false, diaryDate: dateKey(), growTab: 'milestones', trendDays: 7, guideAll: false,
  healthTab: 'illness', healthQ: '', voiceItems: null, voiceText: '',
};
const $ = sel => document.querySelector(sel);
const main = () => $('#main');

const DEFAULT_SETTINGS = { name: '', dob: '', premature: 0, wake: '06:30', caregivers: ['Amma', 'Appa', 'Paati', 'Thatha'], me: 'Amma', theme: 'auto', voiceLang: 'en-IN', home: null };

// Pseudo log types handled outside the catalog
const SPECIAL = {
  behaviour: { key: 'behaviour', label: 'Behaviour', icon: '🧭', fields: [] },
  ei: { key: 'ei', label: 'EI activity', icon: '💛', fields: [] },
};
const typeInfo = k => typeByKey(k) || SPECIAL[k] || { key: k, label: k, icon: '•', fields: [] };

// Category colours for buttons (see CSS .c-*)
const CAT = { sleep: 'sleep', nap: 'sleep', wake: 'sleep', meal: 'food', breastfeed: 'food', bottle: 'food', water: 'food', pee: 'toilet', poop: 'toilet', potty: 'toilet',
  bath: 'care', massage: 'care', teeth: 'care', play: 'play', walk: 'play', floor: 'play', exercise: 'play', screen: 'play', hobby: 'play',
  study: 'learn', reading: 'learn', homework: 'learn', sick: 'health', medicine: 'health', illness: 'health', prescription: 'health', doctor: 'health',
  memory: 'feel', mood: 'feel', kind: 'feel', note: 'feel', growth: 'health' };

// All home buttons. mode: toggle (tap start / tap stop), count (instant +1), form (opens a short form), kind (kind act)
const QUICK = [
  { k: 'sleep', mode: 'toggle', icon: '🌙', label: 'Night sleep' }, { k: 'nap', mode: 'toggle', icon: '😴', label: 'Nap', max: 72 },
  { k: 'meal', mode: 'toggle', icon: '🥣', label: 'Eating', min: 5 }, { k: 'breastfeed', mode: 'toggle', icon: '🤱', label: 'Breastfeed', max: 30 },
  { k: 'pee', mode: 'count', icon: '💛', label: 'Pee' }, { k: 'poop', mode: 'count', icon: '💩', label: 'Poop' },
  { k: 'play', mode: 'toggle', icon: '🧸', label: 'Play' }, { k: 'bath', mode: 'toggle', icon: '🛁', label: 'Bath' },
  { k: 'memory', mode: 'form', icon: '✨', label: 'New today' }, { k: 'walk', mode: 'toggle', icon: '🌳', label: 'Walk' },
  { k: 'study', mode: 'toggle', icon: '📚', label: 'Learning' }, { k: 'reading', mode: 'toggle', icon: '📖', label: 'Story' },
  { k: 'floor', mode: 'toggle', icon: '🐛', label: 'Crawl time', max: 15 }, { k: 'massage', mode: 'toggle', icon: '🫗', label: 'Massage', max: 36 },
  { k: 'homework', mode: 'toggle', icon: '✏️', label: 'Homework', min: 60 }, { k: 'exercise', mode: 'toggle', icon: '⚽', label: 'Sport', min: 42 },
  { k: 'screen', mode: 'toggle', icon: '📱', label: 'Screen' }, { k: 'wake', mode: 'count', icon: '🌅', label: 'Woke up' },
  { k: 'bottle', mode: 'form', icon: '🍼', label: 'Bottle', max: 48 }, { k: 'water', mode: 'form', icon: '🥤', label: 'Water', min: 6 },
  { k: 'sick', mode: 'form', icon: '🌡️', label: 'Temp' }, { k: 'medicine', mode: 'form', icon: '💊', label: 'Medicine' },
  { k: 'mood', mode: 'form', icon: '🙂', label: 'Mood' }, { k: 'kind', mode: 'kind', icon: '💗', label: 'Kind act' },
  { k: 'note', mode: 'form', icon: '📝', label: 'Note' },
];
const quickForAge = () => QUICK.filter(q => S.months >= (q.min ?? 0) && S.months < (q.max ?? 9999));
function homeKeys() {
  const avail = quickForAge().map(q => q.k);
  const chosen = (S.settings.home || []).filter(k => avail.includes(k));
  if (chosen.length) return chosen.slice(0, 8);
  const pref = ['sleep', 'nap', 'meal', 'breastfeed', 'pee', 'poop', 'play', 'bath', 'memory', 'walk', 'study', 'homework'];
  return pref.filter(k => avail.includes(k)).slice(0, 8);
}

// Install-as-app support
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ------------------------------------------------------------------ boot
async function boot() {
  S.settings = await db.getKV('settings');
  if (S.settings) S.settings = { ...DEFAULT_SETTINGS, ...S.settings };
  applyTheme();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  wireTooltips(document.body);
  watchPhotos();
  setInterval(tickTimers, 1000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.settings?.dob) renderHeader(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast(`🎉 Installed! Open ${APP_NAME} from your home screen.`); if (S.settings?.dob) renderHeader(); });
  startAutoSync({ buildRow, status: renderSyncBadge });
  if (!S.settings?.dob) return renderOnboarding();
  await refreshAge();
  route();
}

// Row sent to the Google Sheet: readable columns + the full entry for restoring
async function buildRow(e) {
  const t = typeInfo(e.type);
  const stamp = ms => ms ? `${dateKey(ms)} ${fmtTime(ms)}` : '';
  const links = [];
  for (const pid of e.data?.photos || []) { const p = await db.getPhoto(pid); if (p?.driveUrl) links.push(p.driveUrl); }
  return { id: e.id, date: e.date, start: stamp(e.start), end: t.timed ? stamp(e.end) : '', duration: e.end && t.timed ? Math.round(entryMinutes(e)) : '',
    type: e.type, activity: t.label, details: entrySummary(e), note: e.note || '', by: e.by || '', updatedAt: e.updatedAt, photos: links.join('\n'), entry: e };
}

async function renderSyncBadge(state) {
  const el = $('#syncBadge');
  if (!el) return;
  const cfg = await getConfig();
  if (!cfg.enabled) { el.textContent = '☁️'; el.className = 'sync-badge off'; el.title = 'Online backup is off — tap to set up'; el.setAttribute('aria-label', el.title); return; }
  const n = await pendingCount(), st = await getState();
  let txt, cls, title;
  if (state === 'syncing') [txt, cls, title] = ['☁️ ⟳', 'busy', 'Backing up…'];
  else if (!navigator.onLine) [txt, cls, title] = [`☁️ ${n}`, 'warn', 'Offline — will back up when online'];
  else if (st.lastError && n) [txt, cls, title] = ['☁️ ⚠', 'err', 'Backup problem: ' + st.lastError];
  else if (n) [txt, cls, title] = [`☁️ ${n}`, 'busy', `${n} changes waiting to back up`];
  else [txt, cls, title] = ['☁️ ✓', 'ok', st.lastSync ? `Backed up ${new Date(st.lastSync).toLocaleString()}` : 'Backed up'];
  el.textContent = txt; el.className = 'sync-badge ' + cls; el.title = title; el.setAttribute('aria-label', title);
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

const NAV_OF = { home: 'home', diary: 'diary', health: 'health', heart: 'heart', more: 'more', grow: 'more', routine: 'more', guide: 'more', settings: 'more' };
function route() {
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === NAV_OF[S.view] ? 'page' : 'false'));
  document.body.dataset.view = S.view;
  renderHeader();
  ({ home: renderHome, diary: renderDiary, health: renderHealth, heart: renderHeart, more: renderMore, grow: renderGrow, routine: renderRoutine, guide: renderGuide, settings: renderSettings })[S.view]();
  window.scrollTo(0, 0);
}

function renderHeader() {
  const s = S.settings;
  const canInstall = !isStandalone() && (installEvt || isIOS);
  $('#hdr').innerHTML = `<div class="who"><div class="avatar" aria-hidden="true">${esc((s.name || '?')[0].toUpperCase())}</div>
    <div><div class="name">${esc(s.name)}</div><div class="sub">${esc(ageText(s.dob))} · ${S.stage.emoji} ${esc(S.stage.name)}</div></div></div>
    <div class="hdr-actions">${canInstall ? '<button class="pill-btn install" data-act="install">📲 Install</button>' : ''}
    <button id="syncBadge" class="sync-badge" data-act="view" data-view="settings"></button>
    <button class="icon-btn" data-act="view" data-view="settings" aria-label="Settings">⚙️</button></div>`;
  renderSyncBadge();
}

// ------------------------------------------------------------------ data helpers
async function entriesAround(date) {
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
    news: of('memory').length,
  };
}

function entrySummary(e) {
  const t = typeInfo(e.type), d = e.data || {};
  if (e.type === 'behaviour') {
    const b = [...POSITIVE_BEHAVIOURS, ...CHALLENGING_BEHAVIOURS].find(x => x.k === d.b);
    return [b ? `${b.icon} ${b.label}` : 'Behaviour', d.details, d.trigger && `trigger: ${d.trigger}`, d.responses?.length && `we: ${d.responses.join(', ')}`, d.outcome].filter(Boolean).join(' · ');
  }
  if (e.type === 'ei') return d.text || '';
  const parts = [];
  if (e.start && e.end && t.timed && entryMinutes(e) >= 1) parts.push(fmtDur(entryMinutes(e)));
  if (e.start && !e.end && t.timed) parts.push('⏱ running');
  for (const f of (t.fields || [])) {
    const v = d[f.k];
    if (v === undefined || v === '' || v === false || v === null || (Array.isArray(v) && !v.length)) continue;
    if (f.kind === 'foods') parts.push(v.map(x => `${x.name}${x.qty ? ` ${x.qty} ${x.unit || ''}` : ''}${x.isNew ? ' 🆕' : ''}`).join(', '));
    else if (f.kind === 'meds') parts.push(v.map(x => [x.name, x.dose, x.freq, x.days && `${x.days} days`].filter(Boolean).join(' ')).join('; '));
    else if (f.kind === 'illness') continue;
    else if (f.kind === 'date') parts.push(`${f.k === 'recovered' ? 'recovered' : 'next visit'} ${fmtDateShort(v)}`);
    else if (f.kind === 'check') parts.push(f.k === 'first' ? '⭐ first' : f.label);
    else if (f.kind === 'rating') parts.push('★'.repeat(v));
    else if (Array.isArray(v)) parts.push(v.join(', '));
    else parts.push(`${v}${f.unit ? ' ' + f.unit : ''}`);
  }
  if (d.photos?.length) parts.push(`📷 ${d.photos.length}`);
  return parts.join(' · ');
}

// ------------------------------------------------------------------ HOME
async function renderHome() {
  const today = dateKey();
  const list = await entriesAround(today);
  const sm = summarize(list, today);
  const running = (await db.all()).filter(e => typeInfo(e.type).timed && e.start && !e.end);
  const banner = await stageBanner();
  const keys = homeKeys();
  const quick = quickForAge();
  const mainBtns = keys.map(k => quick.find(q => q.k === k)).filter(Boolean);
  const moreBtns = quick.filter(q => !keys.includes(q.k));
  const hiddenRunning = running.filter(e => !keys.includes(e.type) && !(S.moreOpen && moreBtns.some(q => q.k === e.type)));
  const tg = S.stage.targets;

  let tabBody = '';
  if (S.homeTab === 'log') tabBody = entryList(list.filter(e => e.date === today).reverse(), 'Nothing logged yet today. Tap a button above, or say it with 🎤.');
  else if (S.homeTab === 'summary') tabBody = homeSummary(sm, tg);
  else tabBody = await homeMonth(list, today);

  main().innerHTML = `
    ${banner}
    ${await installNudge()}
    ${hiddenRunning.map(e => `<div class="run-pill c-${CAT[e.type] || 'feel'}"><span>${typeInfo(e.type).icon} <b>${esc(typeInfo(e.type).label)}</b> <span data-since="${e.start}">${fmtDur(entryMinutes(e))}</span></span>
      <button class="pill-btn" data-act="toggle" data-type="${e.type}">Stop</button></div>`).join('')}
    <button class="voice-cta" data-act="voice"><span class="mic-dot">🎤</span><span><b>Tell me what happened</b><br><small>“He ate 4 spoons of ragi at 8 and napped for an hour”</small></span></button>
    <section class="quick">${mainBtns.map(q => quickBtn(q, running, sm)).join('')}</section>
    <button class="more-toggle" data-act="moreBtns" aria-expanded="${S.moreOpen}">${S.moreOpen ? '▴ Fewer buttons' : `▾ More buttons (${moreBtns.length})`}</button>
    ${S.moreOpen ? `<section class="quick small">${moreBtns.map(q => quickBtn(q, running, sm)).join('')}</section>` : ''}
    <section class="glance" aria-label="Today at a glance">
      ${glance('🌙', fmtDur(sm.sleepMin), 'sleep')}${glance('🥣', sm.meals, 'meals')}${glance('💛', sm.pee, 'pee')}${glance('🧸', fmtDur(sm.playMin + sm.outdoorMin), 'play')}
    </section>
    <div class="seg" role="tablist">
      ${[['log', "Today's log"], ['summary', 'Summary'], ['month', 'This month']].map(([k, l]) => `<button role="tab" data-act="homeTab" data-tab="${k}" aria-pressed="${S.homeTab === k}">${l}</button>`).join('')}
    </div>
    <div class="tab-body">${tabBody}</div>`;
}

function quickBtn(q, running, sm) {
  const c = CAT[q.k] || 'feel';
  if (q.mode === 'toggle') {
    const run = running.find(e => e.type === q.k);
    return run
      ? `<button class="qb on c-${c}" data-act="toggle" data-type="${q.k}" aria-pressed="true"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><b class="elapsed" data-since="${run.start}">${fmtDur(entryMinutes(run))}</b><small>tap to stop</small></button>`
      : `<button class="qb c-${c}" data-act="toggle" data-type="${q.k}" aria-pressed="false"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>tap to start</small></button>`;
  }
  if (q.mode === 'count') {
    const n = q.k === 'pee' ? sm.pee : q.k === 'poop' ? sm.poop : null;
    return `<button class="qb c-${c}" data-act="quick" data-type="${q.k}"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}${n !== null ? ' +1' : ''}</span><small>${n !== null ? `${n} today` : 'tap'}</small></button>`;
  }
  if (q.mode === 'kind') return `<button class="qb c-${c}" data-act="behaviour" data-kind="pos"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>tap</small></button>`;
  return `<button class="qb c-${c}" data-act="form" data-type="${q.k}" ${q.k === 'memory' ? 'data-first="1"' : ''}><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>add</small></button>`;
}
const glance = (icon, v, l) => `<button class="g" data-act="homeTab" data-tab="summary"><span>${icon}</span><b>${esc(v)}</b><small>${l}</small></button>`;

function homeSummary(sm, tg) {
  return `<section class="tiles">
    ${tile('🌙', 'Sleep', fmtDur(sm.sleepMin), `${tg.sleep[0]}–${tg.sleep[1]} h`, rangeStatus(sm.sleepMin / 60, tg.sleep, true), `night ${fmtDur(sm.nightMin)} · ${sm.napCount} naps`)}
    ${tg.naps[1] > 0 ? tile('😴', 'Naps', sm.napCount, `${tg.naps[0]}–${tg.naps[1]}`, rangeStatus(sm.napCount, tg.naps, true)) : ''}
    ${tile('🥣', 'Meals', sm.meals, `${tg.meals}${S.months < 24 ? ' + snacks' : ''}`, tg.meals ? rangeStatus(sm.meals, [tg.meals, 9], true) : null, sm.foods.map(f => f.name).slice(0, 3).join(', '))}
    ${tg.feeds[1] > 0 ? tile('🍼', 'Milk feeds', sm.feeds, `${tg.feeds[0]}–${tg.feeds[1]}`, null, sm.milkMl ? `${sm.milkMl} ml bottle` : '') : ''}
    ${tile('💛', 'Pee / poop', `${sm.pee} / ${sm.poop}`, S.months < 36 ? `${tg.pee[0]}+ wet` : '', S.months < 24 ? rangeStatus(sm.pee, tg.pee, true) : null)}
    ${tile('🌳', 'Outdoor', fmtDur(sm.outdoorMin), S.months < 12 ? 'fresh air daily' : `${tg.activeMin} min active`, null)}
    ${tile('📚', 'Learning', fmtDur(sm.learnMin), `${tg.readMin}+ min`, rangeStatus(sm.learnMin, [tg.readMin, 999], true))}
    ${tile('📱', 'Screen', fmtDur(sm.screenMin), tg.screenMax ? `max ${tg.screenMax} min` : 'none advised', sm.screenMin > tg.screenMax ? 'high' : 'ok')}
    ${tile('💗', 'Kind / tough', `${sm.pos} / ${sm.neg}`, 'notice the good', null)}
  </section>`;
}

async function homeMonth(list, today) {
  const st = S.stage;
  const state = await db.getKV('milestones', {});
  const { passed, next } = milestoneFocus(S.months);
  const tip = pickDaily(DAILY_TIPS.filter(t => S.months >= t.min && S.months < t.max), 1).text;
  const ei = pickDaily(st.ei.activities, 0);
  const eiDone = list.some(e => e.type === 'ei' && e.date === today && e.data?.text === ei);
  const monthStart = today.slice(0, 8) + '01';
  const news = (await db.range(monthStart, today)).filter(e => e.type === 'memory').sort((a, b) => b.start - a.start);
  const routine = await getRoutine();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nx = routine.find(r => r.min >= nowMin - 10) || routine[0];
  const msList = (c, title, cls, limit) => {
    if (!c) return '';
    const todo = c.items.map((it, i) => ({ it, i, k: `${c.at}:${i}` })).filter(x => !state[x.k]);
    const done = c.items.length - todo.length;
    return `<section class="card ms-focus ${cls}"><div class="row between"><div class="label">${title}</div><span class="badge ${done === c.items.length ? 'ok' : ''}">${done}/${c.items.length} ✓</span></div>
      ${todo.length ? (() => {
        const shown = todo.slice(0, limit), seen = new Set();
        return `<ul class="checklist">${shown.map(x => {
          const cat = x.it[0], tipText = !seen.has(cat) && MILESTONE_TIPS[c.at]?.[cat];
          seen.add(cat);
          return `<li><label class="check"><input type="checkbox" data-ms="${x.k}"> <span>${esc(x.it[1])}${tipText ? `<br><small class="tip-inline">💡 ${esc(tipText)}</small>` : ''}</span></label></li>`;
        }).join('')}</ul>${todo.length > limit ? `<button class="btn small" data-act="goGrow" data-tab="milestones">See all ${todo.length}</button>` : ''}`;
      })() : '<p>🎉 All done! Great going.</p>'}</section>`;
  };
  return `
    ${msList(next, `🎯 Working towards · by ${ageLabel(next?.at)}`, 'next', 5)}
    ${passed && passed !== next ? msList(passed, `✅ Should be doing now · by ${ageLabel(passed.at)}`, 'passed', 4) : ''}
    <p class="muted small">Tick a milestone when you see him do it. Every child grows at their own pace — if something in "should be doing now" isn't happening, mention it at the next paediatric visit.</p>
    <section class="card"><div class="row between"><div class="label">✨ New things this month (${news.length})</div><button class="btn small" data-act="form" data-type="memory" data-first="1">＋ Add</button></div>
      ${news.length ? `<ul class="mini-list">${news.slice(0, 4).map(e => `<li data-act="edit" data-id="${e.id}"><b>${esc(fmtDateShort(e.date))}</b> ${esc(e.data?.text || e.note)}</li>`).join('')}</ul>` : '<p class="muted small">Clapped? Said a new word? Stood up? Tap ✨ New today on the home screen.</p>'}</section>
    <section class="card ei"><div class="label">💛 Today's feelings activity</div><p>${esc(ei)}</p>
      <button class="btn ${eiDone ? '' : 'primary'} small" data-act="eidone" data-text="${esc(ei)}" ${eiDone ? 'disabled' : ''}>${eiDone ? '✓ Done today' : 'We did it'}</button></section>
    <section class="card tip"><div class="label">🌱 Tip of the day</div><p>${esc(tip)}</p></section>
    <section class="card"><div class="row between"><div><div class="label">🕒 Next in routine</div><b>${minToHm(nx.min)}</b> · ${esc(nx.label)}</div><button class="btn small" data-act="view" data-view="routine">Timetable</button></div></section>`;
}
const ageLabel = at => at == null ? '' : at < 24 ? `${at} months` : `${at / 12} years`;

function tile(icon, label, value, target, status, sub = '') {
  const st = status ? { ok: ['✓', 'On track'], low: ['↓', 'Low'], high: ['↑', 'High'] }[status] : null;
  return `<div class="tile ${status || ''}"><div class="t-top"><span>${icon} ${esc(label)}</span>${st ? `<span class="badge ${status}" title="${st[1]}">${st[0]} ${st[1]}</span>` : ''}</div>
    <div class="t-val">${esc(value)}</div><div class="t-sub">${target ? `Aim: ${esc(target)}` : ''}${sub ? `<br>${esc(sub)}` : ''}</div></div>`;
}
function rangeStatus(v, [lo, hi], partialDay = false) {
  if (v > hi) return 'high';
  if (v < lo) return partialDay && new Date().getHours() < 20 ? null : 'low';
  return 'ok';
}
function pickDaily(arr, salt) {
  if (!arr.length) return '';
  return arr[(dayOfYear() + salt * 7) % arr.length];
}

function entryList(list, emptyText = 'Nothing logged yet.') {
  if (!list.length) return `<p class="empty">${esc(emptyText)}</p>`;
  return `<ul class="entries">${list.map(e => {
    const t = typeInfo(e.type);
    return `<li data-act="edit" data-id="${e.id}" class="c-${CAT[e.type] || 'feel'}"><span class="e-icon">${t.icon}</span>
      <span class="e-body"><span class="e-top"><b>${esc(t.label)}</b><span class="e-time">${fmtTime(e.start)}${e.end && t.timed && e.end !== e.start ? `–${fmtTime(e.end)}` : ''}</span></span>
      <span class="muted">${esc(entrySummary(e))}</span>${e.note ? `<br><i class="small">${esc(e.note)}</i>` : ''}
      ${e.data?.photos?.length ? `<span class="thumbs">${e.data.photos.slice(0, 3).map(id => thumbHtml(id)).join('')}</span>` : ''}</span></li>`;
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

async function installNudge() {
  if (isStandalone() || !(installEvt || isIOS)) return '';
  if (await db.getKV('installDismissed')) return '';
  return `<section class="card install-card"><div><b>📲 Put ${APP_NAME} on your home screen</b><br><small>Opens like a separate app, full screen, works offline.</small></div>
    <div class="row"><button class="btn primary small" data-act="install">Install</button><button class="btn small" data-act="installLater">Later</button></div></section>`;
}

// ------------------------------------------------------------------ SHEETS & FORMS
function openSheet(html, { focus = true } = {}) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-inner" role="dialog" aria-modal="true">${html}</div>`;
  sh.hidden = false;
  document.body.classList.add('locked');
  if (focus) sh.querySelector('input:not([type=hidden]):not([type=file]),select,textarea')?.focus({ preventScroll: true });
}
function closeSheet() { stopListening(); $('#sheet').hidden = true; $('#sheet').innerHTML = ''; document.body.classList.remove('locked'); }

function openPicker() {
  const types = typesForAge(S.months);
  const groups = [...new Set(types.map(t => t.group))];
  openSheet(`<div class="sheet-hd"><h3>What happened?</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <button class="voice-cta compact" data-act="voice"><span class="mic-dot">🎤</span><b>Say it instead</b></button>
    ${groups.map(g => `<div class="label">${esc(g)}</div><div class="grid-types">${types.filter(t => t.group === g).map(t =>
      `<button class="tt c-${CAT[t.key] || 'feel'}" data-act="form" data-type="${t.key}"><span>${t.icon}</span>${esc(t.label)}</button>`).join('')}</div>`).join('')}
    <div class="label">Behaviour</div><div class="grid-types">
      <button class="tt c-feel" data-act="behaviour" data-kind="pos"><span>💗</span>Positive behaviour</button>
      <button class="tt c-feel" data-act="behaviour" data-kind="neg"><span>🌋</span>Challenging behaviour</button></div>`, { focus: false });
}

const PHOTO_OPEN = ['meal', 'prescription', 'illness', 'memory', 'doctor', 'sick', 'growth', 'play', 'note'];

async function openForm(typeKey, entry = null, opts = {}) {
  const t = typeByKey(typeKey);
  if (!t) return;
  const pre = opts.prefill || {};
  const e = entry || { id: null, type: typeKey, start: pre.start ?? Date.now(), end: pre.end ?? null, data: { ...(pre.data || {}) }, note: pre.note || '', by: S.settings.me };
  const fields = fieldsForAge(t, S.months);
  const foodsMap = await db.getKV('foods', {});
  const foodsKnown = Object.keys(foodsMap).sort();
  const illnesses = fields.some(f => f.kind === 'illness') ? (await db.byType('illness')).sort((a, b) => b.start - a.start).slice(0, 15) : [];
  if (!entry && illnesses.length && fields.some(f => f.kind === 'illness') && e.data.illness === undefined) {
    const ongoing = illnesses.find(i => !i.data?.recovered);
    if (ongoing) e.data.illness = ongoing.id;
  }
  const lists = fields.some(f => f.list) ? await healthLists() : { meds: [], docs: [] };
  const durDefault = e.end && e.end !== e.start ? Math.round(entryMinutes(e)) : '';
  const photos = e.data?.photos || [];
  const topFoods = typeKey === 'meal' ? Object.entries(foodsMap).sort((a, b) => (b[1].last || b[1].first || '').localeCompare(a[1].last || a[1].first || '') || b[1].count - a[1].count).slice(0, 12) : [];
  openSheet(`<form id="logform" data-type="${t.key}" data-id="${e.id || ''}">
    <div class="sheet-hd"><h3>${t.icon} ${esc(t.label)}</h3><button type="button" class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    ${topFoods.length ? `<div class="label">Tap to add recent foods</div><div class="chips food-picks">${topFoods.map(([n, f]) => `<button type="button" class="chip-btn" data-act="pickFood" data-name="${esc(n)}" data-qty="${esc(f.lastQty || '')}" data-unit="${esc(f.lastUnit || 'tbsp')}">＋ ${esc(n)}</button>`).join('')}</div>` : ''}
    ${fields.map(f => fieldHtml(t, f, e.data?.[f.k], illnesses)).join('')}
    <div class="row two">
      <label>${t.timed ? 'Start' : 'When'}<input type="datetime-local" name="start" value="${toLocalInput(e.start)}" required></label>
      ${t.timed ? `<label>End<input type="datetime-local" name="end" value="${e.end ? toLocalInput(e.end) : ''}"></label>` : ''}
    </div>
    ${t.timed ? `<label>or duration (minutes)<input type="number" inputmode="numeric" name="dur" min="0" value="${durDefault}"></label>` : ''}
    ${PHOTO_OPEN.includes(t.key) ? photoField(photos) : `<details class="photo-more" ${photos.length ? 'open' : ''}><summary>📷 Add a photo</summary>${photoField(photos)}</details>`}
    ${textWithMic('note', 'Notes', e.note || '', 'Anything else worth remembering', true)}
    <label>Logged by<select name="by">${S.settings.caregivers.map(c => `<option ${c === (e.by || S.settings.me) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    ${typeKey === 'screen' && S.months < 24 ? `<p class="warn">ⓘ WHO and AAP advise avoiding screens under 2 years (video calls with family are fine).</p>` : ''}
    <div class="row actions">
      ${e.id ? `<button type="button" class="btn danger" data-act="delete" data-id="${e.id}">Delete</button>` : ''}
      ${t.timed && !e.id ? `<button type="button" class="btn" data-act="startTimer">⏱ Start timer</button>` : ''}
      <button type="submit" class="btn primary">Save</button>
    </div>
    <datalist id="foodlist">${foodsKnown.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
    <datalist id="medlist">${lists.meds.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
    <datalist id="doclist">${lists.docs.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
  </form>`, { focus: !opts.noFocus });
  $('#logform').addEventListener('submit', ev => { ev.preventDefault(); saveForm(false); });
  if (opts.focusFoods) $('#logform .food-row input')?.focus();
}

function photoField(ids) {
  return `<fieldset class="photos"><legend>📷 Photos</legend><div class="photo-grid" id="photoGrid">${ids.map(id => thumbHtml(id, true)).join('')}
    <label class="add-photo"><input type="file" accept="image/*" multiple id="photoInput" hidden><span>＋<br><small>Photo</small></span></label></div></fieldset>`;
}

const micBtn = name => voiceSupported ? `<button type="button" class="mic" data-act="dictate" data-target="${name}" aria-label="Speak to type">🎤</button>` : '';
function textWithMic(name, label, value, placeholder = '', area = false, list = '') {
  return `<label>${esc(label)}<span class="with-mic">${area
    ? `<textarea name="${name}" rows="2" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input type="text" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${list ? `list="${list}"` : ''}>`}${micBtn(name)}</span></label>`;
}

function fieldHtml(t, f, v, illnesses = []) {
  const name = `f_${f.k}`;
  const unit = f.unit ? ` <span class="muted">(${esc(f.unit)})</span>` : '';
  switch (f.kind) {
    case 'select': {
      const opts = fieldOptions(t, f, S.months);
      return `<fieldset><legend>${esc(f.label)}</legend><div class="chips">${opts.map(o => `<label class="chip"><input type="radio" name="${name}" value="${esc(o)}" ${o === v ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}${v && !opts.includes(v) ? `<label class="chip"><input type="radio" name="${name}" value="${esc(v)}" checked><span>${esc(v)}</span></label>` : ''}</div></fieldset>`;
    }
    case 'chips': {
      const opts = fieldOptions(t, f, S.months);
      return `<fieldset><legend>${esc(f.label)}</legend><div class="chips">${opts.map(o => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
    }
    case 'number': return `<label>${esc(f.label)}${unit}<input type="number" inputmode="decimal" step="${f.step || 'any'}" name="${name}" value="${esc(v ?? '')}"></label>`;
    case 'textarea': return textWithMic(name, f.label, v || '', '', true);
    case 'date': return `<label>${esc(f.label)}<input type="date" name="${name}" value="${esc(v || '')}"></label>`;
    case 'check': return `<label class="check"><input type="checkbox" name="${name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'rating': return `<fieldset><legend>${esc(f.label)}</legend><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${name}" value="${n}" ${Number(v) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>`;
    case 'illness':
      if (!illnesses.length) return '';
      return `<label>${esc(f.label)}<select name="${name}"><option value="">— not linked —</option>${illnesses.map(i => `<option value="${i.id}" ${i.id === v ? 'selected' : ''}>${esc(i.data?.title || 'Illness')} (${esc(fmtDateShort(i.date))}${i.data?.recovered ? '' : ', ongoing'})</option>`).join('')}</select></label>`;
    case 'foods': {
      const rows = (v && v.length ? v : [{ name: '', qty: '', unit: 'tbsp' }]);
      return `<fieldset><legend>${esc(f.label)}</legend><div id="foods">${rows.map(foodRow).join('')}</div>
        <button type="button" class="btn small" data-act="addFood">＋ Add another food</button></fieldset>`;
    }
    case 'meds': {
      const rows = (v && v.length ? v : [{}]);
      return `<fieldset><legend>${esc(f.label)}</legend><div id="meds">${rows.map(medRow).join('')}</div>
        <button type="button" class="btn small" data-act="addMed">＋ Add another medicine</button></fieldset>`;
    }
    default: return textWithMic(name, f.label, v || '', '', false, f.list || '');
  }
}
function foodRow(x = { name: '', qty: '', unit: 'tbsp' }) {
  return `<div class="food-row"><input list="foodlist" placeholder="Food (e.g. ragi porridge)" class="fname" value="${esc(x.name)}" aria-label="Food">
    <input type="number" inputmode="decimal" step="any" placeholder="Qty" class="fqty" value="${esc(x.qty)}" aria-label="Quantity">
    <select class="funit" aria-label="Unit">${FOOD_UNITS.map(u => `<option ${u === x.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
    <button type="button" class="icon-btn" data-act="rmRowEl" aria-label="Remove">✕</button></div>`;
}
function medRow(x = {}) {
  return `<div class="med-row"><input list="medlist" placeholder="Medicine name" class="mname" value="${esc(x.name || '')}" aria-label="Medicine name">
    <input placeholder="Dose (2.5 ml)" class="mdose" value="${esc(x.dose || '')}" aria-label="Dose">
    <select class="mfreq" aria-label="How often"><option value="">How often</option>${MED_FREQ.map(o => `<option ${o === x.freq ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <input type="number" inputmode="numeric" placeholder="Days" class="mdays" value="${esc(x.days || '')}" aria-label="Number of days">
    <select class="mwhen" aria-label="Before or after food"><option value="">Food?</option>${['Before food', 'After food', 'With food', 'Any time'].map(o => `<option ${o === x.when ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <button type="button" class="icon-btn" data-act="rmRowEl" aria-label="Remove">✕</button></div>`;
}

async function healthLists() {
  const meds = new Set(), docs = new Set();
  for (const e of await db.byType('prescription')) { (e.data?.meds || []).forEach(m => m.name && meds.add(m.name)); if (e.data?.doctor) docs.add(e.data.doctor); }
  for (const e of await db.byType('medicine')) if (e.data?.name) meds.add(e.data.name);
  for (const e of await db.byType('doctor')) if (e.data?.doctor) docs.add(e.data.doctor);
  return { meds: [...meds].sort(), docs: [...docs].sort() };
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
    if (dur > 0 && (!end || end === start)) end = start + dur * 60000;
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
    } else if (f.kind === 'meds') {
      data.meds = [...form.querySelectorAll('.med-row')].map(r => ({
        name: r.querySelector('.mname').value.trim(), dose: r.querySelector('.mdose').value.trim(), freq: r.querySelector('.mfreq').value,
        days: r.querySelector('.mdays').value, when: r.querySelector('.mwhen').value,
      })).filter(x => x.name);
    } else { const v = fd.get(n); if (v) data[f.k] = v; }
  }
  data.photos = [...form.querySelectorAll('#photoGrid .thumb')].map(x => x.dataset.pid);
  if (!data.photos.length) delete data.photos;
  if (data.foods) await trackFoods(data.foods, dateKey(start), data.reaction, old);
  const entry = { ...(old || {}), id: id || uid(), type: t.key, start, end: startTimer ? null : end, date: dateKey(start), data,
    note: fd.get('note') || '', by: fd.get('by') || S.settings.me, createdAt: old?.createdAt || Date.now() };
  if (S.voiceEditing) entry.voice = true;
  await db.put(entry);
  closeSheet();
  toast(startTimer ? `⏱ ${t.label} timer started` : `Saved ${t.icon} ${t.label}`);
  route();
  if (S.voiceEditing && S.voiceItems?.length) { S.voiceEditing = false; openVoicePreview(); }
  S.voiceEditing = false;
}

async function trackFoods(foods, date, reaction, old) {
  const map = await db.getKV('foods', {});
  const prev = new Set((old?.data?.foods || []).map(f => f.name.toLowerCase()));
  for (const f of foods) {
    const k = Object.keys(map).find(n => n.toLowerCase() === f.name.toLowerCase()) || f.name;
    if (!map[k]) { map[k] = { first: date, count: 0, reactions: [] }; f.isNew = true; }
    else if (map[k].first === date && !prev.has(f.name.toLowerCase())) f.isNew = true;
    if (!prev.has(f.name.toLowerCase())) map[k].count++;
    map[k].last = date;
    if (f.qty) { map[k].lastQty = f.qty; map[k].lastUnit = f.unit; }
    if (reaction && !map[k].reactions.includes(reaction)) map[k].reactions.push(reaction);
  }
  await db.setKV('foods', map);
}

// ------------------------------------------------------------------ VOICE
function openVoice() {
  S.voiceItems = null;
  const langs = [['en-IN', 'English (India)'], ['ta-IN', 'தமிழ் Tamil'], ['hi-IN', 'हिन्दी Hindi'], ['en-US', 'English (US)']];
  openSheet(`<div class="sheet-hd"><h3>🎤 Tell me what happened</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    ${voiceSupported ? `<button class="big-mic" id="vMic" data-act="vMic" aria-label="Start speaking"><span>🎤</span><small id="vMicLbl">Tap and speak</small></button>` :
      `<p class="warn">Tap the box below, then press the 🎤 microphone on your phone's keyboard and speak.</p>`}
    <label>What I heard (you can correct it or type)<textarea id="vText" rows="4" placeholder="e.g. He ate 4 spoons of ragi porridge and half a banana at 8. He napped from 11 to 12:30. He peed twice.">${esc(S.voiceText)}</textarea></label>
    <div class="row wrap"><label class="small inline">Language <select id="vLang">${langs.map(([v, l]) => `<option value="${v}" ${v === S.settings.voiceLang ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <details class="small"><summary>What can I say?</summary><ul>
      <li>“He ate 2 idlis and half a bowl of curd rice for lunch”</li><li>“Napped from 1 to 2:30” · “Slept for 45 minutes”</li>
      <li>“Peed twice” · “Pooped at 10, a bit runny”</li><li>“Gave 2.5 ml paracetamol at 1 pm” · “Fever 100.4 and cough”</li>
      <li>“Bath at 10:30 for 20 minutes. Then we went to the park for an hour”</li><li>Anything else is saved as a note.</li></ul>
      <p class="muted">Times without am/pm are taken as the most recent one. Tamil and Hindi are written down as notes.</p></details>
    <div class="row actions"><button class="btn primary" data-act="vParse">Next ▸</button></div>`, { focus: !voiceSupported });
}

function openVoicePreview() {
  const items = S.voiceItems || [];
  openSheet(`<div class="sheet-hd"><h3>Check & save</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <p class="muted small">I understood ${items.length} thing${items.length === 1 ? '' : 's'}. Tap ✏️ to correct one, ✕ to drop it.</p>
    <ul class="entries preview">${items.map((it, i) => {
      const t = typeInfo(it.type);
      const fake = { ...it, data: it.data || {} };
      return `<li class="c-${CAT[it.type] || 'feel'}"><span class="e-icon">${t.icon}</span><span class="e-body"><span class="e-top"><b>${esc(t.label)}</b>
        <span class="e-time">${fmtTime(it.start)}${it.end && it.end !== it.start ? `–${fmtTime(it.end)}` : it.end === null && t.timed ? ' (running)' : ''}</span></span>
        <span class="muted">${esc(entrySummary(fake) || it.data?.text || '')}</span><br><i class="small">“${esc(it.note || '')}”</i></span>
        <span class="col"><button class="icon-btn" data-act="vEdit" data-i="${i}" aria-label="Edit">✏️</button><button class="icon-btn" data-act="vDrop" data-i="${i}" aria-label="Remove">✕</button></span></li>`;
    }).join('')}</ul>
    <div class="row actions"><button class="btn" data-act="voice">◂ Back</button><button class="btn primary" data-act="vSave" ${items.length ? '' : 'disabled'}>✓ Save all</button></div>`, { focus: false });
}

async function saveVoiceItems() {
  const items = S.voiceItems || [];
  const ongoing = (await db.byType('illness')).find(i => !i.data?.recovered);
  let n = 0;
  for (const it of items) {
    const t = typeInfo(it.type);
    const data = { ...(it.data || {}) };
    if (['sick', 'medicine'].includes(it.type) && ongoing) data.illness = ongoing.id;
    if (data.foods?.length) await trackFoods(data.foods, dateKey(it.start), '', null);
    let end = t.timed ? it.end : null;
    if (end === null && t.timed) { // still going → becomes a running timer (only one sleep at a time)
      for (const k of ['sleep', 'nap']) for (const r of (await db.byType(k)).filter(e => !e.end)) { r.end = it.start; await db.put(r); }
    }
    await db.put({ id: uid(), type: it.type, start: it.start, end, date: dateKey(it.start), data, note: it.note ? `🎤 ${it.note}` : '', by: S.settings.me, createdAt: Date.now(), voice: true });
    n++;
  }
  S.voiceItems = null; S.voiceText = '';
  closeSheet();
  toast(`🎤 Saved ${n} entr${n === 1 ? 'y' : 'ies'}`);
  route();
}

let dictating = null;
function dictate(btn) {
  if (dictating) { stopListening(); return; }
  const form = btn.closest('form') || document;
  const el = form.querySelector(`[name="${btn.dataset.target}"]`);
  if (!el) return;
  const base = el.value ? el.value.trim() + ' ' : '';
  btn.classList.add('listening');
  dictating = listen({
    lang: S.settings.voiceLang || 'en-IN',
    onText: (f, i) => { el.value = base + f + (i ? ' ' + i : ''); },
    onEnd: () => { btn.classList.remove('listening'); dictating = null; },
    onError: err => { btn.classList.remove('listening'); dictating = null; if (err === 'not-allowed') alert('Please allow microphone access for this app in your browser settings.'); },
  });
}

// ------------------------------------------------------------------ BEHAVIOUR FORM
async function openBehaviour(kind, entry = null) {
  const d = entry?.data || { kind };
  kind = d.kind;
  const list = behaviourForAge(kind === 'pos' ? POSITIVE_BEHAVIOURS : CHALLENGING_BEHAVIOURS, S.months);
  openSheet(`<form id="behform" data-id="${entry?.id || ''}" data-kind="${kind}">
    <div class="sheet-hd"><h3>${kind === 'pos' ? '💗 Kind / positive moment' : '🌋 Challenging moment'}</h3><button type="button" class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <fieldset><legend>What happened</legend><div class="chips">${list.map(b => `<label class="chip"><input type="radio" name="b" value="${b.k}" ${d.b === b.k ? 'checked' : ''} required><span>${b.icon} ${esc(b.label)}</span></label>`).join('')}</div></fieldset>
    ${textWithMic('details', 'Details', d.details || '', kind === 'pos' ? 'e.g. offered his biscuit to cousin' : 'What exactly did he do?', true)}
    ${kind === 'neg' ? `
      <label>Likely trigger<select name="trigger"><option value="">—</option>${TRIGGERS.map(x => `<option ${x === d.trigger ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <fieldset><legend>How strong (1 mild – 5 intense)</legend><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="intensity" value="${n}" ${Number(d.intensity) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>How we responded</legend><div class="chips">${RESPONSES.map(x => `<label class="chip"><input type="checkbox" name="responses" value="${esc(x)}" ${(d.responses || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>
      <label>Outcome<select name="outcome"><option value="">—</option>${OUTCOMES.map(x => `<option ${x === d.outcome ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    ` : `
      <fieldset><legend>How we responded</legend><div class="chips">${['Described what he did', 'Praised the effort', 'Hug / smile', 'Told the family', 'Thanked him'].map(x => `<label class="chip"><input type="checkbox" name="responses" value="${esc(x)}" ${(d.responses || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>`}
    <div class="row two"><label>Time<input type="datetime-local" name="start" value="${toLocalInput(entry?.start || Date.now())}"></label>
    <label>Logged by<select name="by">${S.settings.caregivers.map(c => `<option ${c === (entry?.by || S.settings.me) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
    <div class="row actions">${entry ? `<button type="button" class="btn danger" data-act="delete" data-id="${entry.id}">Delete</button>` : ''}<button class="btn primary">Save</button></div>
  </form>`, { focus: false });
  $('#behform').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, fd = new FormData(f);
    const start = fromLocalInput(fd.get('start')) || Date.now();
    const e = { ...(entry || {}), id: entry?.id || uid(), type: 'behaviour', start, end: null, date: dateKey(start), by: fd.get('by'),
      data: { kind, b: fd.get('b'), details: fd.get('details') || '', trigger: fd.get('trigger') || '', intensity: Number(fd.get('intensity')) || null,
        responses: fd.getAll('responses'), outcome: fd.get('outcome') || '' }, note: '', createdAt: entry?.createdAt || Date.now() };
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
      <input type="date" id="diaryDate" value="${d}" max="${dateKey()}" aria-label="Date"><button class="btn" data-act="day" data-delta="1" aria-label="Next day" ${d >= dateKey() ? 'disabled' : ''}>›</button></div>
    <h2>${esc(fmtDateLong(d))}</h2>
    <div class="card"><div class="summary-grid">
      <div><b>${fmtDur(sm.sleepMin)}</b><span>sleep</span></div><div><b>${sm.napCount}</b><span>naps</span></div>
      <div><b>${sm.meals}</b><span>meals</span></div><div><b>${sm.feeds}</b><span>milk</span></div>
      <div><b>${sm.pee}/${sm.poop}</b><span>pee/poop</span></div><div><b>${fmtDur(sm.outdoorMin)}</b><span>outdoor</span></div>
    </div>${sm.foods.length ? `<p class="small"><b>Foods:</b> ${esc(sm.foods.map(f => `${f.name}${f.qty ? ` (${f.qty} ${f.unit})` : ''}`).join(', '))}</p>` : ''}</div>
    ${entryList(list.filter(e => e.date === d))}
    <button class="btn wide" data-act="openPicker">＋ Add entry to this day</button>`;
}

// ------------------------------------------------------------------ HEALTH
const FREQ_HOURS = { 'Once a day': 24, 'Twice a day': 12, '3 times a day': 8, '4 times a day': 6, 'Every 6 hours': 6, 'Every 8 hours': 8, 'At night': 24 };

async function healthData() {
  const [ill, rx, meds, visits, temps] = await Promise.all(['illness', 'prescription', 'medicine', 'doctor', 'sick'].map(k => db.byType(k)));
  const desc = (a, b) => b.start - a.start;
  return { ill: ill.sort(desc), rx: rx.sort(desc), meds: meds.sort(desc), visits: visits.sort(desc), temps: temps.sort(desc) };
}

function activeRx(h, illnessId) {
  const today = dateKey();
  return h.rx.filter(r => (illnessId && r.data?.illness === illnessId) ||
    (r.data?.meds || []).some(m => Number(m.days) > 0 && addDays(r.date, Number(m.days)) >= today));
}

function medStatus(h, name) {
  const last = h.meds.find(m => (m.data?.name || '').toLowerCase() === name.toLowerCase());
  return last;
}

async function renderHealth() {
  const h = await healthData();
  const ongoing = h.ill.filter(i => !i.data?.recovered);
  const q = S.healthQ.toLowerCase();
  const match = e => !q || JSON.stringify(e.data || {}).toLowerCase().includes(q) || (e.note || '').toLowerCase().includes(q) || e.date.includes(q);
  const tabs = [['illness', `Past illnesses (${h.ill.length - ongoing.length})`], ['rx', `Prescriptions (${h.rx.length})`], ['meds', 'Medicines given'], ['visits', 'Visits & temps']];
  let list = '';
  if (S.healthTab === 'illness') list = h.ill.filter(i => i.data?.recovered).filter(match).map(i => illnessCard(i, h, false)).join('') || '<p class="empty">No past illnesses recorded. 🌈</p>';
  if (S.healthTab === 'rx') list = h.rx.filter(match).map(rxCard).join('') || '<p class="empty">No prescriptions yet. Tap 📄 to add one (you can attach a photo of it).</p>';
  if (S.healthTab === 'meds') list = entryList(h.meds.filter(match), 'No medicines logged.');
  if (S.healthTab === 'visits') list = entryList([...h.visits, ...h.temps].filter(match).sort((a, b) => b.start - a.start), 'No visits or temperature checks logged.');
  main().innerHTML = `
    <h2>🩺 Health</h2>
    <div class="health-actions">
      <button class="hb c-health" data-act="form" data-type="illness"><span>🤒</span>Illness</button>
      <button class="hb c-health" data-act="form" data-type="sick"><span>🌡️</span>Temperature</button>
      <button class="hb c-health" data-act="form" data-type="medicine"><span>💊</span>Gave medicine</button>
      <button class="hb c-health" data-act="form" data-type="prescription"><span>📄</span>Prescription</button>
      <button class="hb c-health" data-act="form" data-type="doctor"><span>🩺</span>Doctor visit</button>
      <button class="hb c-health" data-act="goGrow" data-tab="vaccines"><span>💉</span>Vaccines</button>
    </div>
    ${ongoing.length ? `<div class="label">Currently unwell</div>${ongoing.map(i => illnessCard(i, h, true)).join('')}` : `<p class="ok-note">🌈 No ongoing illness. If he falls sick, tap <b>🤒 Illness</b> to start tracking it.</p>`}
    <label class="search"><span aria-hidden="true">🔍</span><input id="healthSearch" type="search" placeholder="Search medicines, doctors, symptoms…" value="${esc(S.healthQ)}" aria-label="Search health records"></label>
    <div class="seg">${tabs.map(([k, l]) => `<button data-act="healthTab" data-tab="${k}" aria-pressed="${S.healthTab === k}">${l}</button>`).join('')}</div>
    <div id="healthList">${list}</div>`;
}

function illnessCard(i, h, active) {
  const d = i.data || {};
  const linked = e => e.data?.illness === i.id;
  const temps = h.temps.filter(linked).filter(e => e.data?.temp).sort((a, b) => a.start - b.start);
  const days = Math.max(1, Math.round(((d.recovered ? parseKey(d.recovered) : new Date()) - parseKey(i.date)) / 86400000) + (d.recovered ? 0 : 1));
  const rxs = activeRx(h, i.id).filter(r => active ? true : r.data?.illness === i.id);
  const medsToGive = active ? rxs.flatMap(r => (r.data?.meds || []).map(m => ({ ...m, rx: r }))) : [];
  const lastTemp = temps[temps.length - 1];
  const count = [...h.rx, ...h.meds, ...h.visits, ...h.temps].filter(linked).length;
  return `<section class="card illness ${active ? 'active' : ''}">
    <div class="row between"><div><b>🤒 ${esc(d.title || 'Illness')}</b><br><small class="muted">${esc(fmtDateShort(i.date))}${d.recovered ? ` – ${esc(fmtDateShort(d.recovered))} · ${days} day${days > 1 ? 's' : ''}` : ` · day ${days}`}${d.diagnosis ? ` · ${esc(d.diagnosis)}` : ''}</small></div>
      ${active ? `<button class="btn small" data-act="recovered" data-id="${i.id}">✓ Recovered</button>` : `<button class="btn small" data-act="illnessView" data-id="${i.id}">Details (${count})</button>`}</div>
    ${d.symptoms?.length ? `<div class="chips static">${d.symptoms.map(s => `<span class="chip"><span>${esc(s)}</span></span>`).join('')}</div>` : ''}
    ${active && lastTemp ? `<p>🌡️ Last temperature <b>${lastTemp.data.temp}°F</b> at ${fmtTime(lastTemp.start)} ${esc(fmtDateShort(lastTemp.date))}</p>` : ''}
    ${active && temps.length > 1 ? lineChart({ title: 'Temperature (°F)', points: temps.map(e => ({ label: `${fmtDateShort(e.date)} ${fmtTime(e.start)}`, x: e.start, value: e.data.temp })), unit: '°F' }) : ''}
    ${medsToGive.length ? `<div class="label">Medicines</div><ul class="meds-due">${medsToGive.map(m => {
      const last = medStatus(h, m.name);
      const gap = FREQ_HOURS[m.freq];
      const next = last && gap ? last.start + gap * 3600000 : null;
      const due = next && next <= Date.now();
      return `<li><span><b>${esc(m.name)}</b> ${esc(m.dose || '')} <small class="muted">${esc([m.freq, m.when].filter(Boolean).join(' · '))}</small><br>
        <small>${last ? `Last given ${fmtTime(last.start)} ${esc(fmtDateShort(last.date))}` : 'Not given yet'}${next ? ` · next ${due ? '<b class="due">due now</b>' : `around ${fmtTime(next)}`}` : ''}</small></span>
        <button class="btn small ${due || !last ? 'primary' : ''}" data-act="giveMed" data-name="${esc(m.name)}" data-dose="${esc(m.dose || '')}" data-ill="${i.id}">Gave now</button></li>`;
    }).join('')}</ul>` : ''}
    ${active ? `<div class="row wrap"><button class="btn small" data-act="formFor" data-type="sick" data-ill="${i.id}">🌡️ Add temp</button>
      <button class="btn small" data-act="formFor" data-type="prescription" data-ill="${i.id}">📄 Add prescription</button>
      <button class="btn small" data-act="formFor" data-type="doctor" data-ill="${i.id}">🩺 Doctor visit</button>
      <button class="btn small" data-act="illnessView" data-id="${i.id}">All details (${count})</button></div>` : ''}
    ${d.photos?.length ? `<span class="thumbs">${d.photos.map(id => thumbHtml(id)).join('')}</span>` : ''}
  </section>`;
}

function rxCard(r) {
  const d = r.data || {};
  return `<section class="card rx" data-act="edit" data-id="${r.id}">
    <div class="row between"><div><b>📄 ${esc(d.diagnosis || 'Prescription')}</b><br><small class="muted">${esc(fmtDateLong(r.date))}${d.doctor ? ` · Dr. ${esc(d.doctor.replace(/^dr\.?\s*/i, ''))}` : ''}${d.clinic ? ` · ${esc(d.clinic)}` : ''}</small></div><span class="muted">✏️</span></div>
    ${d.meds?.length ? `<table class="meds"><thead><tr><th>Medicine</th><th>Dose</th><th>How often</th><th>Days</th></tr></thead><tbody>${d.meds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose || '')}</td><td>${esc([m.freq, m.when].filter(Boolean).join(', '))}</td><td>${esc(m.days || '')}</td></tr>`).join('')}</tbody></table>` : ''}
    ${d.advice ? `<p class="small">📝 ${esc(d.advice)}</p>` : ''}${d.nextVisit ? `<p class="small">📅 Next visit: <b>${esc(fmtDateLong(d.nextVisit))}</b></p>` : ''}
    ${d.photos?.length ? `<span class="thumbs">${d.photos.map(id => thumbHtml(id)).join('')}</span>` : ''}
  </section>`;
}

async function openIllness(id) {
  const i = await db.get(id);
  if (!i) return;
  const h = await healthData();
  const linked = [...h.rx, ...h.meds, ...h.visits, ...h.temps].filter(e => e.data?.illness === id).sort((a, b) => a.start - b.start);
  const temps = linked.filter(e => e.type === 'sick' && e.data?.temp);
  openSheet(`<div class="sheet-hd"><h3>🤒 ${esc(i.data?.title || 'Illness')}</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <p class="muted">${esc(fmtDateLong(i.date))}${i.data?.recovered ? ` → recovered ${esc(fmtDateLong(i.data.recovered))}` : ' · ongoing'}</p>
    ${i.data?.diagnosis ? `<p><b>Diagnosis:</b> ${esc(i.data.diagnosis)}</p>` : ''}${i.data?.notes ? `<p>${esc(i.data.notes)}</p>` : ''}
    ${temps.length > 1 ? lineChart({ title: 'Temperature (°F)', points: temps.map(e => ({ label: `${fmtDateShort(e.date)} ${fmtTime(e.start)}`, x: e.start, value: e.data.temp })), unit: '°F' }) : ''}
    ${linked.filter(e => e.type === 'prescription').map(rxCard).join('')}
    <div class="label">Timeline</div>${entryList(linked, 'Nothing linked yet.')}
    <div class="row actions"><button class="btn" data-act="edit" data-id="${i.id}">✏️ Edit illness</button></div>`, { focus: false });
}

// ------------------------------------------------------------------ MORE
function renderMore() {
  const cards = [
    ['routine', '🕒', 'Routine', 'Timetable for his age'], ['grow:milestones', '🎯', 'Milestones', 'Tick what he can do'],
    ['grow:memories', '✨', 'New things', 'Firsts & memories'], ['grow:trends', '📈', 'Trends', 'Sleep, food, play charts'],
    ['grow:growth', '📏', 'Growth', 'Weight & height'], ['grow:foods', '🥕', 'Foods tried', 'Food diary & reactions'],
    ['grow:vaccines', '💉', 'Vaccines', 'Schedule & dates'], ['guide', '📖', 'Guide', 'Parenting library'],
    ['settings', '⚙️', 'Settings', 'Profile, backup, buttons'],
  ];
  main().innerHTML = `<h2>More</h2>
    <section class="more-grid">${cards.map(([v, i, t, s]) => {
      const [view, tab] = v.split(':');
      return `<button class="more-card" data-act="${tab ? 'goGrow' : 'view'}" data-view="${view}" ${tab ? `data-tab="${tab}"` : ''}><span>${i}</span><b>${t}</b><small>${s}</small></button>`;
    }).join('')}
    ${!isStandalone() ? `<button class="more-card" data-act="install"><span>📲</span><b>Install app</b><small>Add to home screen</small></button>` : ''}
    </section>`;
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
    ${backBar()}
    <h2>${S.stage.emoji} ${esc(S.stage.name)} timetable</h2>
    <p class="muted small">${custom ? '<b>Your customised version.</b>' : `Shifted to his usual wake-up time (${esc(S.settings.wake)}).`}</p>
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
    <p class="muted small">The app changes its timetable, targets, buttons, milestones and guidance automatically as he grows.</p>
    <ol class="roadmap">${STAGES.map(s => `<li class="${s === S.stage ? 'current' : s.to <= S.months ? 'past' : ''}">
      <b>${s.emoji} ${esc(s.name)}</b> <span class="muted">${ageRange(s)}</span>${s === S.stage ? ' <span class="badge now">now</span>' : ''}
      <div class="small muted">${esc(s.ei.goal)}</div></li>`).join('')}</ol>
    ${nx ? `<p class="small">Next: <b>${esc(nx.name)}</b> in about ${Math.max(0, Math.ceil(nx.from - S.months))} month(s) — new: ${esc(nx.newFeatures.join(', '))}.</p>` : ''}`;
}
const ageRange = s => `${s.from < 24 ? s.from + ' mo' : s.from / 12 + ' y'} – ${s.to < 24 ? s.to + ' mo' : s.to / 12 + ' y'}`;
const backBar = () => `<button class="back" data-act="view" data-view="more">‹ More</button>`;

async function openRoutineEditor() {
  const r = await getRoutine();
  const types = typesForAge(S.months);
  const row = x => `<div class="rt-row"><input type="time" value="${x.t}" class="rt-t" aria-label="Time"><input value="${esc(x.label)}" class="rt-l" aria-label="Activity">
    <select class="rt-type" aria-label="Log type">${types.map(t => `<option value="${t.key}" ${t.key === x.type ? 'selected' : ''}>${t.icon} ${esc(t.label)}</option>`).join('')}</select>
    <input type="number" class="rt-d" value="${x.dur || ''}" placeholder="min" aria-label="Minutes"><button type="button" class="icon-btn" data-act="rmRowEl" aria-label="Remove">✕</button></div>`;
  openSheet(`<div class="sheet-hd"><h3>Customise timetable</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <p class="muted small">Edit times, activities and durations. Saved for the ${esc(S.stage.name)} stage; when he moves to the next stage you get a fresh recommended timetable.</p>
    <div id="rtrows">${r.map(x => row({ ...x, t: minToHm(x.min) })).join('')}</div>
    <template id="rtTpl">${row({ t: '12:00', label: '', type: 'play', dur: 30 })}</template>
    <div class="row actions"><button class="btn" data-act="addRow">＋ Add row</button><button class="btn primary" data-act="saveRoutine">Save</button></div>`, { focus: false });
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
    <h2>💛 Heart · feelings & behaviour</h2>
    <div class="row"><button class="btn primary grow" data-act="behaviour" data-kind="pos">💗 Kind moment</button><button class="btn grow" data-act="behaviour" data-kind="neg">🌋 Tough moment</button></div>
    <section class="card ei"><div class="label">This stage's goal</div><h3>${esc(st.ei.goal)}</h3>
      <div class="chips static">${st.ei.skills.map(s => `<span class="chip"><span>${esc(s)}</span></span>`).join('')}</div>
      <details><summary class="small"><b>Activities to practise (${st.ei.activities.length})</b></summary><ul class="checklist">${st.ei.activities.map(a => `<li><button class="btn small" data-act="eidone" data-text="${esc(a)}">Did it</button> <span>${esc(a)}</span></li>`).join('')}</ul></details></section>
    <section class="card">${pairChart({ title: 'Last 14 days', data, names: ['Kind / positive', 'Challenging'] })}
      <p class="small">${ratio ? `Positive: <b>${pos.length}</b>, challenging: <b>${neg.length}</b> (≈${ratio} : 1). ` : `Positive moments noticed: <b>${pos.length}</b>. `}
      Notice and name many more good moments than you correct — what you pay attention to grows.</p></section>
    ${neg.length ? `<section class="card"><div class="label">Patterns</div>
      <p><b>Top triggers:</b> ${triggers.length ? triggers.slice(0, 4).map(([k, n]) => `${esc(k)} (${n})`).join(', ') : 'not recorded yet'}</p>
      <p><b>What calmed him fastest:</b> ${worked.length ? worked.slice(0, 4).map(([k, n]) => `${esc(k)} (${n})`).join(', ') : 'log responses + outcome to learn this'}</p>
      ${triggers[0] ? `<p class="small muted">${esc(triggerAdvice(triggers[0][0]))}</p>` : ''}</section>` : ''}
    <details class="card"><summary><b>Behaviour at this age</b></summary><ul>${st.behaviour.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <button class="btn small" data-act="view" data-view="guide">Read the guides</button></details>
    <h2>Recent</h2>${entryList(list.slice(0, 20), 'Nothing yet — start by noticing one kind moment today.')}`;
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
  const tabs = [['milestones', 'Milestones'], ['memories', 'New things'], ['trends', 'Trends'], ['growth', 'Growth'], ['foods', 'Foods'], ['vaccines', 'Vaccines']];
  const body = await ({ milestones: growMilestones, trends: growTrends, growth: growGrowth, foods: growFoods, vaccines: growVaccines, memories: growMemories })[S.growTab]();
  main().innerHTML = `${backBar()}<div class="seg">${tabs.map(([k, l]) => `<button data-act="growTab" data-tab="${k}" aria-pressed="${S.growTab === k}">${l}</button>`).join('')}</div>${body}`;
}

async function growMilestones() {
  const state = await db.getKV('milestones', {});
  const { passed, next } = milestoneFocus(S.months);
  const cur = next || passed;
  const cats = { social: '💞 Social / emotional', language: '🗣️ Language', cognitive: '🧠 Thinking', movement: '🏃 Movement' };
  const block = (c, open) => {
    const doneN = c.items.filter((_, i) => state[`${c.at}:${i}`]).length;
    const tag = c === next ? ' <span class="badge now">working towards</span>' : c === passed ? ' <span class="badge">should do now</span>' : '';
    return `<details class="card ms" ${open ? 'open' : ''}><summary><b>By ${ageLabel(c.at)}</b>
      <span class="muted"> · ${doneN}/${c.items.length}</span>${tag}</summary>
      ${Object.keys(cats).map(cat => {
        const items = c.items.map((it, i) => [it, i]).filter(([it]) => it[0] === cat);
        if (!items.length) return '';
        return `<div class="label">${cats[cat]}</div>${MILESTONE_TIPS[c.at]?.[cat] ? `<p class="tip-line">💡 ${esc(MILESTONE_TIPS[c.at][cat])}</p>` : ''}<ul class="checklist">${items.map(([it, i]) => {
          const k = `${c.at}:${i}`;
          return `<li><label class="check"><input type="checkbox" data-ms="${k}" ${state[k] ? 'checked' : ''}> <span>${esc(it[1])}</span></label>${state[k] ? `<span class="muted small"> ✓ ${esc(fmtDateShort(state[k]))}</span>` : ''}</li>`;
        }).join('')}</ul>`;
      }).join('')}</details>`;
  };
  const shown = [passed, next].filter(Boolean).filter((c, i, a) => a.indexOf(c) === i);
  return `<p class="muted small">${esc(RED_FLAGS)}</p>${shown.map(c => block(c, c === cur)).join('')}
    <details class="card"><summary>All other ages</summary>${MILESTONES.filter(c => !shown.includes(c)).map(c => block(c, false)).join('')}</details>`;
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
  const r = v => String(Math.round(v));
  return `<div class="seg small">${[7, 14, 30].map(k => `<button data-act="trendDays" data-days="${k}" aria-pressed="${n === k}">${k} days</button>`).join('')}</div>
    <p class="muted small">Average sleep ${avg(sleep).toFixed(1)} h · Days with no sleep logged count as zero.</p>
    ${barChart({ title: 'Total sleep (hours)', data: sleep, unit: ' h', target: tg.sleep })}
    ${tg.naps[1] ? barChart({ title: 'Naps', data: series(s => s.napCount), fmt: r }) : ''}
    ${barChart({ title: 'Meals', data: series(s => s.meals), fmt: r })}
    ${tg.feeds[1] ? barChart({ title: 'Milk feeds', data: series(s => s.feeds), fmt: r }) : ''}
    ${barChart({ title: 'Pee count', data: series(s => s.pee), fmt: r })}
    ${barChart({ title: 'Outdoor / active (min)', data: series(s => s.outdoorMin), unit: ' min', fmt: r })}
    ${barChart({ title: 'Learning & reading (min)', data: series(s => s.learnMin), unit: ' min', fmt: r })}
    ${barChart({ title: 'Screen time (min)', data: series(s => s.screenMin), unit: ' min', fmt: r })}`;
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
  return `<button class="btn primary wide" data-act="form" data-type="memory" data-first="1">✨ Add a new thing he did</button>
    ${list.length ? `<ul class="memories">${list.map(e => `<li data-act="edit" data-id="${e.id}"><div class="muted small">${esc(fmtDateLong(e.date))} · age ${esc(ageText(S.settings.dob, e.start))}${e.data?.area ? ` · ${esc(e.data.area)}` : ''}</div>
      ${e.data?.first ? '<span class="badge now">⭐ First</span> ' : ''}${esc(e.data?.text || e.note)}
      ${e.data?.photos?.length ? `<span class="thumbs">${e.data.photos.map(id => thumbHtml(id)).join('')}</span>` : ''}</li>`).join('')}</ul>` : '<p class="empty">First smile, first word, first step… add them here with a photo.</p>'}`;
}

// ------------------------------------------------------------------ GUIDE
async function renderGuide() {
  const m = S.months, st = S.stage;
  const arts = GUIDE.filter(g => S.guideAll || (m >= g.min && m < g.max));
  main().innerHTML = `
    ${backBar()}
    <h2>${st.emoji} Guide for ${esc(st.name)} (${ageRange(st)})</h2>
    <details class="card" open><summary><b>This age at a glance</b></summary><p>${esc(st.tagline)}</p>
      <div class="label">Development focus</div><ul>${st.focus.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="label">Food & feeding</div><ul>${st.feeding.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="label">Learning (academic foundations)</div><ul>${st.academics.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="label">Emotional intelligence</div><p><b>${esc(st.ei.goal)}</b></p><ul>${st.ei.skills.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    </details>
    <div class="row between"><h2>Parenting library</h2><label class="check small"><input type="checkbox" id="guideAll" ${S.guideAll ? 'checked' : ''}> All ages</label></div>
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
  const cfg = await getConfig(), st = await getState(), pend = await pendingCount();
  const keys = homeKeys();
  main().innerHTML = `
    ${backBar()}
    <h2>Settings</h2>
    ${!isStandalone() ? `<section class="card install-card"><div><b>📲 Install ${APP_NAME} as an app</b><br><small>Gets its own icon on the home screen and opens full screen like any other app.</small></div><button class="btn primary small" data-act="install">Install</button></section>` : ''}
    <form id="settingsForm" class="card">
      <div class="label">👶 Profile</div>
      <label>Child's name<input name="name" value="${esc(s.name)}" required></label>
      <div class="row two"><label>Date of birth<input type="date" name="dob" value="${esc(s.dob)}" max="${dateKey()}" required></label>
      <label>Usual wake-up<input type="time" name="wake" value="${esc(s.wake)}"></label></div>
      <label>Born early by (weeks) <span class="muted small">— corrected age is used until 2 years if 3+ weeks</span><input type="number" name="premature" min="0" max="16" value="${esc(s.premature || 0)}"></label>
      <label>Caregivers (comma separated)<input name="caregivers" value="${esc(s.caregivers.join(', '))}"></label>
      <div class="row two"><label>I am<select name="me">${s.caregivers.map(c => `<option ${c === s.me ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Theme<select name="theme">${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${v === s.theme ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label>Voice language<select name="voiceLang">${[['en-IN', 'English (India)'], ['ta-IN', 'Tamil'], ['hi-IN', 'Hindi'], ['en-US', 'English (US)']].map(([v, l]) => `<option value="${v}" ${v === s.voiceLang ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <fieldset><legend>🏠 Home screen buttons (pick up to 8)</legend><div class="chips">${quickForAge().map(q => `<label class="chip"><input type="checkbox" name="home" value="${q.k}" ${keys.includes(q.k) ? 'checked' : ''}><span>${q.icon} ${esc(q.label)}</span></label>`).join('')}</div>
        <p class="muted small">The rest stay under "More buttons".</p></fieldset>
      <button class="btn primary">Save settings</button>
    </form>
    <form id="syncForm" class="card">
      <div class="label">☁️ Online backup — your own Google Sheet</div>
      <p class="small">Every entry (and photo) is copied to your Google Sheet / Drive automatically whenever the phone is online. When offline, changes wait safely and upload later. Deleted entries are only <i>marked</i> deleted in the sheet.</p>
      <p class="small"><b>Status:</b> ${cfg.enabled ? (pend ? `${pend} change(s) waiting` : 'all backed up') : 'off'}${st.lastSync ? ` · last backup ${esc(new Date(st.lastSync).toLocaleString())}` : ''}${st.lastError ? `<br><span class="err-text">⚠ ${esc(st.lastError)}</span>` : ''}
        ${cfg.enabled && st.photosUnsupported ? `<br><span class="err-text">📷 Photos are not being backed up yet — update the Apps Script to the new version (see steps below) and press Save & test.</span>` : ''}</p>
      <label>Web app URL<input name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(cfg.url)}"></label>
      <label>Secret phrase (same as in the script)<input name="token" type="password" autocomplete="off" value="${esc(cfg.token)}"></label>
      <label class="check"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Back up automatically</label>
      <div class="row wrap"><button class="btn primary">Save & test</button>
        <button type="button" class="btn" data-act="syncAll" ${cfg.enabled ? '' : 'disabled'}>⬆️ Back up everything now</button>
        <button type="button" class="btn" data-act="syncRestore" ${cfg.enabled ? '' : 'disabled'}>⬇️ Restore from Google Sheet</button></div>
      <details><summary class="small">How to set it up / update it</summary><ol class="small">
        <li>Open your backup Google Sheet (or create one).</li>
        <li><b>Extensions → Apps Script</b>. Select all old code, delete it, and paste the code from <code>google-sheets-backup/Code.gs</code>.</li>
        <li>Change <code>SECRET</code> to your own phrase and click Save.</li>
        <li>First time: <b>Deploy → New deployment → Web app</b> (Execute as: Me, Who has access: Anyone). Updating: <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b>. Allow the permissions (Drive is needed for photos).</li>
        <li>Paste the <code>/exec</code> URL and secret above, tick "Back up automatically" and press <b>Save & test</b>.</li></ol></details>
    </form>
    <section class="card"><div class="label">💾 Your data (${count} entries on this device)</div>
      <div class="row wrap"><button class="btn" data-act="export">⬇️ Backup file</button><button class="btn" data-act="csv">⬇️ Export CSV</button>
      <label class="btn">⬆️ Restore file<input type="file" id="importFile" accept="application/json" hidden></label></div>
      <div class="row wrap"><button class="btn" data-act="demo">Load sample data</button><button class="btn danger" data-act="wipe">Erase everything</button></div></section>
    <section class="card small muted"><b>About.</b> ${APP_NAME} is a personal, offline-first app. Data only leaves the phone if you turn on the online backup, and then it goes only to your own Google Sheet and Drive.
      Voice typing uses your phone browser's built-in speech service. Guidance is based on WHO, AAP/AASM, CDC, IAP, the Gottman Institute and Harvard's Center on the Developing Child; always follow your paediatrician.</section>`;
  $('#syncForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const url = String(fd.get('url')).trim().replace(/\/macros\/u\/\d+\/s\//, '/macros/s/').replace(/[?#].*$/, '');
    const next = { url, token: String(fd.get('token')).trim(), enabled: fd.get('enabled') === 'on' };
    if (next.enabled) {
      if (/docs\.google\.com\/spreadsheets/.test(url)) return alert('This is the Google Sheet link. Paste the Apps Script Web app URL (ends in /exec) instead.');
      if (/\/edit$|\/home\/projects\//.test(url)) return alert('This is the script EDITOR link. In Apps Script use Deploy → Manage deployments and copy the "Web app" URL ending in /exec.');
      if (/\/dev$/.test(url)) return alert('This is the test (/dev) link. Use the deployed Web app URL that ends in /exec.');
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) return alert('Please paste the Apps Script Web app URL. It looks like https://script.google.com/macros/s/…/exec');
    }
    await setConfig(next);
    if (!next.enabled) { toast('Online backup turned off'); return route(); }
    toast('Testing connection…');
    try {
      const r = await testConnection(next);
      const st2 = await getState();
      if (r.count > 0 && !st2.lastSync && confirm(`Your sheet "${r.sheet}" already has ${r.count} entries. Restore them to this phone first? (Recommended on a new phone)`)) {
        const n = await restoreFromSheet();
        S.settings = { ...DEFAULT_SETTINGS, ...(await db.getKV('settings')) }; applyTheme(); await refreshAge();
        toast(`✓ Restored ${n} entries`);
      }
      toast(`✓ Connected to "${r.sheet}". Backing up…`);
      await syncNow({ silent: false });
      toast(r.photos ? '✓ Backup complete (with photos)' : '✓ Backup complete. Update the script to also back up photos.');
    } catch (err) { alert('Could not connect: ' + err.message); }
    route();
  });
  $('#settingsForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const caregivers = String(fd.get('caregivers')).split(',').map(x => x.trim()).filter(Boolean);
    const home = fd.getAll('home');
    if (home.length > 8) return alert(`Please pick at most 8 home buttons (you picked ${home.length}).`);
    S.settings = { ...S.settings, name: fd.get('name').trim(), dob: fd.get('dob'), premature: Number(fd.get('premature')) || 0, wake: fd.get('wake') || '06:30',
      caregivers: caregivers.length ? caregivers : ['Parent'], me: caregivers.includes(fd.get('me')) ? fd.get('me') : caregivers[0], theme: fd.get('theme'),
      voiceLang: fd.get('voiceLang') || 'en-IN', home: home.length ? home : null };
    await db.setKV('settings', S.settings);
    applyTheme(); await refreshAge();
    toast('Settings saved'); S.view = 'home'; route();
  });
}

function renderOnboarding() {
  $('#hdr').innerHTML = '';
  document.body.classList.add('onboarding');
  main().innerHTML = `<section class="onboard">
    <div class="ob-hero"><img src="icons/icon.svg" alt="" width="88" height="88"><h1>${APP_NAME}</h1>
    <p>Your child's day, health and growth in one place — with a timetable, milestones and guidance that grow with them from baby to teen.</p></div>
    <form id="obForm" class="card">
      <label>Child's name<input name="name" required placeholder="e.g. Aadhi"></label>
      <label>Date of birth<input type="date" name="dob" required max="${dateKey()}"></label>
      <div class="row two"><label>Usual wake-up<input type="time" name="wake" value="06:30"></label>
      <label>Born early (weeks)<input type="number" name="premature" value="0" min="0" max="16"></label></div>
      <label>I am<input name="me" value="Amma"></label>
      <button class="btn primary wide">Let's start 🎉</button>
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

// ------------------------------------------------------------------ install
async function doInstall() {
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') installEvt = null;
    renderHeader();
    return;
  }
  openSheet(`<div class="sheet-hd"><h3>📲 Install ${APP_NAME}</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    ${isIOS ? `<ol class="install-steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button <span class="kbd">⬆︎</span> at the bottom.</li><li>Scroll and tap <b>Add to Home Screen</b> ➕.</li><li>Tap <b>Add</b>. The ${APP_NAME} icon appears on your home screen.</li></ol>`
      : `<ol class="install-steps"><li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu at the top right.</li><li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li><li>Tap <b>Install</b>. ${APP_NAME} now opens from its own icon, like any other app.</li></ol>`}
    <p class="muted small">Once installed it works offline, opens full screen and keeps all your data on the phone (plus your Google Sheet backup).</p>`, { focus: false });
}

// ------------------------------------------------------------------ backup / demo
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function exportJSON() {
  const data = { app: 'happy-parenthood', version: 2, exportedAt: new Date().toISOString(), kv: await db.allKV(), entries: await db.all(), photos: await db.allPhotos() };
  download(`happy-parenthood-backup-${dateKey()}.json`, JSON.stringify(data), 'application/json');
}
async function exportCSV() {
  const rows = (await db.all()).sort((a, b) => a.start - b.start);
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['date', 'start', 'end', 'duration_min', 'type', 'details', 'note', 'by'].join(',')]
    .concat(rows.map(e => [e.date, fmtTime(e.start), e.end ? fmtTime(e.end) : '', e.end ? Math.round(entryMinutes(e)) : '', typeInfo(e.type).label, entrySummary(e), e.note, e.by].map(q).join(',')));
  download(`happy-parenthood-${dateKey()}.csv`, lines.join('\n'), 'text/csv');
}
async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!['happy-parenthood', 'parenthood-arena'].includes(data.app) || !Array.isArray(data.entries)) throw new Error('Not a Happy Parenthood backup file');
    if (!confirm(`Restore ${data.entries.length} entries from ${data.exportedAt?.slice(0, 10)}? Entries with the same id are overwritten; others are kept.`)) return;
    await db.bulkPut(data.entries);
    for (const [k, v] of Object.entries(data.kv || {})) await db.setKV(k, v);
    for (const p of data.photos || []) await db.putPhoto(p);
    S.settings = { ...DEFAULT_SETTINGS, ...(await db.getKV('settings')) }; applyTheme(); await refreshAge();
    toast('Backup restored'); route();
  } catch (err) { alert('Could not import: ' + err.message); }
}
async function loadDemo() {
  if (!confirm('Add 7 days of sample entries so you can see how the app looks? You can delete them later with "Erase everything".')) return;
  const out = [];
  const at = (d, hm) => { const [h, m] = hm.split(':').map(Number); const x = parseKey(d); x.setHours(h, m, 0, 0); return x.getTime(); };
  const add = (type, d, s, e, data = {}) => { const x = { id: uid(), type, start: at(d, s), end: e ? at(e[0], e[1]) : null, date: d, data, note: '', by: S.settings.me, createdAt: Date.now(), demo: true }; out.push(x); return x; };
  const foods = [['Ragi porridge', 4, 'tbsp'], ['Idli (mashed)', 1, 'piece'], ['Banana', 0.5, 'piece'], ['Dal rice with ghee', 6, 'tbsp'], ['Curd rice', 5, 'tbsp'], ['Carrot (steamed)', 3, 'tbsp'], ['Egg yolk', 1, 'piece'], ['Khichdi', 6, 'tbsp']];
  for (let i = 6; i >= 1; i--) {
    const d = addDays(dateKey(), -i), prev = addDays(d, -1);
    add('sleep', prev, '19:45', [d, `06:${10 + i * 3}`], { wakeups: i % 3, quality: 'Good', settle: 'Fed to sleep' });
    add('wake', d, `06:${10 + i * 3}`, null, { mood: 'Happy' });
    add('study', d, '07:00', [d, '07:15'], { activity: 'Reading aloud', details: 'Animal board book', focus: 4 });
    add('meal', d, '08:00', [d, '08:20'], { meal: 'Breakfast', foods: [{ name: foods[i % 8][0], qty: foods[i % 8][1], unit: foods[i % 8][2] }], appetite: 'Most' });
    add('nap', d, '09:00', [d, i % 2 ? '10:10' : '10:30'], { quality: 'Good' });
    add('bath', d, '10:40', [d, '11:05'], { kind: 'Oil massage + bath' });
    add('meal', d, '12:15', [d, '12:40'], { meal: 'Lunch', foods: [{ name: foods[(i + 3) % 8][0], qty: foods[(i + 3) % 8][1], unit: foods[(i + 3) % 8][2] }], appetite: i % 3 ? 'All of it' : 'Half' });
    add('nap', d, '13:15', [d, '14:45'], { quality: 'Great' });
    add('play', d, '15:30', [d, '16:15'], { where: 'Indoor', kind: 'Stacking / blocks', with: 'Amma' });
    add('walk', d, '16:30', [d, i % 2 ? '17:00' : '17:20'], { mode: 'Pram / stroller', place: 'Park' });
    add('meal', d, '18:30', [d, '18:50'], { meal: 'Dinner', foods: [{ name: foods[(i + 5) % 8][0], qty: 5, unit: 'tbsp' }], appetite: 'Most' });
    add('reading', d, '19:15', [d, '19:30'], { title: 'Goodnight Moon', by: 'Appa' });
    for (let p = 0; p < 6 + (i % 3); p++) add('pee', d, `${String(7 + p * 2).padStart(2, '0')}:20`, null, { how: 'Diaper / nappy' });
    add('poop', d, '09:45', null, { how: 'Diaper / nappy', consistency: 'Normal / soft' });
    for (let f = 0; f < 4; f++) add('breastfeed', d, ['06:30', '11:15', '15:00', '19:30'][f], [d, ['06:45', '11:30', '15:15', '19:45'][f]], { side: 'Both' });
    if (i % 2) add('behaviour', d, '17:10', null, { kind: 'pos', b: 'social', details: 'Laughed and clapped at peek-a-boo', responses: ['Hug / smile'] });
    if (i % 3 === 0) add('behaviour', d, '18:00', null, { kind: 'neg', b: 'crying', trigger: 'Tired / overdue nap', intensity: 3, responses: ['Stayed calm & close', 'Named the feeling'], outcome: 'Calmed in 2–10 min' });
  }
  const d3 = addDays(dateKey(), -3), d2 = addDays(dateKey(), -2), d1 = addDays(dateKey(), -1);
  add('memory', d2, '17:30', null, { text: 'Clapped his hands for the first time while we sang a rhyme!', area: 'Movement', first: true });
  const ill = add('illness', d3, '09:00', null, { title: 'Cold & mild fever', symptoms: ['Fever', 'Cold / runny nose'] });
  add('sick', d3, '09:00', null, { temp: 100.6, symptoms: ['Fever'], illness: ill.id });
  add('sick', d3, '18:00', null, { temp: 101.2, symptoms: ['Fever'], illness: ill.id });
  add('prescription', d3, '11:00', null, { doctor: 'Dr. Priya', clinic: 'Rainbow Children\'s Clinic', diagnosis: 'Viral cold', illness: ill.id,
    meds: [{ name: 'Paracetamol drops', dose: '1 ml', freq: 'Every 6 hours', days: '3', when: 'Any time' }, { name: 'Saline nasal drops', dose: '2 drops each nostril', freq: '4 times a day', days: '5' }],
    advice: 'Plenty of breast milk, keep him warm, review if fever above 102°F for 2 days.', nextVisit: addDays(dateKey(), 2) });
  add('medicine', d3, '11:30', null, { name: 'Paracetamol drops', dose: '1 ml', illness: ill.id });
  add('sick', d2, '08:00', null, { temp: 99.8, symptoms: ['Cold / runny nose'], illness: ill.id });
  add('medicine', d1, '08:00', null, { name: 'Saline nasal drops', dose: '2 drops each nostril', illness: ill.id });
  add('sick', d1, '09:00', null, { temp: 98.9, symptoms: ['Cold / runny nose'], illness: ill.id });
  await db.bulkPut(out);
  for (const f of foods) await trackFoods([{ name: f[0], qty: f[1], unit: f[2] }], addDays(dateKey(), -6), '', null);
  toast('Sample data added'); route();
}

// Toast with optional action buttons, e.g. [['Undo', fn], ['Add details', fn]]
function toast(msg, actions = []) {
  const t = $('#toast');
  toast._actions = actions.map(x => x[1]);
  t.innerHTML = `<span>${esc(msg)}</span>${actions.map((x, i) => `<button class="toast-btn" data-act="toastAct" data-i="${i}">${esc(x[0])}</button>`).join('')}`;
  t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, actions.length ? 6000 : 2500);
}

// One-tap timer: first tap starts, second tap stops and logs the duration.
const SLEEPY = ['sleep', 'nap'];
async function toggleTimer(type) {
  const t = typeInfo(type);
  const running = (await db.byType(type)).find(e => !e.end);
  if (running) {
    running.end = Date.now();
    await db.put(running);
    const mins = entryMinutes(running);
    route();
    if (type === 'meal') { toast(`🥣 Eating time: ${fmtDur(mins)} — add what he ate`); return openForm('meal', running, { focusFoods: true, noFocus: true }); }
    return toast(`${t.icon} ${t.label}: ${fmtDur(mins)} (${fmtTime(running.start)}–${fmtTime(running.end)})`, [
      ['Undo', async () => { running.end = null; await db.put(running); route(); }],
      ['Add details', () => openForm(type, running)]]);
  }
  let stopped = null;
  if (SLEEPY.includes(type)) {
    for (const k of SLEEPY) {
      const r = (await db.byType(k)).find(e => !e.end);
      if (r) { r.end = Date.now(); await db.put(r); stopped = r; }
    }
  }
  const now = Date.now();
  const e = { id: uid(), type, start: now, end: null, date: dateKey(now), data: {}, note: '', by: S.settings.me, createdAt: now };
  await db.put(e);
  route();
  toast(`${t.icon} ${t.label} started at ${fmtTime(now)}${stopped ? ` · ${typeInfo(stopped.type).label} ended` : ''}`, [
    ['Undo', async () => { await db.del(e.id); if (stopped) { stopped.end = null; await db.put(stopped); } route(); }]]);
}

// ------------------------------------------------------------------ events
async function onClick(ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) { if (ev.target.id === 'sheet') closeSheet(); return; }
  const a = el.dataset.act;
  switch (a) {
    case 'view': S.view = el.dataset.view; closeSheet(); route(); break;
    case 'goGrow': S.view = 'grow'; S.growTab = el.dataset.tab; closeSheet(); route(); break;
    case 'close': closeSheet(); break;
    case 'openPicker': openPicker(); break;
    case 'form': openForm(el.dataset.type, null, { focusFoods: el.dataset.type === 'meal', prefill: el.dataset.first ? { data: { first: true } } : undefined, noFocus: true }); break;
    case 'formFor': openForm(el.dataset.type, null, { prefill: { data: { illness: el.dataset.ill } }, noFocus: true }); break;
    case 'behaviour': openBehaviour(el.dataset.kind); break;
    case 'edit': {
      ev.stopPropagation();
      const e = await db.get(el.dataset.id);
      if (!e) return;
      if (e.type === 'behaviour') openBehaviour(e.data.kind, e);
      else if (e.type === 'ei') { if (confirm('Remove this activity log?')) { await db.del(e.id); route(); } }
      else openForm(e.type, e, { noFocus: true });
      break;
    }
    case 'delete': if (confirm('Delete this entry?')) { await db.del(el.dataset.id); closeSheet(); toast('Deleted'); route(); } break;
    case 'startTimer': saveForm(true); break;
    case 'quick': {
      const type = el.dataset.type;
      const prev = (await db.byType(type)).sort((x, y) => y.start - x.start)[0];
      const data = type === 'pee' || type === 'poop' ? { how: prev?.data?.how || (S.months < 30 ? 'Diaper / nappy' : 'Toilet') } : {};
      const saved = { id: uid(), type, start: Date.now(), end: null, date: dateKey(), data, note: '', by: S.settings.me, createdAt: Date.now() };
      await db.put(saved);
      let stopped = null;
      if (type === 'wake') {
        for (const k of SLEEPY) { const run = (await db.byType(k)).find(e => !e.end); if (run) { run.end = Date.now(); await db.put(run); stopped = run; } }
      }
      const msg = { pee: '💛 Pee logged (+1)', poop: '💩 Poop logged' }[type] || (stopped ? `🌅 Good morning! ${typeInfo(stopped.type).label}: ${fmtDur(entryMinutes(stopped))}` : '🌅 Good morning!');
      toast(msg, [['Undo', async () => { await db.del(saved.id); if (stopped) { stopped.end = null; await db.put(stopped); } route(); }],
        ['Details', () => openForm(type, saved)]]);
      route();
      break;
    }
    case 'toggle': await toggleTimer(el.dataset.type); break;
    case 'toastAct': { const f = toast._actions?.[Number(el.dataset.i)]; $('#toast').hidden = true; if (f) await f(); break; }
    case 'eidone': {
      await db.put({ id: uid(), type: 'ei', start: Date.now(), end: null, date: dateKey(), data: { text: el.dataset.text }, note: '', by: S.settings.me, createdAt: Date.now() });
      toast('💛 Lovely! Logged.'); route(); break;
    }
    case 'ackStage': await db.setKV('lastStage', S.stage.id); route(); break;
    case 'moreBtns': S.moreOpen = !S.moreOpen; route(); break;
    case 'homeTab': S.homeTab = el.dataset.tab; route(); break;
    case 'healthTab': S.healthTab = el.dataset.tab; route(); break;
    case 'install': doInstall(); break;
    case 'installLater': await db.setKV('installDismissed', Date.now()); route(); break;
    case 'addFood': $('#foods').insertAdjacentHTML('beforeend', foodRow()); $('#foods .food-row:last-child input').focus(); break;
    case 'pickFood': {
      const rows = [...document.querySelectorAll('#foods .food-row')];
      let row = rows.find(r => !r.querySelector('.fname').value.trim());
      if (!row) { $('#foods').insertAdjacentHTML('beforeend', foodRow()); row = $('#foods .food-row:last-child'); }
      row.querySelector('.fname').value = el.dataset.name;
      row.querySelector('.fqty').value = el.dataset.qty || '';
      if (el.dataset.unit) row.querySelector('.funit').value = el.dataset.unit;
      el.classList.add('picked');
      break;
    }
    case 'addMed': $('#meds').insertAdjacentHTML('beforeend', medRow()); $('#meds .med-row:last-child input').focus(); break;
    case 'rmRowEl': el.closest('.food-row, .med-row, .rt-row')?.remove(); break;
    case 'rmPhoto': el.closest('.thumb')?.remove(); break;
    case 'viewPhoto': {
      if (el.closest('#logform')) break;
      ev.stopPropagation();
      openSheet(`<div class="sheet-hd"><h3>📷 Photo</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div><img class="photo-full" data-photo="${esc(el.dataset.id)}" alt="Photo">`, { focus: false });
      break;
    }
    case 'dictate': dictate(el); break;
    case 'voice': stopListening(); openVoice(); break;
    case 'vMic': {
      const box = $('#vText'), lbl = $('#vMicLbl');
      if (el.classList.contains('listening')) { stopListening(); break; }
      const base = box.value ? box.value.trim() + ' ' : '';
      el.classList.add('listening'); lbl.textContent = 'Listening… tap to stop';
      listen({ lang: $('#vLang').value, onText: (f, i) => { box.value = base + f + (i ? ' ' + i : ''); },
        onEnd: () => { el.classList.remove('listening'); lbl.textContent = 'Tap and speak'; },
        onError: err => { el.classList.remove('listening'); lbl.textContent = 'Tap and speak'; if (err === 'not-allowed') alert('Please allow microphone access for this app.'); else if (err !== 'no-speech' && err !== 'aborted') toast('Voice error: ' + err); } });
      break;
    }
    case 'vParse': {
      stopListening();
      S.voiceText = $('#vText').value.trim();
      if (!S.voiceText) { toast('Say or type something first'); break; }
      S.voiceItems = parseVoice(S.voiceText);
      openVoicePreview();
      break;
    }
    case 'vDrop': S.voiceItems.splice(Number(el.dataset.i), 1); openVoicePreview(); break;
    case 'vEdit': {
      const [it] = S.voiceItems.splice(Number(el.dataset.i), 1);
      S.voiceEditing = true;
      if (it.type === 'note' || !typeByKey(it.type)) openForm('note', null, { prefill: { start: it.start, data: { text: it.data?.text || it.note } } });
      else openForm(it.type, null, { prefill: { start: it.start, end: it.end, data: it.data, note: it.note ? `🎤 ${it.note}` : '' }, noFocus: true });
      break;
    }
    case 'vSave': await saveVoiceItems(); break;
    case 'giveMed': {
      const e = { id: uid(), type: 'medicine', start: Date.now(), end: null, date: dateKey(), data: { name: el.dataset.name, dose: el.dataset.dose, illness: el.dataset.ill }, note: '', by: S.settings.me, createdAt: Date.now() };
      await db.put(e);
      toast(`💊 ${el.dataset.name} given at ${fmtTime(e.start)}`, [['Undo', async () => { await db.del(e.id); route(); }]]);
      route(); break;
    }
    case 'recovered': {
      const i = await db.get(el.dataset.id);
      const when = prompt('Recovered on (YYYY-MM-DD)', dateKey());
      if (!when) break;
      i.data = { ...i.data, recovered: when };
      await db.put(i); toast('🌈 So glad he is better!'); route(); break;
    }
    case 'illnessView': openIllness(el.dataset.id); break;
    case 'day': S.diaryDate = addDays(S.diaryDate, Number(el.dataset.delta)); if (S.diaryDate > dateKey()) S.diaryDate = dateKey(); route(); break;
    case 'growTab': S.growTab = el.dataset.tab; route(); break;
    case 'trendDays': S.trendDays = Number(el.dataset.days); route(); break;
    case 'editRoutine': openRoutineEditor(); break;
    case 'addRow': $('#rtrows').insertAdjacentHTML('beforeend', $('#rtTpl').innerHTML); break;
    case 'saveRoutine': {
      const rows = [...document.querySelectorAll('.rt-row')].map(r => ({ t: r.querySelector('.rt-t').value, label: r.querySelector('.rt-l').value.trim(), type: r.querySelector('.rt-type').value, dur: Number(r.querySelector('.rt-d').value) || 0 })).filter(r => r.t && r.label);
      await db.setKV(`routine:${S.stage.id}`, rows); closeSheet(); toast('Timetable saved'); route(); break;
    }
    case 'resetRoutine': if (confirm('Go back to the recommended timetable?')) { await db.setKV(`routine:${S.stage.id}`, null); route(); } break;
    case 'export': exportJSON(); break;
    case 'syncAll': {
      const n = await db.markAllDirty();
      toast(`Uploading ${n} entries…`);
      try { await syncNow({ silent: false }); toast('✓ Everything is backed up'); } catch (err) { alert('Backup failed: ' + err.message + '\nIt will retry automatically.'); }
      route(); break;
    }
    case 'syncRestore': {
      if (!confirm('Download all entries from your Google Sheet into this phone? Entries already here are kept; same entries are updated.')) break;
      try { const n = await restoreFromSheet(); S.settings = { ...DEFAULT_SETTINGS, ...(await db.getKV('settings')) }; applyTheme(); await refreshAge(); toast(`✓ Restored ${n} entries`); }
      catch (err) { alert('Restore failed: ' + err.message); }
      route(); break;
    }
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
  if (t.id === 'vLang') { S.settings.voiceLang = t.value; await db.setKV('settings', S.settings); }
  if (t.id === 'photoInput' && t.files.length) {
    const grid = $('#photoGrid');
    for (const f of t.files) {
      try { const id = await savePhotoFile(f); grid.querySelector('.add-photo').insertAdjacentHTML('beforebegin', thumbHtml(id, true)); }
      catch (err) { alert('Could not read that photo.'); }
    }
    t.value = '';
  }
  if (t.dataset.ms) {
    const st = await db.getKV('milestones', {});
    if (t.checked) st[t.dataset.ms] = dateKey(); else delete st[t.dataset.ms];
    await db.setKV('milestones', st);
    if (t.checked) toast('🎉 Milestone ticked!');
    route();
  }
  if (t.dataset.vax) {
    const st = await db.getKV('vaccines', {});
    if (t.checked) st[t.dataset.vax] = prompt('Date given (YYYY-MM-DD)', dateKey()) || dateKey(); else delete st[t.dataset.vax];
    await db.setKV('vaccines', st); route();
  }
}

let searchTimer;
function onInput(ev) {
  if (ev.target.id === 'healthSearch') {
    S.healthQ = ev.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      await renderHealth();
      const box = $('#healthSearch'); box.focus(); box.setSelectionRange(box.value.length, box.value.length);
    }, 250);
  }
}

boot();
