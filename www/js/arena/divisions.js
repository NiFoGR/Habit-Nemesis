// The ladder, end to end. The Arena says where you stand; this says what the
// standing is out of.

import * as arena from './program.js';
import { escapeHtml, pct } from '../ui.js';
import { icon } from '../icons.js';
import { crest, crestHue, UNRANKED } from './crest.js';

export function renderDivisions(mount) {
  const st = arena.standing();
  const at = st.unranked ? UNRANKED : arena.divisionIndex(st.division.id);
  // Unranked: nine locked rows say nothing. Name the rule that gets you in,
  // and mark the rung today's score would place you at.
  const live = st.unranked ? arena.scoreWeek(arena.currentWeek()) : null;
  const goingIn = live && !live.void ? arena.divisionIndex(arena.divisionForScore(live.score).id) : -1;

  // Top of the ladder at the top of the screen: you climb up the page.
  const rows = arena.DIVISIONS.map((d, i) => ({ d, i })).reverse();

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>Divisions</h1>
        <span></span>
      </header>

      <p class="muted small centre dv-rule">${st.unranked
        ? 'Your first scored week places you outright. After that, a month at the bar or better moves you up one, and one below yours moves you down one.'
        : 'A month averaging the bar or better moves you up one division. One move a month, up or down.'}</p>

      <ol class="dv-list">
        ${rows.map(({ d, i }) => row(d, i, at, st, goingIn)).join('')}
      </ol>
    </div>`;
}

function row(d, i, at, st, goingIn = -1) {
  const state = i === at ? 'here' : i < at ? 'done' : 'locked';
  // The rail is painted for the divisions behind you, so the colour on screen is
  // exactly the ladder you have climbed.
  const hue = i <= at ? crestHue(i) : 'var(--line)';
  const entering = i === goingIn;
  return `<li class="dv-row ${state} ${entering ? 'entering' : ''}" style="--dc:${entering ? crestHue(i) : hue}">
    <span class="dv-node">${crest(i, state === 'here' || entering ? 58 : 42).replace('alt="" aria-hidden="true"', `alt="${escapeHtml(d.name)}"`)}</span>
    <span class="dv-body">
      <b>${escapeHtml(d.name)}</b>
      ${state === 'here' ? `<i>${st.month.empty ? 'placement month' : `${pct(st.month.score)} this month`}</i>` : ''}
      ${entering ? '<i>where this week puts you</i>' : ''}
    </span>
    <span class="dv-bar">${pct(d.bar)}</span>
  </li>`;
}
