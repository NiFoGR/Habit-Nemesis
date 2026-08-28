// The prayers you added yourself.
//
// The rest of the prayer section now lives in bible/, because prayer and the
// reading are one practice and were being split across two tiles. This screen
// stayed here with the prayer texts it edits.

import * as store from '../store.js';
import * as pray from './program.js';
import { escapeHtml, toast } from '../ui.js';
import { icon } from '../icons.js';

export function renderMyPrayers(mount) {
  const draw = () => {
    const mine = pray.myPrayers();
    mount.innerHTML = `
      <div class="screen pray">
        <header class="screen-head">
          <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
          <h1>My prayers</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <p class="small muted">The app ships the ancient core only. Add what you say from your own prayer book and it joins your morning or your night in the slot you choose.</p>

        ${['morning', 'evening'].map((slot) => {
          const list = mine.filter((p) => p.slot === slot);
          return `<section class="card">
            <div class="h-row">${icon(slot === 'morning' ? 'sun' : 'moon', 16)}<h2>${slot === 'morning' ? 'Morning' : 'Night'}</h2></div>
            ${list.length ? list.map((p) => `<div class="kv own-row">
              <span>${escapeHtml(p.title || 'Untitled')}</span>
              <b><button class="mini" data-edit="${p.id}">Edit</button><button class="mini danger" data-del="${p.id}">Remove</button></b>
            </div>`).join('') : '<p class="muted small">Nothing added.</p>'}
            <button class="btn ghost" data-add="${slot}">Add a prayer</button>
          </section>`;
        }).join('')}
      </div>`;

    mount.querySelectorAll('[data-add]').forEach((b) =>
      b.addEventListener('click', () => editor(b.dataset.add, null)));
    mount.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = pray.myPrayers().find((x) => x.id === b.dataset.edit);
        if (p) editor(p.slot, p);
      }));
    mount.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('Remove this prayer?')) return;
        pray.removePrayer(b.dataset.del);
        draw();
      }));
  };

  const editor = (slot, existing) => {
    mount.innerHTML = `
      <div class="screen pray">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <h1>${existing ? 'Edit' : 'Add'}</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <div class="field">
          <label>Title</label>
          <input type="text" id="title" class="text-input" maxlength="80" value="${escapeHtml(existing?.title || '')}" placeholder="Prayer of St Basil">
        </div>
        <div class="field">
          <label>Slot</label>
          <select id="slot" class="text-input">
            <option value="morning" ${slot === 'morning' ? 'selected' : ''}>Morning</option>
            <option value="evening" ${slot === 'evening' ? 'selected' : ''}>Night</option>
          </select>
        </div>
        <div class="field">
          <label>Greek</label>
          <textarea id="el" class="notes" rows="6" placeholder="One line per line.">${escapeHtml(existing?.el || '')}</textarea>
        </div>
        <div class="field">
          <label>English</label>
          <textarea id="en" class="notes" rows="6" placeholder="One line per line.">${escapeHtml(existing?.en || '')}</textarea>
        </div>

        <button class="btn primary big" id="save">Save</button>
      </div>`;

    mount.querySelector('#back').addEventListener('click', draw);
    mount.querySelector('#save').addEventListener('click', () => {
      const data = {
        slot: mount.querySelector('#slot').value,
        title: mount.querySelector('#title').value.trim(),
        el: mount.querySelector('#el').value.trim(),
        en: mount.querySelector('#en').value.trim(),
      };
      if (!data.el && !data.en) return toast('Add the text in at least one language');
      if (existing) pray.updatePrayer(existing.id, data);
      else pray.addPrayer(data);
      haptic('done');
      draw();
    });
  };

  draw();
}

/* ---------------- settings ---------------- */
