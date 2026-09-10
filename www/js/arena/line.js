// The daily line. One sentence from your Nemesis, once a day, drawn from the
// record. A predicate table in the shape of feats.js: each entry says when it
// holds and what it says from the same numbers, so it is never false. When
// none holds, nothing is said.
//
// He is the one speaking. Every line is his, and every number in one is a week
// you actually played.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import { WEEKDAYS_LONG } from '../ui.js';

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

/** This week against the opponent, live. */
function live() {
  const key = arena.currentWeek();
  const s = arena.scoreWeek(key);
  if (s.void && !s.due) return null;
  return { key, score: s.score, done: s.done, due: s.due, opp: arena.fixtureFor(key), left: arena.daysLeftInWeek() };
}

/** He is the fixture, so the duel above already carries the gap. */
const facing = () => {
  const l = live();
  return !!l && (l.opp.id === 'nemesis' || l.opp.knockout === 'final');
};

/* ---------------- the lines ---------------- */

const LINES = [
  {
    id: 'undefeated',
    when: () => {
      const h = arena.headToHead();
      return h.met >= 2 && h.w === 0;
    },
    say: () => 'You have never beaten me.',
  },
  {
    id: 'sinceWin',
    when: () => (arena.sinceWin() ?? 0) >= 2,
    say: () => `${cap(word(arena.sinceWin()))} weeks since you beat me.`,
  },
  {
    id: 'run',
    when: () => arena.headToHead().run >= 2,
    say: () => `You have taken ${word(arena.headToHead().run)} off me in a row.`,
  },
  {
    id: 'hisRun',
    when: () => arena.headToHead().run <= -2,
    say: () => `I have taken the last ${word(-arena.headToHead().run)}.`,
  },
  {
    id: 'deposed',
    when: () => arena.deposed() >= 1,
    say: () => {
      const n = arena.deposed();
      if (n === 1) return 'You have replaced me once.';
      if (n === 2) return 'You have replaced me twice.';
      return `You have replaced me ${word(n)} times.`;
    },
  },
  {
    id: 'reign',
    when: () => arena.holding() >= 4,
    say: () => `I have held this for ${word(arena.holding())} weeks.`,
  },
  {
    id: 'meeting',
    when: () => arena.nextMeeting()?.away === 1,
    say: () => 'We meet next week.',
  },
  {
    // On a week he is not the fixture: the one number no card carries.
    id: 'gap',
    when: () => {
      const l = live();
      const n = arena.nemesisWeek();
      return !!l && !!n && !facing() && l.left > 1 && l.due > 0 && Math.round((n.score - l.score) * 100) > 0;
    },
    say: () => `${cap(word(Math.round((arena.nemesisWeek().score - live().score) * 100)))} off my best.`,
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
      return `Last day. ${cap(word(need))} more cell${need === 1 ? '' : 's'} and you take it.`;
    },
  },
  {
    id: 'weekday',
    when: () => weekdayRun(new Date().getDay()).run >= 4,
    say: () => {
      const day = WEEKDAYS_LONG[new Date().getDay()];
      return `I have not seen you miss a ${day} since ${monthOf(weekdayRun(new Date().getDay()).since)}.`;
    },
  },
  {
    id: 'perfect',
    when: () => perfectOn(store.addDays(habits.today(), -1)),
    say: () => 'Nothing missed yesterday.',
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

/** Every line that holds right now, for the checks. */
export const openLines = () => LINES.filter((l) => holds(l.id)).map((l) => ({ id: l.id, say: l.say() }));
