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
  return Object.keys(dirty).length + ((await db.getKV('kvDirty', 0)) ? 1 : 0);
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
    const dirty = await db.getKV('dirty', {});
    const ids = Object.keys(dirty);
    let sent = 0;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const rows = [], deletes = [];
      for (const id of chunk) {
        if (dirty[id].op === 'del') { deletes.push(id); continue; }
        const e = await db.get(id);
        if (e) rows.push(rowBuilder(e)); else deletes.push(id);
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
    await db.setKV('syncState', { lastSync: Date.now(), lastError: null, lastSent: sent });
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
  return call(cfg, { action: 'ping' });
}

// Download everything from the sheet (for a new phone or after data loss)
export async function restoreFromSheet() {
  const cfg = await getConfig();
  const out = await call(cfg, { action: 'export' });
  const entries = (out.entries || []).filter(e => e && e.id);
  await db.bulkPut(entries, false);
  for (const [k, v] of Object.entries(out.kv || {})) if (!LOCAL_KV.has(k)) await db.setKV(k, v);
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
