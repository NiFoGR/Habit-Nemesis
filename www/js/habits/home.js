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
import { headCell, rowHtml, dueHead, headRing, miniRing, cellSize } from './grid.js';
import { wireCells, openValueSheet } from './marking.js';
import { announce } from '../arena/result.js';
import { configured } from '../account/config.js';
import { signedIn } from '../account/session.js';

/* ---------------- the grid ---------------- */

let reorderMode = false;
let query = '';
const SEARCH_FROM = 12;

/* ---------------- the first five ---------------- */
// An empty grid is the worst first screen this app can show, and "New habit" on
// its own asks someone to invent a system before they have used one. Five to
// tap, already sensible. They go the moment there is a habit on the grid.

function starterPack() {
  return `<section class="starters">
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

/** One card, for anyone who chose Not now. Gone for good once dismissed twice. */
function accountNudge() {
  if (!configured() || signedIn() || store.get().settings.nudges >= 2 || !habits.active().length) return '';
  return `<div class="card nudge" id="nudge">
    <div class="nudge-text"><b>No account</b><i>Lose the phone, lose the record.</i></div>
    <a class="btn small-btn primary" href="#/account">Sign in</a>
    <button class="icon-btn small" id="nudgeOff" aria-label="Dismiss">${icon('close', 14)}</button>
  </div>`;
}

/** The router calls this, and it always arrives in the normal state: reorder
 *  mode is something you are doing, not a preference. Internal redraws go
 *  through `redraw`. */
export function renderHome(mount) {
  reorderMode = false;
  redraw(mount);
  if (habits.catchUpDue() && !document.querySelector('.sheet-scrim')) openCatchUp(mount);
}

/** Name and note, case blind. Rows that miss are hidden, not removed. */
function filterRows(mount) {
  const q = query.trim().toLowerCase();
  mount.querySelectorAll('.hg-row[data-id]').forEach((row) => {
    const h = habits.byId(row.dataset.id);
    const hit = !q || `${h?.name || ''} ${h?.notes || ''}`.toLowerCase().includes(q);
    row.classList.toggle('hidden', !hit);
  });
  // A group whose rows all missed is a heading over nothing.
  mount.querySelectorAll('.hg-rows').forEach((box) => {
    const gone = !box.querySelector('.hg-row:not(.hidden)');
    box.classList.toggle('hidden', gone);
    const head = box.previousElementSibling;
    if (head?.classList.contains('hg-group')) head.classList.toggle('hidden', gone);
  });
  // Nothing left to head: the day columns go with the rows.
  const empty = !mount.querySelector('.hg-row:not(.hidden)');
  mount.querySelector('.hg-none')?.classList.toggle('hidden', !empty);
  mount.querySelector('.hg-head')?.classList.toggle('hidden', empty);
}

/* ---------------- yesterday ---------------- */
// Open the app after a missed day and the honest response is not silence.
// Yesterday only: the calendar does the longer backfill.

function openCatchUp(mount) {
  const key = store.addDays(habits.today(), -1);
  const rows = habits.unansweredOn(key);
  habits.markCatchUp();
  const sheet = openSheet(`
    <h2>Yesterday</h2>
    <p class="muted small">${rows.length} row${rows.length === 1 ? '' : 's'} unanswered.</p>
    <div class="catch-list">${rows
      .map((h) => `<button class="catch-row" data-id="${escapeHtml(h.id)}" style="--sc:${habits.hexOf(h.colour)}">
        <span class="starter-dot"></span>
        <span class="catch-name">${escapeHtml(h.name)}</span>
        <span class="catch-mark">${icon('check', 16)}</span>
      </button>`)
      .join('')}</div>
    <button class="btn ghost wide" data-close>Nothing to correct</button>`, { onClose: () => redraw(mount) });

  sheet.el.querySelectorAll('.catch-row').forEach((b) =>
    b.addEventListener('click', () => {
      const h = habits.byId(b.dataset.id);
      if (!h || b.classList.contains('on')) return;
      if (h.kind !== 'yesno') {
        sheet.close();
        return openValueSheet(mount, h, key, redraw);
      }
      habits.setValue(h.id, key, habits.YES);
      announce();
      haptic('hit');
      chime('mark');
      b.classList.add('on');
    }));
}

/* ---------------- the head ---------------- */

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function gridHead(list, due) {
  const head = dueHead(due);
  return `<header class="grid-head">
      ${list.length ? headRing(head.frac) : ''}
      <div class="gh-text">
        <h1 id="dueLine">${head.text}</h1>
        <p>${escapeHtml(todayLabel())}</p>
      </div>
      <div class="head-actions">
        ${list.length ? `<button class="icon-btn" id="arrangeBtn" aria-label="Arrange">${icon('reorder')}</button>` : ''}
        <button class="icon-btn" id="addBtn" aria-label="New habit">${icon('plus')}</button>
        <a class="icon-btn linkbtn" href="#/settings" aria-label="Settings">${icon('settings')}</a>
      </div>
    </header>`;
}

/** Reordering is a mode, not a preference, so it says so and has one way out. */
function reorderHead() {
  return `<header class="grid-head reordering">
      <div class="gh-text">
        <h1>Reorder</h1>
        ${habits.groups().length ? '<p>Drag a row into another group.</p>' : ''}
      </div>
      <button class="btn small-btn primary" id="arrangeBtn">Done</button>
    </header>`;
}

/* ---------------- the sections ---------------- */

/** Every bucket, empty ones included: you cannot drag into what is not drawn. */
function reorderSections() {
  const list = habits.active();
  const out = habits.groups().map((g) => ({ group: g, habits: list.filter((h) => h.group === g.id) }));
  if (!out.length) return [{ group: null, habits: list }];
  out.push({ group: null, habits: list.filter((h) => !h.group || !habits.groupById(h.group)) });
  return out;
}

/** One line whichever it carries: a caret slot a ring wide, name, clock, score. */
function groupHead({ group, collapsed, run, score }) {
  const gid = group ? group.id : '';
  const caret = group && !reorderMode ? icon(collapsed ? 'caretDown' : 'caretUp', 14) : '';
  const inner = `<span class="hg-caret">${caret}</span><b>${group ? escapeHtml(group.name) : 'Everything else'}</b>`;
  return `<div class="hg-group${collapsed ? ' collapsed' : ''}">
      ${group && !reorderMode
        ? `<button class="hg-group-btn" data-toggle="${escapeHtml(gid)}" aria-expanded="${!collapsed}">${inner}</button>`
        : `<span class="hg-group-btn">${inner}</span>`}
      ${run ? `<i class="hg-clock">${run.days} day${run.days === 1 ? '' : 's'} left</i>` : ''}
      ${score == null ? '' : `<i class="hg-score" data-group-score="${escapeHtml(gid)}">${Math.round(score * 100)}%</i>`}
    </div>`;
}

function sectionsHtml(days, s) {
  // Reordering draws every bucket; the grid draws only the ones with rows.
  const sections = reorderMode
    ? reorderSections()
    : habits.grouped().filter((sec) => sec.habits.length);
  return sections
    .map(({ group, habits: rows }) => {
      const gid = group ? group.id : '';
      const collapsed = !reorderMode && !!group?.collapsed;
      const shown = group || sections.length > 1;
      return `
        ${shown ? groupHead({
          group,
          collapsed,
          run: group && !reorderMode ? habits.protocolOf(gid) : null,
          score: reorderMode ? null : habits.groupScore(gid),
        }) : ''}
        ${collapsed ? '' : `<div class="hg-rows" data-group="${escapeHtml(gid)}">${rows
          .map((h) => rowHtml(h, days, s, { reorder: reorderMode }))
          .join('')}</div>`}`;
    })
    .join('');
}

function redraw(mount) {
  const s = habits.settings();
  const list = habits.active();
  const due = habits.dueToday();
  const days = s.reverseDays ? habits.recentDays(s.columns) : habits.recentDays(s.columns).reverse();

  // Past twelve rows a thumb cannot find one, so a field. Below that, none.
  const search = list.length > SEARCH_FROM && !reorderMode
    ? `<input type="search" class="hg-search" id="search" placeholder="Search" value="${escapeHtml(query)}" autocomplete="off">`
    : '';

  const grid = `
      <div class="hgrid${reorderMode ? ' reordering' : ''}" style="--cols:${s.columns};--cell:${cellSize(s.columns)}px">
        ${reorderMode ? '' : `<div class="hg-head"><span class="hg-name"></span>${days.map(headCell).join('')}</div>`}
        ${sectionsHtml(days, s)}
        ${search ? '<p class="hg-none hidden">Nothing matches.</p>' : ''}
      </div>`;

  mount.innerHTML = `
    <div class="screen home">
      ${reorderMode ? reorderHead() : gridHead(list, due)}
      ${reorderMode ? '' : reviewCta()}
      ${search}
      ${list.length ? grid : starterPack()}
      ${reorderMode ? '' : accountNudge()}
      ${reorderMode ? '' : `<button class="btn ghost wide" id="addBtn2">${icon('plus', 16)}<span>New habit</span></button>`}
      <div id="installSlot"></div>
    </div>`;

  mount.querySelectorAll('#addBtn, #addBtn2').forEach((b) => b.addEventListener('click', openTypePicker));
  mount.querySelectorAll('[data-starter]').forEach((b) =>
    b.addEventListener('click', () => addStarter(mount, Number(b.dataset.starter))));
  const field = mount.querySelector('#search');
  if (field) {
    field.addEventListener('input', () => {
      query = field.value;
      filterRows(mount);
    });
    filterRows(mount);
  } else {
    query = '';
  }
  mount.querySelector('#nudgeOff')?.addEventListener('click', () => {
    store.update((st) => {
      st.settings.nudges += 1;
    });
    mount.querySelector('#nudge')?.remove();
  });
  mountInstall();
  wireGrid(mount);
}

function wireGrid(mount) {
  const s = habits.settings();
  const grid = mount.querySelector('.hgrid');

  // One button, two jobs: in reorder mode it is the way out.
  mount.querySelector('#arrangeBtn')?.addEventListener('click', () => {
    if (reorderMode) {
      reorderMode = false;
      redraw(mount);
      return;
    }
    openArrangeSheet(mount, s);
  });

  if (!grid) return;

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
  const boxes = () => [...grid.querySelectorAll('.hg-rows')];

  // A row's group is the bucket it was dropped in, and its order is the grid's.
  const commit = () => {
    boxes().forEach((box) => {
      const gid = box.dataset.group || '';
      box.querySelectorAll('.hg-row[data-id]').forEach((r) => {
        const h = habits.byId(r.dataset.id);
        if (h && (h.group || '') !== gid) habits.moveToGroup(h.id, gid);
      });
    });
    habits.reorder([...grid.querySelectorAll('.hg-row[data-id]')].map((r) => r.dataset.id));
    redraw(mount);
  };

  grid.querySelectorAll('[data-move]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const row = btn.closest('.hg-row');
      const up = btn.dataset.move === 'up';
      const sibling = up ? row.previousElementSibling : row.nextElementSibling;
      if (sibling) {
        if (up) row.parentNode.insertBefore(row, sibling);
        else row.parentNode.insertBefore(sibling, row);
      } else {
        // Off the end of a group: the arrows cross into the next one.
        const list = boxes();
        const next = list[list.indexOf(row.parentNode) + (up ? -1 : 1)];
        if (!next) return;
        next.insertBefore(row, up ? null : next.firstElementChild);
      }
      haptic('tick');
      commit();
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
    // Pointer capture keeps the events here, so the bucket is found by hit test.
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.hg-rows');
    const box = over || dragging.parentNode;
    const next = [...box.querySelectorAll('.hg-row')]
      .filter((r) => r !== dragging)
      .find((r) => {
        const rect = r.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });
    if (next !== dragging.nextElementSibling || box !== dragging.parentNode) box.insertBefore(dragging, next || null);
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
      <span><b>Oldest first</b><i>Days run left to right.</i></span>
      <input type="checkbox" id="rev" ${s.reverseDays ? 'checked' : ''}>
    </label>
    <div class="btn-row">
      <button class="btn" id="reorderGo">Reorder</button>
      <button class="btn" id="groupGo">Groups</button>
    </div>
    <button class="btn ghost wide" data-close>Done</button>`);

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
      <p class="muted small">A heading with a score of its own.</p>
      ${list.length
        ? `<div class="grp-list">${list
            .map((g) => `<div class="grp-row" data-id="${escapeHtml(g.id)}">
              <input class="grp-name" type="text" value="${escapeHtml(g.name)}" maxlength="40" aria-label="Group name">
              <button class="grp-btn" data-up aria-label="Move ${escapeHtml(g.name)} up">${icon('arrowUp', 15)}</button>
              <button class="grp-btn" data-down aria-label="Move ${escapeHtml(g.name)} down">${icon('arrowDown', 15)}</button>
              <button class="row-act danger" data-del aria-label="Delete ${escapeHtml(g.name)}">Delete</button>
            </div>`)
            .join('')}</div>`
        : ''}
      <div class="grp-add">
        <input class="grp-name" type="text" id="newGroup" placeholder="New group" maxlength="40">
        <button class="btn small-btn" id="addGroup">Add</button>
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
        const snap = habits.groupSnapshot(id);
        habits.removeGroup(id);
        sheet.close();
        draw();
        toast('Group deleted. The habits stay.', { undo: () => { habits.reinstateGroup(snap); redraw(mount); } });
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
              const colour = habits.hexOf(h.colour);
              return `<div class="arch-row" data-id="${escapeHtml(h.id)}">
                ${miniRing(sum.score, colour)}
                <span class="arch-text">
                  <b style="color:${colour}">${escapeHtml(h.name)}</b>
                  <i>${escapeHtml(habits.freqLabel(h.freq))}${sum.best ? ` · best ${sum.best} day${sum.best === 1 ? '' : 's'}` : ''}</i>
                </span>
                <button class="row-act" data-restore aria-label="Restore ${escapeHtml(h.name)}">Restore</button>
                <button class="row-act danger" data-del aria-label="Delete ${escapeHtml(h.name)}">Delete</button>
              </div>`;
            })
            .join('')}</div>`
        : `<div class="empty-state">${icon('archive', 28)}<h2>Nothing archived</h2>
            <p class="muted small">A habit is archived from its own screen.</p></div>`}
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
      const snap = habits.snapshotOf(id);
      habits.remove(id);
      renderArchive(mount);
      toast('Deleted', { undo: () => { habits.reinstate(snap); renderArchive(mount); } });
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
