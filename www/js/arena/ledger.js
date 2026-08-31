// The write path. The only code that stores a result: backfill on first run,
// then sync() on every launch closes weeks, groups and months. Everything else
// in the Arena reads what this wrote.

import * as store from '../store.js';
import { DIVISIONS, divisionIndex, divisionForScore } from './ladder.js';
import {
  currentWeek, nextWeek, weekClosed, monthOfWeek, weeksOfMonth, currentMonth,
  arcOfMonth, arcKey, arcStage, arcGroupWeeks, previousArc,
} from './calendar.js';
import { scoreWeek, monthScore, firstRecordDay, firstWeekWithData, weekHasEntries } from './scoring.js';
import { fixtureFor, blankArc, groupTable } from './fixtures.js';

/** Scoring rule version. A bump re-scores unplayed weeks. See `rescore`. */
const SCORING = 1;
const MAX_BACKFILL_WEEKS = 130;

/** Past weeks get a score so there is something to compete against at once.
 *  Marked 'record', not won or lost: they are the opponents, not results. */
function backfill(st) {
  let key = firstWeekWithData();
  const stop = currentWeek();
  let guard = MAX_BACKFILL_WEEKS;
  const first = key;
  while (key < stop && guard-- > 0) {
    if (!st.arena.weeks[key]) {
      const s = scoreWeek(key);
      // One marked cell used to conjure a record back to the habit's creation,
      // then relegate you for the empty weeks in between.
      if (s.due > 0 && weekHasEntries(key)) {
        st.arena.weeks[key] = {
          score: s.score, due: s.due, done: s.done,
          opponent: '', oppName: '', oppScore: null,
          result: s.void ? 'void' : 'record', arc: null,
        };
      }
    }
    key = nextWeek(key);
  }
  st.arena.backfilled = true;
  // Fixed here and never again: every year boundary measures from it.
  if (!st.arena.anchor) st.arena.anchor = firstRecordDay() || store.dayKey(new Date(st.createdAt));
  return first;
}

/** Play out every week that has ended since we last looked. Returns what
 *  happened, so the app can show it. */
function closeWeeks(st, events) {
  const stop = currentWeek();
  // From the earliest ended week with no result, the first one included: on a
  // new install that week is the placement, and there is nothing before it to
  // be a record. An install with history had its oldest week stamped 'record'
  // by backfill already, so this skips it.
  let key = firstWeekWithData();
  let guard = MAX_BACKFILL_WEEKS;
  while (key < stop && guard-- > 0) {
    const existing = st.arena.weeks[key];
    if (existing && existing.result) {
      key = nextWeek(key);
      continue;
    }
    const s = scoreWeek(key);
    // A week nobody answered is not a week they lost. Without this a single
    // marked cell settled every week between then and now as a defeat.
    if (s.due === 0 || !weekHasEntries(key)) {
      key = nextWeek(key);
      continue;
    }
    settleGroup(st, key, events);
    const { stage } = arcStage(key);
    if (s.void) {
      st.arena.weeks[key] = { score: s.score, due: s.due, done: s.done, opponent: '', oppName: '', oppScore: null, result: 'void', arc: null };
      key = nextWeek(key);
      continue;
    }
    const opp = fixtureFor(key);
    // Level is a win. Otherwise a perfect week makes your Nemesis unbeatable for ever.
    const won = s.score >= opp.score;
    st.arena.weeks[key] = {
      score: s.score, due: s.due, done: s.done,
      opponent: opp.id, oppName: opp.name, oppScore: opp.score,
      result: won ? 'won' : 'lost',
      arc: opp.knockout || (stage === 'group' ? 'group' : null),
    };
    if (opp.knockout) {
      const arc = arcOfMonth(monthOfWeek(key));
      const rec = (st.arena.arcs[arcKey(arc)] ||= blankArc());
      rec[opp.knockout] = won ? 'won' : 'lost';
      if (opp.knockout === 'final' && won) rec.won = true;
      events.push({ kind: 'arc', round: opp.knockout, won, arc, week: key, score: s.score, oppScore: opp.score, oppName: opp.name });
    }
    // The first week you actually play sets your division outright. Waiting a
    // whole month to be told where you stand is a month of playing nothing.
    if (!st.arena.placed) {
      st.arena.placed = true;
      st.arena.placedWeek = key;
      st.arena.division = divisionForScore(s.score).id;
    }
    events.push({ kind: 'week', week: key, won, score: s.score, opp, rows: s.rows });
    key = nextWeek(key);
  }
}

/** Qualification settles before that week's fixture is drawn. Closing three
 *  weeks at once would otherwise draw the quarter-final as an ordinary week. */
function settleGroup(st, key, events) {
  const { arc, stage } = arcStage(key);
  if (stage !== 'qf' && stage !== 'sf' && stage !== 'final') return;
  const k = arcKey(arc);
  const rec = (st.arena.arcs[k] ||= blankArc());
  if (rec.qualified !== null) return;
  const table = groupTable(arc);
  rec.qualified = table.qualifies;
  events.push({ kind: 'group', arc, qualified: rec.qualified, place: table.place, table: table.table });
}

/** Re-score to the current rule. Weeks the Arena scored are recomputed, weeks
 *  actually played are not: a result stands even when the rule was corrected. */
function rescore(st) {
  if (!st.arena.anchor) st.arena.anchor = firstRecordDay() || store.dayKey(new Date(st.createdAt));
  if (st.arena.scoring >= SCORING) return;
  st.arena.scoring = SCORING;

  const played = new Set(
    Object.entries(st.arena.weeks)
      .filter(([, w]) => w.result === 'won' || w.result === 'lost')
      .map(([k]) => k)
  );

  for (const key of Object.keys(st.arena.weeks)) {
    if (played.has(key)) continue;
    const s = scoreWeek(key);
    if (s.due === 0) {
      delete st.arena.weeks[key];
      continue;
    }
    st.arena.weeks[key] = { ...st.arena.weeks[key], score: s.score, due: s.due, done: s.done, result: s.void ? 'void' : 'record' };
  }

  // A month holding a real match keeps its verdict, and so does everything after it.
  const stale = Object.keys(st.arena.months).filter((m) => !weeksOfMonth(m).some((w) => played.has(w)));
  if (stale.length === Object.keys(st.arena.months).length) {
    st.arena.division = 'npc';
    st.arena.placed = false;
  }
  for (const m of stale) delete st.arena.months[m];
}

/** Qualification for the running arc, when no week has closed since the group ended. */
function closeGroups(st, events) {
  const arc = arcOfMonth(currentMonth());
  for (const a of [previousArc(arc), arc]) {
    const k = arcKey(a);
    const groupWeeks = arcGroupWeeks(a);
    if (!groupWeeks.length || !weekClosed(groupWeeks[groupWeeks.length - 1])) continue;
    // A cup you were never in is not one you went out of. Settling an arc whose
    // group weeks predate the record wrote a defeat on first launch.
    if (!groupWeeks.some((w) => st.arena.weeks[w])) continue;
    const rec = (st.arena.arcs[k] ||= blankArc());
    if (rec.qualified !== null) continue;
    const table = groupTable(a);
    rec.qualified = table.qualifies;
    events.push({ kind: 'group', arc: a, qualified: rec.qualified, place: table.place, table: table.table });
  }
}

/** A month ends: up, stay, or down. */
function closeMonths(st, events) {
  const nowMonth = currentMonth();
  const known = Object.keys(st.arena.weeks).map(monthOfWeek);
  const months = [...new Set(known)].filter((m) => m < nowMonth).sort();
  for (const m of months) {
    if (st.arena.months[m]) continue;
    // Weeks before the record began are absent, not pending: waiting on them
    // meant the first month never settled and the ladder never applied.
    const recordFrom = firstWeekWithData();
    const weeks = weeksOfMonth(m).filter((w) => w >= recordFrom);
    if (!weeks.length) continue;
    if (!weeks.every((w) => st.arena.weeks[w] || w > currentWeek())) continue;
    const ms = monthScore(m);
    if (ms.empty) continue;
    const from = st.arena.division;
    const i = divisionIndex(from);
    const next = DIVISIONS[i + 1];
    let to = from;
    let move = 'held';
    if (next && ms.score >= next.bar) {
      to = next.id;
      move = 'up';
    } else if (ms.score >= DIVISIONS[i].bar) {
      move = 'held';
    } else if (i > 0) {
      to = DIVISIONS[i - 1].id;
      move = 'down';
    } else {
      // Nothing below the floor, so a month under its bar is not a relegation.
      move = 'held';
    }
    st.arena.division = to;
    // A settled month places you. Only closeWeeks used to, and it skips any
    // week backfill had already stamped, so an install with history was told
    // for ever that it was still its placement month.
    st.arena.placed = true;
    st.arena.months[m] = { score: ms.score, w: ms.w, l: ms.l, from, to, move };
    events.push({ kind: 'month', month: m, score: ms.score, from, to, move, w: ms.w, l: ms.l });
  }
}

/** Safe on every launch and render: writes only when something finished. */
export function sync() {
  const events = [];
  store.update((st) => {
    if (!st.arena.backfilled) backfill(st);
    rescore(st);
    closeWeeks(st, events);
    closeGroups(st, events);
    closeMonths(st, events);
  });
  return events;
}

/** Results not yet shown, so a week is won on a screen rather than in silence. */
export function unseenResults() {
  const a = store.get().arena;
  const closed = Object.entries(a.weeks)
    .filter(([k, w]) => (w.result === 'won' || w.result === 'lost') && k > a.seenWeek && k < currentWeek())
    .sort((x, y) => (x[0] < y[0] ? -1 : 1));
  if (!closed.length) return null;
  const [key, week] = closed[closed.length - 1];

  // A month is announced with its own last week, which seenWeek already tracks.
  const month = Object.entries(a.months)
    .map(([m, v]) => ({ month: m, ...v, last: weeksOfMonth(m).slice(-1)[0] || '' }))
    .filter((m) => m.last > a.seenWeek && m.last <= key)
    .sort((x, y) => (x.month < y.month ? -1 : 1))
    .pop() || null;

  // Same for a knockout round: it belongs to the week it was played in.
  const arcWeek = closed
    .filter(([k, w]) => w.arc && w.arc !== 'group' && k > a.seenWeek)
    .pop();
  const arc = arcWeek ? { round: arcWeek[1].arc, won: arcWeek[1].result === 'won', week: arcWeek[0] } : null;

  return { key, week, month, arc };
}
