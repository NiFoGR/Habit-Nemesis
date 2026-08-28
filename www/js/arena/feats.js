// Feats. Not achievements.
//
// The app used to hand out badges from two separate places - fifteen in the
// kegel program, a handful more in PE - neither of which knew the other
// existed and neither of which was visible outside its own section. This
// replaces both, and raises the bar, using one test:
//
//   Could you say it out loud to another person and have it mean something?
//
// "Held a contraction for thirty seconds" passes. "Opened the app seven days
// running" does not: the second is a fact about using an app, and only the
// first is a fact about your life. That rule retires the participation
// trophies, including the one for finishing your first session.
//
// Every feat is a predicate over the record rather than a flag handed out by
// whichever screen happened to be open when it happened. Only the date each
// was first seen is stored, so a new one can be announced once - and if that
// is ever lost, the feats themselves recompute from the data.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import { dailyStretchTotals } from '../pe/program.js';
import * as arena from './program.js';
import { BOOKS } from '../bible/canon.js';
import { fmtHours } from '../ui.js';

/* ---------------- helpers the tests share ---------------- */

const chaptersRead = (id) => Object.keys(store.get().bible.read[id] || {}).length;
const bookDone = (id) => {
  const b = BOOKS.find((x) => x.id === id);
  return !!b && chaptersRead(id) >= b.chapters.length;
};
const booksDone = () => BOOKS.filter((b) => bookDone(b.id)).length;

const NEW_TESTAMENT = ['mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal', 'eph', 'php', 'col',
  '1th', '2th', '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', '2jn', '3jn', 'jud', 'rev'];
const GOSPELS = ['mat', 'mrk', 'luk', 'jhn'];
const TORAH = ['gen', 'exo', 'lev', 'num', 'deu'];

const allRead = (ids) => ids.every(bookDone);
const readOf = (ids) => ids.filter(bookDone).length;

const stretchMs = () => store.get().pe.sessions.filter((s) => s.type === 'stretch').reduce((a, s) => a + s.durationSec * 1000, 0);

/** The most consecutive days at or over the two-hour stretch target. The old
 *  achievement asked only about the last seven days, so it could be earned and
 *  then be untrue by the following Tuesday. */
function bestStretchRun(target = 2 * 3600000) {
  const days = Object.entries(
    store.get().pe.sessions.reduce((acc, s) => {
      if (s.type === 'stretch') acc[s.date] = (acc[s.date] || 0) + s.durationSec * 1000;
      return acc;
    }, {})
  ).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let best = 0;
  let run = 0;
  let prev = null;
  for (const [key, ms] of days) {
    const consecutive = prev && store.addDays(prev, 1) === key;
    run = ms >= target ? (consecutive ? run + 1 : 1) : 0;
    if (run > best) best = run;
    prev = key;
  }
  return best;
}

/** Growth on one measurement, first check-in to best, in centimetres. */
const grew = (key) => {
  const m = store.get().pe.measurements.filter((x) => x[key]);
  return m.length > 1 ? Math.max(...m.map((x) => x[key])) - m[0][key] : 0;
};

/** The longest run of consecutive days satisfying a predicate over day keys. */
function longestRun(has, days = 1200) {
  let best = 0;
  let run = 0;
  let key = store.addDays(habits.today(), -days);
  const end = habits.today();
  while (key <= end) {
    run = has(key) ? run + 1 : 0;
    if (run > best) best = run;
    key = store.addDays(key, 1);
  }
  return best;
}

const ruleKept = (key) => {
  const d = store.get().pray.days[key];
  return !!(d && d.morning && d.evening);
};

/** A day where every row on the grid came good. */
function perfectDays() {
  const rows = [...habits.linkedHabits(), ...habits.active()];
  if (!rows.length) return { best: 0, count: 0 };
  const sums = rows.map((h) => habits.summary(h));
  let count = 0;
  let best = 0;
  let run = 0;
  let key = store.addDays(habits.today(), -400);
  const end = habits.today();
  while (key <= end) {
    let due = 0;
    let ok = 0;
    for (const s of sums) {
      const d = s?.index.get(key);
      if (!d || d.skipped) continue;
      due++;
      if (d.satisfied) ok++;
    }
    const perfect = due >= 3 && ok === due;
    if (perfect) count++;
    run = perfect ? run + 1 : 0;
    if (run > best) best = run;
    key = store.addDays(key, 1);
  }
  return { best, count };
}

const arenaState = () => store.get().arena;
const reachedDivision = (id) => {
  const want = arena.divisionIndex(id);
  if (arena.divisionIndex(arenaState().division) >= want) return true;
  return Object.values(arenaState().months).some((m) => arena.divisionIndex(m.to) >= want);
};
const arcsWon = () => Object.values(arenaState().arcs).filter((a) => a.won).length;

/* ---------------- the catalogue ----------------
   `at` is the number the feat needs and `now` is where you are, so a locked
   feat can show how far off it is instead of just sitting there greyed out.
   Anything without them is pass or fail and says so. */

export const FEATS = [
  /* --- Kegels --- */
  { id: 'hold20', section: 'Kegels', icon: 'timer', name: 'Twenty seconds',
    blurb: 'Held a single contraction for twenty seconds.',
    now: () => store.get().prs.maxHoldMs / 1000, at: 20, unit: 's' },
  { id: 'hold30', section: 'Kegels', icon: 'timer', name: 'Half a minute',
    blurb: 'Held a single contraction for thirty seconds.',
    now: () => store.get().prs.maxHoldMs / 1000, at: 30, unit: 's' },
  { id: 'hold60', section: 'Kegels', icon: 'flame', name: 'A full minute',
    blurb: 'Held a single contraction for sixty seconds. Very few people can.',
    now: () => store.get().prs.maxHoldMs / 1000, at: 60, unit: 's' },
  { id: 'reps1k', section: 'Kegels', icon: 'target', name: 'A thousand reps',
    blurb: 'A thousand contractions, counted one at a time.',
    now: () => store.totals().contractions, at: 1000 },
  { id: 'reps10k', section: 'Kegels', icon: 'target', name: 'Ten thousand reps',
    blurb: 'Ten thousand contractions. That is years of work.',
    now: () => store.totals().contractions, at: 10000 },
  { id: 'kegel30', section: 'Kegels', icon: 'flame', name: 'A month of kegels',
    blurb: 'Thirty days running without missing a session.',
    now: () => Math.max(store.get().prs.streak, store.streak()), at: 30, unit: ' d' },
  { id: 'week26', section: 'Kegels', icon: 'route', name: 'Six months of the programme',
    blurb: 'Reached week 26 of the two-year plan.',
    now: () => store.get().program.level, at: 26, unit: ' wk' },
  { id: 'week52', section: 'Kegels', icon: 'route', name: 'A year of the programme',
    blurb: 'Reached week 52 of the two-year plan.',
    now: () => store.get().program.level, at: 52, unit: ' wk' },
  { id: 'week104', section: 'Kegels', icon: 'medal', name: 'The whole programme',
    blurb: 'Finished all 104 weeks. There is no more ladder.',
    now: () => store.get().program.level, at: 104, unit: ' wk' },

  /* --- PE --- */
  { id: 'stretch2h', section: 'PE', icon: 'timer', name: 'Two hours in a day',
    blurb: 'A full two hours under tension inside one day.',
    now: () => Math.max(0, ...dailyStretchTotals()) / 3600000, at: 2, unit: 'h' },
  { id: 'stretch2hWeek', section: 'PE', icon: 'flame', name: 'A week at target',
    blurb: 'Two hours a day, seven days running.',
    now: bestStretchRun, at: 7, unit: ' d' },
  { id: 'stretch10', section: 'PE', icon: 'stretch', name: 'Ten hours',
    blurb: 'Ten hours under tension.',
    now: () => stretchMs() / 3600000, at: 10, unit: 'h' },
  { id: 'stretch50', section: 'PE', icon: 'stretch', name: 'Fifty hours',
    blurb: 'Fifty hours under tension.',
    now: () => stretchMs() / 3600000, at: 50, unit: 'h' },
  { id: 'stretch100', section: 'PE', icon: 'stretch', name: 'A hundred hours',
    blurb: 'A hundred hours under tension. Nothing about that was quick.',
    now: () => stretchMs() / 3600000, at: 100, unit: 'h' },
  { id: 'grew1cm', section: 'PE', icon: 'trend', name: 'A centimetre',
    blurb: 'A full centimetre on your first measurement, measured the same way.',
    now: () => grew('bpel'), at: 1, unit: ' cm' },
  { id: 'girth5mm', section: 'PE', icon: 'trend', name: 'Half a centimetre of girth',
    blurb: 'Half a centimetre of erect girth on your first measurement.',
    now: () => grew('eg'), at: 0.5, unit: ' cm' },
  { id: 'checkins12', section: 'PE', icon: 'ruler', name: 'A year of measuring',
    blurb: 'Twelve monthly check-ins. The data is worth more than any single one.',
    now: () => store.get().pe.measurements.length, at: 12 },

  /* --- Bible --- */
  { id: 'books10', section: 'Bible', icon: 'book', name: 'Ten books',
    blurb: 'Ten books of the canon, finished.', now: booksDone, at: 10 },
  { id: 'gospels', section: 'Bible', icon: 'scripture', name: 'The four Gospels',
    blurb: 'Matthew, Mark, Luke and John, all the way through.',
    now: () => readOf(GOSPELS), at: 4 },
  { id: 'torah', section: 'Bible', icon: 'scripture', name: 'The Law',
    blurb: 'The five books of Moses, Genesis to Deuteronomy.',
    now: () => readOf(TORAH), at: 5 },
  { id: 'psalter', section: 'Bible', icon: 'scripture', name: 'The Psalter',
    blurb: 'All 151 psalms.',
    now: () => chaptersRead('psa'), at: 151 },
  { id: 'newTestament', section: 'Bible', icon: 'medal', name: 'The New Testament',
    blurb: 'Every book of it, Matthew to Revelation.',
    now: () => readOf(NEW_TESTAMENT), at: NEW_TESTAMENT.length },
  { id: 'wholeCanon', section: 'Bible', icon: 'medal', name: 'The whole canon',
    blurb: 'All 76 books. Genesis 1 to Revelation 22.',
    now: booksDone, at: BOOKS.length },

  /* --- Prayer --- */
  { id: 'rule40', section: 'Prayer', icon: 'sun', name: 'Forty days',
    blurb: 'Morning and night, both kept, forty days running.',
    now: () => longestRun(ruleKept), at: 40, unit: ' d' },
  { id: 'rule100', section: 'Prayer', icon: 'sun', name: 'A hundred days',
    blurb: 'Morning and night, both kept, a hundred days running.',
    now: () => longestRun(ruleKept), at: 100, unit: ' d' },
  { id: 'rule1000', section: 'Prayer', icon: 'medal', name: 'A thousand prayers',
    blurb: 'A thousand mornings and nights kept, all told.',
    now: () => Object.values(store.get().pray.days).reduce((a, d) => a + (d.morning ? 1 : 0) + (d.evening ? 1 : 0), 0), at: 1000 },

  /* --- Wind-down --- */
  { id: 'nights30', section: 'Wind-down', icon: 'breath', name: 'Thirty nights',
    blurb: 'Thirty nights running, breathing before sleep.',
    now: () => longestRun((k) => !!store.get().breathe.days[k]), at: 30, unit: ' d' },
  { id: 'nights100', section: 'Wind-down', icon: 'moon', name: 'A hundred nights',
    blurb: 'A hundred nights ended the right way.',
    now: () => Object.keys(store.get().breathe.days).length, at: 100 },

  /* --- The grid --- */
  { id: 'perfectDay', section: 'The grid', icon: 'check', name: 'A perfect day',
    blurb: 'Every row on the grid, green, on the same day.',
    now: () => perfectDays().count, at: 1 },
  { id: 'perfectWeek', section: 'The grid', icon: 'flame', name: 'A perfect week',
    blurb: 'Seven perfect days back to back. Everything, all week.',
    now: () => perfectDays().best, at: 7, unit: ' d' },
  { id: 'habitYear', section: 'The grid', icon: 'habits', name: 'A year of one thing',
    blurb: 'One habit, kept unbroken for 365 days.',
    now: () => habits.active().reduce((a, h) => Math.max(a, habits.summary(h)?.best || 0), 0), at: 365, unit: ' d' },
  { id: 'habits10', section: 'The grid', icon: 'habits', name: 'Ten at once',
    blurb: 'Ten habits alive on the grid at the same time.',
    now: () => habits.active().length, at: 10 },

  /* --- The Arena --- */
  { id: 'divMenace', section: 'The Arena', icon: 'trophy', name: 'Menace',
    blurb: 'Climbed to the Menace division.', test: () => reachedDivision('menace') },
  { id: 'divLocked', section: 'The Arena', icon: 'trophy', name: 'Locked In',
    blurb: 'Climbed to Locked In. A good week is just a week now.', test: () => reachedDivision('locked') },
  { id: 'divTopG', section: 'The Arena', icon: 'trophy', name: 'Top G',
    blurb: 'Climbed to the top of the ladder.', test: () => reachedDivision('topg') },
  { id: 'topgHeld', section: 'The Arena', icon: 'medal', name: 'Top G, held',
    blurb: 'Finished a month at Top G and stayed there.',
    test: () => Object.values(arenaState().months).some((m) => m.to === 'topg' && m.from === 'topg') },
  { id: 'beatNemesis', section: 'The Arena', icon: 'flash', name: 'Beat the Nemesis',
    blurb: 'Out-scored the best week you had ever had, in a week that counted.',
    // The Arc final is the Nemesis under another name, so winning it counts.
    test: () => Object.values(arenaState().weeks).some((w) => w.result === 'won' && (w.opponent === 'nemesis' || w.opponent === 'final')) },
  { id: 'arcWin', section: 'The Arena', icon: 'trophy', name: 'An Arc',
    blurb: 'Won an Arc. The final is always your own best week.', now: arcsWon, at: 1 },
  { id: 'arcThree', section: 'The Arena', icon: 'trophy', name: 'Three Arcs',
    blurb: 'Three trophies in the cabinet.', now: arcsWon, at: 3 },
  { id: 'arcYear', section: 'The Arena', icon: 'medal', name: 'The clean sweep',
    blurb: 'All four Arcs of one year. Winter, spring, summer, autumn.',
    test: () => {
      const byYear = {};
      for (const [k, a] of Object.entries(arenaState().arcs)) {
        if (!a.won) continue;
        const y = k.split('-')[0];
        byYear[y] = (byYear[y] || 0) + 1;
      }
      return Object.values(byYear).some((n) => n >= 4);
    } },
];

/* ---------------- earning them ---------------- */

/** Where a feat stands right now, without deciding whether it is earned. */
export function progressOf(feat) {
  if (feat.test) return { earned: safely(feat.test, false), have: null, need: null, frac: 0 };
  const have = safely(feat.now, 0) || 0;
  const need = feat.at;
  return { earned: have >= need, have, need, frac: Math.max(0, Math.min(have / need, 1)) };
}

function safely(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const earnedAt = (id) => store.get().arena.feats[id] || null;
export const isEarned = (id) => !!store.get().arena.feats[id];

/** Fold the record forward: anything now true that was not recorded gets a
 *  date, and is handed back so it can be announced once. */
export function check() {
  const fresh = [];
  store.update((st) => {
    for (const f of FEATS) {
      if (st.arena.feats[f.id]) continue;
      if (!progressOf(f).earned) continue;
      st.arena.feats[f.id] = Date.now();
      fresh.push(f);
    }
  });
  return fresh;
}

/** The catalogue, grouped for display, in catalogue order inside each section.
 *  Not earned-first: several sections are ladders - twenty seconds, thirty,
 *  sixty - and sorting the earned ones to the top takes the ladder apart. */
export function bySection() {
  const out = new Map();
  for (const f of FEATS) {
    if (!out.has(f.section)) out.set(f.section, []);
    out.get(f.section).push({ ...f, ...progressOf(f), at: earnedAt(f.id) });
  }
  return [...out.entries()].map(([section, items]) => ({
    section,
    items,
    earned: items.filter((i) => i.earned).length,
  }));
}

export function counts() {
  const all = FEATS.map(progressOf);
  return { earned: all.filter((f) => f.earned).length, total: FEATS.length };
}

/** The nearest thing to being earned, for the "next up" line. Only ones with a
 *  measurable distance: a pass-or-fail feat has nothing to show. */
export function closest(n = 3) {
  return FEATS.map((f) => ({ ...f, ...progressOf(f) }))
    .filter((f) => !f.earned && f.need)
    .sort((a, b) => b.frac - a.frac)
    .slice(0, n);
}

export { fmtHours };
