// The Bible section, and the prayer rule, which is the same practice.
// Reading first: it has no fixed time. The two rules sit under it.

import * as store from '../store.js';
import * as bible from './program.js';
import * as pray from '../pray/program.js';
import * as text from './text.js';
import { RULES } from '../pray/prayers.js';
import { escapeHtml, ringSvg } from '../ui.js';
import { icon } from '../icons.js';

const GOARCH = 'https://www.goarch.org/chapel';

export function renderBibleHome(mount) {
  const st = store.get().bible;
  const prog = bible.overallProgress();
  const streak = bible.streak();
  const pos = bible.position();
  const today = pray.dayState();
  const prayStreak = pray.streak();
  const live = pray.currentSlot();

  const prayerCard = (slot) => {
    const def = RULES[slot];
    const kept = today[slot];
    const at = slot === 'morning' ? store.get().pray.settings.morningAt : store.get().pray.settings.eveningAt;
    return `<a class="prayer-card ${kept ? 'kept' : ''} ${live === slot ? 'live' : ''}" href="#/bible/pray?slot=${slot}">
      <span class="rc-ico">${kept ? icon('check', 20) : icon(slot === 'morning' ? 'sun' : 'moon', 20)}</span>
      <span class="rc-text">
        <b>${escapeHtml(def.label)}</b>
        <i>${kept
          ? `Kept ${new Date(kept).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
          : `${escapeHtml(at)} · ${pray.minutes(slot)} min`}</i>
      </span>
      ${kept ? '' : `<span class="rc-go">${icon('play', 16)}</span>`}
    </a>`;
  };

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Bible</h1>
        <button class="icon-btn" data-nav="bible-track" aria-label="Tracking">${icon('chart')}</button>
      </header>

      <div class="today bible-today">
        <div class="today-left">
          <h2>${escapeHtml(bible.refName(`${pos.book}:${pos.ch}`))}</h2>
          <p class="muted small">${prog.read} of ${bible.TOTAL_CHAPTERS} chapters${streak ? ` · ${streak}d reading streak` : ''}</p>
        </div>
        ${ringSvg(prog.frac, `${Math.round(prog.frac * 100)}%`, 'read', { size: 92, color: 'var(--accent)' })}
      </div>

      <a class="btn primary big linkbtn" href="#/bible/reader?book=${pos.book}&ch=${pos.ch}">
        ${icon('book', 18)}<span>${prog.read ? 'Carry on reading' : 'Start at Genesis 1'}</span>
      </a>

      <section class="card">
        <div class="h-row">${icon('sun', 16)}<h2>Prayer</h2>
          <span class="pill ${today.complete ? 'done' : 'ghost'}">${today.kept}/2 today</span></div>
        <div class="prayer-list">
          ${prayerCard('morning')}
          ${prayerCard('evening')}
        </div>
        <p class="muted small">${prayStreak ? `${prayStreak} day prayer streak` : 'Both are required. A day counts when both are kept.'}</p>
      </section>

      <a class="btn ghost linkbtn ext" href="${GOARCH}" target="_blank" rel="noopener noreferrer">
        ${icon('book', 16)}<span>Today's readings at goarch.org</span>${icon('external', 14)}
      </a>

      <div class="linkrow">
        <a href="#/bible/books">${icon('book')} The books</a>
        <a href="#/bible/prayers">${icon('book')} My prayers</a>
        <a href="#/bible/track">${icon('chart')} Tracking</a>
        <a href="#/bible/settings">${icon('settings')} Settings</a>
      </div>
    </div>`;
}

export async function renderBibleSettings(mount) {
  const s = store.get().bible.settings;
  const p = store.get().pray.settings;
  const m = await text.meta();

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>Bible settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('book', 16)}<h2>Reading</h2></div>
        <label class="setting toggle">
          <span><b>Larger text</b><i>For the reader and the book screens.</i></span>
          <input type="checkbox" id="largeText" ${s.largeText ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Remind me to read</b><i>A real alarm on the APK.</i></span>
          <input type="checkbox" id="remind" ${s.remind ? 'checked' : ''}>
        </label>
        <label class="setting">
          <span><b>At</b></span>
          <input type="time" id="remindAt" value="${escapeHtml(s.remindAt)}">
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('sun', 16)}<h2>Prayer</h2></div>
        <label class="setting">
          <span><b>Morning</b></span>
          <input type="time" id="morningAt" value="${escapeHtml(p.morningAt)}">
        </label>
        <label class="setting">
          <span><b>Night</b></span>
          <input type="time" id="eveningAt" value="${escapeHtml(p.eveningAt)}">
        </label>
        <label class="setting toggle">
          <span><b>Remind me to pray</b><i>Both times, as real alarms on the APK.</i></span>
          <input type="checkbox" id="prayRemind" ${p.remind ? 'checked' : ''}>
        </label>
        <label class="setting">
          <span><b>Language</b></span>
          <select id="lang">
            <option value="both" ${p.lang === 'both' ? 'selected' : ''}>Greek and English</option>
            <option value="el" ${p.lang === 'el' ? 'selected' : ''}>Greek</option>
            <option value="en" ${p.lang === 'en' ? 'selected' : ''}>English</option>
          </select>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('help', 16)}<h2>About the text</h2></div>
        <p class="muted small">
          The Orthodox Study Bible: the St. Athanasius Academy Septuagint for the
          Old Testament, the New King James Version for the New. Parsed from a
          copy of the book once, kept with the app.
        </p>
        ${m ? `<div class="stat-grid">
          <div class="stat"><b>${m.books}</b><span>books</span></div>
          <div class="stat"><b>${m.chapters}</b><span>chapters</span></div>
          <div class="stat"><b>${m.verses.toLocaleString()}</b><span>verses</span></div>
          <div class="stat"><b>${m.missing}</b><span>not recovered</span></div>
        </div>` : ''}
      </section>

      <div class="linkrow">
        <a href="#/bible/prayers">${icon('book')} My prayers</a>
      </div>
    </div>`;

  const bset = (k, v) => store.update((st) => { st.bible.settings[k] = v; });
  const pset = (k, v) => store.update((st) => { st.pray.settings[k] = v; });

  mount.querySelector('#largeText').addEventListener('change', (e) => bset('largeText', e.target.checked));
  mount.querySelector('#remind').addEventListener('change', (e) => { bset('remind', e.target.checked); bible.syncAlarm(); });
  mount.querySelector('#remindAt').addEventListener('change', (e) => { bset('remindAt', e.target.value); bible.syncAlarm(); });
  mount.querySelector('#morningAt').addEventListener('change', (e) => { pset('morningAt', e.target.value); pray.syncAlarms(); });
  mount.querySelector('#eveningAt').addEventListener('change', (e) => { pset('eveningAt', e.target.value); pray.syncAlarms(); });
  mount.querySelector('#prayRemind').addEventListener('change', (e) => { pset('remind', e.target.checked); pray.syncAlarms(); });
  mount.querySelector('#lang').addEventListener('change', (e) => pset('lang', e.target.value));
}
