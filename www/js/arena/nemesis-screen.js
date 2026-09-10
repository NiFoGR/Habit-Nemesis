// His screen. Who he is now, what has passed between you, and every week that
// held the title before this one.

import * as arena from './program.js';
import { captureFace, face, faceAvatar } from './face.js';
import { openWeekSheet } from './week-sheet.js';
import { escapeHtml, haptic, pct } from '../ui.js';
import { icon } from '../icons.js';

const FACE = 88;
const weeksOf = (n) => `${n} week${n === 1 ? '' : 's'}`;
const kv = (label, value) => `<div class="kv"><span>${label}</span><b>${value}</b></div>`;

/** What the last meeting was decided by. Level is a win here, so it is not a
 *  zero, and the block's one colour says which way it went. */
function marginHtml(by) {
  if (!by) return '<em class="up">Level</em>';
  return `<em class="${by > 0 ? 'up' : 'down'}">${by > 0 ? '+' : '−'}${Math.abs(by)}</em>`;
}

/** Won, lost, how long this one has stood, and the last meeting. Four facts,
 *  no sentences. Beating him usually makes that week the new Nemesis, so on
 *  those weeks the date is the one above and only the margin is new. */
function recordHtml(h, held, key) {
  const same = h.last === key;
  return `<section class="card">
    ${h.met ? kv('Head to head', `${h.w} - ${h.l}`) : ''}
    ${kv('Held', weeksOf(held))}
    ${h.last ? kv('Last met', same ? marginHtml(h.by) : `${escapeHtml(arena.weekLabel(h.last))} ${marginHtml(h.by)}`) : ''}
  </section>`;
}

/** The ones he buried, newest first. */
function replacedHtml(past) {
  if (!past.length) return '';
  return `<section class="card">
    <div class="ar-fx-head"><h2>Replaced</h2><span class="pill ghost">${past.length}</span></div>
    ${past
      .map(
        (r) => `<button class="nem-row" data-week="${escapeHtml(r.key)}">
          <span class="nem-row-who"><b>${escapeHtml(arena.weekLabel(r.key))}</b><i>${escapeHtml(weeksOf(r.held))}</i></span>
          <b class="nem-row-score">${pct(r.score)}</b>
        </button>`
      )
      .join('')}
  </section>`;
}

export function renderNemesis(mount) {
  const n = arena.nemesisWeek();
  const line = arena.reigns();
  const past = line.slice(0, -1).reverse();
  const held = line.length ? line[line.length - 1].held : 0;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>Nemesis</h1>
        <span></span>
      </header>

      ${n
        ? `<button class="nem-hero" data-week="${escapeHtml(n.key)}">
            ${faceAvatar(FACE)}
            <b>${pct(n.score)}</b>
            <i>${escapeHtml(arena.weekLabel(n.key))}</i>
          </button>
          ${recordHtml(arena.headToHead(), held, n.key)}
          <button class="btn ghost wide" id="faceGo">${face() ? 'Change his face' : 'Give him a face'}</button>
          ${replacedHtml(past)}`
        : `<div class="nem-empty">${faceAvatar(FACE)}<p class="muted small">Your best week becomes him.</p></div>`}
    </div>`;

  mount.querySelectorAll('[data-week]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      openWeekSheet(el.dataset.week);
    })
  );

  mount.querySelector('#faceGo')?.addEventListener('click', async () => {
    haptic('press');
    if (await captureFace(n.key)) renderNemesis(mount);
  });
}
