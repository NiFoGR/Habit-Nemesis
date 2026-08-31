// One week, opened. Reached from the fixture, the form strip, the group table,
// the year and the Cabinet, so it lives on its own rather than inside any of them.

import * as store from '../store.js';
import * as arena from './program.js';
import * as habits from '../habits/program.js';
import { captureFace, face, faceAvatar } from './face.js';
import { shareWeek } from './share.js';
import { escapeHtml, openSheet, haptic, toast, pct } from '../ui.js';
import { icon } from '../icons.js';

const hex = (h) => (h.colour ? habits.hexOf(h.colour) : 'var(--accent)');

/** The rows of one week, as bars. Shared with the fixture card. */
export function rowsHtml(rows) {
  if (!rows.length) return '';
  return rows
    .map((r) => {
      const frac = r.due ? Math.min(1, r.done / r.due) : 0;
      return `<div class="ar-row">
        <span class="ar-row-name">${escapeHtml(r.name)}</span>
        <span class="ar-row-bar"><i style="width:${(frac * 100).toFixed(0)}%;background:${hex(r)}"></i></span>
        <b>${r.done}/${r.due}</b>
      </div>`;
    })
    .join('');
}

export function openWeekSheet(key) {
  const stored = store.get().arena.weeks[key];
  const live = arena.scoreWeek(key);
  const score = stored ? stored.score : live.score;
  // Only a played match has a result. A 'record' week is a performance.
  const result = stored?.result === 'won' || stored?.result === 'lost' ? stored.result : '';
  const rows = rowsHtml(live.rows);
  const nemesis = arena.nemesisWeek();
  const isNemesis = !!nemesis && nemesis.key === key;
  const said = arena.noteFor(key);
  const now = arena.scoreWeek(arena.currentWeek());
  const gap = Math.round((now.score - score) * 100);

  const sheet = openSheet(`
    ${isNemesis
      ? `<div class="nem-head">${faceAvatar(56)}<div><h2>Your Nemesis</h2>
          <p class="muted small">${escapeHtml(arena.weekLabel(key))} · your best week</p></div></div>`
      : `<h2>${escapeHtml(arena.weekLabel(key))}</h2>`}
    <p class="muted small">${escapeHtml(key.replace('-W', ', week '))}${
      result ? ` · ${result} against ${escapeHtml(stored.oppName || 'the bar')}` : ' · on the record, not played'
    }</p>
    <div class="ar-sheet-score ${result}"><b>${pct(score)}</b><span>${
      stored ? `${stored.done} of ${stored.due} cells` : `${live.done} of ${live.due} cells`
    }</span></div>
    ${said ? `<p class="said-quote">“${escapeHtml(said)}”</p>` : ''}
    ${isNemesis && key !== arena.currentWeek()
      ? `<p class="nem-gap ${gap >= 0 ? 'ahead' : 'behind'}">${
          gap >= 0 ? `You are ${gap} points ahead of him this week.` : `You are ${Math.abs(gap)} points behind him this week.`
        }</p>`
      : ''}
    <h3 class="ar-sub">The week, row by row</h3>
    <div class="ar-rows">${rows || '<p class="muted small">No rows were on the grid that week.</p>'}</div>
    ${isNemesis ? `<button class="btn ghost wide" id="faceSwap">${face() ? 'Change his face' : 'Give him a face'}</button>` : ''}
    ${live.due ? `<button class="btn ghost wide" id="shareWeek">${icon('external', 16)}<span>Share this week</span></button>` : ''}
    <button class="btn wide" data-close>Close</button>`);

  // Closed first: the card is a sheet of its own and two do not stack.
  document.getElementById('shareWeek')?.addEventListener('click', () => {
    sheet.close();
    shareWeek(key);
  });

  document.getElementById('faceSwap')?.addEventListener('click', async () => {
    haptic('press');
    if (await captureFace(key)) {
      toast('That is him now');
      openWeekSheet(key);
    }
  });
}

/** Every element carrying data-week opens that week. */
export function wireWeeks(root) {
  root.querySelectorAll('[data-week]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      openWeekSheet(el.dataset.week);
    })
  );
}
