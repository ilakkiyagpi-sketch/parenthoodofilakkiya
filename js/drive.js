// Google Drive backup & sync ("Sign in with Google").
// - Sign-in uses Google Identity Services in the browser; the app only gets the
//   "drive.file" permission, so it can see ONLY the files it creates itself.
// - Files live in the "Happy Parenthood Backup" folder of the signed-in account:
//     children.json, <child>__profile.json, <child>__YYYY-MM.json (one per month), Photos/<photo>.jpg
// - Two-way: each month file is merged (newest edit wins, deletions are carried over),
//   so both parents' phones signed in to the same Google account stay in sync.
import { mainDb, dbFor, childDbName, LOCAL_KV } from './db.js';
import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email';
const FOLDER = 'Happy Parenthood Backup';
const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
let token = null, tokenExp = 0, running = false, onStatus = () => {}, timer = null;

try { const t = JSON.parse(localStorage.getItem('hp-drive-token') || 'null'); if (t && t.exp > Date.now()) { token = t.token; tokenExp = t.exp; } } catch (e) { /* ignore */ }

export async function getDriveConfig() { return mainDb.getKV('drive', { enabled: false, clientId: '', email: '' }); }
export async function setDriveConfig(c) { await mainDb.setKV('drive', c); }
export async function getDriveState() { return mainDb.getKV('driveState', { lastSync: null, lastError: null }); }
export const clientIdFor = c => (c?.clientId || GOOGLE_CLIENT_ID || '').trim();
export const hasToken = () => !!token && Date.now() < tokenExp - 60000;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load Google sign-in. Are you online?'));
    document.head.appendChild(s);
  });
}

// Must be called from a tap (browsers only allow the Google pop-up after a user action).
export async function signIn({ consent = false } = {}) {
  const c = await getDriveConfig();
  const clientId = clientIdFor(c);
  if (!clientId) throw new Error('Google sign-in is not set up yet (missing OAuth Client ID). See Settings → Online backup → "One-time setup".');
  await loadGis();
  await new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPE, hint: c.email || undefined,
      callback: r => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        try { localStorage.setItem('hp-drive-token', JSON.stringify({ token, exp: tokenExp })); } catch (e) { /* ignore */ }
        resolve();
      },
      error_callback: e => reject(new Error(e?.type === 'popup_closed' ? 'Sign-in window was closed' : (e?.message || 'Sign-in failed'))),
    });
    tc.requestAccessToken({ prompt: consent || !c.email ? 'consent' : '' });
  });
  const me = await api('https://www.googleapis.com/oauth2/v3/userinfo').catch(() => ({}));
  await setDriveConfig({ ...c, enabled: true, email: me.email || c.email || '' });
  onStatus();
  return me.email;
}

export async function signOut() {
  const c = await getDriveConfig();
  try { if (token) window.google?.accounts?.oauth2?.revoke?.(token, () => {}); } catch (e) { /* ignore */ }
  token = null; tokenExp = 0;
  try { localStorage.removeItem('hp-drive-token'); } catch (e) { /* ignore */ }
  await setDriveConfig({ ...c, enabled: false });
  onStatus();
}

async function api(url, opts = {}) {
  if (!hasToken()) throw Object.assign(new Error('Please sign in to Google again'), { auth: true });
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (res.status === 401) { token = null; throw Object.assign(new Error('Google sign-in expired — tap ☁️ to continue'), { auth: true }); }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function findOrCreateFolder(name, parent) {
  const r = await api(`${API}/files?` + new URLSearchParams({ q: `name='${q(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent}' in parents`, fields: 'files(id)', spaces: 'drive' }));
  if (r.files?.length) return r.files[0].id;
  const f = await api(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) });
  return f.id;
}
async function listFolder(folderId) {
  const out = {};
  let pageToken = '';
  do {
    const r = await api(`${API}/files?` + new URLSearchParams({ q: `'${folderId}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,modifiedTime)', pageSize: '1000', ...(pageToken ? { pageToken } : {}) }));
    (r.files || []).forEach(f => { out[f.name] = f; });
    pageToken = r.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function upload(name, data, mime, parent, id) {
  const boundary = 'hp' + Math.random().toString(36).slice(2);
  const meta = id ? { name } : { name, parents: [parent] };
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, data, `\r\n--${boundary}--`]);
  return api(`${UP}/files${id ? '/' + id : ''}?uploadType=multipart&fields=id,name,modifiedTime`, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
}
const download = id => api(`${API}/files/${id}?alt=media`);
const dataUrlToBlob = d => { const [h, b] = d.split(','); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: h.match(/:(.*?);/)[1] }); };

export async function drivePending() {
  const c = await getDriveConfig();
  if (!c.enabled) return 0;
  let n = 0;
  for (const ch of await mainDb.getKV('children', [{ id: 'main' }])) {
    const cdb = dbFor(childDbName(ch.id));
    const d = await cdb.getKV('driveDirty', { months: {}, dels: {} });
    n += Object.keys(d.months).length + ((await cdb.getKV('driveKvDirty', 0)) ? 1 : 0);
    n += (await cdb.allPhotos()).filter(p => p.data && !p.driveFileId).length;
  }
  return n;
}

// The whole two-way sync. Returns { ok } or { needsAuth } / { skipped }.
export async function driveSync({ silent = true } = {}) {
  const c = await getDriveConfig();
  if (!c.enabled) return { skipped: 'off' };
  if (!hasToken()) { onStatus(); return { needsAuth: true }; }
  if (!navigator.onLine) { onStatus(); return { skipped: 'offline' }; }
  if (running) return { skipped: 'busy' };
  running = true; onStatus('syncing');
  const startedAt = Date.now();
  try {
    const folder = await findOrCreateFolder(FOLDER, 'root');
    const photoFolder = await findOrCreateFolder('Photos', folder);
    const remote = await listFolder(folder);
    const seen = await mainDb.getKV('driveSeen', {});
    const firstTime = !Object.keys(seen).length;
    let pulled = 0, pushed = 0;

    // children list (union of both sides)
    let children = await mainDb.getKV('children', [{ id: 'main', name: '' }]);
    if (remote['children.json']) {
      const rc = await download(remote['children.json'].id);
      for (const k of rc.children || []) if (!children.some(x => x.id === k.id)) { children.push(k); pulled++; }
      await mainDb.setKVQuiet('children', children);
    }
    const childrenJson = JSON.stringify({ children, updatedAt: Date.now() });
    const rcf = await upload('children.json', childrenJson, 'application/json', folder, remote['children.json']?.id);
    seen['children.json'] = rcf.modifiedTime;

    for (const child of children) {
      const cdb = dbFor(childDbName(child.id));
      const pre = `${child.id}__`;
      // photos (pictures go to the Photos sub-folder once)
      for (const p of (await cdb.allPhotos()).filter(p => p.data && !p.driveFileId)) {
        const f = await upload(`${p.id}.jpg`, dataUrlToBlob(p.data), 'image/jpeg', photoFolder);
        await cdb.updatePhoto(p.id, { driveFileId: f.id, driveUrl: p.driveUrl || `https://drive.google.com/file/d/${f.id}/view` });
        pushed++;
      }
      // profile & settings
      const profName = `${pre}profile.json`, rp = remote[profName];
      const kvDirty = await cdb.getKV('driveKvDirty', 0);
      if (rp && (firstTime || (!kvDirty && rp.modifiedTime !== seen[profName]))) {
        const prof = await download(rp.id);
        for (const [k, v] of Object.entries(prof.kv || {})) if (!LOCAL_KV.has(k)) await cdb.setKVQuiet(k, v);
        await cdb.setKVQuiet('driveKvDirty', 0);
        seen[profName] = rp.modifiedTime; pulled++;
      } else if (kvDirty || !rp) {
        const kv = Object.fromEntries(Object.entries(await cdb.allKV()).filter(([k]) => !LOCAL_KV.has(k)));
        const f = await upload(profName, JSON.stringify({ child: child.id, kv, updatedAt: Date.now() }), 'application/json', folder, rp?.id);
        seen[profName] = f.modifiedTime; pushed++;
        if ((await cdb.getKV('driveKvDirty', 0)) === kvDirty) await cdb.setKVQuiet('driveKvDirty', 0);
      }
      // month files: merge local + remote
      const dirty = await cdb.getKV('driveDirty', { months: {}, dels: {} });
      const remoteMonths = Object.keys(remote).filter(n => n.startsWith(pre) && /__\d{4}-\d{2}\.json$/.test(n)).map(n => n.slice(pre.length, pre.length + 7));
      const months = new Set([...Object.keys(dirty.months), ...remoteMonths.filter(m => remote[`${pre}${m}.json`].modifiedTime !== seen[`${pre}${m}.json`])]);
      for (const month of months) {
        const name = `${pre}${month}.json`, rf = remote[name];
        const local = await cdb.range(`${month}-01`, `${month}-31`);
        const rd = rf ? await download(rf.id) : { entries: [], deleted: {} };
        const deleted = { ...(rd.deleted || {}) };
        Object.entries(dirty.dels).forEach(([id, d]) => { if (d.month === month) deleted[id] = d.at; });
        const map = {};
        for (const e of rd.entries || []) map[e.id] = e;
        for (const e of local) if (!map[e.id] || (e.updatedAt || 0) >= (map[e.id].updatedAt || 0)) map[e.id] = e;
        for (const [id, at] of Object.entries(deleted)) if (map[id] && (map[id].updatedAt || 0) <= at) delete map[id];
        const merged = Object.values(map);
        // bring the other phone's changes into this phone
        const localById = Object.fromEntries(local.map(e => [e.id, e]));
        const incoming = merged.filter(e => !localById[e.id] || (e.updatedAt || 0) > (localById[e.id].updatedAt || 0));
        const gone = local.filter(e => !map[e.id]).map(e => e.id);
        if (incoming.length) { await cdb.bulkPut(incoming, false); pulled += incoming.length; }
        if (gone.length) { await cdb.delQuiet(gone); pulled += gone.length; }
        // keep tombstones for 60 days so other phones learn about deletions
        const keepDel = Object.fromEntries(Object.entries(deleted).filter(([, at]) => at > Date.now() - 60 * 86400000));
        // upload when this phone has something the cloud copy lacks
        const remoteById = Object.fromEntries((rd.entries || []).map(e => [e.id, e]));
        const localNewer = merged.some(e => !remoteById[e.id] || (e.updatedAt || 0) > (remoteById[e.id].updatedAt || 0));
        const localDeletes = Object.keys(deleted).some(id => !(rd.deleted || {})[id]);
        const needsUpload = !rf || localNewer || localDeletes;
        if (needsUpload) {
          const f = await upload(name, JSON.stringify({ child: child.id, month, entries: merged, deleted: keepDel, updatedAt: Date.now() }), 'application/json', folder, rf?.id);
          seen[name] = f.modifiedTime; pushed++;
        } else seen[name] = rf.modifiedTime;
      }
      // clear what was synced (unless changed again meanwhile)
      const now = await cdb.getKV('driveDirty', { months: {}, dels: {} });
      for (const m of Object.keys(now.months)) if (now.months[m] <= startedAt && months.has(m)) delete now.months[m];
      for (const id of Object.keys(now.dels)) if (now.dels[id].at <= startedAt) delete now.dels[id];
      await cdb.setKVQuiet('driveDirty', now);
    }
    await mainDb.setKVQuiet('driveSeen', seen);
    await mainDb.setKVQuiet('driveState', { lastSync: Date.now(), lastError: null, pulled, pushed });
    if (pulled) window.dispatchEvent(new Event('drive-pulled'));
    return { ok: true, pulled, pushed };
  } catch (err) {
    await mainDb.setKVQuiet('driveState', { ...(await getDriveState()), lastError: err.message, lastErrorAt: Date.now() });
    if (err.auth) return { needsAuth: true };
    if (!silent) throw err;
    return { error: err.message };
  } finally {
    running = false; onStatus();
  }
}

function schedule(ms = 4000) { clearTimeout(timer); timer = setTimeout(() => driveSync(), ms); }
export function startDriveAutoSync({ status }) {
  onStatus = status || (() => {});
  window.addEventListener('data-changed', () => schedule());
  window.addEventListener('online', () => schedule(800));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(1200); });
  setInterval(() => driveSync(), 5 * 60 * 1000);
  schedule(2000);
}
