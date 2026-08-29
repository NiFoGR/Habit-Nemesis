// App-wide PIN gate. Owns whether the app is unlocked.

import * as store from './store.js';
import * as vault from './pe/vault.js';
import { haptic } from './ui.js';
import { icon, logoMark } from './icons.js';

/* ---------------- the gate ---------------- */
// Reuses the gallery PIN, and unlocking here unlocks the vault too.

let unlocked = false;

export const lockActive = () => store.get().settings.appLock && vault.isSet() && !unlocked;

export function renderLock(mount, onUnlocked) {
  mount.innerHTML = `
    <div class="screen lock-screen">
      <div class="lock-brand">${logoMark(44)}<h1>NiFo</h1></div>
      <p class="muted small centre">Enter your PIN</p>
      <input type="password" id="pin" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="••••">
      <p class="warn-inline" id="err" hidden>Wrong PIN</p>
      <button class="btn primary big" id="go">Unlock</button>
    </div>`;

  const pin = mount.querySelector('#pin');
  const err = mount.querySelector('#err');
  const go = mount.querySelector('#go');

  const attempt = async () => {
    if (!pin.value) return;
    go.disabled = true;
    const ok = await vault.unlock(pin.value).catch(() => false);
    go.disabled = false;
    if (!ok) {
      err.hidden = false;
      pin.value = '';
      haptic('miss');
      return;
    }
    unlocked = true;
    haptic('done');
    onUnlocked();
  };

  go.addEventListener('click', attempt);
  pin.addEventListener('keydown', (e) => {
    err.hidden = true;
    if (e.key === 'Enter') attempt();
  });
  pin.focus();
}

/** Enabling the lock must not lock you out of the screen you did it on. */
export function markUnlocked() {
  unlocked = true;
}

/** Re-arm. Called by the shell only. */
export function relock() {
  unlocked = false;
}
