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
is('a score earns the division whose bar it clears',
  [0, 0.24, 0.25, 0.59, 0.6, 0.91, 0.92, 1].map((s) => a.divisionForScore(s).id),
  ['bottom', 'bottom', 'npc', 'prospect', 'contender', 'locked', 'topg', 'topg']);

/* ---------------- arcs ---------------- */
group('arcs');
is('months sit in their meteorological season',
  ['2026-01', '2026-03', '2026-05', '2026-06', '2026-08', '2026-09', '2026-11', '2026-12'].map((m) => a.arcKey(a.arcOfMonth(m))),
  ['2025-winter', '2026-spring', '2026-spring', '2026-summer', '2026-summer', '2026-autumn', '2026-autumn', '2026-winter']);
is('winter runs into the next year under its own December', a.arcOfMonth('2027-01').year, 2026);
is('each arc knows the one immediately before it',
  ['winter', 'spring', 'summer', 'autumn'].map((id) => a.arcKey(a.previousArc({ ...a.ARCS.find((x) => x.id === id), year: 2026 }))),
  ['2026-autumn', '2025-winter', '2026-spring', '2026-summer']);
is('an arc is twelve to fourteen weeks',
  a.ARCS.every((x) => { const n = a.arcWeeks({ ...x, year: 2026 }).length; return n >= 12 && n <= 14; }), true);
is('the last two weeks of a quarter are the off-season',
  a.arcWeeks(a.arcOfMonth('2026-07')).slice(-2).map((w) => a.arcStage(w).stage), ['break', 'break']);
is('and the three before those are the knockout, in order',
  a.arcSeason(a.arcOfMonth('2026-07')).slice(-4).map((w) => a.arcStage(w).stage), ['group', 'qf', 'sf', 'final']);
is('the group stage is the season less its knockout',
  a.ARCS.every((x) => {
    const arc = { ...x, year: 2026 };
    return a.arcGroupWeeks(arc).length === a.arcSeason(arc).length - 3 && a.arcGroupWeeks(arc).length >= 5;
  }), true);
is('every arc knows the one after it',
  ['winter', 'spring', 'summer', 'autumn'].map((id) => a.arcKey(a.nextArc({ ...a.ARCS.find((x) => x.id === id), year: 2026 }))),
  ['2027-spring', '2026-summer', '2026-autumn', '2026-winter']);
is('and next undoes previous',
  a.ARCS.every((x) => {
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

/* ---------------- the Monday roster lock ---------------- */
group('the roster, locked on Monday');
const at = (k) => new Date(k + 'T12:00').getTime();
const habit = (id, name, extra) => ({
  id, name, question: '', notes: '', colour: 'teal', kind: 'yesno', unit: '', target: 0,
  targetType: 'atleast', freq: { num: 1, den: 1 }, group: '', remindAt: '', remindDays: [],
  archived: false, archivedAt: 0, createdAt: at('2026-01-01'), order: 0, ...extra,
});
st.update((s) => {
  s.habits.settings.showLinked = false;
  s.habits.entries = {};
  s.habits.items = [
    habit('h_before', 'Before', { createdAt: at('2026-05-01') }),
    habit('h_midweek', 'Mid-week', { createdAt: at('2026-05-13') }),
    habit('h_leftbefore', 'Left before', { archived: true, archivedAt: at('2026-05-01') }),
    habit('h_leftduring', 'Left during', { archived: true, archivedAt: at('2026-05-14') }),
  ];
});
is('the week begins on the Monday', a.weekStart('2026-W20'), '2026-05-11');
is('a habit added mid-week is not on it, and one archived mid-week still is',
  a.rosterFor('2026-W20').map((h) => h.name), ['Before', 'Left during']);

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
    s.habits.settings.showLinked = false;
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

console.log(failed.length ? `\n${failed.length} FAILED: ${failed.join('; ')}` : `\nall ${passed} checks passed`);
process.exit(failed.length ? 1 : 0);
