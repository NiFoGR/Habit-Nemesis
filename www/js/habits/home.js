// The home screen: the grid.
//
// This is the whole app in one screen. Rows are the things you keep - the five
// the app itself asks of you and every one you added - columns are the last few
// days, and a cell is one tap. There is no menu above it and no dashboard
// beside it, because both were the same list a third time.
//
// Two rules, and they hold for every row without exception:
//
//   The name goes there.  Tapping "Kegels" opens the Kegels section; tapping a
//                         habit opens its own screen.
//   The cell does it.     Tapping today on Kegels starts a session; on a habit
//                         it marks the day.
//
// Only today acts. A past cell on one of the five is a reading of that
// section's own record and cannot be edited here, because two editable copies
// of one morning disagree by Friday.

import * as store from '../store.js';
import * as habits from './program.js';
import { escapeHtml, ringSvg, toast, openSheet, haptic } from '../ui.js';
import { icon, logoMark } from '../icons.js';
import { navigate } from '../back.js';
import { openTypePicker } from './edit.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_PRESS_MS = 420;

const rowColour = (habit) => (habit.colour ? habits.hexOf(habit.colour) : 'var(--accent)');

/** The line under a row's name. One of the five says what that section still
 *  owes today; a measurable habit says what it is counting and what counts as
 *  done, which is the context its bare numbers need and which used to be
 *  stamped on every cell instead. */
function detailOf(habit) {
  if (habit.linked) return habit.detail;
  if (habit.kind !== 'number') return '';
  const unit = habit.unit || '';
  if (!habit.target) return unit;
  const aim = `${habit.targetType === 'atmost' ? 'under' : 'at least'} ${fmtNumber(habit.target)}`;
  return unit ? `${unit} · ${aim}` : aim;
}

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
  const colour = rowColour(habit);
  const future = key > habits.today();
  if (future) return `<button class="hg-cell future" data-day="${key}" disabled aria-hidden="true"></button>`;

  // One of the five: only today does anything, and what it does is start the
  // thing. Everything behind today is that section's record, shown not edited.
  const go = habit.linked && key === habits.today() && habit.action
    ? ` data-go="${escapeHtml(habit.action)}"`
    : '';
  const label = `${habit.name}, ${key}`;
  if (raw === habits.SKIP) {
    return `<button class="hg-cell skip" data-day="${key}"${go} aria-label="${escapeHtml(label)}: skipped">${icon('skip', 15)}</button>`;
  }
  if (habit.kind === 'number') {
    const has = typeof raw === 'number';
    const met = !!d?.hit;
    // No unit here. It was on every cell, four identical copies of "Liters"
    // across one row, crowding out the one thing that actually differs. It is
    // said once, under the name, where it belongs.
    return `<button class="hg-cell num ${met ? 'on' : has ? 'part' : ''}" data-day="${key}"${go}
      style="${met ? `color:${colour}` : ''}" aria-label="${escapeHtml(label)}: ${has ? fmtNumber(raw) : 'nothing'} ${escapeHtml(habit.unit || '')}">
      ${has ? escapeHtml(fmtNumber(raw)) : '–'}</button>`;
  }
  if (raw === habits.YES) {
    return `<button class="hg-cell on" data-day="${key}"${go} style="color:${colour}" aria-label="${escapeHtml(label)}: done">${icon('check', 18)}</button>`;
  }
  if (raw === habits.NO) {
    return `<button class="hg-cell no" data-day="${key}"${go} aria-label="${escapeHtml(label)}: missed">${icon('close', 16)}</button>`;
  }
  // Nothing recorded. A satisfied day inside a "three times a week" window is
  // still shown as carried rather than as done, because you did not do it
  // today and a tick would say you had.
  const carried = d?.satisfied ? ' carried' : '';
  // One of the five, still owed today: this cell starts it, so it is drawn as
  // something to press rather than as a day you have already failed to tick.
  if (go) {
    return `<button class="hg-cell go" data-day="${key}"${go} style="color:${colour}"
      aria-label="Start ${escapeHtml(habit.name)}">${icon('play', 15)}</button>`;
  }
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
  // The five the app asks of you take the accent; the ones you made take the
  // colour you chose. Colour on this screen therefore means "mine", which is
  // the only thing left for it to mean once the section palettes are gone.
  const colour = rowColour(habit);
  // The name goes there: a habit to its own screen, one of the five to its
  // section. Never to the same place as the cell beside it.
  const href = habit.linked ? habit.href : `#/habits/habit?id=${encodeURIComponent(habit.id)}`;
  return `<div class="hg-row ${habit.linked ? 'linked' : ''}" data-id="${escapeHtml(habit.id)}">
    ${reorder && !habit.linked ? `<button class="hg-drag" aria-label="Reorder ${escapeHtml(habit.name)}">${icon('reorder', 16)}</button>` : ''}
    <a class="hg-name" href="${href}">
      ${habit.linked ? `<span class="hg-link-ico" style="color:${colour}">${icon(habit.icon, 17)}</span>` : miniRing(sum.score, colour)}
      <span class="hg-label">
        <b${habit.linked ? '' : ` style="color:${colour}"`}>${escapeHtml(habit.name)}</b>
        ${detailOf(habit) ? `<i>${escapeHtml(detailOf(habit))}</i>` : ''}
      </span>
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

/** The home screen. The router calls this, and it always arrives with the grid
 *  in its normal state: reorder mode is a thing you are doing, not a
 *  preference, and coming back from a habit's own screen to a grid full of
 *  arrows and no cells reads as a bug. Redraws from inside the screen go
 *  through `redraw` instead. */
export function renderHome(mount) {
  reorderMode = false;
  redraw(mount);
}

function redraw(mount) {
  const s = habits.settings();
  const sections = habits.grouped();
  const linked = habits.linkedHabits();
  const list = habits.active();
  const due = habits.dueToday();
  const run = habits.bestRun();
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
    <div class="screen home">
      <header class="hub-head">
        <div class="brand-row">${logoMark(26)}<h1>NiFo</h1></div>
        <div class="head-actions">
          <button class="icon-btn" id="addBtn" aria-label="New habit">${icon('plus')}</button>
          <a class="icon-btn linkbtn" href="#/settings" aria-label="Settings">${icon('settings')}</a>
        </div>
      </header>

      <div class="today home-today">
        <div class="today-left">
          <h2>${due.pending.length ? `${due.pending.length} left today` : 'All done today'}</h2>
          <p class="muted small">${escapeHtml(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          ${run ? `<p class="run-line">${icon('flame', 14)}<span><b>${run.days}</b> day${run.days === 1 ? '' : 's'} of ${escapeHtml(run.name)}</span></p>` : ''}
        </div>
        ${ringSvg(due.total ? due.done / due.total : 1, `${due.done}/${due.total}`, 'today', { size: 84 })}
      </div>

      <div class="hg-tools">
        <button class="chipbtn ${reorderMode ? 'on' : ''}" id="reorderBtn">${icon('reorder', 15)}<span>${reorderMode ? 'Done' : 'Reorder'}</span></button>
        <button class="chipbtn" id="colsBtn">${icon('calendar', 15)}<span>${s.columns} day${s.columns === 1 ? '' : 's'}</span></button>
        <button class="chipbtn" id="groupBtn">${icon('filter', 15)}<span>Groups</span></button>
      </div>

      <div class="hgrid ${reorderMode ? 'reordering' : ''}" style="--cols:${reorderMode ? 1 : s.columns}">
        ${reorderMode ? '' : head}
        ${linked.length && !reorderMode
          ? `<div class="hg-rows">${linked.map((h) => rowHtml(h, days, s)).join('')}</div>`
          : ''}
        ${groupSections}
      </div>

      <button class="btn ghost wide" id="addBtn2">${icon('plus', 16)}<span>New habit</span></button>

      <div id="installSlot"></div>
    </div>`;

  mount.querySelectorAll('#addBtn, #addBtn2').forEach((b) => b.addEventListener('click', openTypePicker));
  mountInstall();
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
    // One of the five: today's cell is the section's own start button.
    if (cell.dataset.go) return navigate(cell.dataset.go);
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
    // Starting a session is navigation, not marking, so it never waits for a
    // long press even when marking does.
    if (cell.dataset.go) return navigate(cell.dataset.go);
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

/* ---------------- install prompt ----------------
   Lives here because the slot it fills is on this screen. Chrome fires the
   event once, whenever it feels like it, which may be before or after the home
   screen has rendered, so the prompt is stashed and mounted from both
   directions. Moved here wholesale when the hub became the grid. */

let installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  mountInstall();
});

function mountInstall() {
  const slot = document.getElementById('installSlot');
  if (!slot || !installPrompt) return;
  slot.innerHTML = '<button class="btn ghost wide" id="installBtn">Install NiFo to your home screen</button>';
  slot.querySelector('#installBtn').addEventListener('click', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    slot.innerHTML = '';
  });
}
