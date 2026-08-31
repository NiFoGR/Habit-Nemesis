// Feats. Not achievements.
//
// One test: could you say it out loud to another person and have it mean
// something? "A hundred days unbroken" passes, "opened the app seven days
// running" does not.
//
// Each is a predicate over the record, so only the date first seen is stored
// and the rest recomputes.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';

/* ---------------- helpers the tests share ---------------- */

/** A day where every row came good. */
function perfectDays() {
  const rows = habits.active();
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

// `days` is the price: the fewest days of honest work the feat can take, not
// how long it took you. It is the only thing that separates "a perfect day"
// from "a thousand days straight", and it is a claim about the work, so it is
// written down rather than derived from the target.
export const FEATS = [
  /* --- The grid --- */
  { id: 'firstMark', section: 'The grid', icon: 'check', days: 1, name: 'Day one',
    blurb: 'The first day you marked. Everything else is built on it.',
    now: marksTotal, at: 1 },
  { id: 'perfectDay', section: 'The grid', icon: 'check', days: 1, name: 'A perfect day',
    blurb: 'Every row on the grid, green, on the same day.',
    now: () => perfectDays().count, at: 1 },
  { id: 'perfectWeek', section: 'The grid', icon: 'flame', days: 7, name: 'A perfect week',
    blurb: 'Seven perfect days back to back. Everything, all week.',
    now: () => perfectDays().best, at: 7, unit: ' d' },
  { id: 'perfectMonth', section: 'The grid', icon: 'flame', days: 30, name: 'A perfect month',
    blurb: 'Thirty perfect days back to back. Nothing slipped for a month.',
    now: () => perfectDays().best, at: 30, unit: ' d' },
  { id: 'streak7', section: 'The grid', icon: 'habits', days: 7, name: 'A week straight',
    blurb: 'One habit, seven days unbroken.',
    now: bestHabitStreak, at: 7, unit: ' d' },
  { id: 'streak30', section: 'The grid', icon: 'habits', days: 30, name: 'A month straight',
    blurb: 'One habit, thirty days unbroken.',
    now: bestHabitStreak, at: 30, unit: ' d' },
  { id: 'streak100', section: 'The grid', icon: 'flame', days: 100, name: 'A hundred days',
    blurb: 'One habit, a hundred days unbroken.',
    now: bestHabitStreak, at: 100, unit: ' d' },
  { id: 'habitYear', section: 'The grid', icon: 'medal', days: 365, name: 'A year of one thing',
    blurb: 'One habit, kept unbroken for 365 days.',
    now: bestHabitStreak, at: 365, unit: ' d' },
  { id: 'streak1000', section: 'The grid', icon: 'medal', days: 1000, name: 'A thousand days',
    blurb: 'One habit, a thousand days unbroken. Almost nobody gets here.',
    now: bestHabitStreak, at: 1000, unit: ' d' },
  { id: 'habits5', section: 'The grid', icon: 'habits', days: 1, name: 'Five at once',
    blurb: 'Five habits alive on the grid at the same time.',
    now: () => habits.active().length, at: 5 },
  { id: 'habits10', section: 'The grid', icon: 'habits', days: 1, name: 'Ten at once',
    blurb: 'Ten habits alive on the grid at the same time.',
    now: () => habits.active().length, at: 10 },
  { id: 'marks100', section: 'The grid', icon: 'check', days: 20, name: 'A hundred ticks',
    blurb: 'A hundred days marked, all told.',
    now: marksTotal, at: 100 },
  { id: 'marks1000', section: 'The grid', icon: 'check', days: 200, name: 'A thousand ticks',
    blurb: 'A thousand days marked. That is years of small decisions.',
    now: marksTotal, at: 1000 },
  { id: 'marks10000', section: 'The grid', icon: 'medal', days: 730, name: 'Ten thousand ticks',
    blurb: 'Ten thousand days marked, across everything you keep.',
    now: marksTotal, at: 10000 },
  { id: 'counted1k', section: 'The grid', icon: 'target', days: 100, name: 'A thousand counted',
    blurb: 'One measurable habit totalling a thousand of whatever it counts.',
    now: countedMost, at: 1000 },
  { id: 'counted10k', section: 'The grid', icon: 'target', days: 365, name: 'Ten thousand counted',
    blurb: 'Ten thousand of one thing, a day at a time.',
    now: countedMost, at: 10000 },
  { id: 'score90', section: 'The grid', icon: 'trend', days: 60, name: 'Ninety percent',
    blurb: 'One habit at ninety percent. The score has a thirteen-day memory, so this is recent form.',
    now: () => bestScore() * 100, at: 90, unit: '%' },
  { id: 'boardClean', section: 'The grid', icon: 'trend', days: 1, name: 'The whole board',
    blurb: 'Every habit above seventy-five percent at the same time.',
    test: () => boardAbove(0.75) },
  { id: 'groupClear', section: 'The grid', icon: 'check', days: 1, name: 'A group cleared',
    blurb: 'Every habit in one group, satisfied every day for a week.',
    test: () => groupCleared(7) },
  { id: 'comeback', section: 'The grid', icon: 'repeat', days: 60, name: 'Back from the dead',
    blurb: 'Broke a streak of thirty, then built another one. The second is the hard one.',
    test: () => rebuilt(30) },
  { id: 'returned', section: 'The grid', icon: 'repeat', days: 30, name: 'Came back',
    blurb: 'Away a fortnight, then seven days running. Nobody saw you stop.',
    test: () => cameBack(14, 7) },
  { id: 'year1', section: 'The grid', icon: 'calendar', days: 365, name: 'A year on the record',
    blurb: 'A year since the first day you marked.',
    now: daysOnRecord, at: 365, unit: ' d' },
  { id: 'year2', section: 'The grid', icon: 'calendar', days: 730, name: 'Two years',
    blurb: 'Two years of record. The app is older than most of your excuses.',
    now: daysOnRecord, at: 730, unit: ' d' },

  /* --- The Arena --- */
  { id: 'firstFixture', section: 'The Arena', icon: 'versus', days: 7, name: 'Your first week',
    blurb: 'Played a fixture. The record had enough in it to be scored against.',
    now: () => fixtures().length, at: 1 },
  { id: 'firstWin', section: 'The Arena', icon: 'versus', days: 7, name: 'First blood',
    blurb: 'Beat a week out of your own history.',
    now: wins, at: 1 },
  { id: 'wins10', section: 'The Arena', icon: 'versus', days: 70, name: 'Ten wins',
    blurb: 'Ten weeks won.', now: wins, at: 10 },
  { id: 'wins50', section: 'The Arena', icon: 'medal', days: 350, name: 'Fifty wins',
    blurb: 'Fifty weeks won. That is a year of mostly turning up.',
    now: wins, at: 50 },
  { id: 'winStreak5', section: 'The Arena', icon: 'flame', days: 35, name: 'Five in a row',
    blurb: 'Five straight weeks won, none of them close enough to lose.',
    now: bestWinRun, at: 5 },
  { id: 'weeks100', section: 'The Arena', icon: 'calendar', days: 700, name: 'A hundred weeks',
    blurb: 'A hundred fixtures played. Two years of showing up to be counted.',
    now: () => fixtures().length, at: 100 },
  { id: 'beatWorst', section: 'The Arena', icon: 'flash', days: 14, name: 'Beat your worst',
    blurb: 'Out-scored Your Worst Self. The low bar, cleared.',
    test: () => beat('worst') },
  { id: 'beatLastMonth', section: 'The Arena', icon: 'flash', days: 60, name: 'Beat last month',
    blurb: 'Out-scored the same week of a month ago. Measurably better than you were.',
    test: () => beat('lastMonth') },
  { id: 'divProspect', section: 'The Arena', icon: 'ladder', days: 30, name: 'Prospect',
    blurb: 'Climbed off the bottom of the ladder.', test: () => reachedDivision('prospect') },
  { id: 'divContender', section: 'The Arena', icon: 'ladder', days: 45, name: 'Contender',
    blurb: 'Reached Contender. A bad week costs you something now.',
    test: () => reachedDivision('contender') },
  { id: 'promoted2', section: 'The Arena', icon: 'crown', days: 60, name: 'Back to back',
    blurb: 'Promoted in consecutive months.',
    now: () => monthRun((m) => m.move === 'up'), at: 2 },
  { id: 'noDrop6', section: 'The Arena', icon: 'shield', days: 182, name: 'Six months, no step back',
    blurb: 'Six months settled without a relegation among them.',
    now: () => monthRun((m) => m.move !== 'down'), at: 6 },
  { id: 'arcQualified', section: 'The Arena', icon: 'trophy', days: 30, name: 'Out of the group',
    blurb: 'Finished the group stage in the top three and made the knockout.',
    test: () => arcList().some((a) => a.qualified === true) },
  { id: 'arcFinal', section: 'The Arena', icon: 'trophy', days: 60, name: 'Reached a final',
    blurb: 'Played an Arc final. The final is always your own best week.',
    test: () => arcList().some((a) => a.final === 'won' || a.final === 'lost') },
  { id: 'divMenace', section: 'The Arena', icon: 'trophy', days: 60, name: 'Menace',
    blurb: 'Climbed to the Menace division.', test: () => reachedDivision('menace') },
  { id: 'divMentzer', section: 'The Arena', icon: 'trophy', days: 90, name: 'Mentzer',
    blurb: 'Climbed to Mentzer. Seventy percent is the floor now.', test: () => reachedDivision('mentzer') },
  { id: 'divLocked', section: 'The Arena', icon: 'trophy', days: 120, name: 'Locked In',
    blurb: 'Climbed to Locked In. A good week is just a week now.', test: () => reachedDivision('locked') },
  { id: 'divTopG', section: 'The Arena', icon: 'trophy', days: 150, name: 'Top G',
    blurb: 'Climbed to the top of the ladder.', test: () => reachedDivision('topg') },
  { id: 'topgHeld', section: 'The Arena', icon: 'medal', days: 180, name: 'Top G, held',
    blurb: 'Finished a month at Top G and stayed there.',
    test: () => Object.values(arenaState().months).some((m) => m.to === 'topg' && m.from === 'topg') },
  { id: 'beatNemesis', section: 'The Arena', icon: 'flash', days: 60, name: 'Beat the Nemesis',
    blurb: 'Out-scored the best week you had ever had, in a week that counted.',
    // The Arc final is the Nemesis under another name.
    test: () => Object.values(arenaState().weeks).some((w) => w.result === 'won' && (w.opponent === 'nemesis' || w.opponent === 'final')) },
  { id: 'arcWin', section: 'The Arena', icon: 'trophy', days: 90, name: 'An Arc',
    blurb: 'Won an Arc. The final is always your own best week.', now: arcsWon, at: 1 },
  { id: 'arcThree', section: 'The Arena', icon: 'trophy', days: 270, name: 'Three Arcs',
    blurb: 'Three trophies in the cabinet.', now: arcsWon, at: 3 },
  { id: 'arcYear', section: 'The Arena', icon: 'medal', days: 365, name: 'The clean sweep',
    blurb: 'Every cup of one year. Winter, spring, autumn.',
    test: () => {
      const byYear = {};
      for (const [k, a] of Object.entries(arenaState().arcs)) {
        if (!a.won) continue;
        const y = k.split('-')[0];
        byYear[y] = (byYear[y] || 0) + 1;
      }
      return Object.values(byYear).some((n) => n >= 3);
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

/* ---------------- what a feat costs ---------------- */

/** A price in words. The number alone reads as noise at 728. */
export function priceOf(days) {
  // 350, not 365: 52 weeks of a two-year plan is 364 days and reads as a year,
  // not as twelve months.
  if (days >= 350) {
    const y = Math.round(days / 365);
    return y <= 1 ? 'a year' : `${y} years`;
  }
  if (days >= 60) return `${Math.round(days / 30)} months`;
  // A month and a week are words, not arithmetic: "4 weeks" for a feat called
  // "A month straight" reads as a different number.
  if (days >= 28 && days <= 34) return 'a month';
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  if (days === 7) return 'a week';
  return days === 1 ? 'a day' : `${days} days`;
}

/** The hardest thing on the record. A sum would double-count: a year straight
 *  and a month straight are the same days twice. */
export function steepest() {
  const earned = FEATS.filter((f) => earnedAt(f.id) && progressOf(f).earned);
  if (!earned.length) return null;
  return earned.reduce((a, f) => (f.days > a.days ? f : a));
}

export function counts() {
  const list = FEATS;
  const all = list.map(progressOf);
  return { earned: all.filter((f) => f.earned).length, total: list.length };
}

/** Nearest to earned, for the "next up" line. Measurable ones only. */
export function closest(n = 3) {
  return FEATS.map((f) => ({ ...f, ...progressOf(f) }))
    .filter((f) => !f.earned && f.need)
    .sort((a, b) => b.frac - a.frac)
    .slice(0, n);
}
