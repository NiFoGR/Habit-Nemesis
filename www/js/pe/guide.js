// Technique and safety. Blunt and specific: vague warnings get ignored.

import * as store from '../store.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';

export function renderPeGuide(mount) {
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="pe" aria-label="Back">${icon('back')}</button>
        <h1>Doing this safely</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <h2>What to expect</h2>
        <p class="small muted">Traction trials: ~1.5 cm at 3 months, ~1.6 cm at 6, from 30–90 min/day. Millimetres per month, front-loaded into the first three. Pumping has no length evidence. It is girth and conditioning.</p>
      </section>

      <section class="card">
        <h2>The target</h2>
        <p class="small muted">As much stretching as you can manage, up to <b>two hours a day</b>, at no more than <b>10 kg</b>. Time under tension is the thing that grows tissue; more load past 10 kg buys injuries, not length.</p>
      </section>

      <section class="card">
        <h2>Every session, in order</h2>
        <ol class="rules">
          <li><b>Heat first, 5–10 min.</b> Warm flannel or rice sock. Warm tissue stretches, cold tissue tears.</li>
          <li><b>Work.</b> Stretching or pumping. One focus per session, not both stacked.</li>
          <li><b>BPFSL before and after</b> on stretch days. ~+5% means it took the load.</li>
          <li><b>Cool down.</b> Normal colour and sensation before you dress.</li>
        </ol>
      </section>

      <section class="card">
        <h2>Pumping</h2>
        <p class="small muted">Beginners: 10–20 min total, in ~10 minute sets with a full release between them, 2–3× a week. There is deliberately no intensity to log. A water pump has no gauge, so any number would be invented. What is real is the clock and the breaks.</p>
        <ul class="rules">
          <li><b>Never pump to pain.</b> Firm pressure, not a squeeze.</li>
          <li><b>Release fully between sets</b> and let colour return before the next one.</li>
          <li><b>Fluid-filled swelling</b> means you went too long or too hard. Take days off.</li>
        </ul>
      </section>

      <section class="card">
        <h2>Stop immediately if you see</h2>
        <ul class="rules danger-list">
          <li>Numbness, or skin that feels cold</li>
          <li>Dark red, purple or blue discolouration that does not fade within a few minutes</li>
          <li>Petechiae, small red or purple spots under the skin</li>
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
        <p class="small muted">Five numbers, every check-in: BP flaccid stretched, BP erect, NBP erect, girth at the thickest point, girth at the very base. The check-in walks you through each one.</p>
        <ul class="rules">
          <li><b>Same time of day</b>, same erection quality.</li>
          <li><b>Bone-pressed</b> means the ruler is pushed into the pubic bone. Same pressure every time, or the number moves on its own.</li>
          <li><b>Same two girth spots</b>: the thickest point, and hard against the base.</li>
          <li><b>Once a month.</b> Weekly is just noise.</li>
        </ul>
      </section>

      <section class="card">
        <h2>When it is a doctor's problem, not a training one</h2>
        <p class="small muted">Pain lasting days, a new bend or lump, worse erections, persistent numbness, or blood in the urine. Peyronie's and vascular injury are real outcomes of overdoing this, and both are far more treatable early.</p>
      </section>

    </div>`;
}

/* ---------------------- settings ---------------------- */

export function renderPeSettings(mount) {
  const s = store.get().pe.settings;
  const discreet = store.get().settings.discreet;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="pe" aria-label="Back">${icon('back')}</button>
        <h1>${discreet ? 'Length Training' : 'PE'}</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('ruler', 16)}<h2>Measuring</h2></div>
        <label class="setting">
          <span><b>Units</b><i>Every length and girth in the app.</i></span>
          <select id="units">
            <option value="cm" ${s.units === 'cm' ? 'selected' : ''}>cm</option>
            <option value="in" ${s.units === 'in' ? 'selected' : ''}>inches</option>
          </select>
        </label>
        <label class="setting">
          <span><b>Check-in day</b><i>Which day of the month the reminder appears.</i></span>
          <select id="measureDay">
            ${[1, 5, 10, 15, 20, 25, 28].map((d) => `<option value="${d}" ${s.measureDay === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('stretch', 16)}<h2>Session defaults</h2></div>
        <p class="small muted">What the timer opens with. You can still change either on the day.</p>
        <label class="setting">
          <span><b>Stretch length</b><i>Target is two hours a day, in as many sessions as suits.</i></span>
          <select id="stretchMin">
            ${[15, 20, 30, 45, 60, 90, 120].map((m) => `<option value="${m}" ${s.stretchMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Tension</b><i>10 kg is the ceiling. Length comes from time, not load.</i></span>
          <select id="tensionKg">
            ${[0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => `<option value="${k}" ${s.tensionKg === k ? 'selected' : ''}>${k} kg</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Pump length</b><i>Beginner guidance is 10 to 20 minutes, in ~10 minute sets.</i></span>
          <select id="pumpMin">
            ${[10, 15, 20, 30, 40].map((m) => `<option value="${m}" ${s.pumpMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
        <label class="setting toggle">
          <span><b>Kegels while pumping</b><i>Runs a cadence during pump sessions. Counts for your kegel streak, never for promotion.</i></span>
          <input type="checkbox" id="kegelDuringPump" ${s.kegelDuringPump ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('shield', 16)}<h2>Reference</h2></div>
        <a class="btn ghost linkbtn" href="#/pe/guide">${icon('shield', 16)}<span>Doing this safely</span></a>
      </section>
    </div>`;

  const bind = (id, get = (e) => e.value) =>
    mount.querySelector('#' + id).addEventListener('change', (e) => {
      store.update((st) => {
        st.pe.settings[id] = get(e.target);
      });
      toast('Saved');
    });
  bind('units');
  bind('measureDay', (e) => Number(e.value));
  bind('stretchMin', (e) => Number(e.value));
  bind('tensionKg', (e) => Number(e.value));
  bind('pumpMin', (e) => Number(e.value));
  bind('kegelDuringPump', (e) => e.checked);
}
