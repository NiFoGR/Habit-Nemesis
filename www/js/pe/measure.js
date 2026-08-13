// The monthly check-in: measurements plus an optional progress photo.
//
// Measurement technique matters more than anything else on this screen. A
// half-centimetre of inconsistent bone-pressing swamps a month of real change,
// so the form nags about method rather than assuming it.

import * as store from '../store.js';
import * as pe from './program.js';
import * as db from './db.js';
import * as vault from './vault.js';
import { withVault } from './pin.js';
import { icon } from '../icons.js';
import { escapeHtml, toast, haptic } from '../ui.js';

const FIELDS = [
  { key: 'bpel', label: 'Erect length, bone-pressed', short: 'BPEL', required: true, help: 'Ruler hard into the pubic bone, along the top.' },
  { key: 'eg', label: 'Erect girth', short: 'EG', required: true, help: 'Mid-shaft, same spot every month.' },
  { key: 'bpfsl', label: 'Flaccid stretched, bone-pressed', short: 'BPFSL', help: 'Optional. Moves before erect length does.' },
  { key: 'nbpel', label: 'Non-bone-pressed length', short: 'NBPEL', help: 'Optional. Moves with body fat.' },
  { key: 'baseGirth', label: 'Base girth', short: 'Base', help: 'Optional.' },
];

export function renderMeasure(mount) {
  const state = store.get();
  const s = state.pe.settings;
  const units = s.units;
  const history = state.pe.measurements;
  const last = history[history.length - 1];
  const first = history[0];
  let photo = null; // { full, thumb, previewUrl }

  // Typed values are cached outside the DOM, so a re-render (adding a photo,
  // for instance) never throws away numbers the user has already entered.
  const entered = {};
  const notesRef = { value: '' };

  function syncFromDom() {
    for (const f of FIELDS) {
      const el = mount.querySelector('#f_' + f.key);
      if (el) entered[f.key] = el.value;
    }
    const n = mount.querySelector('#notes');
    if (n) notesRef.value = n.value;
  }

  function fieldValue(key) {
    if (entered[key] != null) return entered[key];
    return last && last[key] ? pe.toDisplayLength(last[key], units).toFixed(1) : '';
  }

  function draw() {
    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" data-nav="pe" aria-label="Back">${icon('back')}</button>
          <h1>Monthly check-in</h1>
          <span class="icon-btn ghost"></span>
        </header>

        ${last ? `<div class="notice">Last: ${pe.fmtLength(last.bpel)} × ${pe.fmtLength(last.eg)} on ${new Date(last.ts).toLocaleDateString()}. Same time of day, same method.</div>`
          : '<div class="notice">Your baseline. Everything else is measured from this.</div>'}

        <section class="card">
          <h2>Measurements <span class="tag">${escapeHtml(units)}</span></h2>
          ${FIELDS.map(
            (f) => `<div class="field">
              <label for="f_${f.key}"><b>${escapeHtml(f.short)}</b> — ${escapeHtml(f.label)}${f.required ? '' : ' <em>(optional)</em>'}</label>
              <div class="measure-row">
                <input type="number" inputmode="decimal" step="0.1" id="f_${f.key}" value="${escapeHtml(fieldValue(f.key))}" placeholder="${last && last[f.key] ? pe.toDisplayLength(last[f.key], units).toFixed(1) : '0.0'}">
                <span>${escapeHtml(units)}</span>
              </div>
              <p class="fineprint">${escapeHtml(f.help)}</p>
            </div>`
          ).join('')}
        </section>

        <section class="card">
          <h2>Progress photo <span class="tag">optional</span></h2>
          <p class="small muted">Same angle and distance each month. Encrypted on this device.</p>
          <div id="photoSlot">${photoSlot()}</div>
          <input type="file" id="file" accept="image/*" capture="environment" hidden>
        </section>

        <section class="card">
          <h2>Notes</h2>
          <textarea id="notes" class="notes" rows="2" placeholder="Anything worth remembering about this month">${escapeHtml(notesRef.value)}</textarea>
        </section>

        <button class="btn primary big" id="save">Save check-in</button>
        <button class="btn ghost" data-nav="pe">Cancel</button>
      </div>`;

    wirePhoto();
    mount.querySelector('#save').addEventListener('click', save);
  }

  function photoSlot() {
    return photo
      ? `<div class="photo-preview"><img src="${photo.previewUrl}" alt="Selected photo"><button class="btn ghost" id="removePhoto">Remove photo</button></div>`
      : '<button class="btn" id="pick">Take or choose a photo</button>';
  }

  /** Only the photo slot is redrawn when a picture is added or removed — the
   *  rest of the form, and anything typed into it, is left alone. */
  function wirePhoto() {
    const file = mount.querySelector('#file');
    const slot = mount.querySelector('#photoSlot');
    const refresh = () => {
      slot.innerHTML = photoSlot();
      wirePhotoButtons();
    };

    function wirePhotoButtons() {
      slot.querySelector('#pick')?.addEventListener('click', () => file.click());
      slot.querySelector('#removePhoto')?.addEventListener('click', () => {
        URL.revokeObjectURL(photo.previewUrl);
        photo = null;
        refresh();
      });
    }
    wirePhotoButtons();

    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        toast('Processing photo…');
        const out = await db.processImage(f);
        photo = { ...out, previewUrl: URL.createObjectURL(out.thumb) };
        refresh();
      } catch (err) {
        toast(err.message);
      }
    });
  }

  // Anything outside this is a typo or the wrong unit, and it would clamp
  // strangely once stored rather than being caught here.
  const MIN_CM = 1;
  const MAX_CM = 60;

  function readFields() {
    syncFromDom();
    const out = {};
    for (const f of FIELDS) {
      const raw = entered[f.key];
      const n = raw === '' || raw == null ? NaN : Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        out[f.key] = null;
        continue;
      }
      const cm = pe.fromDisplayLength(n, units);
      out[f.key] = cm >= MIN_CM && cm <= MAX_CM ? cm : NaN; // NaN marks "out of range"
    }
    return out;
  }

  async function save() {
    const values = readFields();
    const badField = Object.entries(values).find(([, v]) => Number.isNaN(v));
    if (badField) {
      toast(`That ${badField[0].toUpperCase()} value is out of range — check the number and the units.`);
      return;
    }
    if (!values.bpel || !values.eg) {
      toast('Length and girth are both needed');
      return;
    }
    // A jump this big is almost always a typo or a different method, not a
    // month of growth. Worth one question before it poisons every chart.
    if (last && last.bpel && Math.abs(values.bpel - last.bpel) > 1.5) {
      const dir = values.bpel > last.bpel ? 'more' : 'less';
      if (!confirm(`Over 1.5 cm ${dir} than last month — usually a typo or a different method. Save anyway?`)) return;
    }

    const notes = notesRef.value.trim().slice(0, 500);

    const commit = async (photoId) => {
      const record = {
        id: `m_${Date.now()}`,
        ts: Date.now(),
        date: store.dayKey(),
        ...values,
        photoId,
        notes,
      };
      const st = store.get();
      st.pe.measurements.push(record);
      st.pe.measurements.sort((a, b) => a.ts - b.ts);
      if (values.bpel > st.pe.prs.bpel) st.pe.prs.bpel = values.bpel;
      if (values.eg > st.pe.prs.eg) st.pe.prs.eg = values.eg;
      if (values.bpfsl && values.bpfsl > st.pe.prs.bpfsl) st.pe.prs.bpfsl = values.bpfsl;
      const earned = pe.checkAchievements(st);
      store.save();
      haptic('level');
      renderResult(record, earned);
    };

    if (!photo) return commit(null);

    // Photos need the vault open; measurements alone do not.
    withVault(mount, {
      title: 'Secure the photo',
      onCancel: () => {
        draw();
        toast('Saved without the photo? Tap save again to store just the numbers.');
      },
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
          draw();
        }
      },
    });
  }

  /* ---------------- result ---------------- */

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

  draw();
}
