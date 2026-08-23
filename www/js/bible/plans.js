// Reading plans.
//
// A plan answers one question: what am I reading today. There are two shapes
// of answer here and they work differently on purpose.
//
//   The lectionary is driven by the date. The church appoints what it appoints
//   for the fourteenth of August whether or not you read anything on the
//   thirteenth, so there is nothing to fall behind on and nothing to catch up.
//
//   Every other plan is driven by position. Today's reading is the next one you
//   have not done, never the one the calendar says you should be on. Skipping a
//   day must not skip a chapter, or a year-long plan quietly becomes a
//   ten-month plan with holes in it. The app tells you how far behind the
//   calendar you have drifted; it does not fix the number by throwing away
//   readings.

import { BOOKS } from './canon.js';

/** Every chapter of a set of books, in canonical order, as "id:n". */
function chapters(filter) {
  const out = [];
  for (const b of BOOKS) {
    if (!filter(b)) continue;
    for (let c = 1; c <= b.chapters.length; c++) out.push(`${b.id}:${c}`);
  }
  return out;
}

// The Psalter is divided into twenty kathismata, and praying one or three of
// them a day is how the Psalms have been read in the Church for centuries.
// These are the Septuagint numbers, which is what the OSB prints.
const KATHISMATA = [
  [1, 8], [9, 16], [17, 23], [24, 31], [32, 36], [37, 45], [46, 54], [55, 63],
  [64, 69], [70, 76], [77, 84], [85, 90], [91, 100], [101, 104], [105, 108],
  [109, 117], [118, 118], [119, 133], [134, 142], [143, 150],
];

const psalterWeek = () =>
  KATHISMATA.map(([a, b], i) => ({
    label: `Kathisma ${i + 1}`,
    units: Array.from({ length: b - a + 1 }, (_, k) => `psa:${a + k}`),
  }));

export const PLANS = [
  {
    id: 'lectionary',
    kind: 'date',
    name: 'The lectionary',
    short: 'Lectionary',
    blurb: "The day's appointed epistle and gospel, following the church year.",
    note: 'The OSB prints this as a guide for personal reading, not for liturgical use.',
  },
  {
    id: 'year',
    kind: 'sequence',
    name: 'The whole Bible in a year',
    short: 'Whole Bible, 1 year',
    blurb: 'All 76 books, Genesis to Revelation, about four chapters a day.',
    days: 365,
    units: () => chapters(() => true),
  },
  {
    id: 'twoyear',
    kind: 'sequence',
    name: 'The whole Bible in two years',
    short: 'Whole Bible, 2 years',
    blurb: 'The same ground at half the pace. Two chapters a day, most days.',
    days: 730,
    units: () => chapters(() => true),
  },
  {
    id: 'nt',
    kind: 'sequence',
    name: 'The New Testament in 90 days',
    short: 'New Testament, 90 days',
    blurb: 'Matthew to Revelation, three chapters a day.',
    days: 90,
    units: () => chapters((b) => ['gospels', 'acts', 'epistles', 'revelation'].includes(b.section)),
  },
  {
    id: 'gospels',
    kind: 'sequence',
    name: 'The four Gospels in a month',
    short: 'Gospels, 30 days',
    blurb: 'The place to start. Matthew, Mark, Luke and John in thirty days.',
    days: 30,
    units: () => chapters((b) => b.section === 'gospels'),
  },
  {
    id: 'psalter',
    kind: 'cycle',
    name: 'The Psalter in a week',
    short: 'Psalter, weekly',
    blurb: 'The twenty kathismata over seven days, the way the Church reads them.',
    days: 7,
    cycle: psalterWeek,
  },
  {
    id: 'free',
    kind: 'free',
    name: 'No plan',
    short: 'No plan',
    blurb: 'Read what you like. Chapters you mark still count toward the canon.',
  },
];

export const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[PLANS.length - 1];

/** The units of plan-day `n` (1-based).
 *
 *  Chapters are spread by cumulative division rather than a fixed per-day
 *  count, so a plan of 1,344 chapters over 365 days lands exactly on the last
 *  chapter on the last day instead of running out early with a stub week. */
export function unitsForDay(plan, n) {
  if (plan.kind === 'sequence') {
    const all = plan.units();
    const from = Math.floor(((n - 1) * all.length) / plan.days);
    const to = Math.floor((n * all.length) / plan.days);
    return all.slice(from, to);
  }
  if (plan.kind === 'cycle') {
    const week = plan.cycle();
    const perDay = Math.ceil(week.length / plan.days);
    const i = ((n - 1) % plan.days) * perDay;
    return week.slice(i, i + perDay).flatMap((k) => k.units);
  }
  return [];
}

/** The same day's units grouped into named blocks, for plans that have them. */
export function blocksForDay(plan, n) {
  if (plan.kind !== 'cycle') return null;
  const week = plan.cycle();
  const perDay = Math.ceil(week.length / plan.days);
  const i = ((n - 1) % plan.days) * perDay;
  return week.slice(i, i + perDay);
}

/** Total units in a plan, for progress. Cycles never end, so they have none. */
export function planTotal(plan) {
  return plan.kind === 'sequence' ? plan.units().length : 0;
}
