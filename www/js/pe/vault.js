// Gallery encryption.
//
// A PIN screen that only hides a view is theatre: anyone with the phone
// unlocked, or any script that can read IndexedDB, still gets the photos. So
// the photos are genuinely encrypted with AES-GCM under a key derived from the
// PIN, and the key exists only in memory while the gallery is open. Forgetting
// the PIN means the photos are unrecoverable — that is the point, and the UI
// says so before you set one.

import * as store from '../store.js';

const ITERATIONS = 250000;
const CHECK_TEXT = 'nifo-vault-v1';

let key = null; // live only while unlocked
let lockTimer = null;
const listeners = new Set();

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  to: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  from: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

export const isSet = () => !!store.get().pe.vault;
export const isUnlocked = () => !!key;

export function onLockChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = () => listeners.forEach((fn) => fn(isUnlocked()));

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

/** Creates the vault. The stored "check" blob is what a PIN attempt is tested
 *  against, so a wrong PIN fails fast instead of handing back garbage bytes. */
export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await deriveKey(pin, salt);
  const check = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(CHECK_TEXT));
  store.update((s) => {
    s.pe.vault = { salt: b64.to(salt), iv: b64.to(iv), check: b64.to(check) };
  });
  key = k;
  armAutoLock();
  emit();
}

export async function unlock(pin) {
  const v = store.get().pe.vault;
  if (!v) throw new Error('No PIN has been set yet');
  const k = await deriveKey(pin, b64.from(v.salt));
  try {
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.from(v.iv) }, k, b64.from(v.check));
    if (dec.decode(out) !== CHECK_TEXT) throw new Error('bad');
  } catch {
    return false; // wrong PIN: AES-GCM's auth tag fails, nothing leaks
  }
  key = k;
  armAutoLock();
  emit();
  return true;
}

export function lock() {
  key = null;
  clearTimeout(lockTimer);
  emit();
}

/** Re-locks after a period of inactivity so an open gallery does not stay
 *  readable on a phone left on a table. */
export function armAutoLock() {
  clearTimeout(lockTimer);
  const mins = store.get().pe.settings.autoLockMin || 2;
  lockTimer = setTimeout(lock, mins * 60000);
}

export async function encryptBlob(blob) {
  if (!key) throw new Error('Vault is locked');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer());
  return { iv, data, type: blob.type || 'image/jpeg' };
}

export async function decryptBlob({ iv, data, type }) {
  if (!key) throw new Error('Vault is locked');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new Blob([plain], { type: type || 'image/jpeg' });
}

/** Changing the PIN has to re-encrypt every photo, since the key changes. */
export async function changePin(oldPin, newPin, reencrypt) {
  if (!(await unlock(oldPin))) return false;
  const items = await reencrypt.read();
  const plains = [];
  for (const it of items) {
    plains.push({ id: it.id, full: await decryptBlob(it.full), thumb: await decryptBlob(it.thumb) });
  }
  await setPin(newPin);
  for (const p of plains) {
    await reencrypt.write(p.id, await encryptBlob(p.full), await encryptBlob(p.thumb));
  }
  return true;
}

/** Wipes the vault and everything it protects. Used by "forgot PIN", which
 *  cannot be a recovery flow — there is no key escrow by design. */
export function destroy() {
  lock();
  store.update((s) => {
    s.pe.vault = null;
  });
}
