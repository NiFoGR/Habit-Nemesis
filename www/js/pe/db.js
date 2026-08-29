// IndexedDB for progress photos. Ciphertext only, as ArrayBuffers. The keys
// live in vault.js.

const DB = 'nifo-pe';
const STORE = 'photos';
const VERSION = 1;

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

/** One request in a transaction. Both can fail independently. */
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(STORE, mode);
    } catch (err) {
      reject(err);
      return;
    }
    let result;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage transaction aborted'));
    t.oncomplete = () => resolve(result);
    try {
      const req = fn(t.objectStore(STORE));
      if (req && typeof req === 'object' && 'onsuccess' in req) {
        req.onsuccess = () => {
          result = req.result;
        };
        req.onerror = () => reject(req.error);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export async function put(record) {
  await tx('readwrite', (s) => s.put(record));
  return record.id;
}

export async function get(id) {
  return tx('readonly', (s) => s.get(id));
}

export async function all() {
  const items = await tx('readonly', (s) => s.getAll());
  return (items || []).sort((a, b) => b.ts - a.ts);
}

/** Ask for persistence: photos are the one thing here that cannot be re-made. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch {
    return false;
  }
}

export async function remove(id) {
  return tx('readwrite', (s) => s.delete(id));
}

export async function clear() {
  return tx('readwrite', (s) => s.clear());
}

export async function usage() {
  const items = await all();
  const bytes = items.reduce((a, i) => a + (i.full?.data?.byteLength || 0) + (i.thumb?.data?.byteLength || 0), 0);
  return { count: items.length, bytes };
}
