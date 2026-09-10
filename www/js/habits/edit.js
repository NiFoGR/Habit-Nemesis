// Creating and editing a habit. Every field can be changed afterwards,
// frequency and target included: scores recompute from the entries.
// Yes/no against measurable is the exception, there is no honest conversion.

import * as habits from './program.js';
import { escapeHtml, toast, openSheet } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, replaceWith } from '../back.js';
import { askAlarms, hasAlarms } from '../native.js';

const WEEK_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The keypad and the notification read this back, so it asks per kind.
const QUESTION_HINT = {
  yesno: 'e.g. Did you exercise today?',
  number: 'e.g. How many litres today?',
  timed: 'e.g. How long did you read?',
};

/** The back arrow, turned round: Settings marks an opening row with it. */
const chevron = () => icon('back', 16);

/* ------------------ the type picker ------------------ */

function typeRows(extra = '') {
  return `
    <div class="type-cards">
      <a class="type-card" href="#/habits/edit?kind=yesno">
        <b>Yes or No</b><span>Done, or not done.</span>
      </a>
      <a class="type-card" href="#/habits/edit?kind=number">
        <b>Measurable</b><span>A number against a target.</span>
      </a>
      <a class="type-card" href="#/habits/edit?kind=timed">
        <b>Timed</b><span>Minutes, run from the cell.</span>
      </a>
      ${extra}
    </div>`;
}

/** Opened from the grid, over the list you are adding to. */
export function openTypePicker() {
  const sheet = openSheet(`
    <h2>What are you adding?</h2>
    ${typeRows(`<button class="type-card" id="protocols">
      <b>A protocol</b><span>Several rows at once, with an end date.</span>
    </button>`)}
    <button class="btn ghost wide" data-close>Cancel</button>`);
  sheet.el.querySelector('#protocols').addEventListener('click', () => {
    sheet.close();
    openProtocolSheet();
  });
}

/** Curated blocks. Starting one builds its rows and starts its clock. */
function openProtocolSheet() {
  const runs = habits.protocolRuns();
  const span = (d) => (d % 7 === 0 && d > 30 ? `${d / 7} weeks` : `${d} days`);
  const sheet = openSheet(`
    <h2>Protocols</h2>
    <p class="muted small">Four cells in five puts it in the Cabinet.</p>
    <div class="proto-list">${habits.PROTOCOLS.map((p) => {
      const run = runs[p.id];
      const running = run && !run.settled;
      // A live run is described by the rows on the grid, not by the table: the
      // table can change under a run and then the sheet names rows you do not have.
      const names = running
        ? run.rows.map((id) => habits.byId(id)?.name).filter(Boolean)
        : p.rows.map((r) => r.name);
      return `<button class="proto" data-protocol="${p.id}" ${running ? 'disabled' : ''}>
        <span class="proto-text">
          <b>${escapeHtml(p.name)}</b>
          <i>${escapeHtml((names.length ? names : p.rows.map((r) => r.name)).join(' · '))}</i>
        </span>
        <span class="proto-span">${escapeHtml(running ? 'Running' : run?.completed ? 'Kept' : span(p.days))}</span>
      </button>`;
    }).join('')}
      <div class="proto soon">
        <span class="proto-text">
          <b>Community protocols</b>
          <i>Write your own and run someone else's.</i>
        </span>
        <span class="proto-span proto-soon">Being built</span>
      </div>
    </div>
    <button class="btn ghost wide" data-close>Cancel</button>`);
  sheet.el.querySelectorAll('[data-protocol]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!habits.startProtocol(b.dataset.protocol)) return;
      sheet.close();
      toast('Rows on the grid. The clock is running.');
      window.dispatchEvent(new Event('hashchange'));
    }));
}

/* ---------------- the form ---------------- */

export function renderHabitEdit(mount, { id, kind } = {}) {
  const existing = id ? habits.byId(id) : null;
  if (id && !existing) {
    // Deleted habit: say so rather than opening a blank form that creates a second.
    mount.innerHTML = `
      <div class="screen habits">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1>Not found</h1><span class="icon-btn ghost"></span>
        </header>
        <div class="empty-state"><h2>That habit is gone</h2>
          <p class="muted">It was deleted, or the link is older than the app's data.</p>
          <a class="btn linkbtn" href="#/habits">Back to the grid</a></div>
      </div>`;
    return;
  }

  if (!existing && !kind) {
    mount.innerHTML = `
      <div class="screen habits">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1>New habit</h1><span class="icon-btn ghost"></span>
        </header>
        <section class="card">${typeRows()}</section>
      </div>`;
    // Replaces rather than stacks: saving must not unwind to the picker.
    mount.querySelectorAll('.type-card').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        replaceWith(a.getAttribute('href'));
      })
    );
    return;
  }

  // Works on a copy. Nothing is written until Save.
  const h = existing
    ? { ...existing, freq: { ...existing.freq }, remindDays: [...existing.remindDays] }
    : habits.draft(kind);

  const draw = () => {
    mount.innerHTML = `
      <div class="screen habits">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1>${existing ? 'Edit habit' : 'New habit'}</h1>
          <button class="btn small-btn primary" id="save">Save</button>
        </header>

        <section class="card">
          <div class="setting setting-stack">
            <label for="name"><b>Name</b></label>
            <div class="setting-pair">
              <input type="text" id="name" maxlength="60" placeholder="e.g. Exercise" value="${escapeHtml(h.name)}">
              <button class="swatch big" id="colour" style="background:${habits.hexOf(h.colour)}" aria-label="Colour"></button>
            </div>
          </div>
          <div class="setting setting-stack">
            <label for="question"><b>Question</b></label>
            <input type="text" id="question" maxlength="120" placeholder="${QUESTION_HINT[h.kind]}" value="${escapeHtml(h.question)}">
          </div>
        </section>

        ${h.kind === 'timed'
          ? `<section class="card">
              <h2>How long</h2>
              <label class="setting">
                <span><b>Minutes</b></span>
                <input type="number" id="target" inputmode="numeric" step="1" min="1" max="1440" value="${h.target}">
              </label>
            </section>`
          : ''}

        ${h.kind === 'number'
          ? `<section class="card">
              <h2>How much</h2>
              <label class="setting">
                <span><b>Unit</b></span>
                <input type="text" id="unit" maxlength="20" placeholder="litres" value="${escapeHtml(h.unit)}">
              </label>
              <label class="setting">
                <span><b>Target</b></span>
                <input type="number" id="target" inputmode="decimal" step="any" min="0" value="${h.target}">
              </label>
              <label class="setting">
                <span><b>Aim</b></span>
                <select id="targetType">
                  <option value="atleast" ${h.targetType === 'atleast' ? 'selected' : ''}>At least</option>
                  <option value="atmost" ${h.targetType === 'atmost' ? 'selected' : ''}>At most</option>
                </select>
              </label>
            </section>`
          : ''}

        <section class="card">
          <h2>How often</h2>
          <button class="setting setting-open" id="freq">
            <span><b>Frequency</b></span>
            <span class="setting-value">${escapeHtml(habits.freqLabel(h.freq))}</span>
            ${chevron()}
          </button>
          <button class="setting setting-open" id="remind">
            <span><b>Reminder</b></span>
            <span class="setting-value">${h.remindAt ? `${escapeHtml(h.remindAt)} · ${remindDaysLabel(h.remindDays)}` : 'Off'}</span>
            ${chevron()}
          </button>
          <label class="setting">
            <span><b>Group</b></span>
            <select id="group">
              <option value="" ${h.group ? '' : 'selected'}>No group</option>
              ${habits.groups().map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === h.group ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
            </select>
          </label>
        </section>

        <section class="card">
          <div class="setting setting-stack">
            <label for="notes"><b>Notes</b></label>
            <textarea id="notes" class="notes" rows="3" maxlength="500" placeholder="Why this one, or how it is done.">${escapeHtml(h.notes)}</textarea>
          </div>
        </section>

        ${existing
          ? `<section class="card">
              <h2>This habit</h2>
              <button class="setting setting-act" id="duplicate">
                <span><b>Duplicate</b></span><span class="setting-value">Setup only, no days</span>
              </button>
              <button class="setting setting-act" id="archive">
                <span><b>${h.archived ? 'Restore' : 'Archive'}</b></span>
                <span class="setting-value">${h.archived ? 'Back on the grid' : 'Keeps its days'}</span>
              </button>
              <button class="setting setting-act danger" id="delete">
                <span><b>Delete</b></span><span class="setting-value">Loses its days</span>
              </button>
            </section>`
          : ''}
      </div>`;
    wire();
  };

  /** Read the plain fields back before any redraw, or opening a picker loses the name. */
  const collect = () => {
    const val = (sel) => mount.querySelector(sel)?.value ?? '';
    h.name = val('#name').slice(0, 60);
    h.question = val('#question').slice(0, 120);
    h.notes = val('#notes').slice(0, 500);
    h.group = val('#group');
    if (h.kind === 'number') {
      h.unit = val('#unit').slice(0, 20);
      const t = Number(val('#target'));
      h.target = Number.isFinite(t) && t > 0 ? t : 0;
      h.targetType = val('#targetType') === 'atmost' ? 'atmost' : 'atleast';
    }
    if (h.kind === 'timed') {
      const t = Math.round(Number(val('#target')));
      h.target = Number.isFinite(t) && t > 0 ? Math.min(t, 1440) : 20;
    }
  };

  const wire = () => {
    mount.querySelector('#save').addEventListener('click', () => {
      collect();
      if (!h.name.trim()) {
        toast('Give it a name first');
        mount.querySelector('#name').focus();
        return;
      }
      habits.save(h);
      habits.syncAlarms();
      toast(existing ? 'Saved' : 'Habit created');
      navigate('#/habits');
    });

    mount.querySelector('#colour').addEventListener('click', () => {
      collect();
      openColourSheet(h, draw);
    });
    mount.querySelector('#freq').addEventListener('click', () => {
      collect();
      openFreqSheet(h, draw);
    });
    mount.querySelector('#remind').addEventListener('click', () => {
      collect();
      openRemindSheet(h, draw);
    });

    mount.querySelector('#archive')?.addEventListener('click', () => {
      habits.setArchived(h.id, !h.archived);
      habits.syncAlarms();
      toast(h.archived ? 'Restored' : 'Archived');
      navigate('#/habits');
    });
    mount.querySelector('#duplicate')?.addEventListener('click', () => {
      const id = habits.duplicate(h.id);
      if (!id) return;
      toast('Duplicated');
      navigate(`#/habits/edit?id=${encodeURIComponent(id)}`);
    });
    // At once, with the way back on the toast. A modal was the slowest thing here.
    mount.querySelector('#delete')?.addEventListener('click', () => {
      const snap = habits.snapshotOf(h.id);
      habits.remove(h.id);
      navigate('#/habits');
      toast(`${h.name} deleted`, { undo: () => { habits.reinstate(snap); location.hash = '#/habits'; window.dispatchEvent(new Event('hashchange')); } });
    });
  };

  draw();
}

function remindDaysLabel(days) {
  if (!days.length || days.length === 7) return 'every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'weekends';
  return days
    .slice()
    .sort()
    .map((d) => WEEK_NAMES[d].slice(0, 3))
    .join(', ');
}

/* ---------------- the pickers ---------------- */

function openColourSheet(h, done) {
  const sheet = openSheet(`
    <h2>Colour</h2>
    <p class="muted small">The name, the ring and the calendar all take it.</p>
    <div class="swatch-grid">
      ${habits.COLOURS.map((c) => `<button class="swatch ${c.id === h.colour ? 'on' : ''}" data-colour="${c.id}"
        style="background:${c.hex}" aria-label="${c.name}"></button>`).join('')}
    </div>`);
  sheet.el.querySelectorAll('[data-colour]').forEach((b) =>
    b.addEventListener('click', () => {
      h.colour = b.dataset.colour;
      sheet.close();
      done();
    })
  );
}

/** Five ways of saying one fraction. Rows read as they are laid out. */
function openFreqSheet(h, done) {
  const p = habits.freqPreset(h.freq);
  const everyN = p === 'everyN' ? h.freq.den : 3;
  const week = p === 'week' ? h.freq.num : 3;
  const month = p === 'month' ? h.freq.num : 10;
  const cNum = p === 'custom' ? h.freq.num : 3;
  const cDen = p === 'custom' ? h.freq.den : 14;

  const row = (id, label, before, after) => `
    <label class="freq-row">
      <input type="radio" name="freq" value="${id}" ${p === id ? 'checked' : ''}>
      ${before}<span>${label}</span>${after}
    </label>`;
  const spin = (id, value, min, max) =>
    `<input type="number" class="freq-num" id="${id}" value="${value}" min="${min}" max="${max}" inputmode="numeric">`;

  const sheet = openSheet(`
    <h2>Frequency</h2>
    ${row('daily', 'Every day', '', '')}
    ${row('everyN', 'days', `<span>Every</span>${spin('everyN', everyN, 2, 365)}`, '')}
    ${row('week', 'times per week', spin('week', week, 1, 7), '')}
    ${row('month', 'times per month', spin('month', month, 1, 30), '')}
    ${row('custom', 'times in', spin('cNum', cNum, 1, 365), `${spin('cDen', cDen, 1, 365)}<span>days</span>`)}
    <p class="fineprint">Three in seven is not late on the fourth: a day counts as kept whenever the window behind it holds three.</p>
    <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="freqSave">Save</button></div>`);

  const num = (id, dflt) => {
    const v = Number(sheet.el.querySelector(`#${id}`).value);
    return Number.isFinite(v) && v >= 1 ? Math.round(v) : dflt;
  };
  // Touching a number picks its row: hunting for the radio as well is how a
  // dialog gets abandoned.
  sheet.el.querySelectorAll('.freq-num').forEach((input) =>
    input.addEventListener('focus', () => {
      input.closest('.freq-row').querySelector('input[type="radio"]').checked = true;
    })
  );

  sheet.el.querySelector('#freqSave').addEventListener('click', () => {
    const choice = sheet.el.querySelector('input[name="freq"]:checked')?.value || 'daily';
    if (choice === 'daily') h.freq = { num: 1, den: 1 };
    else if (choice === 'everyN') h.freq = { num: 1, den: Math.max(2, num('everyN', 3)) };
    else if (choice === 'week') h.freq = { num: Math.min(7, num('week', 3)), den: 7 };
    else if (choice === 'month') h.freq = { num: Math.min(30, num('month', 10)), den: 30 };
    else {
      const den = num('cDen', 14);
      h.freq = { num: Math.min(den, num('cNum', 3)), den };
    }
    sheet.close();
    done();
  });
}

function openRemindSheet(h, done) {
  const sheet = openSheet(`
    <h2>Reminder</h2>
    <p class="muted small">A real alarm in the Android app. In a browser the grid is the reminder.</p>
    <label class="setting">
      <span><b>At</b></span>
      <input type="time" id="at" value="${escapeHtml(h.remindAt)}">
    </label>
    <div class="day-chips setting-days">
      ${WEEK_INITIALS.map((d, i) => `<button class="day-chip ${h.remindDays.includes(i) ? 'on' : ''}" data-day="${i}"
        aria-label="${WEEK_NAMES[i]}" aria-pressed="${h.remindDays.includes(i)}">${d}</button>`).join('')}
    </div>
    <div class="btn-row"><button class="btn ghost" id="off">Turn off</button><button class="btn primary" id="remSave">Save</button></div>`);

  const picked = new Set(h.remindDays);
  sheet.el.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.day);
      if (picked.has(d)) picked.delete(d);
      else picked.add(d);
      b.classList.toggle('on', picked.has(d));
      b.setAttribute('aria-pressed', String(picked.has(d)));
    })
  );
  sheet.el.querySelector('#off').addEventListener('click', () => {
    h.remindAt = '';
    sheet.close();
    done();
  });
  sheet.el.querySelector('#remSave').addEventListener('click', async () => {
    const at = sheet.el.querySelector('#at').value;
    // No days chosen means every day. A reminder that never fires looks like a bug.
    h.remindDays = picked.size ? [...picked].sort() : [0, 1, 2, 3, 4, 5, 6];
    h.remindAt = /^\d{2}:\d{2}$/.test(at) ? at : '';
    // Ask here, where a reminder is being switched on. Refused, the time still
    // saves: the switch is honest about being off rather than silently dead.
    const allowed = h.remindAt && hasAlarms() ? await askAlarms() : true;
    sheet.close();
    done();
    if (!allowed) toast('Notifications are off for this app. Turn them on in Android settings.');
  });
}
