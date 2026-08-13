// Persistence layer. Everything lives on-device in localStorage — no accounts,
// no network, nothing leaves the phone.

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

// Merge saved state over the blank shape so new fields added in later versions
// appear on old saves instead of coming back undefined.
function hydrate(saved) {
  const base = blank();
  if (!saved || typeof saved !== 'object') return base;
  const savedPe = saved.pe || {};
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    program: { ...base.program, ...(saved.program || {}) },
    prs: { ...base.prs, ...(saved.prs || {}) },
    sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
    badges: Array.isArray(saved.badges) ? saved.badges : [],
    pe: {
      ...base.pe,
      ...savedPe,
      settings: { ...base.pe.settings, ...(savedPe.settings || {}) },
      prs: { ...base.pe.prs, ...(savedPe.prs || {}) },
      sessions: Array.isArray(savedPe.sessions) ? savedPe.sessions : [],
      measurements: Array.isArray(savedPe.measurements) ? savedPe.measurements : [],
      achievements: Array.isArray(savedPe.achievements) ? savedPe.achievements : [],
    },
    v: SCHEMA,
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    return hydrate(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return blank();
  }
}

export function get() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('NiFo: could not save state', err);
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

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('Not a NiFo backup file');
  state = hydrate(parsed);
  save();
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
