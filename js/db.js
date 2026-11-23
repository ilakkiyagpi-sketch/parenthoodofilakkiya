// Tiny IndexedDB wrapper. All data stays on this device (export/import for backups).
const DB_NAME = 'parenthood';
const VERSION = 1;
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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async put(entry) { await tx('entries', 'readwrite', s => s.put(entry)); return entry; },
  async del(id) { return tx('entries', 'readwrite', s => s.delete(id)); },
  async get(id) { return tx('entries', 'readonly', s => reqP(s.get(id))); },
  async all() { return tx('entries', 'readonly', s => reqP(s.getAll())); },
  async byDate(date) { return tx('entries', 'readonly', s => reqP(s.index('date').getAll(date))); },
  async range(from, to) { return tx('entries', 'readonly', s => reqP(s.index('date').getAll(IDBKeyRange.bound(from, to)))); },
  async byType(type) { return tx('entries', 'readonly', s => reqP(s.index('type').getAll(type))); },
  async getKV(key, fallback = null) { const v = await tx('kv', 'readonly', s => reqP(s.get(key))); return v === undefined ? fallback : v; },
  async setKV(key, value) { return tx('kv', 'readwrite', s => s.put(value, key)); },
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
  },
  async bulkPut(entries) { return tx('entries', 'readwrite', s => { entries.forEach(e => s.put(e)); }); },
};
