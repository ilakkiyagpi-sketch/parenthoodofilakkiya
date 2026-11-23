// Online backup to the parent's own Google Sheet (via a Google Apps Script web app).
// - Every change is queued locally (db.js "dirty" list).
// - Whenever the phone is online, the queue is uploaded: on app open, a few
//   seconds after any change, when the connection comes back, and every 5 minutes.
// - Nothing is lost if offline: the queue simply waits.
// - The sheet can be used to restore everything on a new phone.
import { mainDb, dbFor, childDbName, LOCAL_KV } from './db.js';

// Backup settings live in the first child's database; every child's data is uploaded.
const db = mainDb;
export async function childrenList() { return db.getKV('children', [{ id: 'main', name: '' }]); }

const BATCH = 400;
let rowBuilder = e => ({});
let timer = null, running = false, onStatus = () => {};

export async function getConfig() { return db.getKV('sync', { url: '', token: '', enabled: false }); }
export async function setConfig(c) { await db.setKV('sync', c); }
export async function getState() { return db.getKV('syncState', { lastSync: null, lastError: null }); }

export async function pendingCount() {
  const st = await getState();
  let n = 0;
  for (const c of await childrenList()) {
    const cdb = dbFor(childDbName(c.id));
    n += Object.keys(await cdb.getKV('dirty', {})).length + ((await cdb.getKV('kvDirty', 0)) ? 1 : 0);
    if (!st.photosUnsupported) n += (await cdb.photosToUpload()).length;
  }
  return n;
}

async function call(cfg, payload) {
  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      // text/plain avoids a CORS preflight, which Apps Script does not support
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: cfg.token, ...payload }),
      redirect: 'follow',
    });
  } catch (err) {
    if (!navigator.onLine) throw new Error('No internet connection — will retry when online');
    throw new Error('Google did not let the app read the reply (usually the script still needs permission). Fix: in Apps Script choose "setup" → ▶ Run → allow all permissions; then Deploy → Manage deployments → ✏️ → Who has access: Anyone → Version: New version → Deploy.');
  }
  if (!res.ok) throw new Error(`Server replied ${res.status}`);
  const out = await res.json().catch(() => { throw new Error('Google returned a page instead of the backup reply. Check: (1) the URL ends in /exec, (2) Deploy → Manage deployments → Edit: "Who has access" = Anyone, then Deploy a New version, (3) open the URL in an Incognito window — it should say "backup is running"'); });
  if (!out.ok) throw new Error(out.error || 'Backup failed');
  return out;
}

export async function syncNow({ silent = true } = {}) {
  const cfg = await getConfig();
  if (!cfg.enabled || !cfg.url) return { skipped: 'not set up' };
  if (!navigator.onLine) { onStatus(); return { skipped: 'offline' }; }
  if (running) return { skipped: 'busy' };
  running = true; onStatus('syncing');
  try {
    let st = await getState();
    let sent = 0;
    for (const child of await childrenList()) {
      const cdb = dbFor(childDbName(child.id));
      const prefix = child.id === 'main' ? '' : `${child.id}::`;
      // 1) photos first (to a Google Drive folder), so entry rows can include their links
      if (!st.photosUnsupported) {
        for (const p of await cdb.photosToUpload()) {
          try {
            const r = await call(cfg, { action: 'photo', id: p.id, mime: 'image/jpeg', data: p.data.split(',')[1] });
            await cdb.updatePhoto(p.id, { driveId: r.fileId, driveUrl: r.url });
          } catch (err) {
            if (/Unknown action/i.test(err.message)) { st = { ...st, photosUnsupported: true }; await db.setKV('syncState', st); break; }
            throw err;
          }
        }
      }
      // 2) entries
      const dirty = await cdb.getKV('dirty', {});
      const ids = Object.keys(dirty);
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const rows = [], deletes = [];
        for (const id of chunk) {
          if (dirty[id].op === 'del') { deletes.push(id); continue; }
          const e = await cdb.get(id);
          if (e) rows.push(await rowBuilder({ ...e, child: child.id }, child, cdb)); else deletes.push(id);
        }
        await call(cfg, { action: 'save', rows, deletes });
        sent += chunk.length;
        // remove only the ids that did not change again while uploading
        const now = await cdb.getKV('dirty', {});
        chunk.forEach(id => { if (now[id] && now[id].at === dirty[id].at) delete now[id]; });
        await cdb.setKV('dirty', now);
      }
      // 3) settings, milestones, foods… (keys prefixed for the 2nd, 3rd… child)
      const kvDirty = await cdb.getKV('kvDirty', 0);
      if (kvDirty) {
        const kv = Object.fromEntries(Object.entries(await cdb.allKV()).filter(([k]) => !LOCAL_KV.has(k)).map(([k, v]) => [prefix + k, v]));
        await call(cfg, { action: 'saveKV', kv });
        if ((await cdb.getKV('kvDirty', 0)) === kvDirty) await cdb.setKV('kvDirty', 0);
      }
    }
    st = await getState();
    await db.setKV('syncState', { ...st, lastSync: Date.now(), lastError: null, lastSent: sent });
    return { ok: true, sent };
  } catch (err) {
    await db.setKV('syncState', { ...(await getState()), lastError: err.message, lastErrorAt: Date.now() });
    if (!silent) throw err;
    return { error: err.message };
  } finally {
    running = false; onStatus();
  }
}

export async function testConnection(cfg) {
  const r = await call(cfg, { action: 'ping' });
  // a fresh test re-checks whether the script supports photo backup
  await db.setKV('syncState', { ...(await getState()), photosUnsupported: !r.photos });
  return r;
}

// Download everything from the sheet (for a new phone or after data loss)
export async function restoreFromSheet() {
  const cfg = await getConfig();
  const out = await call(cfg, { action: 'export' });
  const kvAll = out.kv || {};
  // children list first (stored with the first child's data)
  const children = kvAll.children || [{ id: 'main', name: '' }];
  if (!children.some(c => c.id === 'main')) children.unshift({ id: 'main', name: '' });
  await db.setKV('children', children);
  const entries = (out.entries || []).filter(e => e && e.id);
  const photoMeta = Object.fromEntries((out.photos || []).map(p => [p.id, p]));
  for (const c of children) {
    const cdb = dbFor(childDbName(c.id));
    const mine = entries.filter(e => (e.child || 'main') === c.id);
    await cdb.bulkPut(mine, false);
    const prefix = c.id === 'main' ? '' : `${c.id}::`;
    for (const [k, v] of Object.entries(kvAll)) {
      if (k === 'children') continue;
      if (prefix ? k.startsWith(prefix) : !k.includes('::')) {
        const key = k.slice(prefix.length);
        if (!LOCAL_KV.has(key)) await cdb.setKV(key, v);
      }
    }
    // photo links (the pictures themselves stay in Google Drive)
    for (const e of mine) for (const pid of e.data?.photos || []) {
      const ph = photoMeta[pid];
      if (ph && !(await cdb.getPhoto(pid))) await cdb.putPhoto({ id: pid, driveId: ph.fileId, driveUrl: ph.url, createdAt: Date.now() });
    }
    await cdb.setKV('kvDirty', 0);
  }
  return entries.length;
}

function schedule(ms = 4000) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
}

export function startAutoSync({ buildRow, status }) {
  rowBuilder = buildRow;
  onStatus = status || (() => {});
  window.addEventListener('data-changed', () => { schedule(); onStatus(); });
  window.addEventListener('online', () => schedule(500));
  window.addEventListener('offline', () => onStatus());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(1000); });
  setInterval(() => syncNow(), 5 * 60 * 1000);
  schedule(1500);
}
