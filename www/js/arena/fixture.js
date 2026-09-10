// This week, as a duel.
//
// One track, your fill on it, and a tick where the opponent stands. Two bars
// made the reader compare two lengths; one track makes the gap a distance, and
// the verdict says it once, in the block's only colour.

import * as arena from './program.js';
import * as habits from '../habits/program.js';
import { faceAvatar } from './face.js';
import { rail } from './standing.js';
import { escapeHtml, openSheet, haptic, pct } from '../ui.js';
import { navigate } from '../back.js';
import { icon } from '../icons.js';

const points = (v) => Math.round(v * 100);
const hex = (r) => (r.colour ? habits.hexOf(r.colour) : 'var(--accent)');

/** A heading and the date it covers. */
function sectionHead(title, aside) {
  return `<div class="ar-sec"><h2>${escapeHtml(title)}</h2><span>${escapeHtml(aside)}</span></div>`;
}

/* ---- the duel ---- */

function duelHtml(live, opp, left, gap) {
  const verdict = gap === 0 ? 'Level' : gap > 0 ? `+${gap}` : `\u2212${-gap}`;
  const hasFace = opp.id === 'nemesis' || opp.knockout === 'final';
  return `<div class="ar-duel">
    <p class="ar-you"><b>${pct(live.score)}</b><i>You</i></p>
    <p class="ar-gap"><b>${escapeHtml(verdict)}</b></p>
    ${rail(live.score, { ghost: opp.score })}
    <button class="ar-rival" id="oppBtn" aria-label="${escapeHtml(opp.name)}, ${pct(opp.score)}">
      ${hasFace ? faceAvatar(20) : '<i class="ar-tick"></i>'}
      <b>${pct(opp.score)}</b>
    </button>
    <span class="ar-left">${left === 1 ? 'Last day' : `${left} days left`}</span>
  </div>`;
}

/* ---- the scoreboard ---- */

/** The rows behind the score, in the grid's order. The bar carries the habit's
 *  own colour, which is how you find a row without reading it. */
function scoreboard(rows) {
  if (!rows.length) return '';
  return `<div class="ar-sb">${rows
    .map((r) => {
      const frac = r.due ? Math.min(1, r.done / r.due) : 0;
      return `<a class="ar-sb-row ${r.done >= r.due ? 'full' : ''}" href="#/habits/habit?id=${encodeURIComponent(r.id)}">
        <span class="ar-sb-name">${escapeHtml(r.name)}</span>
        <span class="ar-sb-bar"><i style="width:${(frac * 100).toFixed(0)}%;background:${hex(r)}"></i></span>
        <b>${r.done}/${r.due}</b>
      </a>`;
    })
    .join('')}</div>`;
}

/* ---- the section ---- */

/** Nothing is due yet: the fixture is not a contest, so it does not pretend to
 *  be one. No opponent, no 0%, no deficit invented before you have started. */
function notYet(key) {
  return `<section class="card ar-week">
    ${sectionHead('This week', arena.weekLabel(key))}
    <a class="btn ghost wide" href="#/habits">${icon('plus', 15)}<span>Add a habit</span></a>
  </section>`;
}

export function fixtureHtml() {
  const key = arena.currentWeek();
  const live = arena.scoreWeek(key);
  const left = arena.daysLeftInWeek();
  if (live.void && !live.due) return notYet(key);

  const opp = arena.fixtureFor(key);
  const gap = points(live.score) - points(opp.score);
  const state = gap > 0 ? 'ahead' : gap < 0 ? 'behind' : 'level';

  return `<section class="card ar-week ${state}">
    ${sectionHead(opp.knockout ? arena.KNOCKOUT[opp.knockout].name : 'This week', arena.weekLabel(key))}
    ${duelHtml(live, opp, left, gap)}
    ${scoreboard(live.rows)}
  </section>`;
}

/** The opponent opens: a real week if it was one, an explanation if it is the bar. */
export function wireFixture(mount) {
  mount.querySelectorAll('.ar-sb-row').forEach((row) => row.addEventListener('click', () => haptic('tick')));
  const btn = mount.querySelector('#oppBtn');
  if (!btn) return;
  const fixture = arena.fixtureFor(arena.currentWeek());
  btn.addEventListener('click', async () => {
    haptic('press');
    // Tapping him opens him, not the week that made him.
    if (fixture.id === 'nemesis' || fixture.knockout === 'final') return navigate('#/arena/nemesis');
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

/** The last six results, as a strip. A "Form" heading over six numbers is a
 *  word doing their job. */
export function formHtml(weeks) {
  const played = Object.entries(weeks)
    .filter(([k, w]) => k < arena.currentWeek() && (w.result === 'won' || w.result === 'lost'))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-6);
  if (!played.length) return '';
  return `<div class="ar-form">${played
    .map(([k, w]) => `<button class="ar-chip ${w.result}" data-week="${k}"
      aria-label="${escapeHtml(arena.weekLabel(k))}, ${w.result}"><b>${pct(w.score)}</b></button>`)
    .join('')}</div>`;
}
