// PE domain logic: session types, safety limits, volume maths, the growth
// projection and achievements.
//
// Grounding (sources in docs/PE_PROGRAM.md):
//  - Traction is the only method with real clinical trial data. RestoreX at
//    30-90 min/day produced a mean +1.5 cm at 3 months and +1.6 cm at 6; older
//    extenders reported +1.2-1.7 cm at 6 months but demanded 4-9 h/day. Gains
//    are front-loaded into the first ~3 months and are measured in millimetres
//    per week, not centimetres.
//  - Pumping has no comparable length evidence and is treated here as a girth
//    and conditioning tool. Consumer safety guidance: beginners 2-3 inHg
//    (7-10 kPa), intermediate 3-5 inHg (10-17 kPa), advanced 6+ inHg, and
//    never past 10 inHg (~34 kPa). Beginner sessions 10-20 min, in ~10 min
//    bursts, stopping immediately for numbness, discolouration or pain.
//  - Everything here assumes healthy tissue. Pain is a stop signal, not a
//    training cue.

import * as store from '../store.js';

/* ---------------- session types ---------------- */

export const TYPES = {
  warmup: {
    id: 'warmup',
    label: 'Warm-up',
    icon: '♨',
    colour: 'var(--warn)',
    defaultMin: 8,
    intensity: null,
    blurb: 'Heat before load. Warm tissue stretches further and tears less.',
    cue: 'Warm flannel or a rice sock, 5-10 minutes, until the skin is properly warm through.',
  },
  stretch: {
    id: 'stretch',
    label: 'Stretching',
    icon: '↕',
    colour: 'var(--accent)',
    defaultMin: 30,
    intensity: { key: 'tensionKg', label: 'Tension', unit: 'kg', min: 1, max: 20, step: 0.5, safe: 12 },
    tracksBpfsl: true,
    blurb: 'Manual stretches or an extender. The one method with clinical evidence behind it.',
    cue: 'Steady tension, no bouncing. It should feel like a firm stretch, never a sharp pull.',
  },
  pump: {
    id: 'pump',
    label: 'Pumping',
    icon: '◍',
    colour: 'var(--violet)',
    defaultMin: 15,
    intensity: { key: 'pressure', label: 'Pressure', unit: 'kPa', min: 2, max: 34, step: 0.5, safe: 17 },
    blurb: 'Vacuum expansion. Mostly a girth and conditioning tool.',
    cue: 'Work in ~10 minute sets with a full release between them. Release at once for numbness, cold skin or dark discolouration.',
  },
  jelq: {
    id: 'jelq',
    label: 'Jelqing',
    icon: '⤓',
    colour: 'var(--calm)',
    defaultMin: 10,
    intensity: { key: 'strokes', label: 'Strokes', unit: '', min: 20, max: 400, step: 10, safe: 300 },
    blurb: 'Manual girth work at partial erection.',
    cue: 'Plenty of lubricant, 50-70% erection, slow strokes. Redness or spotting means stop.',
  },
  clamp: {
    id: 'clamp',
    label: 'Clamping',
    icon: '⊟',
    colour: 'var(--danger)',
    defaultMin: 5,
    intensity: null,
    advanced: true,
    blurb: 'Advanced and the easiest way to hurt yourself. Short sets only.',
    cue: 'Never past 10 minutes in one set, never without a long conditioning base behind you.',
  },
};

export const TYPE_LIST = Object.values(TYPES);
export const typeDef = (id) => TYPES[id] || TYPES.stretch;

/* ---------------- units ---------------- */

export const KPA_PER_INHG = 3.386;
export const CM_PER_IN = 2.54;

export function toDisplayLength(cm, units) {
  return units === 'in' ? cm / CM_PER_IN : cm;
}
export function fromDisplayLength(v, units) {
  return units === 'in' ? v * CM_PER_IN : v;
}
export function fmtLength(cm, units = store.get().pe.settings.units, dp = 1) {
  if (cm == null) return '—';
  return `${toDisplayLength(cm, units).toFixed(dp)} ${units}`;
}
export function fmtPressure(kpa, unit = store.get().pe.settings.pressureUnit) {
  if (kpa == null) return '—';
  return unit === 'inHg' ? `${(kpa / KPA_PER_INHG).toFixed(1)} inHg` : `${kpa.toFixed(1)} kPa`;
}

/* ---------------- safety ---------------- */

export const PRESSURE_BANDS = [
  { max: 10, label: 'Beginner', note: '2-3 inHg. Where everyone should start.' },
  { max: 17, label: 'Intermediate', note: '3-5 inHg. Only after weeks of comfortable sessions.' },
  { max: 24, label: 'Advanced', note: '5-7 inHg. Expect more marking; watch the skin closely.' },
  { max: 34, label: 'Hard ceiling', note: 'Approaching 10 inHg. Do not go past this, ever.' },
];

export function pressureBand(kpa) {
  return PRESSURE_BANDS.find((b) => kpa <= b.max) || PRESSURE_BANDS[PRESSURE_BANDS.length - 1];
}

/** Checks a planned session against the limits and returns warnings to show
 *  before the timer starts, rather than after something has gone wrong. */
export function planWarnings({ type, minutes, intensity }) {
  const out = [];
  const def = typeDef(type);
  const history = store.get().pe.sessions.filter((s) => s.type === type);
  const experienced = history.length >= 12;

  if (type === 'pump') {
    if (intensity > 34) out.push({ level: 'stop', text: 'Above 10 inHg. Nothing is gained up here and vessels rupture. Bring it down.' });
    else if (intensity > 24) out.push({ level: 'warn', text: `${fmtPressure(intensity)} is at the top of the range. Keep sets short and check the skin between them.` });
    else if (intensity > 17 && !experienced) out.push({ level: 'warn', text: 'That is intermediate-plus pressure with fewer than a dozen logged sessions. Consider easing off.' });
    if (minutes > 20 && !experienced) out.push({ level: 'warn', text: 'Beginner guidance is 10-20 minutes total, split into ~10 minute sets.' });
    if (minutes > 40) out.push({ level: 'warn', text: 'Over 40 minutes in one sitting is where fluid build-up and blistering start showing up.' });
  }

  if (type === 'stretch') {
    if (intensity > 12) out.push({ level: 'warn', text: 'Heavy tension. Length comes from time under tension, not from load — more weight mostly buys injuries.' });
    if (minutes > 120) out.push({ level: 'warn', text: 'Trials that worked used 30-90 minutes a day. Longer sessions are not what produced the results.' });
  }

  if (type === 'clamp') {
    out.push({ level: 'warn', text: 'Clamping restricts blood flow completely. Short sets, and stop at the first sign of numbness or colour change.' });
    if (minutes > 10) out.push({ level: 'stop', text: 'Over 10 minutes clamped in one set is genuinely dangerous. Shorten it.' });
  }

  if (!didWarmupToday() && ['stretch', 'pump', 'jelq', 'clamp'].includes(type)) {
    out.push({ level: 'info', text: 'No warm-up logged today. Five minutes of heat first makes the tissue stretch further and tear less.' });
  }

  const dec = deconStatus();
  if (dec.due) out.push({ level: 'warn', text: `${dec.consecutive} days straight without a rest day. Tissue remodels during time off — a few days down will do more than another session.` });

  if (def.advanced && history.length === 0) {
    out.push({ level: 'warn', text: `${def.label} is an advanced method. It belongs after months of conditioning, not at the start.` });
  }
  return out;
}

export const didWarmupToday = () =>
  store.get().pe.sessions.some((s) => s.date === store.dayKey() && s.type === 'warmup');

/* ---------------- volume and streaks ---------------- */

export const PERIODS = [
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: '90d', label: '90d', days: 90 },
  { id: '6m', label: '6m', days: 182 },
  { id: '1y', label: '1y', days: 365 },
  { id: 'all', label: 'All', days: null },
];

export function periodDef(id) {
  return PERIODS.find((p) => p.id === id) || PERIODS[1];
}

export function inPeriod(items, periodId, key = 'ts') {
  const p = periodDef(periodId);
  if (!p.days) return items.slice();
  const cutoff = Date.now() - p.days * 864e5;
  return items.filter((i) => i[key] >= cutoff);
}

export function sessionsInPeriod(periodId) {
  return inPeriod(store.get().pe.sessions, periodId);
}

export function volumeByType(sessions) {
  const out = {};
  for (const s of sessions) out[s.type] = (out[s.type] || 0) + (s.durationSec || 0) * 1000;
  return out;
}

export function weeklyVolumeMs(type = null, weeks = 1) {
  const cutoff = Date.now() - weeks * 7 * 864e5;
  return store
    .get()
    .pe.sessions.filter((s) => s.ts >= cutoff && (!type || s.type === type))
    .reduce((a, s) => a + (s.durationSec || 0) * 1000, 0);
}

export function peStreak() {
  return store.streakOver(store.get().pe.sessions.map((s) => s.date));
}

/** PE convention, and a sound one: periodic time off. Tissue adapts during
 *  rest, and the classic overtraining pattern is weeks of daily work with
 *  nothing to show for it. */
export function deconStatus() {
  const days = new Set(store.get().pe.sessions.filter((s) => s.type !== 'warmup').map((s) => s.date));
  let cursor = store.dayKey();
  if (!days.has(cursor)) cursor = store.addDays(cursor, -1);
  let consecutive = 0;
  while (days.has(cursor)) {
    consecutive++;
    cursor = store.addDays(cursor, -1);
  }
  return { consecutive, due: consecutive >= 12, hard: consecutive >= 20 };
}

/* ---------------- BPFSL, the session-level signal ---------------- */

/** Bone-pressed flaccid stretched length before and after a session is the
 *  fastest feedback loop available: it moves within one session, long before
 *  erect length does. Around +5% is the usual sign that the tissue actually
 *  took the load. */
export function bpfslVerdict(before, after) {
  if (!before || !after) return null;
  const pct = ((after - before) / before) * 100;
  if (pct < 1.5) {
    return { pct, level: 'low', text: 'Barely moved. Either the tissue was not warm, the session was too short, or the tension was too light to register.' };
  }
  if (pct <= 8) {
    return { pct, level: 'good', text: 'That is the response you want — roughly the 5% the tissue gives up when it has genuinely been loaded.' };
  }
  return { pct, level: 'high', text: 'A big jump. Either a great session or a measuring inconsistency; if it comes with soreness, take the next day off.' };
}

/* ---------------- growth projection ---------------- */

const monthsBetween = (a, b) => (b - a) / (30.44 * 864e5);

/** Least-squares fit of a measurement series against time in months. */
function regress(points) {
  if (points.length < 2) return null;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const sxy = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const ssTot = points.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const ssRes = points.reduce((a, p) => a + (p.y - (intercept + slope * p.x)) ** 2, 0);
  return { slope, intercept, r2: ssTot ? 1 - ssRes / ssTot : 0, n };
}

/** What the literature would predict from this much weekly volume, before
 *  any of the user's own results are considered. Deliberately conservative:
 *  published means are under 2 cm over six months, and they front-load. */
function priorRates(weeklyStretchMin, weeklyPumpMin, monthsIn) {
  // Traction response saturates: 30-90 min/day is where the trials sat, and
  // more hours did not buy proportionally more length.
  const dailyStretch = weeklyStretchMin / 7;
  const dose = Math.min(dailyStretch / 60, 1.5); // 1.0 at an hour a day
  const decay = Math.exp(-monthsIn / 7); // gains are front-loaded
  const length = 0.42 * dose * (0.35 + 0.65 * decay); // cm/month

  const dailyPump = weeklyPumpMin / 7;
  const pumpDose = Math.min(dailyPump / 20, 1.2);
  const girth = 0.07 * pumpDose * (0.4 + 0.6 * decay);
  return { length, girth };
}

/**
 * Blends the user's own measured trend with the volume-based prior. Early on,
 * two measurements cannot tell a trend from noise, so the prior dominates; as
 * the series grows, their own numbers take over. Everything is returned with a
 * range, because a point estimate here would be dishonest.
 */
export function projection(horizonMonths = [3, 6, 12]) {
  const state = store.get();
  const ms = state.pe.measurements.slice().sort((a, b) => a.ts - b.ts);
  const latest = ms[ms.length - 1];
  if (!latest) return null;

  const t0 = ms[0].ts;
  const lenPts = ms.filter((m) => m.bpel).map((m) => ({ x: monthsBetween(t0, m.ts), y: m.bpel }));
  const girthPts = ms.filter((m) => m.eg).map((m) => ({ x: monthsBetween(t0, m.ts), y: m.eg }));
  const lenFit = regress(lenPts);
  const girthFit = regress(girthPts);

  const monthsIn = monthsBetween(t0, Date.now());
  const weeklyStretch = weeklyVolumeMs('stretch', 4) / 4 / 60000;
  const weeklyPump = weeklyVolumeMs('pump', 4) / 4 / 60000;
  const prior = priorRates(weeklyStretch, weeklyPump, monthsIn);

  // Confidence in the user's own data: how many points, over how long, and how
  // cleanly they line up.
  const span = lenPts.length ? lenPts[lenPts.length - 1].x : 0;
  const w = Math.min(
    0.85,
    (Math.min(lenPts.length, 8) / 8) * 0.6 + Math.min(span / 6, 1) * 0.25 + (lenFit ? Math.max(0, lenFit.r2) * 0.15 : 0)
  );

  const lengthRate = lenFit ? lenFit.slope * w + prior.length * (1 - w) : prior.length;
  const girthRate = girthFit ? girthFit.slope * w + prior.girth * (1 - w) : prior.girth;
  const spread = 0.45 + 0.4 * (1 - w); // wider band when we are mostly guessing

  const points = horizonMonths.map((m) => {
    const dl = lengthRate * m;
    const dg = girthRate * m;
    return {
      months: m,
      bpel: latest.bpel ? latest.bpel + dl : null,
      bpelLow: latest.bpel ? latest.bpel + dl * (1 - spread) : null,
      bpelHigh: latest.bpel ? latest.bpel + dl * (1 + spread) : null,
      eg: latest.eg ? latest.eg + dg : null,
      egLow: latest.eg ? latest.eg + dg * (1 - spread) : null,
      egHigh: latest.eg ? latest.eg + dg * (1 + spread) : null,
    };
  });

  return {
    from: latest,
    lengthRate,
    girthRate,
    confidence: w,
    basis: w > 0.55 ? 'your own measurements' : w > 0.25 ? 'your measurements, weighted against typical response' : 'typical response at your training volume',
    weeklyStretch,
    weeklyPump,
    observedRate: lenFit ? lenFit.slope : null,
    r2: lenFit ? lenFit.r2 : null,
    n: ms.length,
    points,
  };
}

/* ---------------- monthly check-in ---------------- */

export function measurementDue() {
  const s = store.get().pe;
  const last = s.measurements[s.measurements.length - 1];
  const now = new Date();
  const day = s.settings.measureDay || 1;
  if (!last) return { due: true, reason: 'No measurements logged yet — this is your baseline.' };
  const daysSince = Math.floor((Date.now() - last.ts) / 864e5);
  if (daysSince >= 28 && now.getDate() >= day) {
    return { due: true, daysSince, reason: `${daysSince} days since your last check-in.` };
  }
  return { due: false, daysSince, next: Math.max(0, 28 - daysSince) };
}

/* ---------------- achievements ---------------- */

export const ACHIEVEMENTS = [
  { id: 'pe_first', name: 'Day one', desc: 'Logged your first session', test: (p) => p.sessions.length >= 1 },
  { id: 'pe_baseline', name: 'Baseline set', desc: 'Recorded your first measurement', test: (p) => p.measurements.length >= 1 },
  { id: 'pe_photo', name: 'On the record', desc: 'Saved your first progress photo', test: (p) => p.measurements.some((m) => m.photoId) },
  { id: 'pe_warm', name: 'Warms up properly', desc: 'Logged 10 warm-ups', test: (p) => p.sessions.filter((s) => s.type === 'warmup').length >= 10 },
  { id: 'pe_week', name: '7-day streak', desc: 'A full week without missing', test: () => peStreak() >= 7 },
  { id: 'pe_month', name: '30-day streak', desc: 'A month of consistency', test: () => peStreak() >= 30 },
  { id: 'pe_10h', name: '10 hours under tension', desc: 'Ten lifetime hours of stretching', test: (p) => lifetime(p, 'stretch') >= 36e6 },
  { id: 'pe_50h', name: '50 hours under tension', desc: 'Fifty lifetime hours of stretching', test: (p) => lifetime(p, 'stretch') >= 18e7 },
  { id: 'pe_bpfsl', name: 'Responder', desc: 'Hit a 5% BPFSL jump in one session', test: (p) => p.sessions.some((s) => s.bpfslBefore && s.bpfslAfter && s.bpfslAfter / s.bpfslBefore >= 1.05) },
  { id: 'pe_cm', name: 'First centimetre', desc: 'Gained 1 cm of bone-pressed length', test: (p) => gain(p, 'bpel') >= 1 },
  { id: 'pe_girth', name: 'Thicker', desc: 'Gained 0.5 cm of girth', test: (p) => gain(p, 'eg') >= 0.5 },
  { id: 'pe_combo', name: 'Multitasker', desc: 'Ran kegels during a pump session', test: (p) => p.sessions.some((s) => s.kegelCycles > 0) },
  { id: 'pe_decon', name: 'Took the week off', desc: 'Completed a deliberate decon break', test: (p) => hasDecon(p) },
  { id: 'pe_sixmonths', name: 'Half a year in', desc: 'Six months between your first and latest measurement', test: (p) => p.measurements.length > 1 && monthsBetween(p.measurements[0].ts, p.measurements[p.measurements.length - 1].ts) >= 6 },
];

function lifetime(pe, type) {
  return pe.sessions.filter((s) => s.type === type).reduce((a, s) => a + (s.durationSec || 0) * 1000, 0);
}

function gain(pe, key) {
  const vals = pe.measurements.filter((m) => m[key]);
  if (vals.length < 2) return 0;
  return vals[vals.length - 1][key] - vals[0][key];
}

/** A decon break is 5+ clear days between sessions, after a real training
 *  block — not just a gap because life happened early on. */
function hasDecon(pe) {
  const days = pe.sessions.map((s) => s.ts).sort((a, b) => a - b);
  if (days.length < 10) return false;
  for (let i = 1; i < days.length; i++) {
    const gapDays = (days[i] - days[i - 1]) / 864e5;
    if (gapDays >= 5 && gapDays <= 21 && i >= 8) return true;
  }
  return false;
}

export function checkAchievements(state = store.get()) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (state.pe.achievements.includes(a.id)) continue;
    try {
      if (a.test(state.pe)) {
        state.pe.achievements.push(a.id);
        earned.push(a);
      }
    } catch {
      /* never let an achievement test break a save */
    }
  }
  return earned;
}

/* ---------------- insights ---------------- */

/** Plain observations drawn from the data, shown on the stats screen. Only
 *  things the numbers actually support. */
export function insights() {
  const pe = store.get().pe;
  const out = [];
  const sessions = pe.sessions;
  if (!sessions.length) return out;

  const wk = weeklyVolumeMs('stretch', 4) / 4 / 60000;
  if (wk > 0) {
    const daily = wk / 7;
    if (daily < 15) out.push({ level: 'warn', text: `You average ${daily.toFixed(0)} min/day of stretching. The trials that produced gains ran 30-90 min/day — below about 20 you are unlikely to see much.` });
    else if (daily <= 100) out.push({ level: 'good', text: `You average ${daily.toFixed(0)} min/day of stretching, which sits inside the range that produced measured gains in trials.` });
    else out.push({ level: 'info', text: `You average ${daily.toFixed(0)} min/day. Past about 90 min/day the evidence stops showing extra benefit — the risk keeps rising though.` });
  }

  const withBpfsl = sessions.filter((s) => s.bpfslBefore && s.bpfslAfter);
  if (withBpfsl.length >= 3) {
    const avg = withBpfsl.reduce((a, s) => a + (s.bpfslAfter - s.bpfslBefore) / s.bpfslBefore, 0) / withBpfsl.length * 100;
    out.push({
      level: avg >= 3 ? 'good' : 'warn',
      text: `Your sessions move BPFSL by ${avg.toFixed(1)}% on average. ${avg >= 3 ? 'That is a real response to the load.' : 'Under about 3% usually means not warm enough, not long enough, or too little tension.'}`,
    });
  }

  const warm = sessions.filter((s) => s.type === 'warmup').length;
  const work = sessions.filter((s) => s.type !== 'warmup').length;
  if (work >= 8) {
    const ratio = warm / work;
    if (ratio < 0.4) out.push({ level: 'warn', text: `You warmed up before roughly ${Math.round(ratio * 100)}% of sessions. Heat first is the cheapest injury insurance there is.` });
  }

  const dec = deconStatus();
  if (dec.consecutive >= 10) out.push({ level: 'warn', text: `${dec.consecutive} consecutive training days. Schedule a few days off — adaptation happens during the rest, not during the session.` });

  const proj = projection();
  if (proj && proj.n >= 3 && proj.observedRate != null) {
    const perMonth = proj.observedRate;
    out.push({
      level: perMonth > 0 ? 'good' : 'info',
      text: perMonth > 0
        ? `Your own measurements trend at ${(perMonth * 10).toFixed(1)} mm/month of bone-pressed length. Real gains are measured in millimetres per month, so that is what progress looks like.`
        : 'Your measured length is flat so far. Over short spans that is normal — measurement noise is bigger than a month of real change.',
    });
  }
  return out;
}
