// Habits domain. The general-purpose room: name, question, colour, unit,
// target, frequency, group, reminder, order and any past day are all editable.
//
// Four things to know first:
//   Entries are the record. Streaks and scores compute on every read, because
//   the past is editable here.
//   A day is a key, and `dayStartHour` moves the boundary. This section only.
//   Frequency is a fraction, n in d. Daily is 1/1, three a week is 3/7.
//   Four kinds, two shapes. A timed habit is a number of minutes with a floor,
//   a checklist a number of items ticked with a floor of all of them. Nothing
//   downstream branches on the two new kinds.

import * as store from '../store.js';
import { WEEKDAYS } from '../ui.js';
import { cancelAlarms, scheduleMany, ALARM_HABIT_BASE, ALARM_HABIT_SLOTS, ALARM_HABIT_DAYS } from '../native.js';

/* -------------------- the palette -------------------- */

// Every one clears 7:1 on the ground, and none sits within thirty degrees of
// the accent's hue. A habit's colour must never be mistaken for the app's.
export const COLOURS = [
  { id: 'teal', hex: '#2fd4c4', name: 'Teal' },
  { id: 'mint', hex: '#4ade80', name: 'Mint' },
  { id: 'lime', hex: '#a3e635', name: 'Lime' },
  { id: 'amber', hex: '#fbbf24', name: 'Amber' },
  { id: 'orange', hex: '#fb923c', name: 'Orange' },
  { id: 'clay', hex: '#d9a08a', name: 'Clay' },
  { id: 'rose', hex: '#f472b6', name: 'Rose' },
  { id: 'plum', hex: '#e879f9', name: 'Plum' },
  { id: 'violet', hex: '#a78bfa', name: 'Violet' },
  { id: 'indigo', hex: '#93a5f0', name: 'Indigo' },
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
    items: [],
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

/** Anything answered with a number: measurable, timed, checklist. */
export const measurable = (h) => h.kind !== 'yesno';

/** The line under a starter's name: what it will ask of you. */
export const starterMeta = (h) => (measurable(h) ? `${h.target} ${h.unit} a day` : freqLabel(h.freq));

export function addStarter(i) {
  const pick = STARTERS[i];
  // Replaying the introduction must not leave two rows called Gym.
  if (!pick || active().some((h) => h.name === pick.name)) return null;
  return save({ ...draft(pick.kind), ...pick, order: active().length });
}

export function draft(kind = 'yesno') {
  const h = { ...blankHabit(), kind };
  if (kind === 'number') h.target = 1;
  if (kind === 'timed') Object.assign(h, { unit: 'min', target: 20 });
  if (kind === 'checklist') Object.assign(h, { unit: 'items', items: ['', ''], target: 2 });
  return h;
}

/** The two fixed kinds keep their shape whatever the form sent. */
function normalise(h) {
  if (h.kind === 'timed') Object.assign(h, { unit: 'min', targetType: 'atleast' });
  if (h.kind === 'checklist') {
    h.items = (h.items || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    Object.assign(h, { unit: 'items', target: h.items.length, targetType: 'atleast' });
  }
  return h;
}

/** Every write stamps updatedAt, so two copies of one habit can be told apart.
 *  Reconstructing it after the fact is impossible, which is why it is here
 *  before there is anything to sync it with. */
const stamp = (rec) => {
  if (rec) rec.updatedAt = Date.now();
  return rec;
};

export function save(habit) {
  return store.update((st) => {
    const i = st.habits.items.findIndex((h) => h.id === habit.id);
    if (i >= 0) {
      st.habits.items[i] = stamp(normalise({ ...st.habits.items[i], ...habit }));
      return;
    }
    if (st.habits.items.length >= MAX_HABITS) return;
    const max = st.habits.items.reduce((a, h) => Math.max(a, h.order), -1);
    st.habits.items.push(stamp(normalise({ ...habit, order: max + 1 })));
  });
}

export function remove(id) {
  return store.update((st) => {
    st.habits.items = st.habits.items.filter((h) => h.id !== id);
    delete st.habits.entries[id];
    delete st.habits.checks[id];
  });
}

/* ---------------- undo ---------------- */
// An act happens at once and a toast holds the way back for six seconds. What
// it holds is the whole of a habit, or a group and who was in it.

/** Everything a habit is, taken before it goes. */
export function snapshotOf(id) {
  const st = store.get().habits;
  const habit = st.items.find((h) => h.id === id);
  if (!habit) return null;
  return { habit: { ...habit }, entries: { ...(st.entries[id] || {}) }, checks: { ...(st.checks[id] || {}) } };
}

export function reinstate(snap) {
  if (!snap) return;
  return store.update((st) => {
    if (st.habits.items.some((h) => h.id === snap.habit.id)) return;
    st.habits.items.push({ ...snap.habit });
    if (Object.keys(snap.entries).length) st.habits.entries[snap.habit.id] = { ...snap.entries };
    if (Object.keys(snap.checks).length) st.habits.checks[snap.habit.id] = { ...snap.checks };
  });
}

/** A group and its members, taken before it goes. */
export function groupSnapshot(id) {
  const g = groupById(id);
  if (!g) return null;
  return { group: { ...g }, members: all().filter((h) => h.group === id).map((h) => h.id) };
}

export function reinstateGroup(snap) {
  if (!snap) return;
  return store.update((st) => {
    if (st.habits.groups.some((g) => g.id === snap.group.id)) return;
    st.habits.groups.push({ ...snap.group });
    st.habits.items.forEach((h) => {
      if (snap.members.includes(h.id)) stamp(h).group = snap.group.id;
    });
  });
}

/** The same habit again, with no record. Reminders come along, days do not. */
export function duplicate(id) {
  const h = byId(id);
  if (!h) return null;
  const copy = { ...blankHabit(), ...h, id: blankHabit().id, name: `${h.name} copy`.slice(0, 60), createdAt: Date.now(), archived: false, archivedAt: 0, order: 0 };
  delete copy.updatedAt;
  save(copy);
  return copy.id;
}

export function setArchived(id, archived) {
  return store.update((st) => {
    const h = st.habits.items.find((x) => x.id === id);
    if (!h) return;
    h.archived = !!archived;
    // When, not just that: the Arena owes a row only the days it was on the grid.
    h.archivedAt = h.archived ? Date.now() : 0;
    stamp(h);
  });
}

/** Reorder by ids. Anything unnamed keeps its place behind them. */
export function reorder(ids) {
  return store.update((st) => {
    ids.forEach((id, i) => {
      const h = st.habits.items.find((x) => x.id === id);
      if (h) stamp(h).order = i;
    });
    let next = ids.length;
    st.habits.items
      .filter((h) => !ids.includes(h.id))
      .sort((a, b) => a.order - b.order)
      .forEach((h) => {
        stamp(h).order = next++;
      });
  });
}

export function moveToGroup(id, groupId) {
  return store.update((st) => {
    const h = st.habits.items.find((x) => x.id === id);
    if (h) stamp(h).group = groupId || '';
  });
}

export function addGroup(name) {
  const id = `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  store.update((st) => {
    const max = st.habits.groups.reduce((a, g) => Math.max(a, g.order), -1);
    st.habits.groups.push(stamp({ id, name: String(name).slice(0, 40), order: max + 1, collapsed: false }));
  });
  return id;
}

export function renameGroup(id, name) {
  return store.update((st) => {
    const g = st.habits.groups.find((x) => x.id === id);
    if (g) stamp(g).name = String(name).slice(0, 40);
  });
}

/** Deleting a group never deletes habits. */
export function removeGroup(id) {
  return store.update((st) => {
    st.habits.groups = st.habits.groups.filter((g) => g.id !== id);
    st.habits.items.forEach((h) => {
      if (h.group === id) stamp(h).group = '';
    });
  });
}

export function toggleGroup(id) {
  return store.update((st) => {
    const g = st.habits.groups.find((x) => x.id === id);
    if (g) stamp(g).collapsed = !g.collapsed;
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

/* ---------------- protocols ---------------- */
// A curated block: rows created for you, a fixed span, and a feat at the end.
// Data, never a screen of special cases. A run is a group like any other.

export const PROTOCOLS = [
  {
    id: 'discipline',
    name: '30 days of discipline',
    days: 30,
    blurb: 'Four rows, thirty days, nothing optional.',
    rows: [
      { name: 'Up before 7', colour: 'amber', kind: 'yesno', question: 'Up before seven?' },
      { name: 'Cold shower', colour: 'sky', kind: 'yesno', question: 'Cold shower?' },
      { name: 'No phone in bed', colour: 'clay', kind: 'yesno', question: 'Phone out of the bedroom?' },
      { name: 'Steps', colour: 'mint', kind: 'number', unit: 'steps', target: 10000, question: 'How many steps?' },
    ],
  },
  {
    id: 'split',
    name: 'The split',
    days: 56,
    blurb: 'Push, pull, legs, once a week each, and the protein to build on. Eight weeks.',
    rows: [
      { name: 'Push', colour: 'orange', kind: 'yesno', freq: { num: 1, den: 7 }, question: 'Push day done?' },
      { name: 'Pull', colour: 'rose', kind: 'yesno', freq: { num: 1, den: 7 }, question: 'Pull day done?' },
      { name: 'Legs', colour: 'lime', kind: 'yesno', freq: { num: 1, den: 7 }, question: 'Leg day done?' },
      { name: 'Protein', colour: 'amber', kind: 'number', unit: 'g', target: 150, question: 'How much protein?' },
    ],
  },
  {
    id: 'sleep',
    name: 'Sleep protocol',
    days: 28,
    blurb: 'The same night, four weeks running.',
    rows: [
      { name: 'No caffeine after 2', colour: 'clay', kind: 'yesno', question: 'Last coffee before two?' },
      { name: 'Screens off by 10', colour: 'violet', kind: 'yesno', question: 'Screens off by ten?' },
      { name: 'In bed by 11', colour: 'indigo', kind: 'yesno', question: 'In bed by eleven?' },
      { name: 'Hours slept', colour: 'sky', kind: 'number', unit: 'h', target: 7, question: 'How many hours?' },
    ],
  },
];

/** The bar a run has to hold: four in five of the cells it owed. */
const PROTOCOL_BAR = 0.8;

export const protocolRuns = () => store.get().habits.protocols;

/** The run a group belongs to, while it is running. */
export function protocolOf(groupId) {
  const [id, run] = Object.entries(protocolRuns()).find(([, r]) => r.group === groupId && !r.settled) || [];
  return id ? { id, ...run, days: daysLeftIn(run) } : null;
}

const daysLeftIn = (run) => {
  let n = 0;
  let k = today();
  while (k <= run.ends && n < 400) {
    n++;
    k = store.addDays(k, 1);
  }
  return n;
};

/** Creates the group and the rows, and starts the clock. One run per protocol at a time. */
export function startProtocol(id) {
  const p = PROTOCOLS.find((x) => x.id === id);
  if (!p || (protocolRuns()[id] && !protocolRuns()[id].settled)) return null;
  const group = addGroup(p.name);
  const rows = [];
  for (const r of p.rows) {
    const h = { ...draft(r.kind), ...r, group, order: active().length };
    save(h);
    rows.push(h.id);
  }
  const started = today();
  store.update((st) => {
    st.habits.protocols[id] = { started, ends: store.addDays(started, p.days - 1), group, rows, settled: false, completed: false };
  });
  return group;
}

/** A run past its last day is judged once: the mean of its rows over the span. */
export function settleProtocols() {
  const now = today();
  for (const [id, run] of Object.entries(protocolRuns())) {
    if (run.settled || run.ends >= now) continue;
    let owed = 0;
    let kept = 0;
    for (const hid of run.rows) {
      const h = byId(hid);
      if (!h) continue;
      const sum = summary(h);
      for (let k = run.started; k <= run.ends; k = store.addDays(k, 1)) {
        const d = sum.index.get(k);
        if (!d || d.skipped) continue;
        owed++;
        if (d.satisfied) kept++;
      }
    }
    const completed = owed > 0 && kept / owed >= PROTOCOL_BAR;
    store.update((st) => {
      Object.assign(st.habits.protocols[id], { settled: true, completed });
    });
  }
}

export const completedProtocol = (id) => !!protocolRuns()[id]?.completed;

/* ---------------- a line on a day ---------------- */

export const noteOn = (key) => store.get().habits.notes[key] || '';

export function setDayNote(key, text) {
  return store.update((st) => {
    const line = String(text || '').trim().slice(0, 140);
    if (line) st.habits.notes[key] = line;
    else delete st.habits.notes[key];
  });
}

/** The lines inside a span, oldest first. */
export function notesIn(from, to) {
  return Object.entries(store.get().habits.notes)
    .filter(([k]) => k >= from && k <= to)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, text]) => ({ key, text }));
}

/* ---------------- checklists ---------------- */
// Which items were ticked is kept beside the count, so the count stays a
// plain number the score and the Arena can read.

/** Indices ticked on `key`. */
export function checksOn(habit, key) {
  return store.get().habits.checks[habit.id]?.[key] || [];
}

/** Write the ticks, and the count as the day's value. None ticked erases the day. */
export function setChecks(habitId, key, indices) {
  const idx = [...new Set(indices)].filter((i) => Number.isInteger(i) && i >= 0 && i < 8).sort((a, b) => a - b);
  return store.update((st) => {
    const map = st.habits.checks[habitId] || (st.habits.checks[habitId] = {});
    if (idx.length) map[key] = idx;
    else delete map[key];
    if (!Object.keys(map).length) delete st.habits.checks[habitId];
    const days = st.habits.entries[habitId] || (st.habits.entries[habitId] = {});
    if (idx.length) days[key] = idx.length;
    else delete days[key];
    if (!Object.keys(days).length) delete st.habits.entries[habitId];
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

/* --------------------- the series --------------------- */

const cache = new Map();
store.subscribe(() => cache.clear());

function rawOf(habit, key) {
  return valueOn(habit, key);
}

/** A day's worth, 0 to 1, before frequency. A ceiling habit scores 1 at or
 *  under target and 0 at twice it. Nothing recorded scores 0 either way. */
function unitValue(habit, raw) {
  if (measurable(habit)) {
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
  const start = firstKey(habit);
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
  //
  // The score is a weighted mean of the days lived, each worth `mult` of the
  // one after it. Carried as a running sum over its own weight, so a habit
  // three days old is judged on three days.
  let weighted = 0;
  let weight = 0;
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
    if (!d.skipped) {
      weighted = weighted * mult + d.value;
      weight = weight * mult + 1;
    }
    d.score = weight ? weighted / weight : 0;
  }
  const score = weight ? weighted / weight : 0;

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
    if (measurable(habit)) return a + (typeof d.raw === 'number' && d.raw > 0 ? d.raw : 0);
    return a + (d.raw === YES ? 1 : 0);
  }, 0);

  const index = new Map(days.map((d) => [d.key, d]));
  const out = {
    habit,
    days,
    index,
    // The first day it answers for. Anything before it is not a day it missed.
    from: days.length ? days[0].key : end,
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

/* ---------------- why the number moved ---------------- */

/** The half-life in days: how long a miss takes to fade to half. */
export const halfLife = (habit) => Math.round(13 / Math.sqrt(habit.freq.num / habit.freq.den));

/** The last seven days against the seven before: the score's move in points,
 *  the days that cost it, the days that held. Computed, never stored. */
export function movement(sum) {
  const end = today();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = sum.index.get(store.addDays(end, -i));
    if (d) week.push(d);
  }
  const misses = week.filter((d) => !d.skipped && !d.satisfied && d.key !== end).map((d) => d.key);
  const kept = week.filter((d) => d.satisfied).length;
  return {
    days: week.length,
    delta: Math.round((sum.score - scoreAgo(sum, 7)) * 100),
    misses,
    kept,
    halfLife: halfLife(sum.habit),
  };
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
    const add = measurable(sum.habit) ? (typeof d.raw === 'number' && d.raw > 0 ? d.raw : 0) : d.hit ? 1 : 0;
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
        // Still tappable: backfilling a habit you kept before you added it.
        before: key < sum.from,
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

/** Rows owed on `key` that nothing answered: no mark, and not carried by the
 *  window either. */
export function unansweredOn(key) {
  return active().filter((h) => {
    const d = summary(h).index.get(key);
    return !!d && d.raw === undefined && !d.satisfied;
  });
}

/** The catch-up sheet: yesterday only, once a day, never in the first week. */
export function catchUpDue() {
  if (settings().catchUpDay === today()) return false;
  if (store.get().createdAt > Date.now() - 7 * 864e5) return false;
  return unansweredOn(store.addDays(today(), -1)).length > 0;
}

export function markCatchUp() {
  store.update((st) => {
    st.habits.settings.catchUpDay = today();
  }, { local: true });
}

/** What is still owed today across the grid. */
export function dueToday() {
  const list = active();
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
// One-shots, a week ahead, re-armed on every change. A day already answered
// gets none, which is what cancels a reminder the moment its cell is marked.

/** The reminder id for a row's slot and a day `offset` from today. */
export const alarmIdFor = (slot, offset) => ALARM_HABIT_BASE + slot * 8 + offset;

/** The rows that can carry a reminder, in slot order. */
export const reminded = () => active().slice(0, ALARM_HABIT_SLOTS);

/** What would be armed. `line` is the match from the Arena, carried in the text. */
export function planReminders(line = () => '') {
  const now = Date.now();
  const match = line();
  const out = [];
  reminded().forEach((h, slot) => {
    if (!h.remindAt || !/^\d{2}:\d{2}$/.test(h.remindAt)) return;
    const [hour, minute] = h.remindAt.split(':').map(Number);
    const days = h.remindDays.length ? h.remindDays : [0, 1, 2, 3, 4, 5, 6];
    const sum = summary(h);
    for (let offset = 0; offset < ALARM_HABIT_DAYS; offset++) {
      const key = store.addDays(today(), offset);
      const [y, m, d] = key.split('-').map(Number);
      const at = new Date(y, m - 1, d, hour, minute, 0, 0);
      if (!days.includes(at.getDay()) || at.getTime() <= now) continue;
      const cell = sum.index.get(key);
      if (cell?.satisfied || cell?.skipped) continue;
      out.push({
        id: alarmIdFor(slot, offset),
        title: 'Habit Nemesis',
        body: match ? `${h.name}. ${match}` : h.question || h.name,
        at: at.getTime(),
        extra: { habitId: h.id, day: key },
        actionTypeId: h.kind === 'yesno' ? 'yesno' : 'number',
      });
    }
  });
  return out;
}

export function syncAlarms(line) {
  const ids = [];
  for (let slot = 0; slot < ALARM_HABIT_SLOTS; slot++) {
    for (let d = 0; d < 8; d++) ids.push(alarmIdFor(slot, d));
  }
  return cancelAlarms(ids).then(() => scheduleMany(planReminders(line)));
}
