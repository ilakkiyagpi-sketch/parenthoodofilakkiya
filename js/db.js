// Tiny IndexedDB wrapper. All data lives on this device; every change is also
// recorded in a "dirty" list so the online backup (sync.js) knows what to upload.
// Each child has a separate database: the first child uses "parenthood",
// others use "parenthood-<childId>". The children list lives in the first database.
const MAIN_DB = 'parenthood';
const VERSION = 2;
// kv keys that are local-only and never uploaded
export const LOCAL_KV = new Set(['dirty', 'kvDirty', 'sync', 'syncState', 'lastStage', 'installDismissed', 'driveDirty', 'driveKvDirty', 'drive', 'driveState', 'driveSeen', 'driveFiles']);

// Which backups are switched on (each keeps its own queue of changes)
const backends = { sheet: false, drive: false };
export function setBackends(b) { Object.assign(backends, b); }

function makeDb(DB_NAME) {
let dbp;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      // v2: photos (compressed JPEG data URLs + Google Drive link once backed up)
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(stores, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const s = Array.isArray(stores) ? Object.fromEntries(stores.map(n => [n, t.objectStore(n)])) : t.objectStore(stores);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

return {
  name: DB_NAME,
  async put(entry) {
    entry.updatedAt = Date.now();
    await tx(['entries', 'kv'], 'readwrite', async s => { s.entries.put(entry); await markDirty(s.kv, [item(entry)], 'put'); });
    changed();
    return entry;
  },
  async del(id) {
    await tx(['entries', 'kv'], 'readwrite', async s => { const old = await reqP(s.entries.get(id)); s.entries.delete(id); await markDirty(s.kv, [{ id, month: old?.date?.slice(0, 7) }], 'del'); });
    changed();
  },
  async get(id) { return tx('entries', 'readonly', s => reqP(s.get(id))); },
  async all() { return tx('entries', 'readonly', s => reqP(s.getAll())); },
  async byDate(date) { return tx('entries', 'readonly', s => reqP(s.index('date').getAll(date))); },
  async range(from, to) { return tx('entries', 'readonly', s => reqP(s.index('date').getAll(IDBKeyRange.bound(from, to)))); },
  async byType(type) { return tx('entries', 'readonly', s => reqP(s.index('type').getAll(type))); },
  async getKV(key, fallback = null) { const v = await tx('kv', 'readonly', s => reqP(s.get(key))); return v === undefined || v === null ? fallback : v; },
  async setKV(key, value) {
    await tx('kv', 'readwrite', s => { s.put(value, key); if (!LOCAL_KV.has(key)) { s.put(Date.now(), 'kvDirty'); s.put(Date.now(), 'driveKvDirty'); } });
    if (!LOCAL_KV.has(key)) changed();
  },
  async allKV() {
    return tx('kv', 'readonly', async s => {
      const keys = await reqP(s.getAllKeys());
      const vals = await reqP(s.getAll());
      return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
    });
  },
  async clearAll() {
    await tx('entries', 'readwrite', s => s.clear());
    await tx('kv', 'readwrite', s => s.clear());
    await tx('photos', 'readwrite', s => s.clear());
  },
  // markAsChanged=false when the data came FROM the online backup (no need to re-upload)
  async bulkPut(entries, markAsChanged = true) {
    await tx(['entries', 'kv'], 'readwrite', async s => {
      entries.forEach(e => s.entries.put(e));
      if (markAsChanged) await markDirty(s.kv, entries.map(item), 'put');
    });
    if (markAsChanged) changed();
  },
  // ---- photos
  async putPhoto(p) { await tx('photos', 'readwrite', s => s.put(p)); changed(); return p; },
  async getPhoto(id) { return tx('photos', 'readonly', s => reqP(s.get(id))); },
  async allPhotos() { return tx('photos', 'readonly', s => reqP(s.getAll())); },
  async photosToUpload() { return (await this.allPhotos()).filter(p => p.data && !p.driveId); },
  async updatePhoto(id, patch) {
    await tx('photos', 'readwrite', async s => { const p = await reqP(s.get(id)); if (p) s.put({ ...p, ...patch }); });
  },
  // changes that came FROM the cloud: stored without being queued for upload again
  async delQuiet(ids) { await tx('entries', 'readwrite', s => { ids.forEach(id => s.delete(id)); }); },
  async setKVQuiet(key, value) { await tx('kv', 'readwrite', s => { s.put(value, key); }); },
  async markAllDirty() {
    const all = await this.all();
    await tx(['kv'], 'readwrite', async s => { await markDirty(s.kv, all.map(item), 'put'); s.kv.put(Date.now(), 'kvDirty'); s.kv.put(Date.now(), 'driveKvDirty'); });
    return all.length;
  },
};
}

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

const item = e => ({ id: e.id, month: e.date?.slice(0, 7) });
// Record changes inside the same transaction:
//  - Google Sheet backup: changed entry ids
//  - Google Drive backup: changed months (+ deleted ids so deletions sync to other phones)
async function markDirty(kvStore, items, op) {
  const now = Date.now();
  if (backends.sheet) {
    const dirty = (await reqP(kvStore.get('dirty'))) || {};
    items.forEach(({ id }) => { dirty[id] = { op, at: now }; });
    kvStore.put(dirty, 'dirty');
  }
  if (backends.drive) {
    const d = (await reqP(kvStore.get('driveDirty'))) || { months: {}, dels: {} };
    items.forEach(({ id, month }) => { if (month) d.months[month] = now; if (op === 'del') d.dels[id] = { month, at: now }; });
    kvStore.put(d, 'driveDirty');
  }
}
const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('data-changed')); };

const cache = {};
export function dbFor(name) { return (cache[name] ||= makeDb(name)); }
export const mainDb = dbFor(MAIN_DB);
// `db` always points at the currently selected child's database (live binding)
export let db = mainDb;
export function useDb(name) { db = dbFor(name || MAIN_DB); return db; }
export const childDbName = id => (!id || id === 'main' ? MAIN_DB : `${MAIN_DB}-${id}`);
export async function deleteDatabase(name) {
  delete cache[name];
  await new Promise(r => { const q = indexedDB.deleteDatabase(name); q.onsuccess = q.onerror = q.onblocked = () => r(); });
}
