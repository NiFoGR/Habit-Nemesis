// PE home: what to do now, this week at a glance, and the way in to everything
// else in the feature.

import * as store from '../store.js';
import * as pe from './program.js';
import * as vault from './vault.js';
import { escapeHtml, fmtHours, ringSvg } from '../ui.js';

export function renderPeHome(mount) {
  const state = store.get();
  const s = state.pe;
  const st = pe.peStreak();
  const dec = pe.deconStatus();
  const due = pe.measurementDue();
  const latest = s.measurements[s.measurements.length - 1];
  const first = s.measurements[0];
  const weekStretch = pe.weeklyVolumeMs('stretch', 1);
  const weekPump = pe.weeklyVolumeMs('pump', 1);
  const proj = pe.projection();
  const todays = s.sessions.filter((x) => x.date === store.dayKey());
  const gain = first && latest && first !== latest ? latest.bpel - first.bpel : 0;

  // A weekly stretch target expressed the way the trials did: minutes per day.
  const targetWeekMs = 30 * 60000 * 7;

  if (!s.settings.safetyAck) return renderSafetyGate(mount);

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">←</button>
        <h1>PE</h1>
        <button class="icon-btn" data-nav="pe-stats" aria-label="Progress">▤</button>
      </header>

      <div class="today pe-today">
        <div class="today-left">
          <p class="eyebrow">${todays.length ? `${todays.length} session${todays.length === 1 ? '' : 's'} today` : 'Nothing logged today'}</p>
          <h2>${latest ? `${pe.fmtLength(latest.bpel)} × ${pe.fmtLength(latest.eg)}` : 'No baseline yet'}</h2>
          <p class="muted small">${latest
            ? `Measured ${new Date(latest.ts).toLocaleDateString()}${gain ? ` · ${gain >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(gain), undefined, 2)} since you started` : ''}`
            : 'Take a baseline measurement — nothing here means much without one.'}</p>
        </div>
        ${ringSvg(Math.min(weekStretch / targetWeekMs, 1), fmtHours(weekStretch), 'this week', { size: 104 })}
      </div>

      ${due.due ? `<a class="notice action" href="#/pe/measure">
        <b>Monthly check-in due.</b> ${escapeHtml(due.reason)} Tap to measure and add a photo.
      </a>` : ''}
      ${dec.hard ? `<div class="notice warn"><b>${dec.consecutive} days without a break.</b> Take five days off. Tissue remodels during rest, and this is the point where people stall for months without realising why.</div>`
        : dec.due ? `<div class="notice warn">${dec.consecutive} consecutive training days — a few days off would do more for you than another session.</div>` : ''}

      <h2 class="section-title">Start a session</h2>
      <div class="start-grid">
        ${pe.TYPE_LIST.map((t) => `<a class="start-card" href="#/pe/timer?type=${t.id}" style="--c:${t.colour}">
          <b>${t.icon}</b>
          <span>${escapeHtml(t.label)}</span>
          <i>${t.id === 'stretch' ? `${s.settings.stretchMin} min` : t.id === 'pump' ? `${s.settings.pumpMin} min` : `${t.defaultMin} min`}</i>
        </a>`).join('')}
      </div>

      <div class="stat-grid">
        <div class="stat"><b>${st}</b><span>day streak</span></div>
        <div class="stat"><b>${fmtHours(weekStretch)}</b><span>stretch this week</span></div>
        <div class="stat"><b>${fmtHours(weekPump)}</b><span>pump this week</span></div>
        <div class="stat"><b>${s.achievements.length}/${pe.ACHIEVEMENTS.length}</b><span>achievements</span></div>
      </div>

      ${proj ? `<section class="card">
        <h2>Where you are heading</h2>
        <div class="kv"><span>Now</span><b>${pe.fmtLength(proj.from.bpel)}</b></div>
        ${proj.points.slice(0, 2).map((p) => `<div class="kv"><span>In ${p.months} months</span><b>${pe.fmtLength(p.bpelLow, undefined, 1)} – ${pe.fmtLength(p.bpelHigh, undefined, 1)}</b></div>`).join('')}
        <p class="small muted">From ${escapeHtml(proj.basis)}. Keep the volume up and the range narrows as your own data takes over from the assumptions.</p>
        <button class="btn ghost" data-nav="pe-stats">Full progress</button>
      </section>` : `<section class="card">
        <h2>Set your baseline</h2>
        <p class="small muted">Length, girth, and optionally a photo. Everything the app can tell you later — trends, projections, whether any of this is working — starts here.</p>
        <button class="btn primary" data-nav="pe-measure">Take first measurement</button>
      </section>`}

      <div class="tile-row">
        <a class="tile" href="#/pe/gallery"><b>🔒</b><span>Gallery</span><i>${vault.isSet() ? 'PIN protected' : 'Set up'}</i></a>
        <a class="tile" href="#/pe/measure"><b>📏</b><span>Check-in</span><i>${due.due ? 'Due now' : `in ${due.next}d`}</i></a>
        <a class="tile" href="#/pe/stats"><b>📈</b><span>Progress</span><i>${s.sessions.length} sessions</i></a>
        <a class="tile" href="#/pe/guide"><b>⚠</b><span>Safety</span><i>Read this</i></a>
      </div>

      <p class="fineprint centre">Everything stays on this device.</p>
    </div>`;
}

/** Shown once, before anything else. The risks here are real and specific, and
 *  burying them in a guide nobody opens would be the wrong call. */
function renderSafetyGate(mount) {
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">←</button>
        <h1>Before you start</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <h2>What the evidence actually supports</h2>
        <p>Traction — extenders and manual stretching — is the only approach with real clinical trial data behind it. Those trials produced average gains of roughly <b>1.2–1.7 cm over three to six months</b>, from 30–90 minutes a day, every day. That is the realistic ceiling, and most of it lands in the first three months.</p>
        <p>Pumping has no comparable length evidence. It is treated in this app as a girth and conditioning tool, which is what it is good at.</p>
        <p>Anyone promising more than a couple of centimetres is selling something.</p>
      </section>

      <section class="card">
        <h2>How people get hurt</h2>
        <ul class="rules">
          <li><b>Too much pressure.</b> Past about 10 inHg (34 kPa) you are rupturing vessels, not training tissue.</li>
          <li><b>Sessions that run too long.</b> Fluid build-up, blistering and numbness come from duration far more than from intensity.</li>
          <li><b>No warm-up.</b> Cold tissue tears where warm tissue stretches.</li>
          <li><b>Training through pain.</b> Soreness that lasts into the next day means you did too much. Sharp pain, numbness, dark discolouration or blood spots mean stop immediately.</li>
          <li><b>Never taking time off.</b> Adaptation happens during rest. Months of daily work with no break is the classic way to end up with nothing to show for it.</li>
        </ul>
      </section>

      <section class="card">
        <h2>The deal</h2>
        <p class="small muted">This app tracks training and warns you when a plan looks unsafe. It is not medical advice and it cannot see you. Pain that persists, a bend that develops, or any change in erection quality is a urologist's question — and going early costs you nothing.</p>
        <label class="check"><input type="checkbox" id="ack"> I have read this and I understand the risks</label>
      </section>

      <button class="btn primary big" id="go" disabled>Continue</button>
    </div>`;

  const ack = mount.querySelector('#ack');
  const go = mount.querySelector('#go');
  ack.addEventListener('change', () => (go.disabled = !ack.checked));
  go.addEventListener('click', () => {
    store.update((s) => {
      s.pe.settings.safetyAck = true;
    });
    renderPeHome(mount);
  });
}
