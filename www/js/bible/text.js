// The scripture, bundled with the app.
//
// This repository is private, which is what makes shipping the text itself
// legitimate: it is a personal copy for personal use, not a public
// redistribution of a commercial translation. See docs/BIBLE.md. If this repo
// is ever made public, www/bible/ has to come out first and this goes back to
// reading from a device-side import instead.
//
// One JSON file per book, fetched lazily and kept in a small memory cache, so
// opening a chapter costs one network request the first time you touch that
// book and nothing after that. The service worker precaches all of them for
// offline reading, so in practice even the first touch is instant.

const cache = new Map();
let metaP = null;

/** `{ books, chapters, verses, missing }`, from the last time the text was
 *  generated. Static, so it is fetched once and shared. */
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

/** One chapter as an ordered list of `{ n, text }`. A verse the parser could
 *  not recover comes back with `missing: true` rather than being skipped,
 *  because a Bible that silently drops a verse is worse than one that says
 *  so. */
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
