// What a week is worth: the roster, the days each row owed, and the score.
// Reads the record, never writes it. The writes are ledger.js's.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import { weekStart, weekEnd, weekDays, weekKey, weeksOfMonth, currentWeek } from './calendar.js';

/** Two floors: three days owed and four cells owed. One alone lets a single
 *  daily habit fail, or a skipped fortnight pass. */
export const VOID_CELLS = 4;
export const VOID_DAYS = 3;

/* --------------------- the roster --------------------- */

/** The first and last day a row was on the grid, as day keys. */
const bornOn = (h) => store.dayKey(new Date(h.createdAt || 0));
const leftOn = (h) => (h.archived && h.archivedAt ? store.dayKey(new Date(h.archivedAt)) : null);

/** Every row that was on the grid at any point during the week.
 *
 *  A row owes only the days it existed for, which is what makes one rule do
 *  both jobs. Adding a habit on Wednesday cannot lose you Monday and Tuesday,
 *  because it was never due then; archiving on Wednesday cannot erase them,
 *  because it was. The old rule cut any habit created inside the week, which
 *  left a new install with an empty roster and no scoreable first week. */
export function rosterFor(key) {
  const from = weekStart(key);
  const to = weekEnd(key);
  return habits.all().filter((h) => {
    if (bornOn(h) > to) return false; // added after the final whistle
    const left = leftOn(h);
    // No archive date means it left before the week. The safe reading.
    if (h.archived && !left) return false;
    return !left || left >= from;
  });
}

/** The days of `key` this row was both alive for and answerable on. */
function owedDays(h, key, today, sum) {
  const born = bornOn(h);
  const left = leftOn(h);
  return weekDays(key).filter(
    (d) => d <= today && d >= born && (!left || d <= left) && !sum?.index.get(d)?.skipped
  );
}

/* ---------------------- scoring ---------------------- */

export function scoreWeek(key) {
  const today = habits.today();
  const roster = rosterFor(key);
  const rows = [];
  const days = new Set();
  let done = 0;
  let due = 0;
  for (const h of roster) {
    const sum = habits.summary(h);
    const live = owedDays(h, key, today, sum);
    for (const d of live) days.add(d);
    const { num, den } = h.freq || { num: 1, den: 1 };

    let rDone;
    let rDue;
    if (den > 1) {
      // Five in seven owes five cells, and does not care which five.
      // Not the engine's satisfied count: its window is trailing, so the same five
      // days scored 100% Mon-Fri and 71% Wed-Sun. Right for a running score, wrong
      // for a fixed week. Floored, so slack is real until Sunday.
      rDue = Math.floor((num * live.length) / den);
      const hits = live.filter((d) => sum?.index.get(d)?.hit).length;
      rDone = Math.min(hits, rDue);
    } else {
      rDue = live.length;
      rDone = live.filter((d) => sum?.index.get(d)?.satisfied).length;
    }

    if (rDue) rows.push({ id: h.id, name: h.name, colour: h.colour, done: rDone, due: rDue });
    done += rDone;
    due += rDue;
  }
  return { key, done, due, days: days.size, score: due ? done / due : 0, void: due < VOID_CELLS || days.size < VOID_DAYS, rows };
}

/** What each day of the week held: how many of the roster you actually did.
 *  A count, not a score. A four-a-week habit not done on Tuesday is not a miss,
 *  so a per-day percentage would lie about the day. */
export function weekShape(key) {
  const today = habits.today();
  const sums = rosterFor(key).map((h) => habits.summary(h)).filter(Boolean);
  return weekDays(key).map((d) => {
    let done = 0;
    let skipped = 0;
    for (const s of sums) {
      const cell = s.index.get(d);
      if (cell?.skipped) skipped++;
      else if (cell?.hit) done++;
    }
    return { key: d, done, skipped, of: sums.length, future: d > today };
  });
}

/* ------------------- the record, read ------------------- */

/** Stored wins over live: a closed week is a fact, not a view. */
export function weekScore(key) {
  const saved = store.get().arena.weeks[key];
  if (saved) return { key, ...saved, void: saved.result === 'void' };
  return scoreWeek(key);
}

export const storedWeeks = () => store.get().arena.weeks;

/** Any record at all? Void weeks do not count. */
export const hasRecord = () => playedWeeks().length > 0;

/** Every scored week, newest first, voids left out. */
export function playedWeeks() {
  return Object.entries(storedWeeks())
    .filter(([, w]) => w.result !== 'void' && w.due >= VOID_CELLS)
    .map(([key, w]) => ({ key, ...w }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** Mean of its weeks, not one recomputed percentage: each week had a fixed roster. */
export function monthScore(month) {
  const keys = weeksOfMonth(month);
  const scored = keys.map(weekScore).filter((w) => !w.void && w.due >= VOID_CELLS);
  if (!scored.length) return { month, score: 0, weeks: 0, w: 0, l: 0, empty: true };
  const score = scored.reduce((a, w) => a + w.score, 0) / scored.length;
  const w = keys.filter((k) => storedWeeks()[k]?.result === 'won').length;
  const l = keys.filter((k) => storedWeeks()[k]?.result === 'lost').length;
  return { month, score, weeks: scored.length, w, l, empty: false };
}

/* ---------------- where the record begins ---------------- */

/** Earliest recorded day across every row. */
export function firstRecordDay() {
  let earliest = null;
  for (const h of habits.all()) {
    const sum = habits.summary(h);
    const first = sum?.days.find((d) => d.raw !== undefined);
    if (first && (!earliest || first.key < earliest)) earliest = first.key;
  }
  return earliest;
}

/** The oldest week with any data. */
export function firstWeekWithData() {
  const first = firstRecordDay();
  return first ? weekKey(first) : currentWeek();
}

/** Did anything actually get answered in this week? A roster that merely
 *  existed is not a week you played, and scoring one invents a defeat. */
export function weekHasEntries(key) {
  const days = weekDays(key);
  return habits.all().some((h) => {
    const sum = habits.summary(h);
    return !!sum && days.some((d) => sum.index.get(d)?.raw !== undefined);
  });
}
