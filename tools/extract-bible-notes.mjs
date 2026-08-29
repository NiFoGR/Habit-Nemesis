// Generates the study notes from the same OSB text export as
// tools/extract-bible-text.mjs.
//
//   node tools/extract-bible-notes.mjs <path-to-osb.txt>
//
// Writes www/bible/notes/<book>.json, keyed "ch:v".
//
// Attribution: in the export the notes are one unlabelled run at the back,
// ordered by book, and the only structural signal is the chapter resetting to
// 1. Walking that greedily attaches commentary to the wrong scripture, so it
// is done in two stages: cut into runs at each chapter reset, then assign runs
// to books by dynamic programming, in order, never giving a book a chapter it
// does not have.

import fs from 'node:fs';
import path from 'node:path';
import { BOOKS } from '../www/js/bible/canon.js';

const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/extract-bible-notes.mjs <path-to-osb.txt>');
  process.exit(1);
}

const raw = fs.readFileSync(src, 'utf8');

/* ---- the region ----
   Everything earlier is scripture, the lectionary, the glossary and two
   indexes, all of which carry verse references that are not notes. */
const start = raw.search(/INDEX TO STUDY ARTICLES/);
if (start < 0) {
  console.error('could not find "INDEX TO STUDY ARTICLES"; this export may differ');
  process.exit(1);
}
const region = raw.slice(start);

const REF = /^\f?(\d{1,3}):(\d{1,3})((?:[-–]\d{1,3})?(?:,\s?\d{1,3})*)(?=\s)/gm;
const hits = [];
for (const m of region.matchAll(REF)) {
  hits.push({ ch: +m[1], v: +m[2], tail: (m[3] || '').trim(), at: m.index, len: m[0].length });
}

/** A note body runs from its ref to the start of the next. */
function bodyAt(i) {
  const h = hits[i];
  const end = i + 1 < hits.length ? hits[i + 1].at : region.length;
  return region
    .slice(h.at + h.len, end)
    .replace(/\f/g, '\n')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/** A real note is a sentence. Table rows and index leftovers are not. */
function looksLikeNote(text) {
  if (text.length < 25) return false;
  if (/\.{4,}/.test(text)) return false; // dotted leader from a table
  return text.split(' ').filter((w) => /[A-Za-z]{3}/.test(w)).length >= 5;
}

for (let i = 0; i < hits.length; i++) {
  hits[i].text = bodyAt(i);
  hits[i].ok = looksLikeNote(hits[i].text);
}
const kept = hits.filter((h) => h.ok);

/* ---- stage 1: cut into runs at each chapter reset ---- */
const runs = [];
let cur = [];
for (const h of kept) {
  if (cur.length && h.ch < cur[cur.length - 1].ch && h.ch <= 2) { runs.push(cur); cur = []; }
  cur.push(h);
}
if (cur.length) runs.push(cur);
const runMax = runs.map((r) => Math.max(...r.map((h) => h.ch)));

/* ---- stage 2: assign runs to books ---- */
const R = runs.length;
const B = BOOKS.length;
// An empty book must be expensive: nearly every book here has notes, and
// without the penalty the DP folds a short book into the long one before it.
// The second penalty discourages giving one book several runs.
const EMPTY = Number(process.env.EMPTY ?? 400);
const EXTRA_RUN = Number(process.env.EXTRA_RUN ?? 30);

/* Refs in run k that name a chapter or verse book b does not have. The thing
   worth minimising: a ref that does not fit is a note about to be attached to
   scripture it was not written about. */
const misfit = runs.map((r) => BOOKS.map((book) =>
  r.filter((h) => h.ch > book.chapters.length || h.v > (book.chapters[h.ch - 1] || 0)).length));

/** Cost of giving book b the runs [i, j). */
function cost(b, i, j) {
  if (i === j) return EMPTY;
  const nCh = BOOKS[b].chapters.length;
  let bad = 0;
  let max = 0;
  for (let k = i; k < j; k++) { bad += misfit[k][b]; max = Math.max(max, runMax[k]); }
  // Mis-attribution dominates; the span term only breaks ties.
  return bad * 10 + Math.max(0, nCh - Math.min(max, nCh)) + (j - i - 1) * EXTRA_RUN;
}

const dp = Array.from({ length: B + 1 }, () => new Float64Array(R + 1).fill(Infinity));
const back = Array.from({ length: B + 1 }, () => new Int32Array(R + 1).fill(-1));
dp[0][0] = 0;
for (let b = 0; b < B; b++) {
  for (let i = 0; i <= R; i++) {
    if (!Number.isFinite(dp[b][i])) continue;
    for (let j = i; j <= R; j++) {
      const c = cost(b, i, j);
      if (!Number.isFinite(c)) break;
      const v = dp[b][i] + c;
      if (v < dp[b + 1][j]) { dp[b + 1][j] = v; back[b + 1][j] = i; }
    }
  }
}
if (!Number.isFinite(dp[B][R])) {
  console.error('could not assign every run to a book; refusing to write possibly mis-attributed notes');
  process.exit(1);
}

// Walk the choices back out.
const span = [];
let j = R;
for (let b = B; b > 0; b--) { const i = back[b][j]; span[b - 1] = [i, j]; j = i; }

/* ---- write ---- */
const notes = new Map(BOOKS.map((b) => [b.id, {}]));
let placed = 0;
let outOfRange = 0;
BOOKS.forEach((book, b) => {
  const [i, jj] = span[b];
  const bucket = notes.get(book.id);
  for (let k = i; k < jj; k++) {
    for (const h of runs[k]) {
      const verses = book.chapters[h.ch - 1] || 0;
      if (h.ch > book.chapters.length || h.v > verses) { outOfRange++; continue; }
      const key = `${h.ch}:${h.v}`;
      bucket[key] = bucket[key] ? `${bucket[key]} ${h.text}` : h.text;
      // Keep the printed span ("9:14-16"), so the reader can mark every verse.
      if (h.tail) bucket[key + '@'] = h.tail;
      placed++;
    }
  }
});

/* ---- refuse to ship what cannot be shown right ----
   A correctly attributed book runs from its opening chapters to its last: this
   edition annotates throughout. A book that fails is dropped and named, never
   published. */
const rejected = [];
for (const book of BOOKS) {
  const bucket = notes.get(book.id);
  const keys = Object.keys(bucket).filter((k) => !k.endsWith('@')).map((k) => k.split(':').map(Number));
  if (!keys.length) continue;
  keys.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const firstCh = keys[0][0];
  const lastCh = keys[keys.length - 1][0];
  const total = book.chapters.length;
  const spans = firstCh <= 3 && lastCh >= Math.max(1, Math.floor(total * 0.7));
  if (!spans) {
    rejected.push(`${book.id} (${keys.length} notes, ${firstCh}..${lastCh} of ${total})`);
    notes.set(book.id, {});
  }
}

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'www', 'bible', 'notes');
fs.mkdirSync(OUT, { recursive: true });
let bytes = 0;
let withNotes = 0;
const counts = {};
for (const b of BOOKS) {
  const obj = notes.get(b.id);
  const json = JSON.stringify(obj);
  bytes += json.length;
  counts[b.id] = Object.keys(obj).filter((k) => !k.endsWith('@')).length;
  if (counts[b.id]) withNotes++;
  fs.writeFileSync(path.join(OUT, `${b.id}.json`), json);
}
fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify(counts));

console.log(`refs seen        ${hits.length}`);
console.log(`look like notes  ${kept.length}`);
console.log(`runs             ${R}  ->  assigned across ${B} books`);
console.log(`notes written    ${placed}`);
console.log(`out of range     ${outOfRange}`);
console.log(`books with notes ${withNotes}/${B}`);
console.log(`size             ${(bytes / 1e6).toFixed(2)} MB`);
if (rejected.length) {
  console.log('\nNOT published, attribution could not be verified:');
  for (const r of rejected) console.log('  ' + r);
}
console.log('\nper book:');
for (const b of BOOKS) console.log(`  ${b.id.padEnd(5)} ${String(counts[b.id]).padStart(4)}  ${b.name}`);
