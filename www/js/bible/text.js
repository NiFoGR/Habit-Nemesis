// Where the scripture lives once you have imported it.
//
// One record per book in IndexedDB, because localStorage caps out at a few
// megabytes and the text is five. Books are fetched one at a time and kept in
// a small memory cache, so opening a chapter costs one read the first time you
// touch a book and nothing after that.
//
// The app ships no scripture of its own. You import the copy you own, it is
// parsed here on the device, and it never leaves it.

const DB = 'nifo-bible';
const STORE = 'books';
const META = 'meta';
const VERSION = 1;

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

/** Runs one transaction. Request and transaction can fail independently, so
 *  both are watched, the same way the photo store does it. */
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(store, mode);
    } catch (err) {
      reject(err);
      return;
    }
    let result;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage transaction aborted'));
    t.oncomplete = () => resolve(result);
    try {
      const req = fn(t.objectStore(store));
      if (req) {
        req.onsuccess = () => { result = req.result; };
        req.onerror = () => reject(req.error);
      }
    } catch (err) {
      reject(err);
    }
  });
}

/* ---------------- reading ---------------- */

const cache = new Map();
let installed = null; // { at, stats } once known

/** Everything the app knows about the imported copy, or null if there is none. */
export async function status() {
  if (installed !== null) return installed;
  try {
    installed = (await tx(META, 'readonly', (s) => s.get('installed'))) || null;
  } catch {
    installed = null;
  }
  return installed;
}

export const isInstalled = async () => !!(await status());

/** One book's chapters, `{ [chapter]: { [verse]: text } }`. */
export async function book(id) {
  if (cache.has(id)) return cache.get(id);
  let data = null;
  try {
    data = (await tx(STORE, 'readonly', (s) => s.get(id))) || null;
  } catch {
    data = null;
  }
  // Only a handful of books are held at once: the whole text is five megabytes
  // and a reader moves through it a chapter at a time.
  if (cache.size > 4) cache.delete(cache.keys().next().value);
  cache.set(id, data);
  return data;
}

/** One chapter as an ordered list of `{ n, text }`, or null if not imported.
 *  A verse the parser could not recover comes back with `missing: true` rather
 *  than being skipped, because a Bible that silently drops a verse is worse
 *  than one that says so. */
export async function chapter(id, ch, verseCount) {
  const b = await book(id);
  if (!b) return null;
  const vs = b[ch];
  if (!vs) return null;
  const out = [];
  for (let v = 1; v <= verseCount; v++) {
    const t = vs[v];
    out.push(t ? { n: v, text: t } : { n: v, text: '', missing: true });
  }
  return out;
}

/* ---------------- importing ---------------- */

/** Writes a parsed Bible, one record per book, then records that it is there.
 *  The marker is written last, so an import that dies half way is not mistaken
 *  for a complete one. */
export async function install(books, stats) {
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage transaction aborted'));
    t.oncomplete = resolve;
    const s = t.objectStore(STORE);
    s.clear();
    for (const [id, data] of Object.entries(books)) s.put(data, id);
  });
  const rec = { at: Date.now(), stats };
  await tx(META, 'readwrite', (s) => s.put(rec, 'installed'));
  cache.clear();
  installed = rec;
  return rec;
}

/** Removes the imported text. The reading record in localStorage is untouched:
 *  what you have read is yours, and re-importing should not lose it. */
export async function remove() {
  await tx(STORE, 'readwrite', (s) => s.clear());
  await tx(META, 'readwrite', (s) => s.delete('installed'));
  cache.clear();
  installed = null;
}

/** Asks the browser not to evict five megabytes of scripture under pressure. */
export async function persist() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* not supported, and not worth surfacing */
  }
  return false;
}
