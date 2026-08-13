// IndexedDB store for progress photos.
//
// localStorage is capped at a few MB and holds strings, which is nowhere near
// enough for photos — so ciphertext lives here as ArrayBuffers instead. The
// database only ever sees encrypted bytes; the keys live in vault.js.

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

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out;
    try {
      out = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(out?.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
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

/** Downscales and re-encodes a captured photo before it is ever encrypted.
 *  A modern phone camera file is 3-8 MB; this lands around 200-400 KB, which
 *  keeps years of monthly photos comfortably inside the storage quota. */
export function processImage(file, { maxEdge = 1600, thumbEdge = 320, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const draw = (edge, q) => {
          const scale = Math.min(1, edge / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          return new Promise((res) => c.toBlob(res, 'image/jpeg', q));
        };
        const full = await draw(maxEdge, quality);
        const thumb = await draw(thumbEdge, 0.7);
        URL.revokeObjectURL(url);
        resolve({ full, thumb, width: img.width, height: img.height });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image'));
    };
    img.src = url;
  });
}
