// Persistence. localStorage on device, no account, nothing leaves the phone.

import { toast, setFeedback } from './ui.js';
import { BOOKS } from './bible/canon.js';

// Canon limits, so a saved file cannot smuggle in a fake book or chapter.
const CANON_LIMITS = BOOKS.map((b) => [b.id, b.chapters.length]);

// Duplicated, not imported: the sanitiser cannot depend on a feature.
const BREATHE_PATTERNS = ['exhale', 'coherent', '478'];

// Closed sets. A colour id lands in a style attribute, free text would be a hole.
const HABIT_COLOURS = ['teal', 'mint', 'lime', 'amber', 'orange', 'clay', 'rose', 'red', 'violet', 'indigo', 'sky', 'slate'];
const HABIT_KINDS = ['yesno', 'number'];
const HABIT_TARGET_TYPES = ['atleast', 'atmost'];

// The ladder, low to high.
const ARENA_DIVISIONS = ['bottom', 'npc', 'prospect', 'contender', 'menace', 'locked', 'topg'];

const KEY = 'nifo.state.v1';
const SCHEMA = 1;

function blank() {
  return {
    v: SCHEMA,
    createdAt: Date.now(),
    settings: {
      inputMode: 'hold', // 'hold' = press-and-hold tracking, 'auto' = hands-free
      haptics: true,
      sound: true,
      discreet: false, // renames the Kegels section to "Core Training"
      restDay: 0, // 0 = Sunday
      dailyTarget: 2, // sessions per day the program asks for
      reminder: '', // 'HH:MM' or '' for off
      appLock: false, // require the PIN to open the whole app, not just the gallery
      tutorialDone: false, // the one-off technique walkthrough
      weeklyReviewSeen: '', // dayKey of the last weekly review dismissed
      // 0 locked, 1 unlocked, 2 burned. See nifo.js.
      nifoOnly: 0,
      onboarded: false, // the introduction has been seen at least once
    },
    program: {
      level: 1,
      qualifying: 0, // consecutive level-standard sessions banked toward promotion
      deload: 0, // sessions remaining at reduced targets
      startedAt: Date.now(),
      levelStartedAt: Date.now(),
      history: [{ level: 1, at: Date.now() }],
    },
    sessions: [],
    prs: { maxHoldMs: 0, tutMs: 0, score: 0, streak: 0 },

    // PE.
    pe: {
      settings: {
        units: 'cm',
        tensionKg: 5,
        stretchMin: 60,
        pumpMin: 15,
        kegelDuringPump: true,
        reminder: '',
        measureDay: 1, // day of the month the monthly check-in is due
        autoLockMin: 2, // gallery re-locks after this long
        safetyAck: false,
      },
      sessions: [],
      measurements: [],
      eq: [], // weekly erection-quality self-ratings, 1-10
      prs: { sessionMs: 0, weekMs: 0, bpel: 0, eg: 0, bpfsl: 0, streak: 0 },
      vault: null, // { salt, iv, check } once a gallery PIN is set
    },

    // Prayer. Morning and night, both required, so there is no target.
    pray: {
      settings: {
        lang: 'both', // 'en' | 'el' | 'both'
        morningAt: '07:00',
        eveningAt: '22:00',
        remind: true,
        largeText: false,
      },
      days: {}, // dayKey -> { morning: ts|null, evening: ts|null }
      custom: [], // prayers you added: { id, slot, title, el, en }
      streak: 0,
      best: 0,
    },

    // Bible. `read` is the lifetime record, `days` the per-day one. Kept apart so
    // unreading a chapter cannot erase the day beside it.
    bible: {
      settings: {
        remind: false,
        remindAt: '07:30',
        largeText: false,
      },
      read: {}, // bookId -> { chapterNumber: ts }
      days: {}, // dayKey -> { chapters: ['gen:1'] }
      position: { book: 'gen', ch: 1 }, // where the reader last had you
      streak: 0,
      best: 0,
    },

    // Wind-down. One record per day, nothing scored.
    breathe: {
      settings: {
        pattern: 'exhale', // 'exhale' | 'coherent' | '478'
        minutes: 5,
        sound: true,
        vibrate: true,
        remind: false,
        remindAt: '22:30',
      },
      days: {}, // dayKey -> { at, ms, pattern }
      streak: 0,
      best: 0,
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
        reverseDays: false, // the grid runs oldest to newest
        columns: 4, // day columns on the grid
        showLinked: true, // the other five features, read-only, at the top
      },
      groups: [], // { id, name, order, collapsed }
      items: [], // the habits themselves
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
      backfilled: false, // the one-time sweep that gives the Arena a history
      // Your face, taken on the week that became your best. { src, week, at }
      face: null,
    },

    // Night light. Settings only. On the APK the live copy is the service's.
    nightlight: {
      enabled: false,
      curve: 'gradual', // 'gradual' warms all day, 'flux' drops in the evening
      wakeAt: '07:00',
      sleepAt: '22:00',
      dayKelvin: 6500, // 6500K is neutral: no tint at all during the day
      nightKelvin: 2700,
      transitionMin: 60,
      intensity: 1, // 0..1, weakens the tint without moving the temperatures
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
/** Exact shape only. Date keys are object keys and get rendered. */
const dateKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : dayKey());
const id = (v, prefix) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : `${prefix}${Math.random().toString(36).slice(2)}`);
const b64 = (v) => (typeof v === 'string' && /^[A-Za-z0-9+/=]{1,4096}$/.test(v) ? v : null);
/** HH:MM and a real time: "99:99" fits the shape, then asks for hour 99. */
const timeStr = (v, dflt = '') => {
  if (typeof v !== 'string' || !/^\d{2}:\d{2}$/.test(v)) return dflt;
  const [h, m] = v.split(':').map(Number);
  return h <= 23 && m <= 59 ? v : dflt;
};

// Plausible cm range. Outside it is a typo or a unit mix-up.
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
    level: int(s.level, 1, 104, 1),
    type: oneOf(s.type, ['training', 'release', 'test', 'quick'], 'training'),
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
    // Retired types stay readable.
    type: oneOf(s.type, ['warmup', 'stretch', 'pump', 'jelq', 'clamp'], 'stretch'),
    durationSec: int(s.durationSec, 0, 86400, 0),
    plannedSec: int(s.plannedSec, 0, 86400, 0),
    tensionKg: numIn(s.tensionKg, 0.5, 10),
    // Legacy intensity fields. Read only, nothing writes them.
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
    eg: numIn(m.eg, MIN_CM, MAX_CM), // girth at the thickest point
    bpfsl: numIn(m.bpfsl, MIN_CM, MAX_CM),
    nbpel: numIn(m.nbpel, MIN_CM, MAX_CM),
    baseGirth: numIn(m.baseGirth, MIN_CM, MAX_CM), // girth at the very base
    photoId: typeof m.photoId === 'string' && /^p_[0-9]{1,20}$/.test(m.photoId) ? m.photoId : null,
    notes: str(m.notes, 500),
  };
}

// Merge over blank() so new fields appear on old saves.
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
      // !== false: a state saved before this key keeps the new default.
      sound: ss.sound !== false,
      discreet: bool(ss.discreet),
      restDay: int(ss.restDay, 0, 6, base.settings.restDay),
      dailyTarget: int(ss.dailyTarget, 1, 3, base.settings.dailyTarget),
      reminder: timeStr(ss.reminder),
      appLock: bool(ss.appLock),
      tutorialDone: bool(ss.tutorialDone),
      weeklyReviewSeen: /^\d{4}-\d{2}-\d{2}$/.test(ss.weeklyReviewSeen) ? ss.weeklyReviewSeen : '',
      // Both default the opposite way to blank(): reaching hydrate means a saved
      // state exists, so this install is already in use.
      nifoOnly: int(ss.nifoOnly, 0, 2, 1),
      onboarded: ss.onboarded !== false,
    },
    program: {
      level: int(sp.level, 1, 104, 1),
      qualifying: int(sp.qualifying, 0, 10, 0),
      deload: int(sp.deload, 0, 20, 0),
      startedAt: num(sp.startedAt, 0, 4e12) ?? Date.now(),
      levelStartedAt: num(sp.levelStartedAt, 0, 4e12) ?? num(sp.startedAt, 0, 4e12) ?? Date.now(),
      history: arr(sp.history, 200)
        .map((h) => ({ level: int(h?.level, 1, 104, 1), at: num(h?.at, 0, 4e12) ?? Date.now() }))
        .filter(Boolean),
    },
    sessions: arr(saved.sessions, MAX_SESSIONS).map(cleanKegelSession).filter(Boolean),
    prs: {
      maxHoldMs: int(saved.prs?.maxHoldMs, 0, 600000, 0),
      tutMs: int(saved.prs?.tutMs, 0, 1e9, 0),
      score: int(saved.prs?.score, 0, 100, 0),
      streak: int(saved.prs?.streak, 0, 100000, 0),
    },
    pe: {
      settings: {
        units: oneOf(ps.units, ['cm', 'in'], 'cm'),
        tensionKg: num(ps.tensionKg, 0.5, 10) ?? base.pe.settings.tensionKg,
        stretchMin: int(ps.stretchMin, 1, 180, base.pe.settings.stretchMin),
        pumpMin: int(ps.pumpMin, 1, 120, base.pe.settings.pumpMin),
        kegelDuringPump: ps.kegelDuringPump !== false,
        reminder: timeStr(ps.reminder),
        measureDay: int(ps.measureDay, 1, 28, base.pe.settings.measureDay),
        autoLockMin: int(ps.autoLockMin, 1, 10, base.pe.settings.autoLockMin),
        safetyAck: bool(ps.safetyAck),
      },
      sessions: arr(savedPe.sessions, MAX_SESSIONS).map(cleanPeSession).filter(Boolean),
      measurements: arr(savedPe.measurements, MAX_SESSIONS).map(cleanMeasurement).filter(Boolean),
      eq: arr(savedPe.eq, 2000)
        .map((e) => ({ ts: num(e?.ts, 0, 4e12) ?? Date.now(), date: dateKey(e?.date), v: int(e?.v, 1, 10, 0) }))
        .filter((e) => e.v >= 1),
      prs: {
        sessionMs: int(savedPe.prs?.sessionMs, 0, 1e9, 0),
        weekMs: int(savedPe.prs?.weekMs, 0, 1e9, 0),
        bpel: numIn(savedPe.prs?.bpel, 0, MAX_CM) ?? 0,
        eg: numIn(savedPe.prs?.eg, 0, MAX_CM) ?? 0,
        bpfsl: numIn(savedPe.prs?.bpfsl, 0, MAX_CM) ?? 0,
        streak: int(savedPe.prs?.streak, 0, 100000, 0),
      },
      // Right-shaped base64, or no vault.
      vault: vault && b64(vault.salt) && b64(vault.iv) && b64(vault.check)
        ? { salt: b64(vault.salt), iv: b64(vault.iv), check: b64(vault.check) }
        : null,
    },
    pray: cleanPray(saved.pray, base.pray),
    bible: cleanBible(saved.bible, base.bible),
    breathe: cleanBreathe(saved.breathe, base.breathe),
    habits: cleanHabits(saved.habits, base.habits),
    arena: cleanArena(saved.arena, base.arena),
    nightlight: cleanNightlight(saved.nightlight, base.nightlight),
  };
}

/** Night light. Clamped to what the filter can use, not just to type. */
function cleanNightlight(sn, base) {
  const src = sn && typeof sn === 'object' ? sn : {};
  return {
    enabled: bool(src.enabled),
    curve: oneOf(src.curve, ['gradual', 'flux'], base.curve),
    wakeAt: timeStr(src.wakeAt, base.wakeAt),
    sleepAt: timeStr(src.sleepAt, base.sleepAt),
    dayKelvin: int(src.dayKelvin, 1900, 6500, base.dayKelvin),
    nightKelvin: int(src.nightKelvin, 1900, 6500, base.nightKelvin),
    transitionMin: int(src.transitionMin, 1, 240, base.transitionMin),
    intensity: num(src.intensity, 0, 1) ?? base.intensity,
  };
}

/** Bible. Books and chapters checked against the canon, not against a pattern. */
function cleanBible(sb, base) {
  const src = sb && typeof sb === 'object' ? sb : {};
  const bs = src.settings && typeof src.settings === 'object' ? src.settings : {};
  const limits = new Map(CANON_LIMITS);

  const read = {};
  const rawRead = src.read && typeof src.read === 'object' ? src.read : {};
  for (const [book, chapters] of Object.entries(rawRead).slice(0, 200)) {
    const max = limits.get(book);
    if (!max || !chapters || typeof chapters !== 'object') continue;
    const kept = {};
    for (const [ch, ts] of Object.entries(chapters).slice(0, 200)) {
      const n = Number(ch);
      if (!Number.isInteger(n) || n < 1 || n > max) continue;
      kept[n] = num(ts, 0, 4e12) ?? Date.now();
    }
    if (Object.keys(kept).length) read[book] = kept;
  }

  const validUnit = (u) => {
    if (typeof u !== 'string') return false;
    const [book, ch] = u.split(':');
    const max = limits.get(book);
    return !!max && /^\d{1,3}$/.test(ch || '') && +ch >= 1 && +ch <= max;
  };

  const days = {};
  const rawDays = src.days && typeof src.days === 'object' ? src.days : {};
  for (const [k, v] of Object.entries(rawDays).slice(0, 20000)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
    const chapters = arr(v.chapters, 400).filter(validUnit);
    if (chapters.length) days[k] = { chapters };
  }

  // The position indexes into the canon, so check it too.
  const rawPos = src.position && typeof src.position === 'object' ? src.position : {};
  const posMax = limits.get(rawPos.book);
  const position = posMax
    ? { book: rawPos.book, ch: int(rawPos.ch, 1, posMax, 1) }
    : { ...base.position };

  return {
    settings: {
      remind: bool(bs.remind),
      remindAt: timeStr(bs.remindAt, base.settings.remindAt),
      largeText: bool(bs.largeText),
    },
    read,
    days,
    position,
    streak: int(src.streak, 0, 100000, 0),
    best: int(src.best, 0, 100000, 0),
  };
}

/** Wind-down. One entry per day. A day with no time is not a day. */
function cleanBreathe(sb, base) {
  const src = sb && typeof sb === 'object' ? sb : {};
  const bs = src.settings && typeof src.settings === 'object' ? src.settings : {};

  const days = {};
  const raw = src.days && typeof src.days === 'object' ? src.days : {};
  for (const [k, v] of Object.entries(raw).slice(0, 20000)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
    const ms = int(v.ms, 0, 86400000, 0);
    if (!ms) continue;
    days[k] = {
      at: num(v.at, 0, 4e12) ?? Date.now(),
      ms,
      pattern: oneOf(v.pattern, BREATHE_PATTERNS, base.settings.pattern),
    };
  }

  return {
    settings: {
      pattern: oneOf(bs.pattern, BREATHE_PATTERNS, base.settings.pattern),
      minutes: int(bs.minutes, 3, 20, base.settings.minutes),
      sound: bs.sound !== false,
      vibrate: bs.vibrate !== false,
      remind: bool(bs.remind),
      remindAt: timeStr(bs.remindAt, base.settings.remindAt),
    },
    days,
    streak: int(src.streak, 0, 100000, 0),
    best: int(src.best, 0, 100000, 0),
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
      return gid ? { id: gid, name: str(g?.name, 40), order: int(g?.order, 0, 1000, 0), collapsed: bool(g?.collapsed) } : null;
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
      showLinked: hs.showLinked !== false,
    },
    groups,
    items,
    entries,
  };
}

/** Prayer. `days` is a map; keys validated as dates. */
function cleanPray(sp, base) {
  const src = sp && typeof sp === 'object' ? sp : {};
  const ps = src.settings && typeof src.settings === 'object' ? src.settings : {};

  const days = {};
  const raw = src.days && typeof src.days === 'object' ? src.days : {};
  for (const [k, v] of Object.entries(raw).slice(0, 20000)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
    const morning = num(v.morning, 0, 4e12);
    const evening = num(v.evening, 0, 4e12);
    if (morning == null && evening == null) continue;
    days[k] = { morning: morning ?? null, evening: evening ?? null };
  }

  return {
    settings: {
      lang: oneOf(ps.lang, ['en', 'el', 'both'], base.settings.lang),
      morningAt: timeStr(ps.morningAt, base.settings.morningAt),
      eveningAt: timeStr(ps.eveningAt, base.settings.eveningAt),
      remind: ps.remind !== false,
      largeText: bool(ps.largeText),
    },
    days,
    custom: arr(src.custom, 200)
      .map((c) => ({
        id: id(c?.id, 'c_'),
        slot: oneOf(c?.slot, ['morning', 'evening'], 'morning'),
        title: str(c?.title, 80),
        el: str(c?.el, 4000),
        en: str(c?.en, 4000),
      }))
      .filter((c) => c.el || c.en),
    streak: int(src.streak, 0, 100000, 0),
    best: int(src.best, 0, 100000, 0),
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
    console.warn('NiFo: could not save state', err);
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

const SNAP = 'nifo.snap.';
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
  return importJson(text, { keepVault: true });
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

/** Restore. `keepVault` keeps this device's gallery key. */
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

/** Would this backup orphan photos already here? */
export function backupChangesVault(text) {
  try {
    const incoming = JSON.parse(text)?.pe?.vault ?? null;
    return JSON.stringify(incoming) !== JSON.stringify(state.pe.vault);
  } catch {
    return false;
  }
}

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

/* ---------------- dates (local, not UTC) ---------------- */

/** Consecutive days ending today, or yesterday if today is not done yet. */
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

/** A session, or an honoured release day. */
export function streak() {
  const done = new Set(state.sessions.map((s) => s.date));
  if (!done.size) return 0;
  let cursor = dayKey();
  // Today unfinished must not break a live streak.
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
