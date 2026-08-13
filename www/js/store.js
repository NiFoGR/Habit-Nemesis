// Persistence layer. Everything lives on-device in localStorage — no accounts,
// no network, nothing leaves the phone.

import { toast } from './ui.js';

const KEY = 'nifo.state.v1';
const SCHEMA = 1;

function blank() {
  return {
    v: SCHEMA,
    createdAt: Date.now(),
    settings: {
      inputMode: 'hold', // 'hold' = press-and-hold tracking, 'auto' = hands-free
      haptics: true,
      sound: false,
      discreet: false, // renames the Kegels section to "Core Training"
      restDay: 0, // 0 = Sunday
      dailyTarget: 2, // sessions per day the program asks for
      reminder: '', // 'HH:MM' or '' for off
    },
    program: {
      level: 1,
      qualifying: 0, // consecutive level-standard sessions banked toward promotion
      deload: 0, // sessions remaining at reduced targets
      startedAt: Date.now(),
      history: [{ level: 1, at: Date.now() }],
    },
    sessions: [],
    prs: { maxHoldMs: 0, tutMs: 0, score: 0, streak: 0 },
    badges: [],

    // Second feature: PE training. Kept in its own slice so the two features
    // never tread on each other's data.
    pe: {
      settings: {
        units: 'cm',
        pressureUnit: 'kPa',
        pumpStyle: 'hydro', // 'hydro' (water pump, no gauge) or 'air' (gauged)
        tensionKg: 10,
        pressure: 8,
        hydroLevel: 3, // perceived intensity 1-5 for gauge-less water pumps
        stretchMin: 30,
        pumpMin: 15,
        kegelDuringPump: true,
        reminder: '',
        measureDay: 1, // day of the month the monthly check-in is due
        autoLockMin: 2, // gallery re-locks after this long
        safetyAck: false,
      },
      sessions: [],
      measurements: [],
      achievements: [],
      prs: { sessionMs: 0, weekMs: 0, bpel: 0, eg: 0, bpfsl: 0, streak: 0 },
      vault: null, // { salt, iv, check } once a gallery PIN is set
    },
  };
}

/* ---------------- input sanitising ----------------
   Saved state is not trusted. It can come from an imported backup file, or
   from localStorage that something else on the device has written to, and it
   ends up interpolated into innerHTML all over the app. So every value is
   coerced to the type and range it is supposed to be, before anything renders
   it. Unknown keys are dropped rather than carried along. */

/** Clamping is right for settings — pull a silly value back into range. */
const num = (v, lo = -1e9, hi = 1e9) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
};
/** Clamping is wrong for measurements: a 500 cm reading clamped to 100 becomes
 *  a fabricated data point in the middle of a chart. Out of range is dropped. */
const numIn = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const int = (v, lo, hi, dflt) => {
  const n = num(v, lo, hi);
  return n == null ? dflt : Math.round(n);
};
const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);
const bool = (v) => v === true;
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
/** Dates are used as object keys and rendered, so only the exact shape passes. */
const dateKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : dayKey());
const id = (v, prefix) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : `${prefix}${Math.random().toString(36).slice(2)}`);
const b64 = (v) => (typeof v === 'string' && /^[A-Za-z0-9+/=]{1,4096}$/.test(v) ? v : null);

// Plausible human range in cm. Outside it the value is a typo, a unit mix-up
// or junk, and keeping it would corrupt every trend and projection.
const MIN_CM = 1;
const MAX_CM = 60;

const MAX_SESSIONS = 20000;
const MAX_REPS = 500;

function cleanKegelSession(s) {
  if (!s || typeof s !== 'object') return null;
  const ts = num(s.ts, 0, 4e12) ?? Date.now();
  return {
    id: id(s.id, 'k_'),
    ts,
    date: dateKey(s.date),
    level: int(s.level, 1, 12, 1),
    type: oneOf(s.type, ['training', 'release', 'test'], 'training'),
    mode: oneOf(s.mode, ['hold', 'auto'], 'hold'),
    source: s.source === 'pe-pump' ? 'pe-pump' : null,
    countsForPromotion: s.countsForPromotion !== false,
    quit: bool(s.quit),
    durationSec: int(s.durationSec, 0, 86400, 0),
    reps: arr(s.reps, MAX_REPS).map((r) => ({
      kind: oneOf(r?.kind, ['flick', 'hold', 'ramp', 'max'], 'hold'),
      targetMs: int(r?.targetMs, 1, 600000, 1000),
      actualMs: int(r?.actualMs, 0, 600000, 0),
    })),
    totals: {
      contractions: int(s.totals?.contractions, 0, 100000, 0),
      tutMs: int(s.totals?.tutMs, 0, 1e9, 0),
      longestHoldMs: int(s.totals?.longestHoldMs, 0, 600000, 0),
      avgHoldMs: int(s.totals?.avgHoldMs, 0, 600000, 0),
    },
    score: int(s.score, 0, 100, 0),
    completion: num(s.completion, 0, 1) ?? 0,
    fidelity: num(s.fidelity, 0, 2) ?? 0,
    consistency: num(s.consistency, 0, 1) ?? 0,
    estimated: bool(s.estimated),
    grade: oneOf(s.grade, ['S', 'A', 'B', 'C', 'D', '–'], '–'),
    selfRating: oneOf(s.selfRating, ['easy', 'solid', 'hard', 'failed'], null),
    discomfort: bool(s.discomfort),
  };
}

function cleanPeSession(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    id: id(s.id, 'pe_'),
    ts: num(s.ts, 0, 4e12) ?? Date.now(),
    date: dateKey(s.date),
    // Retired types stay readable so old logs are not relabelled.
    type: oneOf(s.type, ['warmup', 'stretch', 'pump', 'jelq', 'clamp'], 'stretch'),
    durationSec: int(s.durationSec, 0, 86400, 0),
    plannedSec: int(s.plannedSec, 0, 86400, 0),
    tensionKg: numIn(s.tensionKg, 0.5, 50),
    pressure: numIn(s.pressure, 0.5, 100),
    hydroLevel: numIn(s.hydroLevel, 1, 5),
    bpfslBefore: numIn(s.bpfslBefore, MIN_CM, MAX_CM),
    bpfslAfter: numIn(s.bpfslAfter, MIN_CM, MAX_CM),
    kegelCycles: int(s.kegelCycles, 0, 10000, 0),
    quality: oneOf(s.quality, ['great', 'ok', 'flat', 'bad'], 'ok'),
    discomfort: bool(s.discomfort),
    notes: str(s.notes, 500),
  };
}

function cleanMeasurement(m) {
  if (!m || typeof m !== 'object') return null;
  const bpel = numIn(m.bpel, MIN_CM, MAX_CM);
  if (bpel == null) return null; // a measurement without a usable length is not one
  return {
    id: id(m.id, 'm_'),
    ts: num(m.ts, 0, 4e12) ?? Date.now(),
    date: dateKey(m.date),
    bpel,
    eg: numIn(m.eg, MIN_CM, MAX_CM),
    bpfsl: numIn(m.bpfsl, MIN_CM, MAX_CM),
    nbpel: numIn(m.nbpel, MIN_CM, MAX_CM),
    baseGirth: numIn(m.baseGirth, MIN_CM, MAX_CM),
    photoId: typeof m.photoId === 'string' && /^p_[0-9]{1,20}$/.test(m.photoId) ? m.photoId : null,
    notes: str(m.notes, 500),
  };
}

// Merge saved state over the blank shape so new fields added in later versions
// appear on old saves instead of coming back undefined.
function hydrate(saved) {
  const base = blank();
  if (!saved || typeof saved !== 'object') return base;
  const savedPe = saved.pe || {};
  const ss = saved.settings || {};
  const sp = saved.program || {};
  const ps = savedPe.settings || {};
  const vault = savedPe.vault;

  return {
    v: SCHEMA,
    createdAt: num(saved.createdAt, 0, 4e12) ?? Date.now(),
    settings: {
      inputMode: oneOf(ss.inputMode, ['hold', 'auto'], base.settings.inputMode),
      haptics: ss.haptics !== false,
      sound: bool(ss.sound),
      discreet: bool(ss.discreet),
      restDay: int(ss.restDay, 0, 6, base.settings.restDay),
      dailyTarget: int(ss.dailyTarget, 1, 3, base.settings.dailyTarget),
      reminder: /^\d{2}:\d{2}$/.test(ss.reminder) ? ss.reminder : '',
    },
    program: {
      level: int(sp.level, 1, 12, 1),
      qualifying: int(sp.qualifying, 0, 10, 0),
      deload: int(sp.deload, 0, 20, 0),
      startedAt: num(sp.startedAt, 0, 4e12) ?? Date.now(),
      history: arr(sp.history, 200)
        .map((h) => ({ level: int(h?.level, 1, 12, 1), at: num(h?.at, 0, 4e12) ?? Date.now() }))
        .filter(Boolean),
    },
    sessions: arr(saved.sessions, MAX_SESSIONS).map(cleanKegelSession).filter(Boolean),
    prs: {
      maxHoldMs: int(saved.prs?.maxHoldMs, 0, 600000, 0),
      tutMs: int(saved.prs?.tutMs, 0, 1e9, 0),
      score: int(saved.prs?.score, 0, 100, 0),
      streak: int(saved.prs?.streak, 0, 100000, 0),
    },
    badges: arr(saved.badges, 100).filter((b) => typeof b === 'string' && b.length < 40),
    pe: {
      settings: {
        units: oneOf(ps.units, ['cm', 'in'], 'cm'),
        pressureUnit: oneOf(ps.pressureUnit, ['kPa', 'inHg'], 'kPa'),
        pumpStyle: oneOf(ps.pumpStyle, ['hydro', 'air'], 'hydro'),
        tensionKg: num(ps.tensionKg, 1, 20) ?? base.pe.settings.tensionKg,
        pressure: num(ps.pressure, 2, 34) ?? base.pe.settings.pressure,
        hydroLevel: int(ps.hydroLevel, 1, 5, base.pe.settings.hydroLevel),
        stretchMin: int(ps.stretchMin, 1, 120, base.pe.settings.stretchMin),
        pumpMin: int(ps.pumpMin, 1, 120, base.pe.settings.pumpMin),
        kegelDuringPump: ps.kegelDuringPump !== false,
        reminder: /^\d{2}:\d{2}$/.test(ps.reminder) ? ps.reminder : '',
        measureDay: int(ps.measureDay, 1, 28, base.pe.settings.measureDay),
        autoLockMin: int(ps.autoLockMin, 1, 10, base.pe.settings.autoLockMin),
        safetyAck: bool(ps.safetyAck),
      },
      sessions: arr(savedPe.sessions, MAX_SESSIONS).map(cleanPeSession).filter(Boolean),
      measurements: arr(savedPe.measurements, MAX_SESSIONS).map(cleanMeasurement).filter(Boolean),
      achievements: arr(savedPe.achievements, 100).filter((a) => typeof a === 'string' && a.length < 40),
      prs: {
        sessionMs: int(savedPe.prs?.sessionMs, 0, 1e9, 0),
        weekMs: int(savedPe.prs?.weekMs, 0, 1e9, 0),
        bpel: numIn(savedPe.prs?.bpel, 0, MAX_CM) ?? 0,
        eg: numIn(savedPe.prs?.eg, 0, MAX_CM) ?? 0,
        bpfsl: numIn(savedPe.prs?.bpfsl, 0, MAX_CM) ?? 0,
        streak: int(savedPe.prs?.streak, 0, 100000, 0),
      },
      // Only base64 of the right shape; anything else means no usable vault.
      vault: vault && b64(vault.salt) && b64(vault.iv) && b64(vault.check)
        ? { salt: b64(vault.salt), iv: b64(vault.iv), check: b64(vault.check) }
        : null,
    },
  };
}

let state = load();
const listeners = new Set();

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    return hydrate(JSON.parse(raw));
  } catch {
    return blank();
  } finally {
    // If anything was dropped or coerced on the way in, write the cleaned
    // version straight back rather than leaving the junk on disk to be
    // re-parsed on every launch.
    queueMicrotask(() => {
      try {
        if (raw !== null && JSON.stringify(state) !== raw) save();
      } catch {
        /* the next save will deal with it */
      }
    });
  }
}

export function get() {
  return state;
}

let saveFailed = false;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (err) {
    // Silently losing a session is the worst possible failure for a tracker,
    // so this is surfaced rather than logged and forgotten.
    console.warn('NiFo: could not save state', err);
    if (!saveFailed) {
      saveFailed = true;
      toast('Could not save — device storage is full. Export a backup and clear some space.');
    }
  }
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(fn) {
  fn(state);
  save();
  return state;
}

export function setSetting(key, value) {
  return update((s) => {
    s.settings[key] = value;
  });
}

export function reset() {
  state = blank();
  save();
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

/** Restores a backup. `keepVault` holds on to the gallery key already on this
 *  device — without it, importing a backup made on another phone would leave
 *  the photos here encrypted under a key nothing knows any more. */
export function importJson(text, { keepVault = false } = {}) {
  if (typeof text !== 'string' || text.length > 50e6) throw new Error('That file is too large to be a NiFo backup');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) {
    throw new Error('Not a NiFo backup file');
  }
  const existingVault = state.pe.vault;
  state = hydrate(parsed);
  if (keepVault) state.pe.vault = existingVault;
  save();
  return { vaultChanged: !keepVault && JSON.stringify(existingVault) !== JSON.stringify(state.pe.vault) };
}

/** True when the incoming backup would orphan photos already on this device. */
export function backupChangesVault(text) {
  try {
    const incoming = JSON.parse(text)?.pe?.vault ?? null;
    return JSON.stringify(incoming) !== JSON.stringify(state.pe.vault);
  } catch {
    return false;
  }
}

/* ---------- date helpers (local time, not UTC — a session at 23:50 belongs to
   the day you did it, not to tomorrow) ---------- */

export function dayKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function sessionsOn(key) {
  return state.sessions.filter((s) => s.date === key);
}

export function todaysSessions() {
  return sessionsOn(dayKey());
}

export function lastSession() {
  return state.sessions.length ? state.sessions[state.sessions.length - 1] : null;
}

/** Consecutive days ending today (or yesterday, if today is not done yet)
 *  that have at least one entry in `dates`. */
export function streakOver(dates) {
  const done = dates instanceof Set ? dates : new Set(dates);
  if (!done.size) return 0;
  let cursor = dayKey();
  if (!done.has(cursor)) cursor = addDays(cursor, -1);
  let n = 0;
  while (done.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** A day counts toward the streak if it has any session, or if it is a
 *  scheduled release day that was honoured (rest is part of the program). */
export function streak() {
  const done = new Set(state.sessions.map((s) => s.date));
  if (!done.size) return 0;
  let cursor = dayKey();
  // Today not being done yet must not break a streak that is still alive.
  if (!done.has(cursor)) cursor = addDays(cursor, -1);
  let n = 0;
  while (done.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function totals() {
  return state.sessions.reduce(
    (acc, s) => {
      acc.sessions++;
      acc.contractions += s.totals?.contractions || 0;
      acc.tutMs += s.totals?.tutMs || 0;
      return acc;
    },
    { sessions: 0, contractions: 0, tutMs: 0 }
  );
}
