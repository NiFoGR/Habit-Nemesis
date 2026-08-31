// The home screen: the grid.
//
// Rows are what you keep, columns are the last few days, a cell is one tap.
//
//   The name goes there.  Tapping a row's name opens it.
//   The cell does it.     Tapping today starts the thing, or marks the day.
//
// Only today acts. A past cell on one of the five is that section's record.

import * as store from '../store.js';
import * as habits from './program.js';
import { escapeHtml, toast, openSheet, haptic, chime, celebrate, WEEKDAYS } from '../ui.js';
import { icon } from '../icons.js';
import { openTypePicker } from './edit.js';
import * as arena from '../arena/program.js';
import { announce } from '../arena/result.js';

const LONG_PRESS_MS = 420;

const rowColour = (habit) => (habit.colour ? habits.hexOf(habit.colour) : 'var(--accent)');

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
function cellHtml(habit, key, sum, s) {
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
function fmtNumber(v) {
  if (typeof v !== 'number') return '–';
  if (Number.isInteger(v)) return v >= 10000 ? `${Math.round(v / 1000)}k` : String(v);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 10) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

function headCell(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `<i class="${key === habits.today() ? 'now' : ''}"><b>${WEEKDAYS[dt.getDay()].toUpperCase()}</b><em>${dt.getDate()}</em></i>`;
}

function rowHtml(habit, days, s, { reorder = false, groupOptions = () => '' } = {}) {
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

function dueHead(due) {
  if (!due.total) return { text: 'Nothing here yet', frac: 0 };
  if (due.pending.length) return { text: `${due.pending.length} left today`, frac: due.done / due.total };
  return { text: 'All done today', frac: 1 };
}

function headRing(frac) {
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

/* ---------------- the grid ---------------- */

let reorderMode = false;

/** The router calls this, and it always arrives in the normal state: reorder
 *  mode is something you are doing, not a preference. Internal redraws go
 *  through `redraw`. */
/* ---------------- the first five ---------------- */
// An empty grid is the worst first screen this app can show, and "New habit" on
// its own asks someone to invent a system before they have used one. Five to
// tap, already sensible. They go the moment there is a habit on the grid.

function starterPack() {
  return `<section class="starters">
    <h2>Start with one of these</h2>
    <p class="muted small">Tap to add. Everything about it can change later.</p>
    <div class="starter-list">
      ${habits.STARTERS.map((h, i) => `<button class="starter" data-starter="${i}" style="--sc:${habits.hexOf(h.colour)}">
        <span class="starter-dot"></span>
        <span class="starter-name">${escapeHtml(h.name)}</span>
        <span class="starter-meta">${escapeHtml(habits.starterMeta(h))}</span>
        <span class="starter-add">${icon('plus', 15)}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function addStarter(mount, i) {
  if (!habits.addStarter(i)) return;
  haptic('hit');
  chime('mark');
  redraw(mount);
}

/** The one card on the grid that is not a habit. Sunday, and the two days after
 *  it in case Sunday was missed. */
function reviewCta() {
  if (!arena.reviewDue()) return '';
  const key = arena.reviewWeek();
  return `<a class="rv-cta" href="#/arena/review">
    <span class="rv-cta-ico">${icon('chart', 18)}</span>
    <span class="rv-cta-text">
      <b>The week in review</b>
      <i>${key === arena.currentWeek() ? 'Sunday. One day left.' : escapeHtml(arena.weekLabel(key))}</i>
    </span>
    <span class="rv-cta-go">${icon('back', 15)}</span>
  </a>`;
}

export function renderHome(mount) {
  reorderMode = false;
  redraw(mount);
}

function redraw(mount) {
  const s = habits.settings();
  const sections = habits.grouped();
  const list = habits.active();
  const due = habits.dueToday();
  const days = s.reverseDays ? habits.recentDays(s.columns) : habits.recentDays(s.columns).reverse();
  const groupOptions = (current) =>
    `<option value="" ${current ? '' : 'selected'}>No group</option>${habits
      .groups()
      .map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === current ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
      .join('')}`;

  // The one control the grid needs, in the day header's empty name slot. It
  // costs no line of its own.
  const arrange = `<button class="arrange" id="arrangeBtn">${icon('reorder', 14)}<span>Arrange</span></button>`;
  const head = `<div class="hg-head"><span class="hg-name">${arrange}</span>${days.map(headCell).join('')}</div>`;

  const groupSections = sections
    .map(({ group, habits: rows }) => {
      if (!rows.length && !group) return '';
      const score = group ? habits.groupScore(group.id) : null;
      const collapsed = group?.collapsed;
      return `
        ${group
          ? `<div class="hg-group ${collapsed ? 'collapsed' : ''}" data-group="${escapeHtml(group.id)}">
              <button class="hg-group-btn" data-toggle="${escapeHtml(group.id)}">
                ${icon(collapsed ? 'caretDown' : 'caretUp', 14)}<b>${escapeHtml(group.name)}</b>
              </button>
              ${score == null ? '' : `<span class="pill ghost" data-group-score="${escapeHtml(group.id)}">${Math.round(score * 100)}%</span>`}
            </div>`
          : sections.length > 1 && rows.length
            ? '<div class="hg-group"><span class="hg-group-btn"><b>Everything else</b></span></div>'
            : ''}
        ${collapsed ? '' : `<div class="hg-rows">${rows.map((h) => rowHtml(h, days, s, { reorder: reorderMode, groupOptions })).join('')}</div>`}`;
    })
    .join('');

  mount.innerHTML = `
    <div class="screen home">
      <header class="grid-head">
        ${headRing(dueHead(due).frac)}
        <div class="gh-text">
          <h1 id="dueLine">${dueHead(due).text}</h1>
          <p>${escapeHtml(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        </div>
        <div class="head-actions">
          <button class="icon-btn" id="addBtn" aria-label="New habit">${icon('plus')}</button>
          <a class="icon-btn linkbtn" href="#/settings" aria-label="Settings">${icon('settings')}</a>
        </div>
      </header>

      ${reviewCta()}

      <div class="hgrid ${reorderMode ? 'reordering' : ''}" style="--cols:${reorderMode ? 1 : s.columns}">
        ${reorderMode
          ? `<div class="hg-arrange"><button class="arrange on" id="arrangeBtn">${icon('check', 14)}<span>Done</span></button></div>`
          : list.length ? head : ''}
        ${groupSections}
      </div>

      ${habits.active().length ? '' : starterPack()}

      <button class="btn ghost wide" id="addBtn2">${icon('plus', 16)}<span>New habit</span></button>

      <div id="installSlot"></div>
    </div>`;

  mount.querySelectorAll('#addBtn, #addBtn2').forEach((b) => b.addEventListener('click', openTypePicker));
  mount.querySelectorAll('[data-starter]').forEach((b) =>
    b.addEventListener('click', () => addStarter(mount, Number(b.dataset.starter))));
  mountInstall();
  wireGrid(mount, days);
}

function wireGrid(mount, days) {
  const s = habits.settings();
  const grid = mount.querySelector('.hgrid');

  const arrangeBtn = mount.querySelector('#arrangeBtn');
  // One button, two jobs: in reorder mode it is the way out.
  if (arrangeBtn) {
    arrangeBtn.addEventListener('click', () => {
      if (reorderMode) {
        reorderMode = false;
        redraw(mount);
        return;
      }
      openArrangeSheet(mount, s);
    });
  }

  grid.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      habits.toggleGroup(b.dataset.toggle);
      redraw(mount);
    })
  );

  if (reorderMode) {
    wireReorder(grid, mount);
    return;
  }

  wireCells(grid, mount, s);
}

/* ----------------- one cell, changed ----------------- */

function nodeFrom(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const ringLen = (r) => 2 * Math.PI * r;

/** The habit's own ring. */
function patchRowRing(row, habit) {
  const fill = row.querySelector('.hg-ring-fill');
  if (!fill) return;
  const f = Math.max(0, Math.min(habits.summary(habit).score, 1));
  fill.setAttribute('stroke-dashoffset', (ringLen(9) * (1 - f)).toFixed(1));
}

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
    fill.setAttribute('stroke', f >= 1 ? 'var(--good)' : 'var(--accent)');
  }
  mount.querySelectorAll('[data-group-score]').forEach((el) => {
    const score = habits.groupScore(el.dataset.groupScore);
    el.textContent = score == null ? '' : `${Math.round(score * 100)}%`;
  });

  // Once a day, on the tap that earns it, never on the way back down.
  const done = due.total > 0 && due.pending.length === 0;
  if (done && !wasDone) {
    haptic('level');
    chime('complete');
    const ring = mount.querySelector('.gh-ring');
    if (ring) celebrate(ring, { count: 20, spread: 74, colour: 'var(--good)' });
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
  chime(nowOn ? 'mark' : skipped ? 'skip' : 'unmark');
  if (nowOn && !wasOn) {
    next.classList.add('just-on');
    celebrate(next, { count: 8, spread: 26, colour: rowColour(habit) });
    next.addEventListener('animationend', () => next.classList.remove('just-on'), { once: true });
  }
}

/* ---------------------- marking ---------------------- */

function wireCells(grid, mount, s) {
  let timer = null;
  let held = false;

  const act = (cell) => {
    const row = cell.closest('.hg-row');
    if (!row) return;
    const habit = habits.byId(row.dataset.id);
    if (!habit) return;
    const key = cell.dataset.day;
    if (!key || key > habits.today()) return;
    if (habit.kind === 'number') return openValueSheet(mount, habit, key);
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

/** Keypad for a measurable habit, plus a button for each of the other states. */
function openValueSheet(mount, habit, key) {
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

/* --------------------- reordering --------------------- */

function wireReorder(grid, mount) {
  const commit = () => {
    habits.reorder([...grid.querySelectorAll('.hg-row[data-id]')].map((r) => r.dataset.id));
    redraw(mount);
  };

  grid.querySelectorAll('[data-move]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const row = btn.closest('.hg-row');
      const dir = btn.dataset.move === 'up' ? -1 : 1;
      const sibling = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (dir < 0) row.parentNode.insertBefore(row, sibling);
      else row.parentNode.insertBefore(sibling, row);
      haptic('tick');
      commit();
    })
  );

  grid.querySelectorAll('.hg-group-pick').forEach((sel) =>
    sel.addEventListener('change', () => {
      habits.moveToGroup(sel.closest('.hg-row').dataset.id, sel.value);
      redraw(mount);
    })
  );

  let dragging = null;
  grid.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.hg-drag');
    if (!handle) return;
    e.preventDefault();
    dragging = handle.closest('.hg-row');
    dragging.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    haptic('press');
  });

  grid.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const box = dragging.parentNode;
    const others = [...box.querySelectorAll('.hg-row')].filter((r) => r !== dragging);
    const next = others.find((r) => {
      const rect = r.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });
    box.insertBefore(dragging, next || null);
  });

  const drop = () => {
    if (!dragging) return;
    dragging.classList.remove('dragging');
    dragging = null;
    commit();
  };
  grid.addEventListener('pointerup', drop);
  grid.addEventListener('pointercancel', drop);
}

/* ---------------- groups ---------------- */

/** Everything about how the grid is laid out, in one place. Three chips above
 *  the grid said the same thing and cost a band of their own. */
function openArrangeSheet(mount, s) {
  const sheet = openSheet(`
    <h2>Arrange the grid</h2>
    <p class="muted small">Days on screen</p>
    <div class="pickrow">${[3, 4, 5, 6, 7]
      .map((n) => `<button class="pick ${n === s.columns ? 'on' : ''}" data-cols="${n}">${n}</button>`)
      .join('')}</div>
    <label class="setting toggle">
      <span><b>Oldest first</b><i>Days run left to right instead of newest on the left.</i></span>
      <input type="checkbox" id="rev" ${s.reverseDays ? 'checked' : ''}>
    </label>
    <button class="btn ghost wide" id="reorderGo">${icon('reorder', 16)}<span>Reorder habits</span></button>
    <button class="btn ghost wide" id="groupGo">${icon('filter', 16)}<span>Groups</span></button>`);

  sheet.el.querySelectorAll('[data-cols]').forEach((b) =>
    b.addEventListener('click', () => {
      store.update((st) => {
        st.habits.settings.columns = Number(b.dataset.cols);
      });
      sheet.close();
      redraw(mount);
    })
  );
  sheet.el.querySelector('#rev').addEventListener('change', (e) => {
    store.update((st) => {
      st.habits.settings.reverseDays = e.target.checked;
    });
    sheet.close();
    redraw(mount);
  });
  sheet.el.querySelector('#reorderGo').addEventListener('click', () => {
    sheet.close();
    reorderMode = true;
    redraw(mount);
  });
  sheet.el.querySelector('#groupGo').addEventListener('click', () => {
    sheet.close();
    openGroupSheet(mount);
  });
}

function openGroupSheet(mount) {
  const draw = () => {
    const list = habits.groups();
    const sheet = openSheet(`
      <h2>Groups</h2>
      <p class="muted small">A group is a heading with a score of its own.</p>
      ${list.length
        ? `<div class="grp-list">${list
            .map((g) => `<div class="grp-row" data-id="${escapeHtml(g.id)}">
              <input type="text" value="${escapeHtml(g.name)}" maxlength="40" aria-label="Group name">
              <button class="icon-btn small" data-up aria-label="Move up">${icon('arrowUp', 14)}</button>
              <button class="icon-btn small" data-down aria-label="Move down">${icon('arrowDown', 14)}</button>
              <button class="icon-btn small danger" data-del aria-label="Delete">${icon('trash', 14)}</button>
            </div>`)
            .join('')}</div>`
        : '<p class="fineprint">No groups yet.</p>'}
      <div class="measure-row">
        <input type="text" id="newGroup" placeholder="New group" maxlength="40">
        <button class="btn" id="addGroup">Add</button>
      </div>
      <button class="btn ghost wide" data-close>Done</button>`, { onClose: () => redraw(mount) });

    sheet.el.querySelector('#addGroup').addEventListener('click', () => {
      const name = sheet.el.querySelector('#newGroup').value.trim();
      if (!name) return;
      habits.addGroup(name);
      sheet.close();
      draw();
    });
    sheet.el.querySelectorAll('.grp-row').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('input').addEventListener('change', (e) => habits.renameGroup(id, e.target.value));
      row.querySelector('[data-up]').addEventListener('click', () => {
        habits.moveGroup(id, -1);
        sheet.close();
        draw();
      });
      row.querySelector('[data-down]').addEventListener('click', () => {
        habits.moveGroup(id, 1);
        sheet.close();
        draw();
      });
      row.querySelector('[data-del]').addEventListener('click', () => {
        if (!confirm('Delete this group? The habits in it stay.')) return;
        habits.removeGroup(id);
        sheet.close();
        draw();
      });
    });
  };
  draw();
}

/* -------------------- the archive -------------------- */

export function renderArchive(mount) {
  const list = habits.archived();

  mount.innerHTML = `
    <div class="screen habits">
      <header class="screen-head">
        <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
        <h1>Archive</h1>
        <span class="icon-btn ghost"></span>
      </header>

      ${list.length
        ? `<div class="arch-list">${list
            .map((h) => {
              const sum = habits.summary(h);
              return `<div class="arch-row" data-id="${escapeHtml(h.id)}">
                <span class="arch-text">
                  <b style="color:${habits.hexOf(h.colour)}">${escapeHtml(h.name)}</b>
                  <i>${escapeHtml(habits.freqLabel(h.freq))} · best ${sum.best} day${sum.best === 1 ? '' : 's'}</i>
                </span>
                <button class="btn small-btn" data-restore>Restore</button>
                <button class="icon-btn small danger" data-del aria-label="Delete">${icon('trash', 15)}</button>
              </div>`;
            })
            .join('')}</div>`
        : `<div class="empty-state">${icon('archive', 30)}<h2>Nothing archived</h2></div>`}
    </div>`;

  mount.querySelectorAll('.arch-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-restore]').addEventListener('click', () => {
      habits.setArchived(id, false);
      habits.syncAlarms();
      toast('Restored');
      renderArchive(mount);
    });
    row.querySelector('[data-del]').addEventListener('click', () => {
      if (!confirm('Delete this habit and everything ever recorded on it? There is no undo.')) return;
      habits.remove(id);
      habits.syncAlarms();
      toast('Deleted');
      renderArchive(mount);
    });
  });
}

/* ------------------- install prompt ------------------- */

let installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  mountInstall();
});

function mountInstall() {
  const slot = document.getElementById('installSlot');
  if (!slot || !installPrompt) return;
  slot.innerHTML = '<button class="btn ghost wide" id="installBtn">Install Habit Nemesis to your home screen</button>';
  slot.querySelector('#installBtn').addEventListener('click', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    slot.innerHTML = '';
  });
}
