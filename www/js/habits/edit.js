// Creating and editing a habit. Every field can be changed afterwards,
// frequency and target included: scores recompute from the entries.
// Yes/no against measurable is the exception, there is no honest conversion.

import * as habits from './program.js';
import { escapeHtml, toast, openSheet } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, replaceWith } from '../back.js';

const WEEK_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ------------------ the type picker ------------------ */

export function typePickerHtml() {
  return `
    <h2>What kind of habit?</h2>
    <div class="type-cards">
      <a class="type-card" href="#/habits/edit?kind=yesno">
        <b>Yes or No</b>
        <span>Did you wake up early today? Did you read? Did you defeat it?</span>
      </a>
      <a class="type-card" href="#/habits/edit?kind=number">
        <b>Measurable</b>
        <span>How many litres of water? How many pages? How many calories?</span>
      </a>
    </div>`;
}

/** Opened from the grid, over the list you are adding to. */
export function openTypePicker() {
  openSheet(`${typePickerHtml()}<button class="btn ghost wide" data-close>Cancel</button>`);
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
        <section class="card">${typePickerHtml()}</section>
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
  const h = existing ? { ...existing, freq: { ...existing.freq }, remindDays: [...existing.remindDays] } : habits.draft(kind);

  const draw = () => {
    mount.innerHTML = `
      <div class="screen habits">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1>${existing ? 'Edit habit' : 'New habit'}</h1>
          <button class="btn small-btn primary" id="save">Save</button>
        </header>

        <section class="card">
          <div class="field">
            <label for="name"><b>Name</b></label>
            <div class="measure-row">
              <input type="text" id="name" maxlength="60" placeholder="e.g. Exercise" value="${escapeHtml(h.name)}">
              <button class="swatch big" id="colour" style="background:${habits.hexOf(h.colour)}" aria-label="Colour"></button>
            </div>
          </div>
          <div class="field">
            <label for="question"><b>Question</b></label>
            <input type="text" id="question" maxlength="120" placeholder="e.g. Did you exercise today?" value="${escapeHtml(h.question)}">
          </div>
        </section>

        ${h.kind === 'number'
          ? `<section class="card">
              <div class="h-row">${icon('chart', 16)}<h2>The measurement</h2></div>
              <div class="field">
                <label for="unit"><b>Unit</b> <em>What you are counting</em></label>
                <input type="text" id="unit" maxlength="20" placeholder="e.g. Liters, pages, kcal" value="${escapeHtml(h.unit)}">
              </div>
              <label class="setting">
                <span><b>Target</b><i>A day counts when it reaches this.</i></span>
                <input type="number" id="target" inputmode="decimal" step="any" min="0" value="${h.target}">
              </label>
              <label class="setting">
                <span><b>The target is a</b></span>
                <select id="targetType">
                  <option value="atleast" ${h.targetType === 'atleast' ? 'selected' : ''}>Floor, at least</option>
                  <option value="atmost" ${h.targetType === 'atmost' ? 'selected' : ''}>Ceiling, at most</option>
                </select>
              </label>
            </section>`
          : ''}

        <section class="card">
          <div class="h-row">${icon('calendar', 16)}<h2>How often</h2></div>
          <button class="rowbtn" id="freq">
            <span><b>Frequency</b><i>${escapeHtml(habits.freqLabel(h.freq))}</i></span>
            ${icon('pencil', 16)}
          </button>
          <button class="rowbtn" id="remind">
            <span><b>Reminder</b><i>${h.remindAt ? `${escapeHtml(h.remindAt)} · ${remindDaysLabel(h.remindDays)}` : 'Off'}</i></span>
            ${icon('bell', 16)}
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
          <div class="h-row">${icon('book', 16)}<h2>Notes</h2></div>
          <textarea id="notes" class="notes" rows="3" maxlength="500" placeholder="(Optional) Why this one, or how it is meant to be done.">${escapeHtml(h.notes)}</textarea>
        </section>

        ${existing
          ? `<section class="card danger">
              <div class="h-row">${icon('warn', 16)}<h2>This habit</h2></div>
              <p class="small muted">Archiving takes it out of the grid and keeps every day you ever marked. Deleting takes the record with it.</p>
              <div class="btn-row">
                <button class="btn" id="archive">${h.archived ? 'Restore' : 'Archive'}</button>
                <button class="btn danger" id="delete">Delete</button>
              </div>
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
    mount.querySelector('#delete')?.addEventListener('click', () => {
      if (!confirm(`Delete "${h.name}" and every day ever recorded on it? There is no undo.`)) return;
      habits.remove(h.id);
      habits.syncAlarms();
      toast('Deleted');
      navigate('#/habits');
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
    <p class="muted small">The habit's name, its ring and its calendar all take this. It is how you find a row without reading it.</p>
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
    <p class="fineprint">A habit that asks for three days in seven is not late on the fourth: a day counts as kept whenever the week behind it holds three.</p>
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
    <p class="muted small">A real alarm on the APK, which fires whether or not the app is running. In a browser it does nothing, so the grid is the reminder.</p>
    <label class="setting">
      <span><b>At</b></span>
      <input type="time" id="at" value="${escapeHtml(h.remindAt)}">
    </label>
    <div class="day-chips">
      ${WEEK_INITIALS.map((d, i) => `<button class="day-chip ${h.remindDays.includes(i) ? 'on' : ''}" data-day="${i}"
        aria-label="${WEEK_NAMES[i]}" aria-pressed="${h.remindDays.includes(i)}">${d}</button>`).join('')}
    </div>
    <div class="btn-row"><button class="btn" id="off">Turn off</button><button class="btn primary" id="remSave">Save</button></div>`);

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
  sheet.el.querySelector('#remSave').addEventListener('click', () => {
    const at = sheet.el.querySelector('#at').value;
    // No days chosen means every day. A reminder that never fires looks like a bug.
    h.remindDays = picked.size ? [...picked].sort() : [0, 1, 2, 3, 4, 5, 6];
    h.remindAt = /^\d{2}:\d{2}$/.test(at) ? at : '';
    sheet.close();
    done();
  });
}
