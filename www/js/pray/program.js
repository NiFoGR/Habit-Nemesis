// Prayer domain logic: what is owed today, what has been kept, and the streak.
//
// The rule is two fixed slots a day and both are required. There is no daily
// target to tune and no partial credit, so the state of a day is just two
// booleans. That is deliberate: a rule you can negotiate with is not a rule.

import * as store from '../store.js';
import { RULES, buildRule, ruleMinutes } from './prayers.js';
import { scheduleDaily, cancelAlarm, ALARM_PRAY_MORNING, ALARM_PRAY_EVENING } from '../native.js';

export const SLOTS = ['morning', 'evening'];

/** What has been kept on a given day. */
export function dayState(key = store.dayKey()) {
  const d = store.get().pray.days[key] || {};
  return {
    key,
    morning: d.morning || null,
    evening: d.evening || null,
    kept: SLOTS.filter((s) => d[s]).length,
    complete: !!(d.morning && d.evening),
  };
}

/** Which slot the app should be pushing you towards right now.
 *  Before the evening hour, an unkept morning is still the live one. After it,
 *  the night rule takes over even if the morning was missed, because there is
 *  no point sending you back to a morning that is gone. */
export function currentSlot(now = new Date()) {
  const s = store.get().pray.settings;
  const today = dayState();
  const [eh, em] = s.eveningAt.split(':').map(Number);
  const past = now.getHours() * 60 + now.getMinutes() >= eh * 60 + em;

  if (!today.morning && !past) return 'morning';
  if (!today.evening) return past || today.morning ? 'evening' : 'morning';
  if (!today.morning) return 'morning';
  return null;
}

/** Outstanding slots today, in the order they should be done. */
export function outstanding(key = store.dayKey()) {
  const d = dayState(key);
  return SLOTS.filter((s) => !d[s]);
}

/** Records a kept rule. Idempotent: praying twice does not double-count. */
export function markKept(slot, key = store.dayKey()) {
  if (!SLOTS.includes(slot)) return null;
  return store.update((st) => {
    const days = st.pray.days;
    days[key] = { morning: null, evening: null, ...(days[key] || {}) };
    if (!days[key][slot]) days[key][slot] = Date.now();
    const s = streak(st);
    st.pray.streak = s;
    if (s > st.pray.best) st.pray.best = s;
  });
}

/** Consecutive complete days ending today, or yesterday if today is not done.
 *  A day only counts when both slots were kept. Half a rule is not a day. */
export function streak(state = store.get()) {
  const days = state.pray.days;
  const done = (k) => !!(days[k] && days[k].morning && days[k].evening);
  let cursor = store.dayKey();
  if (!done(cursor)) cursor = store.addDays(cursor, -1);
  let n = 0;
  while (done(cursor)) {
    n++;
    cursor = store.addDays(cursor, -1);
  }
  return n;
}

/** Slot-level streak, so a run of mornings still shows even when nights slip. */
export function slotStreak(slot) {
  const days = store.get().pray.days;
  let cursor = store.dayKey();
  if (!days[cursor]?.[slot]) cursor = store.addDays(cursor, -1);
  let n = 0;
  while (days[cursor]?.[slot]) {
    n++;
    cursor = store.addDays(cursor, -1);
  }
  return n;
}

/** Grid data for the heatmap. Oldest first, one entry per day. */
export function history(weeks = 13) {
  const days = store.get().pray.days;
  const out = [];
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const key = store.addDays(store.dayKey(), -i);
    const d = days[key] || {};
    const kept = SLOTS.filter((s) => d[s]).length;
    out.push({ key, kept, cls: kept === 2 ? 'full' : kept === 1 ? 'half' : i === 0 ? 'now' : 'none' });
  }
  return out;
}

/** Counts over a window, for the stats screen. */
export function totals(days = 30) {
  const map = store.get().pray.days;
  let full = 0;
  let morning = 0;
  let evening = 0;
  for (let i = 0; i < days; i++) {
    const d = map[store.addDays(store.dayKey(), -i)] || {};
    if (d.morning) morning++;
    if (d.evening) evening++;
    if (d.morning && d.evening) full++;
  }
  return { days, full, morning, evening, rate: days ? full / days : 0 };
}

/** Lifetime count of kept rules, which is the number worth watching early on
 *  when the streak keeps resetting. */
export function lifetime() {
  const map = store.get().pray.days;
  let n = 0;
  for (const d of Object.values(map)) n += SLOTS.filter((s) => d[s]).length;
  return n;
}

export function myPrayers(slot = null) {
  const c = store.get().pray.custom;
  return slot ? c.filter((x) => x.slot === slot) : c;
}

export function addPrayer({ slot, title, el, en }) {
  const rec = {
    id: `c_${Date.now().toString(36)}`,
    slot: SLOTS.includes(slot) ? slot : 'morning',
    title: (title || '').slice(0, 80),
    el: (el || '').slice(0, 4000),
    en: (en || '').slice(0, 4000),
  };
  if (!rec.el && !rec.en) return null;
  store.update((st) => st.pray.custom.push(rec));
  return rec;
}

export function updatePrayer(id, patch) {
  store.update((st) => {
    const p = st.pray.custom.find((x) => x.id === id);
    if (!p) return;
    if (patch.title != null) p.title = String(patch.title).slice(0, 80);
    if (patch.el != null) p.el = String(patch.el).slice(0, 4000);
    if (patch.en != null) p.en = String(patch.en).slice(0, 4000);
    if (patch.slot && SLOTS.includes(patch.slot)) p.slot = patch.slot;
  });
}

export function removePrayer(id) {
  store.update((st) => {
    st.pray.custom = st.pray.custom.filter((x) => x.id !== id);
  });
}

export function rule(slot) {
  return buildRule(slot, store.get().pray.custom);
}

export function minutes(slot) {
  return ruleMinutes(slot, store.get().pray.custom);
}

/** Puts the two reminders on Android's alarm clock, so they fire whether or not
 *  the app is running. Called at boot and whenever the times change. */
export function syncAlarms() {
  const s = store.get().pray.settings;
  const set = (id, at, title) => {
    if (!s.remind || !/^\d{2}:\d{2}$/.test(at)) return cancelAlarm(id);
    const [h, m] = at.split(':').map(Number);
    return scheduleDaily(id, h, m, 'NiFo', title);
  };
  set(ALARM_PRAY_MORNING, s.morningAt, 'Morning prayers.');
  set(ALARM_PRAY_EVENING, s.eveningAt, 'Night prayers.');
}

export { RULES };
