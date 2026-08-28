// The habits section: the grid, its settings, and the archive.
//
// The grid is the whole feature in one screen. Rows are habits, columns are the
// last few days, and a cell is one tap. Everything else here exists to keep
// that screen yours: reorder by dragging, group and regroup, choose how many
// days are shown and which way round they run, and decide what a tap even
// means - a tick, a tick and a lapse, or a tick and a skip.
//
// The five other features appear at the top of the grid read-only, filled from
// their own records. They are the answer to the obvious objection to a habit
// tracker inside an app that already tracks five things: without them you would
// keep two records of the same morning and they would disagree by Friday.

import * as store from '../store.js';
import * as habits from './program.js';
import { escapeHtml, ringSvg, toast, openSheet, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { kegelName, peName } from '../names.js';
import { openTypePicker } from './edit.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_PRESS_MS = 420;

/** The small ring beside a habit's name: its score, in its own colour.
 *  `ringSvg` is the 168px one from the report screen and carries a gradient,
 *  a label and a caption, none of which survive being shrunk to 26px. */
function miniRing(frac, colour) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(frac, 1)));
  return `<svg class="hg-ring" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="${r}" fill="none" stroke="var(--line)" stroke-width="3"/>
    <circle cx="12" cy="12" r="${r}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 12 12)"/>
  </svg>`;
}

/** One cell. Four states for a yes/no habit and the measurement for a number,
 *  drawn so that "nothing recorded" and "recorded a miss" can be told apart
 *  when you have asked for that and are one thing when you have not. */
function cellHtml(habit, key, sum, s) {
  const d = sum.index.get(key);
  const raw = d?.raw;
  const colour = habits.hexOf(habit.colour);
  const future = key > habits.today();
  if (future) return `<button class="hg-cell future" data-day="${key}" disabled aria-hidden="true"></button>`;

  const label = `${habit.name}, ${key}`;
  if (raw === habits.SKIP) {
    return `<button class="hg-cell skip" data-day="${key}" aria-label="${escapeHtml(label)}: skipped">${icon('skip', 15)}</button>`;
  }
  if (habit.kind === 'number') {
    const has = typeof raw === 'number';
    const met = !!d?.hit;
    return `<button class="hg-cell num ${met ? 'on' : has ? 'part' : ''}" data-day="${key}"
      style="${met ? `color:${colour}` : ''}" aria-label="${escapeHtml(label)}">
      <b>${has ? escapeHtml(fmtNumber(raw)) : '–'}</b><i>${escapeHtml(habit.unit || '')}</i></button>`;
  }
  if (raw === habits.YES) {
    return `<button class="hg-cell on" data-day="${key}" style="color:${colour}" aria-label="${escapeHtml(label)}: done">${icon('check', 18)}</button>`;
  }
  if (raw === habits.NO) {
    return `<button class="hg-cell no" data-day="${key}" aria-label="${escapeHtml(label)}: missed">${icon('close', 16)}</button>`;
  }
  // Nothing recorded. A satisfied day inside a "three times a week" window is
  // still shown as carried rather than as done, because you did not do it
  // today and a tick would say you had.
  const carried = d?.satisfied ? ' carried' : '';
  return `<button class="hg-cell${carried}" data-day="${key}" aria-label="${escapeHtml(label)}: not recorded">${
    s.unknownMarks ? '<span class="hg-q">?</span>' : icon('close', 16)
  }</button>`;
}

function fmtNumber(v) {
  if (typeof v !== 'number') return '–';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

function headCell(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `<i class="${key === habits.today() ? 'now' : ''}"><b>${WEEKDAYS[dt.getDay()].toUpperCase()}</b><em>${dt.getDate()}</em></i>`;
}

function rowHtml(habit, days, s, { reorder = false, groupOptions = () => '' } = {}) {
  const sum = habits.summary(habit);
  const colour = habits.hexOf(habit.colour);
  const href = `#/habits/habit?id=${encodeURIComponent(habit.id)}`;
  return `<div class="hg-row ${habit.linked ? 'linked' : ''}" data-id="${escapeHtml(habit.id)}">
    ${reorder && !habit.linked ? `<button class="hg-drag" aria-label="Reorder ${escapeHtml(habit.name)}">${icon('reorder', 16)}</button>` : ''}
    <a class="hg-name" href="${href}">
      ${habit.linked ? `<span class="hg-link-ico" style="color:${colour}">${icon(habit.icon, 16)}</span>` : miniRing(sum.score, colour)}
      <span style="color:${colour}">${escapeHtml(habit.name)}</span>
    </a>
    ${reorder && !habit.linked
      ? `<div class="hg-move">
          <button class="icon-btn small" data-move="up" aria-label="Move up">${icon('arrowUp', 15)}</button>
          <button class="icon-btn small" data-move="down" aria-label="Move down">${icon('arrowDown', 15)}</button>
          <select class="hg-group-pick" aria-label="Group">${groupOptions(habit.group)}</select>
        </div>`
      : days.map((key) => cellHtml(habit, key, sum, s)).join('')}
  </div>`;
}

/* ---------------- the grid ---------------- */

let reorderMode = false;

/** The router calls this, and it always arrives with the grid in its normal
 *  state: reorder mode is a thing you are doing, not a preference, and coming
 *  back from a habit's own screen to a grid full of arrows and no cells reads
 *  as a bug. Redraws from inside the screen go through `redraw` instead. */
export function renderHabits(mount) {
  reorderMode = false;
  redraw(mount);
}

function redraw(mount) {
  const s = habits.settings();
  const sections = habits.grouped();
  const linked = habits.linkedHabits();
  const list = habits.active();
  const due = habits.dueToday();
  const days = s.reverseDays ? habits.recentDays(s.columns) : habits.recentDays(s.columns).reverse();
  const groupOptions = (current) =>
    `<option value="" ${current ? '' : 'selected'}>No group</option>${habits
      .groups()
      .map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === current ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
      .join('')}`;

  const head = `<div class="hg-head"><span class="hg-name"></span>${days.map(headCell).join('')}</div>`;

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
              ${score == null ? '' : `<span class="pill ghost">${Math.round(score * 100)}%</span>`}
            </div>`
          : sections.length > 1 && rows.length
            ? '<div class="hg-group"><span class="hg-group-btn"><b>Everything else</b></span></div>'
            : ''}
        ${collapsed ? '' : `<div class="hg-rows">${rows.map((h) => rowHtml(h, days, s, { reorder: reorderMode, groupOptions })).join('')}</div>`}`;
    })
    .join('');

  mount.innerHTML = `
    <div class="screen habits">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Habits</h1>
        <button class="icon-btn" id="addBtn" aria-label="New habit">${icon('plus')}</button>
        <button class="icon-btn" data-nav="habits-settings" aria-label="Settings">${icon('settings')}</button>
      </header>

      ${list.length
        ? `<div class="today habits-today">
            <div class="today-left">
              <h2>${due.pending.length ? `${due.pending.length} left today` : 'All done today'}</h2>
              <p class="muted small">${list.length} habit${list.length === 1 ? '' : 's'}${
                s.dayStartHour ? ` · the day turns at ${String(s.dayStartHour).padStart(2, '0')}:00` : ''
              }</p>
            </div>
            ${ringSvg(due.total ? due.done / due.total : 1, `${due.done}/${due.total}`, 'today', { size: 88 })}
          </div>

          <div class="hg-tools">
            <button class="chipbtn ${reorderMode ? 'on' : ''}" id="reorderBtn">${icon('reorder', 15)}<span>${reorderMode ? 'Done' : 'Reorder'}</span></button>
            <button class="chipbtn" id="colsBtn">${icon('calendar', 15)}<span>${s.columns} days</span></button>
            <button class="chipbtn" id="groupBtn">${icon('filter', 15)}<span>Groups</span></button>
          </div>

          <div class="hgrid ${reorderMode ? 'reordering' : ''}" style="--cols:${reorderMode ? 1 : s.columns}">
            ${reorderMode ? '' : head}
            ${linked.length && !reorderMode
              ? `<div class="hg-group"><span class="hg-group-btn"><b>From the rest of NiFo</b></span>
                   <span class="pill ghost">read-only</span></div>
                 <div class="hg-rows linked-rows">${linked.map((h) => rowHtml(h, days, s)).join('')}</div>`
              : ''}
            ${groupSections}
          </div>`
        : `<div class="empty-state">
            ${icon('habits', 34)}
            <h2>Nothing here yet</h2>
            <p class="muted">A habit is a question you answer every day. Name it, say how often, and it appears in the grid tomorrow morning whether you want it to or not.</p>
            <a class="btn primary linkbtn" href="#/habits/edit">Create your first habit</a>
          </div>`}

      ${list.length
        ? `<div class="linkrow">
            <a href="#/habits/edit">New habit</a>
            <a href="#/habits/archive">Archive</a>
            <a href="#/habits/settings">Settings</a>
          </div>`
        : ''}
    </div>`;

  mount.querySelector('#addBtn')?.addEventListener('click', openTypePicker);
  if (!list.length) return;
  wireGrid(mount, days);
}

function wireGrid(mount, days) {
  const s = habits.settings();
  const grid = mount.querySelector('.hgrid');

  mount.querySelector('#reorderBtn').addEventListener('click', () => {
    reorderMode = !reorderMode;
    redraw(mount);
  });

  mount.querySelector('#colsBtn').addEventListener('click', () => {
    const sheet = openSheet(`
      <h2>Days on screen</h2>
      <p class="muted small">How many day columns the grid shows. Fewer means wider cells, which matters more than it sounds when you are tapping one on a phone.</p>
      <div class="pickrow">${[3, 4, 5, 6, 7]
        .map((n) => `<button class="pick ${n === s.columns ? 'on' : ''}" data-cols="${n}">${n}</button>`)
        .join('')}</div>
      <label class="setting toggle">
        <span><b>Oldest first</b><i>Days run left to right instead of newest on the left.</i></span>
        <input type="checkbox" id="rev" ${s.reverseDays ? 'checked' : ''}>
      </label>
      <button class="btn wide" data-close>Done</button>`);
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
  });

  mount.querySelector('#groupBtn').addEventListener('click', () => openGroupSheet(mount));

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

/* ---------------- marking ----------------
   Two ways in, because the setting says so. A short press is fast and is what
   you want at the end of a day; press-and-hold is what you want when the grid
   lives one thumb-width from where you scroll. */

function wireCells(grid, mount, s) {
  let timer = null;
  let held = false;

  const act = (cell) => {
    const row = cell.closest('.hg-row');
    if (!row || row.classList.contains('linked')) return;
    const habit = habits.byId(row.dataset.id);
    if (!habit) return;
    const key = cell.dataset.day;
    if (!key || key > habits.today()) return;
    if (habit.kind === 'number') return openValueSheet(mount, habit, key);
    haptic('tick');
    habits.setValue(habit.id, key, habits.nextValue(habit, key));
    redraw(mount);
  };

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.hg-cell');
    if (!cell) return;
    // A long press has already acted; the click that follows it must not undo
    // that by cycling a second time.
    if (held) {
      held = false;
      return;
    }
    if (!s.shortPress) return;
    act(cell);
  });

  if (s.shortPress) return;

  grid.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.hg-cell');
    if (!cell) return;
    held = false;
    timer = setTimeout(() => {
      held = true;
      act(cell);
    }, LONG_PRESS_MS);
  });
  const cancel = () => clearTimeout(timer);
  grid.addEventListener('pointerup', cancel);
  grid.addEventListener('pointercancel', cancel);
  grid.addEventListener('pointerleave', cancel);
  grid.addEventListener('scroll', cancel, true);
}

/** The keypad for a measurable habit. A number is not a toggle, so it gets a
 *  field, and the two other states a cell can hold get a button each. */
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
    habits.setValue(habit.id, key, value);
    sheet.close();
    redraw(mount);
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

/* ---------------- reordering ----------------
   Drag inside a group, arrows for anyone who would rather not, and a picker to
   move a habit between groups. The row is moved in the DOM as the pointer
   crosses its neighbours rather than being floated above them on a transform:
   the same result with none of the arithmetic, and nothing to get out of step
   when a row is a different height from the one it is passing. */

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

function openGroupSheet(mount) {
  const draw = () => {
    const list = habits.groups();
    const sheet = openSheet(`
      <h2>Groups</h2>
      <p class="muted small">A group is a heading with a score of its own. Deleting one never deletes the habits in it; they come back out and carry on.</p>
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

/* ---------------- settings ---------------- */

export function renderHabitSettings(mount) {
  const s = habits.settings();

  mount.innerHTML = `
    <div class="screen habits">
      <header class="screen-head">
        <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
        <h1>Habits</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>The day</h2></div>
        <label class="setting">
          <span><b>First day of the week</b><i>Where the calendar and the weekly buckets start.</i></span>
          <select id="firstDay">
            ${WEEKDAYS_LONG.map((d, i) => `<option value="${i}" ${s.firstDay === i ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>A new day begins at</b><i>Past midnight, so something ticked at 01:00 belongs to the night you were still up for. This section only: the other five record against midnight.</i></span>
          <select id="dayStart">
            ${[0, 1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}" ${s.dayStartHour === h ? 'selected' : ''}>${h === 0 ? 'Midnight' : `${String(h).padStart(2, '0')}:00`}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Days on screen</b><i>Columns in the grid.</i></span>
          <select id="columns">
            ${[3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${s.columns === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <label class="setting toggle">
          <span><b>Oldest first</b><i>Days run left to right instead of newest on the left.</i></span>
          <input type="checkbox" id="reverseDays" ${s.reverseDays ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('flash', 16)}<h2>Marking</h2></div>
        <label class="setting toggle">
          <span><b>Toggle with a short press</b><i>One tap marks a day. Turn it off and a cell needs holding, which is what you want if you keep catching them while scrolling.</i></span>
          <input type="checkbox" id="shortPress" ${s.shortPress ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Skip days</b><i>Tap again for a skip instead of clearing. A skip leaves the score exactly where it was and keeps the streak running through it: it is for the days that genuinely did not count.</i></span>
          <input type="checkbox" id="skipDays" ${s.skipDays ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Question marks for missing data</b><i>Tells a day you never answered apart from a day you answered no. With this on, tap twice to record a real lapse.</i></span>
          <input type="checkbox" id="unknownMarks" ${s.unknownMarks ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('home', 16)}<h2>The rest of NiFo</h2></div>
        <label class="setting toggle">
          <span><b>Show the other five</b><i>${escapeHtml(kegelName())}, ${escapeHtml(peName())}, the Bible, the rule and the wind-down, at the top of the grid, filled from their own records and not tappable here.</i></span>
          <input type="checkbox" id="showLinked" ${s.showLinked ? 'checked' : ''}>
        </label>
        <p class="fineprint">They are read-only on purpose. Two records of the same morning disagree within a week, and the one you can edit is always the one that ends up wrong.</p>
      </section>

      <section class="card">
        <div class="h-row">${icon('images', 16)}<h2>Data</h2></div>
        <p class="small muted">A spreadsheet of every habit against every day. The whole-app backup under Settings is the one that can be imported back; this one is for reading.</p>
        <button class="btn wide" id="csv">Export as CSV</button>
      </section>

      <div class="linkrow">
        <a href="#/habits/archive">Archive</a>
        <a href="#/habits/edit">New habit</a>
      </div>
    </div>`;

  const set = (key, value) =>
    store.update((st) => {
      st.habits.settings[key] = value;
    });

  mount.querySelector('#firstDay').addEventListener('change', (e) => set('firstDay', Number(e.target.value)));
  mount.querySelector('#dayStart').addEventListener('change', (e) => {
    set('dayStartHour', Number(e.target.value));
    toast('Saved');
  });
  mount.querySelector('#columns').addEventListener('change', (e) => set('columns', Number(e.target.value)));
  ['reverseDays', 'shortPress', 'skipDays', 'unknownMarks', 'showLinked'].forEach((id) =>
    mount.querySelector(`#${id}`).addEventListener('change', (e) => set(id, e.target.checked))
  );
  mount.querySelector('#csv').addEventListener('click', exportCsv);
}

/** Every habit against every day, newest first. Quoted properly, because a
 *  habit called `Run, then stretch` would otherwise become two columns. */
function exportCsv() {
  const list = habits.active().concat(habits.archived());
  if (!list.length) return toast('No habits to export');
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const sums = list.map((h) => habits.summary(h));
  const first = sums.reduce((a, s) => (s.days.length && (!a || s.days[0].key < a) ? s.days[0].key : a), null);
  const rows = [['date', ...list.map((h) => h.name)].map(q).join(',')];
  for (let key = habits.today(); first && key >= first; key = store.addDays(key, -1)) {
    rows.push(
      [
        key,
        ...sums.map((s) => {
          const d = s.index.get(key);
          if (!d || d.raw === undefined) return '';
          if (d.raw === habits.SKIP) return 'skip';
          return d.raw;
        }),
      ]
        .map(q)
        .join(',')
    );
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nifo-habits-${store.dayKey()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('CSV downloaded');
}

/* ---------------- the archive ----------------
   Archiving is the answer to a habit you have finished with but whose record
   you would rather not delete. It leaves the grid and keeps everything. */

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
                  <i>${escapeHtml(habits.freqLabel(h.freq))} · ${sum.total} recorded · best ${sum.best} day${sum.best === 1 ? '' : 's'}</i>
                </span>
                <button class="btn small-btn" data-restore>Restore</button>
                <button class="icon-btn small danger" data-del aria-label="Delete">${icon('trash', 15)}</button>
              </div>`;
            })
            .join('')}</div>`
        : `<div class="empty-state">${icon('archive', 30)}<h2>Nothing archived</h2>
            <p class="muted">Archiving a habit takes it out of the grid and keeps every day you ever marked on it.</p></div>`}
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
