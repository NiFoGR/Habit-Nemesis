// Feats. Not achievements.
//
// One test: could you say it out loud to another person and have it mean
// something? "Held a contraction for thirty seconds" passes, "opened the app
// seven days running" does not.
//
// Each is a predicate over the record, so only the date first seen is stored
// and the rest recomputes.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import { dailyStretchTotals } from '../pe/program.js';
import * as arena from './program.js';
import { BOOKS } from '../bible/canon.js';
import { fmtHours } from '../ui.js';
import { nifoUnlocked } from '../nifo.js';

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

const readOf = (ids) => ids.filter(bookDone).length;

const stretchMs = () => store.get().pe.sessions.filter((s) => s.type === 'stretch').reduce((a, s) => a + s.durationSec * 1000, 0);

/** Longest run at or over the stretch target. */
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

/** Growth on one measurement, first check-in to best, in cm. */
const grew = (key) => {
  const m = store.get().pe.measurements.filter((x) => x[key]);
  return m.length > 1 ? Math.max(...m.map((x) => x[key])) - m[0][key] : 0;
};

/** Longest run of days satisfying a predicate. */
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

/** A day where every row came good. */
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

/* ---------------- the grid, for everyone ---------------- */

const summaries = () => habits.active().map((h) => habits.summary(h)).filter(Boolean);

/** Whole days between two day keys. */
const between = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/** The longest streak any one habit has ever had. */
const bestHabitStreak = () => summaries().reduce((a, s) => Math.max(a, s.best || 0), 0);

/** Days you did the thing, across every habit, archived ones included. */
function marksTotal() {
  let n = 0;
  for (const days of Object.values(store.get().habits.entries)) {
    for (const v of Object.values(days)) if (typeof v === 'number' && v > 0) n++;
  }
  return n;
}

/** Every day anything was marked on, oldest first. */
function markedDays() {
  const set = new Set();
  for (const days of Object.values(store.get().habits.entries)) {
    for (const [k, v] of Object.entries(days)) if (typeof v === 'number' && v > 0) set.add(k);
  }
  return [...set].sort();
}

/** Broke a streak this long, then built another one. Two runs, not one long one. */
const rebuilt = (len = 30) => summaries().some((s) => s.streaks.filter((r) => r.len >= len).length >= 2);

/** Away with nothing marked, then back for `back` days running. */
function cameBack(gap = 14, back = 7) {
  const days = markedDays();
  for (let i = 1; i < days.length; i++) {
    if (between(days[i - 1], days[i]) <= gap) continue;
    let run = 1;
    for (let j = i + 1; j < days.length && run < back; j++) {
      if (days[j] !== store.addDays(days[j - 1], 1)) break;
      run++;
    }
    if (run >= back) return true;
  }
  return false;
}

/** The biggest lifetime total on any measurable habit, in its own unit. */
const countedMost = () => summaries().filter((s) => s.habit.kind === 'number').reduce((a, s) => Math.max(a, s.total || 0), 0);

const bestScore = () => summaries().reduce((a, s) => Math.max(a, s.score || 0), 0);

/** Every habit above the bar at once. Three or more, or it is not a board. */
function boardAbove(bar = 0.75) {
  const list = summaries();
  return list.length >= 3 && list.every((s) => s.score >= bar);
}

/** A group whose every member was satisfied on each of the last `days` days. */
function groupCleared(days = 7) {
  const end = store.addDays(habits.today(), -1);
  return habits.groups().some((g) => {
    const sums = habits.active().filter((h) => h.group === g.id).map((h) => habits.summary(h));
    if (sums.length < 2) return false;
    for (let i = 0; i < days; i++) {
      const key = store.addDays(end, -i);
      if (!sums.every((s) => s?.index.get(key)?.satisfied)) return false;
    }
    return true;
  });
}

/** Days from the day the record starts to today. */
function daysOnRecord() {
  const first = arena.anchorDay();
  return first ? Math.max(0, between(first, habits.today())) : 0;
}

/* ---------------- the Arena, for everyone ---------------- */

const weekList = () => Object.entries(arenaState().weeks).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([key, w]) => ({ key, ...w }));

/** Weeks actually played. A 'record' week was scored, never contested. */
const fixtures = () => weekList().filter((w) => w.result === 'won' || w.result === 'lost');
const wins = () => fixtures().filter((w) => w.result === 'won').length;

/** Longest run of consecutive fixtures won. */
function bestWinRun() {
  let best = 0;
  let run = 0;
  for (const w of fixtures()) {
    run = w.result === 'won' ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

const beat = (opp) => fixtures().some((w) => w.result === 'won' && w.opponent === opp);

const monthList = () => Object.entries(arenaState().months).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, m]) => ({ month, ...m }));

/** Longest run of months matching a test, so a partial run still shows progress. */
function monthRun(ok) {
  let best = 0;
  let run = 0;
  for (const m of monthList()) {
    run = ok(m) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

const arcList = () => Object.values(arenaState().arcs);

/* ------------------- the catalogue ------------------- */

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
  { id: 'firstMark', section: 'The grid', icon: 'check', name: 'Day one',
    blurb: 'The first day you marked. Everything else is built on it.',
    now: marksTotal, at: 1 },
  { id: 'perfectDay', section: 'The grid', icon: 'check', name: 'A perfect day',
    blurb: 'Every row on the grid, green, on the same day.',
    now: () => perfectDays().count, at: 1 },
  { id: 'perfectWeek', section: 'The grid', icon: 'flame', name: 'A perfect week',
    blurb: 'Seven perfect days back to back. Everything, all week.',
    now: () => perfectDays().best, at: 7, unit: ' d' },
  { id: 'perfectMonth', section: 'The grid', icon: 'flame', name: 'A perfect month',
    blurb: 'Thirty perfect days back to back. Nothing slipped for a month.',
    now: () => perfectDays().best, at: 30, unit: ' d' },
  { id: 'streak7', section: 'The grid', icon: 'habits', name: 'A week straight',
    blurb: 'One habit, seven days unbroken.',
    now: bestHabitStreak, at: 7, unit: ' d' },
  { id: 'streak30', section: 'The grid', icon: 'habits', name: 'A month straight',
    blurb: 'One habit, thirty days unbroken.',
    now: bestHabitStreak, at: 30, unit: ' d' },
  { id: 'streak100', section: 'The grid', icon: 'flame', name: 'A hundred days',
    blurb: 'One habit, a hundred days unbroken.',
    now: bestHabitStreak, at: 100, unit: ' d' },
  { id: 'habitYear', section: 'The grid', icon: 'medal', name: 'A year of one thing',
    blurb: 'One habit, kept unbroken for 365 days.',
    now: bestHabitStreak, at: 365, unit: ' d' },
  { id: 'streak1000', section: 'The grid', icon: 'medal', name: 'A thousand days',
    blurb: 'One habit, a thousand days unbroken. Almost nobody gets here.',
    now: bestHabitStreak, at: 1000, unit: ' d' },
  { id: 'habits5', section: 'The grid', icon: 'habits', name: 'Five at once',
    blurb: 'Five habits alive on the grid at the same time.',
    now: () => habits.active().length, at: 5 },
  { id: 'habits10', section: 'The grid', icon: 'habits', name: 'Ten at once',
    blurb: 'Ten habits alive on the grid at the same time.',
    now: () => habits.active().length, at: 10 },
  { id: 'marks100', section: 'The grid', icon: 'check', name: 'A hundred ticks',
    blurb: 'A hundred days marked, all told.',
    now: marksTotal, at: 100 },
  { id: 'marks1000', section: 'The grid', icon: 'check', name: 'A thousand ticks',
    blurb: 'A thousand days marked. That is years of small decisions.',
    now: marksTotal, at: 1000 },
  { id: 'marks10000', section: 'The grid', icon: 'medal', name: 'Ten thousand ticks',
    blurb: 'Ten thousand days marked, across everything you keep.',
    now: marksTotal, at: 10000 },
  { id: 'counted1k', section: 'The grid', icon: 'target', name: 'A thousand counted',
    blurb: 'One measurable habit totalling a thousand of whatever it counts.',
    now: countedMost, at: 1000 },
  { id: 'counted10k', section: 'The grid', icon: 'target', name: 'Ten thousand counted',
    blurb: 'Ten thousand of one thing, a day at a time.',
    now: countedMost, at: 10000 },
  { id: 'score90', section: 'The grid', icon: 'trend', name: 'Ninety percent',
    blurb: 'One habit at ninety percent. The score has a thirteen-day memory, so this is recent form.',
    now: () => bestScore() * 100, at: 90, unit: '%' },
  { id: 'boardClean', section: 'The grid', icon: 'trend', name: 'The whole board',
    blurb: 'Every habit above seventy-five percent at the same time.',
    test: () => boardAbove(0.75) },
  { id: 'groupClear', section: 'The grid', icon: 'check', name: 'A group cleared',
    blurb: 'Every habit in one group, satisfied every day for a week.',
    test: () => groupCleared(7) },
  { id: 'comeback', section: 'The grid', icon: 'repeat', name: 'Back from the dead',
    blurb: 'Broke a streak of thirty, then built another one. The second is the hard one.',
    test: () => rebuilt(30) },
  { id: 'returned', section: 'The grid', icon: 'repeat', name: 'Came back',
    blurb: 'Away a fortnight, then seven days running. Nobody saw you stop.',
    test: () => cameBack(14, 7) },
  { id: 'year1', section: 'The grid', icon: 'calendar', name: 'A year on the record',
    blurb: 'A year since the first day you marked.',
    now: daysOnRecord, at: 365, unit: ' d' },
  { id: 'year2', section: 'The grid', icon: 'calendar', name: 'Two years',
    blurb: 'Two years of record. The app is older than most of your excuses.',
    now: daysOnRecord, at: 730, unit: ' d' },

  /* --- The Arena --- */
  { id: 'firstFixture', section: 'The Arena', icon: 'versus', name: 'Your first week',
    blurb: 'Played a fixture. The record had enough in it to be scored against.',
    now: () => fixtures().length, at: 1 },
  { id: 'firstWin', section: 'The Arena', icon: 'versus', name: 'First blood',
    blurb: 'Beat a week out of your own history.',
    now: wins, at: 1 },
  { id: 'wins10', section: 'The Arena', icon: 'versus', name: 'Ten wins',
    blurb: 'Ten weeks won.', now: wins, at: 10 },
  { id: 'wins50', section: 'The Arena', icon: 'medal', name: 'Fifty wins',
    blurb: 'Fifty weeks won. That is a year of mostly turning up.',
    now: wins, at: 50 },
  { id: 'winStreak5', section: 'The Arena', icon: 'flame', name: 'Five in a row',
    blurb: 'Five straight weeks won, none of them close enough to lose.',
    now: bestWinRun, at: 5 },
  { id: 'weeks100', section: 'The Arena', icon: 'calendar', name: 'A hundred weeks',
    blurb: 'A hundred fixtures played. Two years of showing up to be counted.',
    now: () => fixtures().length, at: 100 },
  { id: 'beatWorst', section: 'The Arena', icon: 'flash', name: 'Beat your worst',
    blurb: 'Out-scored Your Worst Self. The low bar, cleared.',
    test: () => beat('worst') },
  { id: 'beatLastMonth', section: 'The Arena', icon: 'flash', name: 'Beat last month',
    blurb: 'Out-scored the same week of a month ago. Measurably better than you were.',
    test: () => beat('lastMonth') },
  { id: 'divProspect', section: 'The Arena', icon: 'ladder', name: 'Prospect',
    blurb: 'Climbed off the bottom of the ladder.', test: () => reachedDivision('prospect') },
  { id: 'divContender', section: 'The Arena', icon: 'ladder', name: 'Contender',
    blurb: 'Reached Contender. A bad week costs you something now.',
    test: () => reachedDivision('contender') },
  { id: 'promoted2', section: 'The Arena', icon: 'crown', name: 'Two rungs, two months',
    blurb: 'Promoted in consecutive months. The ladder went past in a blur.',
    now: () => monthRun((m) => m.move === 'up'), at: 2 },
  { id: 'noDrop6', section: 'The Arena', icon: 'shield', name: 'Six months, no step back',
    blurb: 'Six months settled without a relegation among them.',
    now: () => monthRun((m) => m.move !== 'down'), at: 6 },
  { id: 'arcQualified', section: 'The Arena', icon: 'trophy', name: 'Out of the group',
    blurb: 'Finished the group stage in the top three and made the knockout.',
    test: () => arcList().some((a) => a.qualified === true) },
  { id: 'arcFinal', section: 'The Arena', icon: 'trophy', name: 'Reached a final',
    blurb: 'Played an Arc final. The final is always your own best week.',
    test: () => arcList().some((a) => a.final === 'won' || a.final === 'lost') },
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
    // The Arc final is the Nemesis under another name.
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

/** Where a feat stands, without deciding whether it is earned. */
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

/** Fold forward: anything newly true gets a date and is handed back to announce. */
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

/** Grouped, in catalogue order. Not earned-first: several sections are ladders. */

/* ------------- what this install can earn ------------- */

const OPEN_SECTIONS = ['The grid', 'The Arena'];

const visible = () => (nifoUnlocked() ? FEATS : FEATS.filter((f) => OPEN_SECTIONS.includes(f.section)));

export function bySection() {
  const out = new Map();
  for (const f of visible()) {
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
  const list = visible();
  const all = list.map(progressOf);
  return { earned: all.filter((f) => f.earned).length, total: list.length };
}

/** Nearest to earned, for the "next up" line. Measurable ones only. */
export function closest(n = 3) {
  return visible().map((f) => ({ ...f, ...progressOf(f) }))
    .filter((f) => !f.earned && f.need)
    .sort((a, b) => b.frac - a.frac)
    .slice(0, n);
}

export { fmtHours };
