// App-wide PIN gate. Owns whether the app is unlocked.
//
// The PIN is never stored. A random salt derives a key, the key encrypts a
// known string, and the blob is what an attempt is tested against: a wrong PIN
// fails AES-GCM's auth tag and nothing leaks. Forgetting it means erasing the
// app, and the UI says so before you set one.

import * as store from './store.js';
import { haptic } from './ui.js';
import { icon, logoMark } from './icons.js';

const ITERATIONS = 250000;
const CHECK_TEXT = 'habit-nemesis-lock-v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  to: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  from: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

let unlocked = false;

export const isSet = () => !!store.get().settings.lock;

/** WebCrypto needs a secure context. Over plain http it is simply absent. */
export const isAvailable = () => typeof crypto !== 'undefined' && !!crypto.subtle;

export const lockActive = () => store.get().settings.appLock && isSet() && !unlocked;

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const check = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(CHECK_TEXT));
  store.update((s) => {
    s.settings.lock = { salt: b64.to(salt), iv: b64.to(iv), check: b64.to(check) };
  });
  unlocked = true;
}

export async function verify(pin) {
  const v = store.get().settings.lock;
  if (!v) return false;
  const key = await deriveKey(pin, b64.from(v.salt));
  try {
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.from(v.iv) }, key, b64.from(v.check));
    return dec.decode(out) === CHECK_TEXT;
  } catch {
    return false;
  }
}

/** Clear the PIN, which also turns the lock off. */
export function clearPin() {
  store.update((s) => {
    s.settings.lock = null;
    s.settings.appLock = false;
  });
  unlocked = true;
}

/** Enabling the lock must not lock you out of the screen you did it on. */
export function markUnlocked() {
  unlocked = true;
}

/** Re-arm. Called by the shell only. */
export function relock() {
  unlocked = false;
}

/* ---------------- the gate ---------------- */

export function renderLock(mount, onUnlocked) {
  mount.innerHTML = `
    <div class="screen lock-screen">
      <div class="lock-brand">${logoMark(44)}<h1>Habit Nemesis</h1></div>
      <p class="muted small centre">Enter your PIN</p>
      <input type="password" id="pin" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="••••">
      <p class="warn-inline" id="err" hidden>Wrong PIN</p>
      <button class="btn primary big" id="go">${icon('check', 16)} Unlock</button>
    </div>`;

  const pin = mount.querySelector('#pin');
  const err = mount.querySelector('#err');
  const go = mount.querySelector('#go');

  const attempt = async () => {
    if (!pin.value) return;
    go.disabled = true;
    const ok = await verify(pin.value).catch(() => false);
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
