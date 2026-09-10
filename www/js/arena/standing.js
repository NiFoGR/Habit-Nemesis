// Where you stand, as one component: the badge, and the climb out of it.
//
// The badge is the way into the ladder, so the row of pips and the link under
// them are gone. "4th of 9" said the same thing three times over.

import * as arena from './program.js';
import { escapeHtml, pct } from '../ui.js';
import { icon } from '../icons.js';
import { crest, UNRANKED } from './crest.js';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const CREST = 68;
const GOAL_CREST = 34;

const width = (v) => (Math.max(0, Math.min(v, 1)) * 100).toFixed(1);
const monthName = () =>
  new Date(`${arena.currentMonth()}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long' });

/* ---- the one bar ---- */

/** The screen's bar. `ghost` marks a rival on the same scale. */
export function rail(frac, { tone = '', ghost = null } = {}) {
  return `<span class="ar-rail ${tone}">
    <i style="width:${width(frac)}%"></i>
    ${ghost == null ? '' : `<u style="left:${width(ghost)}%"></u>`}
  </span>`;
}

/* ---- the badge ---- */

/** Crest, division, rung, and the way to the nine. `rung` is trusted HTML. */
function badge(art, name, rung, label) {
  return `<a class="ar-badge" href="#/arena/divisions" aria-label="${escapeHtml(label)}">
    <span class="ar-badge-art">${art}</span>
    <div class="ar-badge-who"><h1>${escapeHtml(name)}</h1><i>${rung}</i></div>
    <span class="ar-badge-go">${icon('back', 16)}</span>
  </a>`;
}

/* ---- the climb ---- */

/** What the track ends at: the rung above, or your own back when the month is
 *  under its bar. Lit once the month has earned it. */
function goalHtml(rung, lit) {
  if (rung == null) return '<span class="ar-goal top"><b>The top</b></span>';
  return `<span class="ar-goal ${lit ? 'lit' : ''}">
    ${crest(arena.divisionIndex(rung.id), GOAL_CREST)}<b>${escapeHtml(rung.name)}</b>
  </span>`;
}

/** The month inside its division, as one track. Below your own bar it runs to
 *  that bar, because holding the rung is the whole job before the next one is.
 *  Never 0 to 100: that put every threshold a few pixels from the last. */
function climbHtml(st) {
  const s = st.month.score;
  const under = s < st.division.bar;
  const rung = under ? st.division : st.next;
  const from = under ? 0 : st.next ? st.division.bar : st.below?.bar || 0;
  const to = under ? st.division.bar : st.next ? st.next.bar : 1;
  const tone = under ? 'down' : s >= to ? 'up' : '';
  return `<div class="ar-climb">
    <div class="ar-climb-head">
      ${st.month.empty ? '' : `<p class="ar-now"><b>${pct(s)}</b><i>${escapeHtml(monthName())}</i></p>`}
      ${goalHtml(rung, tone === 'up')}
    </div>
    ${rail((s - from) / Math.max(0.01, to - from), { tone })}
    <p class="ar-pace">${st.month.empty ? 'Nothing scored this month yet.' : escapeHtml(paceLine(st, under))}</p>
  </div>`;
}

/** The one line the bar cannot draw: what the weeks left have to average.
 *  Nobody can work this out for themselves, so it is never cut. */
function paceLine(st, under) {
  const hold = arena.needFromHere(st.division.bar);
  const up = st.next ? arena.needFromHere(st.next.bar) : null;
  if (!hold) return '';
  const weeks = hold.weeks === 1 ? 'One more week' : `${hold.weeks} more weeks`;

  // Promotion while it is still reachable, then the floor. A need at or below
  // zero is already banked: -94% is not a target. The crest at the end of the
  // track names the rung, so no line here repeats it.
  if (!under && up) {
    if (up.need <= 0) return 'Nothing can lose it now.';
    if (up.need <= 1) return up.need <= st.month.score ? `${weeks} at this pace.` : `Needs ${pct(up.need)} a week.`;
  }
  if (hold.need <= 0) {
    return st.notice ? 'The notice clears at the end of the month.' : `${st.division.name} is safe whatever happens.`;
  }
  // Out of reach is a settled month, so it is reported as one.
  if (hold.need > 1) {
    return st.notice ? `${st.below?.name || 'The floor'} next month.` : 'A notice at the end of the month.';
  }
  if (st.notice) return `Needs ${pct(hold.need)} a week to clear the notice.`;
  return under ? `Needs ${pct(hold.need)} a week.` : `${pct(hold.need)} a week holds ${st.division.name}.`;
}

/* ---- no record yet ---- */

/** No division, no opponent, no cup. A countdown, and what today's marking
 *  would place you into. */
function unranked() {
  const left = arena.daysLeftInWeek();
  const days = `${left} day${left === 1 ? '' : 's'} to your first score`;
  const live = arena.scoreWeek(arena.currentWeek());
  const going = live.void ? null : arena.divisionForScore(live.score);
  return `${badge(crest(UNRANKED, CREST), 'Unranked', escapeHtml(days), `Unranked, ${days}. See every division`)}
    ${going ? `<p class="ar-pace lone">Stop here and you go in at ${escapeHtml(going.name)}.</p>` : ''}`;
}

/* ---- the head of the Arena ---- */

export function standingHtml() {
  const st = arena.standing();
  if (st.unranked) return unranked();

  const at = arena.divisionIndex(st.division.id);
  const rung = `${ORDINAL[at] || at + 1} of ${arena.DIVISIONS.length}`;
  const state = st.notice ? 'On Notice' : st.placed ? 'Holding' : 'Placement month';
  return badge(
    crest(at, CREST),
    st.division.name,
    `${rung} · <em class="${st.notice ? 'notice' : ''}">${state}</em>`,
    `${st.division.name}, ${rung} divisions, ${state}. See every division`
  ) + climbHtml(st);
}

/** The rung, so the page can tune its glow to how high you have climbed. */
export const rungOf = () => {
  const st = arena.standing();
  return st.unranked ? 0 : arena.divisionIndex(st.division.id);
};
