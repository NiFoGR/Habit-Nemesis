// The training program: what to do today, how it is scored, and when you move up.
//
// Design notes (sources in docs/KEGEL_PROGRAM.md):
//  - The pelvic floor has fast-twitch and slow-twitch fibres, so every session
//    trains both: quick flicks (~1s) and endurance holds (3s -> 15s).
//  - Rest is always at least as long as the contraction. Under-resting is the
//    single most common way people stall.
//  - Total contraction work stays well under the ~15 min/day ceiling, because
//    over-training produces a hypertonic (chronically tight) floor, which is
//    worse than not training at all.
//  - Every session ends with reverse kegels + diaphragmatic breathing so the
//    muscle learns to fully release, not just clench.
//  - Position progresses lying -> sitting -> standing -> under load, because a
//    floor that only works lying down is not much use standing up.

import * as store from './store.js';

export const LEVELS = [
  {
    n: 1,
    name: 'Find the muscle',
    weekHint: 'Week 1',
    position: 'Lying on your back, knees bent',
    flicks: { reps: 10, holdMs: 1000, restMs: 2000 },
    holds: { reps: 8, holdMs: 3000, restMs: 3000 },
    ramps: null,
    cue: 'Imagine stopping yourself from passing wind, then lifting that spot up and in. Belly, thighs and buttocks stay completely still.',
    focus: 'Isolation. Getting the right muscle is the whole job this week.',
  },
  {
    n: 2,
    name: 'Build the base',
    weekHint: 'Week 2',
    position: 'Lying on your back, knees bent',
    flicks: { reps: 10, holdMs: 1000, restMs: 2000 },
    holds: { reps: 10, holdMs: 4000, restMs: 4000 },
    ramps: null,
    cue: 'Breathe normally through every hold. If you are holding your breath, you are recruiting the wrong things.',
    focus: 'Breathing through contractions instead of bracing.',
  },
  {
    n: 3,
    name: 'Sitting up',
    weekHint: 'Week 3',
    position: 'Seated, feet flat, spine tall',
    flicks: { reps: 12, holdMs: 1000, restMs: 2000 },
    holds: { reps: 10, holdMs: 5000, restMs: 5000 },
    ramps: null,
    cue: 'Gravity is working against you now. Expect it to feel harder than lying down — that is the point.',
    focus: 'Same quality, harder position.',
  },
  {
    n: 4,
    name: 'Adding control',
    weekHint: 'Week 4',
    position: 'Seated, feet flat, spine tall',
    flicks: { reps: 12, holdMs: 1000, restMs: 2000 },
    holds: { reps: 10, holdMs: 6000, restMs: 6000 },
    ramps: { reps: 2, holdMs: 5000, restMs: 8000 },
    cue: 'On ramps, climb in five steps instead of snapping to full power, then come down the same staircase.',
    focus: 'Graded control — the difference between a switch and a dial.',
  },
  {
    n: 5,
    name: 'Endurance I',
    weekHint: 'Week 5',
    position: 'Seated or standing',
    flicks: { reps: 15, holdMs: 1000, restMs: 2000 },
    holds: { reps: 10, holdMs: 7000, restMs: 7000 },
    ramps: { reps: 3, holdMs: 5000, restMs: 8000 },
    cue: 'Aim for a flat hold, not a fade. A 7s hold that sags at second 4 scores worse than an honest 5s.',
    focus: 'Holding the line instead of leaking power.',
  },
  {
    n: 6,
    name: 'Endurance II',
    weekHint: 'Week 6',
    position: 'Standing, feet hip-width',
    flicks: { reps: 15, holdMs: 1000, restMs: 2000 },
    holds: { reps: 12, holdMs: 8000, restMs: 8000 },
    ramps: { reps: 3, holdMs: 6000, restMs: 8000 },
    cue: 'Standing recruits more of the deep system. Keep the glutes quiet.',
    focus: 'Upright strength.',
  },
  {
    n: 7,
    name: 'Power and length',
    weekHint: 'Week 7',
    position: 'Standing, feet hip-width',
    flicks: { reps: 18, holdMs: 1000, restMs: 2000 },
    holds: { reps: 12, holdMs: 9000, restMs: 9000 },
    ramps: { reps: 4, holdMs: 6000, restMs: 8000 },
    cue: 'Snap the flicks. Fast fibres only get trained if the contraction is genuinely sharp.',
    focus: 'Fast-twitch sharpness alongside endurance.',
  },
  {
    n: 8,
    name: 'The ten',
    weekHint: 'Week 8',
    position: 'Standing, feet hip-width',
    flicks: { reps: 20, holdMs: 1000, restMs: 2000 },
    holds: { reps: 12, holdMs: 10000, restMs: 10000 },
    ramps: { reps: 4, holdMs: 8000, restMs: 8000 },
    cue: 'Ten seconds is the benchmark most clinical protocols aim for. You are there.',
    focus: 'Hitting the clinical target hold.',
  },
  {
    n: 9,
    name: 'Under load',
    weekHint: 'Week 9',
    position: 'Standing; brace before a cough or a step',
    flicks: { reps: 20, holdMs: 1000, restMs: 2000 },
    holds: { reps: 14, holdMs: 10000, restMs: 10000 },
    ramps: { reps: 5, holdMs: 8000, restMs: 8000 },
    cue: 'Pre-brace: contract just before you would cough, lift or sneeze. This is the reflex you are actually building.',
    focus: 'Making the contraction automatic under pressure.',
  },
  {
    n: 10,
    name: 'Volume',
    weekHint: 'Week 10',
    position: 'Standing or walking on the spot',
    flicks: { reps: 25, holdMs: 1000, restMs: 2000 },
    holds: { reps: 14, holdMs: 12000, restMs: 12000 },
    ramps: { reps: 5, holdMs: 10000, restMs: 10000 },
    cue: 'Long holds need slow, low breathing. Set the breath first, then contract.',
    focus: 'Capacity.',
  },
  {
    n: 11,
    name: 'Peak',
    weekHint: 'Week 11',
    position: 'Standing or walking on the spot',
    flicks: { reps: 25, holdMs: 1000, restMs: 2000 },
    holds: { reps: 15, holdMs: 12000, restMs: 12000 },
    ramps: { reps: 6, holdMs: 10000, restMs: 10000 },
    cue: 'Quality over grinding. A clean rep beats a shaky one every time.',
    focus: 'Peak strength with clean form.',
  },
  {
    n: 12,
    name: 'Mastery',
    weekHint: 'Week 12+',
    position: 'Any — including mid-activity',
    flicks: { reps: 30, holdMs: 1000, restMs: 2000 },
    holds: { reps: 15, holdMs: 15000, restMs: 15000 },
    ramps: { reps: 6, holdMs: 10000, restMs: 10000 },
    cue: 'From here it is maintenance: keep this up 3-4x a week and you keep the gains.',
    focus: 'Maintenance for life.',
  },
];

export const MAX_LEVEL = LEVELS.length;
export const PROMOTION_TARGET = 3; // qualifying sessions needed to level up

export function levelDef(n) {
  return LEVELS[Math.min(Math.max(n, 1), MAX_LEVEL) - 1];
}

/* ---------------- session building ---------------- */

const breathStep = (label, ms, cue) => ({ kind: 'breath', label, targetMs: ms, cue });

/** Builds the ordered list of steps for a session.
 *  A deload trims hold targets by 25% without changing rep counts, so a bad
 *  week reduces intensity rather than breaking the habit. */
export function buildSession({ level, type = 'training', deload = false }) {
  const def = levelDef(level);
  const scale = deload ? 0.75 : 1;
  const steps = [];

  const warmup = () => {
    steps.push({ kind: 'title', label: 'Warm up', sub: def.position });
    for (let i = 0; i < 2; i++) {
      steps.push(breathStep('Breathe in — let the floor drop', 4000, 'Belly widens. Pelvic floor lengthens and softens.'));
      steps.push(breathStep('Breathe out — let it come back', 6000, 'No effort. You are only teaching it to release.'));
    }
  };

  const cooldown = () => {
    steps.push({ kind: 'title', label: 'Release', sub: 'The part everyone skips' });
    for (let i = 0; i < 3; i++) {
      steps.push({
        kind: 'reverse',
        label: 'Reverse kegel',
        targetMs: 5000,
        cue: 'Gently push down and out, like the start of a slow exhale. Never strain.',
      });
      steps.push({ kind: 'rest', label: 'Rest', targetMs: 4000 });
    }
    steps.push(breathStep('Final breath', 6000, 'Fully relaxed. Session done.'));
  };

  if (type === 'release') {
    // Weekly down-training day: no strengthening at all, on purpose.
    steps.push({ kind: 'title', label: 'Release day', sub: 'Down-training — no strengthening today' });
    for (let i = 0; i < 4; i++) {
      steps.push(breathStep('Breathe in — lengthen', 4000, 'Feel the floor drop as the belly expands.'));
      steps.push(breathStep('Breathe out — stay soft', 6000, 'Do not contract on the way out.'));
    }
    cooldown();
    return { level, type, steps, def };
  }

  if (type === 'test') {
    steps.push({ kind: 'title', label: 'Max hold test', sub: 'Hold as long as you honestly can' });
    steps.push(breathStep('Settle the breath', 5000, 'Slow and low.'));
    steps.push({
      kind: 'max',
      label: 'Max hold — go',
      targetMs: 60000,
      cue: 'Hold until it genuinely fades, then release. Do not fake it — this number sets your baseline.',
    });
    cooldown();
    return { level, type, steps, def };
  }

  warmup();

  steps.push({ kind: 'title', label: 'Quick flicks', sub: `${def.flicks.reps} sharp contractions — fast-twitch fibres` });
  for (let i = 0; i < def.flicks.reps; i++) {
    steps.push({ kind: 'flick', label: 'Squeeze', targetMs: def.flicks.holdMs, rep: i + 1, of: def.flicks.reps, cue: 'Sharp on, sharp off.' });
    steps.push({ kind: 'rest', label: 'Let go', targetMs: def.flicks.restMs });
  }

  const holdMs = Math.round((def.holds.holdMs * scale) / 500) * 500;
  const restMs = Math.max(holdMs, Math.round(def.holds.restMs * scale));
  steps.push({
    kind: 'title',
    label: 'Endurance holds',
    sub: `${def.holds.reps} × ${(holdMs / 1000).toFixed(0)}s — slow-twitch fibres`,
  });
  for (let i = 0; i < def.holds.reps; i++) {
    steps.push({ kind: 'hold', label: 'Hold', targetMs: holdMs, rep: i + 1, of: def.holds.reps, cue: def.cue });
    steps.push({ kind: 'rest', label: 'Full release', targetMs: restMs });
  }

  if (def.ramps) {
    const rampHold = Math.round((def.ramps.holdMs * scale) / 500) * 500;
    steps.push({ kind: 'title', label: 'Ramps', sub: 'Climb in 5 steps, hold, come down in 5' });
    for (let i = 0; i < def.ramps.reps; i++) {
      steps.push({
        kind: 'ramp',
        label: 'Ramp up and hold',
        targetMs: rampHold + 5000,
        rampMs: 5000,
        rep: i + 1,
        of: def.ramps.reps,
        cue: 'Up the staircase, hold at the top, then down one step at a time.',
      });
      steps.push({ kind: 'rest', label: 'Rest', targetMs: def.ramps.restMs });
    }
  }

  cooldown();
  return { level, type, steps, def };
}

/** Work steps are the ones that get scored. */
export const isWorkStep = (s) => ['flick', 'hold', 'ramp', 'max'].includes(s.kind);

export function estimateDurationMs(session) {
  return session.steps.reduce((ms, s) => ms + (s.kind === 'title' ? 1200 : s.targetMs || 0), 0);
}

/* ---------------- what to do right now ---------------- */

export function planForToday(state = store.get()) {
  const { program, settings } = state;
  const today = store.todaysSessions();
  const isRestDay = new Date().getDay() === settings.restDay;
  const total = state.sessions.length;

  // A max-hold test every 7th session gives an honest strength datapoint that
  // is not confounded by the prescribed target.
  const dueForTest = total > 0 && total % 7 === 0 && !today.some((s) => s.type === 'test');

  let type = 'training';
  if (isRestDay) type = 'release';
  else if (dueForTest) type = 'test';

  const doneToday = today.filter((s) => s.type !== 'release').length;
  const target = isRestDay ? 1 : settings.dailyTarget;

  return {
    type,
    level: program.level,
    deload: program.deload > 0,
    doneToday: today.length,
    target,
    complete: today.length >= target,
    bonus: doneToday >= target,
    isRestDay,
  };
}

/* ---------------- scoring ---------------- */

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Turns the raw per-rep record into a 0-100 session score.
 *  completion  — did you do the reps you were asked for       (40)
 *  fidelity    — did you actually hold for as long as the target (40)
 *  consistency — was rep 12 as good as rep 1, i.e. fatigue resistance (20)
 *
 *  Fidelity credits each rep at most 100% of its target, so holding some reps
 *  long can never paper over reps you cut short. Genuinely exceeding the target
 *  is rewarded separately, and only when nothing fell short — otherwise the
 *  honest way to a high score would be to overhold a few and bail on the rest.
 */
export function scoreSession(reps, { estimated = false } = {}) {
  const scored = reps.filter((r) => r.kind !== 'max');
  if (!scored.length) {
    return { score: 0, completion: 0, fidelity: 0, consistency: 0, estimated };
  }
  const done = scored.filter((r) => r.actualMs > 250);
  const completion = done.length / scored.length;

  const raw = scored.map((r) => (r.actualMs > 250 ? r.actualMs / r.targetMs : 0));
  const capped = raw.map((v) => clamp(v, 0, 1));
  const fidelity = capped.reduce((a, b) => a + b, 0) / capped.length;

  let consistency = 0;
  if (capped.length > 1) {
    const variance = capped.reduce((a, r) => a + (r - fidelity) ** 2, 0) / capped.length;
    consistency = clamp(1 - Math.sqrt(variance) * 2.2, 0, 1);
  } else {
    consistency = capped[0] >= 0.9 ? 1 : 0.6;
  }

  // Overhold bonus: up to +5, and only if every prescribed rep landed on target.
  const clean = raw.every((v) => v >= 0.98);
  const bonus = clean ? clamp((raw.reduce((a, b) => a + b, 0) / raw.length - 1) * 25, 0, 5) : 0;

  const score = Math.round(clamp(completion * 40 + fidelity * 40 + consistency * 20 + bonus, 0, 100));
  return { score, completion, fidelity, consistency, estimated };
}

/** Hands-free mode has no per-rep data, so the self-rating stands in for it —
 *  flagged as estimated everywhere it is displayed. */
export function scoreFromRating(rating) {
  const map = { easy: 94, solid: 86, hard: 74, failed: 52 };
  const score = map[rating] ?? 75;
  return { score, completion: rating === 'failed' ? 0.7 : 1, fidelity: score / 100, consistency: score / 100, estimated: true };
}

export function grade(score) {
  if (score >= 93) return { letter: 'S', label: 'Flawless' };
  if (score >= 85) return { letter: 'A', label: 'Strong' };
  if (score >= 75) return { letter: 'B', label: 'Solid' };
  if (score >= 62) return { letter: 'C', label: 'Getting there' };
  if (score > 0) return { letter: 'D', label: 'Rough one' };
  return { letter: '–', label: 'Logged' };
}

/* ---------------- progression ---------------- */

/** Decides what the session did to your level. Returns a description of the
 *  change so the report can explain it in words. */
export function applyProgression(state, session) {
  const p = state.program;
  const outcome = { levelUp: false, deloaded: false, from: p.level, to: p.level, qualifying: p.qualifying };

  if (session.type === 'release') return outcome; // rest days never move the needle

  if (p.deload > 0) p.deload = Math.max(0, p.deload - 1);

  if (session.discomfort) {
    // Pain is a stop sign, not a challenge. Back off immediately.
    p.deload = 3;
    p.qualifying = 0;
    outcome.deloaded = true;
    outcome.qualifying = 0;
    return outcome;
  }

  const qualified = session.score >= 80 && session.completion >= 0.99;
  if (qualified) {
    p.qualifying++;
    if (p.qualifying >= PROMOTION_TARGET && p.level < MAX_LEVEL) {
      p.level++;
      p.qualifying = 0;
      p.history.push({ level: p.level, at: Date.now() });
      outcome.levelUp = true;
      outcome.to = p.level;
    }
  } else if (session.score < 55) {
    p.qualifying = 0;
    // The session being scored is not in state.sessions yet, so "the previous
    // one was also bad" means two in a row counting this one.
    const previous = state.sessions.filter((s) => s.type !== 'release').slice(-1)[0];
    if (previous && previous.score < 55) {
      p.deload = 2;
      outcome.deloaded = true;
    }
  }
  outcome.qualifying = p.qualifying;
  return outcome;
}

/* ---------------- composite strength index ---------------- */

/** PFI is a single 0-1000 number so progress is legible at a glance:
 *  strength (best hold) + capacity (recent volume) + level + adherence. */
export function pfi(state = store.get()) {
  const maxHold = state.prs.maxHoldMs || 0;
  const strength = clamp(maxHold / 30000, 0, 1) * 300;

  const cutoff = Date.now() - 7 * 864e5;
  const weekTut = state.sessions.filter((s) => s.ts >= cutoff).reduce((a, s) => a + (s.totals?.tutMs || 0), 0);
  const capacity = clamp(weekTut / (12 * 60000), 0, 1) * 200;

  const lvl = ((state.program.level - 1) / (MAX_LEVEL - 1)) * 300;

  const days = new Set(state.sessions.filter((s) => s.ts >= Date.now() - 14 * 864e5).map((s) => s.date));
  const adherence = clamp(days.size / 12, 0, 1) * 200;

  return Math.round(strength + capacity + lvl + adherence);
}

export function pfiBand(v) {
  if (v >= 850) return 'Elite';
  if (v >= 650) return 'Advanced';
  if (v >= 430) return 'Intermediate';
  if (v >= 220) return 'Developing';
  return 'Beginner';
}

/* ---------------- badges ---------------- */

export const BADGES = [
  { id: 'first', name: 'First rep', desc: 'Completed your first session', test: (s) => s.sessions.length >= 1 },
  { id: 'week', name: '7-day streak', desc: 'Seven days in a row', test: (s) => store.streak() >= 7 },
  { id: 'fortnight', name: '14-day streak', desc: 'Two full weeks', test: (s) => store.streak() >= 14 },
  { id: 'month', name: '30-day streak', desc: 'A month without missing', test: (s) => store.streak() >= 30 },
  { id: 'ten', name: 'The ten-second club', desc: 'Held a contraction for 10s+', test: (s) => s.prs.maxHoldMs >= 10000 },
  { id: 'twenty', name: 'Twenty', desc: 'Held a contraction for 20s+', test: (s) => s.prs.maxHoldMs >= 20000 },
  { id: 'perfect', name: 'Flawless', desc: 'Scored 95 or above', test: (s) => s.prs.score >= 95 },
  { id: 'thousand', name: '1,000 contractions', desc: 'A thousand lifetime reps', test: (s) => store.totals().contractions >= 1000 },
  { id: 'halfway', name: 'Halfway', desc: 'Reached level 6', test: (s) => s.program.level >= 6 },
  { id: 'mastery', name: 'Mastery', desc: 'Reached level 12', test: (s) => s.program.level >= MAX_LEVEL },
  { id: 'rested', name: 'Knows when to stop', desc: 'Completed a release day', test: (s) => s.sessions.some((x) => x.type === 'release') },
];

export function checkBadges(state) {
  const earned = [];
  for (const b of BADGES) {
    if (state.badges.includes(b.id)) continue;
    try {
      if (b.test(state)) {
        state.badges.push(b.id);
        earned.push(b);
      }
    } catch {
      /* a badge test should never break a save */
    }
  }
  return earned;
}
