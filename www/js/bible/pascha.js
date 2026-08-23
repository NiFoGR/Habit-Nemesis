// The church calendar: where today sits in the year, and which readings the
// lectionary appoints for it.
//
// Everything in the Orthodox year hangs off one date. Pascha moves, the ten
// weeks before it and the thirty-nine after it move with it, and the feasts
// pinned to calendar dates cut across the lot. So this module computes Pascha
// and then measures every other question in days from it.
//
// Two honest limits, stated here and again on screen:
//   * the OSB prints its lectionary "strictly as a rough guide for personal
//     reading", not for liturgical use, and jurisdictions differ;
//   * the number of weeks between Pentecost and the next Triodion varies, so
//     late in the year the Pentecost cycle runs out before the Triodion starts.
// Neither is a bug to be papered over. The app says which day it is showing
// and links to goarch.org for the authoritative one.

import { MOVABLE, FIXED, AROUND } from './lectionary.js';

const DAY = 86400000;

/** Orthodox Pascha, as a UTC midnight Date.
 *
 *  Meeus's algorithm gives the date on the Julian calendar, which is what the
 *  Orthodox reckoning uses. Converting through the Julian day number rather
 *  than adding a hard-coded thirteen days keeps it right either side of 2100,
 *  where that offset changes. */
export function pascha(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  const q = Math.floor((14 - month) / 12);
  const y = year + 4800 - q;
  const m = month + 12 * q - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return new Date((jdn - 2440588) * DAY);
}

/** Midnight UTC for a local date, so day arithmetic never trips over a clock
 *  change. Comparing calendar days is the only thing these dates are used for. */
function utcMidnight(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Days from the Pascha that governs `date`. Negative before it.
 *
 *  A day in, say, February belongs to the cycle of the Pascha still to come,
 *  not the one ten months back, so the year is chosen by which Pascha the day
 *  is nearer the front of. */
export function paschaOffset(date = new Date()) {
  const d = utcMidnight(date);
  const y = d.getUTCFullYear();
  let p = pascha(y);
  // Before this year's Pascha the day may still belong to last year's cycle
  // (anything past its Triodion start counts forward from the coming Pascha).
  if (d < p) {
    const prev = pascha(y - 1);
    const sincePrev = Math.round((d - prev) / DAY);
    const toNext = Math.round((d - p) / DAY);
    // -77 is the day before the Triodion opens; past that the new cycle owns it
    return toNext >= -77 ? toNext : sincePrev;
  }
  const next = pascha(y + 1);
  const toNext = Math.round((d - next) / DAY);
  if (toNext >= -77) return toNext;
  return Math.round((d - p) / DAY);
}

/* ---------------- seasons ---------------- */

/** What the church calls this stretch of the year, and whether it is a fast.
 *  The fasts here are the four seasonal ones plus the ordinary Wednesday and
 *  Friday; it is a reminder of where you are, not a rule book. */
export function season(date = new Date()) {
  const off = paschaOffset(date);
  const d = utcMidnight(date);
  const month = d.getUTCMonth() + 1;
  const dom = d.getUTCDate();
  const dow = d.getUTCDay();

  let name = '';
  let fast = null;

  if (off >= -70 && off <= -49) name = 'The Triodion';
  else if (off >= -48 && off <= -8) { name = 'Great Lent'; fast = 'Great Lent'; }
  else if (off === -7) name = 'Palm Sunday';
  else if (off >= -6 && off <= -1) { name = 'Holy Week'; fast = 'Holy Week'; }
  else if (off === 0) name = 'Pascha';
  else if (off >= 1 && off <= 6) name = 'Bright Week';
  else if (off >= 7 && off <= 38) name = 'The Pentecostarion';
  else if (off >= 39 && off <= 48) name = 'After the Ascension';
  else if (off === 49) name = 'Pentecost';
  else {
    const week = Math.ceil((off - 49) / 7);
    if (week >= 1 && week <= 40) name = `Week ${week} after Pentecost`;
  }

  // Seasonal fasts that are fixed to the calendar rather than to Pascha.
  if (!fast) {
    if (month === 8 && dom <= 14) fast = 'The Dormition Fast';
    else if ((month === 11 && dom >= 15) || (month === 12 && dom <= 24)) fast = 'The Nativity Fast';
    // The Apostles' Fast runs from the Monday after All Saints to 28 June, so
    // its length changes with Pascha and can vanish entirely in a late year.
    // It only ever falls in May or June, which is what keeps a day 250-odd
    // days past Pascha, in January, from matching on the offset alone.
    else if (off >= 57 && (month === 5 || (month === 6 && dom <= 28))) fast = "The Apostles' Fast";
  }
  // Bright Week and the week after Pentecost are fast-free by rule, and so is
  // the stretch from the Nativity to Theophany.
  const fastFree = (off >= 0 && off <= 6) || (off >= 49 && off <= 55)
    || (month === 12 && dom >= 25) || (month === 1 && dom <= 4)
    || (month === 1 && dom === 6);   // Theophany itself, though its eve is a strict fast
  if (!fast && !fastFree && (dow === 3 || dow === 5)) fast = dow === 3 ? 'Wednesday' : 'Friday';
  if (fastFree) fast = null;

  return { name, fast, fastFree, offset: off };
}

/* ---------------- the day's readings ---------------- */

const movableByOffset = new Map(MOVABLE.map((r) => [r[0], { title: r[1], readings: r[2] }]));

/** The nth given weekday before or after a fixed feast, as a UTC date. */
function weekdayAround(feast, side, weekday, nth) {
  const target = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }[weekday];
  const d = new Date(feast.getTime());
  const step = side === 'before' ? -1 : 1;
  let seen = 0;
  do {
    d.setUTCDate(d.getUTCDate() + step);
    if (d.getUTCDay() === target) seen++;
  } while (seen < nth);
  return d;
}

const sameDay = (a, b) => a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

/** Everything the lectionary appoints for a date, most specific first.
 *
 *  A fixed feast supersedes the Pentecost cycle, which is why they come back
 *  as a list rather than as one answer: on 15 August you get the Dormition,
 *  and the day's place in the cycle is still worth seeing underneath it. */
export function readingsFor(date = new Date()) {
  const d = utcMidnight(date);
  const out = [];

  for (const [month, day, title, readings] of FIXED) {
    if (month === d.getUTCMonth() + 1 && day === d.getUTCDate()) out.push({ kind: 'feast', title, readings });
  }

  const year = d.getUTCFullYear();
  const nativity = new Date(Date.UTC(year, 11, 25));
  const theophany = new Date(Date.UTC(year, 0, 6));
  for (const [anchor, side, weekday, nth, title, readings] of AROUND) {
    const feast = anchor === 'nativity' ? nativity : theophany;
    if (sameDay(weekdayAround(feast, side, weekday, nth), d)) out.push({ kind: 'cycle', title, readings });
  }

  const off = paschaOffset(date);
  const m = movableByOffset.get(off);
  if (m) out.push({ kind: off === 0 || Math.abs(off) <= 7 ? 'feast' : 'day', title: m.title, readings: m.readings, offset: off });

  return out;
}

/** True when the Pentecost cycle has run past the end of the printed table.
 *  The OSB stops at the thirty-second week; in a year with a late Pascha there
 *  are more weeks than that before the next Triodion, and pretending otherwise
 *  would mean showing the wrong readings rather than none. */
export function beyondTable(date = new Date()) {
  const off = paschaOffset(date);
  return off > 273 || (off > 49 && !movableByOffset.has(off));
}
