// Bible domain logic: what you have read, what today asks for, and how far
// through the canon that puts you.
//
// The unit of record is the chapter, because a chapter is the largest thing
// you can honestly say you either read or did not. Verses are too fine to tick
// and books are too coarse to feel like progress, and both would turn the
// tracker into a thing you argue with.
//
// There is no reading plan. The book runs Genesis to Revelation and so does
// the reader; what it keeps is where you are and what you have already been
// through, which is all a plan was ever standing in for.

import * as store from '../store.js';
import { BOOKS } from './canon.js';
import { scheduleDaily, cancelAlarm, ALARM_BIBLE } from '../native.js';

export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;

// References cite books by their familiar English names, while the Old
// Testament here is printed with its Septuagint ones, so "1 Kings 17" means
// 3 Kingdoms. This is the only place that difference has to be reconciled.
const ALIASES = new Map([
  ['1 samuel', '1ki'], ['2 samuel', '2ki'], ['1 kings', '3ki'], ['2 kings', '4ki'],
  ['3 kings', '3ki'], ['4 kings', '4ki'], ['1 kingdoms', '1ki'], ['2 kingdoms', '2ki'],
  ['3 kingdoms', '3ki'], ['4 kingdoms', '4ki'],
  ['proverbs', 'pro'], ['lamentations', 'lam'], ['ecclesiasticus', 'sir'], ['sirach', 'sir'],
  ['1 esdras', '1es'], ['2 esdras', '2es'], ['ezra', '2es'], ['esdras', '2es'],
  ['song of solomon', 'sng'], ['canticles', 'sng'], ['psalm', 'psa'], ['psalms', 'psa'],
  // The OSB prints "Hebrew 2:2-10" for one of the fixed feasts. It means Hebrews.
  ['hebrew', 'heb'], ['revelation of john', 'rev'], ['apocalypse', 'rev'],
]);
for (const b of BOOKS) {
  ALIASES.set(b.name.toLowerCase(), b.id);
  if (b.also) ALIASES.set(b.also.toLowerCase(), b.id);
}

/** A book from however a reference happens to spell it. */
export const bookByName = (name) => bookById(ALIASES.get(String(name).trim().toLowerCase()) || '');

// Longest names first, so "1 Corinthians" is not matched as "Corinthians" and
// "Song of Songs" is not matched as "Song".
const NAME_RE = new RegExp(
  `\\b(${[...ALIASES.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

/** Turns "Romans 2:10-16; Matthew 4:18-23" into the same text with each book
 *  name linked to its context screen. The text is escaped first: these strings
 *  come from a data file, but they end up in innerHTML like everything else. */
export function linkRefs(text, escape) {
  return escape(text).replace(NAME_RE, (m) => {
    const id = ALIASES.get(m.toLowerCase());
    return id ? `<a class="reflink" href="#/bible/book?id=${id}">${m}</a>` : m;
  });
}

export const SECTIONS = [
  { id: 'law', name: 'The Law' },
  { id: 'history', name: 'History' },
  { id: 'wisdom', name: 'Wisdom' },
  { id: 'prophets', name: 'The Prophets' },
  { id: 'gospels', name: 'The Gospels' },
  { id: 'acts', name: 'Acts' },
  { id: 'epistles', name: 'The Epistles' },
  { id: 'revelation', name: 'Revelation' },
];

export const TOTAL_CHAPTERS = BOOKS.reduce((a, b) => a + b.chapters.length, 0);

/** "gen:12" as a readable reference. */
export function refName(unit) {
  const [id, ch] = unit.split(':');
  const b = bookById(id);
  if (!b) return unit;
  if (b.chapters.length === 1) return b.name;
  return b.id === 'psa' ? `Psalm ${ch}` : `${b.name} ${ch}`;
}

/* ---------------- what has been read ---------------- */

export const chapterRead = (id, ch) => !!store.get().bible.read[id]?.[ch];

export function bookProgress(id) {
  const b = bookById(id);
  if (!b) return { read: 0, total: 0, frac: 0 };
  const map = store.get().bible.read[id] || {};
  const read = Object.keys(map).length;
  return { read, total: b.chapters.length, frac: b.chapters.length ? read / b.chapters.length : 0 };
}

export function sectionProgress(section) {
  const books = BOOKS.filter((b) => b.section === section);
  const total = books.reduce((a, b) => a + b.chapters.length, 0);
  const read = books.reduce((a, b) => a + bookProgress(b.id).read, 0);
  return { read, total, frac: total ? read / total : 0 };
}

export function overallProgress() {
  const read = BOOKS.reduce((a, b) => a + bookProgress(b.id).read, 0);
  return { read, total: TOTAL_CHAPTERS, frac: TOTAL_CHAPTERS ? read / TOTAL_CHAPTERS : 0 };
}

/** Books finished, which is the milestone that actually feels like one. */
export function booksFinished() {
  return BOOKS.filter((b) => bookProgress(b.id).read >= b.chapters.length).length;
}

/* ---------------- marking ---------------- */

function dayEntry(st, key) {
  const days = st.bible.days;
  if (!days[key]) days[key] = { chapters: [] };
  return days[key];
}

/** Marks a chapter read. Idempotent, and records the day it happened on so the
 *  heatmap and the log have something to show. */
export function markChapter(id, ch, key = store.dayKey()) {
  const b = bookById(id);
  if (!b || ch < 1 || ch > b.chapters.length) return;
  store.update((st) => {
    if (!st.bible.read[id]) st.bible.read[id] = {};
    if (st.bible.read[id][ch]) return;
    st.bible.read[id][ch] = Date.now();
    const day = dayEntry(st, key);
    const unit = `${id}:${ch}`;
    if (!day.chapters.includes(unit)) day.chapters.push(unit);
    bumpStreak(st);
  });
}

/** Unmarks a chapter. Kept because mis-taps happen and a tracker you cannot
 *  correct is one you stop trusting. The day's log loses it too. */
export function unmarkChapter(id, ch) {
  store.update((st) => {
    if (st.bible.read[id]) delete st.bible.read[id][ch];
    const unit = `${id}:${ch}`;
    for (const day of Object.values(st.bible.days)) {
      day.chapters = day.chapters.filter((u) => u !== unit);
    }
    bumpStreak(st);
  });
}

/* ---------------- the day ---------------- */

/** Anything at all read on a day. */
export function dayRead(key = store.dayKey()) {
  const d = store.get().bible.days[key];
  if (!d) return { chapters: [], any: false, count: 0 };
  return { chapters: d.chapters, any: d.chapters.length > 0, count: d.chapters.length };
}

function bumpStreak(st) {
  const days = st.bible.days;
  const any = (k) => !!days[k]?.chapters.length;
  let cursor = store.dayKey();
  if (!any(cursor)) cursor = store.addDays(cursor, -1);
  let n = 0;
  while (any(cursor)) {
    n++;
    cursor = store.addDays(cursor, -1);
  }
  st.bible.streak = n;
  if (n > st.bible.best) st.bible.best = n;
}

export function streak() {
  const days = store.get().bible.days;
  const any = (k) => !!days[k]?.chapters.length;
  let cursor = store.dayKey();
  if (!any(cursor)) cursor = store.addDays(cursor, -1);
  let n = 0;
  while (any(cursor)) {
    n++;
    cursor = store.addDays(cursor, -1);
  }
  return n;
}

/** Grid data for the 13-week heatmap: how much was read on each day. */
export function history(weeks = 13) {
  const days = store.get().bible.days;
  const out = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const key = store.addDays(store.dayKey(), -i);
    const d = days[key];
    const n = d ? d.chapters.length : 0;
    out.push({ key, n, cls: n === 0 ? 'none' : n < 2 ? 'l1' : n < 4 ? 'l2' : n < 7 ? 'l3' : 'l4' });
  }
  return out;
}

export function totals(days = 30) {
  const map = store.get().bible.days;
  let read = 0;
  let items = 0;
  for (let i = 0; i < days; i++) {
    const d = map[store.addDays(store.dayKey(), -i)];
    if (!d) continue;
    const n = d.chapters.length;
    if (n) read++;
    items += n;
  }
  return { days, read, items, rate: days ? read / days : 0 };
}

/* ---------------- where you are ---------------- */

/** The chapter you were last on. Defaults to the very beginning. */
export function position() {
  const p = store.get().bible.position;
  return bookById(p?.book) ? p : { book: BOOKS[0].id, ch: 1 };
}

export function setPosition(book, ch) {
  if (!bookById(book)) return;
  store.update((st) => {
    st.bible.position = { book, ch };
  });
}

/** The next chapter in the whole canon, rolling on into the next book. */
export function nextChapter(book, ch) {
  const i = BOOKS.findIndex((b) => b.id === book);
  if (i < 0) return null;
  if (ch < BOOKS[i].chapters.length) return { book, ch: ch + 1 };
  const nb = BOOKS[i + 1];
  return nb ? { book: nb.id, ch: 1 } : null;
}

export function previousChapter(book, ch) {
  const i = BOOKS.findIndex((b) => b.id === book);
  if (i < 0) return null;
  if (ch > 1) return { book, ch: ch - 1 };
  const pb = BOOKS[i - 1];
  return pb ? { book: pb.id, ch: pb.chapters.length } : null;
}

/** The next chapter you have not read, for picking the thread back up. */
export function nextUnreadChapter() {
  for (const b of BOOKS) {
    for (let c = 1; c <= b.chapters.length; c++) {
      if (!chapterRead(b.id, c)) return { book: b.id, ch: c };
    }
  }
  return null;
}

/* ---------------- reminder ---------------- */

export function syncAlarm() {
  const s = store.get().bible.settings;
  if (!s.remind || !/^\d{2}:\d{2}$/.test(s.remindAt)) return cancelAlarm(ALARM_BIBLE);
  const [h, m] = s.remindAt.split(':').map(Number);
  return scheduleDaily(ALARM_BIBLE, h, m, 'NiFo', "Today's reading.");
}

export { BOOKS };
