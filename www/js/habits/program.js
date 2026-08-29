// Habits domain. The general-purpose room: name, question, colour, unit,
// target, frequency, group, reminder, order and any past day are all editable.
//
// Three things to know first:
//   Entries are the record. Streaks and scores compute on every read, because
//   the past is editable here.
//   A day is a key, and `dayStartHour` moves the boundary. This section only.
//   Frequency is a fraction, n in d. Daily is 1/1, three a week is 3/7.

import * as store from '../store.js';
import { kegelName, peName } from '../names.js';
import * as kegels from '../kegels/program.js';
import * as pe from '../pe/program.js';
import * as bible from '../bible/program.js';
import * as pray from '../pray/program.js';
import * as breathe from '../breathe/program.js';
import { fmtHours, WEEKDAYS } from '../ui.js';
import { cancelAlarms, scheduleMany, ALARM_HABIT_BASE, ALARM_HABIT_SLOTS } from '../native.js';
import { nifoUnlocked } from '../nifo.js';

/* -------------------- the palette -------------------- */

export const COLOURS = [
  { id: 'teal', hex: '#22d3c5', name: 'Teal' },
  { id: 'mint', hex: '#4ade80', name: 'Mint' },
  { id: 'lime', hex: '#a3e635', name: 'Lime' },
  { id: 'amber', hex: '#fbbf24', name: 'Amber' },
  { id: 'orange', hex: '#fb923c', name: 'Orange' },
  { id: 'clay', hex: '#d08a6a', name: 'Clay' },
  { id: 'rose', hex: '#f472b6', name: 'Rose' },
  { id: 'red', hex: '#f87171', name: 'Red' },
  { id: 'violet', hex: '#a78bfa', name: 'Violet' },
  { id: 'indigo', hex: '#8aa4e8', name: 'Indigo' },
  { id: 'sky', hex: '#38bdf8', name: 'Sky' },
  { id: 'slate', hex: '#94a3b8', name: 'Slate' },
];

export const hexOf = (id) => (COLOURS.find((c) => c.id === id) || COLOURS[0]).hex;

/** What a cell holds. `undefined` is the fourth state: no data at all, which
 *  is not a lapse. */
export const SKIP = -1;
export const NO = 0;
export const YES = 1;

export const MAX_HABITS = 100;
/** Longer than this is a corrupt createdAt, not a habit. */
const MAX_SPAN_DAYS = 3650;
/** How far back a linked row reads. */
const LINKED_SPAN_DAYS = 730;

/* ---------------- the day ---------------- */

export function settings() {
  return store.get().habits.settings;
}

/** Today on this section's boundary. dayStartHour 3 keeps 02:59 on yesterday. */
export function today() {
  const shift = settings().dayStartHour;
  const d = new Date();
  if (shift) d.setHours(d.getHours() - shift);
  return store.dayKey(d);
}

/** The last `n` day keys, oldest first, ending today. */
export function recentDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(store.addDays(today(), -i));
  return out;
}

/* ---------------- habits and groups ---------------- */

export function all() {
  return store.get().habits.items;
}

export function active() {
  return all().filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}

export function archived() {
  return all().filter((h) => h.archived).sort((a, b) => a.order - b.order);
}

export function byId(id) {
  return all().find((h) => h.id === id) || null;
}

export function groups() {
  return store.get().habits.groups.slice().sort((a, b) => a.order - b.order);
}

export function groupById(id) {
  return groups().find((g) => g.id === id) || null;
}

/** Active habits by group, ungrouped last. The grid renders straight from this. */
export function grouped() {
  const list = active();
  const out = groups().map((g) => ({ group: g, habits: list.filter((h) => h.group === g.id) }));
  const loose = list.filter((h) => !h.group || !groupById(h.group));
  if (loose.length || !out.length) out.push({ group: null, habits: loose });
  return out.filter((sec) => sec.habits.length || sec.group);
}

function blankHabit() {
  return {
    id: `h_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    question: '',
    notes: '',
    colour: 'teal',
    kind: 'yesno',
    unit: '',
    target: 0,
    targetType: 'atleast',
    freq: { num: 1, den: 1 },
    group: '',
    remindAt: '',
    remindDays: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    createdAt: Date.now(),
    order: 0,
  };
}

/** A new habit, unsaved. The form works on this so backing out leaves nothing. */
/* ---------------- the first five ---------------- */

/** What an empty grid offers, and what the introduction ends on. Five is the
 *  most anyone keeps at once in the first month. */
export const STARTERS = [
  { name: 'Gym', colour: 'orange', kind: 'yesno', freq: { num: 4, den: 7 }, question: 'Did you train?' },
  { name: 'Water', colour: 'sky', kind: 'number', unit: 'L', target: 3, question: 'How much water?' },
  { name: 'Read', colour: 'violet', kind: 'number', unit: 'pages', target: 20, question: 'How many pages?' },
  { name: 'Protein', colour: 'amber', kind: 'number', unit: 'g', target: 150, question: 'How much protein?' },
  { name: 'No sugar', colour: 'rose', kind: 'yesno', freq: { num: 6, den: 7 }, question: 'Stayed off sugar?' },
];

/** The line under a starter's name: what it will ask of you. */
export const starterMeta = (h) => (h.kind === 'number' ? `${h.target} ${h.unit} a day` : freqLabel(h.freq));

export function addStarter(i) {
  const pick = STARTERS[i];
  // Replaying the introduction must not leave two rows called Gym.
  if (!pick || active().some((h) => h.name === pick.name)) return null;
  return save({ ...draft(pick.kind), ...pick, order: active().length });
}

export function draft(kind = 'yesno') {
  return { ...blankHabit(), kind, target: kind === 'number' ? 1 : 0 };
}

export function save(habit) {
  return store.update((st) => {
    const i = st.habits.items.findIndex((h) => h.id === habit.id);
    if (i >= 0) {
      st.habits.items[i] = { ...st.habits.items[i], ...habit };
      return;
    }
    if (st.habits.items.length >= MAX_HABITS) return;
    const max = st.habits.items.reduce((a, h) => Math.max(a, h.order), -1);
    st.habits.items.push({ ...habit, order: max + 1 });
  });
}

export function remove(id) {
  return store.update((st) => {
    st.habits.items = st.habits.items.filter((h) => h.id !== id);
    delete st.habits.entries[id];
  });
}

export function setArchived(id, archived) {
  return store.update((st) => {
    const h = st.habits.items.find((x) => x.id === id);
    if (h) h.archived = !!archived;
  });
}

/** Reorder by ids. Anything unnamed keeps its place behind them. */
export function reorder(ids) {
  return store.update((st) => {
    ids.forEach((id, i) => {
      const h = st.habits.items.find((x) => x.id === id);
      if (h) h.order = i;
    });
    let next = ids.length;
    st.habits.items
      .filter((h) => !ids.includes(h.id))
      .sort((a, b) => a.order - b.order)
      .forEach((h) => {
        h.order = next++;
      });
  });
}

export function moveToGroup(id, groupId) {
  return store.update((st) => {
    const h = st.habits.items.find((x) => x.id === id);
    if (h) h.group = groupId || '';
  });
}

export function addGroup(name) {
  const id = `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  store.update((st) => {
    const max = st.habits.groups.reduce((a, g) => Math.max(a, g.order), -1);
    st.habits.groups.push({ id, name: String(name).slice(0, 40), order: max + 1, collapsed: false });
  });
  return id;
}

export function renameGroup(id, name) {
  return store.update((st) => {
    const g = st.habits.groups.find((x) => x.id === id);
    if (g) g.name = String(name).slice(0, 40);
  });
}

/** Deleting a group never deletes habits. */
export function removeGroup(id) {
  return store.update((st) => {
    st.habits.groups = st.habits.groups.filter((g) => g.id !== id);
    st.habits.items.forEach((h) => {
      if (h.group === id) h.group = '';
    });
  });
}

export function toggleGroup(id) {
  return store.update((st) => {
    const g = st.habits.groups.find((x) => x.id === id);
    if (g) g.collapsed = !g.collapsed;
  });
}

export function moveGroup(id, dir) {
  return store.update((st) => {
    const list = st.habits.groups.slice().sort((a, b) => a.order - b.order);
    const i = list.findIndex((g) => g.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((g, k) => {
      g.order = k;
    });
  });
}

/* ---------------- entries ---------------- */

export function valueOn(habit, key) {
  const e = store.get().habits.entries[habit.id];
  return e ? e[key] : undefined;
}

/** `undefined` erases the day. A zero is a different thing. */
export function setValue(habitId, key, value) {
  return store.update((st) => {
    const map = st.habits.entries[habitId] || (st.habits.entries[habitId] = {});
    if (value === undefined || value === null || Number.isNaN(value)) delete map[key];
    else map[key] = value;
    if (!Object.keys(map).length) delete st.habits.entries[habitId];
  });
}

/** The tap cycle:
 *    off              nothing -> done -> nothing
 *    + question marks nothing -> done -> lapse -> nothing
 *    + skips          nothing -> done -> skip -> nothing
 *    + both           nothing -> done -> lapse -> skip -> nothing
 *  A value outside the current cycle clears on the next tap. */
export function nextValue(habit, key) {
  const s = settings();
  const cycle = [undefined, YES];
  if (s.unknownMarks) cycle.push(NO);
  if (s.skipDays) cycle.push(SKIP);
  const i = cycle.findIndex((v) => v === valueOn(habit, key));
  return cycle[(i + 1) % cycle.length];
}

/* ---------------- frequency ---------------- */

/** Which picker row a fraction came from. Not stored: the fraction is the truth. */
export function freqPreset(freq) {
  const { num, den } = freq;
  if (num === 1 && den === 1) return 'daily';
  if (num === 1) return 'everyN';
  if (den === 7) return 'week';
  if (den === 30) return 'month';
  return 'custom';
}

export function freqLabel(freq) {
  const { num, den } = freq;
  if (num === 1 && den === 1) return 'Every day';
  if (num === 1) return `Every ${den} days`;
  if (den === 7) return `${num} times per week`;
  if (den === 30) return `${num} times per month`;
  return `${num} times in ${den} days`;
}

/* -------------------- linked rows -------------------- */

// Each source returns the set of days it happened on. Asked per day instead,
// the grid would rescan every log seven hundred times per row.
export const LINKED = [
  {
    id: 'link:kegels', icon: 'target', href: '#/kegels',
    name: () => kegelName(),
    question: 'Did you train the pelvic floor?',
    days: (st) => new Set(st.sessions.map((s) => s.date)),
    action: () => '#/session',
    detail: () => {
      const plan = kegels.planForToday();
      if (plan.type === 'release') return 'Release day · down-training only';
      const left = Math.max(0, plan.target - plan.doneToday);
      if (plan.complete) return `Week ${plan.level} · done today`;
      return `${left} left · week ${plan.level}`;
    },
  },
  {
    id: 'link:pe', icon: 'trend', href: '#/pe',
    name: () => peName(),
    question: 'Did you put the work in?',
    days: (st) => new Set(st.pe.sessions.map((s) => s.date)),
    action: () => '#/pe/timer?type=stretch',
    detail: () => {
      const done = store
        .get()
        .pe.sessions.filter((s) => s.date === store.dayKey() && s.type === 'stretch')
        .reduce((a, s) => a + s.durationSec * 1000, 0);
      const goal = pe.DAILY_STRETCH_GOAL_MS;
      return done >= goal ? 'Two hours done' : `${fmtHours(done)} of ${fmtHours(goal)}`;
    },
  },
  {
    id: 'link:bible', icon: 'scripture', href: '#/bible',
    name: () => 'Bible',
    question: 'Did you read?',
    days: (st) => new Set(Object.entries(st.bible.days).filter(([, d]) => d?.chapters?.length).map(([k]) => k)),
    action: () => {
      const p = bible.position();
      return `#/bible/reader?book=${p.book}&ch=${p.ch}`;
    },
    detail: () => {
      const today = bible.dayRead();
      if (today.any) return `${today.count} chapter${today.count === 1 ? '' : 's'} today`;
      const p = bible.position();
      return bible.refName(`${p.book}:${p.ch}`);
    },
  },
  {
    id: 'link:pray', icon: 'sun', href: '#/bible',
    name: () => 'Prayer',
    question: 'Morning and night, both?',
    days: (st) => new Set(Object.entries(st.pray.days).filter(([, d]) => d && d.morning && d.evening).map(([k]) => k)),
    // Whichever half is owed. Both kept opens the morning again, which is harmless.
    action: () => `#/bible/pray?slot=${pray.dayState().morning ? 'evening' : 'morning'}`,
    detail: () => {
      const d = pray.dayState();
      if (d.morning && d.evening) return 'Kept, both';
      return d.morning ? 'Night owed' : 'Morning owed';
    },
  },
  {
    id: 'link:breathe', icon: 'breath', href: '#/breathe',
    name: () => 'Wind-down',
    question: 'Did you breathe before sleep?',
    days: (st) => new Set(Object.keys(st.breathe.days)),
    action: () => '#/breathe/run',
    detail: () => {
      const t = breathe.dayState();
      if (t.done) return 'Done tonight';
      const s = breathe.settings();
      const p = breathe.PATTERNS[s.pattern];
      return `${s.minutes} min · ${p ? p.short : 'paced breathing'}`;
    },
  },
];

/** A feature's status, asked so it cannot break the grid. */
function safely(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** A linked source dressed as a habit. `linked` marks its past read-only.
 *  The setting is honoured downstream too, the Arena included: rows you have
 *  switched off must not lose you a week. */
export function linkedHabits() {
  const st = store.get();
  // A locked install has nothing to read. Checked ahead of the setting: "I turned
  // these off" and "these are not mine" are different things.
  if (!nifoUnlocked()) return [];
  if (!settings().showLinked) return [];
  return LINKED.map((l) => {
    const days = l.days(st);
    return {
      id: l.id,
      linked: true,
      icon: l.icon,
      href: l.href,
      name: l.name(),
      question: l.question,
      notes: '',
      colour: null, // the app's own rows take the accent, not a colour of their own
      kind: 'yesno',
      unit: '',
      target: 0,
      targetType: 'atleast',
      freq: { num: 1, den: 1 },
      group: '',
      archived: false,
      createdAt: st.createdAt,
      order: -1,
      read: (key) => days.has(key),
      // Both computed, not stored: they describe now, not the record.
      action: safely(l.action, null),
      detail: safely(l.detail, ''),
    };
  });
}

/* --------------------- the series --------------------- */

const cache = new Map();
store.subscribe(() => cache.clear());

function rawOf(habit, key) {
  if (habit.linked) return habit.read(key) ? YES : undefined;
  return valueOn(habit, key);
}

/** A day's worth, 0 to 1, before frequency. A ceiling habit scores 1 at or
 *  under target and 0 at twice it. Nothing recorded scores 0 either way. */
function unitValue(habit, raw) {
  if (habit.kind === 'number') {
    const t = habit.target;
    if (raw == null) return 0;
    if (!t) return raw > 0 ? 1 : 0;
    if (habit.targetType === 'atmost') return raw <= t ? 1 : Math.max(0, 1 - (raw - t) / t);
    return Math.min(raw / t, 1);
  }
  return raw === YES ? 1 : 0;
}

function firstKey(habit) {
  const created = store.dayKey(new Date(habit.createdAt || Date.now()));
  const map = store.get().habits.entries[habit.id];
  const keys = map ? Object.keys(map).sort() : [];
  const earliest = keys.length && keys[0] < created ? keys[0] : created;
  const floor = store.addDays(today(), -MAX_SPAN_DAYS);
  return earliest < floor ? floor : earliest;
}

/** The whole record for one habit, computed once per store version. */
export function summary(habit) {
  if (!habit) return null;
  const hit = cache.get(habit.id);
  if (hit) return hit;

  const end = today();
  // A linked row gets a fixed window; a real habit starts at created or oldest entry.
  const start = habit.linked ? store.addDays(end, -LINKED_SPAN_DAYS) : firstKey(habit);
  const { num, den } = habit.freq;
  const mult = Math.pow(0.5, Math.sqrt(num / den) / 13);

  const days = [];
  for (let k = start; k <= end; k = store.addDays(k, 1)) {
    const raw = rawOf(habit, k);
    const skipped = raw === SKIP;
    const unit = skipped ? 0 : unitValue(habit, raw);
    days.push({ key: k, raw, skipped, unit, hit: !skipped && unit >= 1 });
  }

  // A day is satisfied when the window of `den` days ending on it holds `num`,
  // or when you did it: marking one day of a four-a-week habit must not score
  // zero on the day you did the thing. Daily falls out as the trivial case and
  // keeps partial credit, so 1.4 of 2 litres is worth more than nothing.
  let score = 0;
  let window = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (den > 1) {
      if (d.hit) window++;
      const drop = i - den;
      if (drop >= 0 && days[drop].hit) window--;
      d.satisfied = window >= num || d.hit;
      d.value = d.satisfied ? 1 : 0;
    } else {
      d.satisfied = d.hit;
      d.value = d.unit;
    }
    // A skip leaves the series rather than scoring zero.
    if (!d.skipped) score = score * mult + d.value * (1 - mult);
    d.score = score;
  }

  // Streaks are calendar days, skips included: ten kept, five skipped, ten kept
  // is twenty-five. `hits` decides whether a run counts, `len` how long it was.
  const streaks = [];
  let run = null;
  for (const d of days) {
    if (d.satisfied || d.skipped) {
      if (!run) run = { from: d.key, to: d.key, len: 0, hits: 0 };
      run.to = d.key;
      run.len++;
      if (d.satisfied) run.hits++;
      continue;
    }
    if (run && run.hits) streaks.push(run);
    run = null;
  }
  if (run && run.hits) streaks.push(run);

  // Live only if it reaches today or yesterday: today unfinished is not broken.
  const last = streaks[streaks.length - 1];
  const yesterday = store.addDays(end, -1);
  const streak = last && (last.to === end || last.to === yesterday) ? last.len : 0;

  const total = days.reduce((a, d) => {
    if (d.skipped) return a;
    if (habit.kind === 'number') return a + (typeof d.raw === 'number' && d.raw > 0 ? d.raw : 0);
    return a + (d.raw === YES ? 1 : 0);
  }, 0);

  const index = new Map(days.map((d) => [d.key, d]));
  const out = {
    habit,
    days,
    index,
    score,
    streak,
    total,
    best: streaks.reduce((a, s) => Math.max(a, s.len), 0),
    streaks: streaks.slice().sort((a, b) => b.len - a.len),
    satisfiedToday: !!index.get(end)?.satisfied,
    doneToday: !!index.get(end)?.hit,
    skippedToday: !!index.get(end)?.skipped,
  };
  cache.set(habit.id, out);
  return out;
}

/** Streaks that ended inside a window, longest first: what broke that week.
 *  The live run is left out, since it has not broken. */
export function brokenIn(from, to) {
  const floor = store.addDays(today(), -1);
  const out = [];
  for (const h of active()) {
    const sum = summary(h);
    if (!sum) continue;
    for (const st of sum.streaks) {
      if (st.to >= floor || st.to < from || st.to > to || st.len < 3) continue;
      out.push({ habit: h, len: st.len, to: st.to });
    }
  }
  return out.sort((a, b) => b.len - a.len);
}

/** The score `back` days ago, for the overview deltas. */
export function scoreAgo(sum, back) {
  const key = store.addDays(today(), -back);
  const d = sum.index.get(key);
  if (d) return d.score;
  // Older than the record: the habit did not exist, so it scored nothing.
  return sum.days.length && key < sum.days[0].key ? 0 : sum.score;
}

/* ---------------- charts ---------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** Bars for the history chart, one bucket per period, oldest first. */
export function history(sum, period = 'week', buckets = 14) {
  const parse = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const bucketOf = (dt) => {
    if (period === 'day') return store.dayKey(dt);
    if (period === 'week') {
      const first = settings().firstDay;
      const shift = (dt.getDay() - first + 7) % 7;
      return store.dayKey(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - shift));
    }
    if (period === 'month') return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    if (period === 'quarter') return `${dt.getFullYear()}-Q${Math.floor(dt.getMonth() / 3) + 1}`;
    return String(dt.getFullYear());
  };
  const label = (key) => {
    if (period === 'day' || period === 'week') {
      const dt = parse(key);
      return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
    }
    if (period === 'month') {
      const [y, m] = key.split('-');
      return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
    }
    return key;
  };

  const map = new Map();
  for (const d of sum.days) {
    if (d.skipped) continue;
    const b = bucketOf(parse(d.key));
    const add = sum.habit.kind === 'number' ? (typeof d.raw === 'number' && d.raw > 0 ? d.raw : 0) : d.hit ? 1 : 0;
    map.set(b, (map.get(b) || 0) + add);
  }
  const keys = [...map.keys()].sort().slice(-buckets);
  return keys.map((k) => {
    const v = map.get(k);
    return {
      label: label(k),
      short: label(k).split(' ')[0],
      value: Math.round(v * 100) / 100,
      text: `${Math.round(v * 100) / 100}${sum.habit.unit ? ` ${sum.habit.unit}` : ''}`,
    };
  });
}

/** Weekday against month: which days this actually happens on. */
export function weekdayByMonth(sum, months = 8) {
  const first = settings().firstDay;
  const rows = Array.from({ length: 7 }, (_, i) => (first + i) % 7);
  const cols = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    cols.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, label: MONTHS[dt.getMonth()] });
  }
  const counts = new Map();
  for (const d of sum.days) {
    if (!d.hit) continue;
    const [y, m, day] = d.key.split('-').map(Number);
    const dow = new Date(y, m - 1, day).getDay();
    const k = `${d.key.slice(0, 7)}|${dow}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let max = 0;
  for (const v of counts.values()) max = Math.max(max, v);
  return {
    cols,
    max,
    rows: rows.map((dow) => ({
      dow,
      label: WEEKDAYS[dow],
      cells: cols.map((c) => counts.get(`${c.key}|${dow}`) || 0),
    })),
  };
}

/** Weeks as columns, weekdays as rows, with the dates written in. */
export function calendar(sum, weeks = 17) {
  const first = settings().firstDay;
  const end = today();
  const [ey, em, ed] = end.split('-').map(Number);
  const endDate = new Date(ey, em - 1, ed);
  // Back to the start of this week, then back `weeks - 1` more.
  const shift = (endDate.getDay() - first + 7) % 7;
  const startDate = new Date(ey, em - 1, ed - shift - (weeks - 1) * 7);

  const cols = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const cells = [];
    let label = '';
    for (let i = 0; i < 7; i++) {
      const dt = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + w * 7 + i);
      const key = store.dayKey(dt);
      const d = sum.index.get(key);
      cells.push({
        key,
        day: dt.getDate(),
        future: key > end,
        today: key === end,
        skipped: !!d?.skipped,
        hit: !!d?.hit,
        satisfied: !!d?.satisfied,
        lapse: d && !d.skipped && d.raw === NO,
        value: d?.raw,
      });
      if (i === 0 && dt.getMonth() !== lastMonth) {
        lastMonth = dt.getMonth();
        label = dt.getMonth() === 0 ? `${MONTHS[0]} ${dt.getFullYear()}` : MONTHS[dt.getMonth()];
      }
    }
    cols.push({ label, cells });
  }
  return { cols, rowLabels: Array.from({ length: 7 }, (_, i) => WEEKDAYS[(first + i) % 7]) };
}

/* ---------------- across all habits ---------------- */

/** What is still owed today across the grid, linked rows included when they
 *  are on it: the number always describes what is on screen. */
export function dueToday() {
  const list = [...linkedHabits(), ...active()];
  let done = 0;
  const pending = [];
  for (const h of list) {
    const s = summary(h);
    if (s.satisfiedToday || s.skippedToday) done++;
    else pending.push(h);
  }
  return { total: list.length, done, pending, habits: active().length };
}

/** Mean of its members. An empty group scores nothing, not 100%. */
export function groupScore(groupId) {
  const list = active().filter((h) => h.group === groupId);
  if (!list.length) return null;
  return list.reduce((a, h) => a + summary(h).score, 0) / list.length;
}

/* --------------------- reminders --------------------- */

export function syncAlarms() {
  const ids = [];
  for (let slot = 0; slot < ALARM_HABIT_SLOTS; slot++) {
    for (let d = 0; d < 7; d++) ids.push(ALARM_HABIT_BASE + slot * 8 + d);
  }
  const list = active().slice(0, ALARM_HABIT_SLOTS);
  const notifications = [];
  list.forEach((h, slot) => {
    if (!h.remindAt || !/^\d{2}:\d{2}$/.test(h.remindAt)) return;
    const [hour, minute] = h.remindAt.split(':').map(Number);
    const days = h.remindDays.length ? h.remindDays : [0, 1, 2, 3, 4, 5, 6];
    for (const d of days) {
      notifications.push({
        id: ALARM_HABIT_BASE + slot * 8 + d,
        title: 'NiFo',
        body: h.question || h.name,
        hour,
        minute,
        // Capacitor counts weekdays from Sunday as 1, JavaScript from 0.
        weekday: days.length === 7 ? null : d + 1,
      });
    }
  });
  // All seven days is one daily alarm, not seven weekly ones.
  const collapsed = [];
  const seen = new Set();
  for (const n of notifications) {
    if (n.weekday === null) {
      const slotId = n.id - (n.id - ALARM_HABIT_BASE) % 8;
      if (seen.has(slotId)) continue;
      seen.add(slotId);
      collapsed.push({ ...n, id: slotId });
      continue;
    }
    collapsed.push(n);
  }
  return cancelAlarms(ids).then(() => scheduleMany(collapsed));
}
