// The wind-down: paced breathing, and the last thing in the day.
//
// The lever this pulls is vagal. An exhale that runs longer than the inhale,
// at somewhere near six breaths a minute, is what actually shifts you out of
// sympathetic arousal, and falling asleep already there is the difference
// between sleeping and lying in the dark waiting to. Everything here serves
// that one mechanism: the patterns are all slow, two of the three are
// exhale-weighted, and every session opens with physiological sighs because
// they drop arousal faster than anything else you can do voluntarily.
//
// There is no score and no grading, for exactly the reason the prayer rule has
// none. This is the last thing before sleep. Being marked out of ten at 23:00
// is the opposite of the point, so the app records that it was done and stops
// there.

import * as store from '../store.js';
import { scheduleDaily, cancelAlarm, ALARM_BREATHE } from '../native.js';

/* ---------------- the patterns ---------------- */

/** Three, and no more. Every extra pattern is a decision to make at bedtime,
 *  which is the worst time to be offered one. */
export const PATTERNS = {
  exhale: {
    id: 'exhale',
    label: 'Extended exhale',
    short: '4 in, 8 out',
    inMs: 4000,
    holdMs: 0,
    outMs: 8000,
    blurb: 'Twice as long out as in. The strongest of the three for coming down, and the easiest to hold for five minutes without thinking about it.',
  },
  coherent: {
    id: 'coherent',
    label: 'Coherent',
    short: '5.5 in, 5.5 out',
    inMs: 5500,
    holdMs: 0,
    outMs: 5500,
    blurb: 'Even breaths, about six a minute. Heart rate rises and falls in step with the breath, which is where heart-rate variability peaks.',
  },
  '478': {
    id: '478',
    label: '4-7-8',
    short: '4 in, 7 hold, 8 out',
    inMs: 4000,
    holdMs: 7000,
    outMs: 8000,
    blurb: 'Weil’s pattern. The held breath settles some people and makes others tense, so try it a few times before you commit to it.',
  },
};

// Listed rather than taken from Object.keys: '478' is an integer-like key, so
// JavaScript enumerates it before every string key and the picker came out
// offering 4-7-8 first, which is the one pattern that does not suit everybody.
export const PATTERN_IDS = ['exhale', 'coherent', '478'];

export const MIN_MINUTES = 3;
export const MAX_MINUTES = 20;

/** The opening. Two inhales stacked on top of each other and then a long
 *  release: the physiological sigh, which reinflates collapsed alveoli and
 *  offloads CO2 in one breath. It is the fastest voluntary way down, so it
 *  goes at the front where it can do the most good. */
const SIGHS = 3;
const SIGH = [
  { kind: 'in', ms: 1700, label: 'Breathe in', sub: 'Through the nose' },
  { kind: 'in', ms: 900, label: 'Sip more air', sub: 'A second short breath, stacked on top', stack: true },
  { kind: 'out', ms: 6000, label: 'Let it go', sub: 'Slowly, through the mouth' },
];

/** The timeline, as absolute offsets from the start.
 *
 *  Precomputed the way `pocket.js` does it, and for the same reason: every
 *  tick is then resolved against the wall clock, so a throttled timer lands on
 *  the phase you should actually be on instead of resuming where it paused.
 *  A pacer that drifts is worse than no pacer, and it drifts silently. */
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

  // Whole breaths only. Cutting off mid-exhale to hit a round number would end
  // the session on the one phase you want it to end after.
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

/** What a session of this length will actually run to, which is not the
 *  setting: the last whole breath decides. */
export function plannedMs(patternId, minutes) {
  return buildTimeline(patternId, minutes * 60000).totalMs;
}

/* ---------------- the record ---------------- */

export function settings() {
  return store.get().breathe.settings;
}

/** One entry per day, because this is a once-a-day close. Doing it twice adds
 *  the time rather than counting as two, since there is nothing to count. */
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

/** Consecutive days ending today, or yesterday if tonight has not happened
 *  yet. A wind-down at 00:30 belongs to the day it was done, like everything
 *  else here, which does mean a very late night lands on the next day. That is
 *  the honest reading: you did it after midnight. */
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

/** Grid data for the heatmap. Oldest first, one entry per day. */
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
      cls: !d ? (i === 0 ? 'today' : 'none') : mins >= 10 ? 'l4' : mins >= 5 ? 'l3' : mins >= 3 ? 'l2' : 'l1',
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

/** The nightly reminder, on Android's alarm clock so it fires whether or not
 *  the app is running. Called at boot and whenever the time changes. */
export function syncAlarm() {
  const s = settings();
  if (!s.remind || !/^\d{2}:\d{2}$/.test(s.remindAt)) return cancelAlarm(ALARM_BREATHE);
  const [h, m] = s.remindAt.split(':').map(Number);
  return scheduleDaily(ALARM_BREATHE, h, m, 'NiFo', 'Wind down before bed.');
}
