// The home screen: the grid.
//
// Rows are what you keep, columns are the last few days, a cell is one tap.
//
//   The name goes there.  Tapping a row's name opens it.
//   The cell does it.     Tapping today starts the thing, or marks the day.
//
// Only today acts. A past cell on one of the five is that section's record.
// The markup is grid.js's, the tap wiring marking.js's; this file is the
// screens and what arranges them.

import * as store from '../store.js';
import * as habits from './program.js';
import { escapeHtml, toast, openSheet, haptic, chime } from '../ui.js';
import { icon } from '../icons.js';
import { openTypePicker } from './edit.js';
import * as arena from '../arena/program.js';
import { headCell, rowHtml, dueHead, headRing } from './grid.js';
import { wireCells } from './marking.js';

/* ---------------- the grid ---------------- */

let reorderMode = false;

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

/** The router calls this, and it always arrives in the normal state: reorder
 *  mode is something you are doing, not a preference. Internal redraws go
 *  through `redraw`. */
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

  wireCells(grid, mount, s, redraw);
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
