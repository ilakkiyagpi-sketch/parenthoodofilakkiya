// Tiny IndexedDB wrapper. All data lives on this device; every change is also
// recorded in a "dirty" list so the online backup (sync.js) knows what to upload.
const DB_NAME = 'parenthood';
const VERSION = 2;
// kv keys that are local-only and never uploaded
export const LOCAL_KV = new Set(['dirty', 'kvDirty', 'sync', 'syncState', 'lastStage']);
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

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// Record changed entry ids (value = change time) inside the same transaction
async function markDirty(kvStore, ids, op) {
  const dirty = (await reqP(kvStore.get('dirty'))) || {};
  const now = Date.now();
  ids.forEach(id => { dirty[id] = { op, at: now }; });
  kvStore.put(dirty, 'dirty');
}
const changed = () => window.dispatchEvent(new Event('data-changed'));

export const db = {
  async put(entry) {
    entry.updatedAt = Date.now();
    await tx(['entries', 'kv'], 'readwrite', async s => { s.entries.put(entry); await markDirty(s.kv, [entry.id], 'put'); });
    changed();
    return entry;
  },
  async del(id) {
    await tx(['entries', 'kv'], 'readwrite', async s => { s.entries.delete(id); await markDirty(s.kv, [id], 'del'); });
    changed();
  },
  async get(id) { return tx('entries', 'readonly', s => reqP(s.get(id))); },
  async all() { return tx('entries', 'readonly', s => reqP(s.getAll())); },
  async byDate(date) { return tx('entries', 'readonly', s => reqP(s.index('date').getAll(date))); },
  async range(from, to) { return tx('entries', 'readonly', s => reqP(s.index('date').getAll(IDBKeyRange.bound(from, to)))); },
  async byType(type) { return tx('entries', 'readonly', s => reqP(s.index('type').getAll(type))); },
  async getKV(key, fallback = null) { const v = await tx('kv', 'readonly', s => reqP(s.get(key))); return v === undefined || v === null ? fallback : v; },
  async setKV(key, value) {
    await tx('kv', 'readwrite', s => { s.put(value, key); if (!LOCAL_KV.has(key)) s.put(Date.now(), 'kvDirty'); });
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
      if (markAsChanged) await markDirty(s.kv, entries.map(e => e.id), 'put');
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
  async markAllDirty() {
    const all = await this.all();
    await tx(['kv'], 'readwrite', async s => { await markDirty(s.kv, all.map(e => e.id), 'put'); s.kv.put(Date.now(), 'kvDirty'); });
    return all.length;
  },
};
