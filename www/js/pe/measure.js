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
import { escapeHtml, toast, haptic } from '../ui.js';

const FIELDS = [
  { key: 'bpel', label: 'Bone-pressed erect length', short: 'BPEL', required: true, help: 'Ruler pressed firmly into the pubic bone, along the top of the shaft, fully erect. This is the measurement everything else is judged against.' },
  { key: 'eg', label: 'Erect girth', short: 'EG', required: true, help: 'Circumference at mid-shaft, tape snug but not compressing. Use the same spot every month.' },
  { key: 'bpfsl', label: 'Bone-pressed flaccid stretched length', short: 'BPFSL', help: 'Flaccid, pulled to a firm stretch. Often moves before erect length does — an early indicator.' },
  { key: 'nbpel', label: 'Non-bone-pressed length', short: 'NBPEL', help: 'From the skin surface. Changes with fat pad, so it is the least reliable number here.' },
  { key: 'baseGirth', label: 'Base girth', short: 'Base', help: 'Optional. Pumping tends to show up here first.' },
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
          <button class="icon-btn" data-nav="pe" aria-label="Back">←</button>
          <h1>Monthly check-in</h1>
          <span class="icon-btn ghost"></span>
        </header>

        ${last ? `<div class="notice">Last check-in ${new Date(last.ts).toLocaleDateString()} — ${pe.fmtLength(last.bpel)} × ${pe.fmtLength(last.eg)}. Measure in the same conditions: same time of day, same erection quality, same ruler.</div>`
          : `<div class="notice">This is your baseline. Everything the app tells you later is measured from these numbers, so take your time and be honest with them.</div>`}

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
          <p class="small muted">Erect, same angle, same distance, same lighting each month — ideally with a ruler in frame. Photos are encrypted on this device with your gallery PIN and never leave it.</p>
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
      if (!confirm(`That is over 1.5 cm ${dir} than last month. Real change is a few millimetres a month — this usually means a different measuring method or a typo.\n\nSave it anyway?`)) return;
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
          <div class="hero-icon">📏</div>
          <h1>Check-in saved</h1>
          <p class="muted">${new Date(record.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div class="stat-grid">
          <div class="stat"><b>${pe.fmtLength(record.bpel)}</b><span>BPEL</span>${dLast ? `<i class="d ${dLast.bpel > 0.01 ? 'up' : dLast.bpel < -0.01 ? 'down' : 'flat'}">${delta(dLast.bpel)} since last</i>` : ''}</div>
          <div class="stat"><b>${pe.fmtLength(record.eg)}</b><span>Girth</span>${dLast ? `<i class="d ${dLast.eg > 0.01 ? 'up' : dLast.eg < -0.01 ? 'down' : 'flat'}">${delta(dLast.eg)} since last</i>` : ''}</div>
          ${record.bpfsl ? `<div class="stat"><b>${pe.fmtLength(record.bpfsl)}</b><span>BPFSL</span></div>` : ''}
          ${record.photoId ? '<div class="stat"><b>🔒</b><span>photo encrypted</span></div>' : ''}
        </div>

        ${dFirst && months >= 1 ? `<section class="card">
          <h2>Since you started</h2>
          <div class="kv"><span>Length</span><b>${delta(dFirst.bpel)} over ${months} month${months === 1 ? '' : 's'}</b></div>
          <div class="kv"><span>Girth</span><b>${delta(dFirst.eg)}</b></div>
          <p class="small muted">${dFirst.bpel > 0
            ? `That works out at ${((dFirst.bpel / months) * 10).toFixed(1)} mm a month. For context, the traction trials that produced measurable results averaged roughly 1.5 cm over 3-6 months.`
            : 'Flat so far. Over a couple of months that is expected — measurement noise is larger than real monthly change, which is why the trend line matters more than any single reading.'}</p>
        </section>` : ''}

        ${proj && proj.points.length ? `<section class="card">
          <h2>Where this points</h2>
          ${proj.points.map((p) => `<div class="kv"><span>In ${p.months} months</span><b>${pe.fmtLength(p.bpelLow, undefined, 1)} – ${pe.fmtLength(p.bpelHigh, undefined, 1)}</b></div>`).join('')}
          <p class="small muted">A projection from ${escapeHtml(proj.basis)}, not a promise. It moves every time you log a session or a measurement.</p>
        </section>` : ''}

        ${earned.length ? `<section class="card">
          <h2>Unlocked</h2>
          ${earned.map((a) => `<div class="pr-row"><b>🏅 ${escapeHtml(a.name)}</b><span>${escapeHtml(a.desc)}</span></div>`).join('')}
        </section>` : ''}

        <div class="motivation">${escapeHtml(
          dFirst && dFirst.bpel > 0.2
            ? `${delta(dFirst.bpel)} of bone-pressed length since your first entry. That is not noise — that is the thing you have been putting the hours in for.`
            : 'One data point is a number; twelve is a trend line. The value of this check-in is that it makes next month\'s mean something.'
        )}</div>

        <button class="btn primary big" data-nav="pe-stats">See the graphs</button>
        ${record.photoId ? '<button class="btn ghost" data-nav="pe-gallery">Open the gallery</button>' : ''}
        <button class="btn ghost" data-nav="pe">Back</button>
      </div>`;
  }

  draw();
}
