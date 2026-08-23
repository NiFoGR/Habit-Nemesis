// Bible domain logic: what you have read, what today asks for, and how far
// through the canon that puts you.
//
// The unit of record is the chapter, because a chapter is the largest thing
// you can honestly say you either read or did not. Verses are too fine to tick
// and books are too coarse to feel like progress, and both would turn the
// tracker into a thing you argue with.
//
// The lectionary is the exception. It appoints passages, not chapters, so a
// ticked lectionary reading is recorded as the reference it is. It counts for
// the day and for the streak, and it deliberately does not colour in a chapter
// of the canon, because reading Romans 2:10-16 is not reading Romans 2.

import * as store from '../store.js';
import { BOOKS } from './canon.js';
import { PLANS, planById, unitsForDay, blocksForDay, planTotal } from './plans.js';
import { readingsFor, season, beyondTable, pascha } from './pascha.js';
import { scheduleDaily, cancelAlarm, ALARM_BIBLE } from '../native.js';

export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;

// The lectionary cites books by their familiar English names, while the Old
// Testament here is printed with its Septuagint ones, so "1 Kings 17" in a
// reading is 3 Kingdoms in the canon. This is the only place that difference
// has to be reconciled.
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
  if (!days[key]) days[key] = { chapters: [], refs: [] };
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

/** Ticks off one of the day's appointed readings. */
export function markRef(ref, key = store.dayKey()) {
  store.update((st) => {
    const day = dayEntry(st, key);
    if (!day.refs.includes(ref)) day.refs.push(ref);
    bumpStreak(st);
  });
}

export function unmarkRef(ref, key = store.dayKey()) {
  store.update((st) => {
    const day = st.bible.days[key];
    if (day) day.refs = day.refs.filter((r) => r !== ref);
    bumpStreak(st);
  });
}

export const refDone = (ref, key = store.dayKey()) => !!store.get().bible.days[key]?.refs.includes(ref);

/* ---------------- the day ---------------- */

/** Anything at all read on a day. */
export function dayRead(key = store.dayKey()) {
  const d = store.get().bible.days[key];
  if (!d) return { chapters: [], refs: [], any: false, count: 0 };
  return { chapters: d.chapters, refs: d.refs, any: !!(d.chapters.length || d.refs.length), count: d.chapters.length + d.refs.length };
}

function bumpStreak(st) {
  const days = st.bible.days;
  const any = (k) => !!(days[k] && (days[k].chapters.length || days[k].refs.length));
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
  const any = (k) => !!(days[k] && (days[k].chapters.length || days[k].refs.length));
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
    const n = d ? d.chapters.length + d.refs.length : 0;
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
    const n = d.chapters.length + d.refs.length;
    if (n) read++;
    items += n;
  }
  return { days, read, items, rate: days ? read / days : 0 };
}

/* ---------------- today's assignment ---------------- */

/** What the current plan asks for today, in a shape the screens can render
 *  without knowing which kind of plan it is. */
export function today(date = new Date()) {
  const st = store.get().bible;
  const plan = planById(st.settings.plan);
  const key = store.dayKey(date);

  if (plan.kind === 'free') {
    return { plan, kind: 'free', items: [], complete: false, behind: 0 };
  }

  if (plan.kind === 'date') {
    const appointed = readingsFor(date);
    const items = appointed.map((r) => ({ type: 'ref', id: r.title, label: r.title, detail: r.readings, kind: r.kind }));
    return {
      plan,
      kind: 'date',
      items,
      season: season(date),
      gap: beyondTable(date),
      complete: items.length > 0 && items.every((i) => refDone(i.id, key)),
      behind: 0,
    };
  }

  const n = st.planDone + 1;
  const units = unitsForDay(plan, n);
  const items = units.map((u) => ({ type: 'chapter', id: u, label: refName(u) }));
  const elapsed = daysSince(st.settings.planStart) + 1;
  const total = planTotal(plan);

  return {
    plan,
    kind: plan.kind,
    day: n,
    of: plan.kind === 'sequence' ? plan.days : 0,
    blocks: blocksForDay(plan, n),
    items,
    complete: items.length > 0 && items.every((i) => chapterRead(...i.id.split(':'))),
    behind: Math.max(0, elapsed - n),
    done: st.planDone,
    total,
  };
}

function daysSince(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 0;
  const [y, m, d] = key.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - then) / 86400000));
}

/** Advances the plan by one day. Called when the day's readings are all done,
 *  never by the calendar, so a missed day postpones the plan rather than
 *  deleting a day out of it. */
export function completePlanDay() {
  store.update((st) => {
    st.bible.planDone += 1;
  });
}

export function setPlan(id) {
  store.update((st) => {
    st.bible.settings.plan = planById(id).id;
    st.bible.settings.planStart = store.dayKey();
    st.bible.planDone = 0;
  });
  syncAlarm();
}

/* ---------------- reading position ---------------- */

/** The next unread chapter in canonical order, for the "carry on" button. */
export function nextUnread() {
  for (const b of BOOKS) {
    for (let c = 1; c <= b.chapters.length; c++) {
      if (!chapterRead(b.id, c)) return `${b.id}:${c}`;
    }
  }
  return null;
}

/** The book you were last reading, which is usually where you want to go. */
export function lastBook() {
  const days = store.get().bible.days;
  const keys = Object.keys(days).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const ch = days[keys[i]].chapters;
    if (ch.length) return ch[ch.length - 1].split(':')[0];
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

export { PLANS, planById, season, pascha, readingsFor };
