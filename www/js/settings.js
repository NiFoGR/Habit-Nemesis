// App-wide settings. Six rows and a card on the root, one page per row.
// A setting lives with the thing it affects: the grid's rows write
// habits.settings, everything else writes store.settings.

import * as store from './store.js';
import { escapeHtml, toast, openSheet, saveFile, haptic, relDay, relTime, WEEKDAYS, WEEKDAYS_LONG } from './ui.js';
import * as habits from './habits/program.js';
import { icon } from './icons.js';
import * as lock from './lock.js';
import * as account from './account/session.js';
import { configured } from './account/config.js';
import { isNative, alarmPermission, askAlarms } from './native.js';
import * as ads from './ads/program.js';
import { VERSION } from './version.js';

/* ---------------- the pieces ---------------- */

const row = (label, control, note) => `<div class="set-row">
  <span class="set-label">${label}${note ? `<i>${note}</i>` : ''}</span>
  ${control}
</div>`;
/** A row that goes somewhere. The chevron is the promise that it does. */
const link = (label, attrs, value = '') => `<a class="set-link" ${attrs}>
  <span>${label}</span>${value ? `<i>${escapeHtml(value)}</i>` : ''}${icon('back', 16)}
</a>`;
/** A row that does something here. No chevron, because nothing opens. */
const act = (label, attrs, note = '', cls = '') => `<button type="button" class="set-link ${cls}" ${attrs}>
  <span>${label}${note ? `<i>${note}</i>` : ''}</span>
</button>`;
const select = (id, options, value) =>
  `<select id="${id}">${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
const toggle = (id, on, extra = '') => `<input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${extra}>`;
const time = (id, value) => `<input type="time" id="${id}" value="${escapeHtml(value)}">`;
const rows = (list) => `<div class="set-rows">${list.filter(Boolean).join('')}</div>`;
const state = (id, text) => `<span class="set-state" id="${id}">${escapeHtml(text)}</span>`;

const q = (mount, id) => mount.querySelector('#' + id);

/** Writes an app setting on change. `get` reads the control. */
function bind(mount, id, key, get = (e) => e.value) {
  q(mount, id)?.addEventListener('change', (e) => {
    store.setSetting(key, get(e.target));
    applyAppearance();
  });
}

/** Writes a grid setting on change. */
function bindGrid(mount, id, get = (e) => e.value) {
  q(mount, id)?.addEventListener('change', (e) => {
    const value = get(e.target);
    store.update((st) => {
      st.habits.settings[id] = value;
    });
  });
}

/** Theme and motion are classes on <html>, applied at boot and on change. */
export function applyAppearance() {
  const s = store.get().settings;
  const root = document.documentElement;
  root.classList.toggle('black', s.theme === 'black');
  root.classList.toggle('reduce-motion', !!s.reduceMotion);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/* ---------------- the pages ---------------- */

const PAGES = [
  {
    id: 'grid',
    title: 'Grid',
    render(el) {
      const hs = habits.settings();
      el.innerHTML = `
        ${rows([
          row('Week starts', select('firstDay', WEEKDAYS_LONG.map((d, i) => [i, d]), hs.firstDay)),
          row('Day starts at', select('dayStartHour', [0, 1, 2, 3, 4, 5, 6].map((h) => [h, h === 0 ? 'Midnight' : `${String(h).padStart(2, '0')}:00`]), hs.dayStartHour),
            'A late night counts as the day before.'),
          row('Days on screen', select('columns', [3, 4, 5, 6, 7].map((n) => [n, n]), hs.columns)),
          row('Oldest first', toggle('reverseDays', hs.reverseDays)),
        ])}
        <details class="set-more">
          <summary>Advanced</summary>
          ${rows([
            row('Toggle with a short press', toggle('shortPress', hs.shortPress)),
            row('Skip days', toggle('skipDays', hs.skipDays), 'A skip holds the score and the streak where they are.'),
            row('Question marks', toggle('unknownMarks', hs.unknownMarks), 'Tells a day you never answered from one you answered no.'),
          ])}
        </details>`;
      ['firstDay', 'dayStartHour', 'columns'].forEach((id) => bindGrid(el, id, (e) => Number(e.value)));
      ['reverseDays', 'shortPress', 'skipDays', 'unknownMarks'].forEach((id) => bindGrid(el, id, (e) => e.checked));
    },
  },
  {
    id: 'alerts',
    title: 'Alerts',
    render(el) {
      const s = store.get().settings;
      el.innerHTML = `
        ${rows([
          isNative()
            ? row('Notifications', state('notifState', 'checking'), 'Every habit reminder and every Arena alarm needs this.')
            : row('Notifications', state('notifState', 'Android app only')),
          isNative() ? act('Allow notifications', 'id="askNotif" hidden') : '',
          row('Full time', toggle('fullTime', s.fullTime), 'A notification when the day closes, with the score.'),
          row('Sound', select('sound', [['off', 'Off'], ['subtle', 'Subtle'], ['full', 'Full']], s.sound), 'Subtle mutes the ceremonies.'),
          row('Vibration', toggle('haptics', s.haptics)),
        ])}
        ${rows([
          row('Quiet hours', toggle('quiet', s.quiet), 'Nothing louder than Subtle, and no Arena alarm.'),
          s.quiet ? row('From', time('quietFrom', s.quietFrom)) : '',
          s.quiet ? row('To', time('quietTo', s.quietTo)) : '',
        ])}`;
      bind(el, 'sound');
      bind(el, 'fullTime', 'fullTime', (e) => e.checked);
      bind(el, 'haptics', 'haptics', (e) => e.checked);
      // The two times only exist while quiet hours are on, so the page redraws.
      q(el, 'quiet').addEventListener('change', (e) => {
        store.setSetting('quiet', e.target.checked);
        renderSettings(document.getElementById('app'), 'alerts');
      });
      bind(el, 'quietFrom', 'quietFrom');
      bind(el, 'quietTo', 'quietTo');
      showNotifications(el);
    },
  },
  {
    id: 'appearance',
    title: 'Appearance',
    render(el) {
      const s = store.get().settings;
      el.innerHTML = rows([
        row('Theme', select('theme', [['dark', 'Dark'], ['black', 'Pure black']], s.theme)),
        row('Reduce motion', toggle('reduceMotion', s.reduceMotion)),
      ]);
      bind(el, 'theme');
      bind(el, 'reduceMotion', 'reduceMotion', (e) => e.checked);
    },
  },
  {
    id: 'privacy',
    title: 'Privacy and lock',
    render(el) {
      const s = store.get().settings;
      el.innerHTML = rows([
        row('Lock the app', toggle('appLock', s.appLock, lock.isAvailable() ? '' : 'disabled'),
          'Forgetting the PIN means erasing the app.'),
        lock.isSet() ? act('Change PIN', 'id="changePin"') : '',
      ])
        // Its own block: hidden outside the EEA and the UK, and a hidden last
        // row would leave a rule under the one above it.
        + rows([act('Ad privacy choices', 'id="adConsent" hidden')]);
      wireLock(el);
      showAdConsent(el);
    },
  },
  {
    id: 'data',
    title: 'Your data',
    render(el) {
      el.innerHTML = `
        ${rows([
          link('Archived habits', 'href="#/habits/archive"', String(habits.archived().length || '')),
          act('Export habits as CSV', 'id="csv"'),
          act('Export backup', 'id="exportBtn"'),
          act('Import backup', 'id="importBtn"'),
        ])}
        <input type="file" id="importFile" accept="application/json" hidden>
        ${restorePoints()}
        ${rows([act('Erase all data', 'id="reset"', '', 'danger')])}`;
      q(el, 'csv').addEventListener('click', exportCsv);
      wireBackup(el);
      q(el, 'reset').addEventListener('click', () => askErase(el));
    },
  },
  {
    id: 'about',
    title: 'About',
    render(el) {
      el.innerHTML = `
        ${rows([
          link('Privacy policy', 'href="./legal/privacy.html"'),
          link('Terms of service', 'href="./legal/terms.html"'),
          link('Health and wellbeing', 'href="./legal/wellbeing.html"'),
          link('Open source licences', 'href="./legal/licences.html"'),
        ])}
        ${rows([
          row('Version', state('version', VERSION)),
          act('Copy diagnostics', 'id="diag"'),
        ])}
        <div class="set-tail">
          <a class="tail-btn" href="#/intro">Show the introduction again</a>
        </div>`;
      q(el, 'diag').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(diagnostics());
          toast('Copied');
        } catch {
          toast('Could not copy here');
        }
      });
    },
  },
];

export const SETTINGS_PAGES = PAGES.map((p) => p.id);

/** Versions, sync state and counts. Never a name, a note or a mark. */
function diagnostics() {
  const st = store.get();
  const items = st.habits.items;
  const entries = Object.values(st.habits.entries).reduce((n, days) => n + Object.keys(days).length, 0);
  return [
    `Habit Nemesis ${VERSION}, schema ${st.v}`,
    `platform ${isNative() ? 'android' : 'web'}, theme ${st.settings.theme}`,
    `sync ${store.syncState()}, last ${store.lastSynced() || 'never'}, changed ${st.settings.changedAt || 'never'}`,
    `habits ${items.filter((h) => !h.archived).length} live, ${items.filter((h) => h.archived).length} archived, groups ${st.habits.groups.length}`,
    `entries ${entries}, store ${Math.round(store.exportJson().length / 1024)} KB`,
    `arena week ${st.arena.seenWeek || 'none'}, notice ${st.arena.notice ? 'on' : 'off'}`,
    navigator.userAgent,
  ].join('\n');
}

/* ---------------- the root ---------------- */

/** What a page is set to, read down the right edge. A row with no value is a
 *  row you cannot tell apart from the next one. */

/** State, not a label: whether the record is anywhere but this phone. */
function accountCard() {
  if (!configured()) return '';
  if (!account.signedIn()) {
    return `<div class="card acc-card">
      <span class="acc-state" data-state="none">Not backed up</span>
      <a class="btn primary" href="#/account">Sign in</a>
    </div>`;
  }
  return `<a class="card acc-card" href="#/account">
    <span class="acc-state" id="syncLine" data-state="${syncState()}">${escapeHtml(syncLine())}</span>
    <span class="acc-mail">${escapeHtml(account.emailOf())}</span>
    ${icon('back', 16)}
  </a>`;
}

/** The card's state line follows the sync. Unhooks itself once the card is gone. */
function followSync() {
  const off = store.onSyncState(() => {
    const el = document.getElementById('syncLine');
    if (!el) return off();
    el.textContent = syncLine();
    el.dataset.state = syncState();
  });
}

// The dot's colour, not the words: good, waiting, or failed.
const syncState = () => ({ pending: 'wait', offline: 'wait', error: 'bad' }[store.syncState()] || 'good');

function syncLine() {
  const at = store.lastSynced();
  return {
    pending: 'Syncing',
    offline: 'Offline',
    error: 'Sync failed',
  }[store.syncState()] || (at ? `Synced ${relTime(at)}` : 'Not synced yet');
}

/** The root, or one page. Sub-pages go back to the root, the root to the grid. */
export function renderSettings(mount, page) {
  const p = PAGES.find((x) => x.id === page);
  mount.innerHTML = `
    <div class="screen settings">
      <header class="screen-head">
        <button class="icon-btn" data-back="${p ? 'settings' : 'hub'}" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(p ? p.title : 'Settings')}</h1>
        <span class="icon-btn ghost"></span>
      </header>
      ${p ? '<div id="page"></div>' : `${accountCard()}${rows(PAGES.map((x) =>
        link(escapeHtml(x.title), `href="#/settings/${x.id}"`)))}`}
    </div>`;
  if (p) p.render(mount.querySelector('#page'));
  else if (account.signedIn()) followSync();
}

/** One copy a day, three kept. Android's own backup is the only one that
 *  survives the app being uninstalled. */
function restorePoints() {
  const snaps = store.snapshots();
  return `<h3 class="set-group">Restore points</h3>
    ${snaps.length
      ? rows(snaps.map((s) => `<button type="button" class="set-link" data-restore="${escapeHtml(s.day)}">
          <span>${escapeHtml(relDay(s.day))}</span><i>Restore</i>
        </button>`))
      : '<p class="fineprint">The first one is written the next time you open the app.</p>'}
    <p class="fineprint">${isNative()
      ? 'This phone also backs the record up to your Google account, so reinstalling brings it back.'
      : 'Nothing here survives the app being removed.'}</p>`;
}

/* ---------------- the PIN ---------------- */
// One switch. Turning it on asks for a PIN, because a lock with no PIN is a
// setting that does nothing.

function wireLock(el) {
  q(el, 'changePin')?.addEventListener('click', () => askPin({ change: true }));

  q(el, 'appLock').addEventListener('change', (e) => {
    if (!e.target.checked) {
      lock.clearPin();
      toast('App lock off');
      return renderSettings(document.getElementById('app'), 'privacy');
    }
    e.target.checked = false;
    if (!lock.isAvailable()) return toast('This device cannot store a PIN.');
    askPin({ change: false });
  });
}

/** Four digits, twice, and it says what forgetting costs before you commit. */
function askPin({ change }) {
  const sheet = openSheet(`
    <h2>${change ? 'Change your PIN' : 'Set a PIN'}</h2>
    <p class="fineprint">There is no recovery. Forget it and the only way back in is erasing the app.</p>
    ${change ? '<input type="password" id="pinOld" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="Current">' : ''}
    <input type="password" id="pinA" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="New PIN">
    <input type="password" id="pinB" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="Again">
    <p class="warn-inline" id="pinErr" hidden></p>
    <div class="btn-row">
      <button class="btn ghost" data-close>Cancel</button>
      <button class="btn primary" id="pinGo">${change ? 'Change' : 'Turn on'}</button>
    </div>`);

  const el = (id) => sheet.el.querySelector('#' + id);
  const err = el('pinErr');
  const fail = (msg) => {
    err.textContent = msg;
    err.hidden = false;
    haptic('miss');
  };

  el('pinGo').addEventListener('click', async () => {
    const a = el('pinA').value;
    const b = el('pinB').value;
    if (a.length < 4) return fail('At least four digits.');
    if (a !== b) return fail('Those two do not match.');
    if (change && !(await lock.verify(el('pinOld').value))) return fail('That is not your current PIN.');

    await lock.setPin(a);
    if (!change) {
      store.setSetting('appLock', true, { local: true });
      // Takes effect next launch, so turning it on cannot lock you out here.
      lock.markUnlocked();
    }
    sheet.close();
    haptic('done');
    toast(change ? 'PIN changed' : 'The app will ask for your PIN next time');
    renderSettings(document.getElementById('app'), 'privacy');
  });

  (change ? el('pinOld') : el('pinA')).focus();
}

/** Android denies notifications until asked, and there is no way back from a
 *  refusal except the system settings, so the state is worth showing. */
async function showNotifications(el) {
  if (!isNative()) return;
  const out = q(el, 'notifState');
  const ask = q(el, 'askNotif');
  const draw = (perm) => {
    out.textContent = { granted: 'On', denied: 'Off, blocked in Android', prompt: 'Not asked yet' }[perm];
    ask.hidden = perm !== 'prompt';
  };
  draw(await alarmPermission());
  ask.addEventListener('click', async () => {
    await askAlarms();
    draw(await alarmPermission());
  });
}

/** Google requires a way back into the consent form for anyone who was asked,
 *  and shows nothing to anyone who was not. */
async function showAdConsent(el) {
  const box = q(el, 'adConsent');
  if (!box || !(await ads.consentChangeable())) return;
  box.hidden = false;
  box.addEventListener('click', () => ads.openConsentForm());
}

/* ---------------- your data ---------------- */

function wireBackup(el) {
  q(el, 'exportBtn').addEventListener('click', () => {
    saveFile(`habit-nemesis-backup-${store.dayKey()}.json`, store.exportJson());
  });

  const file = q(el, 'importFile');
  q(el, 'importBtn').addEventListener('click', () => file.click());

  el.querySelectorAll('[data-restore]').forEach((b) =>
    b.addEventListener('click', () => {
      const day = b.dataset.restore;
      const before = store.exportJson();
      try {
        store.restoreSnapshot(day);
        haptic('done');
        renderSettings(document.getElementById('app'), 'data');
        toast(`Rolled back to ${relDay(day)}`, { undo: () => { store.importJson(before); renderSettings(document.getElementById('app'), 'data'); } });
      } catch (e) {
        toast(e.message);
      }
    }));

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      store.importJson(await f.text());
      toast('Backup restored');
      renderSettings(document.getElementById('app'), 'data');
    } catch (err) {
      toast(`Could not read that file: ${err.message}`);
    }
  });
}

/** The one destructive act with no undo, so it is typed rather than tapped. */
function askErase() {
  const sheet = openSheet(`
    <h2>Erase all data</h2>
    <p class="muted small">Every habit, every day you marked, and everything the Arena has recorded. No undo. Type <b>erase</b> to confirm.</p>
    <input type="text" id="word" autocomplete="off" class="set-word" placeholder="erase">
    <div class="btn-row">
      <button class="btn ghost" data-close>Keep it</button>
      <button class="btn danger" id="go">Erase</button>
    </div>`);
  sheet.el.querySelector('#go').addEventListener('click', () => {
    if (sheet.el.querySelector('#word').value.trim().toLowerCase() !== 'erase') return haptic('miss');
    store.reset();
    sheet.close();
    toast('All data erased');
    location.hash = '#/hub';
  });
}

/** Every habit by day, newest first. Quoted: `Run, then stretch` is one column. */
function exportCsv() {
  const list = habits.active().concat(habits.archived());
  if (!list.length) return toast('No habits to export');
  const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const sums = list.map((h) => habits.summary(h));
  const first = sums.reduce((a, s) => (s.days.length && (!a || s.days[0].key < a) ? s.days[0].key : a), null);
  const lines = [['date', ...list.map((h) => h.name)].map(quote).join(',')];
  for (let key = habits.today(); first && key >= first; key = store.addDays(key, -1)) {
    lines.push(
      [
        key,
        ...sums.map((s) => {
          const d = s.index.get(key);
          if (!d || d.raw === undefined) return '';
          if (d.raw === habits.SKIP) return 'skip';
          return d.raw;
        }),
      ]
        .map(quote)
        .join(',')
    );
  }
  saveFile(`habit-nemesis-${store.dayKey()}.csv`, lines.join('\n'), 'text/csv');
}
