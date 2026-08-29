// The training program: what to do today, how it is scored, when you move up.
//
// Sources in docs/KEGEL_PROGRAM.md. The rules it encodes:
//   Fast and slow fibres both, so every session has flicks and holds.
//   Rest is at least as long as the contraction.
//   Work stays under the ~15 min/day ceiling: over-training makes a floor
//   hypertonic, which is worse than not training.
//   Every session ends in reverse kegels and breathing, so it learns to release.
//   Position climbs lying, sitting, standing, under load.

import * as store from '../store.js';

/* ----------------- the 2-year ladder ----------------- */

const PHASES = [
  {
    id: 'foundation', name: 'Foundation', from: 1, to: 8,
    position: 'Lying on your back, knees bent',
    focus: 'Isolate the right muscle. Nothing else should move.',
    cues: [
      'Imagine stopping yourself from passing wind, then lifting that spot up and in.',
      'Belly, thighs and buttocks stay completely still. Only the floor moves.',
      'Breathe normally through every hold. Holding your breath means you are bracing, not contracting.',
      'Put a hand on your belly. If it tightens, you are using the wrong muscles.',
    ],
  },
  {
    id: 'control', name: 'Control', from: 9, to: 20,
    position: 'Seated, feet flat, spine tall',
    focus: 'Same quality sitting up, and graded control rather than on/off.',
    cues: [
      'Gravity works against you sitting. Expect it to feel harder than lying down.',
      'Climb in steps rather than snapping to full power, then come down the same staircase.',
      'A slow release is as much a skill as the squeeze. Do not just let go.',
      'Aim for a flat hold, not a fade.',
    ],
  },
  {
    id: 'strength', name: 'Strength', from: 21, to: 40,
    position: 'Standing, feet hip-width',
    focus: 'Upright strength. This is where the numbers start moving properly.',
    cues: [
      'Standing recruits more of the deep system. Keep the glutes quiet.',
      'Full effort on the squeeze, full release between. Half-rest gives you half the adaptation.',
      'If rep ten is much weaker than rep one, take longer rests rather than pushing through.',
      'Lift up and in, not down and out. Down is the reverse kegel.',
    ],
  },
  {
    id: 'endurance', name: 'Endurance', from: 41, to: 64,
    position: 'Standing, or walking on the spot',
    focus: 'Holding tone for longer, which is what shows up in daily life.',
    cues: [
      'Long holds need slow, low breathing. Set the breath first, then contract.',
      'The last three seconds of a long hold are the ones that count.',
      'Keep the jaw and shoulders loose. Tension there leaks into everything else.',
      'Consistency beats intensity now. Every session is a deposit.',
    ],
  },
  {
    id: 'power', name: 'Power', from: 65, to: 84,
    position: 'Standing; brace before a cough, lift or step',
    focus: 'Fast, automatic response under pressure. The reflex that matters.',
    cues: [
      'Pre-brace: contract just before you would cough, lift or sneeze.',
      'Snap the flicks. Fast fibres only train if the contraction is genuinely sharp.',
      'Pulses are about speed, not force. Light and quick.',
      'Power is the ability to switch on instantly, then switch fully off.',
    ],
  },
  {
    id: 'mastery', name: 'Mastery', from: 85, to: 104,
    position: 'Any position, including mid-activity',
    focus: 'Everything at once, and holding it for life.',
    cues: [
      'Mix positions within the session. The floor should work anywhere.',
      'Quality over grinding. A clean rep beats a shaky one every time.',
      'From here it is maintenance: three or four sessions a week keeps the gains.',
      'You have been doing this for over a year. That is the whole trick.',
    ],
  },
];

export const TOTAL_WEEKS = 104;

const phaseFor = (n) => PHASES.find((p) => n >= p.from && n <= p.to) || PHASES[PHASES.length - 1];
const round500 = (ms) => Math.round(ms / 500) * 500;

/** One week. Every fourth is a deload. */
function makeLevel(n) {
  const phase = phaseFor(n);
  const t = (n - 1) / (TOTAL_WEEKS - 1); // 0 at week 1, 1 at week 104
  const deload = n % 4 === 0;
  const soft = deload ? 0.7 : 1;
  const softReps = deload ? 0.8 : 1;

  // 3s to 20s. Past twenty a hold stops paying, so later years buy overload from
  // reps, ramps and pulses.
  const holdMs = round500((3000 + 17000 * Math.pow(t, 0.85)) * soft);
  const holdReps = Math.max(6, Math.round((8 + 12 * t) * softReps));
  const flickReps = Math.max(8, Math.round((10 + 20 * t) * softReps));
  const rampReps = n >= 13 ? Math.max(0, Math.round((2 + 4 * t) * softReps)) : 0;
  const rampMs = round500((5000 + 7000 * t) * soft);
  const pulseSets = n >= 49 && !deload ? (n >= 85 ? 2 : 1) : 0;

  return {
    n,
    name: deload ? `${phase.name} · deload` : phase.name,
    phase: phase.id,
    weekHint: `Week ${n} of ${TOTAL_WEEKS}`,
    position: phase.position,
    focus: deload ? 'Lighter week on purpose. Tissue adapts during the easy weeks.' : phase.focus,
    cue: phase.cues[(n - 1) % phase.cues.length],
    deloadWeek: deload,
    flicks: { reps: flickReps, holdMs: 1000, restMs: 2000 },
    holds: { reps: holdReps, holdMs, restMs: holdMs },
    ramps: rampReps ? { reps: rampReps, holdMs: rampMs, restMs: Math.max(8000, rampMs) } : null,
    pulses: pulseSets ? { sets: pulseSets, reps: 10, holdMs: 500, restMs: 500 } : null,
  };
}

export const LEVELS = Array.from({ length: TOTAL_WEEKS }, (_, i) => makeLevel(i + 1));
export { PHASES };

export const MAX_LEVEL = LEVELS.length;
export const PROMOTION_TARGET = 3; // qualifying sessions needed to level up
// A level is a week. Without a minimum served, two good days would collapse
// the two-year plan into months.
export const MIN_DAYS_PER_LEVEL = 6;

/** Days still to serve before promotion is possible. */
export function daysUntilEligible(state = store.get()) {
  const started = state.program.levelStartedAt || state.program.startedAt || Date.now();
  return Math.max(0, Math.ceil(MIN_DAYS_PER_LEVEL - (Date.now() - started) / 864e5));
}

export function levelDef(n) {
  return LEVELS[Math.min(Math.max(n, 1), MAX_LEVEL) - 1];
}

/* ---------------- session building ---------------- */

const breathStep = (label, ms, cue) => ({ kind: 'breath', label, targetMs: ms, cue });

/** The ordered steps for a session. A deload trims hold targets by 25% and
 *  leaves rep counts alone. */
export function buildSession({ level, type = 'training', deload = false }) {
  const def = levelDef(level);
  const scale = deload ? 0.75 : 1;
  const steps = [];

  const warmup = () => {
    steps.push({ kind: 'title', label: 'Warm up', sub: def.position });
    for (let i = 0; i < 2; i++) {
      steps.push(breathStep('Breathe in, let the floor drop', 4000, 'Belly widens. Pelvic floor lengthens and softens.'));
      steps.push(breathStep('Breathe out, let it come back', 6000, 'No effort. You are only teaching it to release.'));
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
    // Weekly down-training day: no strengthening at all.
    steps.push({ kind: 'title', label: 'Release day', sub: 'Down-training only' });
    for (let i = 0; i < 4; i++) {
      steps.push(breathStep('Breathe in, lengthen', 4000, 'Feel the floor drop as the belly expands.'));
      steps.push(breathStep('Breathe out, stay soft', 6000, 'Do not contract on the way out.'));
    }
    cooldown();
    return { level, type, steps, def };
  }

  if (type === 'quick') {
    // 90-second fallback for a day falling apart. Keeps the streak honest.
    steps.push({ kind: 'title', label: 'Quick session', sub: def.position });
    for (let i = 0; i < 5; i++) {
      steps.push({ kind: 'flick', label: 'Squeeze', targetMs: 1000, rep: i + 1, of: 5, cue: 'Sharp on, sharp off.' });
      steps.push({ kind: 'rest', label: 'Let go', targetMs: 1500 });
    }
    for (let i = 0; i < 5; i++) {
      steps.push({ kind: 'hold', label: 'Hold', targetMs: 3000, rep: i + 1, of: 5, cue: def.cue });
      steps.push({ kind: 'rest', label: 'Full release', targetMs: 3000 });
    }
    steps.push({ kind: 'reverse', label: 'Reverse kegel', targetMs: 5000, cue: 'Gently push down and out. Never strain.' });
    return { level, type, steps, def };
  }

  if (type === 'test') {
    steps.push({ kind: 'title', label: 'Max hold test', sub: 'Hold as long as you honestly can' });
    steps.push(breathStep('Settle the breath', 5000, 'Slow and low.'));
    steps.push({
      kind: 'max',
      label: 'Max hold, go',
      targetMs: 60000,
      cue: 'Hold until it genuinely fades, then release. Do not fake it. This number sets your baseline.',
    });
    cooldown();
    return { level, type, steps, def };
  }

  warmup();

  steps.push({ kind: 'title', label: 'Quick flicks', sub: `${def.flicks.reps} sharp contractions, fast-twitch` });
  for (let i = 0; i < def.flicks.reps; i++) {
    steps.push({ kind: 'flick', label: 'Squeeze', targetMs: def.flicks.holdMs, rep: i + 1, of: def.flicks.reps, cue: 'Sharp on, sharp off.' });
    steps.push({ kind: 'rest', label: 'Let go', targetMs: def.flicks.restMs });
  }

  // A target over ~60% of your tested max is one you cannot hold, so it is
  // capped. The ladder still controls progression.
  const tested = store.get().prs.maxHoldMs;
  const ceiling = tested ? Math.max(3000, Math.round(tested * 0.6)) : Infinity;
  const holdMs = Math.min(Math.round((def.holds.holdMs * scale) / 500) * 500, ceiling);
  const restMs = Math.max(holdMs, Math.round(def.holds.restMs * scale));
  steps.push({
    kind: 'title',
    label: 'Endurance holds',
    sub: `${def.holds.reps} × ${(holdMs / 1000).toFixed(0)}s, slow-twitch`,
  });
  for (let i = 0; i < def.holds.reps; i++) {
    steps.push({ kind: 'hold', label: 'Hold', targetMs: holdMs, rep: i + 1, of: def.holds.reps, cue: def.cue });
    steps.push({ kind: 'rest', label: 'Full release', targetMs: restMs });
  }

  if (def.pulses) {
    steps.push({ kind: 'title', label: 'Pulses', sub: `${def.pulses.sets} × ${def.pulses.reps} rapid, speed not force` });
    for (let set = 0; set < def.pulses.sets; set++) {
      for (let i = 0; i < def.pulses.reps; i++) {
        steps.push({ kind: 'flick', label: 'Pulse', targetMs: def.pulses.holdMs, rep: i + 1, of: def.pulses.reps, cue: 'Light and quick. On, off, on, off.' });
        steps.push({ kind: 'rest', label: 'Off', targetMs: def.pulses.restMs });
      }
      if (set < def.pulses.sets - 1) steps.push({ kind: 'rest', label: 'Between sets', targetMs: 20000 });
    }
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

/** Work steps are the scored ones. */
export const isWorkStep = (s) => ['flick', 'hold', 'ramp', 'max'].includes(s.kind);

/* ---------------- what to do right now ---------------- */

export function planForToday(state = store.get()) {
  const { program, settings } = state;
  const today = store.todaysSessions();
  const isRestDay = new Date().getDay() === settings.restDay;
  const total = state.sessions.length;

  // Every 7th session is a max-hold test, unconfounded by a target.
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

/** 0-100 from completion (40), fidelity (40), consistency (20).
 *  Fidelity credits each rep at most 100% of target, so long reps cannot paper
 *  over short ones. Exceeding is rewarded separately, and only if nothing fell
 *  short. */
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

  // Overhold bonus, up to +5, only if every prescribed rep landed.
  const clean = raw.every((v) => v >= 0.98);
  const bonus = clean ? clamp((raw.reduce((a, b) => a + b, 0) / raw.length - 1) * 25, 0, 5) : 0;

  const score = Math.round(clamp(completion * 40 + fidelity * 40 + consistency * 20 + bonus, 0, 100));
  return { score, completion, fidelity, consistency, estimated };
}

/** Hands-free has no per-rep data, so the self-rating stands in. Flagged
 *  estimated everywhere. */
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

/** What the session did to your level, described so the report can say it. */
export function applyProgression(state, session) {
  const p = state.program;
  const outcome = { levelUp: false, deloaded: false, from: p.level, to: p.level, qualifying: p.qualifying };

  if (session.type === 'release') return outcome; // rest days never move the needle

  if (p.deload > 0) p.deload = Math.max(0, p.deload - 1);

  if (session.discomfort) {
    // Pain is a stop sign. Back off immediately.
    p.deload = 3;
    p.qualifying = 0;
    outcome.deloaded = true;
    outcome.qualifying = 0;
    return outcome;
  }

  if (session.type === 'quick') return outcome; // keeps the day, never promotes

  const qualified = session.score >= 80 && session.completion >= 0.99;
  if (qualified) {
    p.qualifying++;
    // Promotion needs time served as well as good sessions.
    const daysHere = (Date.now() - (p.levelStartedAt || p.startedAt || Date.now())) / 864e5;
    outcome.daysHere = daysHere;
    if (p.qualifying >= PROMOTION_TARGET && daysHere >= MIN_DAYS_PER_LEVEL && p.level < MAX_LEVEL) {
      p.level++;
      p.qualifying = 0;
      p.levelStartedAt = Date.now();
      p.history.push({ level: p.level, at: Date.now() });
      outcome.levelUp = true;
      outcome.to = p.level;
    }
  } else if (session.score < 55) {
    p.qualifying = 0;
    // This session is not in state.sessions yet, so "the previous was also bad"
    // means two in a row counting this one. Pump-cadence sessions carry no score.
    const previous = state.sessions.filter((s) => s.type !== 'release' && s.countsForPromotion !== false).slice(-1)[0];
    if (previous && previous.score < 55) {
      p.deload = 2;
      outcome.deloaded = true;
    }
  }
  outcome.qualifying = p.qualifying;
  return outcome;
}

/* ---------------- composite strength index ---------------- */

/** PFI, 0-1000: strength, capacity, level, adherence. */
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
