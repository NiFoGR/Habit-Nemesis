// The bundled scripture. One JSON file per book, fetched lazily and cached in
// memory; the service worker precaches them all.
//
// The hosted build leaves www/bible/ out on size, so every fetch here can 404.
// A failed load returns null and the reader shows an empty chapter.

const cache = new Map();
let metaP = null;

/** `{ books, chapters, verses, missing }` from the last generation. */
export function meta() {
  if (!metaP) metaP = fetch('./bible/_meta.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return metaP;
}

/** One book's chapters, `{ [chapter]: { [verse]: text } }`. */
export async function book(id) {
  if (cache.has(id)) return cache.get(id);
  const p = fetch(`./bible/${id}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  cache.set(id, p);
  const data = await p;
  cache.set(id, data);
  return data;
}

/* -------------------- study notes -------------------- */

const noteCache = new Map();

/** One book's notes, `{ "ch:v": text }`. */
export async function notesFor(id) {
  if (noteCache.has(id)) return noteCache.get(id);
  const p = fetch(`./bible/notes/${id}.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  noteCache.set(id, p);
  const data = (await p) || {};
  noteCache.set(id, data);
  return data;
}

/** The note, plus the span the printed reference covered ("14-16"). */
export function noteAt(notes, ch, v) {
  const key = `${ch}:${v}`;
  const text = notes[key];
  if (!text) return null;
  return { text, span: notes[key + '@'] || '' };
}

/** One chapter as `{ n, text }`. An unrecovered verse comes back with
 *  `missing: true` rather than being skipped. */
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
