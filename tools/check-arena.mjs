// The Arena's maths, checked. `npm run check:arena`.
//
// Not a test runner. It covers the one corner whose answers cannot be read off
// a screen: ISO weeks, which month a week is in, which arc, and what came
// before it. Every check here has been wrong once.
//
// Runs in bare node with a few browser globals stubbed, because the domain has
// no DOM in it. If that stops being true, this file failing to start is the
// warning.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, addEventListener() {} }),
  body: { appendChild() {} },
  addEventListener() {},
  querySelector: () => null,
};
globalThis.window = { matchMedia: () => ({ matches: false }) };
// node owns navigator and will not let it be replaced.

const st = await import('../www/js/store.js');
const a = await import('../www/js/arena/program.js');

let passed = 0;
const failed = [];
const is = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed.push(name);
    console.log(`  FAIL ${name}\n         got  ${g}\n         want ${w}`);
  }
};
const group = (t) => console.log(`\n${t}`);

/* ---------------- ISO weeks ---------------- */
group('weeks');
is('1 Jan 2026 falls in week 1', a.weekKey('2026-01-01'), '2026-W01');
is('which began the previous December', a.weekStart('2026-W01'), '2025-12-29');
is('29 Dec 2025 is that same week', a.weekKey('2025-12-29'), '2026-W01');
is('1 Jan 2027 still belongs to 2026', a.weekKey('2027-01-01'), '2026-W53');
is('a key round-trips through both of its ends',
  [a.weekKey(a.weekStart('2026-W35')), a.weekKey(a.weekEnd('2026-W35'))], ['2026-W35', '2026-W35']);
is('seven days, Monday to Sunday',
  [a.weekDays('2026-W35').length, new Date(a.weekStart('2026-W35') + 'T12:00').getDay(), new Date(a.weekEnd('2026-W35') + 'T12:00').getDay()],
  [7, 1, 0]);
is('the clocks going forward does not drop a week',
  ['2026-03-23', '2026-03-30', '2026-04-06'].map(a.weekKey), ['2026-W13', '2026-W14', '2026-W15']);
is('a week belongs to the month holding its Thursday',
  [a.monthOfWeek(a.weekKey('2026-08-31')), a.monthOfWeek(a.weekKey('2026-09-01'))], ['2026-09', '2026-09']);

group('a year of weeks, partitioned');
{
  const seen = new Map();
  for (let m = 1; m <= 12; m++) {
    for (const w of a.weeksOfMonth(`2026-${String(m).padStart(2, '0')}`)) seen.set(w, (seen.get(w) || 0) + 1);
  }
  let missed = 0;
  for (let d = new Date(2026, 0, 5); d < new Date(2026, 11, 28); d = new Date(d.getTime() + 7 * 864e5)) {
    if (!seen.has(a.weekKey(st.dayKey(d)))) missed++;
  }
  is('no week is claimed by two months', [...seen.values()].every((n) => n === 1), true);
  is('no week of the year is missed', missed, 0);
  is('a year holds 52 or 53 of them', seen.size >= 52 && seen.size <= 53, true);
}

/* ---------------- the ladder ---------------- */
group('divisions');
is('the bars climb', a.DIVISIONS.every((d, i) => i === 0 || d.bar > a.DIVISIONS[i - 1].bar), true);
// Probed off DIVISIONS rather than a written-out list, so reordering the ladder
// cannot leave this check asserting the old one.
is('a score earns the division whose bar it clears',
  a.DIVISIONS.map((d) => a.divisionForScore(d.bar).id),
  a.DIVISIONS.map((d) => d.id));
is('and a hair under it earns the one below',
  a.DIVISIONS.map((d) => a.divisionForScore(d.bar - 0.01).id),
  a.DIVISIONS.map((d, i) => (i === 0 ? a.DIVISIONS[0].id : a.DIVISIONS[i - 1].id)));
is('nothing scored is still the bottom', a.divisionForScore(0).id, a.DIVISIONS[0].id);

/* ---------------- arcs ---------------- */
group('arcs');
is('months sit in their meteorological season',
  ['2026-01', '2026-03', '2026-05', '2026-06', '2026-08', '2026-09', '2026-11', '2026-12'].map((m) => a.arcKey(a.arcOfMonth(m))),
  ['2025-winter', '2026-spring', '2026-spring', '2026-summer', '2026-summer', '2026-autumn', '2026-autumn', '2026-winter']);
is('winter runs into the next year under its own December', a.arcOfMonth('2027-01').year, 2026);
is('each cup knows the one immediately before it',
  ['winter', 'spring', 'autumn'].map((id) => a.arcKey(a.previousArc({ ...a.ARCS.find((x) => x.id === id), year: 2026 }))),
  ['2026-autumn', '2025-winter', '2026-spring']);
is('and summer is stepped over, never counted down to',
  ['winter', 'spring', 'autumn'].map((id) => a.arcKey(a.nextArc({ ...a.ARCS.find((x) => x.id === id), year: 2026 }))),
  ['2027-spring', '2026-autumn', '2026-winter']);
is('summer holds no cup', a.CUPS.map((c) => c.id), ['winter', 'spring', 'autumn']);
is('and every week of it is off-season',
  a.arcWeeks({ ...a.ARCS.find((x) => x.id === 'summer'), year: 2026 }).every((w) => a.arcStage(w).stage === 'break'), true);
is('an arc is twelve to fourteen weeks',
  a.ARCS.every((x) => { const n = a.arcWeeks({ ...x, year: 2026 }).length; return n >= 12 && n <= 14; }), true);
is('the last two weeks of a cup quarter are the off-season',
  a.arcWeeks(a.arcOfMonth('2026-10')).slice(-2).map((w) => a.arcStage(w).stage), ['break', 'break']);
is('and the three before those are the knockout, in order',
  a.arcSeason(a.arcOfMonth('2026-10')).slice(-4).map((w) => a.arcStage(w).stage), ['group', 'qf', 'sf', 'final']);
is('the group stage is the season less its knockout',
  a.CUPS.every((x) => {
    const arc = { ...x, year: 2026 };
    return a.arcGroupWeeks(arc).length === a.arcSeason(arc).length - 3 && a.arcGroupWeeks(arc).length >= 5;
  }), true);
is('and next undoes previous, for every cup',
  a.CUPS.every((x) => {
    const arc = { ...x, year: 2026 };
    return a.arcKey(a.previousArc(a.nextArc(arc))) === a.arcKey(arc);
  }), true);

group('years, which are 365 days and not calendar years');
is('a year is 365 days long',
  (() => { const y = a.yearAt(0); let n = 1, k = y.from; while (k < y.to) { k = st.addDays(k, 1); n++; } return n; })(), 365);
is('and reads like a season', a.yearLabel('2026-08-28', '2027-08-27'), '26/27');
is('one starting on New Years Day does not read as 26/26', a.yearLabel('2026-01-01', '2026-12-31'), '26');
is('years do not overlap and leave no gap',
  [a.yearAt(0).to, a.yearAt(1).from], [a.yearAt(0).to, st.addDays(a.yearAt(0).to, 1)]);
is('the one running is not open', a.yearAt(a.currentYearIndex()).open, false);

/* ---------------- the roster ---------------- */
group('the roster, and the days a row owes');
const at = (k) => new Date(k + 'T12:00').getTime();
const habit = (id, name, extra) => ({
  id, name, question: '', notes: '', colour: 'teal', kind: 'yesno', unit: '', target: 0,
  targetType: 'atleast', freq: { num: 1, den: 1 }, group: '', remindAt: '', remindDays: [],
  archived: false, archivedAt: 0, createdAt: at('2026-01-01'), order: 0, ...extra,
});
st.update((s) => {
  s.habits.entries = {};
  s.habits.items = [
    habit('h_before', 'Before', { createdAt: at('2026-05-01') }),
    habit('h_midweek', 'Mid-week', { createdAt: at('2026-05-13') }),
    habit('h_leftbefore', 'Left before', { archived: true, archivedAt: at('2026-05-01') }),
    habit('h_leftduring', 'Left during', { archived: true, archivedAt: at('2026-05-14') }),
  ];
});
is('the week begins on the Monday', a.weekStart('2026-W20'), '2026-05-11');
// A row is on the week if it existed at any point during it, and owes only the
// days it was there for. Cutting mid-week arrivals outright left a new install
// with an empty roster and no scoreable first week.
is('a row that arrived or left mid-week is on it, one that left before is not',
  a.rosterFor('2026-W20').map((h) => h.name), ['Before', 'Mid-week', 'Left during']);
is('a row created after the final whistle is not on it',
  a.rosterFor('2026-W19').map((h) => h.name), ['Before', 'Left during']);

{
  // Wednesday arrival: Mon and Tue were never its days, so it owes five, not seven.
  st.update((s) => {
    s.habits.items = [habit('h_mid', 'Mid-week', { createdAt: at('2026-05-13') })];
    s.habits.entries = {};
  });
  is('a row owes only the days it existed for', a.scoreWeek('2026-W20').due, 5);
  // The same rule in reverse: archiving cannot erase the days already missed.
  st.update((s) => {
    s.habits.items = [habit('h_gone', 'Left during', { archived: true, archivedAt: at('2026-05-14') })];
  });
  is('archiving mid-week does not erase the days already owed', a.scoreWeek('2026-W20').due, 4);
}

{
  // The first week of a brand new install has to be scoreable at all.
  st.update((s) => {
    s.habits.items = [habit('h_new', 'New', { createdAt: at('2026-05-11') })];
    s.habits.entries = { h_new: { '2026-05-11': 1, '2026-05-12': 1, '2026-05-13': 1,
      '2026-05-14': 1, '2026-05-15': 1, '2026-05-16': 1, '2026-05-17': 1 } };
  });
  const w = a.scoreWeek('2026-W20');
  is('a habit created on the Monday is scored that same week', [w.done, w.due], [7, 7]);
  is('and a perfect first week is not void', w.void, false);
}

/* ---------------- scoring ---------------- */
group('scoring');
st.update((s) => {
  s.habits.items = [habit('h_one', 'One')];
  const d = a.weekDays('2026-W20');
  s.habits.entries = { h_one: { [d[0]]: 1, [d[1]]: 0, [d[2]]: -1, [d[3]]: 1 } };
});
{
  const w = a.scoreWeek('2026-W20');
  is('a skip leaves both halves of the fraction alone', [w.done, w.due], [2, 6]);
  is('six cells across six days is a fixture', w.void, false);
}
st.update((s) => {
  s.habits.entries = { h_one: Object.fromEntries(a.weekDays('2026-W21').map((k) => [k, -1])) };
});
is('a week you skipped your way through is not', [a.scoreWeek('2026-W21').due, a.scoreWeek('2026-W21').void], [0, true]);
st.update((s) => {
  s.habits.entries = { h_one: Object.fromEntries(a.weekDays('2026-W22').slice(2).map((k) => [k, -1])) };
});
{
  const w = a.scoreWeek('2026-W22');
  is('nor is two days of one habit', [w.due, w.days, w.void], [2, 2, true]);
}
st.update((s) => { s.habits.entries = {}; });
is('a week you did nothing in is still a fixture, and lost',
  [a.scoreWeek('2026-W20').void, a.scoreWeek('2026-W20').score], [false, 0]);

/* -------------------- frequencies -------------------- */

group('a habit that does not ask for every day');
const week = (num, den, pattern) => {
  st.update((s) => {
    s.habits.items = [habit('h_f', 'Five', { freq: { num, den } })];
    const d = a.weekDays('2026-W20');
    s.habits.entries = { h_f: Object.fromEntries(d.filter((_, i) => pattern[i] === 'X').map((k) => [k, 1])) };
  });
  const w = a.scoreWeek('2026-W20');
  return [w.done, w.due];
};
is('five in seven, done Monday to Friday', week(5, 7, 'XXXXX__'), [5, 5]);
is('five in seven, done Wednesday to Sunday', week(5, 7, '__XXXXX'), [5, 5]);
is('five in seven, done on any five days at all', week(5, 7, 'X_XX_XX'), [5, 5]);
is('doing more than it asks is not extra credit', week(5, 7, 'XXXXXXX'), [5, 5]);
is('doing four of the five costs you one', week(5, 7, 'XXXX___'), [4, 5]);
is('three in seven, done at the weekend', week(3, 7, '____XXX'), [3, 3]);
is('every third day owes two in a week', week(1, 3, 'X__X__X'), [2, 2]);
is('ten in thirty owes two in a week', week(10, 30, 'X_X____'), [2, 2]);
is('a daily habit still owes every day', week(1, 1, 'XXXXX__'), [5, 7]);

/* ------------------ the week in review ------------------ */

group('the review');
{
  const habits = await import('../www/js/habits/program.js');
  const back = (n) => st.addDays(st.dayKey(), -n);
  const run = (from, len) => Object.fromEntries(Array.from({ length: len }, (_, i) => [back(from - i), 1]));

  st.update((s) => {
    s.habits.items = [habit('h_a', 'A'), habit('h_b', 'B')];
    const d = a.weekDays('2026-W20');
    s.habits.entries = {
      h_a: { [d[0]]: 1, [d[1]]: 1, [d[2]]: 0, [d[3]]: 1, [d[4]]: 1, [d[5]]: 1, [d[6]]: 1 },
      h_b: { [d[0]]: 1, [d[1]]: -1 },
    };
  });
  const shape = a.weekShape('2026-W20');
  is('a shape is seven days', shape.length, 7);
  is('counting what was done, not what was owed', shape.map((x) => x.done), [2, 1, 0, 1, 1, 1, 1]);
  is('a skip is held apart from a miss', shape.map((x) => x.skipped), [0, 1, 0, 0, 0, 0, 0]);
  is('and a week gone by holds no future', shape.filter((x) => x.future).length, 0);

  const cur = a.currentWeek();
  is('the review is this week on its last day, the one gone after that',
    a.reviewWeek(), st.dayKey() === a.weekEnd(cur) ? cur : a.prevWeek(cur));
  a.markReviewed(a.reviewWeek());
  is('marking it means it is not offered again', a.reviewDue(), false);
  a.markReviewed('2020-W01');
  is('and the mark never moves backwards', st.get().arena.reviewed, a.reviewWeek());

  // A run of eight that ended a fortnight ago, and one still going.
  st.update((s) => {
    s.habits.items = [habit('h_old', 'Old'), habit('h_live', 'Live')];
    s.habits.entries = { h_old: run(20, 8), h_live: run(6, 7) };
  });
  is('a streak that ended inside the window is what broke',
    habits.brokenIn(back(16), back(10)).map((b) => [b.habit.name, b.len]), [['Old', 8]]);
  is('a live streak has not broken', habits.brokenIn(back(6), back(0)).length, 0);
}

/* ---------------- the habit score ----------------
   A weighted mean over the days a habit has lived. The old rule seeded the run
   with day one at full weight, so a young habit read as whatever day one was. */

group('the score, on a habit younger than its own half-life');
{
  const habits = await import('../www/js/habits/program.js');
  const back = (n) => st.addDays(st.dayKey(), -n);
  /** `days` old, marked on the days `mark(i)` picks, oldest first. */
  const score = (days, mark, freq) => {
    st.reset();
    const entries = {};
    for (let i = 0; i < days; i++) if (mark(i)) entries[back(days - 1 - i)] = 1;
    st.update((s) => {
      s.habits.items = [habit('h_s', 'S', { createdAt: at(back(days - 1)), ...(freq ? { freq } : {}) })];
      s.habits.entries = { h_s: entries };
    });
    return Math.round(habits.summary(st.get().habits.items[0]).score * 100);
  };

  is('added today and done is a hundred', score(1, () => true), 100);
  is('added today and not done is nothing', score(1, () => false), 0);
  is('a week old and kept every day is a hundred', score(7, () => true), 100);
  is('a week old and kept nothing is nothing', score(7, () => false), 0);
  // The bug this rule was written for: four perfect days after one missed one.
  is('four kept days after a missed first day read as four fifths', score(5, (i) => i > 0), 82);
  is('and one missed day in five costs about a fifth', score(5, (i) => i !== 2), 80);
  // A habit asking less of you has a longer memory, so the same miss fades slower.
  is('four in seven, kept every day since a missed first', score(7, (i) => i > 0, { num: 4, den: 7 }), 87);
  is('and the daily version of that week is lower still', score(7, (i) => i > 0), 88);
  // Past the half-life the weighting is the old exponential average again.
  is('sixty kept days then thirty missed', score(90, (i) => i < 60), 20);
  is('and the same run the other way round', score(90, (i) => i >= 60), 80);
  is('the score never leaves 0 to 1',
    [score(30, (i) => i % 3 === 0), score(200, (i) => i % 7 < 3)].every((v) => v >= 0 && v <= 100), true);
}

/* ----- the public feats with real logic -----
   Streak counts and run lengths are the same shape of arithmetic as the week
   maths above, and just as unreadable off a screen. Seeded relative to today,
   so these do not rot next year. */

group('the feats that count runs');
{
  const feats = await import('../www/js/arena/feats.js');
  const byId = (id) => feats.FEATS.find((f) => f.id === id);
  const back = (n) => st.addDays(st.dayKey(), -n);
  const run = (from, len) => Object.fromEntries(Array.from({ length: len }, (_, i) => [back(from - i), 1]));

  const withEntries = (entries, items) => st.update((s) => {
    s.habits.items = items || [habit('h_r', 'Run')];
    s.habits.entries = entries;
  });

  // Two runs of 35, ten days apart. One long run is not a comeback.
  withEntries({ h_r: { ...run(120, 35), ...run(70, 35) } });
  is('two long streaks is a comeback', byId('comeback').test(), true);
  withEntries({ h_r: run(100, 100) });
  is('one long streak is not', byId('comeback').test(), false);

  // Away, then back for a week.
  withEntries({ h_r: { ...run(60, 5), ...run(20, 8) } });
  is('a fortnight away then a week back', byId('returned').test(), true);
  withEntries({ h_r: { ...run(30, 5), ...run(20, 8) } });
  is('ten days away is not away', byId('returned').test(), false);

  withEntries({ h_r: run(40, 41) });
  is('the streak feat reads the longest run', byId('streak30').now(), 41);
  is('and the same run feeds the year one', byId('habitYear').now(), 41);
  is('ticks are counted across every habit', byId('marks100').now(), 41);

  // Fixtures: only won and lost are played. 'record' and 'void' are not.
  const wk = (result, opponent) => ({ score: 0.5, due: 10, done: 5, opponent, oppName: '', oppScore: 0.4, result, arc: null });
  st.update((s) => {
    s.arena.weeks = {
      '2026-W01': wk('won', 'worst'), '2026-W02': wk('won', 'nemesis'), '2026-W03': wk('won', 'lastMonth'),
      '2026-W04': wk('lost', 'nemesis'), '2026-W05': wk('won', 'standard'), '2026-W06': wk('record', ''),
      '2026-W07': wk('void', ''),
    };
    s.arena.months = {
      '2026-01': { score: 0.5, w: 2, l: 1, from: 'npc', to: 'prospect', move: 'up' },
      '2026-02': { score: 0.6, w: 3, l: 0, from: 'prospect', to: 'contender', move: 'up' },
      '2026-03': { score: 0.4, w: 1, l: 2, from: 'contender', to: 'prospect', move: 'down' },
      '2026-04': { score: 0.5, w: 2, l: 1, from: 'prospect', to: 'prospect', move: 'held' },
    };
  });
  is('a record week is not a fixture', byId('firstFixture').now(), 5);
  is('wins are counted', byId('wins10').now(), 4);
  is('the win run stops at a loss', byId('winStreak5').now(), 3);
  is('beating one rival by name', byId('beatWorst').test(), true);
  is('and the Nemesis too', byId('beatNemesis').test(), true);
  is('two promotions running', byId('promoted2').now(), 2);
  is('a drop breaks the no-drop run', byId('noDrop6').now(), 2);
}

/* ----- every feat actually runs -----
   progressOf() wraps each test in a try/catch, so a predicate that throws reads
   as zero for ever and nothing says so. This is what says so. */

group('every feat runs without throwing');
{
  const feats = await import('../www/js/arena/feats.js');
  const broken = [];
  const wrong = [];
  for (const f of feats.FEATS) {
    try {
      if (f.test) {
        if (typeof f.test() !== 'boolean') wrong.push(f.id);
      } else {
        const v = f.now();
        if (!Number.isFinite(v)) wrong.push(f.id);
        if (!Number.isFinite(f.at)) wrong.push(`${f.id}:at`);
      }
    } catch (e) {
      broken.push(`${f.id} (${e.message})`);
    }
  }
  is('none throws on an empty record', broken, []);
  is('each returns the shape it promises', wrong, []);
  is('no id is claimed twice', feats.FEATS.length, new Set(feats.FEATS.map((f) => f.id)).size);
}

/* ----- the sanitiser, against the real catalogue ----- */

group('every feat survives being saved and read back');
{
  const feats = await import('../www/js/arena/feats.js');
  const ids = feats.FEATS.map((f) => f.id);
  st.update((x) => {
    x.arena.feats = Object.fromEntries(ids.map((id) => [id, 1700000000000]));
  });
  const backup = st.exportJson();
  st.reset();
  st.importJson(backup);
  const kept = Object.keys(st.get().arena.feats);
  is('every one comes back', kept.length, ids.length);
  is('and none was renamed', ids.filter((id) => !kept.includes(id)), []);
}

/* ---------------- the write path ---------------- */
// The only code in the app that can change your division, and until these it
// had no assertions at all.
group('what sync writes');

/** A clean store with `weeks` of daily marking ending last Sunday. */
function seedWeeks(weeks, hit) {
  st.reset();
  const end = a.weekEnd(a.prevWeek(a.currentWeek()));
  const start = st.addDays(end, -(weeks * 7 - 1));
  const entries = {};
  for (let k = start, i = 0; k <= end; k = st.addDays(k, 1), i++) entries[k] = hit(i) ? 1 : 0;
  st.update((s) => {
    s.habits.items = [habit('h_x', 'X', { createdAt: new Date(start + 'T12:00').getTime() })];
    s.habits.entries = { h_x: entries };
  });
  return { start, end };
}

{
  // One cell, months ago, used to conjure a full record of empty weeks between
  // then and now, and relegate you for every one of them.
  st.reset();
  const long_ago = st.addDays(a.weekStart(a.currentWeek()), -70);
  st.update((s) => {
    s.habits.items = [habit('h_one', 'One', { createdAt: new Date(long_ago + 'T12:00').getTime() })];
    s.habits.entries = { h_one: { [long_ago]: 1 } };
  });
  a.sync();
  const weeks = Object.keys(st.get().arena.weeks);
  is('one marked cell writes one week, not ten', weeks.length, 1);
  is('and it is the week that cell is in', weeks[0], a.weekKey(long_ago));
}

{
  // A cup you were never in is not a cup you went out of.
  st.reset();
  a.sync();
  const arcs = st.get().arena.arcs;
  is('an empty install settles no arc', Object.keys(arcs).length, 0);
  is('and records no result at all', Object.values(arcs).filter((x) => x.qualified === false).length, 0);
}

{
  // Five perfect weeks: the months they cover have to settle, and settling has
  // to move the ladder and mark you placed.
  seedWeeks(5, () => true);
  a.sync();
  const arena = st.get().arena;
  const months = Object.keys(arena.months);
  is('a full month of played weeks settles', months.length > 0, true);
  is('a settled month marks you placed', arena.placed, true);
  is('and a perfect month is never a relegation',
    Object.values(arena.months).every((m) => m.move !== 'down'), true);
}

{
  // The same run, missed every other day: the ladder has to be able to fall.
  seedWeeks(9, (i) => i % 2 === 0);
  a.sync();
  const arena = st.get().arena;
  const moves = Object.values(arena.months).map((m) => m.move);
  is('a half-kept run still settles its months', moves.length > 0, true);
  // Every rung is ten points apart, so one month can only ever move you one.
  is('and a month moves you one rung at most',
    Object.values(arena.months).every((m) => Math.abs(a.divisionIndex(m.to) - a.divisionIndex(m.from)) <= 1), true);
  is('a run at half owes a division no higher than half',
    a.divisionOf(arena.division).bar <= 0.5, true);
}

/* ---------------- timed ----------------
   A timed habit is a quantity habit underneath, so the Arena's scoring has no
   branch for it. These prove it by scoring one through the number path. */
group('a timed habit scores as a number');
{
  const habits = await import('../www/js/habits/program.js');
  const d = a.weekDays('2026-W20');
  st.reset();
  st.update((s) => {
    s.habits.items = [
      habit('h_t', 'Read', { kind: 'timed', unit: 'min', target: 20 }),
    ];
    s.habits.entries = {
      h_t: { [d[0]]: 25, [d[1]]: 10, [d[2]]: 20 },
    };
  });
  const w = a.scoreWeek('2026-W20');
  is('minutes at or past the target are a cell, under it are not', w.rows.find((r) => r.id === 'h_t').done, 2);
  is('it owes every day like any daily row', w.rows.map((r) => r.due), [7]);
  const t = habits.summary(st.get().habits.items[0]);
  is('ten of twenty minutes is half a day, for the score', t.index.get(d[1]).unit, 0.5);
  is('a timed habit round-trips through hydrate', (() => { const b = st.exportJson(); st.reset(); st.importJson(b); const h = st.get().habits.items.find((x) => x.id === 'h_t'); return [h.kind, h.unit, h.target]; })(), ['timed', 'min', 20]);
  st.reset();
  st.update((s) => { s.habits.items = [habit('h_c', 'Morning', { kind: 'checklist', unit: 'items', target: 3 })]; });
  const back = (() => { const b = st.exportJson(); st.reset(); st.importJson(b); return st.get().habits.items[0]; })();
  is('a saved checklist comes back as a number habit', [back.kind, back.target], ['number', 3]);
}

/* ---------------- On Notice ----------------
   One month below the bar is a notice, two in a row is a drop, and a month at
   the bar or a promotion clears it. Seeded as stored weeks, so the scores are
   exact and the write path is the only thing under test. */
group('a month below the bar');

/** Two settled months before this one, at the given scores, from a division. */
function seedMonths(division, scores) {
  st.reset();
  const cur = a.currentMonth();
  const months = [];
  let m = cur;
  for (let i = 0; i < scores.length; i++) {
    const [y, mm] = m.split('-').map(Number);
    m = mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
    months.unshift(m);
  }
  const weeks = {};
  months.forEach((month, i) => {
    for (const k of a.weeksOfMonth(month)) {
      weeks[k] = { score: scores[i], due: 10, done: Math.round(scores[i] * 10), opponent: 'standard', oppName: 'The Standard', oppScore: 0.5, result: scores[i] >= 0.5 ? 'won' : 'lost', arc: null };
    }
  });
  const first = a.weekStart(a.weeksOfMonth(months[0])[0]);
  st.update((s) => {
    s.habits.items = [habit('h_n', 'N', { createdAt: at(first) })];
    s.habits.entries = { h_n: { [first]: 1 } };
    s.arena.division = division;
    s.arena.placed = true;
    s.arena.backfilled = true;
    s.arena.scoring = 1;
    s.arena.weeks = weeks;
  });
  a.sync();
  return months.map((k) => st.get().arena.months[k]);
}

{
  const [m1, m2] = seedMonths('contender', [0.4, 0.55]);
  is('below the bar is a notice, not a drop', [m1.move, m1.to], ['notice', 'contender']);
  is('then at the bar clears it', [m2.move, m2.cleared, st.get().arena.notice], ['held', true, false]);
}
{
  const [m1, m2] = seedMonths('contender', [0.4, 0.45]);
  is('below then below relegates', [m1.move, m2.move, m2.to], ['notice', 'down', 'prospect']);
  is('and the lower division starts clean', st.get().arena.notice, false);
}
{
  const [m1, m2] = seedMonths('contender', [0.4, 0.65]);
  is('a promotion out of a notice clears it', [m1.move, m2.move, m2.to, m2.cleared], ['notice', 'up', 'menace', true]);
  is('and the Comeback feat reads it', (await import('../www/js/arena/feats.js')).FEATS.find((f) => f.id === 'noticeComeback').test(), true);
}
{
  const [m1] = seedMonths('bottom', [0.1]);
  is('nothing below the floor, so the floor is never on notice', [m1.move, st.get().arena.notice], ['held', false]);
}

/* ---------------- the Nemesis ----------------
   He is the best week on the record, so nothing about him is stored: the app
   reads him back off the weeks the ledger already wrote. These are the numbers
   it puts on screen. */
group('the head to head');

/** A week in the shape the ledger writes one. */
const nwk = (score, opponent, result, oppScore = 0.5) => ({
  score, due: 10, done: Math.round(score * 10),
  opponent, oppName: '', oppScore, result, arc: null, note: '',
});

/** Five weeks: three meetings with him, two of them yours, and three bests. */
function seedRivalry() {
  st.reset();
  st.update((s) => {
    s.arena.weeks = {
      '2026-W01': nwk(0.4, 'lastMonth', 'won'),
      '2026-W02': nwk(0.3, 'nemesis', 'lost', 0.4),
      '2026-W03': nwk(0.55, 'nemesis', 'won', 0.4),
      '2026-W04': nwk(0.5, 'worst', 'won'),
      '2026-W05': nwk(0.7, 'nemesis', 'won', 0.55),
    };
  });
}

{
  seedRivalry();
  const h = a.headToHead();
  is('only the weeks he played count as meetings', h.met, 3);
  is('won and lost are counted from your side', [h.w, h.l], [2, 1]);
  is('the run is signed, and two of yours reads two', h.run, 2);
  is('the longest run of yours is remembered', h.best, 2);
  is('the last meeting is the last one played', h.last, '2026-W05');
  is('and it carries what it was decided by', h.by, 15);
}

{
  seedRivalry();
  st.update((s) => {
    s.arena.weeks['2026-W06'] = nwk(0.45, 'nemesis', 'lost', 0.7);
    s.arena.weeks['2026-W07'] = nwk(0.5, 'nemesis', 'lost', 0.7);
  });
  const h = a.headToHead();
  is('two of his reads minus two', h.run, -2);
  is('and losing does not touch the best run you had', h.best, 2);
  is('the last one you took is still on the record', h.lastWon, '2026-W05');
}

group('the succession');
{
  seedRivalry();
  const r = a.reigns();
  is('a reign starts only on a week better than every week before it',
    r.map((x) => x.key), ['2026-W01', '2026-W03', '2026-W05']);
  is('each is held until a better week takes it', r.slice(0, 2).map((x) => x.held), [2, 2]);
  is('the last of them is the one you have now', r[r.length - 1].current, true);
  is('and the first best week replaced nobody', a.deposed(), 2);
  is('a record with nothing in it has no line at all', (() => { st.reset(); return [a.reigns().length, a.deposed()]; })(), [0, 0]);
}

group('the month ends with him');
{
  const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  const lastOf = (m) => a.weeksOfMonth(m).slice(-1)[0];
  is('every month of a year ends with him',
    months.every((m) => a.opponentIdFor(lastOf(m)) === 'nemesis'), true);
  is('and draws him exactly once',
    [...new Set(months.map((m) => a.weeksOfMonth(m).filter((w) => a.opponentIdFor(w) === 'nemesis').length))], [1]);
  is('the undercard counts back from him, so a month builds the same way whatever its shape',
    [...new Set(months.map((m) => a.weeksOfMonth(m).slice(-4).map(a.opponentIdFor).join(',')))],
    ['lastMonth,standard,worst,nemesis']);
}

{
  // He falls back to The Standard until the record can supply a real week, so a
  // meeting is only ever announced when there is someone to meet.
  st.reset();
  is('no record, no meeting', a.nextMeeting(), null);

  st.update((s) => { s.arena.weeks = { '2026-W01': nwk(0.62, 'standard', 'won') }; });
  const weeks = a.weeksOfMonth('2026-03');
  const his = weeks.slice(-1)[0];
  is('his week draws his score', [a.fixtureFor(his).id, a.fixtureFor(his).score], ['nemesis', 0.62]);
  const m = a.nextMeeting(weeks[0]);
  is('and the meeting is counted in weeks off', [m.key, m.away], [his, weeks.length - 1]);
  is('the week itself is nought weeks off', a.nextMeeting(his).away, 0);
}

/* ----- the daily line -----
   Every line is him talking and every number in one comes off the record, so
   the failure to guard against is a template reading a week that is not there. */
group('every line he says');
{
  const line = await import('../www/js/arena/line.js');
  const bad = [];
  const seen = new Set();
  for (const seed of [() => st.reset(), seedRivalry]) {
    seed();
    for (const l of line.openLines()) {
      seen.add(l.id);
      if (!l.say || /undefined|NaN|null/.test(l.say)) bad.push(`${l.id}: ${l.say}`);
    }
  }
  is('none says undefined, NaN or nothing', bad, []);
  is('and the rivalry above opens the ones it should', [...seen].sort(), ['deposed', 'reign', 'run', 'sinceWin']);
}

/* ---------------- a clock that moved ----------------
   Moving the device clock forward closes the week you are in the middle of.
   Moving it back used to leave that defeat on the record for ever, because
   rescore only touches weeks nobody played. */
group('a week that has not ended');
{
  st.reset();
  const now = a.currentWeek();
  st.update((s) => {
    s.arena.backfilled = true;
    s.arena.scoring = 1;
    s.arena.division = 'menace';
    s.arena.placed = true;
    s.arena.weeks = { [now]: nwk(0.3, 'nemesis', 'lost', 0.8), [a.nextWeek(now)]: nwk(0.2, 'standard', 'lost') };
    s.arena.months = { '2026-01': { score: 0.6, w: 3, l: 1, from: 'contender', to: 'menace', move: 'up' } };
  });
  a.sync();
  const after = st.get().arena;
  is('cannot hold a verdict, however the clock got there', Object.keys(after.weeks), []);
  is('and the ladder is left where the settled months put it',
    [after.division, Object.keys(after.months)], ['menace', ['2026-01']]);
}
{
  // A backfilled week is a performance, not a result. Deleting one turned four
  // of them into four played wins the moment a clock went back a month.
  st.reset();
  const now = a.currentWeek();
  st.update((s) => {
    s.arena.backfilled = true;
    s.arena.scoring = 1;
    s.arena.weeks = { [now]: { ...nwk(0.5, '', 'record'), oppScore: null } };
  });
  a.sync();
  is('but a backfilled performance is not a verdict, so it stays',
    st.get().arena.weeks[now] ? st.get().arena.weeks[now].result : null, 'record');
}

console.log(failed.length ? `\n${failed.length} FAILED: ${failed.join('; ')}` : `\nall ${passed} checks passed`);
process.exit(failed.length ? 1 : 0);
