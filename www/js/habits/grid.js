// The grid's HTML: header, rows, cells, rings. Builds and patches markup,
// never wires it. The wiring is marking.js's, the screens are home.js's.

import * as habits from './program.js';
import { escapeHtml, WEEKDAYS } from '../ui.js';
import { icon } from '../icons.js';

export const rowColour = (habit) => (habit.colour ? habits.hexOf(habit.colour) : 'var(--accent)');

/** The line under the name: what a measurable habit counts. */
function detailOf(habit) {
  if (!habits.measurable(habit)) return '';
  const unit = habit.unit || '';
  if (!habit.target) return unit;
  const aim = `${habit.targetType === 'atmost' ? 'under' : 'at least'} ${fmtNumber(habit.target)}`;
  return unit ? `${aim} ${unit}` : aim;
}

/** The small ring: the score in the habit's own colour. ringSvg is the 168px
 *  one and does not survive being shrunk to 26px. */
export function miniRing(frac, colour) {
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
  if (key > habits.today()) return `<button class="hg-cell future" data-day="${key}" disabled aria-hidden="true"></button>`;
  // Before the habit existed. Not a day it missed, so not a cross.
  if (key < sum.from) return `<button class="hg-cell void" data-day="${key}" disabled aria-hidden="true"></button>`;

  const label = `${habit.name}, ${key}`;
  if (raw === habits.SKIP) {
    return `<button class="hg-cell skip" data-day="${key}" aria-label="${escapeHtml(label)}: skipped">${icon('skip', 15)}</button>`;
  }
  // Before the yes/no branches: a number habit reading 1 is a measurement.
  if (habits.measurable(habit) && typeof raw === 'number') {
    const met = !!d?.hit;
    // No unit here. It is said once, under the name.
    return `<button class="hg-cell num ${met ? 'on' : 'part'}" data-day="${key}"
      style="${met ? `color:${colour}` : ''}" aria-label="${escapeHtml(label)}: ${fmtNumber(raw)} ${escapeHtml(habit.unit || '')}">
      ${escapeHtml(fmtNumber(raw))}</button>`;
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

/** A cell's width in px, by column count: seven days give room back to the name. */
export const cellSize = (cols) => ({ 3: 46, 4: 44, 5: 40, 6: 34, 7: 30 })[cols] || 44;

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
  const note = habits.noteOn(key);
  const cls = `${key === habits.today() ? 'now' : ''} ${note ? 'noted' : ''}`;
  return `<i class="${cls.trim()}"${note ? ` title="${escapeHtml(note)}"` : ''}><b>${WEEKDAYS[dt.getDay()].toUpperCase()}</b><em>${dt.getDate()}</em></i>`;
}

export function rowHtml(habit, days, s, { reorder = false } = {}) {
  const sum = habits.summary(habit);
  const colour = rowColour(habit);
  const name = escapeHtml(habit.name);
  const mark = `${miniRing(sum.score, colour)}
    <span class="hg-label">
      <b style="color:${colour}">${name}</b>
      ${detailOf(habit) ? `<i>${escapeHtml(detailOf(habit))}</i>` : ''}
    </span>`;

  // Reordering: the grip drags, the arrows step, and the name opens nothing.
  if (reorder) {
    return `<div class="hg-row" data-id="${escapeHtml(habit.id)}">
      <span class="hg-drag" aria-hidden="true">${icon('reorder', 16)}</span>
      <span class="hg-name">${mark}</span>
      <span class="hg-move">
        <button class="hg-mv" data-move="up" aria-label="Move ${name} up">${icon('arrowUp', 16)}</button>
        <button class="hg-mv" data-move="down" aria-label="Move ${name} down">${icon('arrowDown', 16)}</button>
      </span>
    </div>`;
  }

  // The name goes there, never to the same place as the cell beside it.
  const href = `#/habits/habit?id=${encodeURIComponent(habit.id)}`;
  return `<div class="hg-row" data-id="${escapeHtml(habit.id)}">
    <a class="hg-name" href="${href}">${mark}</a>
    ${days.map((key) => cellHtml(habit, key, sum, s)).join('')}
  </div>`;
}

/* --------------------- the header --------------------- */

/** The one line at the top. No "today" in it: the date sits under it. */
export function dueHead(due) {
  if (!due.total) return { text: 'Pick your first', frac: 0 };
  if (due.pending.length) return { text: `${due.pending.length} left`, frac: due.done / due.total };
  return { text: 'Perfect', frac: 1 };
}

/** The day's ring. Every row owed answered and none a miss: solid accent. */
export function headRing(frac) {
  const f = Math.max(0, Math.min(frac, 1));
  const r = 20;
  const c = 2 * Math.PI * r;
  return `<svg class="gh-ring ${f >= 1 ? 'perfect' : ''}" width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
    <circle class="gh-disc" cx="23" cy="23" r="17" fill="var(--accent)"/>
    <circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>
    <circle class="gh-ring-fill" cx="23" cy="23" r="${r}" fill="none"
      stroke="var(--accent)" stroke-width="4" stroke-linecap="round"
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
