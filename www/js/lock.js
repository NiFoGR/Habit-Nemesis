// The optional app-wide PIN gate.
//
// Owns whether the app is currently unlocked, so nothing else has to track it.
// `lockActive()` is the only question the router asks; `markUnlocked()` and
// `relock()` are how the rest of the app moves that state.

import * as store from './store.js';
import * as vault from './pe/vault.js';
import { haptic } from './ui.js';
import { icon, logoMark } from './icons.js';

/* ---------------- the gate ----------------
   Reuses the gallery PIN rather than inventing a second one: two PINs for one
   app is how people end up writing them down. Unlocking here also unlocks the
   vault, which is the behaviour you want. The alternative is being asked for
   the same PIN twice in a row on the way to the gallery. */

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


/** Turning the lock on from settings must not lock you out of the screen you
 *  just enabled it on, so that counts as already unlocked. */
export function markUnlocked() {
  unlocked = true;
}

/** Backgrounding re-arms the gate. Called by the shell, never from a screen. */
export function relock() {
  unlocked = false;
}
