// The Arena's calendar: ISO weeks, the months they file under, and the arcs
// laid over them. Dates only, no scores. What a week is worth lives in
// scoring.js; who you play lives in fixtures.js.

import * as store from '../store.js';
import * as habits from '../habits/program.js';

/* ----------------------- weeks ----------------------- */

const asDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Monday = 0. */
const isoDay = (dt) => (dt.getDay() + 6) % 7;

/** Monday of ISO week 1. */
function week1Monday(year) {
  const jan4 = new Date(year, 0, 4);
  return new Date(year, 0, 4 - isoDay(jan4));
}

export function weekKey(dayKey = habits.today()) {
  const dt = asDate(dayKey);
  // The Thursday decides the year.
  const thu = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - isoDay(dt) + 3);
  const year = thu.getFullYear();
  // Rounded: a DST change inside the span would drop a week.
  const n = Math.round((thu - week1Monday(year)) / (7 * 864e5)) + 1;
  return `${year}-W${String(n).padStart(2, '0')}`;
}

export function weekStart(key) {
  const [y, w] = key.split('-W').map(Number);
  const mon = week1Monday(y);
  return store.dayKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + (w - 1) * 7));
}

export const weekEnd = (key) => store.addDays(weekStart(key), 6);

export function weekDays(key) {
  const from = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => store.addDays(from, i));
}

/** The month a week belongs to, by its Thursday. */
export function monthOfWeek(key) {
  const thu = store.addDays(weekStart(key), 3);
  return thu.slice(0, 7);
}

export const currentWeek = () => weekKey(habits.today());
export const prevWeek = (key) => weekKey(store.addDays(weekStart(key), -1));
export const nextWeek = (key) => weekKey(store.addDays(weekStart(key), 7));

/** Has this week finished? */
export const weekClosed = (key) => weekEnd(key) < habits.today();

/** A week's dates, as a fixture list writes them.
 *  formatRange drops the repeated month by the locale's own rule. Hand-rolling
 *  that assumed the day comes first, which gave "24 – Aug 30" on en-US and
 *  "24 – 8月30日" on ja-JP. */
const RANGE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function weekLabel(key) {
  const a = asDate(weekStart(key));
  const b = asDate(weekEnd(key));
  return RANGE.formatRange ? RANGE.formatRange(a, b) : `${RANGE.format(a)} – ${RANGE.format(b)}`;
}

export function daysLeftInWeek() {
  const today = habits.today();
  const days = weekDays(currentWeek()).filter((d) => d >= today);
  return days.length;
}

/** Whole days to a day key, never negative. */
export function daysUntil(key) {
  const today = habits.today();
  if (key <= today) return 0;
  let n = 0;
  let k = today;
  while (k < key && n < 400) {
    n++;
    k = store.addDays(k, 1);
  }
  return n;
}

/* ---------------- months ---------------- */

export function weeksOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const out = [];
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const k = weekKey(store.dayKey(new Date(y, m - 1, d)));
    if (monthOfWeek(k) === month && !out.includes(k)) out.push(k);
  }
  return out;
}

export const currentMonth = () => monthOfWeek(currentWeek());

/* ------------------------ arcs ------------------------ */

// Three cups a year. Summer is a quarter with no tournament in it: the calendar
// still names it, so every function here stays total, but `cup` is what decides
// whether anything is played.
export const ARCS = [
  { id: 'winter', name: 'Winter Arc', from: 11, to: 1, cup: true }, // Dec, Jan, Feb
  { id: 'spring', name: 'Spring Arc', from: 2, to: 4, cup: true },
  { id: 'summer', name: 'Summer', from: 5, to: 7, cup: false },
  { id: 'autumn', name: 'Autumn Arc', from: 8, to: 10, cup: true },
];

/** The three that are played, in calendar order. */
export const CUPS = ARCS.filter((a) => a.cup);

/** The arc a month is in. Winter crosses New Year, so it files under December. */
export function arcOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const mi = m - 1;
  if (mi === 11) return { ...ARCS[0], year: y };
  if (mi <= 1) return { ...ARCS[0], year: y - 1 };
  const arc = ARCS.find((a) => mi >= a.from && mi <= a.to) || ARCS[1];
  return { ...arc, year: y };
}

export const arcKey = (arc) => `${arc.year}-${arc.id}`;

export function arcLabel(arc) {
  return arc.id === 'winter' ? `${arc.name} ${arc.year}/${String(arc.year + 1).slice(2)}` : `${arc.name} ${arc.year}`;
}

/** Off-season. Without it you are always in a cup, so a cup is never entered. */
export const ARC_BREAK = 2;

/** Every week of an arc, in order. */
export function arcWeeks(arc) {
  const months = arc.id === 'winter'
    ? [`${arc.year}-12`, `${arc.year + 1}-01`, `${arc.year + 1}-02`]
    : [arc.from, arc.from + 1, arc.to].map((m) => `${arc.year}-${String(m + 1).padStart(2, '0')}`);
  return months.flatMap(weeksOfMonth);
}

/** The quarter less its break. Floored at four so there is always a group stage.
 *  A quarter with no cup in it is season-less: every week of it is off-season. */
export function arcSeason(arc) {
  if (!arc.cup) return [];
  const weeks = arcWeeks(arc);
  return weeks.slice(0, Math.max(4, weeks.length - ARC_BREAK));
}

/** Group stage: the season less its last three weeks. */
export const arcGroupWeeks = (arc) => arcSeason(arc).slice(0, -3);

/** Where a week sits: group, knockout, or the break. */
export function arcStage(key) {
  const arc = arcOfMonth(monthOfWeek(key));
  const weeks = arcWeeks(arc);
  const season = arcSeason(arc);
  const i = season.indexOf(key);
  if (i < 0) return { arc, weeks, season, stage: 'break', index: -1 };
  const fromEnd = season.length - 1 - i;
  const stage = fromEnd === 0 ? 'final' : fromEnd === 1 ? 'sf' : fromEnd === 2 ? 'qf' : 'group';
  return { arc, weeks, season, stage, index: i };
}

/** The next cup. Summer holds no cup, so it is stepped over rather than counted
 *  down to: a countdown to a tournament that never opens is a lie. */
export function nextArc(arc) {
  let cursor = arc;
  for (let i = 0; i < ARCS.length; i++) {
    cursor = stepArc(cursor, 1);
    if (cursor.cup) return cursor;
  }
  return { ...ARCS[0], year: arc.year };
}

/** The cup before this one, for the quarter-final's opponent. */
export function previousArc(arc) {
  let cursor = arc;
  for (let i = 0; i < ARCS.length; i++) {
    cursor = stepArc(cursor, -1);
    if (cursor.cup) return cursor;
  }
  return { ...ARCS[0], year: arc.year - 1 };
}

/** One quarter forward or back, cup or not.
 *
 *  ARCS is not in chronological order: winter is filed under its own December
 *  and runs into the next year, so within a filing year it comes last, after
 *  autumn. Stepping has to walk that order, not the array's. */
const ARC_ORDER = ['spring', 'summer', 'autumn', 'winter'];

function stepArc(arc, dir) {
  const i = ARC_ORDER.indexOf(arc.id);
  const j = (i + dir + ARC_ORDER.length) % ARC_ORDER.length;
  // The only year change is the winter wrap, in either direction.
  const year = arc.year + (dir > 0 && j === 0 ? 1 : dir < 0 && i === 0 ? -1 : 0);
  return { ...ARCS.find((a) => a.id === ARC_ORDER[j]), year };
}
