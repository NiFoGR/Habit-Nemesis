// Where you stand: the crest, the division by name, the ladder, and the one
// number the rest of the month has to average.
//
// The division's name is the most important fact on the Arena and it used to be
// reachable only by opening another screen. It leads now.

import * as arena from './program.js';
import { escapeHtml, pct } from '../ui.js';
import { icon } from '../icons.js';
import { crest, UNRANKED } from './crest.js';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

/** One pip per division, the way into the full ladder. */
function pips(at) {
  return `<span class="ar-pips" aria-hidden="true">${arena.DIVISIONS.map(
    (d, i) => `<i class="${at != null && i <= at ? 'on' : ''} ${i === at ? 'here' : ''}" title="${escapeHtml(d.name)}"></i>`
  ).join('')}</span>`;
}

/** The month inside your division: floor left, next rung right. A 0-100 bar
 *  put every threshold within a few pixels of the last. */
function barToNext(st) {
  const s = st.month.score;
  const floor = st.division.bar;
  const roof = st.next ? st.next.bar : 1;
  const span = Math.max(0.01, roof - floor);
  const at = Math.max(0, Math.min((s - floor) / span, 1));
  // The readout stops short of both ends, or half of it hangs off.
  const label = Math.min(92, Math.max(8, at * 100));
  const state = s >= roof ? 'up' : st.safe ? 'safe' : 'down';
  return `<div class="ar-progress">
    <div class="ar-bar ${state}">
      <div class="ar-bar-fill" style="width:${(at * 100).toFixed(1)}%"></div>
      <b class="ar-bar-now" style="left:${label.toFixed(1)}%">${pct(s)}</b>
    </div>
    <div class="ar-bar-ends">
      <span>${escapeHtml(st.division.name)} · ${pct(floor)}</span>
      <span>${st.next ? `${escapeHtml(st.next.name)} · ${pct(roof)}` : 'the top'}</span>
    </div>
    ${needLine(st)}
  </div>`;
}

/** The number the rest of the month has to average. The most useful line on
 *  the screen and the one nobody could work out for themselves. */
function needLine(st) {
  const hold = arena.needFromHere(st.division.bar);
  const up = st.next ? arena.needFromHere(st.next.bar) : null;
  if (!hold) return '';
  const weeks = hold.weeks === 1 ? 'this week' : `each of the ${hold.weeks} weeks left`;

  // Promotion first while it is still reachable, then the floor. A need at or
  // below zero is already banked and is never printed: -94% is not a target.
  if (up && up.need > 0 && up.need <= 1) {
    return `<p class="ar-need up">${pct(up.need)} ${escapeHtml(weeks)} takes you to ${escapeHtml(st.next.name)}.</p>`;
  }
  if (up && up.need <= 0) return '';
  if (hold.need <= 0) return `<p class="ar-need safe">${escapeHtml(st.division.name)} is safe whatever happens.</p>`;
  if (hold.need > 1) return `<p class="ar-need down">${escapeHtml(st.division.name)} is out of reach this month.</p>`;
  return `<p class="ar-need">${pct(hold.need)} ${escapeHtml(weeks)} holds ${escapeHtml(st.division.name)}.</p>`;
}

/** No record yet: no division, no opponent, no cup. A countdown instead, and
 *  what today's marking would place you into. */
function unranked() {
  const left = arena.daysLeftInWeek();
  const live = arena.scoreWeek(arena.currentWeek());
  const going = live.void ? null : arena.divisionForScore(live.score);
  return `<div class="ar-standing unranked">
    <span class="ar-crest">${crest(UNRANKED, 92)}</span>
    <div class="ar-titles">
      <h1>Unranked</h1>
      <p class="ar-rung">${left} day${left === 1 ? '' : 's'} until your first week is scored</p>
    </div>
  </div>
  <a class="ar-ladder-link" href="#/arena/divisions">${pips(null)}<span>See the nine divisions ${icon('back', 12)}</span></a>
  <p class="ar-need${going ? ' up' : ''}">${going
    ? `Marking stops here and you go in at ${escapeHtml(going.name)}.`
    : 'Mark anything on the grid and this becomes a real number.'}</p>`;
}

/** The head of the Arena. Crest, division, rung, ladder, and the month's bar. */
export function standingHtml() {
  const st = arena.standing();
  if (st.unranked) return unranked();

  const at = arena.divisionIndex(st.division.id);
  return `<div class="ar-standing">
    <span class="ar-crest">${crest(at, 92).replace('alt="" aria-hidden="true"', `alt="${escapeHtml(st.division.name)}"`)}</span>
    <div class="ar-titles">
      <h1>${escapeHtml(st.division.name)}</h1>
      <p class="ar-rung">${ORDINAL[at] || at + 1} of ${arena.DIVISIONS.length} · ${
        st.placed ? 'holding' : 'placement month'
      }</p>
    </div>
  </div>
  <a class="ar-ladder-link" href="#/arena/divisions"
     aria-label="Division ${escapeHtml(st.division.name)}, ${at + 1} of ${arena.DIVISIONS.length}. See every division">
    ${pips(at)}<span>See the nine divisions ${icon('back', 12)}</span>
  </a>
  ${st.month.empty ? '<p class="ar-need">Nothing scored this month yet.</p>' : barToNext(st)}`;
}

/** The rung, so the page can tune its glow to how high you have climbed. */
export const rungOf = () => {
  const st = arena.standing();
  return st.unranked ? 0 : arena.divisionIndex(st.division.id);
};
