// PE domain: session types, limits, volume, the projection, daily totals.
//
// Sources in docs/PE_PROGRAM.md. What they say:
//   Traction is the only method with trial data: about +1.5 cm at 3 months at
//   30-90 min/day, front-loaded, measured in millimetres per week.
//   Pumping has no comparable length evidence and is treated as girth and
//   conditioning work. Intensity is not recorded: a water pump has no gauge.
//   Stretch target is as much as you can manage up to two hours, under 10 kg.
//   Pain is a stop signal, not a training cue.

import * as store from '../store.js';

/* ---------------- session types ---------------- */

export const TYPES = {
  stretch: {
    id: 'stretch',
    label: 'Stretching',
    icon: 'stretch',
    colour: 'var(--accent)',
    defaultMin: 60,
    intensity: { key: 'tensionKg', label: 'Tension', unit: 'kg', min: 0.5, max: 10, step: 0.5 },
    tracksBpfsl: true,
    blurb: 'Manual stretching or an extender. The only method with clinical evidence behind it.',
    cue: 'Steady tension, no bouncing. A firm stretch, never a sharp pull.',
  },
  pump: {
    id: 'pump',
    label: 'Pumping',
    icon: 'pump',
    colour: 'var(--accent)',
    defaultMin: 15,
    // No intensity field: a Hydromax has no gauge, so any number is invented.
    intensity: null,
    blurb: 'Vacuum expansion. Girth and conditioning.',
    cue: 'Work in ~10 minute sets with a full release between them. Release at once for numbness, cold skin or dark colour.',
  },
};

/** Retired types. Nothing new logs against them, but old entries keep their
 *  own name rather than being relabelled. */
const RETIRED = {
  warmup: { id: 'warmup', label: 'Warm-up', icon: 'droplet', colour: 'var(--muted)', retired: true, defaultMin: 8, intensity: null, blurb: '', cue: '' },
  jelq: { id: 'jelq', label: 'Jelqing', icon: 'stretch', colour: 'var(--muted)', retired: true, defaultMin: 10, intensity: null, blurb: '', cue: '' },
  clamp: { id: 'clamp', label: 'Clamping', icon: 'warn', colour: 'var(--muted)', retired: true, defaultMin: 5, intensity: null, blurb: '', cue: '' },
};

export const TYPE_LIST = Object.values(TYPES);
export const isValidType = (id) => Object.prototype.hasOwnProperty.call(TYPES, id);
export const typeDef = (id) => TYPES[id] || RETIRED[id] || TYPES.stretch;

/* ---------------- units ---------------- */

export const CM_PER_IN = 2.54;

export function toDisplayLength(cm, units) {
  return units === 'in' ? cm / CM_PER_IN : cm;
}
export function fromDisplayLength(v, units) {
  return units === 'in' ? v * CM_PER_IN : v;
}
export function fmtLength(cm, units = store.get().pe.settings.units, dp = 1) {
  if (cm == null) return '-';
  return `${toDisplayLength(cm, units).toFixed(dp)} ${units}`;
}
/* ---------------- safety ---------------- */

/** Warnings before the timer starts, not after something has gone wrong. */
export function planWarnings({ type, minutes, intensity }) {
  const out = [];
  const history = store.get().pe.sessions.filter((s) => s.type === type);
  const experienced = history.length >= 12;

  if (type === 'pump') {
    if (minutes > 20 && !experienced) out.push({ level: 'warn', text: 'Beginner guidance is 10-20 minutes total, split into ~10 minute sets.' });
    if (minutes > 40) out.push({ level: 'warn', text: 'Past 40 minutes in one sitting is where fluid build-up and blistering show up.' });
  }

  if (type === 'stretch') {
    if (intensity >= 10) out.push({ level: 'info', text: '10 kg is the ceiling. Length comes from time under tension, not from more load.' });
    const todayMs = store
      .get()
      .pe.sessions.filter((s) => s.date === store.dayKey() && s.type === 'stretch')
      .reduce((a, s) => a + s.durationSec * 1000, 0);
    const planned = todayMs + minutes * 60000;
    if (planned > DAILY_STRETCH_GOAL_MS * 1.5) {
      out.push({ level: 'warn', text: `That would put you over ${(planned / 3600000).toFixed(1)}h of stretching today. Two hours is the target; well past it is where injuries come from.` });
    }
  }

  const dec = deconStatus();
  if (dec.due) out.push({ level: 'warn', text: `${dec.consecutive} days straight without a rest day. Tissue remodels during time off.` });

  return out;
}

/* ---------------- volume and streaks ---------------- */

/** As much as you can manage, up to two hours a day. */
export const DAILY_STRETCH_GOAL_MS = 2 * 60 * 60000;

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

/** Rest days. Tissue adapts during rest. */
export function deconStatus() {
  const days = new Set(store.get().pe.sessions.map((s) => s.date));
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

/** BPFSL either side of a session is the fastest feedback there is: it moves
 *  within one session. About +5% means the tissue took the load. */
export function bpfslVerdict(before, after) {
  if (!before || !after) return null;
  const pct = ((after - before) / before) * 100;
  if (pct < 1.5) {
    return { pct, level: 'low', text: 'Barely moved. Either the tissue was not warm, the session was too short, or the tension was too light to register.' };
  }
  if (pct <= 8) {
    return { pct, level: 'good', text: 'The response you want. Roughly the 5% the tissue gives up when it has genuinely been loaded.' };
  }
  return { pct, level: 'high', text: 'A big jump. Either a great session or a measuring inconsistency; if it comes with soreness, take the next day off.' };
}

/* ---------------- growth projection ---------------- */

const monthsBetween = (a, b) => (b - a) / (30.44 * 864e5);

/** Least-squares fit against time in months. */
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

/** The prior, from weekly volume alone. Conservative: published means are
 *  under 2 cm over six months and front-load. */
function priorRates(weeklyStretchMin, weeklyPumpMin, monthsIn) {
  // Traction saturates: more than 30-90 min/day did not buy proportionally more.
  const dailyStretch = weeklyStretchMin / 7;
  const dose = Math.min(dailyStretch / 60, 1.5); // 1.0 at an hour a day
  const decay = Math.exp(-monthsIn / 7); // gains are front-loaded
  const length = 0.42 * dose * (0.35 + 0.65 * decay); // cm/month

  const dailyPump = weeklyPumpMin / 7;
  const pumpDose = Math.min(dailyPump / 20, 1.2);
  const girth = 0.07 * pumpDose * (0.4 + 0.6 * decay);
  return { length, girth };
}

/** Blends your own trend with the prior: the prior dominates early, your data
 *  takes over as the series grows. Always a range, never a point. */
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

  // Confidence: how many points, over how long, how cleanly they line up.
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

/* ---------------- did the hours buy anything? ---------------- */

/** Each gap between check-ins against the training inside it. The one chart
 *  that can argue against more volume. */
export function volumeVsGain(key = 'bpel') {
  const pe = store.get().pe;
  const ms = pe.measurements.filter((m) => m[key] != null).sort((a, b) => a.ts - b.ts);
  const points = [];
  for (let i = 1; i < ms.length; i++) {
    const a = ms[i - 1];
    const b = ms[i];
    const days = (b.ts - a.ts) / 864e5;
    if (days < 7) continue; // too short to separate growth from measuring noise
    const stretchMin = pe.sessions
      .filter((s) => s.type === 'stretch' && s.ts > a.ts && s.ts <= b.ts)
      .reduce((acc, s) => acc + (s.durationSec || 0) / 60, 0);
    points.push({
      x: stretchMin / days, // average minutes a day across the gap
      y: ((b[key] - a[key]) * 10) / (days / 30.44), // mm per month
      from: a.ts,
      to: b.ts,
      days: Math.round(days),
      label: `${Math.round(stretchMin / days)} min/day → ${(((b[key] - a[key]) * 10) / (days / 30.44)).toFixed(1)} mm/month`,
    });
  }
  if (points.length < 2) return { points, r: null, verdict: null };

  // Pearson's r. With a handful of points it is suggestive, and the wording says so.
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const sxy = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const syy = points.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;

  let verdict = null;
  if (r == null || n < 3) verdict = 'Not enough check-ins yet. Each new one sharpens this.';
  else if (r > 0.5) verdict = 'More time under tension has gone with more length for you. Volume is paying.';
  else if (r < -0.3) verdict = 'Your bigger blocks came with less gain, not more. That usually means too much, too often. Try more rest days rather than more hours.';
  else verdict = 'No clear link between hours and gain so far. Consistency and rest are worth more than piling on time.';

  return { points, r, verdict, avgPerDay: mx, avgGain: my };
}

/** Thickest against base, and the taper. Pumping moves the middle first. */
export function girthMap() {
  const ms = store
    .get()
    .pe.measurements.filter((m) => m.eg != null && m.baseGirth != null)
    .sort((a, b) => a.ts - b.ts);
  if (!ms.length) return null;
  const latest = ms[ms.length - 1];
  const first = ms[0];
  return {
    entries: ms,
    thick: latest.eg,
    base: latest.baseGirth,
    taper: latest.eg - latest.baseGirth,
    taperFirst: first.eg - first.baseGirth,
    thickGain: ms.length > 1 ? latest.eg - first.eg : 0,
    baseGain: ms.length > 1 ? latest.baseGirth - first.baseGirth : 0,
  };
}

/* ---------------- monthly check-in ---------------- */

export function measurementDue() {
  const s = store.get().pe;
  const last = s.measurements[s.measurements.length - 1];
  const now = new Date();
  const day = s.settings.measureDay || 1;
  if (!last) return { due: true, reason: 'No measurements yet' };
  const daysSince = Math.floor((Date.now() - last.ts) / 864e5);
  // The preferred day can bring a check-in forward, never hold an overdue one back.
  const onChosenDay = now.getDate() >= day && daysSince >= 25;
  if (daysSince >= 28 || onChosenDay) {
    return { due: true, daysSince, reason: `${daysSince} days since your last check-in.` };
  }
  return { due: false, daysSince, next: Math.max(1, 28 - daysSince) };
}

/* ------------------ stretch, by day ------------------ */

/** Stretch milliseconds per day, oldest first. */
export function dailyStretchTotals(pe = store.get().pe) {
  const byDay = new Map();
  for (const s of pe.sessions) {
    if (s.type !== 'stretch') continue;
    byDay.set(s.date, (byDay.get(s.date) || 0) + s.durationSec * 1000);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

/* ---------------- insights ---------------- */

/** Observations the numbers actually support. */
export function insights() {
  const pe = store.get().pe;
  const out = [];
  const sessions = pe.sessions;
  if (!sessions.length) return out;

  const wk = weeklyVolumeMs('stretch', 4) / 4 / 60000;
  if (wk > 0) {
    const daily = wk / 7;
    const goalMin = DAILY_STRETCH_GOAL_MS / 60000;
    const pctOfGoal = Math.round((daily / goalMin) * 100);
    if (daily < 30) out.push({ level: 'warn', text: `${daily.toFixed(0)} min/day on average, ${pctOfGoal}% of your two-hour target. Below about 30 min/day there is little to measure.` });
    else if (daily < goalMin * 0.8) out.push({ level: 'info', text: `${daily.toFixed(0)} min/day on average, ${pctOfGoal}% of your two-hour target.` });
    else out.push({ level: 'good', text: `${daily.toFixed(0)} min/day on average, at or near your two-hour target. That is the top of the dose range anyone has studied.` });
  }

  const withBpfsl = sessions.filter((s) => s.bpfslBefore && s.bpfslAfter);
  if (withBpfsl.length >= 3) {
    const avg = withBpfsl.reduce((a, s) => a + (s.bpfslAfter - s.bpfslBefore) / s.bpfslBefore, 0) / withBpfsl.length * 100;
    out.push({
      level: avg >= 3 ? 'good' : 'warn',
      text: `Your sessions move BPFSL by ${avg.toFixed(1)}% on average. ${avg >= 3 ? 'That is a real response to the load.' : 'Under about 3% usually means not warm enough, not long enough, or too little tension.'}`,
    });
  }

  const dec = deconStatus();
  if (dec.consecutive >= 10) out.push({ level: 'warn', text: `${dec.consecutive} consecutive training days. Schedule a few days off. Adaptation happens during the rest, not during the session.` });

  const proj = projection();
  if (proj && proj.n >= 3 && proj.observedRate != null) {
    const perMonth = proj.observedRate;
    out.push({
      level: perMonth > 0 ? 'good' : 'info',
      text: perMonth > 0
        ? `Your own measurements trend at ${(perMonth * 10).toFixed(1)} mm/month of bone-pressed length. Real gains are measured in millimetres per month, so that is what progress looks like.`
        : 'Your measured length is flat so far. Over short spans that is normal. Measurement noise is bigger than a month of change.',
    });
  }
  return out;
}
