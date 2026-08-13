// Technique and safety reference. Kept blunt and specific — vague warnings get
// ignored, and the failure modes here are avoidable and well documented.

import * as store from '../store.js';
import * as pe from './program.js';
import { escapeHtml } from '../ui.js';

export function renderPeGuide(mount) {
  const s = store.get().pe.settings;
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="pe" aria-label="Back">←</button>
        <h1>Doing this safely</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <h2>What to expect</h2>
        <p class="small muted">Traction trials: ~1.5 cm at 3 months, ~1.6 cm at 6, from 30–90 min/day. Millimetres per month, front-loaded into the first three. Pumping has no length evidence — it is girth and conditioning.</p>
      </section>

      <section class="card">
        <h2>Every session, in order</h2>
        <ol class="rules">
          <li><b>Heat first, 5–10 min.</b> Warm flannel or rice sock.</li>
          <li><b>Work.</b> Stretching or pumping — one focus per session rather than both stacked.</li>
          <li><b>BPFSL before and after</b> on stretch days. ~+5% means it took the load.</li>
          <li><b>Cool down.</b> Normal colour and sensation before you dress.</li>
        </ol>
      </section>

      <section class="card">
        <h2>Pressure, in numbers</h2>
        <div class="band-table">
          ${pe.PRESSURE_BANDS.map((b) => `<div class="band-row">
            <b>${escapeHtml(b.label)}</b>
            <span>up to ${pe.fmtPressure(b.max)}</span>
            <i>${escapeHtml(b.note)}</i>
          </div>`).join('')}
        </div>
        <p class="small muted">Beginners: 10–20 min total in ~10 min sets, 2–3x a week.</p>
      </section>

      <section class="card">
        <h2>Stop immediately if you see</h2>
        <ul class="rules danger-list">
          <li>Numbness, or skin that feels cold</li>
          <li>Dark red, purple or blue discolouration that does not fade within a few minutes</li>
          <li>Petechiae — small red or purple spots under the skin</li>
          <li>Blisters, or a fluid-filled ring of swelling</li>
          <li>Sharp pain at any point, or an ache that is still there the next day</li>
        </ul>
        <p class="small muted">Release, massage, take several days off, and flag it when you log the session.</p>
      </section>

      <section class="card">
        <h2>Rest is part of the programme</h2>
        <p class="small muted">One day off a week minimum, plus 5–7 days off every couple of months or whenever progress stalls. The app counts consecutive days for you.</p>
      </section>

      <section class="card">
        <h2>Measuring so the numbers mean something</h2>
        <ul class="rules">
          <li><b>Same time of day</b>, same erection quality.</li>
          <li><b>Bone-pressed</b>, every time.</li>
          <li><b>Same girth spot</b>, mid-shaft.</li>
          <li><b>Once a month.</b> Weekly is just noise.</li>
        </ul>
      </section>

      <section class="card">
        <h2>When it is a doctor's problem, not a training one</h2>
        <p class="small muted">Pain lasting days, a new bend or lump, worse erections, persistent numbness, or blood in the urine. Peyronie's and vascular injury are real outcomes of overdoing this, and both are far more treatable early.</p>
      </section>


    </div>`;
}
