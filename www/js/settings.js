// App-wide settings.
//
// One rule decides what belongs on this screen: a setting lives where the
// thing it affects lives. Anything true of the whole app is here; anything
// true of one section is on that section's own settings screen, reachable
// from the jump list at the top.

import * as store from './store.js';
import * as vault from './pe/vault.js';
import { usage as photoUsage } from './pe/db.js';
import { escapeHtml, toast, openSheet, saveFile, haptic } from './ui.js';
import * as habits from './habits/program.js';
import { icon } from './icons.js';
import { kegelName, peName } from './names.js';
import { markUnlocked } from './lock.js';
import { nifoOffered, nifoUnlocked, tryNifoPin } from './nifo.js';

/* ---------------- settings ----------------
   One rule decides what goes here: a setting lives where the thing it affects
   lives. Anything true of the whole app is on this screen; anything true of one
   section is on that section's own settings screen, reachable from its home.

   This page used to hold the kegel training options, three PE fields and a link
   to the kegel walkthrough, while Prayer kept its own screen. Two models at
   once, and a page that grew every time a feature did. */

/** One row per section that has its own settings screen.
 *
 *  Prayer had a row of its own pointing at `#/pray/settings`, which is not in
 *  the route table and never was, so it fell through to the hub. There is no
 *  such screen to point it at either: prayer's settings live on the Bible
 *  screen, because prayer lives in the Bible section. One row, named for
 *  both. */
function settingsNav() {
  const link = (href, ico, name) => `<a href="${href}">${icon(ico, 16)}<span>${escapeHtml(name)}</span></a>`;
  return `<div class="set-nav">
    ${link('#/kegels/settings', 'target', kegelName())}
    ${link('#/pe/settings', 'trend', peName())}
    ${link('#/bible/settings', 'scripture', 'Bible and prayer')}
    ${link('#/breathe/settings', 'breath', 'Wind-down')}
  </div>`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function renderSettings(mount) {
  const s = store.get().settings;
  const pe = store.get().pe.settings;
  const nl = store.get().nightlight;
  const hs = habits.settings();

  // One row: what it is on the left, what it is set to on the right. The
  // explanation is not here, and that is the whole change - the old screen put
  // two lines of grey under every label, so the descriptions outweighed the
  // settings and the page ran to three thousand pixels of identical cards.
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
        <span>on this phone, and nowhere else. No account, no server, nobody
        else. Clearing the app's data is the only thing that can take it.</span>
      </section>

      ${nifoUnlocked() ? `<h3 class="set-group">Sections</h3>${settingsNav()}` : ''}

      ${group('The grid', [
        row('Week starts', select('firstDay', WEEKDAYS.map((d, i) => [i, d]), hs.firstDay)),
        row('A new day begins at', select('dayStart', [0, 1, 2, 3, 4, 5, 6].map((h) => [h, h === 0 ? 'Midnight' : `${String(h).padStart(2, '0')}:00`]), hs.dayStartHour),
          'The grid only. Sessions and readings record against midnight.'),
        row('Days on screen', select('columns', [1, 3, 4, 5, 6, 7].map((n) => [n, n]), hs.columns)),
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

      ${group('Night light', [
        row('The screen through the day', `<a class="set-link linkbtn" href="#/settings/night">${nl.enabled ? `${nl.nightKelvin}K by ${escapeHtml(nl.sleepAt)}` : 'Off'}</a>`),
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
      <p class="fineprint">Exporting opens your share sheet, so the file can go to Files, Drive or a message. In a browser it lands in your downloads.</p>

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
    // `?.`, because "Show the five" is not on the page at all on a locked
    // install and a missing switch must not take the other four with it.
    mount.querySelector(`#${id}`)?.addEventListener('change', (e) => setGrid(id, e.target.checked))
  );
  mount.querySelector('#csv').addEventListener('click', exportCsv);

  bind('haptics', 'haptics', (e) => e.checked);
  bind('sound', 'sound', (e) => e.checked);
  // Discreet mode and the whole Privacy card belong to sections a locked
  // install does not have, so neither is on the page to wire up.
  if (mount.querySelector('#discreet')) bind('discreet', 'discreet', (e) => e.checked);

  mount.querySelector('#autoLockMin')?.addEventListener('change', (e) => {
    store.update((st) => {
      st.pe.settings.autoLockMin = Number(e.target.value);
    });
    toast('Saved');
  });

  mount.querySelector('#appLock')?.addEventListener('change', (e) => {
    store.setSetting('appLock', e.target.checked);
    // Turning it on takes effect at the next launch. Locking someone out of the
    // screen they just enabled it on would be absurd.
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

/* ---------------- the door at the bottom ----------------
   One attempt, and it says so before you type. That warning is not a courtesy
   to whoever is guessing - it is the only thing that makes a single attempt
   fair to the person who owns the phone and is entering it with cold hands.

   The sheet never says what is behind it. "nifo only" is the whole of what
   anyone is entitled to know, and listing the five here would be telling every
   person who is not getting them exactly what they are not getting. */

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
    // Straight to the grid: five rows appearing on it is the answer, and a
    // settings screen with one fewer button at the bottom of it is not.
    toast('Unlocked');
    location.hash = '#/hub';
  };

  sheet.el.querySelector('#nifoGo').addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });
  input.focus();
}

/** Storage is worth showing because it is the thing that fills up, and because
 *  a backup is the only defence against it being cleared. */
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
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      let keepVault = false;
      // Photos are encrypted under the PIN recorded in whichever vault wins, so
      // a backup from another device would orphan the ones already here.
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

/** Every habit against every day, newest first. Quoted properly, because a
 *  habit called `Run, then stretch` would otherwise become two columns. */
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
