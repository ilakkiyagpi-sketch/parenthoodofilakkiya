// Online backup to the parent's own Google Sheet (via a Google Apps Script web app).
// - Every change is queued locally (db.js "dirty" list).
// - Whenever the phone is online, the queue is uploaded: on app open, a few
//   seconds after any change, when the connection comes back, and every 5 minutes.
// - Nothing is lost if offline: the queue simply waits.
// - The sheet can be used to restore everything on a new phone.
import { db, LOCAL_KV } from './db.js';

const BATCH = 400;
let rowBuilder = e => ({});
let timer = null, running = false, onStatus = () => {};

export async function getConfig() { return db.getKV('sync', { url: '', token: '', enabled: false }); }
export async function setConfig(c) { await db.setKV('sync', c); }
export async function getState() { return db.getKV('syncState', { lastSync: null, lastError: null }); }

export async function pendingCount() {
  const dirty = await db.getKV('dirty', {});
  const st = await getState();
  const photos = st.photosUnsupported ? 0 : (await db.photosToUpload()).length;
  return Object.keys(dirty).length + photos + ((await db.getKV('kvDirty', 0)) ? 1 : 0);
}

async function call(cfg, payload) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script does not support
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: cfg.token, ...payload }),
    redirect: 'follow',
  });
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
    // 1) photos first (to a Google Drive folder), so entry rows can include their links
    let st = await getState();
    if (!st.photosUnsupported) {
      for (const p of await db.photosToUpload()) {
        try {
          const r = await call(cfg, { action: 'photo', id: p.id, mime: 'image/jpeg', data: p.data.split(',')[1] });
          await db.updatePhoto(p.id, { driveId: r.fileId, driveUrl: r.url });
        } catch (err) {
          if (/Unknown action/i.test(err.message)) { await db.setKV('syncState', { ...st, photosUnsupported: true }); break; }
          throw err;
        }
      }
    }
    // 2) entries
    const dirty = await db.getKV('dirty', {});
    const ids = Object.keys(dirty);
    let sent = 0;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const rows = [], deletes = [];
      for (const id of chunk) {
        if (dirty[id].op === 'del') { deletes.push(id); continue; }
        const e = await db.get(id);
        if (e) rows.push(await rowBuilder(e)); else deletes.push(id);
      }
      await call(cfg, { action: 'save', rows, deletes });
      sent += chunk.length;
      // remove only the ids that did not change again while uploading
      const now = await db.getKV('dirty', {});
      chunk.forEach(id => { if (now[id] && now[id].at === dirty[id].at) delete now[id]; });
      await db.setKV('dirty', now);
    }
    const kvDirty = await db.getKV('kvDirty', 0);
    if (kvDirty) {
      const kv = Object.fromEntries(Object.entries(await db.allKV()).filter(([k]) => !LOCAL_KV.has(k)));
      await call(cfg, { action: 'saveKV', kv });
      if ((await db.getKV('kvDirty', 0)) === kvDirty) await db.setKV('kvDirty', 0);
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
  const entries = (out.entries || []).filter(e => e && e.id);
  await db.bulkPut(entries, false);
  for (const [k, v] of Object.entries(out.kv || {})) if (!LOCAL_KV.has(k)) await db.setKV(k, v);
  // photo links (the pictures themselves stay in Google Drive)
  for (const ph of out.photos || []) {
    if (!(await db.getPhoto(ph.id))) await db.putPhoto({ id: ph.id, driveId: ph.fileId, driveUrl: ph.url, createdAt: Date.now() });
  }
  await db.setKV('kvDirty', 0);
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
