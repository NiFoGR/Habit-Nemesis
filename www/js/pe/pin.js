// PIN entry: setting one, and unlocking with it. Shared by the gallery and by
// the measurement flow, since both need the vault open to touch photos.

import * as vault from './vault.js';
import * as db from './db.js';
import { escapeHtml, haptic, toast } from '../ui.js';

const PIN_LEN = 6;

/** Renders a keypad. Resolves once the vault is unlocked, or calls onCancel. */
export function renderPinGate(mount, { onReady, onCancel, title }) {
  if (!vault.isAvailable()) {
    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" id="cancel" aria-label="Back">←</button>
          <h1>${escapeHtml(title || 'Private gallery')}</h1>
          <span class="icon-btn ghost"></span>
        </header>
        <div class="empty-state">
          <div class="hero-icon">⚠</div>
          <h2>Encryption unavailable here</h2>
          <p class="muted small">The browser only exposes the crypto it needs for this over HTTPS. Open the app from its installed icon, or over https, and the gallery will work. It deliberately will not store photos without encrypting them.</p>
        </div>
      </div>`;
    mount.querySelector('#cancel').addEventListener('click', () => onCancel?.());
    return;
  }
  const setting = !vault.isSet();
  let entry = '';
  let confirmEntry = null; // holds the first entry while confirming a new PIN
  let busy = false;

  function draw(message = '', error = false) {
    const stage = setting ? (confirmEntry === null ? 'Choose a PIN' : 'Confirm it') : 'Enter your PIN';
    mount.innerHTML = `
      <div class="screen pin-screen">
        <header class="screen-head">
          <button class="icon-btn" id="cancel" aria-label="Back">←</button>
          <h1>${escapeHtml(title || 'Private gallery')}</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <div class="pin-body">
          <div class="pin-lock">🔒</div>
          <h2>${stage}</h2>
          <p class="small muted centre">${setting
            ? 'Photos are encrypted with this PIN. It is not a screen lock — the files themselves are unreadable without it, including to anything else on the phone.'
            : 'Your photos are encrypted. They cannot be shown until this is right.'}</p>

          <div class="pin-dots ${error ? 'shake' : ''}">
            ${Array.from({ length: PIN_LEN }, (_, i) => `<i class="${i < entry.length ? 'on' : ''}"></i>`).join('')}
          </div>
          <p class="pin-msg ${error ? 'err' : ''}">${escapeHtml(message)}</p>

          <div class="keypad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
            <button class="ghost-key" id="forgot">${setting ? '' : 'Forgot'}</button>
            <button data-k="0">0</button>
            <button class="ghost-key" data-del>⌫</button>
          </div>

          ${setting ? `<p class="fineprint centre">There is no recovery. Forgetting the PIN means the photos are gone for good — that is what makes the encryption worth anything.</p>` : ''}
        </div>
      </div>`;

    mount.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => push(b.dataset.k)));
    mount.querySelector('[data-del]').addEventListener('click', () => {
      entry = entry.slice(0, -1);
      draw();
    });
    mount.querySelector('#cancel').addEventListener('click', () => onCancel?.());
    const forgot = mount.querySelector('#forgot');
    if (forgot && !setting) forgot.addEventListener('click', forgotFlow);
  }

  async function push(digit) {
    if (busy || entry.length >= PIN_LEN) return;
    entry += digit;
    haptic('tick');
    draw();
    if (entry.length === PIN_LEN) await submit(); // fixed length, so no confirm key
  }

  async function submit() {
    busy = true;
    if (setting) {
      if (confirmEntry === null) {
        confirmEntry = entry;
        entry = '';
        busy = false;
        draw('Enter it again');
        return;
      }
      if (confirmEntry !== entry) {
        confirmEntry = null;
        entry = '';
        busy = false;
        haptic('miss');
        draw('Those did not match. Start again.', true);
        return;
      }
      await vault.setPin(entry);
      busy = false;
      toast('Gallery secured');
      onReady?.();
      return;
    }
    const ok = await vault.unlock(entry);
    busy = false;
    if (ok) {
      onReady?.();
    } else {
      entry = '';
      haptic('miss');
      draw('Wrong PIN', true);
    }
  }

  async function forgotFlow() {
    if (!confirm('There is no way to recover the PIN — the photos are encrypted with it.\n\nErase the gallery and start over? Your measurements and graphs are kept.')) return;
    await db.clear();
    vault.destroy();
    toast('Gallery erased');
    location.reload();
  }

  draw();
}

/** Runs `fn` with the vault open, prompting for the PIN first if needed. */
export function withVault(mount, { onReady, onCancel, title }) {
  if (vault.isUnlocked()) {
    vault.armAutoLock();
    onReady();
    return;
  }
  renderPinGate(mount, { onReady, onCancel, title });
}
