// Arena domain, assembled. The parts, in dependency order:
//   ladder.js    the nine divisions
//   calendar.js  weeks, months, arcs as dates
//   scoring.js   the roster and what a week is worth
//   fixtures.js  opponents, the knockout, the group table
//   ledger.js    the write path: sync() and everything it settles
// This file re-exports all of it and keeps what sits across the parts:
// arc state, moments, alarms, notes, years, standing, the review.
//
// Every opponent is a real week out of your own record. A week is a match, a
// month is a season, a quarter is an Arc laid over the same weeks.
// The only feature that stores what it could derive. See sync() and docs/ARENA.md.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as native from '../native.js';
import { DIVISIONS, UNRANKED, divisionOf, divisionIndex, divisionForScore } from './ladder.js';
import {
  currentWeek, prevWeek, weekStart, weekEnd, weekDays, weeksOfMonth, currentMonth,
  arcOfMonth, arcKey, arcLabel, arcWeeks, arcSeason, arcGroupWeeks, arcStage, nextArc, daysUntil,
} from './calendar.js';
import {
  VOID_CELLS, hasRecord, scoreWeek, weekScore, storedWeeks, playedWeeks, monthScore, firstRecordDay,
} from './scoring.js';
import { blankArc, KNOCKOUT, arcFixture, groupTable } from './fixtures.js';

export * from './ladder.js';
export * from './calendar.js';
export * from './scoring.js';
export * from './fixtures.js';
export * from './ledger.js';

/* ---------------- where the cup is up to ---------------- */
// One answer for every screen showing the Arc. A stage is where the calendar is,
// a phase is where you are: they part company when you are knocked out.

export function arcRecord(arc) {
  return store.get().arena.arcs[arcKey(arc)] || blankArc();
}

/** Everything the Arc is, right now. */
export function arcState(key = currentWeek()) {
  const { arc, stage, season } = arcStage(key);
  const rec = arcRecord(arc);
  const group = arcGroupWeeks(arc);
  const out =
    rec.qualified === false || rec.qf === 'lost' || rec.sf === 'lost' || rec.final === 'lost';

  const phase = rec.final === 'won' ? 'champion' : stage === 'break' ? 'break' : out ? 'out' : stage;

  // Next arc. Once you are out, this one is over whatever the calendar says.
  const upcoming = nextArc(arc);
  const opensOn = weekStart(arcSeason(upcoming)[0] || arcWeeks(upcoming)[0]);

  // Weeks played, not weeks elapsed.
  const table = groupTable(arc);
  const elapsed = group.filter((w) => w < key).length;
  return {
    arc,
    key: arcKey(arc),
    label: arcLabel(arc),
    trophy: `${arc.name} Trophy`,
    stage,
    phase,
    rec,
    season,
    group,
    // group
    played: table.played,
    elapsed,
    // is this a cup at all
    eligible: table.eligible,
    need: table.need,
    rivals: table.rivals,
    groupLeft: Math.max(0, group.length - elapsed),
    // knockout
    round: KNOCKOUT[stage] || null,
    fixture: phase === 'qf' || phase === 'sf' || phase === 'final' ? arcFixture(key) : null,
    // ending
    lostAt: rec.final === 'lost' ? 'final' : rec.sf === 'lost' ? 'sf' : rec.qf === 'lost' ? 'qf' : null,
    // countdown
    next: upcoming,
    nextLabel: arcLabel(upcoming),
    opensOn,
    opensIn: daysUntil(opensOn),
  };
}

/** The moment owed to you, if any. Each fires once. */
export function arcMoment() {
  const st = arcState();
  const { rec } = st;
  if (st.phase === 'champion' && !rec.sawCup) return { kind: 'cup', arc: st };
  if (st.stage === 'break') return null;
  if (!rec.sawOpen && st.stage !== 'break') return { kind: 'open', arc: st };
  if (rec.qualified !== null && !rec.sawGroup) return { kind: 'group', arc: st };
  return null;
}

/** The division move you have not been shown. A month that held is not an
 *  event, but it must not bury an earlier promotion either, so the search is
 *  over every month since the last one seen. */
export function rankMoment() {
  const st = store.get().arena;
  // Placement first: it happens on week one, before any month can close.
  if (st.placedWeek && st.placedWeek > st.seenPlacement) {
    const w = st.weeks[st.placedWeek];
    // The division that week earned, not today's: months since then have moved it.
    const to = w ? divisionForScore(w.score).id : st.division;
    return { move: 'placed', week: st.placedWeek, to, from: to, score: w ? w.score : 0 };
  }
  const months = Object.keys(st.months).sort();
  const pending = months.filter((m) => m > st.seenMonth && st.months[m].move !== 'held');
  const month = pending[pending.length - 1];
  return month ? { month, ...st.months[month] } : null;
}

/** Marks every month up to the newest as shown, so a held month behind an
 *  announced one does not queue itself later. */
export function markRankSeen() {
  store.update((sst) => {
    if (sst.arena.placedWeek > sst.arena.seenPlacement) {
      sst.arena.seenPlacement = sst.arena.placedWeek;
      return;
    }
    const months = Object.keys(sst.arena.months).sort();
    sst.arena.seenMonth = months[months.length - 1] || sst.arena.seenMonth;
  });
}

export function markArcSeen(key, which) {
  store.update((sst) => {
    const rec = (sst.arena.arcs[key] ||= blankArc());
    if (which === 'open') rec.sawOpen = true;
    if (which === 'group') rec.sawGroup = true;
    if (which === 'cup') rec.sawCup = true;
  });
}

/* ----------------------- alarms ----------------------- */

function alarmPlan() {
  const st = arcState();
  const out = [];
  const at = (dayKey, hour, minute = 0) => {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Date(y, m - 1, d, hour, minute, 0, 0).getTime();
  };

  if (st.phase === 'break' || st.phase === 'out') {
    out.push({
      slot: 0,
      at: at(st.opensOn, 9),
      title: `The ${st.next.name} opens today`,
      body: 'Six of you, three go through. Your first week starts now.',
    });
  }

  // The group ending and the quarter starting are the same date, either way.
  if (st.phase === 'group') {
    const qfWeek = st.season[st.season.length - 3];
    if (qfWeek) {
      out.push({
        slot: 1,
        at: at(weekStart(qfWeek), 9),
        title: `${st.arc.name}: the group stage is over`,
        body: 'Top three go through. Open the Arena to see whether you are one of them.',
      });
    }
  }

  // No score in the body: by Saturday it would be days old.
  if (st.fixture) {
    const sunday = weekEnd(currentWeek());
    out.push({
      slot: 2,
      at: at(store.addDays(sunday, -1), 18),
      title: `The ${st.round.name.toLowerCase()} ends tomorrow`,
      body: `You are playing ${st.fixture.name}. One day left to take it.`,
    });
  }

  return out;
}

export async function syncAlarms() {
  if (!native.hasAlarms()) return;
  const plan = alarmPlan();
  const ids = Array.from({ length: native.ALARM_ARENA_SLOTS }, (_, i) => native.ALARM_ARENA_BASE + i);
  await native.cancelAlarms(ids);
  const now = Date.now();
  for (const a of plan) {
    if (a.at <= now) continue;
    await native.scheduleAlarm(native.ALARM_ARENA_BASE + a.slot, a.at, a.title, a.body);
  }
}

/** What would be scheduled. An APK-only alarm is otherwise unverifiable. */
export const plannedAlarms = () => alarmPlan();

/* ----------------------- notes ----------------------- */

export const MAX_NOTE = 140;

export const noteFor = (key) => store.get().arena.weeks[key]?.note || '';

export function setNote(key, text) {
  store.update((st) => {
    if (st.arena.weeks[key]) st.arena.weeks[key].note = String(text || '').slice(0, MAX_NOTE).trim();
  });
}

export function setArcNote(key, text) {
  store.update((st) => {
    if (st.arena.arcs[key]) st.arena.arcs[key].note = String(text || '').slice(0, MAX_NOTE).trim();
  });
}

/** Best on the record, not merely good: this is what the offer hangs on. */
export function isBestWeek(key) {
  const w = storedWeeks()[key];
  if (!w || w.result === 'void' || w.due < VOID_CELLS) return false;
  return playedWeeks().every((x) => x.key === key || x.score <= w.score);
}

/** Every line, newest first. */
export function notes() {
  const a = store.get().arena;
  const fromWeeks = Object.entries(a.weeks)
    .filter(([, w]) => w.note)
    .map(([key, w]) => ({ kind: 'week', key, at: key, note: w.note, score: w.score }));
  const fromArcs = Object.entries(a.arcs)
    .filter(([, x]) => x.note)
    .map(([key, x]) => ({ kind: 'arc', key, at: key, note: x.note }));
  return [...fromWeeks, ...fromArcs].sort((x, y) => (x.at < y.at ? 1 : -1));
}

/* ----------------------- years ----------------------- */

export const YEAR_DAYS = 365;

/** The anchor. Fixed on first sync, never recomputed. */
export function anchorDay() {
  const st = store.get();
  if (st.arena.anchor) return st.arena.anchor;
  const first = firstRecordDay();
  return first || store.dayKey(new Date(st.createdAt));
}

/** 26/27, or 26 for a year starting on New Year's Day. */
export function yearLabel(from, to) {
  const a = from.slice(2, 4);
  const b = to.slice(2, 4);
  return a === b ? a : `${a}/${b}`;
}

/** Year `n`, from zero. */
export function yearAt(n) {
  const from = store.addDays(anchorDay(), YEAR_DAYS * n);
  const to = store.addDays(from, YEAR_DAYS - 1);
  return { n, from, to, label: yearLabel(from, to), open: to < habits.today() };
}

/** The year running now. */
export function currentYearIndex() {
  const today = habits.today();
  const anchor = anchorDay();
  let n = 0;
  // Counted, not divided: milliseconds are an hour out twice a year.
  while (n < 200 && store.addDays(anchor, YEAR_DAYS * (n + 1)) <= today) n++;
  return n;
}

/** Every year, oldest first, the running one marked shut. */
export function years() {
  const now = currentYearIndex();
  return Array.from({ length: now + 1 }, (_, n) => yearAt(n));
}

/** Days until this year can be looked at. */
export function daysLeftInYear() {
  const y = yearAt(currentYearIndex());
  const today = habits.today();
  let n = 0;
  let k = today;
  while (k <= y.to && n < YEAR_DAYS + 2) {
    n++;
    k = store.addDays(k, 1);
  }
  return n;
}

/** Weeks inside a year, by the Thursday rule. */
export function weeksOfYear(y) {
  return Object.keys(store.get().arena.weeks)
    .filter((k) => {
      const thu = store.addDays(weekStart(k), 3);
      return thu >= y.from && thu <= y.to;
    })
    .sort();
}

/** The twelve months a year covers, as 'YYYY-MM'. */
export function monthsOfYear(y) {
  const out = [];
  let m = y.from.slice(0, 7);
  const last = y.to.slice(0, 7);
  let guard = 24;
  while (guard-- > 0) {
    out.push(m);
    if (m === last) break;
    const [yy, mm] = m.split('-').map(Number);
    m = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, '0')}`;
  }
  return out;
}

/* ---------------- standing ---------------- */

export function standing() {
  const a = store.get().arena;
  const unranked = !hasRecord();
  const div = unranked ? UNRANKED : divisionOf(a.division);
  const i = divisionIndex(a.division);
  const next = unranked ? null : DIVISIONS[i + 1] || null;
  const below = unranked ? null : DIVISIONS[i - 1] || null;
  const month = monthScore(currentMonth());
  return {
    division: div,
    unranked,
    next,
    below,
    placed: a.placed,
    month,
    safe: month.score >= div.bar,
  };
}

/** What the weeks left have to average to land on a target.
 *
 *  A month is the mean of its scored weeks, so hitting T over n weeks when k
 *  are already banked at a total of `have` needs (T*n - have) / (n - k) from
 *  what is left. Returns null when the month is out of weeks, and the number is
 *  reported even when it is above 100%: 'you cannot get there from here' is a
 *  fact worth knowing on the 24th. */
export function needFromHere(target, month = currentMonth()) {
  const keys = weeksOfMonth(month);
  const now = currentWeek();
  const banked = keys.filter((k) => k < now).map(weekScore).filter((w) => !w.void && w.due >= VOID_CELLS);
  const left = keys.filter((k) => k >= now);
  if (!left.length) return null;
  const total = banked.length + left.length;
  const have = banked.reduce((a, w) => a + w.score, 0);
  return { need: (target * total - have) / left.length, weeks: left.length };
}

/** Weeks left this month, counting the one being played. */
export function weeksLeft() {
  const keys = weeksOfMonth(currentMonth());
  return Math.max(0, keys.length - keys.indexOf(currentWeek()));
}

/* ---------------------- the review ---------------------- */

/** The week the review is about: this one on its last day, the one just gone
 *  after that. Sunday reviews a week you can still change. */
export function reviewWeek() {
  const cur = currentWeek();
  return habits.today() === weekEnd(cur) ? cur : prevWeek(cur);
}

/** Offered on Sunday, and for two days after in case Sunday was missed. */
export function reviewDue() {
  const key = reviewWeek();
  if (store.get().arena.reviewed >= key) return false;
  if (weekDays(currentWeek()).indexOf(habits.today()) > 1 && key !== currentWeek()) return false;
  return !scoreWeek(key).void;
}

export function markReviewed(key) {
  store.update((st) => {
    if (key > st.arena.reviewed) st.arena.reviewed = key;
  });
}

export function markSeen(key) {
  store.update((st) => {
    st.arena.seenWeek = key;
  });
}
