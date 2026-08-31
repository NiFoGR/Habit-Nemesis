// This week's match.
//
// One track, two runners on it. Two numbers in two boxes made the reader do the
// subtraction; a shared axis puts the gap on screen as a distance. The gap is
// the headline, because "behind by 12" is what you act on and "68% vs 80%" is
// what you have to work out first.

import * as arena from './program.js';
import { faceAvatar } from './face.js';
import { rowsHtml } from './week-sheet.js';
import { escapeHtml, openSheet, haptic, pct } from '../ui.js';
import { icon } from '../icons.js';

const points = (v) => Math.round(v * 100);

/** Both bars share one scale so the longer one is visibly longer. Below 8% a
 *  fill is invisible, so a fresh 0% keeps a sliver to sit its label against. */
const width = (v) => Math.max(v > 0 ? 4 : 1.5, v * 100).toFixed(1);

/** Nothing is due yet: the fixture is not a contest, so it does not pretend to
 *  be one. No opponent, no 0%, no deficit invented before you have started. */
function notYet(key, left) {
  return `<section class="card ar-fixture waiting">
    <div class="ar-fx-head">
      <h2>This week</h2>
      <span class="pill ghost">${escapeHtml(arena.weekLabel(key))}</span>
    </div>
    <p class="ar-fx-none">Nothing is due yet. Put a row on the grid and this becomes a fixture.</p>
    <a class="btn ghost wide" href="#/habits">${icon('plus', 15)}<span>Go to the grid</span></a>
  </section>`;
}

export function fixtureHtml() {
  const key = arena.currentWeek();
  const live = arena.scoreWeek(key);
  const left = arena.daysLeftInWeek();
  if (live.void && !live.due) return notYet(key, left);

  const opp = arena.fixtureFor(key);
  const gap = points(live.score) - points(opp.score);
  const state = gap > 0 ? 'ahead' : gap < 0 ? 'behind' : 'level';
  const verdict = gap === 0 ? 'Level' : gap > 0 ? `Ahead by ${gap}` : `Behind by ${-gap}`;
  const hasFace = opp.id === 'nemesis' || opp.knockout === 'final';

  return `<section class="card ar-fixture ${state}">
    <div class="ar-fx-head">
      <h2>${opp.knockout ? escapeHtml(arena.KNOCKOUT[opp.knockout].name) : 'This week'}</h2>
      <span class="pill ghost">${escapeHtml(arena.weekLabel(key))}</span>
    </div>

    <div class="ar-track">
      <div class="ar-lane me">
        <span class="ar-lane-who"><i class="ar-dot"></i>You</span>
        <span class="ar-lane-bar"><i style="width:${width(live.score)}%"></i></span>
        <b>${pct(live.score)}</b>
      </div>
      <button class="ar-lane them" id="oppBtn" aria-label="${escapeHtml(opp.name)}, ${pct(opp.score)}">
        <span class="ar-lane-who">${hasFace ? faceAvatar(20) : '<i class="ar-dot"></i>'}${escapeHtml(opp.name)}</span>
        <span class="ar-lane-bar"><i style="width:${width(opp.score)}%"></i></span>
        <b>${pct(opp.score)}</b>
      </button>
    </div>

    <p class="ar-verdict">
      <b>${escapeHtml(verdict)}</b>
      <i>${left === 1 ? 'Last day' : `${left} days left`}</i>
    </p>

    ${live.rows.length
      ? `<div class="ar-rows">${rowsHtml(live.rows)}</div>`
      : '<p class="ar-fx-none">Nothing is due this week yet.</p>'}
  </section>`;
}

/** The opponent opens: a real week if it was one, an explanation if it is the bar. */
export function wireFixture(mount) {
  const btn = mount.querySelector('#oppBtn');
  if (!btn) return;
  const fixture = arena.fixtureFor(arena.currentWeek());
  btn.addEventListener('click', async () => {
    haptic('press');
    if (fixture.week) {
      const { openWeekSheet } = await import('./week-sheet.js');
      return openWeekSheet(fixture.week);
    }
    openSheet(`
      <h2>${escapeHtml(fixture.name)}</h2>
      <p class="muted small">${escapeHtml(fixture.blurb)}</p>
      <p>Your division's bar is ${pct(fixture.score)}. It stands in until the record can supply a real week. Every other rival is one you actually had.</p>
      <button class="btn wide" data-close>Close</button>`);
  });
}

/** The last eight results, as a strip. A "Form" heading over eight numbers is
 *  a word doing their job. */
export function formHtml(weeks) {
  const played = Object.entries(weeks)
    .filter(([k, w]) => k < arena.currentWeek() && (w.result === 'won' || w.result === 'lost'))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-8);
  if (!played.length) return '';
  return `<div class="ar-form">${played
    .map(([k, w]) => `<button class="ar-chip ${w.result}" data-week="${k}"
      aria-label="${escapeHtml(arena.weekLabel(k))}, ${w.result}"><b>${pct(w.score)}</b></button>`)
    .join('')}</div>`;
}
