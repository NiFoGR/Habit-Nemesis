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
        <h2>The honest expectation</h2>
        <p>Traction is the only method with clinical trial data. Devices used 30–90 minutes daily produced a mean gain of about <b>1.5 cm at three months</b> and <b>1.6 cm at six</b>; older extenders reported 1.2–1.7 cm at six months but demanded 4–9 hours a day. Gains front-load into the first three months and then slow sharply.</p>
        <p>So: millimetres per month, over months, with near-perfect consistency. If you expect that, you will probably get it. If you expect more, you will quit in week six.</p>
      </section>

      <section class="card">
        <h2>Every session, in order</h2>
        <ol class="rules">
          <li><b>Heat first, 5–10 minutes.</b> Warm flannel or a rice sock until the tissue is warm through. This is the cheapest injury insurance available.</li>
          <li><b>Work.</b> Stretching, pumping or jelqing — one focus per session rather than all three stacked.</li>
          <li><b>Measure BPFSL before and after</b> on stretch days. Roughly +5% afterwards means the tissue took the load.</li>
          <li><b>Cool down.</b> Light massage, let everything return to normal colour and sensation before you get dressed.</li>
          <li><b>Log it.</b> An unlogged session is one you cannot learn anything from.</li>
        </ol>
      </section>

      <section class="card">
        <h2>Pressure, in numbers</h2>
        <p class="small muted">Your setting is displayed in ${escapeHtml(s.pressureUnit)}. ${s.pumpStyle === 'hydro' ? 'A water pump like the Hydromax has no gauge, so the app records a 1–5 intensity by feel instead of pretending to know the pressure.' : ''}</p>
        <div class="band-table">
          ${pe.PRESSURE_BANDS.map((b) => `<div class="band-row">
            <b>${escapeHtml(b.label)}</b>
            <span>up to ${pe.fmtPressure(b.max)}</span>
            <i>${escapeHtml(b.note)}</i>
          </div>`).join('')}
        </div>
        <p class="small muted">Beginners: 10–20 minutes total, split into roughly 10-minute sets with a full release between them, two or three times a week. The app enforces the set breaks for you.</p>
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
        <p class="small muted">Release, massage until normal colour and sensation return, and take several days off. Flag it in the session log — the app drops your targets and the pattern shows up in your history.</p>
      </section>

      <section class="card">
        <h2>Rest is part of the programme</h2>
        <p>Tissue remodels between sessions, not during them. Take at least one day off a week, and a longer break — five to seven days, a "decon" — every couple of months, or whenever progress stalls for weeks despite good adherence.</p>
        <p class="small muted">The app counts consecutive training days and tells you when you are overdue.</p>
      </section>

      <section class="card">
        <h2>Measuring so the numbers mean something</h2>
        <p class="small muted">Method inconsistency is bigger than a month of real change, so it is the single biggest source of fake progress and fake plateaus.</p>
        <ul class="rules">
          <li><b>Same time of day</b>, ideally the same erection quality — morning and evening are not comparable.</li>
          <li><b>Bone-pressed</b>, ruler firmly into the pubic bone, every time. Non-bone-pressed numbers move with body fat, not growth.</li>
          <li><b>Same girth spot</b> — mid-shaft, marked mentally against something anatomical.</li>
          <li><b>Once a month.</b> Measuring weekly just gives you noise to worry about.</li>
        </ul>
      </section>

      <section class="card">
        <h2>When it is a doctor's problem, not a training one</h2>
        <p class="small muted">Pain lasting more than a couple of days, a new bend or lump, a drop in erection quality, numbness that persists, or blood in the urine. Peyronie's disease and vascular injury are both real outcomes of overdoing this, and both are far more treatable early. Going to a urologist about it is a completely ordinary thing to do.</p>
      </section>

      <section class="card">
        <h2>Sources</h2>
        <p class="small muted">Trial figures, pressure limits and session guidance are set out with references in <code>docs/PE_PROGRAM.md</code> in the repository.</p>
      </section>
    </div>`;
}
