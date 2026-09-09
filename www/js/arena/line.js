// The daily line. One sentence from your Nemesis, once a day, drawn from the
// record. A predicate table in the shape of feats.js: each entry says when it
// holds and what it says from the same numbers, so it is never false. When
// none holds, nothing is said.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import { WEEKDAYS_LONG } from '../ui.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n) => WORDS[n] || String(n);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const monthOf = (key) => new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: 'long' });

/* ---------------- what the record says ---------------- */

/** Weeks running, ending last week, on which every row owed on this weekday
 *  was satisfied. `since` is the oldest of them. */
function weekdayRun(weekday) {
  const sums = habits.active().map((h) => habits.summary(h));
  if (!sums.length) return { run: 0, since: '' };
  let key = store.addDays(habits.today(), -7);
  while (new Date(`${key}T00:00:00`).getDay() !== weekday) key = store.addDays(key, -1);
  let run = 0;
  let since = '';
  while (run < 60) {
    let due = 0;
    let ok = 0;
    for (const s of sums) {
      const d = s.index.get(key);
      if (!d || d.skipped) continue;
      due++;
      if (d.satisfied) ok++;
    }
    if (!due || ok < due) break;
    run++;
    since = key;
    key = store.addDays(key, -7);
  }
  return { run, since };
}

/** Every row owed on `key` satisfied, and at least one owed. */
function perfectOn(key) {
  const sums = habits.active().map((h) => habits.summary(h));
  let due = 0;
  for (const s of sums) {
    const d = s.index.get(key);
    if (!d || d.skipped) continue;
    due++;
    if (!d.satisfied) return false;
  }
  return due > 0;
}

/** Played weeks, oldest first. */
const played = () =>
  Object.entries(store.get().arena.weeks)
    .filter(([, w]) => w.result === 'won' || w.result === 'lost')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, w]) => ({ key, ...w }));

/** The run of wins ending with the last week played, and the longest ever. */
function winRuns() {
  let run = 0;
  let best = 0;
  let current = 0;
  for (const w of played()) {
    run = w.result === 'won' ? run + 1 : 0;
    if (run > best) best = run;
    current = run;
  }
  return { current, best };
}

/** Weeks since the last win over the Nemesis, or null with none on the record. */
function weeksSinceNemesis() {
  const list = played();
  const last = [...list].reverse().find((w) => w.result === 'won' && (w.opponent === 'nemesis' || w.opponent === 'final'));
  if (!last) return null;
  const now = arena.currentWeek();
  let n = 0;
  let k = last.key;
  while (k < now && n < 200) {
    k = arena.nextWeek(k);
    n++;
  }
  return n;
}

/** This week against the opponent, live. */
function live() {
  const key = arena.currentWeek();
  const s = arena.scoreWeek(key);
  if (s.void && !s.due) return null;
  return { key, score: s.score, done: s.done, due: s.due, opp: arena.fixtureFor(key), left: arena.daysLeftInWeek() };
}

/* ---------------- the lines ---------------- */

const LINES = [
  {
    id: 'weekday',
    when: () => weekdayRun(new Date().getDay()).run >= 4,
    say: () => {
      const day = WEEKDAYS_LONG[new Date().getDay()];
      return `You have not missed a ${day} since ${monthOf(weekdayRun(new Date().getDay()).since)}.`;
    },
  },
  {
    id: 'best',
    when: () => {
      const l = live();
      return !!l && !!arena.nemesisWeek() && l.left > 1 && l.due > 0;
    },
    say: () => {
      const l = live();
      return `Your best week was ${pct(arena.nemesisWeek().score)}. You are on ${pct(l.score)} with ${l.left} days left.`;
    },
  },
  {
    id: 'row',
    when: () => {
      const r = winRuns();
      return r.current >= 2 && r.current <= 9 && r.best < r.current + 1;
    },
    say: () => {
      const r = winRuns();
      return `${cap(word(r.current))} in a row. The Nemesis has never lost ${word(r.current + 1)}.`;
    },
  },
  {
    id: 'sinceWin',
    when: () => (weeksSinceNemesis() ?? 0) >= 2,
    say: () => `${cap(word(weeksSinceNemesis()))} weeks since you beat me.`,
  },
  {
    id: 'perfect',
    when: () => perfectOn(store.addDays(habits.today(), -1)),
    say: () => 'Yesterday was a perfect day. Do it again.',
  },
  {
    id: 'lastDay',
    when: () => {
      const l = live();
      return !!l && l.left === 1 && l.due > 0 && l.score < l.opp.score;
    },
    say: () => {
      const l = live();
      const need = Math.max(1, Math.ceil(l.opp.score * l.due) - l.done);
      return `Last day. ${cap(word(need))} more cell${need === 1 ? '' : 's'} and the week is yours.`;
    },
  },
];

/* ---------------- once a day ---------------- */

/** A number from the day key, so the same day always picks the same line. */
function hash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

const holds = (id) => {
  const line = LINES.find((l) => l.id === id);
  try {
    return !!line && line.when();
  } catch {
    return false;
  }
};

/** Today's line, or ''. The pick is written down so the day never gets a
 *  second one, and a pick whose ground has gone says nothing. */
export function dailyLine() {
  const day = habits.today();
  const saved = store.get().arena.line;
  if (saved.day === day) return holds(saved.id) ? LINES.find((l) => l.id === saved.id).say() : '';
  const open = LINES.filter((l) => holds(l.id));
  if (!open.length) return '';
  const pick = open[hash(day) % open.length];
  store.update((st) => {
    st.arena.line = { day, id: pick.id };
  }, { local: true });
  return pick.say();
}
