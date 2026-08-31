// App-wide settings. A setting lives where the thing it affects lives.

import * as store from './store.js';
import { escapeHtml, toast, openSheet, saveFile, haptic, relDay, WEEKDAYS_LONG } from './ui.js';
import * as habits from './habits/program.js';
import { icon } from './icons.js';
import * as lock from './lock.js';
import { isNative } from './native.js';

export function renderSettings(mount) {
  const s = store.get().settings;
  const hs = habits.settings();

  // Label left, value right. No explanation under it.
  const row = (label, control, note) => `<div class="set-row">
    <span class="set-label">${label}${note ? `<i>${note}</i>` : ''}</span>
    ${control}
  </div>`;
  const select = (id, options, value) =>
    `<select id="${id}">${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const toggle = (id, on, extra = '') => `<input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${extra}>`;
  const group = (name, rows) => `<h3 class="set-group">${name}</h3><div class="set-rows">${rows}</div>`;

  mount.innerHTML = `
    <div class="screen settings">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <!-- The one loud thing on the page, and the only claim the app makes
           about itself that is worth making twice. -->
      <section class="set-hero">
        <b id="usage">checking</b>
        <span>on this phone, and nowhere else.</span>
      </section>

      ${group('The grid', [
        row('Week starts', select('firstDay', WEEKDAYS_LONG.map((d, i) => [i, d]), hs.firstDay)),
        row('A new day begins at', select('dayStart', [0, 1, 2, 3, 4, 5, 6].map((h) => [h, h === 0 ? 'Midnight' : `${String(h).padStart(2, '0')}:00`]), hs.dayStartHour),
          'Set it past midnight and a late night still counts as the day before.'),
        row('Days on screen', select('columns', [3, 4, 5, 6, 7].map((n) => [n, n]), hs.columns)),
        row('Oldest first', toggle('reverseDays', hs.reverseDays)),
      ].join(''))}

      ${group('Marking', [
        row('Toggle with a short press', toggle('shortPress', hs.shortPress)),
        row('Skip days', toggle('skipDays', hs.skipDays), 'A skip holds the score and the streak where they are.'),
        row('Question marks for missing data', toggle('unknownMarks', hs.unknownMarks), 'Tells a day you never answered apart from a day you answered no.'),
      ].join(''))}

      ${group('Feedback', [
        row('Vibration', toggle('haptics', s.haptics)),
        row('Sound', toggle('sound', s.sound)),
      ].join(''))}

      ${group('Privacy', [
        row('Lock the app', toggle('appLock', s.appLock, lock.isAvailable() ? '' : 'disabled'),
          lock.isSet() ? 'Asks for your PIN when you open the app.' : 'Sets a PIN. Forgetting it means erasing the app.'),
        lock.isSet() ? `<div class="set-actions"><button class="btn" id="changePin">Change PIN</button></div>` : '',
      ].join(''))}

      <h3 class="set-group">Your data</h3>
      <div class="set-actions">
        <a class="btn linkbtn" href="#/habits/archive">Archived habits</a>
        <button class="btn" id="csv">Habits as CSV</button>
        <button class="btn" id="exportBtn">Export backup</button>
        <button class="btn" id="importBtn">Import backup</button>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden>

      ${restorePoints()}

      <button class="btn danger wide" id="reset">Erase all data</button>
      <p class="fineprint">Every habit, every day you have marked, and everything the Arena has recorded. No undo.</p>

      <div class="set-tail">
        <a class="tail-btn" href="#/intro">Show the introduction again</a>
      </div>
    </div>`;

  const bind = (id, key, get = (e) => e.value) =>
    mount.querySelector('#' + id).addEventListener('change', (e) => {
      store.setSetting(key, get(e.target));
      toast('Saved');
    });
  const setGrid = (key, value) =>
    store.update((st) => {
      st.habits.settings[key] = value;
    });
  mount.querySelector('#firstDay').addEventListener('change', (e) => setGrid('firstDay', Number(e.target.value)));
  mount.querySelector('#dayStart').addEventListener('change', (e) => {
    setGrid('dayStartHour', Number(e.target.value));
    toast('Saved');
  });
  mount.querySelector('#columns').addEventListener('change', (e) => setGrid('columns', Number(e.target.value)));
  ['reverseDays', 'shortPress', 'skipDays', 'unknownMarks'].forEach((id) =>
    mount.querySelector(`#${id}`).addEventListener('change', (e) => setGrid(id, e.target.checked))
  );
  mount.querySelector('#csv').addEventListener('click', exportCsv);

  bind('haptics', 'haptics', (e) => e.checked);
  bind('sound', 'sound', (e) => e.checked);

  wireLock(mount);
  showUsage(mount);
  wireBackup(mount);

  mount.querySelector('#reset').addEventListener('click', () => {
    if (confirm('Erase everything and start from scratch? This cannot be undone.')) {
      store.reset();
      toast('All data erased');
      location.hash = '#/hub';
    }
  });
}

/** What is kept, and what each thing actually protects against. Every change
 *  saves the instant it happens; these are the daily copies, and Android's own
 *  backup is the only one that survives the app being uninstalled. */
function restorePoints() {
  const snaps = store.snapshots();
  return `<div class="restore">
    <h4>Restore points</h4>
    ${snaps.length
      ? `<p class="fineprint">One a day, last three kept.</p>
         <div class="set-actions">${snaps
           .map((s) => `<button class="btn" data-restore="${escapeHtml(s.day)}">${escapeHtml(relDay(s.day))}</button>`)
           .join('')}</div>`
      : '<p class="fineprint">The first one is written the next time you open the app.</p>'}
    <p class="fineprint">${isNative()
      ? 'This phone also backs the record up to your Google account, so reinstalling brings it back.'
      : 'Nothing here survives clearing your browser data.'}</p>
  </div>`;
}

/* ---------------- the PIN ---------------- */
// One switch. Turning it on asks for a PIN, because a lock with no PIN is a
// setting that does nothing.

function wireLock(mount) {
  mount.querySelector('#changePin')?.addEventListener('click', () => askPin({ change: true }));

  mount.querySelector('#appLock').addEventListener('change', (e) => {
    if (!e.target.checked) {
      lock.clearPin();
      toast('App lock off');
      return renderSettings(mount);
    }
    e.target.checked = false;
    if (!lock.isAvailable()) return toast('This browser cannot store a PIN. Open the app over HTTPS.');
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
      store.setSetting('appLock', true);
      // Takes effect next launch, so turning it on cannot lock you out here.
      lock.markUnlocked();
    }
    sheet.close();
    haptic('done');
    toast(change ? 'PIN changed' : 'The app will ask for your PIN next time');
    renderSettings(document.getElementById('app'));
  });

  (change ? el('pinOld') : el('pinA')).focus();
}

/** Storage: the thing that fills up, and a backup is the only defence. */
async function showUsage(mount) {
  const el = mount.querySelector('#usage');
  if (!el) return;
  try {
    const est = await navigator.storage?.estimate?.();
    const mb = est?.usage ? est.usage / 1048576 : null;
    el.textContent = mb == null ? 'unknown' : mb < 1 ? 'under 1 MB' : `${mb.toFixed(1)} MB`;
  } catch {
    el.textContent = 'unknown';
  }
}

function wireBackup(mount) {
  mount.querySelector('#exportBtn').addEventListener('click', () => {
    saveFile(`habit-nemesis-backup-${store.dayKey()}.json`, store.exportJson());
  });

  const file = mount.querySelector('#importFile');
  mount.querySelector('#importBtn').addEventListener('click', () => file.click());

  mount.querySelectorAll('[data-restore]').forEach((b) =>
    b.addEventListener('click', () => {
      const day = b.dataset.restore;
      if (!confirm(`Roll everything back to ${relDay(day)}? Anything recorded since is lost.`)) return;
      try {
        store.restoreSnapshot(day);
        haptic('done');
        toast(`Rolled back to ${relDay(day)}`);
        renderSettings(document.getElementById('app'));
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
      renderSettings(mount);
    } catch (err) {
      toast(`Could not read that file: ${err.message}`);
    }
  });
}

/** Every habit by day, newest first. Quoted: `Run, then stretch` is one column. */
function exportCsv() {
  const list = habits.active().concat(habits.archived());
  if (!list.length) return toast('No habits to export');
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const sums = list.map((h) => habits.summary(h));
  const first = sums.reduce((a, s) => (s.days.length && (!a || s.days[0].key < a) ? s.days[0].key : a), null);
  const rows = [['date', ...list.map((h) => h.name)].map(q).join(',')];
  for (let key = habits.today(); first && key >= first; key = store.addDays(key, -1)) {
    rows.push(
      [
        key,
        ...sums.map((s) => {
          const d = s.index.get(key);
          if (!d || d.raw === undefined) return '';
          if (d.raw === habits.SKIP) return 'skip';
          return d.raw;
        }),
      ]
        .map(q)
        .join(',')
    );
  }
  saveFile(`habit-nemesis-${store.dayKey()}.csv`, rows.join('\n'), 'text/csv');
}
