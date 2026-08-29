// The month settles: you go up, or you go down.
//
// It used to be a card inside the week result. It is the biggest thing that
// happens in this app in any given month, so it gets the screen.
//
// Marked seen on the way OUT, like the other ceremonies: marking as it draws
// makes the screen eat what put it there, and a reload loses it for good.

import * as arena from './program.js';
import { escapeHtml, chime, celebrate, haptic } from '../ui.js';
import { crest } from './crest.js';
import { icon } from '../icons.js';
import { navigate, replaceWith } from '../back.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

export const hasRank = () => !!arena.rankMoment();

let showing = null;

export function leaveRank() {
  if (showing) arena.markRankSeen();
  showing = null;
}

export function renderRank(mount) {
  const m = arena.rankMoment();
  // Nothing owed: closed on this screen and the launch restored the hash.
  if (!m) return replaceWith('#/hub');
  showing = m;

  const up = m.move === 'up' || m.move === 'placed';
  const from = arena.divisionOf(m.from);
  const to = arena.divisionOf(m.to);
  const rung = arena.divisionIndex(m.to);
  const fromRung = arena.divisionIndex(m.from);
  const month = new Date(`${m.month}-04T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const word = m.move === 'placed' ? 'Placed' : up ? 'Promoted' : 'Relegated';

  mount.innerHTML = `
    <div class="screen moment rank-moment ${up ? 'up' : 'down'}" data-beat="0">
      <section class="mo-head rk-head">
        <p class="eyebrow">${escapeHtml(month)} · ${pct(m.score)} · ${m.w}W-${m.l}L</p>

        <div class="rk-stage">
          <span class="rk-crest old">${crest(fromRung, 84)}</span>
          <span class="rk-crest new">${crest(rung, 96)}</span>
        </div>

        <h1 class="mo-title rk-word">${word}</h1>
        <p class="rk-move">
          <span class="rk-from">${escapeHtml(from.name)}</span>
          <span class="rk-arrow">${icon(up ? 'arrowUp' : 'arrowDown', 16)}</span>
          <span class="rk-to">${escapeHtml(to.name)}</span>
        </p>
      </section>

      <section class="rk-ladder" aria-hidden="true">
        ${arena.DIVISIONS.map((d, i) => `<i class="${i <= rung ? 'lit' : ''} ${i === rung ? 'here' : ''} ${
          !up && i > rung && i <= fromRung ? 'lost' : ''
        }" style="--i:${i}"></i>`).join('')}
      </section>

      <p class="rk-blurb">${escapeHtml(to.blurb)}</p>

      <p class="rk-next">${up
        ? rung >= arena.DIVISIONS.length - 1
          ? 'There is nothing above this. Hold it.'
          : `${pct(arena.DIVISIONS[rung + 1].bar)} a month takes you to ${escapeHtml(arena.DIVISIONS[rung + 1].name)}.`
        : `${pct(from.bar)} a month takes it back.`}</p>

      <button class="btn primary big" id="go" data-back>${up ? 'Good' : 'Again, then'}</button>
    </div>`;

  const screen = mount.querySelector('.rank-moment');
  // The beats are CSS. Driving them from a data attribute keeps the timing in
  // one place and lets reduced motion collapse the whole thing to the last one.
  requestAnimationFrame(() => screen.setAttribute('data-beat', '1'));
  setTimeout(() => screen.setAttribute('data-beat', '2'), up ? 420 : 620);

  chime(up ? 'promote' : 'relegate');
  haptic(up ? 'promote' : 'relegate');
  if (up) {
    setTimeout(() => celebrate(mount.querySelector('.rk-stage'), {
      count: 26, spread: 140, colour: 'var(--warn)',
    }), 420);
  }

  mount.querySelector('#go').addEventListener('click', () => navigate('#/arena'));
  window.scrollTo(0, 0);
}
