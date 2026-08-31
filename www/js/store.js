// Persistence. localStorage on the device. An account is optional and copies
// this record to it; Android's own backup copies it to the user's Google
// account. www/legal/privacy.html is the full account of where it goes.

import { toast, setFeedback } from './ui.js';

// Closed sets. A colour id lands in a style attribute, free text would be a hole.
const HABIT_COLOURS = ['teal', 'mint', 'lime', 'amber', 'orange', 'clay', 'rose', 'red', 'violet', 'indigo', 'sky', 'slate'];
const HABIT_KINDS = ['yesno', 'number'];
const HABIT_TARGET_TYPES = ['atleast', 'atmost'];

// The ladder, low to high.
// The ladder, second copy. store.js cannot import arena/program.js, which
// imports it back, so a rung added there must be added here. check:arena
// fails if the two drift.
const ARENA_DIVISIONS = ['bottom', 'npc', 'prospect', 'contender', 'menace', 'mentzer', 'locked', 'topg', 'full'];

const KEY = 'habitnemesis.state.v1';
const SCHEMA = 1;

function blank() {
  return {
    v: SCHEMA,
    createdAt: Date.now(),
    settings: {
      haptics: true,
      sound: true,
      appLock: false, // ask for the PIN on open
      lock: null, // { salt, iv, check } once a PIN is set. See lock.js.
      onboarded: false, // the introduction has been seen at least once
      // ISO time of the last write to or from the account. Device-local: it
      // describes this copy, so it never travels with the record.
      syncedAt: '',
    },
    // Habits. `entries` is habit id, then day. Streaks and scores are computed on
    // read, never stored: the past is editable here.
    habits: {
      settings: {
        firstDay: 1, // 0 = Sunday
        dayStartHour: 0, // 3 = a new day begins at 03:00, for this section only
        shortPress: true, // a single tap marks, instead of press-and-hold
        skipDays: false, // toggle again for a skip: keeps the score and the streak
        unknownMarks: false, // draw days with no data differently from lapses
        reverseDays: false, // off: today first. On: oldest first
        columns: 4, // day columns on the grid
      },
      groups: [], // { id, name, order, collapsed, updatedAt }
      items: [], // the habits themselves, each stamped updatedAt
      entries: {}, // habitId -> { dayKey: value }, -1 skip, 0 lapse, else done
    },

    // Arena. The one slice that stores what it could derive: a closed week is a
    // historical fact, not a view. Anything live is still computed on read.
    arena: {
      division: 'npc', // where you currently sit on the ladder
      placed: false, // the first completed month places you and cannot relegate
      // 'YYYY-Www' -> { score, done, due, opponent, oppName, oppScore, result, arc }
      // result: won | lost | void | record | null. 'record' predates the Arena.
      weeks: {},
      months: {}, // 'YYYY-MM' -> { score, w, l, from, to, move }
      arcs: {}, // 'YYYY-season' -> { qualified, qf, sf, final, won }
      feats: {}, // featId -> the timestamp it was first earned
      // Fixed. A year is 365 days from here, so it must not drift.
      anchor: '',
      // Scoring rule version. A bump re-scores unplayed weeks only.
      scoring: 0,
      seenWeek: '', // the last closed week whose result screen was shown
      seenMonth: '', // the last month whose promotion or relegation was shown
      reviewed: '', // the last week whose review was opened
      placedWeek: '', // the first week you played, which set your division
      seenPlacement: '', // that week, once the placement screen has been shown
      backfilled: false, // the one-time sweep that gives the Arena a history
      // Your face, taken on the week that became your best. { src, week, at }
      face: null,
    },

  };
}

/* ---------------- input sanitising ---------------- */
// Saved state is untrusted and ends up in innerHTML. Coerce every value, drop
// unknown keys.

/** Settings: pull a silly value back into range. */
const num = (v, lo = -1e9, hi = 1e9) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
};
/** Measurements: drop out of range. Clamping would fabricate a data point. */
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
const b64 = (v) => (typeof v === 'string' && /^[A-Za-z0-9+/=]{1,4096}$/.test(v) ? v : null);
/** An ISO instant, or ''. Compared as a string, so the shape has to be exact. */
const isoStr = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(v) ? v : '');
/** HH:MM and a real time: "99:99" fits the shape, then asks for hour 99. */
const timeStr = (v, dflt = '') => {
  if (typeof v !== 'string' || !/^\d{2}:\d{2}$/.test(v)) return dflt;
  const [h, m] = v.split(':').map(Number);
  return h <= 23 && m <= 59 ? v : dflt;
};

// Merge over blank() so new fields appear on old saves.
function hydrate(saved) {
  const base = blank();
  if (!saved || typeof saved !== 'object') return base;
  const ss = saved.settings || {};
  const lk = ss.lock;

  return {
    v: SCHEMA,
    createdAt: num(saved.createdAt, 0, 4e12) ?? Date.now(),
    settings: {
      // !== false: a state saved before this key keeps the new default.
      haptics: ss.haptics !== false,
      sound: ss.sound !== false,
      appLock: bool(ss.appLock),
      // Right-shaped base64, or no PIN.
      lock: lk && b64(lk.salt) && b64(lk.iv) && b64(lk.check)
        ? { salt: b64(lk.salt), iv: b64(lk.iv), check: b64(lk.check) }
        : null,
      // Defaults the opposite way to blank(): reaching hydrate means a saved
      // state exists, so this install is already in use.
      onboarded: ss.onboarded !== false,
      syncedAt: isoStr(ss.syncedAt),
    },
    habits: cleanHabits(saved.habits, base.habits),
    arena: cleanArena(saved.arena, base.arena),
  };
}

/** Arena. Stored facts, not a cache. Period keys are checked by shape and
 *  dropped, never defaulted: defaulting would rewrite a real season. */
function cleanArena(sa, base) {
  const src = sa && typeof sa === 'object' ? sa : {};
  const pctOf = (v) => num(v, 0, 1) ?? 0;

  const weeks = {};
  const rawWeeks = src.weeks && typeof src.weeks === 'object' ? src.weeks : {};
  for (const [k, v] of Object.entries(rawWeeks).slice(0, 600)) {
    if (!/^\d{4}-W\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
    weeks[k] = {
      score: pctOf(v.score),
      due: int(v.due, 0, 100000, 0),
      done: num(v.done, 0, 100000) ?? 0,
      // 'record' is a pre-Arena week: a performance, never a result.
      opponent: str(v.opponent, 40),
      oppName: str(v.oppName, 40),
      oppScore: v.oppScore == null ? null : pctOf(v.oppScore),
      result: oneOf(v.result, ['won', 'lost', 'void', 'record'], null),
      arc: oneOf(v.arc, ['group', 'qf', 'sf', 'final'], null),
      // The only free text in the Arena. Capped hard, escaped everywhere.
      note: str(v.note, 140),
    };
  }

  const months = {};
  const rawMonths = src.months && typeof src.months === 'object' ? src.months : {};
  for (const [k, v] of Object.entries(rawMonths).slice(0, 200)) {
    if (!/^\d{4}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
    months[k] = {
      score: pctOf(v.score),
      w: int(v.w, 0, 10, 0),
      l: int(v.l, 0, 10, 0),
      from: oneOf(v.from, ARENA_DIVISIONS, base.division),
      to: oneOf(v.to, ARENA_DIVISIONS, base.division),
      move: oneOf(v.move, ['up', 'down', 'held', 'placed'], 'held'),
    };
  }

  const arcs = {};
  const rawArcs = src.arcs && typeof src.arcs === 'object' ? src.arcs : {};
  for (const [k, v] of Object.entries(rawArcs).slice(0, 80)) {
    if (!/^\d{4}-(winter|spring|summer|autumn)$/.test(k) || !v || typeof v !== 'object') continue;
    const round = (r) => oneOf(r, ['won', 'lost'], null);
    arcs[k] = {
      qualified: v.qualified === true ? true : v.qualified === false ? false : null,
      qf: round(v.qf),
      sf: round(v.sf),
      final: round(v.final),
      won: bool(v.won),
      note: str(v.note, 140),
      // Which arc ceremonies have been shown.
      sawOpen: bool(v.sawOpen),
      sawGroup: bool(v.sawGroup),
      sawCup: bool(v.sawCup),
    };
  }

  const feats = {};
  const rawFeats = src.feats && typeof src.feats === 'object' ? src.feats : {};
  for (const [k, v] of Object.entries(rawFeats).slice(0, 200)) {
    // Capitals allowed: feat ids are camelCase.
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(k)) continue;
    const ts = num(v, 0, 4e12);
    if (ts != null) feats[k] = ts;
  }

  // A 256px JPEG of you, so the Nemesis has a face. Only that shape passes: it
  // is interpolated into a src attribute, and 300KB is far more than 256px of
  // JPEG needs.
  const raw = src.face && typeof src.face === 'object' ? src.face : null;
  const data = typeof raw?.src === 'string' ? raw.src : '';
  const face = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data) && data.length <= 300000
    ? { src: data, week: /^\d{4}-W\d{2}$/.test(raw.week) ? raw.week : '', at: num(raw.at, 0, 4e12) ?? 0 }
    : null;

  return {
    division: oneOf(src.division, ARENA_DIVISIONS, base.division),
    placed: bool(src.placed),
    weeks,
    months,
    arcs,
    feats,
    face,
    anchor: /^\d{4}-\d{2}-\d{2}$/.test(src.anchor) ? src.anchor : '',
    scoring: int(src.scoring, 0, 1000, 0),
    seenWeek: /^\d{4}-W\d{2}$/.test(src.seenWeek) ? src.seenWeek : '',
    seenMonth: /^\d{4}-\d{2}$/.test(src.seenMonth) ? src.seenMonth : '',
    reviewed: /^\d{4}-W\d{2}$/.test(src.reviewed) ? src.reviewed : '',
    placedWeek: /^\d{4}-W\d{2}$/.test(src.placedWeek) ? src.placedWeek : '',
    seenPlacement: /^\d{4}-W\d{2}$/.test(src.seenPlacement) ? src.seenPlacement : '',
    backfilled: bool(src.backfilled),
  };
}

/** Habits. The only user-shaped slice.
 *  Bad habit id drops the habit: its record hangs off that id.
 *  Bad day key drops the entry: defaulting would pile junk onto today.
 *  Entries whose habit is gone are dropped. */
function cleanHabits(sh, base) {
  const src = sh && typeof sh === 'object' ? sh : {};
  const hs = src.settings && typeof src.settings === 'object' ? src.settings : {};
  const habitId = (v) => (typeof v === 'string' && /^h_[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null);
  const groupId = (v) => (typeof v === 'string' && /^g_[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null);

  const groups = arr(src.groups, 30)
    .map((g) => {
      const gid = groupId(g?.id);
      return gid
        ? {
            id: gid,
            name: str(g?.name, 40),
            order: int(g?.order, 0, 1000, 0),
            collapsed: bool(g?.collapsed),
            updatedAt: num(g?.updatedAt, 0, 4e12) ?? 0,
          }
        : null;
    })
    .filter(Boolean);
  const groupIds = new Set(groups.map((g) => g.id));

  const items = arr(src.items, 100)
    .map((h) => {
      const hid = habitId(h?.id);
      if (!hid) return null;
      // n in d is meaningless with n above d.
      const den = int(h?.freq?.den, 1, 365, 1);
      return {
        id: hid,
        name: str(h?.name, 60),
        question: str(h?.question, 120),
        notes: str(h?.notes, 500),
        colour: oneOf(h?.colour, HABIT_COLOURS, 'teal'),
        kind: oneOf(h?.kind, HABIT_KINDS, 'yesno'),
        unit: str(h?.unit, 20),
        target: num(h?.target, 0, 1e9) ?? 0,
        targetType: oneOf(h?.targetType, HABIT_TARGET_TYPES, 'atleast'),
        freq: { num: int(h?.freq?.num, 1, den, 1), den },
        group: groupIds.has(h?.group) ? h.group : '',
        remindAt: timeStr(h?.remindAt),
        remindDays: arr(h?.remindDays, 7)
          .map((d) => int(d, 0, 6, null))
          .filter((d) => d !== null),
        archived: bool(h?.archived),
        // When, not just that: the Arena locks its roster on Monday.
        archivedAt: num(h?.archivedAt, 0, 4e12),
        createdAt: num(h?.createdAt, 0, 4e12) ?? Date.now(),
        // Which of two copies of this habit is newer. Stamped on every write.
        updatedAt: num(h?.updatedAt, 0, 4e12) ?? 0,
        order: int(h?.order, 0, 1000, 0),
      };
    })
    .filter((h) => h && h.name);
  const itemIds = new Set(items.map((h) => h.id));

  const entries = {};
  const rawEntries = src.entries && typeof src.entries === 'object' ? src.entries : {};
  for (const [hid, days] of Object.entries(rawEntries).slice(0, 100)) {
    if (!itemIds.has(hid) || !days || typeof days !== 'object') continue;
    const kept = {};
    for (const [k, v] of Object.entries(days).slice(0, 20000)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      const n = numIn(v, -1, 1e9);
      if (n === null) continue;
      kept[k] = n;
    }
    if (Object.keys(kept).length) entries[hid] = kept;
  }

  return {
    settings: {
      firstDay: int(hs.firstDay, 0, 6, base.settings.firstDay),
      dayStartHour: int(hs.dayStartHour, 0, 6, base.settings.dayStartHour),
      shortPress: hs.shortPress !== false,
      skipDays: bool(hs.skipDays),
      unknownMarks: bool(hs.unknownMarks),
      reverseDays: bool(hs.reverseDays),
      columns: int(hs.columns, 3, 7, base.settings.columns),
    },
    groups,
    items,
    entries,
  };
}

let state = load();
const listeners = new Set();

// Also at boot: a launch that never saves would leave ui.js on defaults.
setFeedback(state.settings);

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    return hydrate(JSON.parse(raw));
  } catch {
    return blank();
  } finally {
    // Write the cleaned copy back rather than re-parsing junk every launch.
    queueMicrotask(() => {
      try {
        if (raw !== null && JSON.stringify(state) !== raw) save();
      } catch {
        /* next save deals with it */
      }
    });
  }
}

export function get() {
  return state;
}

let saveFailed = false;

export function save() {
  // ui.js cannot import this module, so the feedback switches are pushed to it.
  setFeedback(state.settings);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (err) {
    // Surfaced, not logged: losing a session is the worst failure a tracker has.
    console.warn('Could not save state', err);
    if (!saveFailed) {
      saveFailed = true;
      toast('Storage is full. Export a backup and clear some space.');
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

/** The account holds this exact copy. Device-local, never exported. */
export function markSynced() {
  return update((s) => {
    s.settings.syncedAt = new Date().toISOString();
  });
}

export const lastSynced = () => state.settings.syncedAt || '';

export function setSetting(key, value) {
  return update((s) => {
    s.settings[key] = value;
  });
}

export function reset() {
  state = blank();
  save();
}

/* ---------------- restore points ---------------- */
// Every change already saves the moment it happens. This is the other half: one
// snapshot a day, so a bad import or a day of nonsense can be undone.
//
// It does not survive the app being uninstalled, and nothing kept inside the
// app can. Android's own backup is what carries the record off the device, and
// tools/patch-backup.mjs turns it on.

const SNAP = 'habitnemesis.snap.';
const SNAPS_KEPT = 3;
// Snapshots share localStorage with the state itself, so a big record keeps
// fewer of them rather than filling the quota and losing the lot.
const SNAP_MAX_BYTES = 400000;

export function snapshots() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(SNAP)) out.push({ day: k.slice(SNAP.length), key: k, bytes: (localStorage.getItem(k) || '').length });
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** Once a day, on boot. Returns the day it wrote, or '' when it did not. */
export function snapshot() {
  const day = dayKey();
  const key = SNAP + day;
  if (localStorage.getItem(key)) return '';
  const text = JSON.stringify(state);
  if (text.length > SNAP_MAX_BYTES) return '';
  try {
    localStorage.setItem(key, text);
  } catch {
    // Out of room. The state itself is what matters, so the snapshots go first.
    for (const s of snapshots()) localStorage.removeItem(s.key);
    return '';
  }
  for (const old of snapshots().slice(SNAPS_KEPT)) localStorage.removeItem(old.key);
  return day;
}

/** Roll back to a snapshot. Same path as an import, so it is sanitised too. */
export function restoreSnapshot(day) {
  const text = localStorage.getItem(SNAP + day);
  if (!text) throw new Error('That restore point is gone');
  return importJson(text);
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

/** Restore. The PIN is this device's, so a backup never carries one in. */
export function importJson(text) {
  if (typeof text !== 'string' || text.length > 50e6) throw new Error('That file is too large to be a backup');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.habits) {
    throw new Error('Not a Habit Nemesis backup file');
  }
  const { lock, appLock, syncedAt } = state.settings;
  state = hydrate(parsed);
  // All three describe this device, not the record, so they stay behind.
  state.settings.lock = lock;
  state.settings.appLock = appLock;
  state.settings.syncedAt = syncedAt;
  save();
}

/* ---------------- dates (local, not UTC) ---------------- */

export function dayKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

