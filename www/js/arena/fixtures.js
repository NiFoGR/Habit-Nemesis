// Who you play: the four opponents, the cup's knockout rounds, and the group
// table. Reads the record, never writes it.

import * as store from '../store.js';
import { divisionOf } from './ladder.js';
import {
  currentWeek, weekKey, weekStart, weekLabel, monthOfWeek, weeksOfMonth, currentMonth,
  arcOfMonth, arcKey, arcStage, arcSeason, arcWeeks, arcGroupWeeks, previousArc,
} from './calendar.js';
import { VOID_CELLS, storedWeeks, playedWeeks, weekScore } from './scoring.js';

/* --------------------- opponents --------------------- */

export const OPPONENTS = {
  nemesis: { id: 'nemesis', name: 'Your Nemesis', blurb: 'The best week you have ever had.' },
  lastMonth: { id: 'lastMonth', name: 'Last Month You', blurb: 'This week, one month ago.' },
  standard: { id: 'standard', name: 'The Standard', blurb: "Your division's bar, with a face on it." },
  worst: { id: 'worst', name: 'Your Worst Self', blurb: 'Your worst week lately. Do not lose to him.' },
};

/** Best week ever, excluding the one being played. */
export function nemesisWeek(exclude = currentWeek()) {
  return playedWeeks().filter((w) => w.key !== exclude).sort((a, b) => b.score - a.score)[0] || null;
}

/** Worst of the last thirteen, not of all time: a 17% week from a year ago
 *  says nothing. */
export function worstWeek(exclude = currentWeek(), within = 13) {
  const floor = weekKey(store.addDays(weekStart(exclude), -within * 7));
  const recent = playedWeeks().filter((w) => w.key !== exclude && w.key >= floor);
  const pool = recent.length ? recent : playedWeeks().filter((w) => w.key !== exclude);
  return pool.sort((a, b) => a.score - b.score)[0] || null;
}

/** Who you face, and what they scored. Falls back to The Standard when the
 *  record cannot supply a real week. */
export function fixtureFor(key = currentWeek()) {
  const arc = arcFixture(key);
  if (arc) return arc;

  const weeksInMonth = weeksOfMonth(monthOfWeek(key));
  const i = Math.max(0, weeksInMonth.indexOf(key));
  const order = ['nemesis', 'lastMonth', 'standard', 'worst', 'nemesis'];
  const want = order[Math.min(i, order.length - 1)];

  const standard = () => ({
    ...OPPONENTS.standard,
    score: divisionOf(store.get().arena.division).bar,
    week: null,
  });

  if (want === 'nemesis') {
    const w = nemesisWeek(key);
    return w ? { ...OPPONENTS.nemesis, score: w.score, week: w.key } : standard();
  }
  if (want === 'worst') {
    const w = worstWeek(key);
    return w ? { ...OPPONENTS.worst, score: w.score, week: w.key } : standard();
  }
  if (want === 'lastMonth') {
    const back = weekKey(store.addDays(weekStart(key), -28));
    const w = storedWeeks()[back];
    return w && w.result !== 'void' && w.due >= VOID_CELLS
      ? { ...OPPONENTS.lastMonth, score: w.score, week: back }
      : standard();
  }
  return standard();
}

/* --------------------- the knockout --------------------- */

/** `name` is the round, `who` is the opponent. Two different things. */
export const blankArc = () => ({
  qualified: null, qf: null, sf: null, final: null, won: false,
  note: '', sawOpen: false, sawGroup: false, sawCup: false,
});

export const KNOCKOUT = {
  qf: { id: 'qf', name: 'Quarter-final', who: "Last Arc's best", opponent: 'your best week of the last Arc' },
  sf: { id: 'sf', name: 'Semi-final', who: "This year's best", opponent: 'your best week of this year' },
  final: { id: 'final', name: 'Final', who: 'Your Nemesis', opponent: 'your Nemesis' },
};

/** The best week in a set of keys. */
function bestOf(keys, exclude) {
  return keys
    .filter((k) => k !== exclude)
    .map((k) => ({ key: k, ...storedWeeks()[k] }))
    .filter((w) => w.score != null && w.result !== 'void' && w.due >= VOID_CELLS)
    .sort((a, b) => b.score - a.score)[0] || null;
}

/** Knockout opponent, or null in a group week or once you are out. */
export function arcFixture(key) {
  const { arc, stage } = arcStage(key);
  if (stage !== 'qf' && stage !== 'sf' && stage !== 'final') return null;
  const st = store.get().arena.arcs[arcKey(arc)];
  if (!st?.qualified) return null;
  if (stage === 'sf' && st.qf !== 'won') return null;
  if (stage === 'final' && st.sf !== 'won') return null;

  const round = KNOCKOUT[stage];
  let w = null;
  if (stage === 'qf') {
    const prev = arcSeason(previousArc(arc));
    w = bestOf(prev, key);
  } else if (stage === 'sf') {
    const year = weekStart(key).slice(0, 4);
    w = bestOf(Object.keys(storedWeeks()).filter((k) => monthOfWeek(k).startsWith(year)), key);
  } else {
    w = nemesisWeek(key);
  }
  if (!w) {
    return { id: stage, name: round.who, blurb: `${round.name} · ${round.opponent}`, score: divisionOf(store.get().arena.division).bar, week: null, knockout: stage };
  }
  return { id: stage, name: round.who, blurb: `${round.name} · ${round.opponent} · ${weekLabel(w.key)}`, score: w.score, week: w.key, knockout: stage };
}

/* --------------------- the group --------------------- */

/** Turn-up threshold. A share of the group, so a differently shaped cup does
 *  not get an easier entry. */
export const ARC_MIN_RIVALS = 3;
export const arcWeeksNeeded = (groupWeeks) => Math.ceil(groupWeeks.length / 2);

/** You and five past selves, fixed from day one. Spread across the record, not
 *  taken off the top. */
export function groupTable(arc = arcOfMonth(currentMonth())) {
  const weeks = arcWeeks(arc);
  const groupWeeks = arcGroupWeeks(arc);
  const before = playedWeeks().filter((w) => !weeks.includes(w.key)).sort((a, b) => b.score - a.score);

  const rivals = [];
  if (before.length) {
    // Best, then four spread down the record.
    const at = [0, 0.15, 0.35, 0.6, 0.85].map((f) => Math.min(before.length - 1, Math.round(f * (before.length - 1))));
    for (const i of [...new Set(at)]) rivals.push({ key: before[i].key, score: before[i].score });
  }
  const mine = groupWeeks.map(weekScore).filter((w) => !w.void && w.due >= VOID_CELLS);
  const you = mine.length ? mine.reduce((a, w) => a + w.score, 0) / mine.length : 0;
  const need = arcWeeksNeeded(groupWeeks);
  // A cup needs a field, and you have to have played in it.
  const eligible = mine.length >= need && rivals.length >= ARC_MIN_RIVALS;

  const table = [
    // Every row is you: the subtitle says so and the bold row marks which one.
    ...rivals.map((r, i) => ({ you: false, name: weekLabel(r.key), week: r.key, score: r.score, seed: i + 1 })),
    { you: true, name: 'This Arc', week: null, score: you, played: mine.length, of: groupWeeks.length },
  ].sort((a, b) => b.score - a.score);

  const place = table.findIndex((r) => r.you) + 1;
  return {
    arc,
    table,
    place,
    // Third in a field of one is not third.
    qualifies: eligible && place <= 3,
    eligible,
    need,
    rivals: rivals.length,
    groupWeeks,
    played: mine.length,
  };
}
