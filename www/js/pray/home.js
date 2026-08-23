// Prayer home. Two slots, both required, and whichever one is live is the
// button under your thumb.

import * as store from '../store.js';
import * as pray from './program.js';
import { RULES } from './prayers.js';
import { escapeHtml, haptic, toast } from '../ui.js';
import { icon } from '../icons.js';

const GOARCH = 'https://www.goarch.org/chapel';

export function renderPrayHome(mount) {
  const s = store.get().pray;
  const today = pray.dayState();
  const live = pray.currentSlot();
  const streak = pray.streak();
  const t = pray.totals(30);

  const card = (slot) => {
    const def = RULES[slot];
    const kept = today[slot];
    const isLive = live === slot;
    const at = slot === 'morning' ? s.settings.morningAt : s.settings.eveningAt;
    return `<a class="rule-card ${kept ? 'kept' : ''} ${isLive ? 'live' : ''}" href="#/pray/run?slot=${slot}">
      <span class="rc-ico">${kept ? icon('check', 20) : icon(slot === 'morning' ? 'sun' : 'moon', 20)}</span>
      <span class="rc-text">
        <b>${escapeHtml(def.label)}</b>
        <i>${kept ? `Kept ${new Date(kept).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : `${escapeHtml(at)} · ${pray.minutes(slot)} min`}</i>
      </span>
      ${kept ? '' : '<span class="rc-go">' + icon('play', 16) + '</span>'}
    </a>`;
  };

  mount.innerHTML = `
    <div class="screen pray">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Prayer</h1>
        <button class="icon-btn" data-nav="pray-stats" aria-label="Tracking">${icon('chart')}</button>
      </header>

      <div class="today pray-today">
        <div class="today-left">
          <h2>${today.complete ? 'Both kept' : `${today.kept} of 2 kept`}</h2>
          <p class="muted small">${streak ? `${streak} day streak` : 'No streak yet'}${s.best > streak ? ` · best ${s.best}` : ''}</p>
        </div>
        <div class="slot-dots">
          <i class="${today.morning ? 'on' : ''}" title="Morning"></i>
          <i class="${today.evening ? 'on' : ''}" title="Night"></i>
        </div>
      </div>

      <div class="rule-list">
        ${card('morning')}
        ${card('evening')}
      </div>

      ${live ? `<a class="btn primary big linkbtn" href="#/pray/run?slot=${live}">${icon('play', 18)}<span>${escapeHtml(RULES[live].label)}</span></a>` : ''}

      <section class="card">
        <div class="h-row">${icon('chart', 16)}<h2>Last 30 days</h2></div>
        <div class="stat-grid three">
          <div class="stat"><b>${t.full}</b><span>full days</span></div>
          <div class="stat"><b>${t.morning}</b><span>mornings</span></div>
          <div class="stat"><b>${t.evening}</b><span>nights</span></div>
        </div>
      </section>

      <a class="btn ghost linkbtn ext" href="${GOARCH}" target="_blank" rel="noopener noreferrer">
        ${icon('book', 16)}<span>Readings and calendar at goarch.org</span>${icon('external', 14)}
      </a>

      <div class="linkrow">
        <a href="#/pray/stats">${icon('chart')} Tracking</a>
        <a href="#/pray/prayers">${icon('book')} My prayers</a>
        <a href="#/pray/settings">${icon('settings')} Settings</a>
      </div>
    </div>`;
}

/* ---------------- tracking ---------------- */

export function renderPrayStats(mount) {
  const hist = pray.history(13);
  const t30 = pray.totals(30);
  const t7 = pray.totals(7);
  const s = store.get().pray;

  // Column-per-week grid, same shape as the Kegels heatmap.
  const cols = [];
  for (let i = 0; i < hist.length; i += 7) cols.push(hist.slice(i, i + 7));

  mount.innerHTML = `
    <div class="screen pray">
      <header class="screen-head">
        <button class="icon-btn" data-back="pray" aria-label="Back">${icon('back')}</button>
        <h1>Tracking</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="stat-grid">
        <div class="stat"><b>${pray.streak()}</b><span>day streak</span></div>
        <div class="stat"><b>${s.best}</b><span>best streak</span></div>
        <div class="stat"><b>${pray.lifetime()}</b><span>rules kept</span></div>
        <div class="stat"><b>${Math.round(t30.rate * 100)}%</b><span>full days, 30d</span></div>
      </div>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Last 13 weeks</h2></div>
        <div class="heatmap">
          ${cols.map((c) => `<div class="hm-col">${c.map((d) => `<i class="pr-${d.cls}" title="${d.key}"></i>`).join('')}</div>`).join('')}
        </div>
        <div class="hm-key">
          <i class="pr-none"></i> none
          <i class="pr-half"></i> one
          <i class="pr-full"></i> both
        </div>
      </section>

      <section class="card">
        <div class="h-row">${icon('target', 16)}<h2>By slot</h2></div>
        <div class="kv"><span>Mornings, last 7</span><b>${t7.morning}/7</b></div>
        <div class="kv"><span>Nights, last 7</span><b>${t7.evening}/7</b></div>
        <div class="kv"><span>Morning streak</span><b>${pray.slotStreak('morning')}</b></div>
        <div class="kv"><span>Night streak</span><b>${pray.slotStreak('evening')}</b></div>
      </section>
    </div>`;
}

/* ---------------- my prayers ---------------- */

export function renderMyPrayers(mount) {
  const draw = () => {
    const mine = pray.myPrayers();
    mount.innerHTML = `
      <div class="screen pray">
        <header class="screen-head">
          <button class="icon-btn" data-back="pray" aria-label="Back">${icon('back')}</button>
          <h1>My prayers</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <p class="small muted">The app ships the ancient core only. Add what you say from your own prayer book and it joins the rule in the slot you choose.</p>

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

export function renderPraySettings(mount) {
  const s = store.get().pray.settings;
  mount.innerHTML = `
    <div class="screen pray">
      <header class="screen-head">
        <button class="icon-btn" data-back="pray" aria-label="Back">${icon('back')}</button>
        <h1>Settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <label class="setting">
          <span><b>Language</b><i>What appears while you pray.</i></span>
          <select id="lang">
            <option value="both" ${s.lang === 'both' ? 'selected' : ''}>Greek and English</option>
            <option value="el" ${s.lang === 'el' ? 'selected' : ''}>Greek</option>
            <option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option>
          </select>
        </label>
        <label class="setting toggle">
          <span><b>Large text</b><i>For praying without glasses.</i></span>
          <input type="checkbox" id="largeText" ${s.largeText ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <h2>Times</h2>
        <label class="setting">
          <span><b>Morning</b></span>
          <input type="time" id="morningAt" value="${escapeHtml(s.morningAt)}">
        </label>
        <label class="setting">
          <span><b>Night</b></span>
          <input type="time" id="eveningAt" value="${escapeHtml(s.eveningAt)}">
        </label>
        <label class="setting toggle">
          <span><b>Remind me</b><i>An alarm at each time.</i></span>
          <input type="checkbox" id="remind" ${s.remind ? 'checked' : ''}>
        </label>
      </section>
    </div>`;

  const bind = (id, get = (e) => e.value) =>
    mount.querySelector('#' + id).addEventListener('change', (e) => {
      store.update((st) => {
        st.pray.settings[id] = get(e.target);
      });
      pray.syncAlarms();
      toast('Saved');
    });
  bind('lang');
  bind('largeText', (e) => e.checked);
  bind('morningAt');
  bind('eveningAt');
  bind('remind', (e) => e.checked);
}
