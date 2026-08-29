// App-wide settings. A setting lives where the thing it affects lives.

import * as store from './store.js';
import * as vault from './pe/vault.js';
import { usage as photoUsage } from './pe/db.js';
import { escapeHtml, toast, openSheet, saveFile, haptic, relDay, WEEKDAYS_LONG } from './ui.js';
import * as habits from './habits/program.js';
import { icon } from './icons.js';
import { kegelName, peName } from './names.js';
import { markUnlocked } from './lock.js';
import { nifoOffered, nifoUnlocked, tryNifoPin } from './nifo.js';
import { isNative } from './native.js';

const navLink = (href, ico, name) => `<a href="${href}">${icon(ico, 16)}<span>${escapeHtml(name)}</span></a>`;

/** One row per section with its own settings screen. Prayer's live on the
 *  Bible row: prayer lives in the Bible section. Night light is not one of the
 *  five and sits outside, or a locked install cannot reach it at all. */
function settingsNav() {
  return `<div class="set-nav">
    ${navLink('#/kegels/settings', 'target', kegelName())}
    ${navLink('#/pe/settings', 'trend', peName())}
    ${navLink('#/bible/settings', 'scripture', 'Bible and prayer')}
    ${navLink('#/breathe/settings', 'breath', 'Wind-down')}
  </div>`;
}

export function renderSettings(mount) {
  const s = store.get().settings;
  const pe = store.get().pe.settings;
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

      ${nifoUnlocked() ? `<h3 class="set-group">Sections</h3>${settingsNav()}` : ''}

      <h3 class="set-group">The screen</h3>
      <div class="set-nav">${navLink('#/settings/night', 'moon', 'Night light')}</div>

      ${group('The grid', [
        row('Week starts', select('firstDay', WEEKDAYS_LONG.map((d, i) => [i, d]), hs.firstDay)),
        row('A new day begins at', select('dayStart', [0, 1, 2, 3, 4, 5, 6].map((h) => [h, h === 0 ? 'Midnight' : `${String(h).padStart(2, '0')}:00`]), hs.dayStartHour),
          'The grid only. Sessions and readings record against midnight.'),
        row('Days on screen', select('columns', [3, 4, 5, 6, 7].map((n) => [n, n]), hs.columns)),
        row('Oldest first', toggle('reverseDays', hs.reverseDays)),
        nifoUnlocked() ? row('Show the five', toggle('showLinked', hs.showLinked)) : '',
      ].join(''))}

      ${group('Marking', [
        row('Toggle with a short press', toggle('shortPress', hs.shortPress)),
        row('Skip days', toggle('skipDays', hs.skipDays), 'A skip holds the score and the streak where they are.'),
        row('Question marks for missing data', toggle('unknownMarks', hs.unknownMarks), 'Tells a day you never answered apart from a day you answered no.'),
      ].join(''))}

      ${group('Feedback', [
        row('Vibration', toggle('haptics', s.haptics)),
        row('Sound', toggle('sound', s.sound)),
        nifoUnlocked() ? row('Discreet mode', toggle('discreet', s.discreet), 'Renames Kegels and PE.') : '',
      ].join(''))}

      ${nifoUnlocked() ? group('Privacy', [
        row('Lock the app', toggle('appLock', s.appLock, vault.isSet() ? '' : 'disabled'),
          vault.isSet() ? 'Asks for your gallery PIN when you open NiFo.' : 'Needs a gallery PIN first.'),
        row('Gallery auto-lock', select('autoLockMin', [1, 2, 5, 10].map((m) => [m, `${m} min`]), pe.autoLockMin)),
      ].join('')) : ''}

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
      <p class="fineprint">${nifoUnlocked()
        ? 'Every session, measurement, prayer day, chapter read, habit and feat. No undo.'
        : 'Every habit, every day you have marked, and everything the Arena has recorded. No undo.'}</p>

      <div class="set-tail">
        <a class="tail-btn" href="#/intro">Show the introduction again</a>
        ${nifoOffered() ? '<button class="tail-btn" id="nifoOnly">nifo only</button>' : ''}
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
  ['reverseDays', 'showLinked', 'shortPress', 'skipDays', 'unknownMarks'].forEach((id) =>
    // `?.`: the five-sections switch is absent on a locked install.
    mount.querySelector(`#${id}`)?.addEventListener('change', (e) => setGrid(id, e.target.checked))
  );
  mount.querySelector('#csv').addEventListener('click', exportCsv);

  bind('haptics', 'haptics', (e) => e.checked);
  bind('sound', 'sound', (e) => e.checked);
  // Both belong to sections a locked install does not have.
  if (mount.querySelector('#discreet')) bind('discreet', 'discreet', (e) => e.checked);

  mount.querySelector('#autoLockMin')?.addEventListener('change', (e) => {
    store.update((st) => {
      st.pe.settings.autoLockMin = Number(e.target.value);
    });
    toast('Saved');
  });

  mount.querySelector('#appLock')?.addEventListener('change', (e) => {
    store.setSetting('appLock', e.target.checked);
    // Takes effect next launch, so enabling it cannot lock you out here.
    markUnlocked();
    toast(e.target.checked ? 'The app will ask for your PIN next time' : 'App lock off');
  });

  showUsage(mount);
  wireBackup(mount);
  mount.querySelector('#nifoOnly')?.addEventListener('click', askNifoPin);

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

/* ---------------- the door at the bottom ---------------- */
// One attempt, and it says so first. The sheet never names what is behind it.

function askNifoPin() {
  const sheet = openSheet(`
    <h2>nifo only</h2>
    <p class="warn-inline">One attempt. Wrong, and this is gone for good.</p>
    <input type="password" id="nifoPin" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="••••">
    <div class="btn-row">
      <button class="btn ghost" data-close>Not now</button>
      <button class="btn primary" id="nifoGo">Enter</button>
    </div>`);

  const input = sheet.el.querySelector('#nifoPin');
  const attempt = () => {
    if (!input.value) return;
    const ok = tryNifoPin(input.value);
    sheet.close();
    haptic(ok ? 'done' : 'miss');
    if (!ok) {
      toast('No.');
      renderSettings(document.getElementById('app'));
      return;
    }
    // Straight to the grid: the new rows are the answer.
    toast('Unlocked');
    location.hash = '#/hub';
  };

  sheet.el.querySelector('#nifoGo').addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });
  input.focus();
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
    saveFile(`nifo-backup-${store.dayKey()}.json`, store.exportJson());
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
      const text = await f.text();
      let keepVault = false;
      // A backup from another device would orphan the photos already here.
      const count = await photoCount();
      if (count > 0 && store.backupChangesVault(text)) {
        keepVault = !confirm(
          `This backup was made with a different gallery PIN, and there ${count === 1 ? 'is 1 photo' : `are ${count} photos`} stored on this device.\n\n` +
            "OK: use the backup's PIN. The photos already here become permanently unreadable.\n" +
            "Cancel: keep this device's PIN, and restore everything else."

        );
      }
      const res = store.importJson(text, { keepVault });
      toast(keepVault ? 'Backup restored, gallery PIN kept' : res.vaultChanged ? 'Backup restored, gallery PIN replaced' : 'Backup restored');
      renderSettings(mount);
    } catch (err) {
      toast(`Could not read that file: ${err.message}`);
    }
  });
}

async function photoCount() {
  try {
    const u = await photoUsage();
    return u?.count || 0;
  } catch {
    return 0;
  }
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
  saveFile(`nifo-habits-${store.dayKey()}.csv`, rows.join('\n'), 'text/csv');
}
