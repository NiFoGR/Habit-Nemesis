// The monthly check-in, one measurement per screen.
//
// Five measurements, all required. Method inconsistency swamps real change, so
// each step shows a diagram and the exact method rather than putting five bare
// inputs on one page and hoping.

import * as store from '../store.js';
import * as pe from './program.js';
import * as db from './db.js';
import * as vault from './vault.js';
import { withVault } from './pin.js';
import { captureWithGhost } from './camera.js';
import { icon } from '../icons.js';
import { escapeHtml, toast, haptic } from '../ui.js';
import { leaveTo } from '../back.js';

/* Schematic diagrams. Deliberately abstract, a shaft as a rounded bar, the
   pubic bone as a wall, a tape as a ring, so they read instantly at phone
   size and are unambiguous about *where* to measure. */
const DIAGRAMS = {
  lengthFromBone: (label) => `
    <svg viewBox="0 0 220 90" class="diag" aria-hidden="true">
      <rect x="6" y="18" width="10" height="54" rx="3" class="d-bone"/>
      <text x="11" y="86" class="d-lab" text-anchor="middle">bone</text>
      <rect x="16" y="34" width="150" height="22" rx="11" class="d-shaft"/>
      <path d="M16 24h150" class="d-dim"/>
      <path d="M16 20v8M166 20v8" class="d-dim"/>
      <text x="91" y="16" class="d-lab" text-anchor="middle">${label}</text>
    </svg>`,
  lengthFromSkin: (label) => `
    <svg viewBox="0 0 220 90" class="diag" aria-hidden="true">
      <rect x="6" y="18" width="10" height="54" rx="3" class="d-bone"/>
      <rect x="16" y="30" width="26" height="30" rx="6" class="d-fat"/>
      <text x="29" y="86" class="d-lab" text-anchor="middle">fat pad</text>
      <rect x="42" y="34" width="124" height="22" rx="11" class="d-shaft"/>
      <path d="M42 24h124" class="d-dim"/>
      <path d="M42 20v8M166 20v8" class="d-dim"/>
      <text x="104" y="16" class="d-lab" text-anchor="middle">${label}</text>
    </svg>`,
  girth: (where) => `
    <svg viewBox="0 0 220 90" class="diag" aria-hidden="true">
      <rect x="6" y="18" width="10" height="54" rx="3" class="d-bone"/>
      <rect x="16" y="34" width="150" height="22" rx="11" class="d-shaft"/>
      <ellipse cx="${where === 'base' ? 30 : 100}" cy="45" rx="9" ry="19" class="d-tape"/>
      <text x="${where === 'base' ? 30 : 100}" y="82" class="d-lab" text-anchor="middle">${where === 'base' ? 'at the base' : 'thickest point'}</text>
    </svg>`,
  stretched: () => `
    <svg viewBox="0 0 220 90" class="diag" aria-hidden="true">
      <rect x="6" y="18" width="10" height="54" rx="3" class="d-bone"/>
      <rect x="16" y="34" width="170" height="22" rx="11" class="d-shaft"/>
      <path d="M186 45h22M198 38l10 7-10 7" class="d-pull"/>
      <path d="M16 24h170" class="d-dim"/>
      <path d="M16 20v8M186 20v8" class="d-dim"/>
      <text x="101" y="16" class="d-lab" text-anchor="middle">pulled to a firm stretch</text>
    </svg>`,
};

const STEPS = [
  {
    key: 'bpfsl',
    short: 'BPFSL',
    title: 'Flaccid stretched length',
    diagram: DIAGRAMS.stretched(),
    how: 'Flaccid. Ruler pressed hard into the pubic bone, pull to a firm stretch along the top, measure to the tip.',
    why: 'Moves before erect length does, so it is your earliest signal.',
  },
  {
    key: 'bpel',
    short: 'BPEL',
    title: 'Erect length, bone-pressed',
    diagram: DIAGRAMS.lengthFromBone('bone to tip'),
    how: 'Fully erect. Ruler pressed hard into the pubic bone until it stops, along the top of the shaft, measure to the tip.',
    why: 'The headline number. Everything else is judged against this.',
  },
  {
    key: 'nbpel',
    short: 'NBPEL',
    title: 'Erect length, non-bone-pressed',
    diagram: DIAGRAMS.lengthFromSkin('skin to tip'),
    how: 'Same erection, but rest the ruler on the skin without pressing in.',
    why: 'The difference between this and BPEL is your fat pad. Useful, but it moves with body weight rather than growth.',
  },
  {
    key: 'eg',
    short: 'Girth, thickest',
    title: 'Erect girth at the thickest point',
    diagram: DIAGRAMS.girth('thick'),
    how: 'Tape around the thickest part of the shaft. Snug, not compressing. Note where it is so you use the same spot next month.',
    why: 'Where pumping and jelq-style work shows up first.',
  },
  {
    key: 'baseGirth',
    short: 'Girth, base',
    title: 'Erect girth at the base',
    diagram: DIAGRAMS.girth('base'),
    how: 'Tape right at the very bottom, against the body.',
    why: 'The base often changes independently of mid-shaft, so tracking both shows the shape of the change.',
  },
];

const MIN_CM = 1;
const MAX_CM = 60;

export function renderMeasure(mount) {
  const state = store.get();
  const s = state.pe.settings;
  const units = s.units;
  const history = state.pe.measurements;
  const last = history[history.length - 1];
  const first = history[0];

  const values = {}; // display units, as typed
  let photo = null;
  let notes = '';
  let step = 0; // 0..STEPS.length-1, then photo, then review

  const PHOTO_STEP = STEPS.length;
  const REVIEW_STEP = STEPS.length + 1;

  const toCm = (v) => pe.fromDisplayLength(Number(v), units);
  const valid = (k) => {
    const raw = values[k];
    if (raw === '' || raw == null) return false;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return false;
    const cm = toCm(raw);
    return cm >= MIN_CM && cm <= MAX_CM;
  };

  /* ---------------- measurement steps ---------------- */

  function drawStep() {
    const def = STEPS[step];
    const prev = last && last[def.key] != null ? pe.toDisplayLength(last[def.key], units).toFixed(1) : null;
    const ok = valid(def.key);

    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <h1>${step + 1} of ${STEPS.length + 1}</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <div class="step-bar">${STEPS.concat([{}]).map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}"></i>`).join('')}</div>

        <h2 class="step-title">${escapeHtml(def.title)}</h2>
        <div class="diag-wrap">${def.diagram}</div>

        <section class="card">
          <p class="small"><b>How:</b> ${escapeHtml(def.how)}</p>
          <p class="small muted"><b>Why:</b> ${escapeHtml(def.why)}</p>
        </section>

        <div class="measure-row big-input">
          <input type="number" inputmode="decimal" step="0.1" id="val"
                 value="${escapeHtml(values[def.key] ?? '')}" placeholder="${prev ?? '0.0'}" autofocus>
          <span>${escapeHtml(units)}</span>
        </div>
        ${prev ? `<p class="small muted centre">Last month: ${prev} ${escapeHtml(units)}</p>` : ''}
        <p class="err-line" id="err"></p>

        <button class="btn primary big" id="next" ${ok ? '' : 'disabled'}>
          ${step === STEPS.length - 1 ? 'Photo' : 'Next'}
        </button>
      </div>`;

    const input = mount.querySelector('#val');
    const next = mount.querySelector('#next');
    const err = mount.querySelector('#err');

    input.addEventListener('input', () => {
      values[def.key] = input.value;
      const n = Number(input.value);
      let msg = '';
      if (input.value !== '' && Number.isFinite(n) && n > 0) {
        const cm = toCm(input.value);
        if (cm < MIN_CM || cm > MAX_CM) msg = `Outside a plausible range. Check the number and the units.`;
        else if (last && last[def.key] && Math.abs(cm - last[def.key]) > 1.5) msg = 'Over 1.5 cm from last month. Real change is millimetres. Check the method.';
      }
      err.textContent = msg;
      err.className = msg.startsWith('That is outside') ? 'err-line bad' : 'err-line warn';
      next.disabled = !valid(def.key);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && valid(def.key)) next.click();
    });

    mount.querySelector('#back').addEventListener('click', () => {
      if (step === 0) return leaveTo('#/pe');
      step--;
      drawStep();
    });
    next.addEventListener('click', () => {
      if (!valid(def.key)) return;
      haptic('tick');
      step++;
      if (step === PHOTO_STEP) drawPhoto();
      else drawStep();
    });
  }

  /* ---------------- photo step ---------------- */

  async function lastPhotoBlob() {
    const withPhoto = [...history].reverse().find((m) => m.photoId);
    if (!withPhoto || !vault.isUnlocked()) return null;
    try {
      const rec = await db.get(withPhoto.photoId);
      return rec ? await vault.decryptBlob(rec.full) : null;
    } catch {
      return null;
    }
  }

  function drawPhoto() {
    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <h1>${STEPS.length + 1} of ${STEPS.length + 1}</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <div class="step-bar">${STEPS.concat([{}]).map((_, i) => `<i class="${i < PHOTO_STEP ? 'done' : 'now'}"></i>`).join('')}</div>

        <h2 class="step-title">Progress photo</h2>
        <section class="card">
          <p class="small muted">Optional, but it is the only record that shows shape rather than numbers. Shot against a ghost of last month's photo so the series stays comparable, and encrypted on this device.</p>
        </section>

        <div id="slot">${photo ? `<div class="photo-preview"><img src="${photo.previewUrl}" alt=""><button class="btn ghost" id="remove">Remove</button></div>` : ''}</div>

        <button class="btn ${photo ? '' : 'primary'} big" id="shoot">${icon('camera', 18)}<span>${photo ? 'Retake' : 'Take photo'}</span></button>
        <button class="btn ${photo ? 'primary big' : 'ghost'}" id="next">${photo ? 'Review' : 'Skip photo'}</button>
      </div>`;

    mount.querySelector('#back').addEventListener('click', () => {
      step = STEPS.length - 1;
      drawStep();
    });
    mount.querySelector('#remove')?.addEventListener('click', () => {
      URL.revokeObjectURL(photo.previewUrl);
      photo = null;
      drawPhoto();
    });
    mount.querySelector('#next').addEventListener('click', () => {
      step = REVIEW_STEP;
      drawReview();
    });

    mount.querySelector('#shoot').addEventListener('click', () => {
      // The ghost needs the vault open, since last month's photo is encrypted.
      const go = async () => {
        const ghost = await lastPhotoBlob();
        captureWithGhost(
          mount,
          ghost,
          (out) => {
            photo = { ...out, previewUrl: URL.createObjectURL(out.thumb) };
            drawPhoto();
          },
          () => drawPhoto()
        );
      };
      if (vault.isSet() && !vault.isUnlocked()) {
        withVault(mount, { title: 'Unlock to overlay', onReady: go, onCancel: () => drawPhoto() });
      } else {
        go();
      }
    });
  }

  /* ---------------- review + save ---------------- */

  function drawReview() {
    const rows = STEPS.map((d) => {
      const cm = toCm(values[d.key]);
      const prev = last && last[d.key] != null ? last[d.key] : null;
      const delta = prev != null ? cm - prev : null;
      return `<div class="kv">
        <span>${escapeHtml(d.short)}</span>
        <b>${pe.fmtLength(cm)}${delta != null ? ` <em class="${delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : ''}">${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}</em>` : ''}</b>
      </div>`;
    }).join('');

    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <h1>Review</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <section class="card">${rows}</section>

        ${photo ? `<div class="photo-preview small-pv"><img src="${photo.previewUrl}" alt=""></div>` : ''}

        <section class="card">
          <textarea id="notes" class="notes" rows="2" placeholder="Notes (optional)">${escapeHtml(notes)}</textarea>
        </section>

        <button class="btn primary big" id="save">Save check-in</button>
      </div>`;

    mount.querySelector('#back').addEventListener('click', () => {
      step = PHOTO_STEP;
      drawPhoto();
    });
    mount.querySelector('#save').addEventListener('click', () => {
      notes = mount.querySelector('#notes').value.trim().slice(0, 500);
      save();
    });
  }

  function save() {
    const cmValues = {};
    for (const d of STEPS) cmValues[d.key] = toCm(values[d.key]);

    const commit = async (photoId) => {
      const record = {
        id: `m_${Date.now()}`,
        ts: Date.now(),
        date: store.dayKey(),
        ...cmValues,
        photoId,
        notes,
      };
      const st = store.get();
      st.pe.measurements.push(record);
      st.pe.measurements.sort((a, b) => a.ts - b.ts);
      if (cmValues.bpel > st.pe.prs.bpel) st.pe.prs.bpel = cmValues.bpel;
      if (cmValues.eg > st.pe.prs.eg) st.pe.prs.eg = cmValues.eg;
      if (cmValues.bpfsl > st.pe.prs.bpfsl) st.pe.prs.bpfsl = cmValues.bpfsl;
      const earned = pe.checkAchievements(st);
      store.save();
      haptic('level');
      renderResult(record, earned);
    };

    if (!photo) return commit(null);

    withVault(mount, {
      title: 'Secure the photo',
      onCancel: () => drawReview(),
      onReady: async () => {
        try {
          const id = `p_${Date.now()}`;
          await db.requestPersistence();
          const full = await vault.encryptBlob(photo.full);
          const thumb = await vault.encryptBlob(photo.thumb);
          await db.put({ id, ts: Date.now(), full, thumb, width: photo.width, height: photo.height });
          await commit(id);
        } catch (err) {
          toast(`Could not save the photo: ${err.message}`);
          drawReview();
        }
      },
    });
  }

  function renderResult(record, earned) {
    const dLast = last ? { bpel: record.bpel - last.bpel, eg: record.eg - last.eg } : null;
    const dFirst = first ? { bpel: record.bpel - first.bpel, eg: record.eg - first.eg } : null;
    const proj = pe.projection();
    const months = first ? Math.max(1, Math.round((record.ts - first.ts) / (30.44 * 864e5))) : 0;
    const delta = (v) => `${v >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(v), store.get().pe.settings.units, 2)}`;

    mount.innerHTML = `
      <div class="report">
        <div class="report-hero">
          <h1>${pe.fmtLength(record.bpel)} × ${pe.fmtLength(record.eg)}</h1>
          <p class="muted">${new Date(record.ts).toLocaleDateString()}${record.photoId ? ' · photo encrypted' : ''}</p>
        </div>

        ${dLast ? `<div class="stat-grid">
          <div class="stat"><b>${delta(dLast.bpel)}</b><span>length vs last</span></div>
          <div class="stat"><b>${delta(dLast.eg)}</b><span>girth vs last</span></div>
        </div>` : ''}

        ${dFirst && months >= 1 ? `<section class="card">
          <div class="kv"><span>Since start (${months}mo)</span><b>${delta(dFirst.bpel)} · ${delta(dFirst.eg)}</b></div>
          ${dFirst.bpel > 0 ? `<div class="kv"><span>Rate</span><b>${((dFirst.bpel / months) * 10).toFixed(1)} mm/month</b></div>` : ''}
        </section>` : ''}

        ${proj && proj.points.length ? `<section class="card">
          ${proj.points.slice(0, 2).map((p) => `<div class="kv"><span>In ${p.months} months</span><b>${pe.fmtLength(p.bpelLow, undefined, 1)} – ${pe.fmtLength(p.bpelHigh, undefined, 1)}</b></div>`).join('')}
          <p class="fineprint">Estimate from ${escapeHtml(proj.basis)}.</p>
        </section>` : ''}

        ${earned.length ? `<section class="card">
          ${earned.map((a) => `<div class="pr-row"><b>${icon('medal', 16)} ${escapeHtml(a.name)}</b><span>${escapeHtml(a.desc)}</span></div>`).join('')}
        </section>` : ''}

        <button class="btn primary big" data-nav="pe-stats">Progress</button>
        <button class="btn ghost" data-nav="pe">Done</button>
      </div>`;
  }

  drawStep();
}
