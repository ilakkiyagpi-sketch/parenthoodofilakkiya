import { db, mainDb, useDb, dbFor, childDbName, deleteDatabase, setBackends } from './db.js';
import { getDriveConfig, setDriveConfig, getDriveState, signIn as driveSignIn, signOut as driveSignOut, driveSync, drivePending, startDriveAutoSync, hasToken as driveHasToken, clientIdFor } from './drive.js';
import { LOG_TYPES, FOOD_UNITS, MED_FREQ, typeByKey, typesForAge, fieldOptions, fieldsForAge,
  POSITIVE_BEHAVIOURS, CHALLENGING_BEHAVIOURS, TRIGGERS, RESPONSES, OUTCOMES, behaviourForAge } from './catalog.js';
import { STAGES, stageFor, nextStage, MILESTONES, RED_FLAGS, MILESTONE_TIPS, milestoneFocus } from './stages.js';
import { themeFor, MONTHLY_PHYSICAL, EI_ROADMAP, eiRowFor, UIP_VACCINES } from './devdata.js';
import { INDICATORS, whoValue, zScore, percentile, zLabel } from './growth.js';
import { applyPronouns, pr } from './pronouns.js';
import { answer as askAnswer, suggestions as askSuggestions, TOPICS as ASK_TOPICS, questionsFor } from './assistant.js';
import { GUIDE, DAILY_TIPS } from './guide.js';
import { learningFor, wakeWindowFor } from './learning.js';
import { esc, uid, dateKey, parseKey, addDays, fmtTime, toLocalInput, fromLocalInput, fmtDur, fmtDateLong, fmtDateShort,
  hmToMin, minToHm, ageMonths, ageText, dayOfYear, entryMinutes } from './util.js';
import { barChart, pairChart, lineChart, growthChart, wireTooltips } from './charts.js';
import { startAutoSync, syncNow, getConfig, setConfig, getState, pendingCount, testConnection, restoreFromSheet, childrenList } from './sync.js';
import { savePhotoFile, thumbHtml, watchPhotos } from './photos.js';
import { voiceSupported, listen, stopListening, parseVoice } from './voice.js';

const APP_NAME = 'Happy Parenthood';

// ------------------------------------------------------------------ state
const S = {
  settings: null, months: 0, stage: null, theme: null, child: 'main', children: [], P: pr('boy'),
  view: 'home', selMode: false, sel: new Set(), homeTab: 'timeline', diaryMode: 'timeline', homeCat: null, settingsTab: null, diaryDate: dateKey(), growTab: 'milestones', trendDays: 7, guideAll: false,
  healthTab: 'illness', healthQ: '', voiceItems: null, voiceText: '',
};
const $ = sel => document.querySelector(sel);
const main = () => $('#main');

const DEFAULT_SETTINGS = { name: '', dob: '', sex: 'boy', premature: 0, wake: '06:30', caregivers: ['Amma', 'Appa', 'Paati', 'Thatha'], me: 'Amma', theme: 'auto', voiceLang: 'en-IN' };

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
  memory: 'feel', mood: 'feel', kind: 'feel', note: 'feel', behaviourNeg: 'feel', growth: 'health', behaviour: 'feel', ei: 'feel' };

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
  { k: 'note', mode: 'form', icon: '📝', label: 'Note' }, { k: 'teeth', mode: 'form', icon: '🪥', label: 'Teeth', min: 6 },
  { k: 'potty', mode: 'form', icon: '🚽', label: 'Potty try', min: 15, max: 60 }, { k: 'growth', mode: 'form', icon: '📏', label: 'Weight/height' },
  { k: 'doctor', mode: 'form', icon: '🩺', label: 'Doctor visit' }, { k: 'behaviourNeg', mode: 'kindNeg', icon: '🌋', label: 'Tough moment', min: 9 },
];
const quickForAge = () => QUICK.filter(q => S.months >= (q.min ?? 0) && S.months < (q.max ?? 9999));

// Home categories (design C). Order adapts to age; each shows its big buttons.
const CATS = [
  { k: 'sleep', icon: '🌙', label: 'Sleep' }, { k: 'food', icon: '🥣', label: 'Food' }, { k: 'toilet', icon: '💛', label: 'Toilet' },
  { k: 'play', icon: '🧸', label: 'Play' }, { k: 'care', icon: '🛁', label: 'Care' }, { k: 'learn', icon: '📚', label: 'Learn' },
  { k: 'health', icon: '🩺', label: 'Health' }, { k: 'feel', icon: '💗', label: 'Feelings' },
];
function catsForAge() {
  const avail = quickForAge();
  let order = S.months < 36 ? ['sleep', 'food', 'toilet', 'play', 'care', 'learn', 'feel', 'health']
    : S.months < 72 ? ['food', 'play', 'sleep', 'learn', 'toilet', 'care', 'feel', 'health']
      : ['learn', 'play', 'food', 'sleep', 'care', 'feel', 'health', 'toilet'];
  return order.map(k => CATS.find(c => c.k === k)).filter(c => avail.some(q => (CAT[q.k] || 'feel') === c.k));
}
// Which category to open first: the one of the next routine item (age-appropriate by design)
async function defaultCat(cats) {
  const r = await getRoutine();
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const next = r.find(x => x.min >= now - 20) || r[0];
  const c = CAT[next?.type];
  return cats.some(x => x.k === c) ? c : cats[0]?.k;
}

// Install-as-app support
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ------------------------------------------------------------------ boot
async function boot() {
  S.children = await childrenList();
  let cur = 'main';
  try { cur = localStorage.getItem('hp-child') || 'main'; } catch (e) { /* private mode */ }
  if (!S.children.some(c => c.id === cur)) cur = 'main';
  await selectChild(cur, false);
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  wireTooltips(document.body);
  watchPhotos();
  setInterval(tickTimers, 1000);
  setInterval(() => checkReminders().catch(() => {}), 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkReminders().catch(() => {}); });
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.go) handleGo(e.data.go); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.settings?.dob) renderHeader(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast(`🎉 Installed! Open ${APP_NAME} from your home screen.`); if (S.settings?.dob) renderHeader(); });
  const [cfgSheet, cfgDrive] = await Promise.all([getConfig(), getDriveConfig()]);
  setBackends({ sheet: !!cfgSheet.enabled, drive: !!cfgDrive.enabled });
  startAutoSync({ buildRow, status: renderSyncBadge });
  startDriveAutoSync({ status: renderSyncBadge });
  // another phone's changes arrived from Google Drive: refresh what is on screen
  window.addEventListener('drive-pulled', async () => {
    S.children = await childrenList();
    const st = await db.getKV('settings');
    if (st) { S.settings = { ...DEFAULT_SETTINGS, ...st }; await refreshAge(); }
    if (S.settings?.dob && $('#sheet').hidden) route(); // don't disturb an open form
  });
  if (!S.settings?.dob) return renderOnboarding();
  await route();
  const go = new URLSearchParams(location.search).get('go');
  if (go) { history.replaceState(null, '', location.pathname); handleGo(go); }
  checkReminders().catch(() => {});
}

// Switch the whole app to another child (each child has a separate database)
async function selectChild(id, render = true) {
  S.child = id;
  useDb(childDbName(id));
  try { localStorage.setItem('hp-child', id); } catch (e) { /* ignore */ }
  const st = await db.getKV('settings');
  S.settings = st ? { ...DEFAULT_SETTINGS, ...st } : null;
  S.homeCat = null; S.homeTab = 'timeline';
  applyTheme();
  if (S.settings?.dob) await refreshAge();
  if (render) { S.view = 'home'; route(); }
}

async function saveChildrenList() {
  S.children = S.children.map(c => c.id === S.child ? { ...c, name: S.settings?.name || c.name } : c);
  await mainDb.setKV('children', S.children);
}

// Row sent to the Google Sheet: readable columns + the full entry for restoring
async function buildRow(e, child, cdb) {
  const t = typeInfo(e.type);
  const stamp = ms => ms ? `${dateKey(ms)} ${fmtTime(ms)}` : '';
  const links = [];
  for (const pid of e.data?.photos || []) { const p = await cdb.getPhoto(pid); if (p?.driveUrl) links.push(p.driveUrl); }
  const childName = child?.name || (child?.id === S.child ? S.settings?.name : '') || '';
  return { id: e.id, date: e.date, start: stamp(e.start), end: t.timed ? stamp(e.end) : '', duration: e.end && t.timed ? Math.round(entryMinutes(e)) : '',
    type: e.type, activity: t.label, details: entrySummary(e), note: e.note || '', by: e.by || '', updatedAt: e.updatedAt, photos: links.join('\n'), childName, entry: e };
}

async function renderSyncBadge(state) {
  const el = $('#syncBadge');
  if (!el) return;
  const [cfg, dcfg] = await Promise.all([getConfig(), getDriveConfig()]);
  const set = (txt, cls, title, act = 'backup') => { el.textContent = txt; el.className = 'sync-badge ' + cls; el.title = title; el.setAttribute('aria-label', title); el.dataset.act = act; };
  if (!cfg.enabled && !dcfg.enabled) return set('☁️', 'off', 'Backup is off — tap to set up');
  if (state === 'syncing') return set('☁️ ⟳', 'busy', 'Backing up…');
  if (dcfg.enabled && !driveHasToken()) return set('☁️ Tap to sync', 'warn', 'Tap to sign in to Google and sync', 'driveSignIn');
  const n = (cfg.enabled ? await pendingCount() : 0) + (dcfg.enabled ? await drivePending() : 0);
  const err = (dcfg.enabled && (await getDriveState()).lastError) || (cfg.enabled && (await getState()).lastError);
  if (!navigator.onLine) return set(`☁️ ${n}`, 'warn', 'Offline — will back up when online');
  if (err && n) return set('☁️ ⚠', 'err', 'Backup problem: ' + err);
  if (n) return set(`☁️ ${n}`, 'busy', `${n} changes waiting to back up`);
  const last = dcfg.enabled ? (await getDriveState()).lastSync : (await getState()).lastSync;
  return set('☁️ ✓', 'ok', last ? `Backed up ${new Date(last).toLocaleString()}` : 'Backed up');
}

// Queue every child's existing data for the first Drive upload
async function markAllForDrive() {
  for (const c of S.children) {
    const cdb = dbFor(childDbName(c.id));
    const months = {};
    (await cdb.all()).forEach(e => { if (e.date) months[e.date.slice(0, 7)] = Date.now(); });
    await cdb.setKVQuiet('driveDirty', { months, dels: {} });
    await cdb.setKVQuiet('driveKvDirty', Date.now());
  }
}

async function doDriveSignIn() {
  try {
    const first = !(await getDriveConfig()).email;
    toast('Opening Google sign-in…');
    const email = await driveSignIn();
    setBackends({ drive: true });
    if (first) await markAllForDrive();
    toast(`✓ Signed in${email ? ' as ' + email : ''}. Syncing…`);
    const r = await driveSync({ silent: false });
    toast(r.ok ? `✓ Backed up to Google Drive${r.pulled ? ` · ${r.pulled} changes from your other phone` : ''}` : 'Sync will continue in the background');
  } catch (err) { alert(err.message); }
  route();
}

async function refreshAge() {
  S.months = ageMonths(S.settings.dob, Date.now(), Number(S.settings.premature) || 0);
  S.stage = stageFor(S.months);
  applyPronouns(S.settings.sex);
  S.P = pr(S.settings.sex);
  applyAgeTheme();
}

function applyTheme() {
  const t = S.settings?.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// Colours change with age: every month in the first year, then per stage
function applyAgeTheme() {
  const th = S.theme = themeFor(S.months);
  const r = document.documentElement.style;
  r.setProperty('--t-accent', th.accent); r.setProperty('--t-accent-dark', th.dark);
  r.setProperty('--t-hero', `linear-gradient(135deg, ${th.hero[0]} 0%, ${th.hero[1]} 100%)`);
  r.setProperty('--t-hero-dark', `linear-gradient(135deg, ${th.heroDark[0]} 0%, ${th.heroDark[1]} 100%)`);
  // full-screen background: the theme's colours + a soft pattern of its pictures
  r.setProperty('--t-bg', `linear-gradient(170deg, ${th.hero[0]} 0%, ${th.hero[1]} 100%)`);
  r.setProperty('--t-bg-dark', `linear-gradient(170deg, ${th.heroDark[0]} 0%, ${th.heroDark[1]} 100%)`);
  const em = th.deco.split(/\s+/).filter(Boolean);
  const spots = [[18, 40, -12], [150, 28, 10], [92, 108, 6], [20, 170, 14], [168, 150, -8], [110, 218, -14], [40, 262, 8], [175, 262, 4]];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='290'><g font-size='34' font-family='Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif'>${spots.map(([x, y, rot], i) => `<text x='${x}' y='${y}' transform='rotate(${rot} ${x} ${y})'>${em[i % em.length]}</text>`).join('')}</g></svg>`;
  r.setProperty('--t-pattern', `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', th.accent);
}

const NAV_OF = { home: 'home', diary: 'diary', health: 'health', heart: 'heart', more: 'more', grow: 'more', routine: 'more', guide: 'more', settings: 'more', ask: 'more', doctor: 'health', week: 'more' };
let lastPage = '';
// Re-render the current screen. The scroll position is kept when staying on the same
// screen (e.g. after tapping a button or a checkbox) and reset only when changing screens.
async function route() {
  const page = `${S.view}|${S.growTab}|${S.settingsTab}`; // in-page tabs (home/health) keep the scroll position
  const keep = page === lastPage;
  const y = window.scrollY;
  const open = keep ? [...main().querySelectorAll('details')].map(d => d.open) : null;
  lastPage = page;
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === NAV_OF[S.view] ? 'page' : 'false'));
  document.body.dataset.view = S.view;
  renderHeader();
  await ({ ask: renderAsk, home: renderHome, diary: renderDiary, health: renderHealth, heart: renderHeart, more: renderMore, grow: renderGrow, routine: renderRoutine, guide: renderGuide, settings: renderSettings, doctor: renderDoctor, week: renderWeek })[S.view]();
  if (keep) {
    const ds = main().querySelectorAll('details');
    if (open && open.length === ds.length) ds.forEach((d, i) => { d.open = open[i]; });
    window.scrollTo(0, y);
  } else window.scrollTo(0, 0);
}

function renderHeader() {
  const s = S.settings;
  const canInstall = !isStandalone() && (installEvt || isIOS);
  const th = S.theme;
  $('#hdr').innerHTML = `<button class="who" data-act="children" aria-label="Switch or add child"><span class="avatar" aria-hidden="true">${esc((s.name || '?')[0].toUpperCase())}</span>
    <span><span class="name">${esc(s.name)} <span class="caret">▾</span></span><span class="sub">${esc(ageText(s.dob))} · ${th.emoji} ${esc(th.label)}: ${esc(th.name)}</span></span></button>
    <div class="hdr-actions"><button class="icon-btn ask-btn" data-act="view" data-view="ask" aria-label="Ask a parenting question">💬</button>${canInstall ? '<button class="pill-btn install" data-act="install">📲 Install</button>' : ''}
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

// ------------------------------------------------------------------ HOME (design C: category tabs)
async function renderHome() {
  const today = dateKey();
  const list = await entriesAround(today);
  const sm = summarize(list, today);
  const running = (await db.all()).filter(e => typeInfo(e.type).timed && e.start && !e.end);
  const banner = await stageBanner();
  const cats = catsForAge();
  if (!S.homeCat || !cats.some(c => c.k === S.homeCat)) S.homeCat = await defaultCat(cats);
  const btns = quickForAge().filter(q => (CAT[q.k] || 'feel') === S.homeCat);
  const otherRunning = running.filter(e => (CAT[e.type] || 'feel') !== S.homeCat);

  let tabBody = '';
  const todayN = list.filter(e => e.date === today && e.type !== 'ei').length;
  if (S.homeTab === 'timeline') tabBody = selBar(todayN) + timelineHtml(list, today);
  else if (S.homeTab === 'log') tabBody = selBar(todayN) + entryList(list.filter(e => e.date === today).reverse(), 'Nothing logged yet today. Pick a category above and tap a button, or say it with 🎤.');
  else if (S.homeTab === 'summary') tabBody = homeSummary(sm, S.stage.targets);
  else tabBody = await homeMonth(list, today);

  main().innerHTML = `
    ${banner}
    ${await installNudge()}
    <button class="voice-cta" data-act="voice"><span class="mic-dot">🎤</span><span><b>Tell me what happened</b><br><small>“Ate 4 spoons of ragi at 8 and napped for an hour”</small></span></button>
    ${await weekBanner()}
    ${await lastFeedStrip()}
    ${await wakeStrip()}
    ${await learningCard()}
    <div class="cats" role="tablist" aria-label="Categories">
      ${cats.map(c => { const n = running.filter(e => (CAT[e.type] || 'feel') === c.k).length; return `<button class="cat c-${c.k}" role="tab" data-act="homeCat" data-cat="${c.k}" aria-selected="${c.k === S.homeCat}">${c.icon} ${c.label}${n ? ' <i class="dot" aria-label="timer running"></i>' : ''}</button>`; }).join('')}
      <button class="cat all" data-act="openPicker">＋ All</button>
    </div>
    <section class="big2">${btns.map(q => quickBtn(q, running, sm)).join('')}</section>
    ${otherRunning.map(e => `<div class="run-pill c-${CAT[e.type] || 'feel'}"><span>${typeInfo(e.type).icon} <b>${esc(typeInfo(e.type).label)}</b> <span data-since="${e.start}">${fmtDur(entryMinutes(e))}</span></span>
      <button class="pill-btn" data-act="toggle" data-type="${e.type}">Stop</button></div>`).join('')}
    <section class="glance" aria-label="Today at a glance">${glanceForAge(sm)}</section>
    <div class="seg" role="tablist">
      ${[['timeline', 'Timeline'], ['log', "Today's log"], ['summary', 'Summary'], ['month', 'This month']].map(([k, l]) => `<button role="tab" data-act="homeTab" data-tab="${k}" aria-pressed="${S.homeTab === k}">${l}</button>`).join('')}
    </div>
    <div class="tab-body">${tabBody}</div>`;
}

function quickBtn(q, running, sm) {
  const c = CAT[q.k] || 'feel';
  if (q.mode === 'toggle') {
    const run = running.find(e => e.type === q.k);
    return run
      ? `<button class="qb on c-${c}" data-act="toggle" data-type="${q.k}" aria-pressed="true"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}${run.data?.side ? ` · ${esc(run.data.side)}` : ''}</span><b class="elapsed" data-since="${run.start}">${fmtDur(entryMinutes(run))}</b><small>tap to stop</small></button>`
      : `<button class="qb c-${c}" data-act="toggle" data-type="${q.k}" aria-pressed="false"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>tap to start</small></button>`;
  }
  if (q.mode === 'count') {
    const n = q.k === 'pee' ? sm.pee : q.k === 'poop' ? sm.poop : null;
    return `<button class="qb c-${c}" data-act="quick" data-type="${q.k}"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}${n !== null ? ' +1' : ''}</span><small>${n !== null ? `${n} today` : 'tap'}</small></button>`;
  }
  if (q.mode === 'kind') return `<button class="qb c-${c}" data-act="behaviour" data-kind="pos"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>tap</small></button>`;
  if (q.mode === 'kindNeg') return `<button class="qb c-${c}" data-act="behaviour" data-kind="neg"><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>tap</small></button>`;
  return `<button class="qb c-${c}" data-act="form" data-type="${q.k}" ${q.k === 'memory' ? 'data-first="1"' : ''}><span class="qi">${q.icon}</span><span class="ql">${esc(q.label)}</span><small>add</small></button>`;
}
const glance = (icon, v, l) => `<button class="g" data-act="homeTab" data-tab="summary"><span>${icon}</span><b>${esc(v)}</b><small>${l}</small></button>`;
// The four numbers that matter most at this age
function glanceForAge(sm) {
  const m = S.months;
  if (m < 12) return glance('🌙', fmtDur(sm.sleepMin), 'sleep') + glance('🍼', sm.feeds + sm.meals, 'feeds+meals') + glance('💛', sm.pee, 'wet') + glance('🧸', fmtDur(sm.playMin + sm.outdoorMin), 'play');
  if (m < 36) return glance('🌙', fmtDur(sm.sleepMin), 'sleep') + glance('🥣', sm.meals, 'meals') + glance('🚽', sm.pee, 'pee') + glance('🌳', fmtDur(sm.outdoorMin), 'outdoor');
  if (m < 72) return glance('🌙', fmtDur(sm.sleepMin), 'sleep') + glance('🥣', sm.meals, 'meals') + glance('🌳', fmtDur(sm.outdoorMin), 'outdoor') + glance('📱', fmtDur(sm.screenMin), 'screen');
  return glance('🌙', fmtDur(sm.sleepMin), 'sleep') + glance('📚', fmtDur(sm.learnMin), 'study') + glance('⚽', fmtDur(sm.outdoorMin), 'active') + glance('📱', fmtDur(sm.screenMin), 'screen');
}

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
  const th = S.theme;
  const phys = S.months <= 12.5 ? MONTHLY_PHYSICAL.find(r => r.m === Math.min(12, Math.max(1, Math.floor(S.months)))) : null;
  const physState = await db.getKV('physical', {});
  return `
    <section class="card theme-card"><div class="theme-now"><span class="big-emoji">${th.emoji}</span><div><b>${esc(th.label)}: ${esc(th.name)}</b><br><small>${esc(th.about)}</small></div></div>
      ${phys ? `<div class="row between"><span class="small"><b>Body checks for month ${phys.m}:</b> ${phys.items.filter((_, i) => physState[`${phys.m}:${i}`]).length}/${phys.items.length} done</span><button class="btn small" data-act="goGrow" data-tab="physical">Open</button></div>` : ''}</section>
    ${msList(next, `🎯 Working towards · by ${ageLabel(next?.at)}`, 'next', 5)}
    ${passed && passed !== next ? msList(passed, `✅ Should be doing now · by ${ageLabel(passed.at)}`, 'passed', 4) : ''}
    <p class="muted small">Tick a milestone when you see ${S.P.him} do it. Every child grows at their own pace — if something in "should be doing now" isn't happening, mention it at the next paediatric visit.</p>
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
    return `<li data-act="edit" data-id="${e.id}" class="c-${CAT[e.type] || 'feel'}${S.sel.has(e.id) ? ' picked' : ''}"><span class="e-icon">${t.icon}</span>
      <span class="e-body"><span class="e-top"><b>${esc(t.label)}</b><span class="e-time">${fmtTime(e.start)}${e.end && t.timed && e.end !== e.start ? `–${fmtTime(e.end)}` : ''}</span></span>
      <span class="muted">${esc(entrySummary(e))}</span>${e.note ? `<br><i class="small">${esc(e.note)}</i>` : ''}
      ${e.data?.photos?.length ? `<span class="thumbs">${e.data.photos.slice(0, 3).map(id => thumbHtml(id)).join('')}</span>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

// Select-to-delete: tap entries on the timeline or list to tick them, then delete together.
function selBar(n) {
  if (!n) return '';
  if (!S.selMode) return `<div class="row between sel-start"><span class="muted small">Tap an entry to edit it</span><button class="btn small" data-act="selStart">☑️ Select to delete</button></div>`;
  return `<div class="selbar" role="toolbar" aria-label="Delete entries"><span><b id="selN">${S.sel.size}</b> selected</span>
    <button class="btn small" data-act="selAll">Select all</button><button class="btn small danger" data-act="selDel">🗑️ Delete</button><button class="btn small" data-act="selCancel">Done</button></div>`;
}
const updateSel = () => {
  document.querySelectorAll('#main [data-act="edit"][data-id]').forEach(x => x.classList.toggle('picked', S.sel.has(x.dataset.id)));
  const n = $('#selN'); if (n) n.textContent = S.sel.size;
};

// Day timeline: every entry is a point on one line; timed activities draw a bar down
// to where they ended, and the line shows whether the next one continued straight on.
function timelineHtml(list, day) {
  const items = list.filter(e => e.type !== 'ei' && (e.date === day || (typeInfo(e.type).timed && e.end && dateKey(e.end) === day)))
    .sort((a, b) => a.start - b.start);
  if (!items.length) return `<p class="empty">Nothing on the timeline yet. Each new activity you log carries on from the last one.</p>`;
  let lastEnd = null;
  const rows = [];
  for (const e of items) {
    const t = typeInfo(e.type), timed = t.timed && e.end !== e.start, running = t.timed && !e.end;
    if (lastEnd && e.start - lastEnd >= 5 * 60000) rows.push(`<li class="tl-gap"><span class="tl-t"></span><span class="tl-rail"></span><span class="small muted">${fmtDur((e.start - lastEnd) / 60000)} in between</span></li>`);
    const cont = lastEnd && Math.abs(e.start - lastEnd) < 60000;
    const along = t.timed ? items.filter(o => o !== e && typeInfo(o.type).timed && o.end !== o.start && o.start <= e.start && (o.end == null || o.end > e.start) && !(o.start === e.start && o.id > e.id)) : [];
    const prevDay = e.date !== day;
    rows.push(`<li class="tl-item c-${CAT[e.type] || 'feel'} ${timed ? 'span' : 'point'} ${running ? 'running' : ''}${S.sel.has(e.id) ? ' picked' : ''}" data-act="edit" data-id="${e.id}">
      <span class="tl-t">${fmtTime(e.start)}${prevDay ? '<small>yesterday</small>' : ''}${timed && e.end ? `<small>${fmtTime(e.end)}</small>` : ''}</span>
      <span class="tl-rail"><i class="tl-dot"></i>${timed ? '<i class="tl-bar"></i>' : ''}</span>
      <span class="tl-body">${along.length ? `<small class="tl-cont">＋ alongside ${esc(along.map(o => typeInfo(o.type).icon + ' ' + typeInfo(o.type).label).join(', '))}</small>` : cont ? '<small class="tl-cont">↳ carried on</small>' : ''}<b>${t.icon} ${esc(t.label)}</b>
        ${running ? ` <span class="tl-live">now · <span data-since="${e.start}">${fmtDur(entryMinutes(e))}</span></span>` : ''}
        <span class="muted small">${esc(entrySummary(e).replace('⏱ running', '').replace(/^ · | · $/g, ''))}</span></span></li>`);
    if (t.timed && e.end) lastEnd = Math.max(lastEnd || 0, e.end);
    else if (running) lastEnd = null;
  }
  return `<ol class="tline">${rows.join('')}</ol>`;
}

function tickTimers() {
  document.querySelectorAll('[data-ago]').forEach(el => { el.textContent = agoText(Number(el.dataset.ago)); });
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
  const stopped = t.timed && !old ? await endRunningAt(start, entry.id, t.key) : [];
  await db.put(entry);
  closeSheet();
  const msg = (startTimer ? `⏱ ${t.label} timer started` : `Saved ${t.icon} ${t.label}`) + (stopped.length ? ` · ${stoppedText(stopped)}` : '');
  toast(msg, stopped.length ? [['Undo', async () => { await db.del(entry.id); await resume(stopped); route(); }]] : []);
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
    <label>What I heard (you can correct it or type)<textarea id="vText" rows="4" placeholder="e.g. ${S.P.He} ate 4 spoons of ragi porridge and half a banana at 8. ${S.P.He} napped from 11 to 12:30. ${S.P.He} peed twice.">${esc(S.voiceText)}</textarea></label>
    <div class="row wrap"><label class="small inline">Language <select id="vLang">${langs.map(([v, l]) => `<option value="${v}" ${v === S.settings.voiceLang ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <details class="small"><summary>What can I say?</summary><ul>
      <li>“${S.P.He} ate 2 idlis and half a bowl of curd rice for lunch”</li><li>“Napped from 1 to 2:30” · “Slept for 45 minutes”</li>
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
    const end = t.timed ? it.end : null;
    if (t.timed) await endRunningAt(it.start, null, it.type); // the new activity takes over from whatever was running
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
    ${textWithMic('details', 'Details', d.details || '', kind === 'pos' ? `e.g. offered ${S.P.his} biscuit to cousin` : `What exactly did ${S.P.he} do?`, true)}
    ${kind === 'neg' ? `
      <label>Likely trigger<select name="trigger"><option value="">—</option>${TRIGGERS.map(x => `<option ${x === d.trigger ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <fieldset><legend>How strong (1 mild – 5 intense)</legend><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="intensity" value="${n}" ${Number(d.intensity) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>How we responded</legend><div class="chips">${RESPONSES.map(x => `<label class="chip"><input type="checkbox" name="responses" value="${esc(x)}" ${(d.responses || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>
      <label>Outcome<select name="outcome"><option value="">—</option>${OUTCOMES.map(x => `<option ${x === d.outcome ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    ` : `
      <fieldset><legend>How we responded</legend><div class="chips">${[`Described what ${S.P.he} did`, 'Praised the effort', 'Hug / smile', 'Told the family', `Thanked ${S.P.him}`].map(x => `<label class="chip"><input type="checkbox" name="responses" value="${esc(x)}" ${(d.responses || []).includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>`}
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
    toast(kind === 'pos' ? `💗 Noted — tell ${S.P.him} what you noticed!` : 'Logged. Remember to reconnect after big feelings.');
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
    <div class="seg" role="tablist">${[['timeline', 'Timeline'], ['list', 'List']].map(([k, l]) => `<button role="tab" data-act="diaryMode" data-mode="${k}" aria-pressed="${S.diaryMode === k}">${l}</button>`).join('')}</div>
    ${selBar(list.filter(e => e.date === d).length)}
    ${S.diaryMode === 'timeline' ? timelineHtml(list, d) : entryList(list.filter(e => e.date === d))}
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
    <div class="row between"><h2>🩺 Health</h2><button class="btn small" data-act="view" data-view="doctor">📋 Doctor summary</button></div>
    <div class="health-actions">
      <button class="hb c-health" data-act="form" data-type="illness"><span>🤒</span>Illness</button>
      <button class="hb c-health" data-act="form" data-type="sick"><span>🌡️</span>Temperature</button>
      <button class="hb c-health" data-act="form" data-type="medicine"><span>💊</span>Gave medicine</button>
      <button class="hb c-health" data-act="form" data-type="prescription"><span>📄</span>Prescription</button>
      <button class="hb c-health" data-act="form" data-type="doctor"><span>🩺</span>Doctor visit</button>
      <button class="hb c-health" data-act="goGrow" data-tab="vaccines"><span>💉</span>Vaccines</button>
    </div>
    ${ongoing.length ? `<div class="label">Currently unwell</div>${ongoing.map(i => illnessCard(i, h, true)).join('')}` : `<p class="ok-note">🌈 No ongoing illness. If ${S.P.he} falls sick, tap <b>🤒 Illness</b> to start tracking it.</p>`}
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

// ------------------------------------------------------------------ ASK (offline assistant)
// Functions the assistant uses to answer personal questions from the logs
function askContext() {
  const P = S.P, name = S.settings.name, tg = S.stage.targets;
  const dayKey = off => addDays(dateKey(), off);
  const sumFor = async d => summarize(await entriesAround(d), d);
  return {
    name, months: S.months, P, stageName: S.stage.name, ageText: () => ageText(S.settings.dob),
    async lastFeed() {
      const feeds = [...await db.byType('breastfeed'), ...await db.byType('bottle')].sort((a, b) => b.start - a.start);
      const meal = (await db.byType('meal')).sort((a, b) => b.start - a.start)[0];
      const f = feeds[0], out = [];
      if (!f && !meal) return ['No feeds or meals logged yet. Tap 🥣 Food on Home to start logging.'];
      if (f) out.push(!f.end && f.type === 'breastfeed' ? `🤱 Feeding now (${f.data?.side || 'side not noted'}) — started ${fmtTime(f.start)}.` : `${f.type === 'bottle' ? '🍼 Bottle' : '🤱 Breastfeed'} ${agoText(f.start)} (${fmtTime(f.start)}${f.data?.side ? ', ' + f.data.side : ''}${f.data?.amount ? ', ' + f.data.amount + ' ml' : ''}${f.end && f.end !== f.start ? ', ' + fmtDur(entryMinutes(f)) : ''}).`);
      if (meal) out.push(`🥣 Last meal ${agoText(meal.start)}: ${(meal.data?.foods || []).map(x => x.name).join(', ') || meal.data?.meal || 'food'}.`);
      const today = await sumFor(dateKey());
      if (S.months < 24) out.push(`Today so far: ${today.feeds} milk feeds and ${today.meals} meals.`);
      return out;
    },
    async counts(type) {
      const sm = await sumFor(dateKey()), y = await sumFor(dayKey(-1));
      const n = type === 'pee' ? sm.pee : sm.poop, ny = type === 'pee' ? y.pee : y.poop;
      const out = [`${type === 'pee' ? '💛 Pee / wet nappies' : '💩 Poops'} today: ${n} (yesterday: ${ny}).`];
      if (type === 'pee' && S.months < 24) out.push(n >= 6 || new Date().getHours() < 18 ? 'Babies usually have 6 or more wet nappies a day.' : '⚠️ That is lower than the usual 6+ a day. Offer more feeds; if urine is dark or there is none for 6–8 hours, see a doctor.');
      return out;
    },
    async sleepDay(off) {
      const d = dayKey(off), sm = await sumFor(d);
      if (!sm.sleepMin) return [`No sleep logged for ${off ? 'yesterday' : 'today'} yet. Use the 🌙 / 😴 buttons to time sleep.`];
      return [`🌙 ${off ? 'Yesterday' : 'Today'}: ${fmtDur(sm.sleepMin)} in total — night ${fmtDur(sm.nightMin)}, ${sm.napCount} nap${sm.napCount === 1 ? '' : 's'} (${fmtDur(sm.napMin)}).`, `Recommended for ${P.his} age: ${tg.sleep[0]}–${tg.sleep[1]} hours in 24 hours.`];
    },
    async sleepWeek() {
      const days = []; for (let i = 7; i >= 1; i--) days.push(await sumFor(dayKey(-i)));
      const logged = days.filter(x => x.sleepMin > 0);
      if (!logged.length) return ['No sleep logged in the last 7 days yet. Time naps and night sleep with the 🌙 / 😴 buttons and ask again.'];
      const avg = logged.reduce((a, x) => a + x.sleepMin, 0) / logged.length / 60;
      const [lo, hi] = tg.sleep;
      const verdict = avg < lo ? `⚠️ That is below the recommended ${lo}–${hi} h. Try an earlier bedtime and check nap timing.` : avg > hi ? `That is above the usual ${lo}–${hi} h — fine if ${P.he} is well; mention it to your doctor if ${P.he} seems unusually sleepy.` : `✓ That is within the recommended ${lo}–${hi} h for ${P.his} age.`;
      return [`Average sleep over the last ${logged.length} logged day${logged.length > 1 ? 's' : ''}: ${avg.toFixed(1)} h a day.`, verdict];
    },
    async foodDay(off) {
      const d = dayKey(off), list = (await db.byDate(d)).filter(e => e.type === 'meal').sort((a, b) => a.start - b.start);
      if (!list.length) return [`No meals logged ${off ? 'yesterday' : 'today'} yet.`];
      return list.map(e => `• ${fmtTime(e.start)} ${e.data?.meal || 'Meal'}: ${(e.data?.foods || []).map(f => `${f.name}${f.qty ? ` ${f.qty} ${f.unit}` : ''}`).join(', ') || '—'}${e.data?.appetite ? ` (${e.data.appetite.toLowerCase()})` : ''}`);
    },
    async foodsTried() {
      const map = await db.getKV('foods', {}); const list = Object.entries(map).sort((a, b) => b[1].first.localeCompare(a[1].first));
      if (!list.length) return ['No foods logged yet.'];
      return [`${list.length} different foods tried so far.`, `Newest: ${list.slice(0, 6).map(([n, f]) => `${n} (${fmtDateShort(f.first)})`).join(', ')}.`, ...(list.some(([, f]) => f.reactions?.length) ? [`Reactions noted for: ${list.filter(([, f]) => f.reactions?.length).map(([n]) => n).join(', ')}.`] : [])];
    },
    async growth() {
      const g = (await db.byType('growth')).sort((a, b) => b.start - a.start);
      if (!g.length) return ['No weight or height logged yet. Add one in More → Physical growth.'];
      const out = [];
      for (const [ind, key] of [['wfa', 'weight'], ['hfa', 'height'], ['hca', 'head']]) {
        const e = g.find(x => x.data?.[key]); if (!e) continue;
        const mo = ageMonths(S.settings.dob, e.start, Number(S.settings.premature) || 0);
        const z = zScore(ind, S.settings.sex, mo, e.data[key]);
        out.push(`${INDICATORS[ind].label}: ${e.data[key]} ${INDICATORS[ind].unit} on ${fmtDateShort(e.date)}${z != null ? ` — ${percentile(z)}th percentile: ${zLabel(z)[1]}` : ''}.`);
      }
      return [...out, 'The WHO chart is in More → Physical growth.'];
    },
    async nextVaccine() {
      const state = await db.getKV('vaccines', {}); const dob = parseKey(S.settings.dob);
      const due = UIP_VACCINES.map(v => { const d = new Date(dob); d.setDate(d.getDate() + Math.round(v.at * 30.4375)); return { ...v, dk: dateKey(d), done: state[`uip:${v.at}`] }; });
      const over = due.filter(v => !v.done && v.dk < dateKey()), next = due.find(v => !v.done && v.dk >= dateKey());
      const out = [];
      if (over.length) out.push(`⚠️ Not marked as given yet: ${over.map(v => `${v.label} (${v.name})`).join('; ')}. Tick them in More → Vaccines if already given.`);
      if (next) out.push(`💉 Next: ${next.label} — ${next.name}, due around ${fmtDateLong(next.dk)}.`);
      return out.length ? out : ['🎉 All government-schedule vaccines are marked as given.'];
    },
    async milestones() {
      const state = await db.getKV('milestones', {}); const { passed, next } = milestoneFocus(S.months);
      const todo = c => c ? c.items.map((it, i) => ({ it, k: `${c.at}:${i}` })).filter(x => !state[x.k]).map(x => x.it[1]) : [];
      const out = [];
      if (passed) { const t = todo(passed); out.push(t.length ? `By ${ageLabel(passed.at)} most children: ${t.slice(0, 4).join('; ')}${t.length > 4 ? '…' : ''} (not ticked yet).` : `✓ All ${ageLabel(passed.at)} milestones ticked.`); }
      if (next && next !== passed) { const t = todo(next); out.push(`Working towards (by ${ageLabel(next.at)}): ${t.slice(0, 4).join('; ')}${t.length > 4 ? '…' : ''}.`); }
      return [...out, 'Ideas to encourage each one are in Home → This month.'];
    },
    async nextRoutine() {
      const r = await getRoutine(); const now = new Date().getHours() * 60 + new Date().getMinutes();
      const n = r.filter(x => x.min >= now - 10).slice(0, 3);
      return n.length ? n.map(x => `🕒 ${minToHm(x.min)} — ${x.label}`) : ['The rest of today\'s routine is done. Bedtime routine next!'];
    },
    async meds() {
      const meds = (await db.byType('medicine')).sort((a, b) => b.start - a.start);
      if (!meds.length) return ['No medicines logged.'];
      const latest = {}; meds.forEach(m => { const k = (m.data?.name || '').toLowerCase(); if (k && !latest[k]) latest[k] = m; });
      return Object.values(latest).slice(0, 5).map(m => `💊 ${m.data.name}${m.data.dose ? ' ' + m.data.dose : ''}: last given ${agoText(m.start)} (${fmtTime(m.start)} ${fmtDateShort(m.date)}).`).concat(['See Health for next-dose times from the prescription.']);
    },
    async triggers() {
      const list = (await db.range(dayKey(-13), dateKey())).filter(e => e.type === 'behaviour' && e.data?.kind === 'neg');
      if (!list.length) return ['No challenging moments logged in the last 2 weeks. 🌈'];
      const c = {}; list.forEach(e => { if (e.data.trigger) c[e.data.trigger] = (c[e.data.trigger] || 0) + 1; });
      const top = Object.entries(c).sort((a, b) => b[1] - a[1]);
      return [`${list.length} challenging moment${list.length > 1 ? 's' : ''} in the last 2 weeks.`, top.length ? `Most common triggers: ${top.slice(0, 3).map(([k, n]) => `${k} (${n})`).join(', ')}.` : 'Add the likely trigger when logging to see patterns.', top[0] ? triggerAdvice(top[0][0]) : ''].filter(Boolean);
    },
    async screenWeek() {
      let tot = 0; for (let i = 6; i >= 0; i--) tot += (await sumFor(dayKey(-i))).screenMin;
      return [`📱 Screen time in the last 7 days: ${fmtDur(tot)} (about ${fmtDur(tot / 7)} a day).`, tg.screenMax ? `Recommended maximum at ${P.his} age: ${tg.screenMax} min a day.` : 'Under 2 years, WHO and AAP advise avoiding screens (video calls are fine).'];
    },
    async activeWeek() {
      let out = 0, play = 0; for (let i = 6; i >= 0; i--) { const sm = await sumFor(dayKey(-i)); out += sm.outdoorMin; play += sm.playMin; }
      return [`🌳 Last 7 days: ${fmtDur(out)} outdoors and ${fmtDur(play)} of play.`, S.months < 12 ? 'Babies need active floor play several times a day.' : `Aim for about ${tg.activeMin} minutes of active play a day.`];
    },
  };
}

async function renderAsk() {
  const chat = await db.getKV('chat', []);
  const he = s => S.settings.sex === 'girl' ? s.replace(/\bhe\b/g, 'she').replace(/\bhis\b/g, 'her').replace(/\bhim\b/g, 'her') : s;
  const sug = askSuggestions(S.months).map(he);
  const bubble = m => m.role === 'me' ? `<div class="msg me">${esc(m.text)}</div>`
    : `<div class="msg bot ${m.urgent ? 'urgent' : ''} ${m.personal ? 'personal' : ''}"><b>${esc(m.title)}</b>${(m.lines || []).map(l => `<p>${esc(l)}</p>`).join('')}
      ${m.extra ? `<b>${esc(m.extra.title)}</b>${m.extra.lines.map(l => `<p>${esc(l)}</p>`).join('')}` : ''}
      ${m.note ? `<p class="muted small">${esc(m.note)}</p>` : ''}${m.src ? `<p class="muted small">Source: ${esc(m.src)}</p>` : ''}
      ${m.related?.length ? `<div class="chips rel">${m.related.map(q => `<button class="chip-btn ask-q" data-act="askQ" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}</div>`;
  main().innerHTML = `${backBar()}
    <h2>💬 Ask about ${esc(S.settings.name)}</h2>
    <p class="muted small">Offline helper with answers on sleep, food, health, growth, milestones, feelings, behaviour, school and teens, plus ${S.P.his} own logs. General guidance only — not a doctor. For emergencies call 108 / 112.</p>
    <div class="chat" id="chat">${chat.length ? chat.map(bubble).join('') : `<div class="msg bot"><b>Hi! 👋</b><p>Ask me anything about ${esc(S.settings.name)} — or tap a question below.</p></div>`}</div>
    <div class="chips sug">${sug.map(q => `<button class="chip-btn ask-q" data-act="askQ" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form id="askForm" class="ask-bar"><span class="with-mic"><input id="askInput" name="q" placeholder="Type or 🎤 speak your question…" autocomplete="off" aria-label="Your question">${micBtn('q')}</span><button class="btn primary">Ask</button></form>
    <details class="card"><summary><b>Browse topics</b></summary>${ASK_TOPICS.map(t => `<div class="label">${esc(t)}</div><div class="chips">${questionsFor(t, S.months).map(q => `<button class="chip-btn ask-q" data-act="askQ" data-q="${esc(he(q.replace(/\{him\}/g, 'him')))}">${esc(he(q.replace(/\{him\}/g, 'him')))}</button>`).join('')}</div>`).join('')}</details>
    ${chat.length ? '<button class="btn small" data-act="askClear">Clear chat</button>' : ''}`;
  $('#askForm').addEventListener('submit', ev => { ev.preventDefault(); const q = $('#askInput').value.trim(); if (q) askQuestion(q); });
  const box = $('#chat'); if (box.lastElementChild) box.lastElementChild.scrollIntoView({ block: 'nearest' });
}

async function askQuestion(q) {
  const res = await askAnswer(q, askContext());
  if (!res) return;
  const chat = (await db.getKV('chat', [])).concat([{ role: 'me', text: q, at: Date.now() }, { role: 'bot', ...res, at: Date.now() }]).slice(-60);
  await db.setKVQuiet('chat', chat);
  await renderAsk();
  $('#chat .msg.me:last-of-type')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// ------------------------------------------------------------------ MORE
function renderMore() {
  const cards = [
    ['ask', '💬', 'Ask', 'Parenting questions, offline'], ['routine', '🕒', 'Routine', `Timetable for ${S.P.his} age`], ['grow:milestones', '🎯', 'Milestones', `Tick what ${S.P.he} can do`],
    ['grow:memories', '✨', 'New things', 'Firsts & memories'], ['grow:trends', '📈', 'Trends', 'Sleep, food, play charts'],
    ['grow:physical', '📏', 'Physical growth', 'Monthly checks & WHO charts'], ['grow:foods', '🥕', 'Foods tried', 'Food diary & reactions'],
    ['grow:vaccines', '💉', 'Vaccines', 'Government schedule'], ['guide', '📖', 'Guide', 'Parenting library'],
    ['week', '📊', 'Weekly report', 'This week vs last week'], ['doctor', '🩺', 'Doctor summary', 'For the next visit, as PDF'],
    ['settings', '⚙️', 'Settings', 'Profile, backup, buttons'],
  ];
  main().innerHTML = `<h2>More</h2>
    <section class="more-grid">${cards.map(([v, i, t, s]) => {
      const [view, tab] = v.split(':');
      return `<button class="more-card" data-act="${tab ? 'goGrow' : 'view'}" data-view="${view}" ${tab ? `data-tab="${tab}"` : ''}><span>${i}</span><b>${t}</b><small>${s}</small></button>`;
    }).join('')}
    <button class="more-card" data-act="learn"><span>📚</span><b>Learning time</b><small>Today's books & ideas</small></button>
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
    <p class="muted small">${custom ? '<b>Your customised version.</b>' : `Shifted to ${S.P.his} usual wake-up time (${esc(S.settings.wake)}).`}</p>
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
    <p class="muted small">The app changes its timetable, targets, buttons, milestones and guidance automatically as ${S.P.he} grows.</p>
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
    <p class="muted small">Edit times, activities and durations. Saved for the ${esc(S.stage.name)} stage; when ${S.P.he} moves to the next stage you get a fresh recommended timetable.</p>
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
  const row = eiRowFor(S.months);
  const ageDays = (Date.now() - parseKey(S.settings.dob).getTime()) / 86400000;
  const week = S.months < 37 ? Math.min(4, Math.floor((S.months % 1) * 4.35) + 1) : Math.floor((ageDays % 365.25) / 7) + 1;
  const weekAct = row.acts[(week - 1) % row.acts.length];
  const todayKey = dateKey();
  const doneToday = (await db.byDate(todayKey)).filter(e => e.type === 'ei').map(e => e.data?.text);
  const rowAge = r => r.m != null ? (r.m === 0 ? 'Birth–1 m' : r.m < 24 ? `${r.m} m` : `${r.m} m (${(r.m / 12).toFixed(1).replace('.0', '')} y)`) : `${r.y - 1}–${r.y} y`;
  const groups = [['0–12 months', r => r.m != null && r.m <= 12], ['1–2 years (13–24 months)', r => r.m > 12 && r.m <= 24], ['2–3 years (25–36 months)', r => r.m > 24 && r.m <= 36], ['3–15 years (by year)', r => r.y != null]];
  const roadmap = groups.map(([name, f]) => {
    const rows = EI_ROADMAP.filter(f);
    const hasCur = rows.includes(row);
    return `<details class="card roadmap-ei" ${hasCur ? 'open' : ''}><summary><b>${name}</b>${hasCur ? ' <span class="badge now">now</span>' : ''}</summary>
      <div class="ei-table" role="table"><div class="ei-row ei-head" role="row"><span>Age</span><span>Teach / develop</span><span>Activities</span></div>
      ${rows.map(r => `<div class="ei-row ${r === row ? 'cur' : ''} ${(r.m != null ? r.m : r.y * 12) < Math.floor(S.months) && r !== row ? 'past' : ''}" role="row"><span class="ei-age">${esc(rowAge(r))}</span>
        <span><b>${esc(r.focus)}</b><br><small class="muted">${esc(r.develops)}</small></span><span><small>${r.acts.map(esc).join(' · ')}</small></span></div>`).join('')}</div></details>`;
  }).join('');
  main().innerHTML = `
    <h2>💛 Heart · feelings & behaviour</h2>
    <div class="row"><button class="btn primary grow" data-act="behaviour" data-kind="pos">💗 Kind moment</button><button class="btn grow" data-act="behaviour" data-kind="neg">🌋 Tough moment</button></div>
    <section class="card ei week-card"><div class="label">This week · ${esc(rowAge(row))} · week ${week}</div><h3>${esc(row.focus)}</h3>
      <p class="small muted">${esc(row.develops)}</p>
      <div class="week-act"><span>🎯</span><b>${esc(weekAct)}</b><button class="btn small ${doneToday.includes(weekAct) ? '' : 'primary'}" data-act="eidone" data-text="${esc(weekAct)}" ${doneToday.includes(weekAct) ? 'disabled' : ''}>${doneToday.includes(weekAct) ? '✓ Done today' : 'Did it today'}</button></div>
      <details><summary class="small"><b>More for this age (${st.ei.activities.length + row.acts.length})</b></summary><ul class="checklist">${[...row.acts, ...st.ei.activities].filter((a, i, arr) => arr.indexOf(a) === i).map(a => `<li><button class="btn small" data-act="eidone" data-text="${esc(a)}" ${doneToday.includes(a) ? 'disabled' : ''}>${doneToday.includes(a) ? '✓' : 'Did it'}</button> <span>${esc(a)}</span></li>`).join('')}</ul></details></section>
    <section class="card">${pairChart({ title: 'Last 14 days', data, names: ['Kind / positive', 'Challenging'] })}
      <p class="small">${ratio ? `Positive: <b>${pos.length}</b>, challenging: <b>${neg.length}</b> (≈${ratio} : 1). ` : `Positive moments noticed: <b>${pos.length}</b>. `}
      Notice and name many more good moments than you correct — what you pay attention to grows.</p></section>
    ${neg.length ? `<section class="card"><div class="label">Patterns</div>
      <p><b>Top triggers:</b> ${triggers.length ? triggers.slice(0, 4).map(([k, n]) => `${esc(k)} (${n})`).join(', ') : 'not recorded yet'}</p>
      <p><b>What calmed ${S.P.him} fastest:</b> ${worked.length ? worked.slice(0, 4).map(([k, n]) => `${esc(k)} (${n})`).join(', ') : 'log responses + outcome to learn this'}</p>
      ${triggers[0] ? `<p class="small muted">${esc(triggerAdvice(triggers[0][0]))}</p>` : ''}</section>` : ''}
    <details class="card"><summary><b>Behaviour at this age</b></summary><ul>${st.behaviour.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <button class="btn small" data-act="view" data-view="guide">Read the guides</button></details>
    <h2>🗺️ Emotional-intelligence roadmap</h2>
    <p class="muted small">What to teach at each age, month by month to 3 years and then year by year to 15. The highlighted row is ${S.P.his} age now; this week's practice above comes from it.</p>
    ${roadmap}
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
  const tabs = [['milestones', 'Milestones'], ['physical', 'Physical growth'], ['memories', 'New things'], ['trends', 'Trends'], ['foods', 'Foods'], ['vaccines', 'Vaccines']];
  if (S.growTab === 'growth') S.growTab = 'physical';
  const body = await ({ milestones: growMilestones, trends: growTrends, physical: growPhysical, foods: growFoods, vaccines: growVaccines, memories: growMemories })[S.growTab]();
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

async function growPhysical() {
  const sex = S.settings.sex;
  const m = S.months;
  const g = (await db.byType('growth')).sort((a, b) => a.start - b.start);
  const physState = await db.getKV('physical', {});
  const monthsAt = ms => ageMonths(S.settings.dob, ms, Number(S.settings.premature) || 0);
  const latest = k => [...g].reverse().find(e => e.data?.[k]);
  const fmtAge = mo => mo < 24 ? `${Math.round(mo)} m` : `${Math.round(mo / 12 * 10) / 10} y`;

  // 1) First-year month-by-month checks
  const curM = Math.min(12, Math.max(1, Math.floor(m))); // his age in completed months
  const monthBlock = row => {
    const done = row.items.filter((_, i) => physState[`${row.m}:${i}`]).length;
    return `<details class="card ms" ${row.m === curM && m <= 12.5 ? 'open' : ''}><summary><b>Month ${row.m}</b> <span class="muted">· ${done}/${row.items.length}</span>${row.m === curM && m <= 12.5 ? ' <span class="badge now">this month</span>' : ''}</summary>
      <p class="tip-line">📈 ${esc(row.growth)}</p>
      <ul class="checklist">${row.items.map((it, i) => { const k = `${row.m}:${i}`; return `<li><label class="check"><input type="checkbox" data-phys="${k}" ${physState[k] ? 'checked' : ''}> <span>${esc(it)}</span></label>${physState[k] ? `<span class="muted small ticked-date"> ✓ ${esc(fmtDateShort(physState[k]))}</span>` : ''}</li>`; }).join('')}</ul></details>`;
  };
  const firstYear = `<h3 class="sec-h">🍼 First year: month-by-month checks</h3>
    ${m <= 12.5 ? MONTHLY_PHYSICAL.filter(r => r.m === curM).map(monthBlock).join('') : ''}
    <details class="card"><summary><b>${m <= 12.5 ? 'All 12 months' : 'First-year checks (all 12 months)'}</b></summary>${MONTHLY_PHYSICAL.filter(r => !(m <= 12.5 && r.m === curM)).map(monthBlock).join('')}</details>`;

  // 2) WHO comparison charts
  const span = m < 24 ? [0, 24] : m < 60 ? [0, 60] : [Math.max(60, Math.floor(m) - 48), Math.min(228, Math.ceil(m) + 24)];
  const chartFor = ind => {
    const info = INDICATORS[ind];
    const x1 = Math.min(span[1], info.maxMonth), x0 = Math.min(span[0], x1 - 12);
    if (x1 <= x0) return '';
    const xs = []; for (let x = x0; x <= x1; x += (x1 - x0) > 60 ? 3 : 1) xs.push(x);
    const band = z => xs.map(x => whoValue(ind, sex, x, z));
    const pts = g.filter(e => e.data?.[info.key]).map(e => ({ x: monthsAt(e.start), v: e.data[info.key], label: `${fmtDateShort(e.date)} (${fmtAge(monthsAt(e.start))})` })).filter(p => p.x >= x0 && p.x <= x1);
    const last = latest(info.key);
    let verdict = '<p class="muted small">No measurement yet — add one below.</p>';
    if (last) {
      const z = zScore(ind, sex, monthsAt(last.start), last.data[info.key]);
      const [cls, txt] = zLabel(z);
      verdict = z == null ? '' : `<p class="verdict"><span class="badge ${cls}">${cls === 'ok' ? '✓' : '!'} ${percentile(z)}th percentile</span> ${esc(last.data[info.key])} ${info.unit} on ${esc(fmtDateShort(last.date))} · ${esc(txt)}</p>`;
    }
    return growthChart({ title: `${info.label} (${info.unit}) — ${S.settings.name} vs WHO ${sex === 'girl' ? 'girls' : 'boys'}`, unit: info.unit, xs,
      lo3: band(-3), lo2: band(-2), med: band(0), hi2: band(2), hi3: band(3), pts, xLabel: x => x < 24 ? `${Math.round(x)}m` : `${Math.round(x / 12)}y` }) + verdict;
  };
  const charts = `<h3 class="sec-h">📊 Compare with WHO standards</h3>
    <button class="btn primary wide" data-act="form" data-type="growth">＋ Add weight / height / head</button>
    ${chartFor('wfa')}${chartFor('hfa')}${m < 60 ? chartFor('hca') : ''}
    <p class="muted small">Most healthy children are inside the darker band. Following their own curve steadily matters more than one reading. Weight-for-age charts stop at 10 years (WHO).</p>`;

  // 3) Standard readings table (first year by month, then by year), with the child's nearest reading
  const nearest = (k, mo) => { let best = null; for (const e of g) { if (!e.data?.[k]) continue; const d = Math.abs(monthsAt(e.start) - mo); if (d <= (mo < 24 ? 0.75 : 4) && (!best || d < best.d)) best = { d, v: e.data[k] }; } return best?.v; };
  const cell = (ind, mo, k) => {
    const med = whoValue(ind, sex, mo, 0); if (med == null) return ['—', ''];
    const lo = whoValue(ind, sex, mo, -2), hi = whoValue(ind, sex, mo, 2);
    const v = nearest(k, mo);
    const z = v != null ? zScore(ind, sex, mo, v) : null;
    const mark = v == null ? '' : `<b class="${Math.abs(z) <= 2 ? 'ok-t' : 'warn-t'}">${v}${Math.abs(z) <= 2 ? ' ✓' : ' !'}</b>`;
    return [`${med.toFixed(1)}<br><small class="muted">${lo.toFixed(1)}–${hi.toFixed(1)}</small>`, mark];
  };
  const rowsAges = [...(m < 30 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : []), ...Array.from({ length: 15 }, (_, i) => (i + 1) * 12).filter(x => m < 30 ? x > 12 : true)];
  const table = `<h3 class="sec-h">📋 Standard readings (WHO median, normal range)</h3>
    <div class="tbl-wrap"><table class="std"><thead><tr><th>Age</th><th>Weight kg</th><th>${S.P.His}</th><th>Height cm</th><th>${S.P.His}</th>${m < 60 ? `<th>Head cm</th><th>${S.P.His}</th>` : ''}</tr></thead><tbody>
    ${rowsAges.map(mo => { const w = cell('wfa', mo, 'weight'), h = cell('hfa', mo, 'height'), hc = cell('hca', mo, 'head');
      return `<tr class="${Math.abs(mo - m) < (mo < 13 ? 0.5 : 6) ? 'now-row' : ''}"><td><b>${mo === 0 ? 'Birth' : mo < 13 ? mo + ' m' : mo / 12 + ' y'}</b></td><td>${w[0]}</td><td>${w[1]}</td><td>${h[0]}</td><td>${h[1]}</td>${m < 60 ? `<td>${hc[0]}</td><td>${hc[1]}</td>` : ''}</tr>`; }).join('')}
    </tbody></table></div>
    <p class="muted small">Normal range = WHO −2 SD to +2 SD (about the 2nd to 98th percentile) for ${sex === 'girl' ? 'girls' : 'boys'}. ✓ = ${S.P.his} reading near that age is in range.</p>`;
  const teeth = S.months < 36 ? `<p>🦷 Teeth logged: <b>${(await db.byType('tooth')).length}</b> <button class="btn small" data-act="form" data-type="tooth">＋ New tooth</button></p>` : '';
  return (m <= 15 ? firstYear + charts : charts) + table + teeth + (m > 15 ? firstYear : '');
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
  return `<p class="ok-note">🇮🇳 <b>Government schedule (Universal Immunization Programme)</b> — these vaccines are given <b>free</b> at government hospitals, PHCs and anganwadi sessions. * JE only in districts where it is common. Always follow the dates on ${S.P.his} Mother & Child Protection (MCP) card.</p>
    <ul class="vax">${UIP_VACCINES.map(v => {
      const due = new Date(dob); due.setDate(due.getDate() + Math.round(v.at * 30.4375));
      const key = `uip:${v.at}`, dk = dateKey(due), done = state[key];
      const status = done ? ['ok', '✓ Given'] : dk < dateKey() ? ['high', '! Due / overdue'] : (due - Date.now()) < 45 * 86400000 ? ['now', 'Coming up'] : ['', 'Later'];
      return `<li><label class="check"><input type="checkbox" data-vax="${key}" ${done ? 'checked' : ''}>
        <span><b>${esc(v.label)}</b> — ${esc(v.name)}<br><span class="muted small">${done ? 'given ' + esc(fmtDateShort(done)) : 'due around ' + esc(fmtDateShort(dk))}</span></span></label>
        <span class="badge ${status[0]}">${status[1]}</span></li>`;
    }).join('')}</ul>
    <p class="muted small">Source: Ministry of Health & Family Welfare, National Immunization Schedule. Private clinics may suggest extra optional vaccines; those are not listed here.</p>`;
}

async function growMemories() {
  const list = (await db.byType('memory')).sort((a, b) => b.start - a.start);
  return `<button class="btn primary wide" data-act="form" data-type="memory" data-first="1">✨ Add a new thing ${S.P.he} did</button>
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

// ------------------------------------------------------------------ SETTINGS (split into sections)
const SETTINGS_SECTIONS = [
  ['profile', '👶', 'Child profile', 'Name, birthday, boy/girl, wake-up time'],
  ['children', '👨‍👩‍👧‍👦', 'Children', 'Add or switch between children'],
  ['family', '👪', 'Family & voice', 'Caregivers, who is logging, voice language'],
  ['reminders', '⏰', 'Reminders & alarms', 'Learning time, nap, feeds, medicines'],
  ['display', '🎨', 'Look & theme', 'Light / dark mode, age theme'],
  ['backup', '☁️', 'Online backup', 'Google Sheet & Drive'],
  ['data', '💾', 'Files & data', 'Backup file, CSV, sample data, erase'],
  ['install', '📲', 'Install app', 'Add to home screen'],
  ['about', 'ℹ️', 'About', 'Privacy & sources'],
];

async function renderSettings() {
  const tab = S.settingsTab;
  if (!tab) {
    main().innerHTML = `${backBar()}<h2>Settings</h2>
      <section class="more-grid">${SETTINGS_SECTIONS.filter(([k]) => k !== 'install' || !isStandalone()).map(([k, i, t, d]) =>
        `<button class="more-card" data-act="settingsTab" data-tab="${k}"><span>${i}</span><b>${t}</b><small>${d}</small></button>`).join('')}</section>`;
    return;
  }
  const back = `<button class="back" data-act="settingsTab" data-tab="">‹ Settings</button>`;
  const s = S.settings;
  const title = SETTINGS_SECTIONS.find(x => x[0] === tab);
  let body = '';
  if (tab === 'profile') body = `<form id="profileForm" class="card">
      <label>Child's name<input name="name" value="${esc(s.name)}" required></label>
      <fieldset><legend>Boy or girl (used for the wording in guidance and WHO growth charts)</legend><div class="chips">
        ${[['boy', '👦 Boy'], ['girl', '👧 Girl']].map(([v, l]) => `<label class="chip"><input type="radio" name="sex" value="${v}" ${s.sex === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="row two"><label>Date of birth<input type="date" name="dob" value="${esc(s.dob)}" max="${dateKey()}" required></label>
      <label>Usual wake-up<input type="time" name="wake" value="${esc(s.wake)}"></label></div>
      <label>Born early by (weeks) <span class="muted small">— corrected age is used until 2 years if 3+ weeks</span><input type="number" name="premature" min="0" max="16" value="${esc(s.premature || 0)}"></label>
      <button class="btn primary">Save</button></form>`;
  if (tab === 'children') body = `<section class="card"><ul class="kids">${S.children.map(c => `<li class="${c.id === S.child ? 'current' : ''}">
      <span class="avatar small">${esc((c.name || '?')[0].toUpperCase())}</span><b>${esc(c.name || 'Child')}</b>${c.id === S.child ? '<span class="badge now">open now</span>' : `<button class="btn small" data-act="switchChild" data-id="${c.id}">Open</button>`}
      ${c.id !== 'main' ? `<button class="icon-btn" data-act="removeChild" data-id="${c.id}" aria-label="Remove ${esc(c.name)}">🗑️</button>` : ''}</li>`).join('')}</ul>
      <button class="btn primary wide" data-act="addChild">＋ Add another child</button>
      <p class="muted small">Each child has their own logs, timetable, milestones, health records and theme. Tap the name at the top of any screen to switch.</p></section>`;
  if (tab === 'family') body = `<form id="familyForm" class="card">
      <label>Caregivers (comma separated)<input name="caregivers" value="${esc(s.caregivers.join(', '))}"></label>
      <label>I am<select name="me">${s.caregivers.map(c => `<option ${c === s.me ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Voice language<select name="voiceLang">${[['en-IN', 'English (India)'], ['ta-IN', 'Tamil'], ['hi-IN', 'Hindi'], ['en-US', 'English (US)']].map(([v, l]) => `<option value="${v}" ${v === s.voiceLang ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn primary">Save</button></form>`;
  if (tab === 'display') body = `<form id="displayForm" class="card">
      <fieldset><legend>Light or dark</legend><div class="chips">${[['auto', '📱 Automatic'], ['light', '☀️ Light'], ['dark', '🌙 Dark']].map(([v, l]) => `<label class="chip"><input type="radio" name="theme" value="${v}" ${v === s.theme ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="theme-now"><span class="big-emoji">${S.theme.emoji}</span><div><b>${esc(S.theme.label)}: ${esc(S.theme.name)}</b><br><small>${esc(S.theme.about)}</small></div></div>
      <p class="muted small">The colours change automatically every month until the first birthday, then with each age stage.</p>
      <button class="btn primary">Save</button></form>`;
  if (tab === 'backup') body = await backupSection();
  if (tab === 'reminders') body = remindersSection().replace('<!--bell-->', await bellSection());
  if (tab === 'data') body = `<section class="card"><div class="label">Data on this phone for ${esc(s.name)}: ${(await db.all()).length} entries</div>
      <div class="row wrap"><button class="btn" data-act="export">⬇️ Backup file</button><button class="btn" data-act="csv">⬇️ Export CSV</button>
      <label class="btn">⬆️ Restore file<input type="file" id="importFile" accept="application/json" hidden></label></div>
      <div class="row wrap"><button class="btn" data-act="demo">Load sample data</button><button class="btn danger" data-act="wipe">Erase this child's data</button></div></section>
    <section class="card"><div class="label">🧹 Delete old entries</div>
      <p class="muted small">Removes ${esc(s.name)}'s log entries (feeds, sleep, play, health logs…) that started before this time. Settings, timetable and milestone ticks are kept. Deleted entries are also removed from the Google backup at the next sync.</p>
      <label>Delete everything before<input type="datetime-local" id="cutAt" value="2026-11-23T16:00"></label>
      <div class="row wrap"><button class="btn danger" data-act="cutOld">🗑️ Delete entries before this</button>${(await db.all()).some(e => e.demo) ? '<button class="btn" data-act="cutDemo">Remove sample data only</button>' : ''}</div></section>`;
  if (tab === 'install') body = `<section class="card install-card"><div><b>📲 Install ${APP_NAME} as an app</b><br><small>Gets its own icon on the home screen and opens full screen like any other app.</small></div><button class="btn primary small" data-act="install">Install</button></section>`;
  if (tab === 'about') body = `<section class="card small"><b>${APP_NAME}</b> is a personal, offline-first app. Data only leaves the phone if you turn on the online backup, and then it goes only to your own Google Sheet and Drive.
      Voice typing uses your phone browser's built-in speech service. Growth charts use the WHO Child Growth Standards (0–5 years) and WHO Growth Reference 2007 (5–19 years). Vaccines follow India's Universal Immunization Programme. Guidance is based on WHO, AAP/AASM, CDC, IAP, the Gottman Institute and Harvard's Center on the Developing Child — always follow your paediatrician.</section>`;
  main().innerHTML = `${back}<h2>${title[1]} ${title[2]}</h2>${body}`;
  const onSave = (id, fn) => $(id)?.addEventListener('submit', async ev => { ev.preventDefault(); await fn(new FormData(ev.target)); await db.setKV('settings', S.settings); await saveChildrenList(); applyTheme(); await refreshAge(); toast('Saved ✓'); route(); });
  onSave('#profileForm', fd => { S.settings = { ...S.settings, name: fd.get('name').trim(), sex: fd.get('sex') || 'boy', dob: fd.get('dob'), wake: fd.get('wake') || '06:30', premature: Number(fd.get('premature')) || 0 }; });
  onSave('#familyForm', fd => {
    const caregivers = String(fd.get('caregivers')).split(',').map(x => x.trim()).filter(Boolean);
    S.settings = { ...S.settings, caregivers: caregivers.length ? caregivers : ['Parent'], me: caregivers.includes(fd.get('me')) ? fd.get('me') : caregivers[0], voiceLang: fd.get('voiceLang') || 'en-IN' };
  });
  onSave('#remForm', async fd => {
    const on = fd.get('on') === 'on';
    if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* ignore */ } }
    S.settings = { ...S.settings, rem: { ...remCfg(), on, learn: fd.get('learn') === 'on', learnAt: fd.get('learnAt') || '09:00', nap: fd.get('nap') === 'on',
      feedHrs: Number(fd.get('feedHrs')) || 0, meds: fd.get('meds') === 'on', vax: fd.get('vax') === 'on', custom: fd.get('custom') || '' } };
  });
  onSave('#displayForm', fd => { S.settings = { ...S.settings, theme: fd.get('theme') || 'auto' }; });
  $('#syncForm')?.addEventListener('submit', onSyncSubmit);
  $('#clientIdForm')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const cid = new FormData(ev.target).get('cid').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(cid)) return alert('That does not look like a Client ID. It ends with .apps.googleusercontent.com');
    await setDriveConfig({ ...(await getDriveConfig()), clientId: cid });
    toast('Saved ✓ Now tap "Sign in with Google"'); route();
  });
}

async function backupSection() {
  const d = await getDriveConfig(), ds = await getDriveState();
  const cfg = await getConfig(), st = await getState(), pend = cfg.enabled ? await pendingCount() : 0;
  const clientId = clientIdFor(d);
  const signedIn = d.enabled && d.email;
  const drive = `<section class="card drive-card">
      <div class="row between"><div class="label">🟢 Google Drive — recommended</div>${signedIn ? '<span class="badge ok">On</span>' : ''}</div>
      <p class="small">Sign in with your Gmail and everything — every child, every log and photo — is saved in a <b>"Happy Parenthood Backup"</b> folder in <b>that account's Google Drive</b>. Sign in with the same Gmail on another phone (e.g. Appa's) and both phones stay in sync.</p>
      ${signedIn ? `<p class="small">Signed in as <b>${esc(d.email)}</b>${ds.lastSync ? ` · last sync ${esc(new Date(ds.lastSync).toLocaleString())}` : ''}${ds.lastError ? `<br><span class="err-text">⚠ ${esc(ds.lastError)}</span>` : ''}</p>
        <div class="row wrap"><button type="button" class="btn primary" data-act="driveSyncNow">🔄 Sync now</button><button type="button" class="btn" data-act="driveSignOut">Sign out</button></div>
        <p class="muted small">For your privacy, Google lets a web app stay signed in for about an hour at a time. If ☁️ at the top says <b>Tap to sync</b>, tap it once — no data is lost meanwhile.</p>`
      : clientId ? `<button type="button" class="btn google wide" data-act="driveSignIn"><span class="g-logo">G</span> Sign in with Google</button>
        <p class="muted small">The app can only see the files it creates in your Drive — nothing else.</p>`
      : `<p class="warn small">One-time setup needed: Google requires every app to be registered before "Sign in with Google" works.</p>
        <details open><summary class="small"><b>One-time setup (about 10 minutes)</b></summary><ol class="small">
          <li>On a computer, open <b>console.cloud.google.com</b> and sign in with your Gmail. Create a project named <i>Happy Parenthood</i>.</li>
          <li><b>APIs & Services → Library</b> → search <b>Google Drive API</b> → <b>Enable</b>.</li>
          <li><b>Google Auth Platform → Branding</b> (OAuth consent screen): app name <i>Happy Parenthood</i>, your email as support & developer contact. <b>Audience</b>: External → then press <b>Publish app</b> (the app only asks for the non-sensitive "drive.file" permission, so no Google review is needed).</li>
          <li><b>Clients → Create client</b> → type <b>Web application</b> → under <b>Authorized JavaScript origins</b> add <code>${esc(location.origin)}</code> → Create.</li>
          <li>Copy the <b>Client ID</b> (ends with <code>.apps.googleusercontent.com</code>) and paste it below.</li></ol></details>
        <form id="clientIdForm" class="row"><input name="cid" placeholder="xxxx.apps.googleusercontent.com" aria-label="Google OAuth Client ID"><button class="btn primary">Save</button></form>`}
    </section>`;
  return drive + `<details class="card" ${cfg.enabled ? 'open' : ''}><summary><b>📊 Google Sheet backup (advanced, optional)</b></summary>
    <form id="syncForm">
      <p class="small">Every entry (and photo) of every child is copied to your Google Sheet / Drive automatically whenever the phone is online. When offline, changes wait safely and upload later.</p>
      <p class="small"><b>Status:</b> ${cfg.enabled ? (pend ? `${pend} change(s) waiting` : 'all backed up ✓') : 'off'}${st.lastSync ? ` · last backup ${esc(new Date(st.lastSync).toLocaleString())}` : ''}${st.lastError ? `<br><span class="err-text">⚠ ${esc(st.lastError)}</span>` : ''}
        ${cfg.enabled && st.photosUnsupported ? `<br><span class="err-text">📷 Photos are not backed up yet — update the Apps Script (steps below) and press Save & test.</span>` : ''}</p>
      <label>Web app URL<input name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(cfg.url)}"></label>
      <label>Secret phrase (same as in the script)<input name="token" type="password" autocomplete="off" value="${esc(cfg.token)}"></label>
      <label class="check"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Back up automatically</label>
      <div class="row wrap"><button class="btn primary">Save & test</button>
        <button type="button" class="btn" data-act="syncAll" ${cfg.enabled ? '' : 'disabled'}>⬆️ Back up everything now</button>
        <button type="button" class="btn" data-act="syncRestore" ${cfg.enabled ? '' : 'disabled'}>⬇️ Restore from Google Sheet</button></div>
      <details><summary class="small">How to set it up / update it</summary><ol class="small">
        <li>Open your backup Google Sheet → <b>Extensions → Apps Script</b>.</li>
        <li>Select all old code, delete it, paste the code from <code>google-sheets-backup/Code.gs</code>, put your secret phrase in <code>SECRET</code>, Save.</li>
        <li>Choose <b>setup</b> in the function list → <b>▶ Run</b> → allow all permissions.</li>
        <li><b>Deploy → Manage deployments → ✏️</b> → Who has access: <b>Anyone</b> → Version: <b>New version</b> → Deploy. (First time: Deploy → New deployment → Web app.)</li>
        <li>Paste the <code>/exec</code> URL and secret here and press <b>Save & test</b>.</li></ol></details>
    </form></details>`;
}

async function onSyncSubmit(ev) {
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
  setBackends({ sheet: next.enabled });
  if (!next.enabled) { toast('Google Sheet backup turned off'); return route(); }
  toast('Testing connection…');
  try {
    const r = await testConnection(next);
    const st2 = await getState();
    if (r.count > 0 && !st2.lastSync && confirm(`Your sheet "${r.sheet}" already has ${r.count} entries. Restore them to this phone first? (Recommended on a new phone)`)) {
      const n = await restoreFromSheet();
      S.children = await childrenList();
      await selectChild(S.child, false);
      toast(`✓ Restored ${n} entries`);
    }
    toast(`✓ Connected to "${r.sheet}". Backing up…`);
    await syncNow({ silent: false });
    toast(r.photos ? '✓ Backup complete (with photos)' : '✓ Backup complete. Update the script to also back up photos.');
  } catch (err) { alert('Could not connect: ' + err.message); }
  route();
}

// Add / switch / remove children
function openChildren() {
  openSheet(`<div class="sheet-hd"><h3>👨‍👩‍👧‍👦 Children</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <ul class="kids">${S.children.map(c => `<li class="${c.id === S.child ? 'current' : ''}" data-act="switchChild" data-id="${c.id}">
      <span class="avatar small">${esc((c.name || '?')[0].toUpperCase())}</span><b>${esc(c.name || 'Child')}</b>${c.id === S.child ? '<span class="badge now">open</span>' : '<span class="muted">Open ›</span>'}</li>`).join('')}</ul>
    <button class="btn primary wide" data-act="addChild">＋ Add another child</button>`, { focus: false });
}

function openAddChild() {
  openSheet(`<form id="childForm"><div class="sheet-hd"><h3>＋ Add a child</h3><button type="button" class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <label>Name<input name="name" required></label>
    <fieldset><legend>Boy or girl</legend><div class="chips">${[['boy', '👦 Boy'], ['girl', '👧 Girl']].map(([v, l], i) => `<label class="chip"><input type="radio" name="sex" value="${v}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <div class="row two"><label>Date of birth<input type="date" name="dob" required max="${dateKey()}"></label><label>Usual wake-up<input type="time" name="wake" value="06:30"></label></div>
    <label>Born early by (weeks)<input type="number" name="premature" value="0" min="0" max="16"></label>
    <div class="row actions"><button class="btn primary">Add child</button></div></form>`, { focus: false });
  $('#childForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const id = 'c' + uid();
    const settings = { ...DEFAULT_SETTINGS, caregivers: S.settings.caregivers, me: S.settings.me, voiceLang: S.settings.voiceLang, theme: S.settings.theme,
      name: fd.get('name').trim(), sex: fd.get('sex') || 'boy', dob: fd.get('dob'), wake: fd.get('wake') || '06:30', premature: Number(fd.get('premature')) || 0 };
    S.children = [...S.children, { id, name: settings.name }];
    await mainDb.setKV('children', S.children);
    useDb(childDbName(id));
    await db.setKV('settings', settings);
    await db.setKV('lastStage', stageFor(ageMonths(settings.dob, Date.now(), settings.premature)).id);
    closeSheet();
    await selectChild(id);
    toast(`👶 ${settings.name} added`);
  });
}

async function removeChild(id) {
  const c = S.children.find(x => x.id === id);
  if (!c || id === 'main') return;
  if (!confirm(`Remove ${c.name || 'this child'} and all their logs from this phone? (Anything already backed up stays in your Google Sheet.)`)) return;
  if (prompt('Type DELETE to confirm') !== 'DELETE') return;
  S.children = S.children.filter(x => x.id !== id);
  await mainDb.setKV('children', S.children);
  await deleteDatabase(childDbName(id));
  if (S.child === id) await selectChild('main', false);
  toast('Removed'); route();
}

function renderOnboarding() {
  $('#hdr').innerHTML = '';
  document.body.classList.add('onboarding');
  main().innerHTML = `<section class="onboard">
    <div class="ob-hero"><img src="icons/icon-192.png" alt="" width="88" height="88" class="ob-logo"><h1>${APP_NAME}</h1>
    <p>Your child's day, health and growth in one place — with a timetable, milestones and guidance that grow with them from baby to teen.</p></div>
    <form id="obForm" class="card">
      <label>Child's name<input name="name" required placeholder="e.g. Aadhi"></label>
      <fieldset><legend>Boy or girl</legend><div class="chips">${[['boy', '👦 Boy'], ['girl', '👧 Girl']].map(([v, l], i) => `<label class="chip"><input type="radio" name="sex" value="${v}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
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
    S.settings = { ...DEFAULT_SETTINGS, name: fd.get('name').trim(), sex: fd.get('sex') || 'boy', dob: fd.get('dob'), premature: Number(fd.get('premature')) || 0, wake: fd.get('wake') || '06:30', me, caregivers };
    await db.setKV('settings', S.settings);
    S.children = [{ id: S.child, name: S.settings.name }, ...S.children.filter(c => c.id !== S.child)];
    await mainDb.setKV('children', S.children);
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
  // growth readings (roughly on the WHO median curve) for the charts
  [[0, 3.3, 50, 34.5], [1, 4.4, 54.5, 37], [2, 5.6, 58.4, 39], [4, 7.0, 63.9, 41.5], [6, 7.9, 67.6, 43.3], [9, 8.9, 72, 45]].forEach(([mo, w, h, hc]) => {
    const d = parseKey(S.settings.dob); d.setDate(d.getDate() + Math.round(mo * 30.4375));
    if (d.getTime() <= Date.now()) add('growth', dateKey(d), '10:00', null, { weight: w, height: h, head: hc });
  });
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

// What can happen at the same time. A child can't feed or play while asleep, so when a
// new timed activity starts, any running one that can't go with it ends at that exact
// moment and the timeline carries on from it. Pairs listed here are left running together.
// Sleep and nap go with nothing; bonding/talk time goes with anything done awake.
const SLEEPY = ['sleep', 'nap'];
const TOGETHER = {
  meal: ['play', 'walk', 'reading', 'screen', 'study', 'homework'], // eating while playing, on a walk, at story time, with homework
  breastfeed: ['reading'],          // songs / a story while nursing, but not while playing or on the move
  play: ['meal', 'floor', 'walk', 'bath'], // floor play, playground on a walk, water play in the bath
  floor: ['play'],
  walk: ['meal', 'play', 'exercise'],
  bath: ['play'],                   // no eating or napping in the bath
  reading: ['meal', 'breastfeed'],
  study: ['meal'], homework: ['meal'], screen: ['meal'], exercise: ['walk'],
};
function canOverlap(a, b) {
  if (!a || !b || a === b) return false;
  if (SLEEPY.includes(a) || SLEEPY.includes(b)) return false;
  if (a === 'bond' || b === 'bond') return true;
  return !!(TOGETHER[a]?.includes(b) || TOGETHER[b]?.includes(a));
}
async function endRunningAt(at, exceptId = null, newType = null) {
  const stopped = [];
  for (const r of await db.all()) {
    if (r.id === exceptId || r.end || !r.start || !typeInfo(r.type).timed || r.start > at || canOverlap(newType, r.type)) continue;
    r.end = at; await db.put(r); stopped.push(r);
  }
  return stopped;
}
const resume = async list => { for (const r of list) { r.end = null; await db.put(r); } };
const stoppedText = list => list.map(r => `${typeInfo(r.type).icon} ${typeInfo(r.type).label} ended (${fmtDur(entryMinutes(r))})`).join(' · ');

// One-tap timer: first tap starts, second tap stops and logs the duration.
async function toggleTimer(type, opts = {}) {
  const t = typeInfo(type);
  const running = (await db.byType(type)).find(e => !e.end);
  // Breastfeeding: ask which side when starting; offer "switch side" while feeding
  if (type === 'breastfeed' && !opts.side && !opts.stop) return running ? askBreastRunning(running) : askBreastSide();
  if (running) {
    running.end = Date.now();
    await db.put(running);
    const mins = entryMinutes(running);
    route();
    if (type === 'meal') { toast(`🥣 Eating time: ${fmtDur(mins)} — add what ${S.P.he} ate`); return openForm('meal', running, { focusFoods: true, noFocus: true }); }
    if (type === 'sleep') { toast(`🌙 Night sleep: ${fmtDur(mins)}`, [['Undo', async () => { running.end = null; await db.put(running); closeSheet(); route(); }]]); return openMorning(running); }
    return toast(`${t.icon} ${t.label}: ${fmtDur(mins)} (${fmtTime(running.start)}–${fmtTime(running.end)})`, [
      ['Undo', async () => { running.end = null; await db.put(running); route(); }],
      ['Add details', () => openForm(type, running)]]);
  }
  const now = Date.now();
  const stopped = await endRunningAt(now, null, type);
  const e = { id: uid(), type, start: now, end: null, date: dateKey(now), data: opts.side ? { side: opts.side } : {}, note: '', by: S.settings.me, createdAt: now };
  await db.put(e);
  route();
  const along = (await db.all()).filter(r => r.id !== e.id && !r.end && r.start && typeInfo(r.type).timed);
  toast(`${t.icon} ${t.label} started at ${fmtTime(now)}${stopped.length ? ` · ${stoppedText(stopped)}` : ''}${along.length ? ` · ${along.map(r => typeInfo(r.type).icon + ' ' + typeInfo(r.type).label).join(', ')} still on` : ''}`, [
    ['Undo', async () => { await db.del(e.id); await resume(stopped); route(); }]]);
}

async function askBreastSide() {
  const last = (await db.byType('breastfeed')).sort((a, b) => b.start - a.start)[0];
  const ls = last?.data?.side;
  const suggest = ls === 'Left' ? 'Right' : ls === 'Right' ? 'Left' : null;
  openSheet(`<div class="sheet-hd"><h3>🤱 Which side?</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    ${last ? `<p class="small muted">Last feed: ${esc(ls || 'side not noted')} · ${fmtTime(last.start)} (${esc(agoText(last.start))})${suggest ? ` — try <b>${suggest}</b> this time.` : ''}</p>` : ''}
    <div class="side-pick">${['Left', 'Right', 'Both'].map(sd => `<button class="side-btn ${sd === suggest ? 'suggested' : ''}" data-act="bfStart" data-side="${sd}"><span>${sd === 'Left' ? '⬅️' : sd === 'Right' ? '➡️' : '↔️'}</span><b>${sd}</b>${sd === suggest ? '<small>suggested</small>' : ''}</button>`).join('')}</div>
    <p class="muted small">The timer starts as soon as you pick a side.</p>`, { focus: false });
}
function askBreastRunning(run) {
  const other = run.data?.side === 'Left' ? 'Right' : run.data?.side === 'Right' ? 'Left' : null;
  openSheet(`<div class="sheet-hd"><h3>🤱 Feeding · ${esc(run.data?.side || '')} · <span data-since="${run.start}">${fmtDur(entryMinutes(run))}</span></h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <div class="side-pick">
      <button class="side-btn stop" data-act="bfStop"><span>⏹️</span><b>Stop feed</b></button>
      ${other ? `<button class="side-btn" data-act="bfSwitch" data-side="${other}"><span>🔄</span><b>Switch to ${other}</b><small>ends ${esc(run.data.side)}, starts ${other}</small></button>` : ''}
    </div>`, { focus: false });
}
function agoText(ms) {
  const m = Math.max(0, (Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  return `${fmtDur(m)} ago`;
}

// "Last feed 2h 15m ago" strip on Home for babies and toddlers
async function lastFeedStrip() {
  if (S.months >= 36) return '';
  const feeds = [...await db.byType('breastfeed'), ...await db.byType('bottle')].sort((a, b) => b.start - a.start);
  const meals = S.months >= 5 ? (await db.byType('meal')).sort((a, b) => b.start - a.start) : [];
  const f = feeds[0], m = meals[0];
  if (!f && !m) return '';
  const feedTxt = !f ? '' : !f.end && f.type === 'breastfeed'
    ? `<span class="lf"><b>🤱 Feeding now</b> ${esc(f.data?.side || '')} · <span data-since="${f.start}">${fmtDur(entryMinutes(f))}</span></span>`
    : `<span class="lf">${f.type === 'bottle' ? '🍼' : '🤱'} Last feed <b data-ago="${f.start}">${esc(agoText(f.start))}</b> <small>${fmtTime(f.start)}${f.data?.side ? ' · ' + esc(f.data.side) : ''}${f.data?.amount ? ' · ' + esc(f.data.amount) + ' ml' : ''}</small></span>`;
  const mealTxt = m ? `<span class="lf">🥣 Last meal <b data-ago="${m.start}">${esc(agoText(m.start))}</b></span>` : '';
  return `<section class="last-feed" aria-live="polite">${feedTxt}${mealTxt}</section>`;
}

// ------------------------------------------------------------------ WAKE WINDOW ("next nap")
async function lastWakeAt() {
  const sleeps = [...await db.byType('sleep'), ...await db.byType('nap')];
  if (sleeps.some(e => !e.end)) return { asleep: true };
  const ends = sleeps.map(e => e.end).filter(Boolean);
  const wakes = (await db.byType('wake')).map(e => e.start);
  const t = Math.max(0, ...ends, ...wakes);
  return t && Date.now() - t < 16 * 3600000 ? { at: t } : {};
}
async function wakeInfo() {
  const win = wakeWindowFor(S.months);
  if (!win) return null;
  const w = await lastWakeAt();
  if (!w.at) return null;
  const awake = (Date.now() - w.at) / 60000;
  if (awake > win[1] + 180) return null; // a sleep was probably not logged
  const evening = new Date().getHours() >= 17;
  return { at: w.at, awake, lo: win[0], hi: win[1], what: evening ? 'sleep' : 'nap',
    state: awake < win[0] ? 'early' : awake <= win[1] ? 'due' : 'over' };
}
async function wakeStrip() {
  const w = await wakeInfo();
  if (!w) return '';
  const from = fmtTime(w.at + w.lo * 60000), to = fmtTime(w.at + w.hi * 60000);
  const msg = w.state === 'early' ? `Next ${w.what} around <b>${from}–${to}</b>`
    : w.state === 'due' ? `<b>${w.what === 'nap' ? 'Nap' : 'Sleep'} time now</b> · watch for yawns and eye-rubbing`
    : `<b>Past ${S.P.his} usual awake time</b> · try to settle ${S.P.him} soon`;
  return `<section class="wake-strip ${w.state}" aria-live="polite"><span>🌤️ Awake <b data-since="${w.at}">${fmtDur(w.awake)}</b></span><span>${msg}</span></section>`;
}

// ------------------------------------------------------------------ LEARNING TIME + MORNING
const remCfg = () => ({ on: false, learnAt: '09:00', learn: true, nap: true, feedHrs: 0, meds: true, vax: true, custom: '', ...(S.settings.rem || {}) });
const fillName = s => s.replace(/\{name\}/g, S.settings.name || 'baby');
function learningPicks(salt = 0) {
  const L = learningFor(S.months), d = dayOfYear() + salt * 3;
  const at = (arr, k = 0) => arr[(d + k) % arr.length];
  return { type: at(L.types), books: [at(L.books), L.books.length > 1 ? at(L.books, Math.ceil(L.books.length / 2)) : null].filter(Boolean),
    material: at(L.materials), rhyme: at(L.rhymes), morning: fillName(at(L.morning)) };
}
const todaysEi = () => pickDaily(S.stage.ei.activities, 0);
async function learnedToday(after = 0) {
  return (await db.byDate(dateKey())).some(e => ['study', 'reading', 'homework'].includes(e.type) && e.start >= after);
}
async function learningCard() {
  const r = remCfg();
  if (!r.learn) return '';
  const now = new Date(), at = hmToMin(r.learnAt), min = now.getHours() * 60 + now.getMinutes();
  if (min < at - 15 || min > at + 120) return '';
  const start = new Date(); start.setHours(0, at, 0, 0);
  if (await learnedToday(start.getTime() - 15 * 60000)) return '';
  const p = learningPicks();
  return `<section class="card learn-card"><div class="row between"><div><div class="label">📚 Learning time · ${esc(r.learnAt)}</div>
    <b>${esc(p.type)}</b><br><small>📖 ${esc(p.books[0][0])}</small></div><span class="big-emoji">📚</span></div>
    <div class="row wrap"><button class="btn primary small" data-act="learn">See today's ideas</button><button class="btn small" data-act="learnStart">⏱ Start now</button></div></section>`;
}
function openLearning(salt = 0) {
  const p = learningPicks(salt), ei = todaysEi(), L = learningFor(S.months);
  S.learnSalt = salt;
  openSheet(`<div class="sheet-hd"><h3>📚 Learning time</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    <p class="muted small">Ideas for ${esc(S.settings.name)} at ${esc(ageText(S.settings.dob))}. Keep it short and fun: stop while ${S.P.he} is still enjoying it.</p>
    <div class="learn-list">
      <div class="li"><span>🎯</span><div><b>Today's kind of reading</b><br>${esc(p.type)}</div></div>
      <div class="li"><span>📖</span><div><b>Books to read</b>${p.books.map(b => `<br>“${esc(b[0])}” <small class="muted">· ${esc(b[1])} · ${esc(b[2])}</small>`).join('')}</div></div>
      <div class="li"><span>🧩</span><div><b>Material to use</b><br>${esc(p.material)}</div></div>
      <div class="li"><span>🎵</span><div><b>Rhyme / song</b><br>${esc(p.rhyme)}</div></div>
      <div class="li ei"><span>💛</span><div><b>Feelings activity today</b><br>${esc(ei)}</div></div>
    </div>
    <details class="small"><summary>All books for this age (${L.books.length})</summary><ul>${L.books.map(b => `<li>“${esc(b[0])}” · ${esc(b[1])} <span class="muted">· ${esc(b[2])}</span></li>`).join('')}</ul>
      <p class="muted">Free Tamil and English picture books: storyweaver.org.in (Pratham Books).</p></details>
    <div class="row actions"><button class="btn" data-act="learnMore">🔄 Other ideas</button><button class="btn primary" data-act="learnStart">⏱ Start learning</button></div>`, { focus: false });
}
async function openMorning(stopped) {
  const p = learningPicks(), ei = todaysEi(), r = remCfg();
  const today = dateKey(), eiDone = (await db.byDate(today)).some(e => e.type === 'ei' && e.data?.text === ei);
  const morning = new Date().getHours() < 12;
  openSheet(`<div class="sheet-hd"><h3>🌅 ${morning ? 'Good morning' : 'Awake again'}, ${esc(S.settings.name)}!</h3><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
    ${stopped ? `<p class="small">${typeInfo(stopped.type).icon} ${esc(typeInfo(stopped.type).label)}: <b>${fmtDur(entryMinutes(stopped))}</b> (${fmtTime(stopped.start)}–${fmtTime(stopped.end)})</p>` : ''}
    <div class="learn-list">
      ${morning ? `<div class="li"><span>📚</span><div><b>Quick learning (5 min)</b><br>${esc(p.morning)}</div></div>` : ''}
      <div class="li ei"><span>💛</span><div><b>Feelings activity today</b><br>${esc(ei)}
        <br><button class="btn small ${eiDone ? '' : 'primary'}" data-act="eidone" data-text="${esc(ei)}" ${eiDone ? 'disabled' : ''}>${eiDone ? '✓ Done today' : 'We did it'}</button></div></div>
      ${r.learn && morning ? `<div class="li"><span>⏰</span><div><b>Learning time at ${esc(r.learnAt)}</b><br><small>${r.on ? 'I will remind you.' : 'Turn on reminders in ⚙️ → Reminders to get an alarm.'}</small></div></div>` : ''}
    </div>
    <div class="row actions"><button class="btn" data-act="close">Close</button>${morning ? '<button class="btn primary" data-act="learnStart">⏱ Start 5-min learning</button>' : ''}</div>`, { focus: false });
}

// ------------------------------------------------------------------ REMINDERS
let fired = {};
try { fired = JSON.parse(localStorage.getItem('hp-fired') || '{}'); } catch (e) { fired = {}; }
function markFired(k) {
  fired[k] = Date.now();
  for (const [x, t] of Object.entries(fired)) if (Date.now() - t > 3 * 86400000) delete fired[x];
  try { localStorage.setItem('hp-fired', JSON.stringify(fired)); } catch (e) { /* ignore */ }
}
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 660, 880].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.35; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.start(t); o.stop(t + 0.32); });
  } catch (e) { /* no audio */ }
}
async function notify(key, title, body, go = '') {
  if (fired[key]) return;
  markFired(key);
  if (remCfg().on && !S.bellOk && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/favicon-64.png', tag: key, data: { go }, vibrate: [300, 150, 300], requireInteraction: go === 'learn' };
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.showNotification(title, opts); else new Notification(title, opts); } catch (e) { /* ignore */ }
  }
  if (document.visibilityState === 'visible') {
    chime();
    toast(`${title} · ${body}`, go ? [['Open', () => handleGo(go)]] : []);
  }
}
function handleGo(go) {
  if (go === 'learn') openLearning();
  else if (go === 'doctor' || go === 'week') { S.view = go; route(); }
  else if (go === 'health') { S.view = 'health'; route(); }
}
async function checkReminders() {
  if (!S.settings?.dob) return;
  const r = remCfg();
  if (!r.on) return;
  S.bellOk = await bellConnected(); // the bell rings the phone itself; here we only chime inside the open app
  syncBell().catch(() => {});
  const now = Date.now(), today = dateKey(), name = S.settings.name || 'Baby';
  const todayAt = hm => { const d = new Date(); d.setHours(0, hmToMin(hm), 0, 0); return d.getTime(); };
  const within = t => now >= t && now < t + 90 * 60000;
  if (r.learn && within(todayAt(r.learnAt)) && !(await learnedToday(todayAt(r.learnAt) - 15 * 60000))) {
    const p = learningPicks();
    await notify(`learn:${today}`, `📚 Learning time for ${name}`, `${p.type} · try “${p.books[0][0]}”`, 'learn');
  }
  String(r.custom || '').split('\n').map(l => l.trim()).filter(Boolean).forEach((line, i) => {
    const m = line.match(/^(\d{1,2})[:.](\d{2})\s*(.*)$/);
    if (!m) return;
    const hm = `${m[1].padStart(2, '0')}:${m[2]}`;
    if (within(todayAt(hm))) notify(`c:${i}:${hm}:${today}`, `⏰ ${m[3] || 'Reminder'}`, `${name} · ${hm}`);
  });
  if (r.nap) {
    const w = await wakeInfo();
    if (w && w.state !== 'early' && w.awake < w.hi + 60) await notify(`nap:${w.at}`, `😴 ${w.what === 'nap' ? 'Nap' : 'Sleep'} time soon`, `${name} has been awake ${fmtDur(w.awake)}. Watch for yawns and eye-rubbing.`);
  }
  if (Number(r.feedHrs) > 0 && S.months < 24) {
    const feeds = [...await db.byType('breastfeed'), ...await db.byType('bottle')].sort((a, b) => b.start - a.start);
    const f = feeds[0];
    if (f && f.end !== null && now - f.start >= Number(r.feedHrs) * 3600000 && now - f.start < (Number(r.feedHrs) + 3) * 3600000)
      await notify(`feed:${f.id}`, '🍼 Feed due', `Last feed ${agoText(f.start)} (${fmtTime(f.start)}${f.data?.side ? ', ' + f.data.side : ''}).`);
  }
  if (r.meds) {
    const h = await healthData();
    const ill = h.ill.find(i => !i.data?.recovered);
    for (const rx of activeRx(h, ill?.id)) for (const m of rx.data?.meds || []) {
      const last = medStatus(h, m.name), gap = FREQ_HOURS[m.freq];
      if (last && gap && now >= last.start + gap * 3600000) await notify(`med:${m.name}:${last.id}`, `💊 ${m.name} due`, `${m.dose || ''} · last given ${fmtTime(last.start)}`.trim(), 'health');
    }
  }
  if (r.vax && new Date().getHours() >= 10) {
    const state = await db.getKV('vaccines', {}), dob = parseKey(S.settings.dob);
    const next = UIP_VACCINES.map(v => { const d = new Date(dob); d.setDate(d.getDate() + Math.round(v.at * 30.4375)); return { ...v, dk: dateKey(d), done: state[`uip:${v.at}`] }; })
      .find(v => !v.done && v.dk <= addDays(today, 7) && v.dk >= addDays(today, -30));
    if (next) await notify(`vax:${next.at}:${today}`, '💉 Vaccine due', `${next.label}: ${next.name} (around ${fmtDateShort(next.dk)}). Free at government hospitals.`);
  }
}
function calendarLink(r) {
  const d = new Date(); const [h, m] = r.learnAt.split(':').map(Number); d.setHours(h, m, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  const pad2 = n => String(n).padStart(2, '0');
  const f = x => `${x.getFullYear()}${pad2(x.getMonth() + 1)}${pad2(x.getDate())}T${pad2(x.getHours())}${pad2(x.getMinutes())}00`;
  const e = new Date(d.getTime() + 30 * 60000);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `📚 Learning time for ${S.settings.name}`, dates: `${f(d)}/${f(e)}`, recur: 'RRULE:FREQ=DAILY',
    details: `Open Happy Parenthood → Learning time for today's book, material, rhyme and feelings activity.\n${location.href.split('?')[0]}` });
  return `https://calendar.google.com/calendar/render?${q}`;
}
function remindersSection() {
  const r = remCfg(), perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const tog = (k, label, sub) => `<label class="check"><input type="checkbox" name="${k}" ${r[k] ? 'checked' : ''}> <span><b>${label}</b>${sub ? `<br><small class="muted">${sub}</small>` : ''}</span></label>`;
  return `<form id="remForm" class="card rem-form">
      <label class="check big"><input type="checkbox" name="on" ${r.on ? 'checked' : ''}> <span><b>Turn on reminders & alarms</b><br><small class="muted">${perm === 'granted' ? '✓ Notifications allowed on this phone' : perm === 'denied' ? '⚠️ Notifications are blocked: allow them in Chrome → Site settings → Notifications' : perm === 'unsupported' ? 'This browser cannot show notifications; reminders show inside the app.' : 'The phone will ask to allow notifications.'}</small></span></label>
      <div class="label">📚 Learning time</div>
      ${tog('learn', 'Daily learning alarm', 'Shows today\'s book, material, rhyme and feelings activity')}
      <label>Time<input type="time" name="learnAt" value="${esc(r.learnAt)}"></label>
      <div class="label">👶 Baby care</div>
      ${tog('nap', 'Nap time', `When ${S.P.he} has been awake for ${S.P.his} usual time`)}
      <label>Feed reminder<select name="feedHrs">${[[0, 'Off'], [2, 'Every 2 hours'], [2.5, 'Every 2½ hours'], [3, 'Every 3 hours'], [3.5, 'Every 3½ hours'], [4, 'Every 4 hours']].map(([v, l]) => `<option value="${v}" ${Number(r.feedHrs) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${tog('meds', 'Medicines', 'When a prescribed medicine is due during an illness')}
      ${tog('vax', 'Vaccines', 'A week before a government-schedule vaccine is due')}
      <div class="label">⏰ My own daily reminders</div>
      <label>One per line: time and what<textarea name="custom" rows="3" placeholder="08:00 Vitamin D drops&#10;17:30 Evening walk">${esc(r.custom || '')}</textarea></label>
      <div class="row wrap"><button class="btn primary">Save</button><button type="button" class="btn" data-act="remTest">🔔 Test alarm</button></div>
    </form>
    <!--bell-->
    <section class="card small"><b>Good to know</b><ul>
      <li>Without the bell, reminders only ring while the app is open or was used recently: Android pauses closed web apps.</li>
      <li>Nap, feed and medicine times are sent to the bell whenever you open the app, so open it after logging (it updates by itself while open).</li>
      <li>Backup option for learning time, a daily Google Calendar event: <a class="btn small" href="${calendarLink(r)}" target="_blank" rel="noopener">📅 Add daily ${esc(r.learnAt)} alarm to Calendar</a></li>
    </ul></section>`;
}

// ------------------------------------------------------------------ DOCTOR VISIT SUMMARY
async function renderDoctor() {
  const s = S.settings, today = dateKey(), from = addDays(today, -13);
  const all = await db.range(addDays(from, -1), today);
  const days = [...Array(14)].map((_, i) => summarize(all, addDays(from, i)));
  const logged = days.filter(d => d.sleepMin || d.feeds || d.meals || d.pee);
  const avg = f => logged.length ? logged.reduce((a, d) => a + f(d), 0) / logged.length : 0;
  const h = await healthData();
  const g = (await db.byType('growth')).sort((a, b) => b.start - a.start);
  const growth = [['wfa', 'weight'], ['hfa', 'height'], ['hca', 'head']].map(([ind, key]) => {
    const e = g.find(x => x.data?.[key]); if (!e) return '';
    const z = zScore(ind, s.sex, ageMonths(s.dob, e.start, Number(s.premature) || 0), e.data[key]);
    return `<tr><td>${INDICATORS[ind].label}</td><td><b>${e.data[key]} ${INDICATORS[ind].unit}</b><br><small class="muted">${esc(fmtDateShort(e.date))}</small></td><td>${z != null ? `${percentile(z)}th · ${esc(zLabel(z)[1])}` : ''}</td></tr>`;
  }).join('');
  const ill = h.ill.filter(i => !i.data?.recovered || i.date >= addDays(today, -90));
  const meds30 = {};
  h.meds.filter(m => m.date >= addDays(today, -30)).forEach(m => { const n = m.data?.name || 'Medicine'; meds30[n] = (meds30[n] || 0) + 1; });
  const vstate = await db.getKV('vaccines', {}), dob = parseKey(s.dob);
  const vax = UIP_VACCINES.map(v => { const d = new Date(dob); d.setDate(d.getDate() + Math.round(v.at * 30.4375)); return { ...v, dk: dateKey(d), done: vstate[`uip:${v.at}`] }; });
  const vNext = vax.find(v => !v.done), vLate = vax.filter(v => !v.done && v.dk < today);
  const ms = await db.getKV('milestones', {}), { passed } = milestoneFocus(S.months);
  const notYet = passed ? passed.items.map((it, i) => ({ it, k: `${passed.at}:${i}` })).filter(x => !ms[x.k]).map(x => x.it[1]) : [];
  const newMs = Object.entries(ms).filter(([, d]) => typeof d === 'string' && d >= addDays(today, -60)).length;
  const foods = Object.entries(await db.getKV('foods', {}));
  const reactions = foods.filter(([, f]) => f.reactions?.length).map(([n]) => n);
  const qs = await db.getKV('doctorQs', []);
  main().innerHTML = `<div class="no-print">${backBar()}</div>
    <div class="doc-sheet">
    <h2>🩺 Doctor visit summary</h2>
    <p><b>${esc(s.name)}</b> · ${s.sex === 'girl' ? 'Girl' : 'Boy'} · born ${esc(fmtDateLong(s.dob))} · <b>${esc(ageText(s.dob))}</b>${Number(s.premature) ? ` · born ${s.premature} weeks early` : ''}<br><small class="muted">Prepared ${esc(fmtDateLong(today))} from the family's ${APP_NAME} log</small></p>
    <section class="card"><div class="label">❓ Questions for the doctor</div>
      ${qs.length ? `<ul class="qs">${qs.map(q => `<li class="${q.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-q="${q.id}" ${q.done ? 'checked' : ''}> <span>${esc(q.text)}</span></label><button class="icon-btn no-print" data-act="qDel" data-id="${q.id}" aria-label="Remove">✕</button></li>`).join('')}</ul>` : '<p class="muted small">No questions yet. Add them whenever you think of one.</p>'}
      <form id="qForm" class="row no-print"><input name="q" placeholder="e.g. Is his sleep enough?" aria-label="New question"><button class="btn small primary">Add</button></form></section>
    <section class="card"><div class="label">📏 Growth (latest)</div>${growth ? `<table class="meds"><tbody>${growth}</tbody></table><p class="muted small">Percentiles use the WHO Child Growth Standards.</p>` : '<p class="muted small">No weight or height logged yet.</p>'}</section>
    <section class="card"><div class="label">📅 Last 14 days (average per logged day, ${logged.length} days logged)</div>
      <div class="summary-grid">
        <div><b>${fmtDur(avg(d => d.sleepMin))}</b><span>sleep</span></div><div><b>${avg(d => d.napCount).toFixed(1)}</b><span>naps</span></div>
        ${S.months < 24 ? `<div><b>${avg(d => d.feeds).toFixed(1)}</b><span>milk feeds</span></div>` : ''}<div><b>${avg(d => d.meals).toFixed(1)}</b><span>meals</span></div>
        <div><b>${avg(d => d.pee).toFixed(1)}</b><span>wet / pee</span></div><div><b>${avg(d => d.poop).toFixed(1)}</b><span>poop</span></div>
      </div>
      <p class="small">Aim for ${esc(S.stage.name)}: sleep ${S.stage.targets.sleep[0]}–${S.stage.targets.sleep[1]} h${S.stage.targets.feeds[1] ? ` · milk feeds ${S.stage.targets.feeds[0]}–${S.stage.targets.feeds[1]}` : ''}${S.stage.targets.meals ? ` · ${S.stage.targets.meals} meals` : ''}.</p>
      ${foods.length ? `<p class="small"><b>Foods tried:</b> ${foods.length}${reactions.length ? ` · <b>reactions noted:</b> ${esc(reactions.join(', '))}` : ''}</p>` : ''}</section>
    <section class="card"><div class="label">🤒 Illnesses (last 3 months)</div>
      ${ill.length ? `<ul class="mini-list">${ill.map(i => `<li><b>${esc(i.data?.title || 'Illness')}</b> · ${esc(fmtDateShort(i.date))}${i.data?.recovered ? `–${esc(fmtDateShort(i.data.recovered))}` : ' · ongoing'}${i.data?.symptoms?.length ? ` · ${esc(i.data.symptoms.join(', '))}` : ''}${i.data?.diagnosis ? ` · ${esc(i.data.diagnosis)}` : ''}</li>`).join('')}</ul>` : '<p class="muted small">None logged.</p>'}
      ${Object.keys(meds30).length ? `<p class="small"><b>Medicines given (30 days):</b> ${esc(Object.entries(meds30).map(([n, c]) => `${n} ×${c}`).join(', '))}</p>` : ''}</section>
    <section class="card"><div class="label">💉 Vaccines (government schedule)</div>
      <p class="small">${vLate.length ? `⚠️ Not marked as given: ${esc(vLate.map(v => v.label).join(', '))}<br>` : ''}${vNext ? `Next: <b>${esc(vNext.label)}</b> — ${esc(vNext.name)} (around ${esc(fmtDateShort(vNext.dk))})` : '✓ All marked as given'}</p></section>
    <section class="card"><div class="label">🎯 Development</div>
      <p class="small">${newMs} milestone${newMs === 1 ? '' : 's'} ticked in the last 2 months.</p>
      ${notYet.length ? `<p class="small"><b>Not seen yet (most children do these by ${esc(ageLabel(passed.at))}):</b></p><ul class="small">${notYet.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="small">✓ All milestones for ${esc(ageLabel(passed?.at))} ticked.</p>`}</section>
    <p class="muted small">This is a parent's log to help the conversation, not a diagnosis. Always follow your paediatrician's advice. Emergency: call 108 / 112.</p>
    </div>
    <div class="row wrap no-print"><button class="btn primary" data-act="print">🖨️ Save as PDF / print</button><button class="btn" data-act="shareDoc">📤 Share as text</button></div>`;
  $('#qForm')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const text = new FormData(ev.target).get('q').trim(); if (!text) return;
    await db.setKV('doctorQs', [...await db.getKV('doctorQs', []), { id: uid(), text, done: false, at: Date.now() }]);
    route();
  });
}

// ------------------------------------------------------------------ WEEKLY REPORT CARD
async function weekData(endKey) {
  const from = addDays(endKey, -6), pFrom = addDays(endKey, -13);
  const all = await db.range(addDays(pFrom, -1), endKey);
  const sumDays = start => [...Array(7)].map((_, i) => ({ d: addDays(start, i), s: summarize(all, addDays(start, i)) }));
  const cur = sumDays(from), prev = sumDays(pFrom);
  const avg = (arr, f) => { const l = arr.filter(x => Object.values(x.s).some(v => typeof v === 'number' && v > 0)); return l.length ? l.reduce((a, x) => a + f(x.s), 0) / l.length : 0; };
  const total = (arr, f) => arr.reduce((a, x) => a + f(x.s), 0);
  const ms = await db.getKV('milestones', {}), foods = await db.getKV('foods', {});
  const inRange = d => typeof d === 'string' && d >= from && d <= endKey;
  const mems = all.filter(e => e.type === 'memory' && e.date >= from).sort((a, b) => a.start - b.start);
  const ei = all.filter(e => e.type === 'ei' && e.date >= from).length;
  return { from, to: endKey, cur, prev, avg, total, newMs: Object.values(ms).filter(inRange).length, newFoods: Object.entries(foods).filter(([, f]) => inRange(f.first)).map(([n]) => n), mems, ei };
}
async function renderWeek() {
  const end = dateKey();
  const w = await weekData(end);
  const row = (icon, label, f, fmt, goodUp = true) => {
    const a = w.avg(w.cur, f), b = w.avg(w.prev, f);
    const diff = b ? (a - b) / b : 0;
    const arrow = !b || Math.abs(diff) < 0.05 ? '' : (diff > 0) === goodUp ? `<span class="up">▲</span>` : `<span class="down">▼</span>`;
    return `<tr><td>${icon} ${label}</td><td><b>${fmt(a)}</b> ${arrow}</td><td class="muted">${b ? fmt(b) : '—'}</td></tr>`;
  };
  const d1 = v => v.toFixed(1), dur = v => fmtDur(v);
  const sleepBars = w.cur.map(({ d, s }) => ({ label: parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }), value: s.sleepMin / 60 }));
  main().innerHTML = `${backBar()}<h2>📊 ${esc(S.settings.name)}'s week</h2>
    <p class="muted">${esc(fmtDateShort(w.from))} – ${esc(fmtDateShort(w.to))} · compared with the week before</p>
    <section class="tiles week-tiles">
      ${tile('⭐', 'Milestones', w.newMs, '', null, 'newly ticked')}${tile('🥕', 'New foods', w.newFoods.length, '', null, w.newFoods.slice(0, 3).join(', '))}
      ${tile('✨', 'New things', w.mems.length, '', null, '')}${tile('💛', 'Feelings activities', w.ei, '', null, 'done')}
    </section>
    <section class="card"><table class="meds week-table"><thead><tr><th>Average per day</th><th>This week</th><th>Last week</th></tr></thead><tbody>
      ${row('🌙', 'Sleep', s => s.sleepMin, dur)}${S.stage.targets.naps[1] ? row('😴', 'Naps', s => s.napCount, d1) : ''}
      ${S.months < 24 ? row('🍼', 'Milk feeds', s => s.feeds, d1) : ''}${S.months >= 5 ? row('🥣', 'Meals', s => s.meals, d1) : ''}
      ${row('🌳', 'Outdoor', s => s.outdoorMin, dur)}${row('🧸', 'Play', s => s.playMin, dur)}${row('📚', 'Learning', s => s.learnMin, dur)}
      ${S.months >= 18 ? row('📱', 'Screen', s => s.screenMin, dur, false) : ''}${row('💗', 'Kind moments', s => s.pos, d1)}
    </tbody></table><p class="muted small">▲ ▼ show changes over 5% (green = in a good direction). Days with nothing logged are left out.</p></section>
    ${barChart({ title: 'Sleep each day (hours)', data: sleepBars, unit: ' h', target: S.stage.targets.sleep })}
    ${w.mems.length ? `<section class="card"><div class="label">✨ This week's new things</div><ul class="mini-list">${w.mems.map(e => `<li><b>${esc(fmtDateShort(e.date))}</b> ${esc(e.data?.text || e.note)}</li>`).join('')}</ul></section>` : ''}
    <div class="row wrap"><button class="btn primary" data-act="shareWeek">📤 Share with family</button></div>`;
}
async function weekBanner() {
  const day = new Date().getDay();
  if (day !== 0 && day !== 1) return '';
  const wk = `${new Date().getFullYear()}-${Math.floor(dayOfYear() / 7)}`;
  if ((await db.getKV('weekSeen')) === wk) return '';
  const w = await weekData(dateKey());
  if (!w.cur.some(x => x.s.sleepMin || x.s.feeds || x.s.meals)) return '';
  return `<section class="card week-banner"><div class="row between"><div><b>📊 ${esc(S.settings.name)}'s week is ready</b><br><small>Sleep ${fmtDur(w.avg(w.cur, s => s.sleepMin))}/day · ${w.newMs} milestones · ${w.newFoods.length} new foods</small></div>
    <button class="btn small primary" data-act="openWeek" data-wk="${wk}">See it</button></div></section>`;
}
async function shareText(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Copied — paste it in WhatsApp'); } catch (e) { alert(text); }
}

// ------------------------------------------------------------------ BELL (alarms when the app is closed)
// The family's own Cloudflare Worker (bell/worker.js) keeps the reminder times and wakes the
// phone with a push message at the right minute; sw.js then shows the notification.
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
const ub64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const bellUrl = () => String(remCfg().bell || '').trim().replace(/\/+$/, '');
const bellId = () => { let id = lsGet('hp-bell-id'); if (!id) { id = uid() + uid() + uid(); lsSet('hp-bell-id', id); } return id; };
async function bellSub() {
  try { const reg = await navigator.serviceWorker?.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; }
}
async function bellConnected() { return !!(bellUrl() && lsGet('hp-bell-ok') === bellUrl() && await bellSub()); }

async function bellJobs() {
  const r = remCfg(), name = S.settings.name || 'Baby', now = Date.now(), jobs = [];
  if (r.learn) jobs.push({ daily: r.learnAt, title: `📚 Learning time for ${name}`, body: "Tap to see today's book, material, rhyme and feelings activity.", go: 'learn', tag: 'learn' });
  String(r.custom || '').split('\n').map(l => l.trim()).forEach((line, i) => {
    const m = line.match(/^(\d{1,2})[:.](\d{2})\s*(.*)$/);
    if (m) jobs.push({ daily: `${m[1].padStart(2, '0')}:${m[2]}`, title: `⏰ ${m[3] || 'Reminder'}`, body: name, tag: `c${i}` });
  });
  if (r.nap) {
    const w = await wakeInfo();
    if (w && w.state === 'early') jobs.push({ at: w.at + w.lo * 60000, title: `😴 ${w.what === 'nap' ? 'Nap' : 'Sleep'} time soon`, body: `${name} has been awake ${fmtDur(w.lo)}. Watch for yawns and eye-rubbing.`, tag: 'nap' });
  }
  if (Number(r.feedHrs) > 0 && S.months < 24) {
    const f = [...await db.byType('breastfeed'), ...await db.byType('bottle')].sort((a, b) => b.start - a.start)[0];
    const at = f && f.end !== null ? f.start + Number(r.feedHrs) * 3600000 : 0;
    if (at > now) jobs.push({ at, title: '🍼 Feed due', body: `Last feed was at ${fmtTime(f.start)}${f.data?.side ? ' (' + f.data.side + ')' : ''}.`, tag: 'feed' });
  }
  if (r.meds) {
    const h = await healthData(), ill = h.ill.find(i => !i.data?.recovered);
    for (const rx of activeRx(h, ill?.id)) for (const m of rx.data?.meds || []) {
      const last = medStatus(h, m.name), gap = FREQ_HOURS[m.freq];
      const at = last && gap ? last.start + gap * 3600000 : 0;
      if (at > now) jobs.push({ at, title: `💊 ${m.name} due`, body: `${m.dose || ''} · last given ${fmtTime(last.start)}`.trim(), go: 'health', tag: `med-${m.name}`.slice(0, 40) });
    }
  }
  if (r.vax) {
    const state = await db.getKV('vaccines', {}), dob = parseKey(S.settings.dob);
    const next = UIP_VACCINES.map(v => { const d = new Date(dob); d.setDate(d.getDate() + Math.round(v.at * 30.4375)); return { ...v, d, done: state[`uip:${v.at}`] }; }).find(v => !v.done && v.d.getTime() > now);
    if (next) { const at = new Date(next.d); at.setDate(at.getDate() - 7); at.setHours(10, 0, 0, 0);
      if (at.getTime() > now) jobs.push({ at: at.getTime(), title: '💉 Vaccine next week', body: `${next.label}: ${next.name}. Free at government hospitals.`, tag: 'vax' }); }
  }
  return jobs;
}
// Send the reminder list to the bell when it changes (checked every 30 s while the app is open).
async function syncBell(force = false) {
  if (!remCfg().on || !bellUrl() || lsGet('hp-bell-ok') !== bellUrl()) return;
  const sub = await bellSub();
  if (!sub) return;
  const payload = JSON.stringify({ id: bellId(), sub: { endpoint: sub.endpoint }, jobs: await bellJobs(), tz: new Date().getTimezoneOffset(), name: S.settings.me || '' });
  const last = lsGet('hp-bell-last') || '';
  if (!force && last === payload && Date.now() - Number(lsGet('hp-bell-at') || 0) < 12 * 3600000) return;
  try {
    const res = await fetch(`${bellUrl()}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    if (res.ok) { lsSet('hp-bell-last', payload); lsSet('hp-bell-at', String(Date.now())); }
  } catch (e) { /* offline: try again later */ }
}
async function connectBell() {
  const url = ($('#bellUrl')?.value || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/\S+$/.test(url)) return alert('Paste the bell address. It starts with https:// and ends with workers.dev');
  if (!('PushManager' in window) || !navigator.serviceWorker) return alert('This browser cannot receive alarms. Open the app from its home-screen icon in Chrome.');
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return alert('Please allow notifications for Happy Parenthood (Chrome → ⋮ → Settings → Notifications), then try again.');
  try {
    const res = await fetch(`${url}/vapid`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.key) throw new Error(data.error || 'The bell did not answer. Check the address and the setup steps.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options?.applicationServerKey && b64u(sub.options.applicationServerKey) !== data.key) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ub64(data.key) });
    S.settings = { ...S.settings, rem: { ...remCfg(), on: true, bell: url } };
    await db.setKV('settings', S.settings);
    lsSet('hp-bell-ok', url);
    const c = await caches.open('hp-bell');
    await c.put('bell-config', new Response(JSON.stringify({ url, id: bellId() }), { headers: { 'Content-Type': 'application/json' } }));
    await syncBell(true);
    toast('🔔 This phone is connected to the bell');
    route();
  } catch (e) { alert(`Could not connect: ${e.message}`); }
}
async function testBell() {
  try {
    await syncBell(true);
    const res = await fetch(`${bellUrl()}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bellId() }) });
    const d = await res.json().catch(() => ({}));
    toast(res.ok && d.ok ? '🔔 Sent! Lock the phone — the alarm arrives in a few seconds' : `Bell problem: ${d.error || 'status ' + (d.status || res.status)}`);
  } catch (e) { toast('Could not reach the bell. Are you online?'); }
}
async function bellSection() {
  const on = await bellConnected(), url = bellUrl();
  return `<section class="card bell-card"><div class="label">🔔 Alarms when the app is closed</div>
    <p class="small">${on ? '✅ <b>This phone is connected.</b> Reminders ring at the right time even when the app is closed.' : url ? '⚠️ The bell is set up but <b>this phone is not connected yet</b>. Tap Connect.' : 'Set up your free bell once (about 10 minutes), then connect each phone.'}</p>
    <label>Bell address<input id="bellUrl" inputmode="url" autocomplete="off" placeholder="https://hp-bell.yourname.workers.dev" value="${esc(url)}"></label>
    <div class="row wrap"><button type="button" class="btn ${on ? '' : 'primary'}" data-act="bellConnect">${on ? '🔄 Reconnect' : '🔗 Connect this phone'}</button>${on ? '<button type="button" class="btn primary" data-act="bellTest">🔔 Send test alarm</button>' : ''}</div>
    <details class="small bell-steps" ${url ? '' : 'open'}><summary><b>How to set up the free bell (one time)</b></summary>
      <p class="muted">Easiest on a computer. You need a free Cloudflare account. Only reminder times and their short texts are stored there: no logs, photos or health records.</p>
      <ol>
        <li>Go to <b>dash.cloudflare.com</b> and sign up (free plan).</li>
        <li>In the left menu open <b>Storage &amp; Databases → KV</b>, tap <b>Create</b>, name it <code>bell</code>.</li>
        <li>Open <b>Workers &amp; Pages → Create → Worker</b> (start from "Hello World"), name it <code>hp-bell</code>, tap <b>Deploy</b>.</li>
        <li>Tap <b>Edit code</b>, delete everything, paste the bell code (button below), tap <b>Deploy</b>.</li>
        <li>Go back to the worker → <b>Settings → Bindings → Add → KV namespace</b>. Variable name <code>BELL</code>, namespace <code>bell</code>. Save.</li>
        <li><b>Settings → Trigger events (Cron) → Add</b>: choose "every minute" (<code>* * * * *</code>). Save.</li>
        <li>Copy the worker address shown at the top (ends with <code>.workers.dev</code>), paste it above and tap <b>Connect this phone</b>.</li>
        <li>On Appa's phone: open the app → this screen → <b>Connect this phone</b> (the address is already filled in).</li>
      </ol>
      <div class="row wrap"><button type="button" class="btn" data-act="bellCopy">📋 Copy bell code</button><a class="btn" href="bell/worker.js" target="_blank" rel="noopener">👀 View code</a></div>
    </details></section>`;
}

// ------------------------------------------------------------------ events
let busy = false;
async function onClick(ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) { if (ev.target.id === 'sheet') closeSheet(); return; }
  const a = el.dataset.act;
  // ignore a second tap while a timer/counter is still saving (prevents double timers)
  if (['toggle', 'quick', 'giveMed', 'eidone', 'vSave'].includes(a)) {
    if (busy) return;
    busy = true;
    try { await handleClick(el, a, ev); } finally { setTimeout(() => { busy = false; }, 350); }
    return;
  }
  await handleClick(el, a, ev);
}

async function handleClick(el, a, ev) {
  switch (a) {
    case 'view': S.selMode = false; S.sel.clear(); S.view = el.dataset.view; if (S.view === 'settings') S.settingsTab = null; closeSheet(); route(); break;
    case 'goGrow': S.view = 'grow'; S.growTab = el.dataset.tab; closeSheet(); route(); break;
    case 'close': closeSheet(); break;
    case 'openPicker': openPicker(); break;
    case 'form': openForm(el.dataset.type, null, { focusFoods: el.dataset.type === 'meal', prefill: el.dataset.first ? { data: { first: true } } : undefined, noFocus: true }); break;
    case 'formFor': openForm(el.dataset.type, null, { prefill: { data: { illness: el.dataset.ill } }, noFocus: true }); break;
    case 'behaviour': openBehaviour(el.dataset.kind); break;
    case 'edit': {
      ev.stopPropagation();
      if (S.selMode) { const id = el.dataset.id; S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); updateSel(); break; }
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
      if (type === 'wake') openMorning(stopped);
      break;
    }
    case 'toggle': await toggleTimer(el.dataset.type); break;
    case 'bfStart': closeSheet(); await toggleTimer('breastfeed', { side: el.dataset.side }); break;
    case 'bfStop': closeSheet(); await toggleTimer('breastfeed', { stop: true }); break;
    case 'bfSwitch': {
      closeSheet();
      const run = (await db.byType('breastfeed')).find(e => !e.end);
      if (run) { run.end = Date.now(); await db.put(run); }
      await toggleTimer('breastfeed', { side: el.dataset.side });
      break;
    }
    case 'toastAct': { const f = toast._actions?.[Number(el.dataset.i)]; $('#toast').hidden = true; if (f) await f(); break; }
    case 'learn': openLearning(); break;
    case 'learnMore': openLearning((S.learnSalt || 0) + 1); break;
    case 'learnStart': closeSheet(); { const run = (await db.byType('study')).find(e => !e.end); if (!run) await toggleTimer('study'); else toast('📚 Learning timer is already running'); } break;
    case 'remTest': {
      if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* ignore */ } }
      delete fired.test;
      const p = learningPicks();
      const was = S.settings.rem; S.settings.rem = { ...remCfg(), on: true };
      await notify('test', `📚 Learning time for ${S.settings.name}`, `${p.type} · try “${p.books[0][0]}”`, 'learn');
      S.settings.rem = was; delete fired.test;
      break;
    }
    case 'print': window.print(); break;
    case 'bellConnect': await connectBell(); break;
    case 'bellTest': await testBell(); break;
    case 'bellCopy': {
      try { const code = await (await fetch('bell/worker.js', { cache: 'no-store' })).text(); await navigator.clipboard.writeText(code); toast('📋 Bell code copied — paste it in Cloudflare'); }
      catch (e) { toast('Could not copy here. Tap "View code", select all and copy.'); }
      break;
    }
    case 'shareDoc': shareText(main().querySelector('.doc-sheet').innerText.replace(/\n{3,}/g, '\n\n'), 'Doctor visit summary'); break;
    case 'shareWeek': shareText(main().innerText.replace(/Share with family|‹ More/g, '').replace(/\n{3,}/g, '\n\n').trim(), `${S.settings.name}'s week`); break;
    case 'openWeek': await db.setKV('weekSeen', el.dataset.wk); S.view = 'week'; route(); break;
    case 'qDel': await db.setKV('doctorQs', (await db.getKV('doctorQs', [])).filter(q => q.id !== el.dataset.id)); route(); break;
    case 'eidone': {
      await db.put({ id: uid(), type: 'ei', start: Date.now(), end: null, date: dateKey(), data: { text: el.dataset.text }, note: '', by: S.settings.me, createdAt: Date.now() });
      toast('💛 Lovely! Logged.'); route(); break;
    }
    case 'ackStage': await db.setKV('lastStage', S.stage.id); route(); break;
    case 'homeCat': S.homeCat = el.dataset.cat; route(); break;
    case 'settingsTab': S.settingsTab = el.dataset.tab || null; route(); break;
    case 'children': openChildren(); break;
    case 'addChild': openAddChild(); break;
    case 'switchChild': closeSheet(); await selectChild(el.dataset.id); toast(`Switched to ${S.settings?.name || 'child'}`); break;
    case 'removeChild': await removeChild(el.dataset.id); break;
    case 'askQ': await askQuestion(el.dataset.q); break;
    case 'askClear': await db.setKVQuiet('chat', []); route(); break;
    case 'backup': S.view = 'settings'; S.settingsTab = 'backup'; closeSheet(); route(); break;
    case 'driveSignIn': await doDriveSignIn(); break;
    case 'driveSyncNow': {
      if (!driveHasToken()) { await doDriveSignIn(); break; }
      try { const r = await driveSync({ silent: false }); toast(r.ok ? `✓ Synced${r.pulled ? ` · ${r.pulled} changes received` : ''}` : 'Please sign in again'); } catch (err) { alert('Sync failed: ' + err.message); }
      route(); break;
    }
    case 'driveSignOut': if (confirm('Sign out of Google Drive backup on this phone? Your data stays on the phone and in Drive.')) { await driveSignOut(); setBackends({ drive: false }); route(); } break;
    case 'homeTab': S.homeTab = el.dataset.tab; route(); break;
    case 'diaryMode': S.diaryMode = el.dataset.mode; route(); break;
    case 'selStart': S.selMode = true; S.sel.clear(); route(); break;
    case 'selCancel': S.selMode = false; S.sel.clear(); route(); break;
    case 'selAll': {
      const ids = [...new Set([...document.querySelectorAll('#main [data-act="edit"][data-id]')].map(x => x.dataset.id))];
      if (ids.every(id => S.sel.has(id))) S.sel.clear(); else ids.forEach(id => S.sel.add(id));
      updateSel(); break;
    }
    case 'selDel': {
      if (!S.sel.size) return toast('Tap entries to select them first');
      const gone = (await Promise.all([...S.sel].map(id => db.get(id)))).filter(Boolean);
      const by = {};
      for (const e of gone) { const l = typeInfo(e.type).label; by[l] = (by[l] || 0) + 1; }
      if (!confirm(`Delete ${gone.length} entr${gone.length === 1 ? 'y' : 'ies'}?\n\n${Object.entries(by).map(([l, n]) => `${n} × ${l}`).join('\n')}\n\nThis cannot be undone.`)) return;
      for (const e of gone) await db.del(e.id);
      S.sel.clear(); S.selMode = false;
      toast(`🗑️ Deleted ${gone.length} entr${gone.length === 1 ? 'y' : 'ies'}`); route();
      break;
    }
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
      await db.put(i); toast(`🌈 So glad ${S.P.he} is better!`); route(); break;
    }
    case 'illnessView': openIllness(el.dataset.id); break;
    case 'day': S.sel.clear(); S.diaryDate = addDays(S.diaryDate, Number(el.dataset.delta)); if (S.diaryDate > dateKey()) S.diaryDate = dateKey(); route(); break;
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
    case 'cutOld': case 'cutDemo': {
      const cut = fromLocalInput($('#cutAt')?.value);
      if (a === 'cutOld' && !cut) return alert('Pick a date and time first.');
      const gone = (await db.all()).filter(e => a === 'cutDemo' ? e.demo : e.start < cut);
      if (!gone.length) return toast('Nothing to delete');
      const by = {};
      for (const e of gone) { const l = typeInfo(e.type).label; by[l] = (by[l] || 0) + 1; }
      const list = Object.entries(by).sort((x, y) => y[1] - x[1]).map(([l, n]) => `${n} × ${l}`).join('\n');
      const what = a === 'cutDemo' ? 'sample entries' : `entries before ${new Date(cut).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
      if (!confirm(`Delete ${gone.length} ${what}?\n\n${list}\n\nThis cannot be undone (make a backup file first if unsure).`)) return;
      for (const e of gone) await db.del(e.id);
      toast(`🗑️ Deleted ${gone.length} entries`); route();
      break;
    }
    case 'wipe':
      if (confirm('Erase ALL data on this device? Make a backup first. This cannot be undone.') && prompt('Type ERASE to confirm') === 'ERASE') {
        await db.clearAll(); location.reload();
      }
      break;
  }
}

async function onChange(ev) {
  const t = ev.target;
  if (t.id === 'diaryDate' && t.value) { S.sel.clear(); S.diaryDate = t.value > dateKey() ? dateKey() : t.value; route(); }
  if (t.id === 'guideAll') { S.guideAll = t.checked; route(); }
  if (t.dataset.q) { const qs = await db.getKV('doctorQs', []); const q = qs.find(x => x.id === t.dataset.q); if (q) { q.done = t.checked; await db.setKV('doctorQs', qs); t.closest('li')?.classList.toggle('done', t.checked); } }
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
  if (t.dataset.ms || t.dataset.phys) {
    // update in place: no re-render, so the page never jumps
    const key = t.dataset.ms ? 'milestones' : 'physical', id = t.dataset.ms || t.dataset.phys;
    const st = await db.getKV(key, {});
    if (t.checked) st[id] = dateKey(); else delete st[id];
    await db.setKV(key, st);
    const li = t.closest('li');
    li?.querySelector('.ticked-date')?.remove();
    if (t.checked) { li?.insertAdjacentHTML('beforeend', `<span class="muted small ticked-date"> ✓ ${esc(fmtDateShort(dateKey()))}</span>`); toast('🎉 Ticked!'); }
    const det = t.closest('details');
    const cnt = det?.querySelector(':scope > summary .muted');
    if (cnt) { const boxes = det.querySelectorAll('input[type=checkbox]'); cnt.textContent = ` · ${[...boxes].filter(b => b.checked).length}/${boxes.length}`; }
    const sec = t.closest('.ms-focus');
    const badge = sec?.querySelector('.badge');
    if (badge && /\d+\/\d+/.test(badge.textContent)) { const [d, n] = badge.textContent.match(/\d+/g).map(Number); badge.textContent = `${d + (t.checked ? 1 : -1)}/${n} ✓`; }
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
