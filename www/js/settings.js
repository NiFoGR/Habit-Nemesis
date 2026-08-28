// App-wide settings.
//
// One rule decides what belongs on this screen: a setting lives where the
// thing it affects lives. Anything true of the whole app is here; anything
// true of one section is on that section's own settings screen, reachable
// from the jump list at the top.

import * as store from './store.js';
import * as vault from './pe/vault.js';
import { usage as photoUsage } from './pe/db.js';
import { escapeHtml, toast, openSheet } from './ui.js';
import * as habits from './habits/program.js';
import { icon } from './icons.js';
import { kegelName, peName } from './names.js';
import { markUnlocked } from './lock.js';

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
  return `<div class="set-nav">
    <a href="#/kegels/settings">${icon('target', 18)}<span><b>${escapeHtml(kegelName())}</b><i>Input, daily target, release day, reminder</i></span></a>
    <a href="#/pe/settings">${icon('trend', 18)}<span><b>${escapeHtml(peName())}</b><i>Units, session defaults, check-in day</i></span></a>
    <a href="#/bible/settings">${icon('scripture', 18)}<span><b>Bible and prayer</b><i>Text size, reminder, prayer times and language</i></span></a>
    <a href="#/breathe/settings">${icon('breath', 18)}<span><b>Wind-down</b><i>Pattern, length, pacing, reminder</i></span></a>
  </div>`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function renderSettings(mount) {
  const s = store.get().settings;
  const pe = store.get().pe.settings;
  const nl = store.get().nightlight;
  const hs = habits.settings();

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <h3 class="sec-head">Sections</h3>
      ${settingsNav()}

      <h3 class="sec-head">Everywhere</h3>

      <section class="card">
        <div class="h-row">${icon('habits', 16)}<h2>The grid</h2></div>
        <label class="setting">
          <span><b>First day of the week</b><i>Where the calendar and the weekly buckets start.</i></span>
          <select id="firstDay">
            ${WEEKDAYS.map((d, i) => `<option value="${i}" ${hs.firstDay === i ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>A new day begins at</b><i>Past midnight, so something ticked at 01:00 belongs to the night you were still up for. The grid only: sessions and readings record against midnight.</i></span>
          <select id="dayStart">
            ${[0, 1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}" ${hs.dayStartHour === h ? 'selected' : ''}>${h === 0 ? 'Midnight' : `${String(h).padStart(2, '0')}:00`}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Days on screen</b><i>Columns in the grid.</i></span>
          <select id="columns">
            ${[1, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${hs.columns === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <label class="setting toggle">
          <span><b>Oldest first</b><i>Days run left to right instead of newest on the left.</i></span>
          <input type="checkbox" id="reverseDays" ${hs.reverseDays ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Show the five</b><i>${escapeHtml(kegelName())}, ${escapeHtml(peName())}, the Bible, prayer and the wind-down, as rows on the grid. Turning them off does not turn the features off.</i></span>
          <input type="checkbox" id="showLinked" ${hs.showLinked ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('check', 16)}<h2>Marking</h2></div>
        <label class="setting toggle">
          <span><b>Toggle with a short press</b><i>One tap marks a day. Turn it off and a cell needs holding, which is what you want if you keep catching them while scrolling.</i></span>
          <input type="checkbox" id="shortPress" ${hs.shortPress ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Skip days</b><i>Tap again for a skip instead of clearing. A skip leaves the score exactly where it was and keeps the streak running through it: it is for the days that genuinely did not count.</i></span>
          <input type="checkbox" id="skipDays" ${hs.skipDays ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Question marks for missing data</b><i>Tells a day you never answered apart from a day you answered no. With this on, tap twice to record a real lapse.</i></span>
          <input type="checkbox" id="unknownMarks" ${hs.unknownMarks ? 'checked' : ''}>
        </label>
        <div class="btn-row">
          <a class="btn linkbtn" href="#/habits/archive">Archived habits</a>
          <button class="btn" id="csv">Export habits as CSV</button>
        </div>
      </section>

      <section class="card">
        <div class="h-row">${icon('flash', 16)}<h2>Feedback</h2></div>
        <label class="setting toggle">
          <span><b>Vibration</b><i>Buzzes on every phase change, so you can train with the screen face down.</i></span>
          <input type="checkbox" id="haptics" ${s.haptics ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Sound</b><i>Tones in a session, and when a week in the Arena is won or lost.</i></span>
          <input type="checkbox" id="sound" ${s.sound ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Discreet mode</b><i>Renames Kegels to "Core Training" and PE to "Length Training".</i></span>
          <input type="checkbox" id="discreet" ${s.discreet ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('warmth', 16)}<h2>Night light</h2></div>
        <p class="small muted">${nl.enabled
          ? `Warming from ${escapeHtml(nl.wakeAt)}, reaching ${nl.nightKelvin}K by ${escapeHtml(nl.sleepAt)}.`
          : 'Off. Takes the blue out of the screen as the evening goes on.'}</p>
        <a class="btn ghost wide linkbtn" href="#/settings/night">${nl.enabled ? 'Adjust' : 'Set it up'}</a>
      </section>

      <section class="card">
        <div class="h-row">${icon('lock', 16)}<h2>Privacy</h2></div>
        <label class="setting toggle">
          <span><b>Lock the app</b><i>${vault.isSet() ? 'Asks for your gallery PIN when you open NiFo.' : 'Set a gallery PIN first, under Progress then Gallery.'}</i></span>
          <input type="checkbox" id="appLock" ${s.appLock ? 'checked' : ''} ${vault.isSet() ? '' : 'disabled'}>
        </label>
        <label class="setting">
          <span><b>Gallery auto-lock</b><i>How long the gallery stays open untouched.</i></span>
          <select id="autoLockMin">
            ${[1, 2, 5, 10].map((m) => `<option value="${m}" ${pe.autoLockMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
        <p class="fineprint">The app lock is a door, not a safe. It keeps someone who picks up your phone out, but sessions and measurements are stored unencrypted like any other app's data. Only the photos are actually encrypted, and that is what the PIN protects.</p>
      </section>

      <section class="card">
        <div class="h-row">${icon('images', 16)}<h2>Data</h2></div>
        <div class="kv"><span>On this device</span><b id="usage">checking</b></div>
        <p class="fineprint">Everything lives on this phone. Reinstalling the app or clearing browser data wipes it, so export occasionally.</p>
        <div class="btn-row">
          <button class="btn" id="exportBtn">Export backup</button>
          <button class="btn" id="importBtn">Import backup</button>
        </div>
        <input type="file" id="importFile" accept="application/json" hidden>
      </section>

      <section class="card danger">
        <div class="h-row">${icon('warn', 16)}<h2>Reset</h2></div>
        <p class="small muted">Erases every session, measurement, prayer day, chapter read, habit and badge. No undo. Export a backup first.</p>
        <button class="btn danger" id="reset">Erase all data</button>
      </section>

      <p class="fineprint centre">NiFo, everything on-device</p>
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
    mount.querySelector(`#${id}`).addEventListener('change', (e) => setGrid(id, e.target.checked))
  );
  mount.querySelector('#csv').addEventListener('click', exportCsv);

  bind('haptics', 'haptics', (e) => e.checked);
  bind('sound', 'sound', (e) => e.checked);
  bind('discreet', 'discreet', (e) => e.checked);

  mount.querySelector('#autoLockMin').addEventListener('change', (e) => {
    store.update((st) => {
      st.pe.settings.autoLockMin = Number(e.target.value);
    });
    toast('Saved');
  });

  mount.querySelector('#appLock').addEventListener('change', (e) => {
    store.setSetting('appLock', e.target.checked);
    // Turning it on takes effect at the next launch. Locking someone out of the
    // screen they just enabled it on would be absurd.
    markUnlocked();
    toast(e.target.checked ? 'The app will ask for your PIN next time' : 'App lock off');
  });

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
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nifo-backup-${store.dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
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
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nifo-habits-${store.dayKey()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('CSV downloaded');
}
