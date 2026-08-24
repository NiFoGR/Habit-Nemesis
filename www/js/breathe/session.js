// The five minutes themselves.
//
// Three things pace you, and they fail independently on purpose:
//
//   Sound is scheduled on the AudioContext timeline in advance, as one
//   oscillator whose pitch and volume are automated across the whole session.
//   That makes it sample-accurate and completely immune to timer throttling,
//   which matters because this runs with the screen black and the phone face
//   up on your chest. Two nodes for five minutes, so it costs nothing.
//
//   Vibration marks the turn of each phase and nothing else. A continuous buzz
//   through a breath is the opposite of the thing this is for, and it empties
//   the battery arguing with you.
//
//   The screen is the least important of the three and is drawn accordingly:
//   near-black, a dim orb that expands and contracts, and a tap anywhere to
//   put even that out. It is a light source pointed at your face at bedtime,
//   so the default is as little of it as will still be useful.
//
// The visual timer resolves every tick against the wall clock rather than
// counting intervals, the same as pocket.js, so a throttled tab redraws on the
// phase you are actually on.

import * as store from '../store.js';
import * as breathe from './program.js';
import { fmtClock, fmtDuration, escapeHtml } from '../ui.js';
import { icon } from '../icons.js';

// Gentle and distinguishable through a shirt: one soft pulse to breathe in,
// two to breathe out, three light taps to hold. Nothing long enough to be a
// jolt, because a jolt is an arousal.
const BUZZ = {
  in: [0, 150],
  out: [0, 70, 90, 70],
  hold: [0, 40, 60, 40, 60, 40],
  settle: [0, 60],
  done: [0, 200, 160, 200],
};

// A fifth, low enough to feel rather than hear. The breath rides the interval
// up and back down, so you can follow it with your eyes shut and no counting.
const LO_HZ = 98;
const HI_HZ = 146.8;
const FLOOR = 0.0006; // exponential ramps cannot reach zero
const SOFT = 0.012;
const FULL = 0.07;

/** Where each phase is taking the pitch, the volume and the orb. */
function targetFor(step) {
  switch (step.kind) {
    case 'settle':
      return { hz: LO_HZ, gain: SOFT, scale: 0.52 };
    case 'in':
      // The stacked second inhale of a physiological sigh goes to the top; the
      // first one stops short of it, so the sip on top has somewhere to go.
      return step.sigh && !step.stack
        ? { hz: LO_HZ + (HI_HZ - LO_HZ) * 0.6, gain: FULL * 0.7, scale: 0.84 }
        : { hz: HI_HZ, gain: FULL, scale: 1 };
    case 'hold':
      return { hz: HI_HZ, gain: FULL * 0.75, scale: 1 };
    case 'out':
      return { hz: LO_HZ, gain: FLOOR * 6, scale: 0.5 };
    default:
      return { hz: LO_HZ, gain: SOFT, scale: 0.52 };
  }
}

export function startBreathe(mount, onDone) {
  const s = breathe.settings();
  const app = store.get().settings;
  const plan = breathe.buildTimeline(s.pattern, s.minutes * 60000);

  const useSound = s.sound !== false;
  const useBuzz = s.vibrate !== false && app.haptics !== false;

  let startedAt = 0;
  let timer = null;
  let lastIndex = -1;
  let wakeLock = null;
  let running = false;
  let ctx = null;
  let osc = null;
  let master = null;

  function buzz(pattern) {
    if (!useBuzz) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* refused without a gesture on some browsers; nothing to surface */
    }
  }

  mount.innerHTML = `
    <div class="screen breathe-run" id="brScreen">
      <header class="screen-head" id="brHead">
        <button class="icon-btn" data-back id="close" aria-label="Close">${icon('close')}</button>
        <h1>Wind-down</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div id="intro">
        <section class="card">
          <div class="h-row">${icon('breath', 16)}<h2>${escapeHtml(plan.pattern.label)}</h2></div>
          <p class="small muted">${escapeHtml(plan.pattern.blurb)}</p>
          <p class="small muted">Lie down. Phone on your chest or your belly, screen up, and leave it there. It starts with three long sighs to take the edge off, then ${plan.breaths} breaths at ${escapeHtml(plan.pattern.short)}.</p>
          <div class="buzz-key">
            <div><i class="bz long"></i><span><b>One soft buzz</b>, breathe in</span></div>
            <div><i class="bz double"></i><span><b>Two buzzes</b>, breathe out</span></div>
            ${plan.pattern.holdMs ? `<div><i class="bz triple"></i><span><b>Three light taps</b>, hold</span></div>` : ''}
          </div>
          <p class="fineprint">The tone rises as you breathe in and falls as you breathe out, so you can follow it with your eyes shut. Tap the screen once it starts to black it out completely.</p>
        </section>

        <div class="stat-grid">
          <div class="stat">${icon('timer', 16)}<b>${fmtClock(plan.totalMs)}</b><span>${plan.breaths} breaths</span></div>
          <div class="stat">${icon('breath', 16)}<b>${escapeHtml(plan.pattern.short)}</b><span>seconds</span></div>
        </div>

        <button class="btn primary big" id="start">${icon('play', 18)}<span>Begin</span></button>
      </div>

      <div id="run" hidden>
        <div class="br-face" id="face">
          <div class="br-orb" id="orb"></div>
          <b id="brLabel">Settle</b>
          <span id="brSub">Phone on your chest, eyes closed</span>
          <div class="br-clock" id="brClock">${fmtClock(plan.totalMs)}</div>
        </div>
        <button class="btn ghost" id="stop">End</button>
      </div>
    </div>`;

  const $ = (id) => mount.querySelector('#' + id);

  /* ---------------- sound ----------------
     The whole session is written onto the audio timeline in one pass, before
     the first breath. Nothing here is driven by a timer afterwards, which is
     the point: setInterval is throttled on a sleeping screen, and this is not. */

  function scheduleAudio() {
    if (!useSound) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume?.();
      osc = ctx.createOscillator();
      master = ctx.createGain();
      osc.type = 'sine';
      osc.connect(master).connect(ctx.destination);

      const t0 = ctx.currentTime + 0.06;
      let hz = LO_HZ;
      let gain = FLOOR;
      osc.frequency.setValueAtTime(hz, t0);
      master.gain.setValueAtTime(gain, t0);

      for (const step of plan.steps) {
        const from = t0 + step.from / 1000;
        const to = t0 + step.to / 1000;
        const t = targetFor(step);
        osc.frequency.setValueAtTime(hz, from);
        osc.frequency.linearRampToValueAtTime(t.hz, to);
        master.gain.setValueAtTime(Math.max(gain, FLOOR), from);
        master.gain.exponentialRampToValueAtTime(Math.max(t.gain, FLOOR), to);
        hz = t.hz;
        gain = t.gain;
      }

      const end = t0 + plan.totalMs / 1000;
      master.gain.exponentialRampToValueAtTime(FLOOR, end + 0.4);
      osc.start(t0);
      osc.stop(end + 0.6);
    } catch {
      /* audio is a nicety here, never a requirement: the buzz still paces you */
      ctx = null;
    }
  }

  function stopAudio() {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, FLOOR), now);
      master.gain.exponentialRampToValueAtTime(FLOOR, now + 0.35);
      osc.stop(now + 0.4);
    } catch {
      /* already stopped */
    }
    const dying = ctx;
    ctx = null;
    osc = null;
    master = null;
    setTimeout(() => dying.close?.().catch(() => {}), 600);
  }

  /* ---------------- the loop ---------------- */

  function tick() {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= plan.totalMs) return finish(false);

    let idx = plan.steps.findIndex((st) => elapsed >= st.from && elapsed < st.to);
    if (idx < 0) idx = plan.steps.length - 1;
    const step = plan.steps[idx];

    if (idx !== lastIndex) {
      lastIndex = idx;
      // A stacked sigh is one continuous inhale in two pushes, so it does not
      // get a second buzz: that would read as a new instruction.
      if (!step.stack) buzz(BUZZ[step.kind] || BUZZ.settle);
      const t = targetFor(step);
      const orb = $('orb');
      orb.style.transitionDuration = `${step.ms}ms`;
      orb.style.transform = `scale(${t.scale})`;
      $('face').dataset.kind = step.kind;
      $('brLabel').textContent = step.label;
      $('brSub').textContent = step.sub || '';
    }

    $('brClock').textContent = fmtClock(Math.max(0, plan.totalMs - elapsed));
  }

  async function start() {
    running = true;
    startedAt = Date.now();
    lastIndex = -1;
    $('intro').hidden = true;
    $('run').hidden = false;
    document.body.classList.add('in-session');
    scheduleAudio();
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      /* no wake lock: it still runs for as long as the screen stays on */
    }
    timer = setInterval(tick, 100);
    tick();
  }

  function stopTimers() {
    clearInterval(timer);
    timer = null;
    stopAudio();
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
    document.body.classList.remove('in-session', 'blacked');
  }

  /** Nothing is scored, so finishing only has to decide whether enough
   *  happened to be worth writing down. A minute is the line: below it you put
   *  the phone down, above it you breathed. */
  function finish(quit) {
    if (!running) return;
    running = false;
    const elapsed = Math.min(Date.now() - startedAt, plan.totalMs);
    stopTimers();
    buzz(BUZZ.done);

    if (elapsed >= 60000) breathe.markDone({ ms: elapsed, pattern: plan.pattern.id });
    renderDone(mount, { ms: elapsed, quit, logged: elapsed >= 60000 }, () => onDone(true));
  }

  $('start').addEventListener('click', start);
  $('stop').addEventListener('click', () => finish(true));
  $('face').addEventListener('click', () => {
    // Blacking the screen out is the point of the gesture, so it is the whole
    // face rather than a control you would have to find in the dark. It goes on
    // the body because the screen element does not paint the whole viewport,
    // and a black card on a very dark grey background is not black.
    document.body.classList.toggle('blacked');
  });
  $('close').addEventListener('click', () => {
    if (!running || confirm('Stop the wind-down?')) {
      if (running) return finish(true);
      stopTimers();
      onDone(false);
    }
  });

  // Coming back to a throttled tab resyncs immediately rather than waiting for
  // the next interval, so the orb matches the breath you should be on.
  const onVis = () => running && tick();
  document.addEventListener('visibilitychange', onVis);

  return {
    stop() {
      running = false;
      stopTimers();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

/** The close. Deliberately almost nothing: it is dark, you are lying down, and
 *  the next thing that should happen is sleep, not a scoreboard. */
function renderDone(mount, { ms, logged }, onExit) {
  const st = breathe.streak();
  mount.innerHTML = `
    <div class="screen breathe-done">
      <div class="br-done-mark">${icon('check', 30)}</div>
      <h1>Goodnight</h1>
      <p class="muted small">${logged
        ? `${fmtDuration(ms / 1000)} breathing${st > 1 ? ` · ${st} nights` : ''}`
        : 'Too short to note. No matter.'}</p>
      <button class="btn ghost" id="done">Done</button>
    </div>`;
  mount.querySelector('#done').addEventListener('click', onExit);
}
