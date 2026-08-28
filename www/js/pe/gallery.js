// The private gallery: encrypted progress photos, with a side-by-side compare
// that pairs each photo with the measurements taken the same day.

import * as store from '../store.js';
import * as pe from './program.js';
import * as db from './db.js';
import * as vault from './vault.js';
import { withVault } from './pin.js';
import { icon } from '../icons.js';
import { escapeHtml, toast, saveFile } from '../ui.js';
import { leaveTo, replaceWith } from '../back.js';

let urls = []; // object URLs to revoke when leaving

function releaseUrls() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}

const track = (url) => {
  urls.push(url);
  return url;
};

export function renderGallery(mount) {
  releaseUrls();
  withVault(mount, {
    title: 'Private gallery',
    onCancel: () => leaveTo('#/pe'),
    onReady: () => grid(mount),
  });
}

const fmtBytes = (b) => (b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

function measurementFor(photoId) {
  return store.get().pe.measurements.find((m) => m.photoId === photoId) || null;
}

async function grid(mount) {
  vault.armAutoLock();
  const items = await db.all();
  const { count, bytes } = await db.usage();
  let compare = [];

  const card = (it) => {
    const m = measurementFor(it.id);
    const date = new Date(it.ts);
    return `<button class="gal-item" data-id="${it.id}">
      <img data-thumb="${it.id}" alt="">
      <div class="gal-meta">
        <b>${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</b>
        ${m ? `<span>${pe.fmtLength(m.bpel)} × ${pe.fmtLength(m.eg)}</span>` : '<span>no measurements</span>'}
      </div>
      <i class="gal-check"></i>
    </button>`;
  };

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="pe" aria-label="Back">${icon('back')}</button>
        <h1>Gallery</h1>
        <button class="icon-btn" id="lock" aria-label="Lock now">${icon('lock')}</button>
      </header>

      ${items.length ? `
        <div class="gal-toolbar">
          <span class="small muted">${count} photo${count === 1 ? '' : 's'} · ${fmtBytes(bytes)} · encrypted on this device</span>
          <button class="btn ghost small-btn" id="compareBtn">Compare</button>
        </div>
        <div class="gal-grid" id="grid">${items.map(card).join('')}</div>
      ` : `
        <div class="empty-state">
          <div class="hero-icon">${icon('lock', 40)}</div>
          <h2>No photos yet</h2>
          <p class="muted small">Photos are added as part of the monthly check-in, so each one is stored alongside the measurements from the same day.</p>
          <button class="btn primary" data-nav="pe-measure">Do a check-in</button>
        </div>
      `}

      <section class="card">
        <h2>How this is protected</h2>
        <p class="small muted">Each photo is encrypted with AES-GCM using a key derived from your PIN, and only decrypted in memory while you are looking at it. The gallery re-locks after ${store.get().pe.settings.autoLockMin} minutes of inactivity, and losing the PIN means losing the photos. There is no recovery key.</p>
        <button class="btn ghost" id="changePin">Change PIN</button>
      </section>
    </div>`;

  // Thumbnails are decrypted one at a time so a big gallery does not stall.
  for (const it of items) {
    try {
      const blob = await vault.decryptBlob(it.thumb);
      const img = mount.querySelector(`[data-thumb="${it.id}"]`);
      if (img) img.src = track(URL.createObjectURL(blob));
    } catch {
      /* a photo that will not decrypt is skipped rather than breaking the grid */
    }
  }

  mount.querySelector('#lock')?.addEventListener('click', () => {
    vault.lock();
    releaseUrls();
    // Locking on purpose should not leave the unlocked gallery one Back away.
    replaceWith('#/pe');
  });

  mount.querySelector('#compareBtn')?.addEventListener('click', () => {
    compare = [];
    mount.querySelector('#grid').classList.toggle('comparing');
    toast('Pick two photos to compare');
  });

  mount.querySelectorAll('.gal-item').forEach((b) =>
    b.addEventListener('click', () => {
      const gridEl = mount.querySelector('#grid');
      if (!gridEl.classList.contains('comparing')) return viewer(mount, b.dataset.id, items);
      const id = b.dataset.id;
      const i = compare.indexOf(id);
      if (i >= 0) compare.splice(i, 1);
      else compare.push(id);
      if (compare.length > 2) compare.shift();
      mount.querySelectorAll('.gal-item').forEach((x) => x.classList.toggle('picked', compare.includes(x.dataset.id)));
      if (compare.length === 2) compareView(mount, compare, items);
    })
  );

  mount.querySelector('#changePin')?.addEventListener('click', () => changePinFlow(mount));
}

async function viewer(mount, id, items) {
  vault.armAutoLock();
  const it = items.find((x) => x.id === id);
  const m = measurementFor(id);
  const blob = await vault.decryptBlob(it.full);
  const url = track(URL.createObjectURL(blob));
  const date = new Date(it.ts);

  mount.innerHTML = `
    <div class="screen viewer">
      <header class="screen-head">
        <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
        <h1>${date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</h1>
        <button class="icon-btn" id="del" aria-label="Delete">${icon('close')}</button>
      </header>
      <img class="viewer-img" src="${url}" alt="">
      ${m ? `<div class="stat-grid">
        <div class="stat"><b>${pe.fmtLength(m.bpel)}</b><span>BPEL</span></div>
        <div class="stat"><b>${pe.fmtLength(m.eg)}</b><span>Girth</span></div>
        ${m.bpfsl ? `<div class="stat"><b>${pe.fmtLength(m.bpfsl)}</b><span>BPFSL</span></div>` : ''}
        ${m.notes ? `<div class="stat wide"><b class="note-text">${escapeHtml(m.notes)}</b><span>note</span></div>` : ''}
      </div>` : '<p class="muted small centre">No measurements were saved with this photo.</p>'}
      <button class="btn ghost" id="save">Save a decrypted copy to the phone</button>
      <p class="fineprint centre">A saved copy leaves the vault and lands in your normal photo storage, unencrypted.</p>
    </div>`;

  mount.querySelector('#back').addEventListener('click', () => grid(mount));
  // The decrypted bytes, not the object URL. saveFile's share route needs real
  // content to build a File from, and a blob: URL means nothing outside this
  // page; `blob` is already here, so there is nothing to fetch back.
  mount.querySelector('#save').addEventListener('click', () => {
    saveFile(`nifo-${store.dayKey(new Date(it.ts))}.jpg`, blob, 'image/jpeg');
  });
  mount.querySelector('#del').addEventListener('click', async () => {
    if (!confirm('Delete this photo? The measurements from that day are kept.')) return;
    await db.remove(id);
    store.update((s) => {
      const rec = s.pe.measurements.find((x) => x.photoId === id);
      if (rec) rec.photoId = null;
    });
    toast('Photo deleted');
    grid(mount);
  });
}

async function compareView(mount, ids, items) {
  vault.armAutoLock();
  const picked = ids.map((id) => items.find((x) => x.id === id)).sort((a, b) => a.ts - b.ts);
  const blobs = await Promise.all(picked.map((p) => vault.decryptBlob(p.full)));
  const ms = picked.map((p) => measurementFor(p.id));
  const months = (picked[1].ts - picked[0].ts) / (30.44 * 864e5);

  const dl = ms[0] && ms[1] ? ms[1].bpel - ms[0].bpel : null;
  const dg = ms[0] && ms[1] ? ms[1].eg - ms[0].eg : null;
  const sign = (v) => `${v >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(v), undefined, 2)}`;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
        <h1>Compare</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="compare-grid">
        ${picked.map((p, i) => `<figure>
          <img src="${track(URL.createObjectURL(blobs[i]))}" alt="">
          <figcaption>
            <b>${new Date(p.ts).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</b>
            ${ms[i] ? `<span>${pe.fmtLength(ms[i].bpel)} × ${pe.fmtLength(ms[i].eg)}</span>` : ''}
          </figcaption>
        </figure>`).join('')}
      </div>

      ${dl != null ? `<section class="card">
        <h2>Over ${months < 1.5 ? 'about a month' : `${Math.round(months)} months`}</h2>
        <div class="kv"><span>Length</span><b class="${dl > 0 ? 'good-text' : ''}">${sign(dl)}</b></div>
        <div class="kv"><span>Girth</span><b class="${dg > 0 ? 'good-text' : ''}">${sign(dg)}</b></div>
        <p class="small muted">Photos are useful for morale and useless as measurement. Angle, lighting and erection quality move the apparent size far more than a month of training does. Trust the numbers, enjoy the pictures.</p>
      </section>` : ''}

      <button class="btn ghost" id="back2">Back to gallery</button>
    </div>`;

  mount.querySelector('#back').addEventListener('click', () => grid(mount));
  mount.querySelector('#back2').addEventListener('click', () => grid(mount));
}

async function changePinFlow(mount) {
  const oldPin = prompt('Current PIN');
  if (!oldPin) return;
  const newPin = prompt('New PIN (6 digits)');
  if (!newPin || newPin.length < 4) return toast('PIN must be at least 4 digits');
  toast('Re-encrypting photos…');
  try {
    const ok = await vault.changePin(oldPin, newPin, {
      read: () => db.all(),
      write: async (id, full, thumb) => {
        const rec = await db.get(id);
        await db.put({ ...rec, full, thumb });
      },
    });
    toast(ok ? 'PIN changed' : 'That was not the right PIN');
    if (ok) grid(mount);
  } catch (err) {
    toast(`Could not change the PIN: ${err.message}`);
  }
}

export function leaveGallery() {
  releaseUrls();
}
