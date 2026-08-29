// The month settles: you go up, or you go down.
//
// It used to be a card inside the week result. It is the biggest thing that
// happens in this app in any given month, so it gets the screen.
//
// The whole ladder is on it, every rung named with what it costs, and the badge
// travels between two of them. That is the one layout that answers all three
// questions at once: where you were, where you are, and what is above you.
//
// Relegation marks the rung you lost as a target rather than a wound: dashed,
// with the number it wants and an arrow pointing back at it.
//
// Marked seen on the way OUT, like the other ceremonies: marking as it draws
// makes the screen eat what put it there, and a reload loses it for good.

import * as store from '../store.js';
import * as arena from './program.js';
import { escapeHtml, chime, celebrate, haptic } from '../ui.js';
import { crest } from './crest.js';
import { icon } from '../icons.js';
import { navigate, replaceWith } from '../back.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const points = (v) => Math.round(v * 100);

export const hasRank = () => !!arena.rankMoment();

let showing = null;

export function leaveRank() {
  if (showing) arena.markRankSeen();
  showing = null;
}

/** What it would have taken. A month is the mean of its weeks, so covering a
 *  shortfall of `d` over `n` weeks means one week `d * n` better. Told as a
 *  number you could have hit, or as "more than one week" when it is out of
 *  reach, because a target above 100% is not a target. */
function whatItWanted(month, score, bar) {
  const short = bar - score;
  if (short <= 0) return '';
  const weeks = arena.weeksOfMonth(month).map((k) => arena.scoreWeek(k)).filter((w) => !w.void && w.due);
  if (!weeks.length) return `${points(short)} points short.`;
  const worst = weeks.reduce((a, w) => (w.score < a.score ? w : a));
  const needed = worst.score + short * weeks.length;
  return needed <= 1
    ? `${points(short)} points short. Your worst week at ${pct(needed)} would have held it.`
    : `${points(short)} points short. That is more than one week.`;
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
  const month = new Date(`${m.month}-04T00:00:00`).toLocaleDateString(undefined, { month: 'long' });
  const nextMonth = new Date(`${store.addDays(`${m.month}-28`, 10)}T00:00:00`)
    .toLocaleDateString(undefined, { month: 'long' });

  const word = m.move === 'placed' ? 'Placed' : up ? 'Promoted' : 'Relegated';
  const line = up
    ? to.blurb
    : whatItWanted(m.month, m.score, from.bar) || `${escapeHtml(from.name)} wanted ${pct(from.bar)}.`;

  // Top rung first: the ladder is read downwards, and the one you are on has to
  // sit where the eye lands.
  const rungs = arena.DIVISIONS.map((d, i) => {
    const here = i === rung;
    const lost = !up && i > rung && i <= fromRung;
    const above = i > rung && !lost;
    return `<li class="rk-rung ${here ? 'here' : ''} ${lost ? 'lost' : ''} ${above ? 'above' : ''}" style="--i:${arena.DIVISIONS.length - 1 - i}">
      <span class="rk-mark">${here ? crest(i, 40) : ''}</span>
      <span class="rk-name">${escapeHtml(d.name)}</span>
      <span class="rk-need">${here ? pct(m.score) : i > rung ? `needs ${pct(d.bar)}` : ''}</span>
      <span class="rk-bar"><i style="--w:${((here ? m.score : d.bar) * 100).toFixed(0)}%"></i></span>
    </li>`;
  }).reverse().join('');

  mount.innerHTML = `
    <div class="screen moment rank-moment ${up ? 'up' : 'down'}" data-beat="0">
      <p class="eyebrow rk-eyebrow">${escapeHtml(month)} · ${m.w}W-${m.l}L · ${pct(m.score)}</p>

      <div class="rk-verdict">
        <h1 class="mo-title rk-word">${word}</h1>
        <span class="rk-pill">${icon(up ? 'arrowUp' : 'arrowDown', 13)}<span>1 rung</span></span>
      </div>
      <p class="rk-line">${escapeHtml(line)}</p>

      <ol class="rk-ladder">${rungs}</ol>

      <button class="btn primary big" id="go" data-back>Start ${escapeHtml(nextMonth)}</button>
    </div>`;

  const screen = mount.querySelector('.rank-moment');
  // The beats are CSS. Driving them from a data attribute keeps the timing in
  // one place and lets reduced motion collapse the whole thing to the last one.
  requestAnimationFrame(() => screen.setAttribute('data-beat', '1'));
  setTimeout(() => screen.setAttribute('data-beat', '2'), up ? 520 : 700);

  chime(up ? 'promote' : 'relegate');
  haptic(up ? 'promote' : 'relegate');
  if (up) {
    setTimeout(() => celebrate(mount.querySelector('.rk-rung.here'), {
      count: 22, spread: 120, colour: 'var(--good)',
    }), 560);
  }

  mount.querySelector('#go').addEventListener('click', () => navigate('#/arena'));
  window.scrollTo(0, 0);
}
