// PE home. One glance, one tap. Everything measured against the two-hour
// daily stretching target.

import * as store from '../store.js';
import * as pe from './program.js';
import { escapeHtml, fmtHours, ringSvg, toast, haptic, sparkline } from '../ui.js';
import { icon } from '../icons.js';

export function renderPeHome(mount) {
  const state = store.get();
  const s = state.pe;
  if (!s.settings.safetyAck) return renderSafetyGate(mount);

  const dec = pe.deconStatus();
  const due = pe.measurementDue();
  const latest = s.measurements[s.measurements.length - 1];
  const first = s.measurements[0];
  const gain = first && latest && first !== latest ? latest.bpel - first.bpel : 0;

  const todayStretch = s.sessions
    .filter((x) => x.date === store.dayKey() && x.type === 'stretch')
    .reduce((a, x) => a + x.durationSec * 1000, 0);
  const goal = pe.DAILY_STRETCH_GOAL_MS;
  const left = Math.max(0, goal - todayStretch);

  const lastStretch = s.sessions.filter((x) => x.type === 'stretch').slice(-1)[0];
  const lastEq = s.eq[s.eq.length - 1];
  const eqDue = !lastEq || Date.now() - lastEq.ts > 6.5 * 864e5;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>${store.get().settings.discreet ? 'Length Training' : 'PE'}</h1>
        <button class="icon-btn" data-nav="pe-stats" aria-label="Progress">${icon('chart')}</button>
      </header>

      <div class="today pe-today">
        <div class="today-left">
          <h2>${fmtHours(todayStretch)} <span class="of-goal">of 2h</span></h2>
          <p class="muted small">${left > 0 ? `${fmtHours(left)} left today` : 'Target hit today'}${pe.peStreak() ? ` · ${pe.peStreak()}d streak` : ''}</p>
        </div>
        ${ringSvg(Math.min(todayStretch / goal, 1), `${Math.round((todayStretch / goal) * 100)}%`, 'today', { size: 96 })}
      </div>

      ${latest ? `<div class="spark-card">
        <div class="cap"><span>${pe.fmtLength(latest.bpel)} × ${pe.fmtLength(latest.eg)}</span><b>${gain >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(gain), undefined, 2)}</b></div>
        ${s.measurements.length > 1 ? sparkline(s.measurements.map((m) => m.bpel), { color: 'var(--violet)', h: 40 }) : ''}
      </div>` : ''}

      ${due.due ? `<a class="notice action" href="#/pe/measure">${icon('ruler', 16)} Monthly check-in due.</a>` : ''}
      ${dec.due ? `<div class="notice warn">${dec.consecutive} days without a rest day. Take a few off.</div>` : ''}

      ${lastStretch ? `<a class="btn primary big linkbtn" href="#/pe/timer?type=stretch&repeat=1">${icon('repeat', 18)}<span>Repeat ${Math.max(1, Math.round((lastStretch.plannedSec || lastStretch.durationSec) / 60))} min @ ${lastStretch.tensionKg ?? s.settings.tensionKg} kg</span></a>` : ''}

      <div class="start-grid">
        <a class="start-card" href="#/pe/timer?type=stretch" style="--c:var(--accent)">${icon('stretch')}<span class="sc-text"><span>Stretch</span><i>${s.settings.stretchMin} min · ${s.settings.tensionKg} kg</i></span></a>
        <a class="start-card" href="#/pe/timer?type=pump" style="--c:var(--violet)">${icon('pump')}<span class="sc-text"><span>Pump</span><i>${s.settings.pumpMin} min</i></span></a>
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
        <a href="#/pe/settings">${icon('settings')} Settings</a>
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

/** Shown once. Short on purpose, the full version lives in the guide. */
function renderSafetyGate(mount) {
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Before you start</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <ul class="rules">
          <li><b>The target:</b> as much stretching as you can manage, up to two hours a day, at no more than 10 kg.</li>
          <li><b>Realistic gains:</b> trials show ~1.5 cm over 3–6 months. Millimetres per month, not centimetres.</li>
          <li><b>Pumping</b> is for girth and conditioning. Short sets, ~10 minutes at a time.</li>
          <li><b>Stop at once</b> for numbness, dark colour, spots, blisters or sharp pain.</li>
          <li><b>Rest days matter.</b> Tissue adapts between sessions, not during.</li>
        </ul>
        <p class="fineprint">Not medical advice. Persistent pain, a new bend, or worse erections → urologist.</p>
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
