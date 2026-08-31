// The grid's HTML: header, rows, cells, rings. Builds and patches markup,
// never wires it. The wiring is marking.js's, the screens are home.js's.

import * as habits from './program.js';
import { escapeHtml, WEEKDAYS } from '../ui.js';
import { icon } from '../icons.js';

export const rowColour = (habit) => (habit.colour ? habits.hexOf(habit.colour) : 'var(--accent)');

/** The line under the name: what a measurable habit counts. */
function detailOf(habit) {
  if (habit.kind !== 'number') return '';
  const unit = habit.unit || '';
  if (!habit.target) return unit;
  const aim = `${habit.targetType === 'atmost' ? 'under' : 'at least'} ${fmtNumber(habit.target)}`;
  return unit ? `${aim} ${unit}` : aim;
}

/** The small ring: the score in the habit's own colour. ringSvg is the 168px
 *  one and does not survive being shrunk to 26px. */
function miniRing(frac, colour) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(frac, 1)));
  return `<svg class="hg-ring" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="${r}" fill="none" stroke="var(--line)" stroke-width="3"/>
    <circle class="hg-ring-fill" cx="12" cy="12" r="${r}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 12 12)"/>
  </svg>`;
}

/** One cell. Four states for a yes/no habit, the measurement for a number. */
export function cellHtml(habit, key, sum, s) {
  const d = sum.index.get(key);
  const raw = d?.raw;
  const colour = rowColour(habit);
  const future = key > habits.today();
  if (future) return `<button class="hg-cell future" data-day="${key}" disabled aria-hidden="true"></button>`;

  const label = `${habit.name}, ${key}`;
  if (raw === habits.SKIP) {
    return `<button class="hg-cell skip" data-day="${key}" aria-label="${escapeHtml(label)}: skipped">${icon('skip', 15)}</button>`;
  }
  if (habit.kind === 'number') {
    const has = typeof raw === 'number';
    const met = !!d?.hit;
    // No unit here. It is said once, under the name.
    return `<button class="hg-cell num ${met ? 'on' : has ? 'part' : ''}" data-day="${key}"
      style="${met ? `color:${colour}` : ''}" aria-label="${escapeHtml(label)}: ${has ? fmtNumber(raw) : 'nothing'} ${escapeHtml(habit.unit || '')}">
      ${has ? escapeHtml(fmtNumber(raw)) : '–'}</button>`;
  }
  if (raw === habits.YES) {
    return `<button class="hg-cell on" data-day="${key}" style="color:${colour}" aria-label="${escapeHtml(label)}: done">${icon('check', 18)}</button>`;
  }
  if (raw === habits.NO) {
    return `<button class="hg-cell no" data-day="${key}" aria-label="${escapeHtml(label)}: missed">${icon('close', 16)}</button>`;
  }
  // Carried, not done: a satisfied day inside a window is not a day you did it.
  const carried = d?.satisfied ? ' carried' : '';
  return `<button class="hg-cell${carried}" data-day="${key}" aria-label="${escapeHtml(label)}: not recorded">${
    s.unknownMarks ? '<span class="hg-q">?</span>' : icon('close', 16)
  }</button>`;
}

/** A cell is about 45px wide, so "23.18" reads as noise. One decimal under ten,
 *  none above it, and k past a thousand. */
export function fmtNumber(v) {
  if (typeof v !== 'number') return '–';
  if (Number.isInteger(v)) return v >= 10000 ? `${Math.round(v / 1000)}k` : String(v);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 10) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

export function headCell(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `<i class="${key === habits.today() ? 'now' : ''}"><b>${WEEKDAYS[dt.getDay()].toUpperCase()}</b><em>${dt.getDate()}</em></i>`;
}

export function rowHtml(habit, days, s, { reorder = false, groupOptions = () => '' } = {}) {
  const sum = habits.summary(habit);
  const colour = rowColour(habit);
  // The name goes there, never to the same place as the cell beside it.
  const href = `#/habits/habit?id=${encodeURIComponent(habit.id)}`;
  return `<div class="hg-row" data-id="${escapeHtml(habit.id)}">
    ${reorder ? `<button class="hg-drag" aria-label="Reorder ${escapeHtml(habit.name)}">${icon('reorder', 16)}</button>` : ''}
    <a class="hg-name" href="${href}">
      ${miniRing(sum.score, colour)}
      <span class="hg-label">
        <b style="color:${colour}">${escapeHtml(habit.name)}</b>
        ${detailOf(habit) ? `<i>${escapeHtml(detailOf(habit))}</i>` : ''}
      </span>
    </a>
    ${reorder
      ? `<div class="hg-move">
          <button class="icon-btn small" data-move="up" aria-label="Move up">${icon('arrowUp', 15)}</button>
          <button class="icon-btn small" data-move="down" aria-label="Move down">${icon('arrowDown', 15)}</button>
          <select class="hg-group-pick" aria-label="Group">${groupOptions(habit.group)}</select>
        </div>`
      : days.map((key) => cellHtml(habit, key, sum, s)).join('')}
  </div>`;
}

/* --------------------- the header --------------------- */

export function dueHead(due) {
  if (!due.total) return { text: 'Nothing here yet', frac: 0 };
  if (due.pending.length) return { text: `${due.pending.length} left today`, frac: due.done / due.total };
  return { text: 'All done today', frac: 1 };
}

export function headRing(frac) {
  const f = Math.max(0, Math.min(frac, 1));
  const r = 20;
  const c = 2 * Math.PI * r;
  return `<svg class="gh-ring" width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
    <circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>
    <circle class="gh-ring-fill" cx="23" cy="23" r="${r}" fill="none"
      stroke="${f >= 1 ? 'var(--good)' : 'var(--accent)'}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - f)).toFixed(1)}"
      transform="rotate(-90 23 23)"/>
  </svg>`;
}

/* ----------------- one cell, patched ----------------- */

export function nodeFrom(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const ringLen = (r) => 2 * Math.PI * r;

/** The habit's own ring. */
export function patchRowRing(row, habit) {
  const fill = row.querySelector('.hg-ring-fill');
  if (!fill) return;
  const f = Math.max(0, Math.min(habits.summary(habit).score, 1));
  fill.setAttribute('stroke-dashoffset', (ringLen(9) * (1 - f)).toFixed(1));
}
