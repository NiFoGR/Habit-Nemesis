// Arena domain: weeks, divisions, arcs, standings.
//
// Every opponent is a real week out of your own record. A week is a match, a
// month is a season, a quarter is an Arc laid over the same weeks.
// The only module that stores what it could derive. See sync() and docs/ARENA.md.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as native from '../native.js';

/* ---------------- the ladder ---------------- */

/** Low to high. `bar` is the month score that holds you in the division. */
export const DIVISIONS = [
  { id: 'bottom', name: 'Bottom G', bar: 0, blurb: 'You have the app. That is the whole of it so far.' },
  { id: 'npc', name: 'NPC', bar: 0.25, blurb: 'BiGgEr aNd StRoNgEr ThAn MiKe MeNtZeR' },
  { id: 'prospect', name: 'Prospect', bar: 0.45, blurb: 'Something is happening. Not reliably.' },
  { id: 'contender', name: 'Contender', bar: 0.6, blurb: 'You are in it now. A bad week costs you.' },
  { id: 'menace', name: 'Menace', bar: 0.74, blurb: 'Most weeks go your way and it shows.' },
  { id: 'locked', name: 'Locked In', bar: 0.84, blurb: 'How about, fucking eat more?' },
  { id: 'topg', name: 'Top G', bar: 0.92, blurb: 'You do not miss. Two days a month, at most.' },
];

export const divisionOf = (id) => DIVISIONS.find((d) => d.id === id) || DIVISIONS[1];
export const divisionIndex = (id) => Math.max(0, DIVISIONS.findIndex((d) => d.id === id));

/** The division a month score earns outright, ignoring where you were. */
export function divisionForScore(score) {
  let out = DIVISIONS[0];
  for (const d of DIVISIONS) if (score >= d.bar) out = d;
  return out;
}

/* ----------------------- weeks ----------------------- */

/** Two floors: three days owed and four cells owed. One alone lets a single
 *  daily habit fail, or a skipped fortnight pass. */
export const VOID_CELLS = 4;
export const VOID_DAYS = 3;

/** Scoring rule version. A bump re-scores unplayed weeks. See `rescore`. */
const SCORING = 1;
const MAX_BACKFILL_WEEKS = 130;

const asDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Monday = 0. */
const isoDay = (dt) => (dt.getDay() + 6) % 7;

/** Monday of ISO week 1. */
function week1Monday(year) {
  const jan4 = new Date(year, 0, 4);
  return new Date(year, 0, 4 - isoDay(jan4));
}

export function weekKey(dayKey = habits.today()) {
  const dt = asDate(dayKey);
  // The Thursday decides the year.
  const thu = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - isoDay(dt) + 3);
  const year = thu.getFullYear();
  // Rounded: a DST change inside the span would drop a week.
  const n = Math.round((thu - week1Monday(year)) / (7 * 864e5)) + 1;
  return `${year}-W${String(n).padStart(2, '0')}`;
}

export function weekStart(key) {
  const [y, w] = key.split('-W').map(Number);
  const mon = week1Monday(y);
  return store.dayKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + (w - 1) * 7));
}

export const weekEnd = (key) => store.addDays(weekStart(key), 6);

export function weekDays(key) {
  const from = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => store.addDays(from, i));
}

/** The month a week belongs to, by its Thursday. */
export function monthOfWeek(key) {
  const thu = store.addDays(weekStart(key), 3);
  return thu.slice(0, 7);
}

export const currentWeek = () => weekKey(habits.today());
export const prevWeek = (key) => weekKey(store.addDays(weekStart(key), -1));
export const nextWeek = (key) => weekKey(store.addDays(weekStart(key), 7));

/** Has this week finished? */
export const weekClosed = (key) => weekEnd(key) < habits.today();

/** A week's dates, as a fixture list writes them. */
export function weekLabel(key) {
  const a = asDate(weekStart(key));
  const b = asDate(weekEnd(key));
  const fmt = (d, withMonth) =>
    withMonth ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : String(d.getDate());
  return `${fmt(a, a.getMonth() !== b.getMonth())} – ${fmt(b, true)}`;
}

/* --------------------- the roster --------------------- */

export function rosterFor(key) {
  const monday = asDate(weekStart(key)).getTime();
  const mine = habits.all().filter((h) => {
    if (h.createdAt >= monday) return false; // added after the whistle
    if (!h.archived) return true;
    // No archive date means it left before the week. The safe reading.
    return !!h.archivedAt && h.archivedAt >= monday;
  });
  return [...habits.linkedHabits(), ...mine];
}

/* ---------------------- scoring ---------------------- */

export function scoreWeek(key) {
  const today = habits.today();
  const roster = rosterFor(key);
  const rows = [];
  const days = new Set();
  let done = 0;
  let due = 0;
  for (const h of roster) {
    const sum = habits.summary(h);
    // Days that have happened and were not skipped.
    const live = weekDays(key).filter((d) => d <= today && !sum?.index.get(d)?.skipped);
    for (const d of live) days.add(d);
    const { num, den } = h.freq || { num: 1, den: 1 };

    let rDone;
    let rDue;
    if (den > 1) {
      // Five in seven owes five cells, and does not care which five.
      // Not the engine's satisfied count: its window is trailing, so the same five
      // days scored 100% Mon-Fri and 71% Wed-Sun. Right for a running score, wrong
      // for a fixed week. Floored, so slack is real until Sunday.
      rDue = Math.floor((num * live.length) / den);
      const hits = live.filter((d) => sum?.index.get(d)?.hit).length;
      rDone = Math.min(hits, rDue);
    } else {
      rDue = live.length;
      rDone = live.filter((d) => sum?.index.get(d)?.satisfied).length;
    }

    if (rDue) rows.push({ id: h.id, name: h.name, colour: h.colour, linked: !!h.linked, done: rDone, due: rDue });
    done += rDone;
    due += rDue;
  }
  return { key, done, due, days: days.size, score: due ? done / due : 0, void: due < VOID_CELLS || days.size < VOID_DAYS, rows };
}

/** Stored wins over live: a closed week is a fact, not a view. */
export function weekScore(key) {
  const saved = store.get().arena.weeks[key];
  if (saved) return { key, ...saved, void: saved.result === 'void' };
  return scoreWeek(key);
}

export const storedWeeks = () => store.get().arena.weeks;

/** Any record at all? Void weeks do not count. */
export const hasRecord = () => playedWeeks().length > 0;

/** Every scored week, newest first, voids left out. */
export function playedWeeks() {
  return Object.entries(storedWeeks())
    .filter(([, w]) => w.result !== 'void' && w.due >= VOID_CELLS)
    .map(([key, w]) => ({ key, ...w }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

/* --------------------- opponents --------------------- */

export const OPPONENTS = {
  nemesis: { id: 'nemesis', name: 'Your Nemesis', blurb: 'The best week you have ever had.' },
  lastMonth: { id: 'lastMonth', name: 'Last Month You', blurb: 'This week, one month ago.' },
  standard: { id: 'standard', name: 'The Standard', blurb: "Your division's bar, with a face on it." },
  worst: { id: 'worst', name: 'Your Worst Self', blurb: 'Your worst week of the last three months. Do not lose to him.' },
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

/* ---------------- months ---------------- */

export function weeksOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const out = [];
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const k = weekKey(store.dayKey(new Date(y, m - 1, d)));
    if (monthOfWeek(k) === month && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Mean of its weeks, not one recomputed percentage: each week had a fixed roster. */
export function monthScore(month) {
  const keys = weeksOfMonth(month);
  const scored = keys.map(weekScore).filter((w) => !w.void && w.due >= VOID_CELLS);
  if (!scored.length) return { month, score: 0, weeks: 0, w: 0, l: 0, empty: true };
  const score = scored.reduce((a, w) => a + w.score, 0) / scored.length;
  const w = keys.filter((k) => storedWeeks()[k]?.result === 'won').length;
  const l = keys.filter((k) => storedWeeks()[k]?.result === 'lost').length;
  return { month, score, weeks: scored.length, w, l, empty: false };
}

export const currentMonth = () => monthOfWeek(currentWeek());

/* ------------------------ arcs ------------------------ */

// Three cups a year. Summer is a quarter with no tournament in it: the calendar
// still names it, so every function here stays total, but `cup` is what decides
// whether anything is played.
export const ARCS = [
  { id: 'winter', name: 'Winter Arc', from: 11, to: 1, cup: true }, // Dec, Jan, Feb
  { id: 'spring', name: 'Spring Arc', from: 2, to: 4, cup: true },
  { id: 'summer', name: 'Summer', from: 5, to: 7, cup: false },
  { id: 'autumn', name: 'Autumn Arc', from: 8, to: 10, cup: true },
];

/** The three that are played, in calendar order. */
export const CUPS = ARCS.filter((a) => a.cup);

/** The arc a month is in. Winter crosses New Year, so it files under December. */
export function arcOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const mi = m - 1;
  if (mi === 11) return { ...ARCS[0], year: y };
  if (mi <= 1) return { ...ARCS[0], year: y - 1 };
  const arc = ARCS.find((a) => mi >= a.from && mi <= a.to) || ARCS[1];
  return { ...arc, year: y };
}

export const arcKey = (arc) => `${arc.year}-${arc.id}`;

export function arcLabel(arc) {
  return arc.id === 'winter' ? `${arc.name} ${arc.year}/${String(arc.year + 1).slice(2)}` : `${arc.name} ${arc.year}`;
}

/** Off-season. Without it you are always in a cup, so a cup is never entered. */
export const ARC_BREAK = 2;

/** Every week of an arc, in order. */
export function arcWeeks(arc) {
  const months = arc.id === 'winter'
    ? [`${arc.year}-12`, `${arc.year + 1}-01`, `${arc.year + 1}-02`]
    : [arc.from, arc.from + 1, arc.to].map((m) => `${arc.year}-${String(m + 1).padStart(2, '0')}`);
  return months.flatMap(weeksOfMonth);
}

/** The quarter less its break. Floored at four so there is always a group stage.
 *  A quarter with no cup in it is season-less: every week of it is off-season. */
export function arcSeason(arc) {
  if (!arc.cup) return [];
  const weeks = arcWeeks(arc);
  return weeks.slice(0, Math.max(4, weeks.length - ARC_BREAK));
}

/** Group stage: the season less its last three weeks. */
export const arcGroupWeeks = (arc) => arcSeason(arc).slice(0, -3);

/** Where a week sits: group, knockout, or the break. */
export function arcStage(key) {
  const arc = arcOfMonth(monthOfWeek(key));
  const weeks = arcWeeks(arc);
  const season = arcSeason(arc);
  const i = season.indexOf(key);
  if (i < 0) return { arc, weeks, season, stage: 'break', index: -1 };
  const fromEnd = season.length - 1 - i;
  const stage = fromEnd === 0 ? 'final' : fromEnd === 1 ? 'sf' : fromEnd === 2 ? 'qf' : 'group';
  return { arc, weeks, season, stage, index: i };
}

/** The next cup. Summer holds no cup, so it is stepped over rather than counted
 *  down to: a countdown to a tournament that never opens is a lie. */
export function nextArc(arc) {
  let cursor = arc;
  for (let i = 0; i < ARCS.length; i++) {
    cursor = stepArc(cursor, 1);
    if (cursor.cup) return cursor;
  }
  return { ...ARCS[0], year: arc.year };
}

/** The cup before this one, for the quarter-final's opponent. */
export function previousArc(arc) {
  let cursor = arc;
  for (let i = 0; i < ARCS.length; i++) {
    cursor = stepArc(cursor, -1);
    if (cursor.cup) return cursor;
  }
  return { ...ARCS[0], year: arc.year - 1 };
}

/** One quarter forward or back, cup or not.
 *
 *  ARCS is not in chronological order: winter is filed under its own December
 *  and runs into the next year, so within a filing year it comes last, after
 *  autumn. Stepping has to walk that order, not the array's. */
const ARC_ORDER = ['spring', 'summer', 'autumn', 'winter'];

function stepArc(arc, dir) {
  const i = ARC_ORDER.indexOf(arc.id);
  const j = (i + dir + ARC_ORDER.length) % ARC_ORDER.length;
  // The only year change is the winter wrap, in either direction.
  const year = arc.year + (dir > 0 && j === 0 ? 1 : dir < 0 && i === 0 ? -1 : 0);
  return { ...ARCS.find((a) => a.id === ARC_ORDER[j]), year };
}

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
    const year = String(asDate(weekStart(key)).getFullYear());
    w = bestOf(Object.keys(storedWeeks()).filter((k) => monthOfWeek(k).startsWith(year)), key);
  } else {
    w = nemesisWeek(key);
  }
  if (!w) {
    return { id: stage, name: round.who, blurb: `${round.name} · ${round.opponent}`, score: divisionOf(store.get().arena.division).bar, week: null, knockout: stage };
  }
  return { id: stage, name: round.who, blurb: `${round.name} · ${round.opponent} · ${weekLabel(w.key)}`, score: w.score, week: w.key, knockout: stage };
}

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
    ...rivals.map((r, i) => ({ you: false, name: `You, ${weekLabel(r.key)}`, week: r.key, score: r.score, seed: i + 1 })),
    { you: true, name: 'You, this Arc', week: null, score: you, played: mine.length, of: groupWeeks.length },
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

/* ---------------- where the cup is up to ---------------- */
// One answer for every screen showing the Arc. A stage is where the calendar is,
// a phase is where you are: they part company when you are knocked out.

/** Whole days to a day key, never negative. */
export function daysUntil(key) {
  const today = habits.today();
  if (key <= today) return 0;
  let n = 0;
  let k = today;
  while (k < key && n < 400) {
    n++;
    k = store.addDays(k, 1);
  }
  return n;
}

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
  const months = Object.keys(st.months).sort();
  const pending = months.filter((m) => m > st.seenMonth && st.months[m].move !== 'held');
  const month = pending[pending.length - 1];
  return month ? { month, ...st.months[month] } : null;
}

/** Marks every month up to the newest as shown, so a held month behind an
 *  announced one does not queue itself later. */
export function markRankSeen() {
  store.update((sst) => {
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

/** Earliest recorded day across every row. */
function firstRecordDay() {
  let earliest = null;
  for (const h of [...habits.linkedHabits(), ...habits.all()]) {
    const sum = habits.summary(h);
    const first = sum?.days.find((d) => d.raw !== undefined);
    if (first && (!earliest || first.key < earliest)) earliest = first.key;
  }
  return earliest;
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

/** Unranked. Shaped like a division so callers can read `.name`, but it has
 *  no bar: it is the absence of a rung. */
export const UNRANKED = { id: 'unranked', name: 'Unranked', bar: 0, blurb: 'Play a week and the app will tell you.' };

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

export function daysLeftInWeek() {
  const today = habits.today();
  const days = weekDays(currentWeek()).filter((d) => d >= today);
  return days.length;
}

/** The oldest week with any data. */
function firstWeekWithData() {
  const all = [...habits.linkedHabits(), ...habits.all()];
  let earliest = null;
  for (const h of all) {
    const sum = habits.summary(h);
    const first = sum?.days.find((d) => d.raw !== undefined);
    if (first && (!earliest || first.key < earliest)) earliest = first.key;
  }
  return earliest ? weekKey(earliest) : currentWeek();
}

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
      if (s.due > 0) {
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
  let key = nextWeek(firstWeekWithData());
  let guard = MAX_BACKFILL_WEEKS;
  // From the earliest ended week with no result.
  while (key < stop && guard-- > 0) {
    const existing = st.arena.weeks[key];
    if (existing && existing.result) {
      key = nextWeek(key);
      continue;
    }
    const s = scoreWeek(key);
    if (s.due === 0) {
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
    const weeks = weeksOfMonth(m);
    if (!weeks.every((w) => st.arena.weeks[w] || w > currentWeek())) continue;
    const ms = monthScore(m);
    if (ms.empty) continue;
    const from = st.arena.division;
    const i = divisionIndex(from);
    const next = DIVISIONS[i + 1];
    let to = from;
    let move = 'held';
    if (!st.arena.placed) {
      // A placement season sets the division outright and cannot relegate.
      to = divisionForScore(ms.score).id;
      move = 'placed';
      st.arena.placed = true;
    } else if (next && ms.score >= next.bar) {
      to = next.id;
      move = 'up';
    } else if (ms.score >= DIVISIONS[i].bar) {
      move = 'held';
    } else {
      to = (DIVISIONS[i - 1] || DIVISIONS[0]).id;
      move = 'down';
    }
    st.arena.division = to;
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

export function markSeen(key) {
  store.update((st) => {
    st.arena.seenWeek = key;
  });
}
