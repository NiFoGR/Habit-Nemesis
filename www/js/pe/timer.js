// PE session: set up, run, log.
//
// The countdown is wall-clock, so it keeps counting with the screen off, and on
// the APK the end is a real alarm. The kegel cadence uses performance.now:
// haptics only matter while you are looking at the phone.

import * as store from '../store.js';
import * as pe from './program.js';
import * as feats from '../arena/feats.js';
import * as kegel from '../kegels/program.js';
import { haptic, chime, fmtClock, fmtMs, notify, askNotifyPermission, escapeHtml, toast } from '../ui.js';
import { scheduleAlarm, cancelAlarm, ensureAlarmPermission, ALARM_SESSION } from '../native.js';
import { icon } from '../icons.js';
import { leaveTo } from '../back.js';

const R = 132;
const CIRC = 2 * Math.PI * R;
// Logged time stops growing here if the app is forgotten.
const OVERTIME_CAP_MS = 15 * 60000;

function parseNum(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

export function renderTimer(mount, opts = {}) {
  const state = store.get();
  const s = state.pe.settings;
  const cfg = {
    type: pe.isValidType(opts.type) ? opts.type : 'stretch',
    minutes: null,
    intensity: null,
    kegels: s.kegelDuringPump,
    bpfslBefore: null,
    setBreakMin: 10,
  };
  const def = () => pe.typeDef(cfg.type);

  function defaults() {
    const d = def();
    cfg.minutes = cfg.type === 'stretch' ? s.stretchMin : cfg.type === 'pump' ? s.pumpMin : d.defaultMin;
    cfg.intensity = d.intensity ? s.tensionKg : null;
  }
  defaults();

  // One-tap repeat: last session of this type, straight into the countdown.
  if (opts.repeat) {
    const last = state.pe.sessions.filter((x) => x.type === cfg.type).slice(-1)[0];
    if (last) {
      cfg.minutes = Math.max(1, Math.round((last.plannedSec || last.durationSec) / 60));
      if (last.tensionKg) cfg.intensity = last.tensionKg;
      run();
      return;
    }
  }

  /* ---------------- setup ---------------- */

  function renderSetup() {
    const d = def();
    const warnings = pe.planWarnings({ type: cfg.type, minutes: cfg.minutes, intensity: cfg.intensity });

    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" data-back="pe" aria-label="Back">${icon('back')}</button>
          <h1>${escapeHtml(d.label)}</h1>
          <button class="icon-btn" data-nav="pe-guide" aria-label="Safety guide">${icon('help')}</button>
        </header>

        <div class="type-grid">
          ${pe.TYPE_LIST.map(
            (t) => `<button class="type-chip ${t.id === cfg.type ? 'on' : ''}" data-type="${t.id}" style="--c:${t.colour}">
              ${icon(t.icon, 17)}<span>${escapeHtml(t.label)}</span>
            </button>`
          ).join('')}
        </div>

        <section class="card">
          <label class="slider-row"><span>Duration</span><b id="durOut">${cfg.minutes} min</b></label>
          <input type="range" id="dur" min="1" max="180" step="5" value="${cfg.minutes}">
          ${cfg.type === 'stretch' ? `<p class="small muted">${goalLine()}</p>` : ''}

          ${d.intensity ? `
          <label class="slider-row"><span>${escapeHtml(d.intensity.label)}</span><b id="intOut">${intensityText()}</b></label>
          <input type="range" id="int" min="${d.intensity.min}" max="${d.intensity.max}" step="${d.intensity.step}" value="${cfg.intensity}">
          ` : ''}

          ${cfg.type === 'pump' ? `
          <label class="slider-row"><span>Break every</span><b id="brkOut">${cfg.setBreakMin} min</b></label>
          <input type="range" id="brk" min="5" max="20" step="1" value="${cfg.setBreakMin}">
          <label class="setting toggle">
            <span><b>Kegels while pumping</b></span>
            <input type="checkbox" id="keg" ${cfg.kegels ? 'checked' : ''}>
          </label>
          ` : ''}
        </section>

        ${def().tracksBpfsl ? `
        <section class="card">
          <label class="slider-row"><span>BPFSL before</span><span class="tag">optional</span></label>
          <div class="measure-row">
            <input type="number" inputmode="decimal" step="0.1" id="bpfsl" placeholder="e.g. 17.8">
            <span>${escapeHtml(s.units)}</span>
          </div>
        </section>` : ''}

        ${warnings.length ? `<div class="warn-stack">${warnings
          .map((w) => `<div class="notice ${w.level === 'info' ? '' : 'warn'}">${escapeHtml(w.text)}</div>`)
          .join('')}</div>` : ''}

        <button class="btn primary big" id="start">${icon('play', 18)}<span>Start</span></button>
      </div>`;

    mount.querySelectorAll('[data-type]').forEach((b) =>
      b.addEventListener('click', () => {
        cfg.type = b.dataset.type;
        defaults();
        renderSetup();
      })
    );

    const bind = (id, out, fn) => {
      const el = mount.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        fn(Number(el.value));
        const o = mount.querySelector('#' + out);
        if (o) o.textContent = outText(id);
      });
      el.addEventListener('change', () => renderSetup());
    };
    bind('dur', 'durOut', (v) => (cfg.minutes = v));
    bind('int', 'intOut', (v) => (cfg.intensity = v));
    bind('brk', 'brkOut', (v) => (cfg.setBreakMin = v));
    mount.querySelector('#keg')?.addEventListener('change', (e) => (cfg.kegels = e.target.checked));

    mount.querySelector('#start').addEventListener('click', async () => {
      const raw = parseNum(mount.querySelector('#bpfsl')?.value);
      cfg.bpfslBefore = raw == null ? null : pe.fromDisplayLength(raw, s.units);
      askNotifyPermission();
      ensureAlarmPermission();
      run();
    });
  }

  function intensityText() {
    const d = def();
    if (!d.intensity) return '';
    return `${cfg.intensity} ${d.intensity.unit}`.trim();
  }

  function outText(id) {
    if (id === 'dur') return `${cfg.minutes} min`;
    if (id === 'int') return intensityText();
    return `${cfg.setBreakMin} min`;
  }

  /** This session against the two-hour daily target. */
  function goalLine() {
    const doneMs = store
      .get()
      .pe.sessions.filter((x) => x.date === store.dayKey() && x.type === 'stretch')
      .reduce((a, x) => a + x.durationSec * 1000, 0);
    const planned = doneMs + cfg.minutes * 60000;
    const goal = pe.DAILY_STRETCH_GOAL_MS;
    const pct = Math.round((planned / goal) * 100);
    if (doneMs > 0) return `${(doneMs / 3600000).toFixed(1)}h already today. This takes you to ${(planned / 3600000).toFixed(1)}h of 2h (${pct}%).`;
    return `${pct}% of today's two-hour target.`;
  }

  function intensitySummary() {
    if (cfg.type === 'pump') return `${cfg.minutes} min · break every ${cfg.setBreakMin} min`;
    if (!def().intensity) return `${cfg.minutes} min`;
    return `${intensityText()} · ${cfg.minutes} min`;
  }

  /* ---------------- running (wall clock) ---------------- */

  let endsAt = 0; // wall-clock end of the work countdown
  let pausedRemaining = null; // ms left while paused
  let breakEndsAt = 0; // wall-clock end of a set break
  let breakRemaining = 0; // work ms left, stashed during a break
  let nextBreakElapsed = Infinity;
  let doneAt = 0; // when the countdown hit zero
  let interval = 0;
  let wakeLock = null;
  let kegelPhase = 'idle';
  let kegelPhaseEnd = 0;
  let kegelCycles = 0;
  let startedWall = 0;
  const kegelHold = () => kegel.levelDef(store.get().program.level).holds.holdMs;

  function run() {
    const targetMs = cfg.minutes * 60000;
    startedWall = Date.now();
    endsAt = startedWall + targetMs;
    pausedRemaining = null;
    doneAt = 0;
    kegelCycles = 0;
    nextBreakElapsed = cfg.type === 'pump' ? cfg.setBreakMin * 60000 : Infinity;
    document.body.classList.add('in-session');
    navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});
    scheduleAlarm(ALARM_SESSION, endsAt, `${def().label} done`, `${cfg.minutes} minutes complete.`);

    mount.innerHTML = `
      <div class="player pe-player" id="player">
        <div class="player-top">
          <button class="icon-btn" data-back id="stop" aria-label="Finish">${icon('close')}</button>
          <div class="player-progress"><i id="prog"></i></div>
          <button class="icon-btn" id="pause" aria-label="Pause">${icon('pause')}</button>
        </div>

        <div class="player-phase">
          <div class="phase-label">${escapeHtml(def().label)}</div>
          <div class="phase-sub" id="sub">${escapeHtml(intensitySummary())}</div>
        </div>

        <div class="stage">
          <svg class="ring" viewBox="0 0 320 320" aria-hidden="true">
            <circle class="ring-track" cx="160" cy="160" r="${R}"></circle>
            <circle class="ring-fill" cx="160" cy="160" r="${R}" id="ringFill"
                    stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" style="stroke:${def().colour}"></circle>
          </svg>
          <div class="stage-core">
            <div class="core-big" id="clock">${fmtClock(targetMs)}</div>
            <div class="core-small" id="state">remaining</div>
          </div>
        </div>

        ${cfg.kegels && cfg.type === 'pump' ? `
        <div class="kegel-strip" id="kegelStrip">
          <div class="kegel-bar"><i id="kegelBar"></i></div>
          <div class="kegel-text"><b id="kegelLabel">Kegels: get ready</b><span id="kegelCount">0 cycles</span></div>
        </div>` : ''}

        <div class="player-cue" id="cue">${escapeHtml(def().cue)}</div>

        <div class="player-bottom">
          <button class="btn ghost small-btn" id="add5">+5 min</button>
          <button class="btn primary" id="finish">Finish</button>
        </div>
      </div>`;

    const el = {
      ring: mount.querySelector('#ringFill'), clock: mount.querySelector('#clock'), state: mount.querySelector('#state'),
      prog: mount.querySelector('#prog'), cue: mount.querySelector('#cue'),
      kegelBar: mount.querySelector('#kegelBar'), kegelLabel: mount.querySelector('#kegelLabel'), kegelCount: mount.querySelector('#kegelCount'),
      player: mount.querySelector('#player'),
    };

    mount.querySelector('#pause').addEventListener('click', () => {
      if (breakEndsAt) return; // breaks are not pausable, you are meant to release
      if (pausedRemaining == null) {
        pausedRemaining = Math.max(0, endsAt - Date.now());
        cancelAlarm(ALARM_SESSION);
        el.player.classList.add('paused');
        el.state.textContent = 'paused';
      } else {
        endsAt = Date.now() + pausedRemaining;
        pausedRemaining = null;
        scheduleAlarm(ALARM_SESSION, endsAt, `${def().label} done`, `${cfg.minutes} minutes complete.`);
        el.player.classList.remove('paused');
        el.state.textContent = 'remaining';
      }
    });
    mount.querySelector('#add5').addEventListener('click', () => {
      cfg.minutes += 5;
      if (pausedRemaining != null) pausedRemaining += 5 * 60000;
      else endsAt += 5 * 60000;
      doneAt = 0;
      el.player.classList.remove('done');
      scheduleAlarm(ALARM_SESSION, endsAt, `${def().label} done`, `${cfg.minutes} minutes complete.`);
      toast(`${cfg.minutes} minutes`);
    });
    mount.querySelector('#finish').addEventListener('click', () => end());
    mount.querySelector('#stop').addEventListener('click', () => {
      if (elapsedMs() < 30000 && !confirm('Discard this session?')) return;
      if (elapsedMs() < 30000) return abandon();
      end();
    });

    const onVisible = () => tick(); // recompute immediately on return
    document.addEventListener('visibilitychange', onVisible);

    function elapsedMs() {
      const target = cfg.minutes * 60000;
      if (pausedRemaining != null) return target - pausedRemaining;
      if (breakEndsAt) return target - breakRemaining;
      return Math.min(target - (endsAt - Date.now()), target + OVERTIME_CAP_MS);
    }

    function tick() {
      const target = cfg.minutes * 60000;

      if (breakEndsAt) {
        const left = breakEndsAt - Date.now();
        if (left <= 0) {
          breakEndsAt = 0;
          endsAt = Date.now() + breakRemaining;
          nextBreakElapsed += cfg.setBreakMin * 60000;
          scheduleAlarm(ALARM_SESSION, endsAt, `${def().label} done`, `${cfg.minutes} minutes complete.`);
          haptic('go');
          el.cue.textContent = def().cue;
          el.state.textContent = 'remaining';
        } else {
          el.clock.textContent = fmtClock(left);
          el.state.textContent = 'break, release';
          el.ring.style.strokeDashoffset = String(CIRC * (1 - left / 60000));
          return;
        }
      }

      if (pausedRemaining != null) {
        el.clock.textContent = fmtClock(pausedRemaining);
        return;
      }

      const remaining = endsAt - Date.now();
      const elapsed = target - remaining;

      if (elapsed >= nextBreakElapsed && remaining > 30000) {
        breakRemaining = remaining;
        breakEndsAt = Date.now() + 60000;
        cancelAlarm(ALARM_SESSION);
        haptic('miss');
        el.cue.textContent = 'Release. Check for numbness, dark colour or blistering before the next set.';
        notify('Set break', 'Release and check the skin. 60 seconds.');
        return;
      }

      el.clock.textContent = fmtClock(Math.max(0, remaining));
      el.ring.style.strokeDashoffset = String(CIRC * (1 - Math.min(1, elapsed / target)));
      el.prog.style.width = `${Math.min(100, (elapsed / target) * 100)}%`;

      if (remaining <= 0 && !doneAt) {
        doneAt = Date.now();
        haptic('level');
        chime('complete');
        notify(`${def().label} done`, `${cfg.minutes} minutes complete.`);
        el.state.textContent = 'done, finish when ready';
        el.player.classList.add('done');
      }

      if (cfg.kegels && cfg.type === 'pump') tickKegels();
    }

    function tickKegels() {
      const now = performance.now();
      const hold = kegelHold();
      if (kegelPhase === 'idle' || now >= kegelPhaseEnd) {
        if (kegelPhase === 'hold') {
          kegelCycles++;
          kegelPhase = 'rest';
          kegelPhaseEnd = now + hold;
          haptic('rest');
        } else {
          kegelPhase = 'hold';
          kegelPhaseEnd = now + hold;
          haptic('press');
        }
      }
      const left = Math.max(0, kegelPhaseEnd - now);
      if (el.kegelBar) {
        el.kegelBar.style.width = `${(1 - left / hold) * 100}%`;
        el.kegelBar.className = kegelPhase;
        el.kegelLabel.textContent = kegelPhase === 'hold' ? `Squeeze ${(left / 1000).toFixed(0)}s` : `Release ${(left / 1000).toFixed(0)}s`;
        el.kegelCount.textContent = `${kegelCycles} cycle${kegelCycles === 1 ? '' : 's'}`;
      }
    }

    interval = setInterval(tick, 250);
    tick();

    function cleanup() {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      cancelAlarm(ALARM_SESSION);
      wakeLock?.release?.().catch(() => {});
      document.body.classList.remove('in-session');
    }

    function abandon() {
      cleanup();
      leaveTo('#/pe');
    }

    function end() {
      const worked = Math.round(elapsedMs() / 1000);
      cleanup();
      renderFinish(Math.max(0, worked));
    }
  }

  /* ---------------- finish ---------------- */

  function renderFinish(durationSec) {
    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head"><span class="icon-btn ghost"></span><h1>Log it</h1><span class="icon-btn ghost"></span></header>

        <div class="today">
          <div class="today-left">
            <p class="eyebrow">${escapeHtml(def().label)}</p>
            <h2>${fmtClock(durationSec * 1000)}</h2>
            <p class="muted small">${escapeHtml(intensitySummary())}</p>
          </div>
        </div>

        ${def().tracksBpfsl ? `
        <section class="card">
          <label class="slider-row"><span>BPFSL after</span>${cfg.bpfslBefore ? `<b>${pe.fmtLength(cfg.bpfslBefore)} before</b>` : '<span class="tag">optional</span>'}</label>
          <div class="measure-row">
            <input type="number" inputmode="decimal" step="0.1" id="after" placeholder="e.g. 18.3">
            <span>${escapeHtml(s.units)}</span>
          </div>
          <div id="verdict"></div>
        </section>` : ''}

        <section class="card">
          <div class="rating-grid compact">
            ${[['great', 'Great'], ['ok', 'Fine'], ['flat', 'Flat'], ['bad', 'Bad']]
              .map(([id, label]) => `<button data-q="${id}" class="${id === 'ok' ? 'on' : ''}"><b>${label}</b></button>`)
              .join('')}
          </div>
          <label class="check"><input type="checkbox" id="discomfort"> Pain, numbness or discolouration</label>
          <textarea id="notes" class="notes" rows="2" placeholder="Notes (optional)"></textarea>
        </section>

        <button class="btn primary big" id="save">Save</button>
      </div>`;

    let quality = 'ok';
    mount.querySelectorAll('[data-q]').forEach((b) =>
      b.addEventListener('click', () => {
        quality = b.dataset.q;
        mount.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b));
      })
    );

    const after = mount.querySelector('#after');
    after?.addEventListener('input', () => {
      const raw = parseNum(after.value);
      const v = raw == null ? null : pe.fromDisplayLength(raw, s.units);
      const verdict = pe.bpfslVerdict(cfg.bpfslBefore, v);
      mount.querySelector('#verdict').innerHTML = verdict
        ? `<div class="notice ${verdict.level === 'good' ? 'good' : 'warn'}">${verdict.pct.toFixed(1)}%. ${escapeHtml(verdict.text)}</div>`
        : '';
    });

    mount.querySelector('#save').addEventListener('click', () => {
      const rawAfter = parseNum(after?.value);
      save({
        durationSec,
        quality,
        discomfort: mount.querySelector('#discomfort').checked,
        notes: mount.querySelector('#notes').value.trim().slice(0, 500),
        bpfslAfter: rawAfter == null ? null : pe.fromDisplayLength(rawAfter, s.units),
      });
    });
  }

  /* ---------------- save + report ---------------- */

  function save({ durationSec, quality, discomfort, notes, bpfslAfter }) {
    const record = {
      id: `pe_${Date.now()}`,
      ts: Date.now(),
      date: store.dayKey(),
      type: cfg.type,
      durationSec,
      plannedSec: cfg.minutes * 60,
      tensionKg: cfg.type === 'stretch' ? cfg.intensity : null,
      bpfslBefore: cfg.bpfslBefore,
      bpfslAfter,
      kegelCycles: cfg.kegels && cfg.type === 'pump' ? kegelCycles : 0,
      quality,
      discomfort,
      notes,
    };

    const st = store.get();
    st.pe.sessions.push(record);

    if (record.tensionKg) st.pe.settings.tensionKg = record.tensionKg;
    if (cfg.type === 'stretch') st.pe.settings.stretchMin = cfg.minutes;
    if (cfg.type === 'pump') {
      st.pe.settings.pumpMin = cfg.minutes;
      st.pe.settings.kegelDuringPump = cfg.kegels;
    }

    const ms = durationSec * 1000;
    if (ms > st.pe.prs.sessionMs) st.pe.prs.sessionMs = ms;
    const week = pe.weeklyVolumeMs(null, 1);
    if (week > st.pe.prs.weekMs) st.pe.prs.weekMs = week;
    const strk = pe.peStreak();
    if (strk > st.pe.prs.streak) st.pe.prs.streak = strk;

    let kegelLogged = 0;
    if (record.kegelCycles > 0) {
      const hold = kegelHold();
      const reps = Array.from({ length: record.kegelCycles }, () => ({ kind: 'hold', targetMs: hold, actualMs: hold }));
      st.sessions.push({
        id: `k_${Date.now()}`,
        ts: Date.now(),
        date: store.dayKey(),
        level: st.program.level,
        type: 'training',
        mode: 'auto',
        source: 'pe-pump',
        countsForPromotion: false,
        durationSec,
        reps,
        totals: { contractions: reps.length, tutMs: reps.length * hold, longestHoldMs: hold, avgHoldMs: hold },
        score: 0, completion: 1, fidelity: 1, consistency: 1,
        estimated: true, grade: '–', selfRating: null, discomfort: false,
      });
      kegelLogged = record.kegelCycles;
    }

    // One catalogue: a stretch that also ran kegels asks once.
    const earned = feats.check();
    store.save();
    renderReport(record, earned, kegelLogged);
  }

  function todayTotal() {
    return store
      .get()
      .pe.sessions.filter((x) => x.date === store.dayKey() && x.type === 'stretch')
      .reduce((a, x) => a + x.durationSec * 1000, 0);
  }

  function renderReport(record, earned, kegelLogged) {
    const verdict = pe.bpfslVerdict(record.bpfslBefore, record.bpfslAfter);
    const week = pe.weeklyVolumeMs(record.type, 1);
    const strk = pe.peStreak();
    const dec = pe.deconStatus();
    const d = pe.typeDef(record.type);

    mount.innerHTML = `
      <div class="report">
        <div class="report-hero">
          <h1>${escapeHtml(d.label)} logged</h1>
          <p class="muted">${fmtClock(record.durationSec * 1000)} · ${escapeHtml(intensitySummary())}</p>
        </div>

        <div class="stat-grid">
          <div class="stat"><b>${fmtMs(record.durationSec * 1000)}</b><span>this session</span></div>
          <div class="stat"><b>${(todayTotal() / 3600000).toFixed(1)}h</b><span>today of 2h</span></div>
          <div class="stat"><b>${strk}</b><span>day streak</span></div>
          ${record.kegelCycles ? `<div class="stat"><b>${record.kegelCycles}</b><span>kegel cycles</span></div>` : `<div class="stat"><b>${dec.consecutive}</b><span>days no rest</span></div>`}
        </div>

        ${verdict ? `<section class="card">
          <div class="bpfsl-compare">
            <div><span>Before</span><b>${pe.fmtLength(record.bpfslBefore)}</b></div>
            <div class="arrow">→</div>
            <div><span>After</span><b class="${verdict.level === 'good' ? 'good-text' : ''}">${pe.fmtLength(record.bpfslAfter)}</b></div>
            <div class="delta ${verdict.level}">${verdict.pct >= 0 ? '+' : ''}${verdict.pct.toFixed(1)}%</div>
          </div>
        </section>` : ''}

        ${record.discomfort ? '<div class="notice warn">Discomfort flagged. Take at least two days off; if it persists, see a doctor.</div>' : ''}
        ${dec.due && !record.discomfort ? `<div class="notice warn">${dec.consecutive} days without a rest day.</div>` : ''}
        ${kegelLogged ? `<p class="small muted">${kegelLogged} kegel cycles counted toward your Kegels streak too.</p>` : ''}

        ${earned.length ? `<section class="card">
          ${earned.map((a) => `<div class="pr-row"><b>${icon(a.icon || 'medal', 16)} ${escapeHtml(a.name)}</b><span>${escapeHtml(a.blurb)}</span></div>`).join('')}
        </section>` : ''}

        <button class="btn primary big" data-nav="pe">Done</button>
        <button class="btn ghost" data-nav="pe-stats">Progress</button>
      </div>`;
  }

  renderSetup();
}
