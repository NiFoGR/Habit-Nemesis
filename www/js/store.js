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
  };
}

// Merge saved state over the blank shape so new fields added in later versions
// appear on old saves instead of coming back undefined.
function hydrate(saved) {
  const base = blank();
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    program: { ...base.program, ...(saved.program || {}) },
    prs: { ...base.prs, ...(saved.prs || {}) },
    sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
    badges: Array.isArray(saved.badges) ? saved.badges : [],
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
