// The Bible section, which is also where the prayer rule lives.
//
// One room for the whole of it: what you are reading, and the two rules that
// bracket the day. They belong together because they are the same practice,
// and splitting them across two tiles meant the hub asked you to choose
// between them every morning.
//
// Reading comes first on the screen because it is the thing with no fixed
// time. The rules sit under it with their own times and their own streak.

import * as store from '../store.js';
import * as bible from './program.js';
import * as text from './text.js';
import * as pray from '../pray/program.js';
import { RULES } from '../pray/prayers.js';
import { escapeHtml, ringSvg, haptic, toast } from '../ui.js';
import { icon } from '../icons.js';

const GOARCH = 'https://www.goarch.org/chapel';

export async function renderBibleHome(mount) {
  const st = store.get().bible;
  const prog = bible.overallProgress();
  const streak = bible.streak();
  const pos = bible.position();
  const posBook = bible.bookById(pos.book);
  const today = pray.dayState();
  const prayStreak = pray.streak();
  const live = pray.currentSlot();
  const installed = await text.isInstalled();

  const ruleCard = (slot) => {
    const def = RULES[slot];
    const kept = today[slot];
    const at = slot === 'morning' ? store.get().pray.settings.morningAt : store.get().pray.settings.eveningAt;
    return `<a class="rule-card ${kept ? 'kept' : ''} ${live === slot ? 'live' : ''}" href="#/bible/pray?slot=${slot}">
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
          <h2>${installed
            ? escapeHtml(bible.refName(`${pos.book}:${pos.ch}`))
            : 'Import your Bible'}</h2>
          <p class="muted small">${installed
            ? `${prog.read} of ${bible.TOTAL_CHAPTERS} chapters${streak ? ` · ${streak}d streak` : ''}`
            : 'The reader is here. The text is yours to bring.'}</p>
        </div>
        ${ringSvg(prog.frac, `${Math.round(prog.frac * 100)}%`, 'read', { size: 92, color: 'var(--accent)' })}
      </div>

      ${installed
        ? `<a class="btn primary big linkbtn" href="#/bible/reader?book=${pos.book}&ch=${pos.ch}">
            ${icon('book', 18)}<span>${prog.read ? 'Carry on reading' : 'Start at Genesis 1'}</span>
          </a>`
        : `<a class="btn primary big linkbtn" href="#/bible/import">
            ${icon('plus', 18)}<span>Import your Bible</span>
          </a>`}

      <section class="card">
        <div class="h-row">${icon('sun', 16)}<h2>The rule</h2>
          <span class="pill ${today.complete ? 'done' : 'ghost'}">${today.kept}/2 today</span></div>
        <div class="rule-list">
          ${ruleCard('morning')}
          ${ruleCard('evening')}
        </div>
        <p class="muted small">${prayStreak ? `${prayStreak} day streak` : 'Both are required. A day counts when both are kept.'}</p>
      </section>

      <a class="btn ghost linkbtn ext" href="${GOARCH}" target="_blank" rel="noopener noreferrer">
        ${icon('book', 16)}<span>Readings and calendar at goarch.org</span>${icon('external', 14)}
      </a>

      <div class="linkrow">
        <a href="#/bible/books">${icon('book')} The books</a>
        <a href="#/bible/prayers">${icon('book')} My prayers</a>
        <a href="#/bible/track">${icon('chart')} Tracking</a>
        <a href="#/bible/settings">${icon('settings')} Settings</a>
      </div>
    </div>`;
}

/* ---------------- import ---------------- */

export async function renderImport(mount) {
  const st = await text.status();

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>Your Bible</h1>
        <span class="icon-btn ghost"></span>
      </header>

      ${st ? `<section class="card">
        <div class="h-row">${icon('check', 16)}<h2>Imported</h2></div>
        <div class="stat-grid">
          <div class="stat"><b>${st.stats.books}</b><span>books</span></div>
          <div class="stat"><b>${st.stats.chapters}</b><span>chapters</span></div>
          <div class="stat"><b>${st.stats.verses.toLocaleString()}</b><span>verses</span></div>
          <div class="stat"><b>${st.stats.missing}</b><span>not recovered</span></div>
        </div>
        <p class="muted small">Imported ${new Date(st.at).toLocaleDateString()}. Stored on this phone only.</p>
      </section>` : ''}

      <section class="card">
        <div class="h-row">${icon('book', 16)}<h2>${st ? 'Import again' : 'Import'}</h2></div>
        <p class="muted small">
          NiFo ships the reader, not the scripture. Choose the plain-text export
          of the Orthodox Study Bible you own. It is parsed here on the phone,
          takes a few seconds, and is stored on the device. Nothing is uploaded.
        </p>
        <input type="file" id="file" accept=".txt,text/plain" hidden>
        <button class="btn primary wide" id="pick">${st ? 'Choose a different file' : 'Choose file'}</button>
        <div id="progress"></div>
      </section>

      <section class="card">
        <div class="h-row">${icon('warn', 16)}<h2>What to expect</h2></div>
        <p class="muted small">
          The export is a PDF conversion and it is not perfect. Roughly one
          chapter in five has a rough opening, and about 270 verses out of
          35,900 do not survive at all. Those are marked in the text rather than
          skipped quietly, so you always know to reach for the book itself.
        </p>
      </section>

      ${st ? `<div class="btn-row">
        <button class="btn ghost danger" id="wipe">Remove the imported text</button>
      </div>` : ''}
    </div>`;

  const file = mount.querySelector('#file');
  mount.querySelector('#pick').addEventListener('click', () => file.click());
  file.addEventListener('change', () => runImport(mount, file.files?.[0]));
  mount.querySelector('#wipe')?.addEventListener('click', async () => {
    if (!confirm('Remove the imported Bible? What you have read is kept.')) return;
    await text.remove();
    renderImport(mount);
  });
}

async function runImport(mount, f) {
  if (!f) return;
  const out = mount.querySelector('#progress');
  const say = (msg) => { out.innerHTML = `<p class="muted small">${escapeHtml(msg)}</p>`; };

  say('Reading the file…');
  let raw;
  try {
    raw = await f.text();
  } catch {
    say('That file could not be read.');
    return;
  }

  const { parseBible, looksLikeOsb } = await import('./parse.js');
  if (!looksLikeOsb(raw)) {
    say('That does not look like the Orthodox Study Bible text export.');
    return;
  }

  say('Parsing. This takes a few seconds…');
  // One frame, so the message paints before the parser blocks the thread.
  await new Promise((r) => setTimeout(r, 50));

  let result;
  try {
    result = parseBible(raw);
  } catch (err) {
    say(`The parser could not make sense of that file. ${err.message}`);
    return;
  }
  if (!result.stats.verses) {
    say('No verses were found in that file.');
    return;
  }

  say('Saving to this phone…');
  try {
    await text.persist();
    await text.install(result.books, result.stats);
  } catch (err) {
    say(`Could not save it: ${err.message}`);
    return;
  }

  haptic('level');
  toast(`${result.stats.verses.toLocaleString()} verses imported.`);
  renderImport(mount);
}

/* ---------------- settings ---------------- */

export function renderBibleSettings(mount) {
  const s = store.get().bible.settings;
  const p = store.get().pray.settings;

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
        <div class="h-row">${icon('sun', 16)}<h2>The rule</h2></div>
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

      <div class="linkrow">
        <a href="#/bible/import">${icon('plus')} Your Bible</a>
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
