// The wind-down: paced breathing, last thing at night.
//
// The lever is vagal: an exhale longer than the inhale, near six breaths a
// minute. Every pattern is slow, two of three are exhale-weighted, and each
// session opens with physiological sighs, which drop arousal faster than
// anything else voluntary.
//
// No score. Being marked out of ten at 23:00 is the opposite of the point.

import * as store from '../store.js';
import { scheduleDaily, cancelAlarm, ALARM_BREATHE } from '../native.js';

/* ---------------- the patterns ---------------- */

/** Three, and no more: an extra pattern is a decision to make at bedtime. */
export const PATTERNS = {
  exhale: {
    id: 'exhale',
    label: 'Long exhale',
    short: '4 in, 8 out',
    inMs: 4000,
    holdMs: 0,
    outMs: 8000,
    blurb: 'Twice as long out as in. The strongest of the three for coming down.',
  },
  coherent: {
    id: 'coherent',
    label: 'Coherent',
    short: '5.5 in, 5.5 out',
    inMs: 5500,
    holdMs: 0,
    outMs: 5500,
    blurb: 'Even breaths, about six a minute. Where heart-rate variability peaks.',
  },
  '478': {
    id: '478',
    label: '4-7-8',
    short: '4 in, 7 hold, 8 out',
    inMs: 4000,
    holdMs: 7000,
    outMs: 8000,
    blurb: 'Weil’s pattern. The held breath settles some people and tenses others.',
  },
};

// Listed, not Object.keys: '478' is integer-like and enumerates first, which
// put 4-7-8 at the head of the picker.
export const PATTERN_IDS = ['exhale', 'coherent', '478'];

export const MIN_MINUTES = 3;
export const MAX_MINUTES = 20;

/** The physiological sigh: two stacked inhales and a long release. The fastest
 *  voluntary way down, so it goes at the front. */
const SIGHS = 3;
const SIGH = [
  { kind: 'in', ms: 1700, label: 'Breathe in', sub: 'Through the nose' },
  { kind: 'in', ms: 900, label: 'Sip more air', sub: 'A second short breath, stacked on top', stack: true },
  { kind: 'out', ms: 6000, label: 'Let it go', sub: 'Slowly, through the mouth' },
];

/** Absolute offsets from the start, like pocket.js: every tick resolves against
 *  the wall clock, so a throttled timer lands on the right phase. */
export function buildTimeline(patternId = 'exhale', totalMs = 300000) {
  const p = PATTERNS[patternId] || PATTERNS.exhale;
  const steps = [];
  let at = 0;
  const push = (s) => {
    steps.push({ ...s, from: at, to: at + s.ms });
    at += s.ms;
  };

  push({ kind: 'settle', ms: 5000, label: 'Settle', sub: 'Phone on your chest, eyes closed' });
  for (let i = 0; i < SIGHS; i++) for (const s of SIGH) push({ ...s, sigh: true });

  // Whole breaths only: cutting mid-exhale ends on the wrong phase.
  const breathMs = p.inMs + p.holdMs + p.outMs;
  let n = 0;
  while (at + breathMs <= totalMs) {
    const first = n === 0;
    push({ kind: 'in', ms: p.inMs, label: 'Breathe in', sub: first ? 'Into the belly, not the chest' : '' });
    if (p.holdMs) push({ kind: 'hold', ms: p.holdMs, label: 'Hold', sub: first ? 'Loosely. Do not brace' : '' });
    push({ kind: 'out', ms: p.outMs, label: 'Breathe out', sub: first && p.outMs > p.inMs ? 'Longer than you came in' : '' });
    n++;
  }

  return { steps, totalMs: at, pattern: p, breaths: n };
}

/* ---------------- the record ---------------- */

export function settings() {
  return store.get().breathe.settings;
}

/** One entry per day. Twice adds the time rather than counting as two. */
export function dayState(key = store.dayKey()) {
  const d = store.get().breathe.days[key];
  return { key, done: !!d, at: d?.at || null, ms: d?.ms || 0, pattern: d?.pattern || null };
}

export function markDone({ ms, pattern }) {
  return store.update((st) => {
    const key = store.dayKey();
    const days = st.breathe.days;
    if (!days[key]) days[key] = { at: Date.now(), ms: 0, pattern };
    days[key].ms += Math.max(0, Math.round(ms));
    days[key].pattern = pattern;
    const s = streak(st);
    st.breathe.streak = s;
    if (s > st.breathe.best) st.breathe.best = s;
  });
}

/** Consecutive days, ending today or yesterday. A wind-down at 00:30 lands on
 *  the day it was done. */
export function streak(state = store.get()) {
  const days = state.breathe.days;
  let cursor = store.dayKey();
  if (!days[cursor]) cursor = store.addDays(cursor, -1);
  let n = 0;
  while (days[cursor]) {
    n++;
    cursor = store.addDays(cursor, -1);
  }
  return n;
}

/** Heatmap data, oldest first. */
export function history(weeks = 13) {
  const days = store.get().breathe.days;
  const out = [];
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const key = store.addDays(store.dayKey(), -i);
    const d = days[key];
    const mins = d ? d.ms / 60000 : 0;
    out.push({
      key,
      ms: d?.ms || 0,
      cls: !d ? (i === 0 ? 'now' : 'none') : mins >= 10 ? 'l4' : mins >= 5 ? 'l3' : mins >= 3 ? 'l2' : 'l1',
    });
  }
  return out;
}

export function totals(days = 30) {
  const map = store.get().breathe.days;
  let done = 0;
  let ms = 0;
  for (let i = 0; i < days; i++) {
    const d = map[store.addDays(store.dayKey(), -i)];
    if (d) {
      done++;
      ms += d.ms;
    }
  }
  return { days, done, ms, rate: days ? done / days : 0 };
}

export function lifetime() {
  const map = store.get().breathe.days;
  let nights = 0;
  let ms = 0;
  for (const d of Object.values(map)) {
    nights++;
    ms += d.ms || 0;
  }
  return { nights, ms };
}

/** The nightly reminder, as a real alarm. */
export function syncAlarm() {
  const s = settings();
  if (!s.remind || !/^\d{2}:\d{2}$/.test(s.remindAt)) return cancelAlarm(ALARM_BREATHE);
  const [h, m] = s.remindAt.split(':').map(Number);
  return scheduleDaily(ALARM_BREATHE, h, m, 'NiFo', 'Wind down before bed.');
}
