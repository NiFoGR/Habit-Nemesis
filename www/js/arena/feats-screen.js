// Every feat, and the sheet one opens into. The Cabinet shows the same tiles,
// so the wiring is exported rather than living inside this screen.

import * as feats from './feats.js';
import { escapeHtml, openSheet, haptic } from '../ui.js';
import { icon } from '../icons.js';

/** "42 of 100" in the feat's unit: hours and cm to one place, counts to none. */
function fmtNeed(f) {
  const dp = f.unit && /cm|h|s/.test(f.unit) ? 1 : 0;
  const round = (v) => (dp ? v.toFixed(1) : Math.round(v).toLocaleString());
  return `${round(Math.min(f.have, f.need))}${f.unit || ''} of ${round(f.need)}${f.unit || ''}`;
}

function tile(f) {
  return `<button class="ft ${f.earned ? 'on' : ''}" data-feat="${escapeHtml(f.id)}">
    <span class="ft-ico">${icon(f.icon, 19)}</span>
    <b>${escapeHtml(f.name)}</b>
    ${f.earned || !f.need ? '' : `<span class="ft-bar"><i style="width:${(f.frac * 100).toFixed(0)}%"></i></span>`}
    <i class="ft-price">${escapeHtml(feats.priceOf(f.days))}</i>
  </button>`;
}

export function renderFeats(mount) {
  const sections = feats.bySection();
  const c = feats.counts();

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>Feats</h1>
        <span class="pill ghost">${c.earned} of ${c.total}</span>
      </header>

      ${sections
        .map(
          (s) => `<section class="card">
            <div class="ar-fx-head">
              <h2>${escapeHtml(s.section)}</h2>
              <span class="pill ghost">${s.earned} of ${s.items.length}</span>
            </div>
            <div class="ft-grid">${s.items.map(tile).join('')}</div>
          </section>`
        )
        .join('')}
    </div>`;

  wireFeatTiles(mount);
}

/** Any screen showing feat tiles gets the same sheet. */
export function wireFeatTiles(mount) {
  mount.querySelectorAll('[data-feat]').forEach((el) =>
    el.addEventListener('click', () => {
      const f = feats.FEATS.find((x) => x.id === el.dataset.feat);
      if (!f) return;
      haptic('tick');
      const p = feats.progressOf(f);
      const at = feats.earnedAt(f.id);
      openSheet(`
        <div class="ft-big ${p.earned ? 'on' : ''}">${icon(f.icon, 30)}</div>
        <h2 class="centre">${escapeHtml(f.name)}</h2>
        <p class="muted small centre">${escapeHtml(f.blurb)}</p>
        <p class="centre muted small ft-cost">${escapeHtml(feats.priceOf(f.days))} of work, at the fastest it can be done.</p>
        ${p.earned
          ? `<p class="centre ft-when">Earned${at ? ` ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.</p>`
          : p.need
            ? `<div class="ar-bar plain"><div class="ar-bar-fill" style="width:${(p.frac * 100).toFixed(1)}%"></div></div>
               <p class="centre muted small">${escapeHtml(fmtNeed({ ...f, ...p }))}</p>`
            : '<p class="centre muted small">Not yet.</p>'}
        <button class="btn wide" data-close>Close</button>`);
    })
  );
}
