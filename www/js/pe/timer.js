// The PE session runner: set up → run → log.
//
// Three things make this more than a stopwatch:
//  - it refuses to be silent about unsafe plans (see program.planWarnings),
//  - it enforces set breaks on pump sessions, because the damage from a long
//    unbroken vacuum set is exactly what the break prevents,
//  - it can run a kegel cadence during pumping and log it to the Kegels
//    feature, so training two things at once counts for both.

import * as store from '../store.js';
import * as pe from './program.js';
import * as kegel from '../program.js';
import { haptic, beep, fmtClock, fmtMs, notify, askNotifyPermission, escapeHtml, toast } from '../ui.js';

const R = 132;
const CIRC = 2 * Math.PI * R;

export function renderTimer(mount, opts = {}) {
  const state = store.get();
  const s = state.pe.settings;
  const cfg = {
    type: opts.type || 'stretch',
    minutes: null,
    intensity: null,
    hydroLevel: s.hydroLevel,
    kegels: s.kegelDuringPump,
    bpfslBefore: null,
    setBreakMin: 10,
  };
  const def = () => pe.typeDef(cfg.type);

  function defaults() {
    const d = def();
    cfg.minutes = cfg.type === 'stretch' ? s.stretchMin : cfg.type === 'pump' ? s.pumpMin : d.defaultMin;
    cfg.intensity = d.intensity ? (d.intensity.key === 'tensionKg' ? s.tensionKg : d.intensity.key === 'pressure' ? s.pressure : d.intensity.min * 2) : null;
  }
  defaults();

  /* ---------------- setup screen ---------------- */

  function renderSetup() {
    const d = def();
    const warnings = pe.planWarnings({ type: cfg.type, minutes: cfg.minutes, intensity: cfg.intensity });
    const isHydro = cfg.type === 'pump' && s.pumpStyle === 'hydro';
    const band = cfg.type === 'pump' ? pe.pressureBand(cfg.intensity) : null;

    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head">
          <button class="icon-btn" data-nav="pe" aria-label="Back">←</button>
          <h1>New session</h1>
          <button class="icon-btn" data-nav="pe-guide" aria-label="Safety guide">?</button>
        </header>

        <div class="type-grid">
          ${pe.TYPE_LIST.map(
            (t) => `<button class="type-chip ${t.id === cfg.type ? 'on' : ''}" data-type="${t.id}" style="--c:${t.colour}">
              <b>${t.icon}</b><span>${escapeHtml(t.label)}</span>
            </button>`
          ).join('')}
        </div>

        <section class="card">
          <h2>${escapeHtml(d.label)}</h2>
          <p class="small muted">${escapeHtml(d.blurb)}</p>
          <p class="cue"><b>Technique:</b> ${escapeHtml(d.cue)}</p>
        </section>

        <section class="card">
          <label class="slider-row">
            <span>Duration</span><b id="durOut">${cfg.minutes} min</b>
          </label>
          <input type="range" id="dur" min="1" max="${cfg.type === 'clamp' ? 15 : 120}" step="1" value="${cfg.minutes}">

          ${d.intensity && !isHydro ? `
          <label class="slider-row">
            <span>${escapeHtml(d.intensity.label)}</span>
            <b id="intOut">${intensityText()}</b>
          </label>
          <input type="range" id="int" min="${d.intensity.min}" max="${d.intensity.max}" step="${d.intensity.step}" value="${cfg.intensity}">
          ${band ? `<p class="band ${band.label === 'Hard ceiling' ? 'danger' : ''}"><b>${escapeHtml(band.label)}</b> — ${escapeHtml(band.note)}</p>` : ''}
          ` : ''}

          ${isHydro ? `
          <label class="slider-row"><span>Intensity</span><b id="hydroOut">Level ${cfg.hydroLevel} / 5</b></label>
          <input type="range" id="hydro" min="1" max="5" step="1" value="${cfg.hydroLevel}">
          <p class="small muted">Your Hydromax has no gauge, so this is how hard you pumped it, by feel. It is only a diary entry — the app never treats it as a real pressure reading.</p>
          ` : ''}

          ${cfg.type === 'pump' ? `
          <label class="slider-row"><span>Break every</span><b id="brkOut">${cfg.setBreakMin} min</b></label>
          <input type="range" id="brk" min="5" max="20" step="1" value="${cfg.setBreakMin}">
          <p class="small muted">The timer stops at each break and tells you to release and check the skin.</p>
          ` : ''}
        </section>

        ${cfg.type === 'pump' ? `
        <section class="card">
          <label class="setting toggle">
            <span><b>Kegels while pumping</b><i>Runs a squeeze/release cadence during the session and logs it to your Kegels streak too.</i></span>
            <input type="checkbox" id="keg" ${cfg.kegels ? 'checked' : ''}>
          </label>
        </section>` : ''}

        ${def().tracksBpfsl ? `
        <section class="card">
          <h2>BPFSL before <span class="tag">optional</span></h2>
          <p class="small muted">Bone-pressed flaccid stretched length, taken now and again at the end. It is the fastest feedback you have — it moves within a session, months before erect length does.</p>
          <div class="measure-row">
            <input type="number" inputmode="decimal" step="0.1" id="bpfsl" placeholder="e.g. 17.8">
            <span>${escapeHtml(s.units)}</span>
          </div>
        </section>` : ''}

        ${warnings.length ? `<div class="warn-stack">${warnings
          .map((w) => `<div class="notice ${w.level === 'stop' ? 'warn' : w.level === 'warn' ? 'warn' : ''}">${escapeHtml(w.text)}</div>`)
          .join('')}</div>` : ''}

        <button class="btn primary big" id="start">Start ${escapeHtml(d.label.toLowerCase())}</button>
        <button class="btn ghost" data-nav="pe">Cancel</button>
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
    bind('hydro', 'hydroOut', (v) => (cfg.hydroLevel = v));
    bind('brk', 'brkOut', (v) => (cfg.setBreakMin = v));

    mount.querySelector('#keg')?.addEventListener('change', (e) => (cfg.kegels = e.target.checked));
    mount.querySelector('#start').addEventListener('click', async () => {
      const raw = mount.querySelector('#bpfsl')?.value;
      cfg.bpfslBefore = raw ? pe.fromDisplayLength(Number(raw), s.units) : null;
      await askNotifyPermission();
      run();
    });
  }

  function intensityText() {
    const d = def();
    if (!d.intensity) return '';
    if (d.intensity.key === 'pressure') return pe.fmtPressure(cfg.intensity);
    return `${cfg.intensity} ${d.intensity.unit}`.trim();
  }

  function outText(id) {
    if (id === 'dur') return `${cfg.minutes} min`;
    if (id === 'int') return intensityText();
    if (id === 'hydro') return `Level ${cfg.hydroLevel} / 5`;
    return `${cfg.setBreakMin} min`;
  }

  /* ---------------- running ---------------- */

  let raf = 0;
  let wakeLock = null;
  let running = false;
  let startedAt = 0;
  let accumulatedMs = 0; // time actually spent working, excluding pauses
  let lastTick = 0;
  let nextBreakAt = 0;
  let onBreak = false;
  let breakEndsAt = 0;
  let notified = false;
  let kegelPhase = 'idle';
  let kegelPhaseEnd = 0;
  let kegelCycles = 0;
  const kegelHold = () => kegel.levelDef(store.get().program.level).holds.holdMs;

  function run() {
    const targetMs = cfg.minutes * 60000;
    startedAt = Date.now();
    accumulatedMs = 0;
    lastTick = performance.now();
    running = true;
    nextBreakAt = cfg.type === 'pump' ? cfg.setBreakMin * 60000 : Infinity;
    kegelCycles = 0;
    document.body.classList.add('in-session');
    navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});

    mount.innerHTML = `
      <div class="player pe-player" id="player">
        <div class="player-top">
          <button class="icon-btn" id="stop" aria-label="Finish">✕</button>
          <div class="player-progress"><i id="prog"></i></div>
          <button class="icon-btn" id="pause" aria-label="Pause">❚❚</button>
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
      prog: mount.querySelector('#prog'), cue: mount.querySelector('#cue'), sub: mount.querySelector('#sub'),
      kegelBar: mount.querySelector('#kegelBar'), kegelLabel: mount.querySelector('#kegelLabel'), kegelCount: mount.querySelector('#kegelCount'),
    };

    mount.querySelector('#pause').addEventListener('click', () => {
      running = !running;
      lastTick = performance.now();
      mount.querySelector('#player').classList.toggle('paused', !running);
      el.state.textContent = running ? 'remaining' : 'paused';
    });
    mount.querySelector('#add5').addEventListener('click', () => {
      cfg.minutes += 5;
      toast(`Extended to ${cfg.minutes} minutes`);
    });
    mount.querySelector('#finish').addEventListener('click', () => end());
    mount.querySelector('#stop').addEventListener('click', () => {
      if (accumulatedMs < 30000 && !confirm('Discard this session? Under 30 seconds is not worth logging.')) return;
      if (accumulatedMs < 30000) return abandon();
      end();
    });

    // Recompute from wall-clock when the app comes back, since background tabs
    // get their timers throttled to near-uselessness.
    const onVisible = () => {
      if (document.visibilityState === 'visible') lastTick = performance.now();
    };
    document.addEventListener('visibilitychange', onVisible);

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = now - lastTick;
      lastTick = now;
      if (running && !onBreak) accumulatedMs += dt;

      const target = cfg.minutes * 60000;
      const remaining = target - accumulatedMs;

      if (onBreak) {
        const left = breakEndsAt - Date.now();
        el.clock.textContent = fmtClock(Math.max(0, left));
        el.state.textContent = 'break — release';
        el.ring.style.strokeDashoffset = String(CIRC * (1 - Math.max(0, left) / 60000));
        if (left <= 0) {
          onBreak = false;
          nextBreakAt = accumulatedMs + cfg.setBreakMin * 60000;
          haptic('go');
          el.cue.textContent = def().cue;
        }
        return;
      }

      el.clock.textContent = fmtClock(Math.max(0, remaining));
      el.ring.style.strokeDashoffset = String(CIRC * (1 - Math.min(1, accumulatedMs / target)));
      el.prog.style.width = `${Math.min(100, (accumulatedMs / target) * 100)}%`;

      if (accumulatedMs >= nextBreakAt && remaining > 30000) {
        onBreak = true;
        breakEndsAt = Date.now() + 60000;
        haptic('miss');
        el.cue.textContent = 'Release the vacuum. Check for numbness, dark discolouration or blistering before the next set.';
        notify('Set break', 'Release and check the skin. Next set in 60 seconds.');
        return;
      }

      if (remaining <= 0 && !notified) {
        notified = true;
        haptic('level');
        beep(880, 200);
        notify(`${def().label} done`, `${cfg.minutes} minutes complete. Log it when you are ready.`);
        el.state.textContent = 'complete — you can stop';
        mount.querySelector('#player').classList.add('done');
      }

      if (cfg.kegels && cfg.type === 'pump' && running) tickKegels(el, now);
    }
    raf = requestAnimationFrame(frame);

    /** A simple hold/release cadence at the level the Kegels feature has you
     *  on, so the two features stay in step instead of inventing a second
     *  standard. */
    function tickKegels(el, now) {
      const hold = kegelHold();
      const rest = hold;
      if (kegelPhase === 'idle' || now >= kegelPhaseEnd) {
        if (kegelPhase === 'hold') {
          kegelCycles++;
          kegelPhase = 'rest';
          kegelPhaseEnd = now + rest;
          haptic('rest');
        } else {
          kegelPhase = 'hold';
          kegelPhaseEnd = now + hold;
          haptic('press');
        }
      }
      const total = kegelPhase === 'hold' ? hold : rest;
      const left = Math.max(0, kegelPhaseEnd - now);
      if (el.kegelBar) {
        el.kegelBar.style.width = `${(1 - left / total) * 100}%`;
        el.kegelBar.className = kegelPhase;
        el.kegelLabel.textContent = kegelPhase === 'hold' ? `Squeeze — ${(left / 1000).toFixed(0)}s` : `Release — ${(left / 1000).toFixed(0)}s`;
        el.kegelCount.textContent = `${kegelCycles} cycle${kegelCycles === 1 ? '' : 's'}`;
      }
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock?.release?.().catch(() => {});
      document.body.classList.remove('in-session');
    }

    function abandon() {
      cleanup();
      location.hash = '#/pe';
    }

    function end() {
      cleanup();
      renderFinish(Math.round(accumulatedMs / 1000));
    }
  }

  function intensitySummary() {
    const d = def();
    if (cfg.type === 'pump' && s.pumpStyle === 'hydro') return `Level ${cfg.hydroLevel}/5 · break every ${cfg.setBreakMin} min`;
    if (!d.intensity) return `${cfg.minutes} min`;
    return `${intensityText()} · ${cfg.minutes} min`;
  }

  /* ---------------- finish screen ---------------- */

  function renderFinish(durationSec) {
    mount.innerHTML = `
      <div class="screen">
        <header class="screen-head"><span class="icon-btn ghost"></span><h1>Log the session</h1><span class="icon-btn ghost"></span></header>

        <div class="today">
          <div class="today-left">
            <p class="eyebrow">${escapeHtml(def().label)}</p>
            <h2>${fmtClock(durationSec * 1000)}</h2>
            <p class="muted small">${escapeHtml(intensitySummary())}</p>
          </div>
        </div>

        ${def().tracksBpfsl ? `
        <section class="card">
          <h2>BPFSL after</h2>
          <p class="small muted">${cfg.bpfslBefore ? `Before: <b>${pe.fmtLength(cfg.bpfslBefore)}</b>. A good session usually reads about 5% longer now.` : 'Optional — but pairs of before/after readings are what make the fatigue and response charts work.'}</p>
          <div class="measure-row">
            <input type="number" inputmode="decimal" step="0.1" id="after" placeholder="e.g. 18.3">
            <span>${escapeHtml(s.units)}</span>
          </div>
          <div id="verdict"></div>
        </section>` : ''}

        <section class="card">
          <h2>How did it go?</h2>
          <div class="rating-grid compact">
            ${[['great', 'Great', 'strong, no issues'], ['ok', 'Fine', 'normal session'], ['flat', 'Flat', 'little response'], ['bad', 'Bad', 'sore or uncomfortable']]
              .map(([id, label, sub]) => `<button data-q="${id}"><b>${label}</b><span>${sub}</span></button>`)
              .join('')}
          </div>
          <label class="check"><input type="checkbox" id="discomfort"> Pain, numbness, discolouration or blistering</label>
          <textarea id="notes" class="notes" rows="2" placeholder="Notes (optional)"></textarea>
        </section>

        <button class="btn primary big" id="save">Save session</button>
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
      const v = after.value ? pe.fromDisplayLength(Number(after.value), s.units) : null;
      const verdict = pe.bpfslVerdict(cfg.bpfslBefore, v);
      mount.querySelector('#verdict').innerHTML = verdict
        ? `<div class="notice ${verdict.level === 'good' ? 'good' : 'warn'}">${verdict.pct.toFixed(1)}% — ${escapeHtml(verdict.text)}</div>`
        : '';
    });

    mount.querySelector('#save').addEventListener('click', () => {
      const bpfslAfter = after?.value ? pe.fromDisplayLength(Number(after.value), s.units) : null;
      save({
        durationSec,
        quality,
        discomfort: mount.querySelector('#discomfort').checked,
        notes: mount.querySelector('#notes').value.trim().slice(0, 500),
        bpfslAfter,
      });
    });
  }

  /* ---------------- persistence ---------------- */

  function save({ durationSec, quality, discomfort, notes, bpfslAfter }) {
    const record = {
      id: `pe_${Date.now()}`,
      ts: Date.now(),
      date: store.dayKey(),
      type: cfg.type,
      durationSec,
      plannedSec: cfg.minutes * 60,
      tensionKg: cfg.type === 'stretch' ? cfg.intensity : null,
      pressure: cfg.type === 'pump' && s.pumpStyle !== 'hydro' ? cfg.intensity : null,
      hydroLevel: cfg.type === 'pump' && s.pumpStyle === 'hydro' ? cfg.hydroLevel : null,
      strokes: cfg.type === 'jelq' ? cfg.intensity : null,
      bpfslBefore: cfg.bpfslBefore,
      bpfslAfter,
      kegelCycles: cfg.kegels && cfg.type === 'pump' ? kegelCycles : 0,
      quality,
      discomfort,
      notes,
    };

    const st = store.get();
    st.pe.sessions.push(record);

    // Remember the settings actually used, so the next session starts from
    // what you did last time rather than from a factory default.
    if (record.tensionKg) st.pe.settings.tensionKg = record.tensionKg;
    if (record.pressure) st.pe.settings.pressure = record.pressure;
    if (record.hydroLevel) st.pe.settings.hydroLevel = record.hydroLevel;
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

    // Kegels done inside a pump session are real reps, so they count toward
    // the Kegels streak and lifetime totals — but not toward promotion, since
    // there is no per-rep measurement behind them.
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
        totals: {
          contractions: reps.length,
          tutMs: reps.length * hold,
          longestHoldMs: hold,
          avgHoldMs: hold,
        },
        score: 0,
        completion: 1,
        fidelity: 1,
        consistency: 1,
        estimated: true,
        grade: '–',
        selfRating: null,
        discomfort: false,
      });
      kegelLogged = record.kegelCycles;
    }

    const earned = pe.checkAchievements(st);
    const kegelBadges = kegel.checkBadges(st);
    store.save();

    renderReport(record, earned.concat(kegelBadges), kegelLogged);
  }

  /* ---------------- post-session report ---------------- */

  function renderReport(record, earned, kegelLogged) {
    const verdict = pe.bpfslVerdict(record.bpfslBefore, record.bpfslAfter);
    const week = pe.weeklyVolumeMs(record.type, 1);
    const strk = pe.peStreak();
    const dec = pe.deconStatus();
    const d = pe.typeDef(record.type);

    mount.innerHTML = `
      <div class="report">
        <div class="report-hero">
          <div class="hero-icon" style="color:${d.colour}">${d.icon}</div>
          <h1>${escapeHtml(d.label)} logged</h1>
          <p class="muted">${fmtClock(record.durationSec * 1000)} · ${escapeHtml(intensitySummary())}</p>
        </div>

        <div class="stat-grid">
          <div class="stat"><b>${fmtMs(record.durationSec * 1000)}</b><span>this session</span></div>
          <div class="stat"><b>${(week / 3600000).toFixed(1)}h</b><span>${escapeHtml(d.label.toLowerCase())} this week</span></div>
          <div class="stat"><b>${strk}</b><span>day streak</span></div>
          ${record.kegelCycles ? `<div class="stat"><b>${record.kegelCycles}</b><span>kegel cycles</span></div>` : `<div class="stat"><b>${dec.consecutive}</b><span>days without rest</span></div>`}
        </div>

        ${verdict ? `<section class="card">
          <h2>What your tissue did</h2>
          <div class="bpfsl-compare">
            <div><span>Before</span><b>${pe.fmtLength(record.bpfslBefore)}</b></div>
            <div class="arrow">→</div>
            <div><span>After</span><b class="${verdict.level === 'good' ? 'good-text' : ''}">${pe.fmtLength(record.bpfslAfter)}</b></div>
            <div class="delta ${verdict.level}">${verdict.pct >= 0 ? '+' : ''}${verdict.pct.toFixed(1)}%</div>
          </div>
          <p class="small muted">${escapeHtml(verdict.text)}</p>
        </section>` : ''}

        ${kegelLogged ? `<section class="card">
          <h2>Counted twice</h2>
          <p class="small muted">${kegelLogged} kegel cycles were logged to your Kegels feature as well, so today counts for that streak too. They do not count toward levelling up there — that needs the measured press-and-hold reps.</p>
        </section>` : ''}

        ${record.discomfort ? `<div class="notice warn">You flagged pain or discolouration. Take at least two days off, and if it is still there after that, it is a doctor's question rather than a training one.</div>` : ''}
        ${dec.due && !record.discomfort ? `<div class="notice warn">${dec.consecutive} days straight. Book a few days off — remodelling happens in the gaps.</div>` : ''}

        ${earned.length ? `<section class="card">
          <h2>Unlocked</h2>
          ${earned.map((a) => `<div class="pr-row"><b>🏅 ${escapeHtml(a.name)}</b><span>${escapeHtml(a.desc)}</span></div>`).join('')}
        </section>` : ''}

        <div class="motivation">${escapeHtml(closingLine(record, strk, week))}</div>

        <button class="btn primary big" data-nav="pe">Done</button>
        <button class="btn ghost" data-nav="pe-stats">See the numbers</button>
      </div>`;
  }

  function closingLine(record, strk, week) {
    const lifetime = store.get().pe.sessions.filter((x) => x.type === record.type).reduce((a, x) => a + x.durationSec, 0) / 3600;
    if (record.discomfort) return 'You flagged discomfort, which is the single most useful thing you can log. Backing off now is what keeps you training in six months.';
    if (strk >= 30) return `${strk} days unbroken. Length work is a volume game measured in months — you are winning the only part you control.`;
    if (record.bpfslAfter && record.bpfslBefore && record.bpfslAfter / record.bpfslBefore >= 1.05) return 'A 5% stretch response means the tissue genuinely took the load today. That is the stimulus that eventually shows up in erect length.';
    return `${lifetime.toFixed(1)} lifetime hours of ${pe.typeDef(record.type).label.toLowerCase()}. The trials that produced real gains ran for months at a time — every hour is a deposit.`;
  }

  renderSetup();
}
