// App-wide settings.
//
// One rule decides what belongs on this screen: a setting lives where the
// thing it affects lives. Anything true of the whole app is here; anything
// true of one section is on that section's own settings screen, reachable
// from the jump list at the top.

import * as store from './store.js';
import * as vault from './pe/vault.js';
import { usage as photoUsage } from './pe/db.js';
import { escapeHtml, toast } from './ui.js';
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
 *  such screen to point it at either: the rule's settings live on the Bible
 *  screen, because the rule lives in the Bible section. One row, named for
 *  both. */
function settingsNav() {
  return `<div class="set-nav">
    <a href="#/kegels/settings">${icon('target', 18)}<span><b>${escapeHtml(kegelName())}</b><i>Input, daily target, release day, reminder</i></span></a>
    <a href="#/pe/settings">${icon('trend', 18)}<span><b>${escapeHtml(peName())}</b><i>Units, session defaults, check-in day</i></span></a>
    <a href="#/bible/settings">${icon('scripture', 18)}<span><b>Bible and prayer</b><i>Text size, reminder, the rule's times and language</i></span></a>
    <a href="#/breathe/settings">${icon('breath', 18)}<span><b>Wind-down</b><i>Pattern, length, pacing, reminder</i></span></a>
  </div>`;
}

export function renderSettings(mount) {
  const s = store.get().settings;
  const pe = store.get().pe.settings;
  const nl = store.get().nightlight;

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
        <div class="h-row">${icon('flash', 16)}<h2>Feedback</h2></div>
        <label class="setting toggle">
          <span><b>Vibration</b><i>Buzzes on every phase change, so you can train with the screen face down.</i></span>
          <input type="checkbox" id="haptics" ${s.haptics ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Sound cues</b><i>A tone when a rep starts and when you reach the target.</i></span>
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
          ? `Warming from ${escapeHtml(nl.wakeAt)} to ${nl.nightKelvin}K by ${escapeHtml(nl.sleepAt)}.`
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
        <p class="small muted">Erases every session, measurement, prayer day, chapter read and badge. No undo. Export a backup first.</p>
        <button class="btn danger" id="reset">Erase all data</button>
      </section>

      <p class="fineprint centre">NiFo, everything on-device</p>
    </div>`;

  const bind = (id, key, get = (e) => e.value) =>
    mount.querySelector('#' + id).addEventListener('change', (e) => {
      store.setSetting(key, get(e.target));
      toast('Saved');
    });
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

