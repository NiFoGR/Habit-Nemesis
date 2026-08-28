// The Arena: the domain. Weeks, divisions, arcs and everything that decides
// where you stand.
//
// The rule that shapes all of it: there are no invented opponents. Every rival
// is a real week out of your own history, which is the only reason beating one
// means anything - and the reason you can tap any of them and look at the grid
// they actually played.
//
// Three rhythms, one ladder. A week is a match, a month is a season, a quarter
// is an Arc. They are not three systems: the week is the unit, the month counts
// the weeks, and the Arc is a bracket laid over the same weeks.
//
// This is also the one module in the app that stores what it could derive, and
// the distinction is deliberate. See `sync()` and docs/ARENA.md.

import * as store from '../store.js';
import * as habits from '../habits/program.js';

/* ---------------- the ladder ---------------- */

/** Low to high. `bar` is the month score that holds you in the division, and
 *  reaching the one above promotes you. */
export const DIVISIONS = [
  { id: 'bottom', name: 'Bottom G', bar: 0, blurb: 'You have the app. That is the whole of it so far.' },
  { id: 'npc', name: 'NPC', bar: 0.25, blurb: 'Going through the motions. Some days happen to you.' },
  { id: 'prospect', name: 'Prospect', bar: 0.45, blurb: 'Putting work in. Not yet reliable, but it is there.' },
  { id: 'contender', name: 'Contender', bar: 0.6, blurb: 'You are in it now. A bad week costs you something.' },
  { id: 'menace', name: 'Menace', bar: 0.74, blurb: 'Dangerous. Most weeks go your way and everyone can tell.' },
  { id: 'locked', name: 'Locked In', bar: 0.84, blurb: 'A good week is just a week. This is the standard now.' },
  { id: 'topg', name: 'Top G', bar: 0.92, blurb: 'You do not miss. Two days a month, at the very most.' },
];

export const divisionOf = (id) => DIVISIONS.find((d) => d.id === id) || DIVISIONS[1];
export const divisionIndex = (id) => Math.max(0, DIVISIONS.findIndex((d) => d.id === id));

/** The division a month score earns outright, ignoring where you were. */
export function divisionForScore(score) {
  let out = DIVISIONS[0];
  for (const d of DIVISIONS) if (score >= d.bar) out = d;
  return out;
}

/* ---------------- weeks ----------------
   ISO weeks, and the ISO rule for which month a week belongs to: the one
   containing its Thursday. Weeks do not align to months, and without a rule
   that says so out loud, the last week of a month gets counted twice or not at
   all depending on which end you look from. */

/** What makes a week a fixture at all. Two floors, because one was not
 *  enough in either direction.
 *
 *  Cells alone said seven, which a single daily habit hits exactly and loses
 *  the moment you skip a day - so somebody keeping one thing could never play.
 *  Days alone would let a fortnight of one habit through. Both together are
 *  the honest reading of "was this a week": something owed on at least three
 *  days, and at least four things owed in total. A week you skipped your way
 *  through fails the second floor however many rows you keep, which is the
 *  case the rule exists for. */
export const VOID_CELLS = 4;
export const VOID_DAYS = 3;
const MAX_BACKFILL_WEEKS = 130;

const asDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Monday = 0, which is what every calculation below wants. */
const isoDay = (dt) => (dt.getDay() + 6) % 7;

/** The Monday of the ISO week containing 1 January's week-1 anchor. */
function week1Monday(year) {
  const jan4 = new Date(year, 0, 4);
  return new Date(year, 0, 4 - isoDay(jan4));
}

export function weekKey(dayKey = habits.today()) {
  const dt = asDate(dayKey);
  // The Thursday decides the year: a week straddling New Year belongs to
  // whichever year holds most of it.
  const thu = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - isoDay(dt) + 3);
  const year = thu.getFullYear();
  // Rounded, not floored: a DST change inside the span is an hour out and
  // would otherwise drop a week.
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

/** Has this week finished? Its Sunday is behind us. */
export const weekClosed = (key) => weekEnd(key) < habits.today();

/** A week's dates, written the way a fixture list writes them. */
export function weekLabel(key) {
  const a = asDate(weekStart(key));
  const b = asDate(weekEnd(key));
  const fmt = (d, withMonth) =>
    withMonth ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : String(d.getDate());
  return `${fmt(a, a.getMonth() !== b.getMonth())} – ${fmt(b, true)}`;
}

/* ---------------- the roster ----------------
   Locked on Monday. The reasoning is in docs/ARENA.md and it is the single
   most argued-over rule here: a habit added on Wednesday would otherwise
   change the denominator of a match already in progress, so you would lose a
   fixture you had won, for the crime of adding a habit. */

export function rosterFor(key) {
  const monday = asDate(weekStart(key)).getTime();
  const mine = habits.all().filter((h) => {
    if (h.createdAt >= monday) return false; // added after the whistle
    if (!h.archived) return true;
    // Archived, but was it still yours during this week? Without a date we
    // have to assume it left before the week, which is the safe reading.
    return !!h.archivedAt && h.archivedAt >= monday;
  });
  return [...habits.linkedHabits(), ...mine];
}

/* ---------------- scoring ----------------
   A cell is one row on one day. It is done when that row was *satisfied*, which
   is the habits engine's own word, so a habit asking for three days in seven is
   satisfied on the days it does not ask for. A skipped day leaves both halves
   of the fraction, which is what a skip means everywhere else in this app. */

export function scoreWeek(key) {
  const today = habits.today();
  const roster = rosterFor(key);
  const rows = [];
  const days = new Set();
  let done = 0;
  let due = 0;
  for (const h of roster) {
    const sum = habits.summary(h);
    let rDone = 0;
    let rDue = 0;
    for (const day of weekDays(key)) {
      if (day > today) continue; // the future is not owed yet
      const d = sum?.index.get(day);
      if (d?.skipped) continue;
      rDue++;
      days.add(day);
      if (d?.satisfied) rDone++;
    }
    if (rDue) rows.push({ id: h.id, name: h.name, colour: h.colour, linked: !!h.linked, done: rDone, due: rDue });
    done += rDone;
    due += rDue;
  }
  return { key, done, due, days: days.size, score: due ? done / due : 0, void: due < VOID_CELLS || days.size < VOID_DAYS, rows };
}

/** A stored week if we have one, a live computation if we do not. Stored wins:
 *  once a week is over, its score is a historical fact and must not move
 *  because a habit's frequency was edited this morning. */
export function weekScore(key) {
  const saved = store.get().arena.weeks[key];
  if (saved) return { key, ...saved, void: saved.result === 'void' };
  return scoreWeek(key);
}

export const storedWeeks = () => store.get().arena.weeks;

/** Every week we have a score for, newest first, voids left out: a void week
 *  is not a performance and has no business being anybody's opponent. */
export function playedWeeks() {
  return Object.entries(storedWeeks())
    .filter(([, w]) => w.result !== 'void' && w.due >= VOID_CELLS)
    .map(([key, w]) => ({ key, ...w }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

/* ---------------- opponents ----------------
   Four archetypes, all of them real weeks out of your own record. Losing to
   Your Worst Self is meant to sting; that is the entire reason he is on the
   fixture list. */

export const OPPONENTS = {
  nemesis: { id: 'nemesis', name: 'Your Nemesis', blurb: 'The best week you have ever had.' },
  lastMonth: { id: 'lastMonth', name: 'Last Month You', blurb: 'This week, one month ago.' },
  standard: { id: 'standard', name: 'The Standard', blurb: "Your division's bar, with a face on it." },
  worst: { id: 'worst', name: 'Your Worst Self', blurb: 'Your worst week of the last three months. Do not lose to him.' },
};

/** The best week ever, excluding the one being played. He is never beaten
 *  permanently: beat him and the week that beat him becomes the new best. */
export function nemesisWeek(exclude = currentWeek()) {
  return playedWeeks().filter((w) => w.key !== exclude).sort((a, b) => b.score - a.score)[0] || null;
}

/** The worst week of a recent window, not of all time. All time was the first
 *  version and it made one fixture a month meaningless: a record going back a
 *  year hands you a 17% week from before you knew what you were doing, and
 *  beating it says nothing. Thirteen weeks back is still a real week, still
 *  yours, and still one you would be ashamed to lose to. */
export function worstWeek(exclude = currentWeek(), within = 13) {
  const floor = weekKey(store.addDays(weekStart(exclude), -within * 7));
  const recent = playedWeeks().filter((w) => w.key !== exclude && w.key >= floor);
  const pool = recent.length ? recent : playedWeeks().filter((w) => w.key !== exclude);
  return pool.sort((a, b) => a.score - b.score)[0] || null;
}

/** Who you face in a given week, and what they scored.
 *
 *  Falls back to The Standard whenever the record cannot supply a real
 *  opponent, which is every fixture of your first month and any archetype that
 *  has no week to point at yet. A fabricated rival would be worse than none. */
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

/** A month is the mean of its weeks, not one big recomputed percentage. Every
 *  week had a fixed, fair roster, so this is an average of clean numbers
 *  rather than a blend of two different bars. */
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

/* ---------------- arcs ----------------
   Four a year, on the meteorological seasons. The group stage is every week
   but the last three; then quarter, semi and final, against opponents that get
   harder until the final is your all-time best week. */

export const ARCS = [
  { id: 'winter', name: 'Winter Arc', from: 11, to: 1 }, // Dec, Jan, Feb
  { id: 'spring', name: 'Spring Arc', from: 2, to: 4 },
  { id: 'summer', name: 'Summer Arc', from: 5, to: 7 },
  { id: 'autumn', name: 'Autumn Arc', from: 8, to: 10 },
];

/** Which arc a month falls in, and the year the arc is filed under - winter
 *  crosses New Year, so it is filed under the December. */
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

/** Every week of an arc, in order. */
export function arcWeeks(arc) {
  const months = arc.id === 'winter'
    ? [`${arc.year}-12`, `${arc.year + 1}-01`, `${arc.year + 1}-02`]
    : [arc.from, arc.from + 1, arc.to].map((m) => `${arc.year}-${String(m + 1).padStart(2, '0')}`);
  return months.flatMap(weeksOfMonth);
}

/** Where a given week sits in its arc. The last three are the knockout. */
export function arcStage(key) {
  const arc = arcOfMonth(monthOfWeek(key));
  const weeks = arcWeeks(arc);
  const i = weeks.indexOf(key);
  if (i < 0) return { arc, weeks, stage: null, index: -1 };
  const fromEnd = weeks.length - 1 - i;
  const stage = fromEnd === 0 ? 'final' : fromEnd === 1 ? 'sf' : fromEnd === 2 ? 'qf' : 'group';
  return { arc, weeks, stage, index: i };
}

/** `name` is the round, `who` is who you are playing. They are two different
 *  things and conflating them put the word "Final" where the opponent's name
 *  goes, so the scoreboard read 100% You against 100% Final. */
export const KNOCKOUT = {
  qf: { id: 'qf', name: 'Quarter-final', who: "Last Arc's best", opponent: 'your best week of the last Arc' },
  sf: { id: 'sf', name: 'Semi-final', who: "This year's best", opponent: 'your best week of this year' },
  final: { id: 'final', name: 'Final', who: 'Your Nemesis', opponent: 'your Nemesis' },
};

/** The best week inside a set of week keys. */
function bestOf(keys, exclude) {
  return keys
    .filter((k) => k !== exclude)
    .map((k) => ({ key: k, ...storedWeeks()[k] }))
    .filter((w) => w.score != null && w.result !== 'void' && w.due >= VOID_CELLS)
    .sort((a, b) => b.score - a.score)[0] || null;
}

/** The knockout opponent for a week, or null when this is a group week or you
 *  did not qualify. Losing a round ends your arc: you cannot play the final
 *  after losing the semi. */
export function arcFixture(key) {
  const { arc, stage } = arcStage(key);
  if (!stage || stage === 'group') return null;
  const st = store.get().arena.arcs[arcKey(arc)];
  if (!st?.qualified) return null;
  if (stage === 'sf' && st.qf !== 'won') return null;
  if (stage === 'final' && st.sf !== 'won') return null;

  const round = KNOCKOUT[stage];
  let w = null;
  if (stage === 'qf') {
    const prev = arcWeeks(previousArc(arc));
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

/** The arc immediately before this one.
 *
 *  Winter is the awkward one, twice over, because it is filed under its
 *  December while running into the next year. Winter 2026 is Dec 2026 to Feb
 *  2027, so the arc before it is Autumn 2026 - the same year - and the arc
 *  before Spring 2026 is Winter 2025, the one that has just ended. Walking the
 *  list and taking the year at face value got both of those wrong, and the
 *  quarter-final is played against the best week of "the last Arc", so it was
 *  quietly drawing an opponent out of the wrong quarter. */
export function previousArc(arc) {
  if (arc.id === 'winter') return { ...ARCS[3], year: arc.year };
  if (arc.id === 'spring') return { ...ARCS[0], year: arc.year - 1 };
  const i = ARCS.findIndex((a) => a.id === arc.id);
  return { ...ARCS[i - 1], year: arc.year };
}

/** The group table: you, and five past selves whose scores are already fixed,
 *  so the whole thing is visible from day one and you can see exactly what
 *  qualifying costs. Spread across your record rather than taken from the top,
 *  so the table has a range and not just five copies of your best fortnight. */
export function groupTable(arc = arcOfMonth(currentMonth())) {
  const weeks = arcWeeks(arc);
  const groupWeeks = weeks.slice(0, Math.max(0, weeks.length - 3));
  const before = playedWeeks().filter((w) => !weeks.includes(w.key)).sort((a, b) => b.score - a.score);

  const rivals = [];
  if (before.length) {
    // Best, and then four points spread down the record.
    const at = [0, 0.15, 0.35, 0.6, 0.85].map((f) => Math.min(before.length - 1, Math.round(f * (before.length - 1))));
    for (const i of [...new Set(at)]) rivals.push({ key: before[i].key, score: before[i].score });
  }
  const mine = groupWeeks.map(weekScore).filter((w) => !w.void && w.due >= VOID_CELLS);
  const you = mine.length ? mine.reduce((a, w) => a + w.score, 0) / mine.length : 0;

  const table = [
    ...rivals.map((r, i) => ({ you: false, name: `You, ${weekLabel(r.key)}`, week: r.key, score: r.score, seed: i + 1 })),
    { you: true, name: 'You, this Arc', week: null, score: you, played: mine.length, of: groupWeeks.length },
  ].sort((a, b) => b.score - a.score);

  const place = table.findIndex((r) => r.you) + 1;
  return { arc, table, place, qualifies: place <= 3, groupWeeks, played: mine.length };
}

/* ---------------- standing ---------------- */

export function standing() {
  const a = store.get().arena;
  const div = divisionOf(a.division);
  const i = divisionIndex(a.division);
  const next = DIVISIONS[i + 1] || null;
  const below = DIVISIONS[i - 1] || null;
  const month = monthScore(currentMonth());
  return {
    division: div,
    next,
    below,
    placed: a.placed,
    month,
    safe: month.score >= div.bar,
  };
}

/** Weeks left in this month, counting the one being played. */
export function weeksLeft() {
  const keys = weeksOfMonth(currentMonth());
  return Math.max(0, keys.length - keys.indexOf(currentWeek()));
}

export function daysLeftInWeek() {
  const today = habits.today();
  const days = weekDays(currentWeek()).filter((d) => d >= today);
  return days.length;
}

/* ==========================================================================
   Closing the books
   ==========================================================================
   Everything above reads. This is the only part that writes, and it is the one
   place in the app that stores what it could recompute.

   The reason is that a result is a historical fact rather than a view. If a
   closed week were recomputed, changing a habit's frequency this morning would
   silently rewrite a match won in March, and the calendar's edit-the-past -
   which exists so the record can be corrected - would double as a way to turn
   a defeat into a victory. So a week is scored once, when it ends, and never
   again. The live week is still computed on every read, like everything else. */

/** The oldest week we have any data for at all. */
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

/** The Arena is not empty on the day it ships. Every past week the habits data
 *  covers gets a score, so there is a record to compete against immediately.
 *
 *  They are marked 'record' rather than won or lost, and the difference is the
 *  whole honesty of the thing: those weeks are the opponents, not the results.
 *  Retro-playing them would hand you a form guide full of matches you never
 *  knew you were in, and a result screen on first launch announcing a week you
 *  lost before the feature existed. The months still close from them, so you
 *  arrive at the division your record has actually earned rather than at the
 *  bottom of a ladder you have been climbing for eight months. */
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
  return first;
}

/** Play out any week that has ended since we last looked. Returns what
 *  happened, so the app can show it rather than changing a number in silence. */
function closeWeeks(st, events) {
  const stop = currentWeek();
  let key = nextWeek(firstWeekWithData());
  let guard = MAX_BACKFILL_WEEKS;
  // Start from the earliest week that has no result but has ended.
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
    // Level counts as a win. The first version had a draw go to the opponent,
    // on the grounds that it was harsh and unambiguous, and it was wrong for
    // one reason that only shows up at the top: once you have had a perfect
    // week, your Nemesis is a perfect week, and every fixture against him is
    // unwinnable for ever. Being punished permanently for your best week is
    // not a hard rule, it is a broken one. You cannot do better than everything,
    // so doing everything has to be enough.
    const won = s.score >= opp.score;
    st.arena.weeks[key] = {
      score: s.score, due: s.due, done: s.done,
      opponent: opp.id, oppName: opp.name, oppScore: opp.score,
      result: won ? 'won' : 'lost',
      arc: opp.knockout || (stage === 'group' ? 'group' : null),
    };
    if (opp.knockout) {
      const arc = arcOfMonth(monthOfWeek(key));
      const rec = (st.arena.arcs[arcKey(arc)] ||= { qualified: null, qf: null, sf: null, final: null, won: false });
      rec[opp.knockout] = won ? 'won' : 'lost';
      if (opp.knockout === 'final' && won) rec.won = true;
      events.push({ kind: 'arc', round: opp.knockout, won, arc, week: key, score: s.score, oppScore: opp.score, oppName: opp.name });
    }
    events.push({ kind: 'week', week: key, won, score: s.score, opp, rows: s.rows });
    key = nextWeek(key);
  }
}

/** Qualification for the arc containing `key`, settled before that week's
 *  fixture is drawn. Order matters and this is why: a knockout fixture asks
 *  whether you qualified, so closing three weeks in one go - which is what
 *  happens whenever the app has not been opened for a while - used to draw the
 *  quarter-final as an ordinary week, because the group had not been settled
 *  yet at the moment it was needed. */
function settleGroup(st, key, events) {
  const { arc, stage } = arcStage(key);
  if (!stage || stage === 'group') return;
  const k = arcKey(arc);
  const rec = (st.arena.arcs[k] ||= { qualified: null, qf: null, sf: null, final: null, won: false });
  if (rec.qualified !== null) return;
  const table = groupTable(arc);
  rec.qualified = table.qualifies;
  events.push({ kind: 'group', arc, qualified: rec.qualified, place: table.place, table: table.table });
}

/** Group qualification for the arc being played now, for the case where no
 *  week has closed since the group stage ended. */
function closeGroups(st, events) {
  const arc = arcOfMonth(currentMonth());
  for (const a of [previousArc(arc), arc]) {
    const k = arcKey(a);
    const weeks = arcWeeks(a);
    const groupWeeks = weeks.slice(0, Math.max(0, weeks.length - 3));
    if (!groupWeeks.length || !weekClosed(groupWeeks[groupWeeks.length - 1])) continue;
    const rec = (st.arena.arcs[k] ||= { qualified: null, qf: null, sf: null, final: null, won: false });
    if (rec.qualified !== null) continue;
    const table = groupTable(a);
    rec.qualified = table.qualifies;
    events.push({ kind: 'group', arc: a, qualified: rec.qualified, place: table.place, table: table.table });
  }
}

/** A month ends: you go up, you stay, or you go down. */
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
      // A placement season sets your division outright and cannot relegate
      // you, because there is nothing yet to relegate you from.
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

/** Bring the record up to date. Safe to call on every launch and every render:
 *  it writes only when something has actually finished. */
export function sync() {
  const events = [];
  store.update((st) => {
    if (!st.arena.backfilled) backfill(st);
    closeWeeks(st, events);
    closeGroups(st, events);
    closeMonths(st, events);
  });
  return events;
}

/** Results the app has not shown yet, so a week can be won on a screen rather
 *  than by a number quietly changing while you were not looking. */
export function unseenResults() {
  const a = store.get().arena;
  const closed = Object.entries(a.weeks)
    .filter(([k, w]) => (w.result === 'won' || w.result === 'lost') && k > a.seenWeek && k < currentWeek())
    .sort((x, y) => (x[0] < y[0] ? -1 : 1));
  if (!closed.length) return null;
  const [key, week] = closed[closed.length - 1];

  // A month is announced with the last week *of that month*, and a week is
  // only ever announced once, so "has this month been shown" is already
  // answered by seenWeek and needs no marker of its own. Without this the
  // promotion earned in August went unannounced whenever the app was next
  // opened a fortnight into September.
  const month = Object.entries(a.months)
    .map(([m, v]) => ({ month: m, ...v, last: weeksOfMonth(m).slice(-1)[0] || '' }))
    .filter((m) => m.last > a.seenWeek && m.last <= key)
    .sort((x, y) => (x.month < y.month ? -1 : 1))
    .pop() || null;

  // Same for a knockout round: it belongs to the week it was played in, which
  // is not always the newest unseen one.
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
