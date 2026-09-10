// His screen. Who he is now, what has passed between you, and every week that
// held the title before this one.

import * as arena from './program.js';
import { captureFace, face, faceAvatar } from './face.js';
import { openWeekSheet } from './week-sheet.js';
import { escapeHtml, haptic, pct } from '../ui.js';
import { icon } from '../icons.js';

const FACE = 88;
/** A long history runs to dozens. The count beside the heading says how many. */
const SHOWN = 10;
const weeksOf = (n) => `${n} week${n === 1 ? '' : 's'}`;
const kv = (label, value) => `<div class="kv"><span>${label}</span><b>${value}</b></div>`;

/** Won, lost, how long this one has stood, and what the last meeting was
 *  decided by. Four facts, no sentences. */
function recordHtml(h, held) {
  const margin = `${h.by >= 0 ? '+' : '−'}${Math.abs(h.by)}`;
  return `<section class="card">
    ${h.met ? kv('Head to head', `${h.w} - ${h.l}`) : ''}
    ${kv('Held', weeksOf(held))}
    ${h.last ? kv('Last met', `${escapeHtml(arena.weekLabel(h.last))} <em>${margin}</em>`) : ''}
  </section>`;
}

/** The ones he buried, newest first. */
function replacedHtml(past) {
  if (!past.length) return '';
  return `<section class="card">
    <div class="ar-fx-head"><h2>Replaced</h2><span class="pill ghost">${past.length}</span></div>
    ${past
      .slice(0, SHOWN)
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
          ${recordHtml(arena.headToHead(), held)}
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
