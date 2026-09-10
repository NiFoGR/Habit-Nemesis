// The head to head. He is your best week, so everything he has comes out of the
// weeks already stored: who each one drew, what it scored, and what it settled.
// Nothing about him is written down, because nothing about him is invented.

import { currentWeek, weekStart, nextWeek } from './calendar.js';
import { playedWeeks, storedWeeks } from './scoring.js';
import { fixtureFor } from './fixtures.js';

/** The Arc final is the Nemesis under another name. */
const HIS = new Set(['nemesis', 'final']);
const MS_WEEK = 7 * 864e5;

/** Whole weeks from one key to another. Both ends parse as UTC midnight, so no
 *  clock change can round this to the wrong number. */
const between = (a, b) => Math.max(0, Math.round((Date.parse(weekStart(b)) - Date.parse(weekStart(a))) / MS_WEEK));

/* --------------------- the record --------------------- */

/** Every week you played him, oldest first. */
function meetings() {
  return Object.entries(storedWeeks())
    .filter(([, w]) => HIS.has(w.opponent) && (w.result === 'won' || w.result === 'lost'))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, w]) => ({ key, won: w.result === 'won', score: w.score, his: w.oppScore ?? 0 }));
}

/** Wins, losses, the run either way, and what the last meeting was decided by.
 *  `run` is signed: 2 is two of yours, -2 is two of his. */
export function headToHead() {
  const list = meetings();
  let w = 0;
  let l = 0;
  let run = 0;
  let best = 0;
  let lastWon = '';
  let lastLost = '';
  for (const m of list) {
    if (m.won) {
      w++;
      run = run > 0 ? run + 1 : 1;
      lastWon = m.key;
    } else {
      l++;
      run = run < 0 ? run - 1 : -1;
      lastLost = m.key;
    }
    if (run > best) best = run;
  }
  const last = list[list.length - 1] || null;
  return {
    met: list.length,
    w,
    l,
    run,
    best,
    lastWon,
    lastLost,
    last: last ? last.key : '',
    by: last ? Math.round((last.score - last.his) * 100) : 0,
  };
}

/** Weeks since you last beat him, or null with none on the record. */
export function sinceWin() {
  const { lastWon } = headToHead();
  return lastWon ? between(lastWon, currentWeek()) : null;
}

/* --------------------- the succession --------------------- */

/** Every week that was the best on the record when it landed, oldest first.
 *  The last is the Nemesis, the rest are the ones he replaced. `held` is the
 *  weeks it stood before a better one took it. */
export function reigns() {
  const out = [];
  let high = -1;
  // playedWeeks() is newest first, and a running maximum only reads forwards.
  for (const wk of playedWeeks().slice().reverse()) {
    if (wk.score <= high) continue;
    high = wk.score;
    out.push({ key: wk.key, score: wk.score });
  }
  const now = currentWeek();
  return out.map((r, i) => ({
    ...r,
    held: between(r.key, out[i + 1] ? out[i + 1].key : now),
    current: i === out.length - 1,
  }));
}

/** Times he has been replaced. The first best week took the title off nobody. */
export const deposed = () => Math.max(0, reigns().length - 1);

/** Weeks the one you have now has stood. */
export function holding() {
  const list = reigns();
  return list.length ? list[list.length - 1].held : 0;
}

/* --------------------- the next meeting --------------------- */

/** The next week that draws him, and how many weeks off it is. 0 is this week.
 *  Asked of the real fixture rather than the rotation, so a cup final counts. */
export function nextMeeting(from = currentWeek()) {
  let key = from;
  for (let away = 0; away < 10; away++) {
    const f = fixtureFor(key);
    if (f.id === 'nemesis' || f.knockout === 'final') return { key, away };
    key = nextWeek(key);
  }
  return null;
}
