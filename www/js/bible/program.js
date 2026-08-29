// Bible domain: what you have read and how far through the canon it puts you.
// The unit is the chapter. There is no plan: the book already has an order.

import * as store from '../store.js';
import { BOOKS } from './canon.js';
import { scheduleDaily, cancelAlarm, ALARM_BIBLE } from '../native.js';

export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;

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

/** Books finished. */
export function booksFinished() {
  return BOOKS.filter((b) => bookProgress(b.id).read >= b.chapters.length).length;
}

/* ---------------- marking ---------------- */

function dayEntry(st, key) {
  const days = st.bible.days;
  if (!days[key]) days[key] = { chapters: [] };
  return days[key];
}

/** Idempotent, and records the day for the heatmap and the log. */
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

/** Unmark. Mis-taps happen, and the day loses it too. */
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

/** Anything read on a day. */
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

/** 13-week heatmap data. */
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

/** Where you were. Defaults to the beginning. */
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

/** The next chapter, rolling into the next book. */
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

/* ---------------- reminder ---------------- */

export function syncAlarm() {
  const s = store.get().bible.settings;
  if (!s.remind || !/^\d{2}:\d{2}$/.test(s.remindAt)) return cancelAlarm(ALARM_BIBLE);
  const [h, m] = s.remindAt.split(':').map(Number);
  return scheduleDaily(ALARM_BIBLE, h, m, 'NiFo', "Today's reading.");
}

export { BOOKS };
