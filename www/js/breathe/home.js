// The wind-down section and its settings. The record lives here rather than in
// a tracking.js: one number does not need a screen of its own.

import * as store from '../store.js';
import * as breathe from './program.js';
import { escapeHtml, fmtClock, fmtDuration, fmtHours, segmented, onSegment, toast } from '../ui.js';
import { icon } from '../icons.js';

export function renderBreatheHome(mount) {
  const s = breathe.settings();
  const today = breathe.dayState();
  const st = breathe.streak();
  const hist = breathe.history(13);
  const t30 = breathe.totals(30);
  const life = breathe.lifetime();
  const plan = breathe.buildTimeline(s.pattern, s.minutes * 60000);

  const cols = [];
  for (let i = 0; i < hist.length; i += 7) cols.push(hist.slice(i, i + 7));

  mount.innerHTML = `
    <div class="screen breathe">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Wind-down</h1>
        <button class="icon-btn" data-nav="breathe-settings" aria-label="Settings">${icon('settings')}</button>
      </header>

      <div class="today breathe-today">
        <div class="today-left">
          <h2>${today.done ? 'Done tonight' : 'Not yet tonight'}</h2>
          <p class="muted small">${today.done
            ? `${fmtDuration(today.ms / 1000)} at ${new Date(today.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
            : `${fmtClock(plan.totalMs)} tonight`}</p>
        </div>
        <div class="br-mark ${today.done ? 'on' : ''}">${icon(today.done ? 'check' : 'breath', 26)}</div>
      </div>

      <a class="btn primary big linkbtn" href="#/breathe/run">${icon('play', 18)}<span>${today.done ? 'Again' : 'Begin'}</span></a>

      <section class="card">
        <div class="h-row">${icon('breath', 16)}<h2>Tonight’s pattern</h2></div>
        ${segmented('pattern', breathe.PATTERN_IDS.map((id) => ({ id, label: breathe.PATTERNS[id].label })), s.pattern)}
        <p class="small muted" id="patternBlurb">${escapeHtml(plan.pattern.blurb)}</p>
      </section>

      <div class="stat-grid">
        <div class="stat"><b>${st}</b><span>night streak</span></div>
        <div class="stat"><b>${store.get().breathe.best}</b><span>best</span></div>
        <div class="stat"><b>${Math.round(t30.rate * 100)}%</b><span>nights, 30d</span></div>
        <div class="stat"><b>${fmtHours(life.ms)}</b><span>breathing, all told</span></div>
      </div>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Last 13 weeks</h2></div>
        <div class="heatmap">
          ${cols.map((c) => `<div class="hm-col">${c.map((d) => `<i class="${d.cls}" title="${d.key}${d.ms ? `: ${fmtDuration(d.ms / 1000)}` : ''}"></i>`).join('')}</div>`).join('')}
        </div>
        <div class="hm-key">
          <span>less</span><i class="none"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>more</span>
        </div>
      </section>

      <section class="card">
        <div class="h-row">${icon('help', 16)}<h2>Why this works</h2></div>
        <p class="muted small">
          Breathing out takes the brake off the vagus nerve; breathing in takes
          it off again. Make the out-breath the longer of the two, at around six
          breaths a minute, and the balance tips towards the parasympathetic
          side. Heart rate falls on every exhale, and keeps falling after you stop.
        </p>
        <p class="fineprint">
          The three sighs at the start are not decoration. Two inhales stacked
          on each other reinflate collapsed alveoli and dump CO2 in one breath,
          which is the fastest thing you can do on purpose to drop arousal.
        </p>
      </section>
    </div>`;

  onSegment(mount, 'pattern', (id) => {
    store.update((x) => {
      x.breathe.settings.pattern = id;
    });
    const p = breathe.PATTERNS[id];
    mount.querySelector('#patternBlurb').textContent = p.blurb;
  });
}

/* ---------------- settings ---------------- */

export function renderBreatheSettings(mount) {
  const s = breathe.settings();

  mount.innerHTML = `
    <div class="screen breathe">
      <header class="screen-head">
        <button class="icon-btn" data-back="breathe" aria-label="Back">${icon('back')}</button>
        <h1>Wind-down</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('breath', 16)}<h2>The breath</h2></div>
        <label class="setting">
          <span><b>Length</b><i>Whole breaths only, so it ends on an out-breath.</i></span>
          <select id="minutes">
            ${[3, 5, 8, 10, 15, 20].filter((m) => m >= breathe.MIN_MINUTES && m <= breathe.MAX_MINUTES)
              .map((m) => `<option value="${m}" ${s.minutes === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
        <p class="fineprint" id="plannedNote"></p>
      </section>

      <section class="card">
        <div class="h-row">${icon('flash', 16)}<h2>Pacing</h2></div>
        <label class="setting toggle">
          <span><b>Sound</b><i>Rises as you breathe in, falls as you breathe out.</i></span>
          <input type="checkbox" id="sound" ${s.sound !== false ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Vibration</b><i>One buzz in, two out. Needs the screen on.</i></span>
          <input type="checkbox" id="vibrate" ${s.vibrate !== false ? 'checked' : ''}>
        </label>
        <p class="fineprint">Both off leaves only the orb, and open eyes.</p>
      </section>

      <section class="card">
        <div class="h-row">${icon('bell', 16)}<h2>Reminder</h2></div>
        <label class="setting toggle">
          <span><b>Remind me to wind down</b><i>A real alarm on the APK.</i></span>
          <input type="checkbox" id="remind" ${s.remind ? 'checked' : ''}>
        </label>
        <label class="setting">
          <span><b>At</b></span>
          <input type="time" id="remindAt" value="${escapeHtml(s.remindAt)}">
        </label>
        <p class="fineprint">Set this after the night prayers, not before. This is meant to be the last thing.</p>
      </section>
    </div>`;

  const set = (k, v) => store.update((st) => {
    st.breathe.settings[k] = v;
  });

  const note = () => {
    const cur = breathe.settings();
    const plan = breathe.buildTimeline(cur.pattern, cur.minutes * 60000);
    mount.querySelector('#plannedNote').textContent =
      `${plan.breaths} breaths after the opening sighs, ${fmtClock(plan.totalMs)} in all.`;
  };

  mount.querySelector('#minutes').addEventListener('change', (e) => {
    set('minutes', Number(e.target.value));
    note();
  });
  mount.querySelector('#sound').addEventListener('change', (e) => set('sound', e.target.checked));
  mount.querySelector('#vibrate').addEventListener('change', (e) => set('vibrate', e.target.checked));
  mount.querySelector('#remind').addEventListener('change', (e) => {
    set('remind', e.target.checked);
    breathe.syncAlarm();
    toast('Saved');
  });
  mount.querySelector('#remindAt').addEventListener('change', (e) => {
    set('remindAt', e.target.value);
    breathe.syncAlarm();
    toast('Saved');
  });

  note();
}
