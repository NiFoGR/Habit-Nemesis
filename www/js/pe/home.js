// PE home. One glance, one tap.

import * as store from '../store.js';
import * as pe from './program.js';
import { escapeHtml, fmtHours, ringSvg, toast, haptic, sparkline, donut } from '../ui.js';
import { icon } from '../icons.js';

export function renderPeHome(mount) {
  const state = store.get();
  const s = state.pe;
  if (!s.settings.safetyAck) return renderSafetyGate(mount);

  const dec = pe.deconStatus();
  const due = pe.measurementDue();
  const latest = s.measurements[s.measurements.length - 1];
  const first = s.measurements[0];
  const weekStretch = pe.weeklyVolumeMs('stretch', 1);
  const gain = first && latest && first !== latest ? latest.bpel - first.bpel : 0;
  const targetWeekMs = 30 * 60000 * 7;

  const lastWork = s.sessions.filter((x) => x.type !== 'warmup').slice(-1)[0];
  const repeatLabel = lastWork
    ? `${pe.typeDef(lastWork.type).label} · ${Math.max(1, Math.round((lastWork.plannedSec || lastWork.durationSec) / 60))} min`
    : null;

  const lastEq = s.eq[s.eq.length - 1];
  const eqDue = !lastEq || Date.now() - lastEq.ts > 6.5 * 864e5;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">${icon('back')}</button>
        <h1>${store.get().settings.discreet ? 'Length Training' : 'PE'}</h1>
        <button class="icon-btn" data-nav="pe-stats" aria-label="Progress">${icon('chart')}</button>
      </header>

      <div class="today pe-today">
        <div class="today-left">
          <h2>${latest ? `${pe.fmtLength(latest.bpel)} × ${pe.fmtLength(latest.eg)}` : 'No baseline yet'}</h2>
          <p class="muted small">${latest
            ? `${gain > 0.01 ? `+${pe.fmtLength(gain, undefined, 2)} since start · ` : ''}${pe.peStreak()}d streak`
            : 'Measure once and everything else starts working.'}</p>
        </div>
        ${donut(
          [
            { value: weekStretch, colour: 'var(--accent)' },
            { value: pe.weeklyVolumeMs('pump', 1), colour: 'var(--violet)' },
            { value: pe.weeklyVolumeMs('warmup', 1), colour: 'var(--warn)' },
          ],
          { size: 96, centre: fmtHours(weekStretch + pe.weeklyVolumeMs('pump', 1) + pe.weeklyVolumeMs('warmup', 1)) }
        )}
      </div>

      ${s.measurements.length > 1 ? `<div class="spark-card">
        <div class="cap"><span>Length trend</span><b>${gain >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(gain), undefined, 2)}</b></div>
        ${sparkline(s.measurements.map((m) => m.bpel), { color: 'var(--violet)', h: 40 })}
      </div>` : ''}
      ${due.due ? `<a class="notice action" href="#/pe/measure">${icon('ruler', 16)} Monthly check-in due — tap to measure.</a>` : ''}
      ${dec.due ? `<div class="notice warn">${dec.consecutive} days without a rest day. Take a few off.</div>` : ''}

      ${repeatLabel ? `<a class="btn primary big linkbtn" href="#/pe/timer?type=${lastWork.type}&repeat=1">${icon('repeat', 18)}<span>Repeat — ${escapeHtml(repeatLabel)}</span></a>` : ''}

      <div class="start-grid">
        <a class="start-card" href="#/pe/timer?type=stretch&routine=1" style="--c:var(--accent)">${icon('flash')}<span class="sc-text"><span>Routine</span><i>warm-up + stretch</i></span></a>
        <a class="start-card" href="#/pe/timer?type=stretch" style="--c:var(--accent)">${icon('stretch')}<span class="sc-text"><span>Stretch</span><i>${s.settings.stretchMin} min</i></span></a>
        <a class="start-card" href="#/pe/timer?type=pump" style="--c:var(--violet)">${icon('pump')}<span class="sc-text"><span>Pump</span><i>${s.settings.pumpMin} min</i></span></a>
        <a class="start-card" href="#/pe/timer?type=warmup" style="--c:var(--warn)">${icon('flame')}<span class="sc-text"><span>Warm-up</span><i>8 min</i></span></a>
      </div>

      ${eqDue ? `<section class="card" id="eqCard">
        <div class="h-row">${icon('droplet', 16)}<h2>Erection quality this week</h2></div>
        <div class="eq-row">${Array.from({ length: 10 }, (_, i) => `<button data-eq="${i + 1}">${i + 1}</button>`).join('')}</div>
      </section>` : ''}

      ${!latest ? '<a class="btn primary big linkbtn" href="#/pe/measure">Take first measurement</a>' : ''}

      <div class="linkrow">
        <a href="#/pe/stats">${icon('chart')} Progress</a>
        <a href="#/pe/gallery">${icon('lock')} Gallery</a>
        <a href="#/pe/measure">${icon('ruler')} Check-in${due.due ? '' : ` · ${due.next}d`}</a>
        <a href="#/pe/guide">${icon('shield')} Safety</a>
      </div>
    </div>`;

  mount.querySelectorAll('[data-eq]').forEach((b) =>
    b.addEventListener('click', () => {
      const v = Number(b.dataset.eq);
      store.update((st) => {
        st.pe.eq.push({ ts: Date.now(), date: store.dayKey(), v });
      });
      haptic('done');
      toast(`Logged ${v}/10`);
      renderPeHome(mount);
    })
  );
}

/** Shown once. Short on purpose — the full version lives in the guide. */
function renderSafetyGate(mount) {
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">${icon('back')}</button>
        <h1>Before you start</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <ul class="rules">
          <li><b>Realistic ceiling:</b> trials show ~1.5 cm over 3–6 months from 30–90 min/day of traction. Millimetres per month.</li>
          <li><b>Pressure:</b> never past 10 inHg (34 kPa). Beginners stay under 3 inHg.</li>
          <li><b>Duration:</b> pump in ~10 min sets, 10–20 min total to start.</li>
          <li><b>Warm up first.</b> Cold tissue tears; warm tissue stretches.</li>
          <li><b>Stop at once</b> for numbness, dark colour, spots, blisters or sharp pain.</li>
          <li><b>Rest days matter.</b> Tissue adapts between sessions, not during.</li>
        </ul>
        <p class="fineprint">Not medical advice. Persistent pain, a new bend, or worse erections → urologist. Full guide inside.</p>
        <label class="check"><input type="checkbox" id="ack"> Understood</label>
      </section>

      <button class="btn primary big" id="go" disabled>Continue</button>
    </div>`;

  const ack = mount.querySelector('#ack');
  const go = mount.querySelector('#go');
  ack.addEventListener('change', () => (go.disabled = !ack.checked));
  go.addEventListener('click', () => {
    store.update((st) => {
      st.pe.settings.safetyAck = true;
    });
    renderPeHome(mount);
  });
}
