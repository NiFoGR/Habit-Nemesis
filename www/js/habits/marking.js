// Marking a day: the tap and long-press wiring, the cell swap, and the keypad
// for a measurable habit. Patches what changed, never rebuilds the grid.

import * as habits from './program.js';
import { escapeHtml, openSheet, haptic, chime, celebrate } from '../ui.js';
import { announce } from '../arena/result.js';
import { watchGap, currentWeek, weekDays, scoreWeek } from '../arena/program.js';
import { syncTabs } from '../tabs.js';
import { navigate } from '../back.js';
import { rowColour, cellHtml, fmtNumber, dueHead, nodeFrom, ringLen, patchRowRing } from './grid.js';

const LONG_PRESS_MS = 420;

/** Header and group pills: readings of the record the cell just changed, so
 *  they move together. */
function patchTotals(mount, wasDone) {
  const due = habits.dueToday();
  const { text, frac: f } = dueHead(due);
  const line = mount.querySelector('#dueLine');
  if (line) line.textContent = text;

  const fill = mount.querySelector('.gh-ring-fill');
  if (fill) {
    fill.setAttribute('stroke-dashoffset', (ringLen(20) * (1 - Math.min(f, 1))).toFixed(1));
    fill.closest('.gh-ring').classList.toggle('perfect', f >= 1);
  }
  mount.querySelectorAll('[data-group-score]').forEach((el) => {
    const score = habits.groupScore(el.dataset.groupScore);
    el.textContent = score == null ? '' : `${Math.round(score * 100)}%`;
  });
  // The bar's badge counts the same thing.
  syncTabs(location.hash.split('?')[0]);

  // Once a day, on the tap that earns it, never on the way back down.
  const done = due.total > 0 && due.pending.length === 0;
  if (done && !wasDone) {
    haptic('level');
    chime('perfect');
    const ring = mount.querySelector('.gh-ring');
    if (ring) celebrate(ring, { count: 20, spread: 74 });
  }
}

/** Mark a day and show it, without redrawing what did not change. */
function markCell(mount, habit, key, cell) {
  const before = habits.dueToday();
  const wasDone = before.total > 0 && before.pending.length === 0;
  const wasOn = !!habits.summary(habit).index.get(key)?.hit;

  habits.setValue(habit.id, key, habits.nextValue(habit, key));
  announce();

  const row = cell.closest('.hg-row');
  const next = nodeFrom(cellHtml(habit, key, habits.summary(habit), habits.settings()));
  cell.replaceWith(next);
  if (row) patchRowRing(row, habit);
  patchTotals(mount, wasDone);

  // Only for the direction that earns one: celebrating a miss is a lie.
  const nowOn = !!habits.summary(habit).index.get(key)?.hit;
  const skipped = !!habits.summary(habit).index.get(key)?.skipped;
  haptic(nowOn ? 'hit' : 'tick');
  chime(nowOn ? (kickoff(key) ? 'kickoff' : 'mark') : skipped ? 'skip' : 'unmark');
  crossing();
  if (nowOn && !wasOn) {
    next.classList.add('just-on');
    celebrate(next, { count: 8, spread: 26, colour: rowColour(habit) });
    next.addEventListener('animationend', () => next.classList.remove('just-on'), { once: true });
  }
}

/** `redraw` is home.js's, passed in: the one case that needs a rebuild is a
 *  cell the patch cannot find. */
export function wireCells(grid, mount, s, redraw) {
  let timer = null;
  let held = false;

  const act = (cell) => {
    const row = cell.closest('.hg-row');
    if (!row) return;
    const habit = habits.byId(row.dataset.id);
    if (!habit) return;
    const key = cell.dataset.day;
    if (!key || key > habits.today()) return;
    if (habit.kind === 'checklist') return openChecklistSheet(mount, habit, key, redraw);
    // Today's cell of a timed habit runs it. A past one is typed.
    if (habit.kind === 'timed' && key === habits.today()) return navigate(`#/habits/timer?id=${encodeURIComponent(habit.id)}`);
    if (habits.measurable(habit)) return openValueSheet(mount, habit, key, redraw);
    markCell(mount, habit, key, cell);
  };

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.hg-cell');
    if (!cell) return;
    // The click after a long press must not cycle a second time.
    if (held) {
      held = false;
      return;
    }
    if (!s.shortPress) return;
    act(cell);
  });

  if (s.shortPress) return;

  let from = null;
  grid.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.hg-cell');
    if (!cell) return;
    held = false;
    from = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      held = true;
      act(cell);
    }, LONG_PRESS_MS);
  });
  const cancel = () => {
    clearTimeout(timer);
    from = null;
  };
  // A finger that has travelled is swiping or scrolling, not holding.
  grid.addEventListener('pointermove', (e) => {
    if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10) cancel();
  });
  grid.addEventListener('pointerup', cancel);
  grid.addEventListener('pointercancel', cancel);
  grid.addEventListener('pointerleave', cancel);
  grid.addEventListener('scroll', cancel, true);
}

/** The week's first mark, on its first day. */
function kickoff(key) {
  const week = currentWeek();
  return key === weekDays(week)[0] && key === habits.today() && scoreWeek(week).done === 1;
}

/** The lead changing hands, said once. */
function crossing() {
  const cue = watchGap();
  if (!cue) return;
  setTimeout(() => {
    chime(cue);
    haptic(cue);
  }, 260);
}

/** Swap one cell for its fresh markup and nudge everything that reads it. */
function patchCell(mount, habit, key, wasDone, wasOn, redraw) {
  const cell = mount.querySelector(`.hg-row[data-id="${CSS.escape(habit.id)}"] .hg-cell[data-day="${key}"]`);
  if (!cell) return redraw(mount);
  const next = nodeFrom(cellHtml(habit, key, habits.summary(habit), habits.settings()));
  cell.replaceWith(next);
  patchRowRing(next.closest('.hg-row'), habit);
  patchTotals(mount, wasDone);
  const nowOn = !!habits.summary(habit).index.get(key)?.hit;
  if (nowOn && !wasOn) {
    next.classList.add('just-on');
    celebrate(next, { count: 8, spread: 26, colour: rowColour(habit) });
    next.addEventListener('animationend', () => next.classList.remove('just-on'), { once: true });
  }
  crossing();
}

/** The list, one tick per item. The count is the day's value. */
export function openChecklistSheet(mount, habit, key, redraw) {
  const before = habits.dueToday();
  const wasDone = before.total > 0 && before.pending.length === 0;
  const wasOn = !!habits.summary(habit).index.get(key)?.hit;
  const ticked = new Set(habits.checksOn(habit, key));
  const sheet = openSheet(`
    <h2>${escapeHtml(habit.name)}</h2>
    <p class="muted small" id="listCount">${ticked.size} of ${habit.items.length} · ${escapeHtml(key)}</p>
    <div class="list-items">${habit.items
      .map((item, i) => `<label class="list-item ${ticked.has(i) ? 'on' : ''}" style="--sc:${rowColour(habit)}">
        <input type="checkbox" data-item="${i}" ${ticked.has(i) ? 'checked' : ''}>
        <span>${escapeHtml(item)}</span>
      </label>`)
      .join('')}</div>
    <button class="btn wide" data-close>Done</button>`, {
    onClose: () => patchCell(mount, habit, key, wasDone, wasOn, redraw),
  });
  sheet.el.querySelectorAll('[data-item]').forEach((box) =>
    box.addEventListener('change', () => {
      const i = Number(box.dataset.item);
      if (box.checked) ticked.add(i);
      else ticked.delete(i);
      box.closest('.list-item').classList.toggle('on', box.checked);
      habits.setChecks(habit.id, key, [...ticked]);
      announce();
      sheet.el.querySelector('#listCount').textContent = `${ticked.size} of ${habit.items.length} · ${key}`;
      haptic(box.checked ? 'hit' : 'tick');
      chime(box.checked ? (ticked.size === habit.items.length ? 'complete' : 'mark') : 'unmark');
    }));
}

/** Keypad for a measurable habit, plus a button for each of the other states. */
export function openValueSheet(mount, habit, key, redraw) {
  const s = habits.settings();
  const current = habits.valueOn(habit, key);
  const sheet = openSheet(`
    <h2>${escapeHtml(habit.name)}</h2>
    <p class="muted small">${escapeHtml(habit.question || `How many ${habit.unit || 'this day'}?`)} · ${escapeHtml(key)}</p>
    <div class="measure-row">
      <input type="number" inputmode="decimal" step="any" min="0" id="val"
        value="${typeof current === 'number' && current >= 0 ? current : ''}" placeholder="0">
      <span>${escapeHtml(habit.unit || '')}</span>
    </div>
    ${habit.target ? `<p class="fineprint">Target: ${habit.targetType === 'atmost' ? 'at most' : 'at least'} ${fmtNumber(habit.target)}${habit.unit ? ` ${escapeHtml(habit.unit)}` : ''}.</p>` : ''}
    <div class="btn-row">
      <button class="btn" id="clear">Clear</button>
      ${s.skipDays ? '<button class="btn" id="skip">Skip</button>' : ''}
      <button class="btn primary" id="save">Save</button>
    </div>`);

  const input = sheet.el.querySelector('#val');
  input.focus();
  const done = (value) => {
    // Same event as a cell tap, so it takes the same path: swap, nudge, no rebuild.
    const before = habits.dueToday();
    const wasDone = before.total > 0 && before.pending.length === 0;
    const wasOn = !!habits.summary(habit).index.get(key)?.hit;
    habits.setValue(habit.id, key, value);
    announce();
    sheet.close();
    patchCell(mount, habit, key, wasDone, wasOn, redraw);
  };
  sheet.el.querySelector('#save').addEventListener('click', () => {
    const v = Number(input.value);
    done(input.value === '' || !Number.isFinite(v) ? undefined : Math.max(0, v));
  });
  sheet.el.querySelector('#clear').addEventListener('click', () => done(undefined));
  sheet.el.querySelector('#skip')?.addEventListener('click', () => done(habits.SKIP));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sheet.el.querySelector('#save').click();
  });
}
