// Pocket mode: the same session, paced entirely by vibration.
//
// The point is doing kegels somewhere you cannot be seen holding a phone:
// a desk, a bus, a queue. So there is nothing to press and nothing to watch:
// distinct buzz patterns tell you when to squeeze, when to hold and when to
// let go, and the screen is a near-black card you can leave face-down.
//
// Two honesty notes, both deliberate:
//  - There is no per-rep measurement here, because there is no input. It is
//    logged as a hands-free session and scored from your own rating, flagged
//    as estimated everywhere it shows up, exactly like hands-free mode.
//  - The screen stays on (dimmed) rather than sleeping. Once Android sleeps
//    the screen it throttles timers to the point where the buzzes drift
//    seconds out, and a pacer that lies about the time is worse than none.

import * as store from '../store.js';
import * as program from './program.js';
import { fmtClock, haptic, toast } from '../ui.js';
import { icon } from '../icons.js';

// One pattern per event, chosen so they are told apart through a pocket:
// a long rising buzz to start work, a double tap to release, a triple for a
// new block, one short tick for the last three seconds of a hold.
const BUZZ = {
  work: [0, 260],
  flick: [0, 90],
  release: [0, 70, 90, 70],
  block: [0, 60, 80, 60, 80, 160],
  countdown: [0, 40],
  done: [0, 300, 120, 300],
};

function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* refused without a gesture on some browsers; nothing to surface */
  }
}

export function renderPocket(mount) {
  const state = store.get();
  const plan = program.planForToday(state);
  const session = program.buildSession({ level: plan.level, type: plan.type === 'test' ? 'training' : plan.type, deload: plan.deload });

  // The timeline is precomputed as absolute offsets so every tick is resolved
  // against the wall clock. If the browser throttles us, the next tick lands on
  // the step you should actually be on rather than resuming where it paused.
  const timeline = [];
  let at = 0;
  for (const s of session.steps) {
    const ms = s.kind === 'title' ? 1600 : s.targetMs || 0;
    timeline.push({ ...s, from: at, to: at + ms });
    at += ms;
  }
  const totalMs = at;

  let startedAt = 0;
  let timer = null;
  let lastIndex = -1;
  let wakeLock = null;
  let running = false;

  mount.innerHTML = `
    <div class="screen pocket" id="pocket">
      <header class="screen-head">
        <button class="icon-btn" id="back" aria-label="Back">${icon('back')}</button>
        <h1>Pocket mode</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div id="intro">
        <section class="card">
          <div class="h-row">${icon('vibrate', 16)}<h2>How it works</h2></div>
          <p class="small muted">Phone in your pocket, face down, wherever. It buzzes what to do. Nothing to watch, nothing to press.</p>
          <div class="buzz-key">
            <div><i class="bz long"></i><span><b>One long buzz</b>, squeeze and hold</span></div>
            <div><i class="bz short"></i><span><b>One short buzz</b>, quick flick</span></div>
            <div><i class="bz double"></i><span><b>Two quick buzzes</b>, let go completely</span></div>
            <div><i class="bz triple"></i><span><b>Three buzzes</b>, new block starting</span></div>
          </div>
          <p class="fineprint">No press-and-hold means no per-rep measurement, so this is scored from your own rating at the end and marked estimated, the same as hands-free mode. The screen stays on but goes dark: Android slows timers on a sleeping screen and the buzzes would drift.</p>
        </section>

        <div class="stat-grid">
          <div class="stat">${icon('target', 16)}<b>Week ${plan.level}</b><span>${session.def.name}</span></div>
          <div class="stat">${icon('timer', 16)}<b>${fmtClock(totalMs)}</b><span>about</span></div>
        </div>

        <button class="btn primary big" id="start">${icon('play', 18)}<span>Start</span></button>
      </div>

      <div id="run" hidden>
        <div class="pocket-face" id="face">
          <b id="pkLabel">Get ready</b>
          <span id="pkSub"></span>
          <div class="pocket-clock" id="pkClock">${fmtClock(totalMs)}</div>
          <div class="pocket-bar"><i id="pkBar"></i></div>
        </div>
        <button class="btn ghost" id="stop">End session</button>
      </div>
    </div>`;

  const $ = (id) => mount.querySelector('#' + id);

  function cue(step) {
    if (step.kind === 'title') return buzz(BUZZ.block);
    if (step.kind === 'flick') return buzz(BUZZ.flick);
    if (step.kind === 'hold' || step.kind === 'ramp' || step.kind === 'max') return buzz(BUZZ.work);
    if (step.kind === 'rest') return buzz(BUZZ.release);
    // Breathing and reverse-kegel steps are quiet on purpose: a buzz mid-breath
    // is the opposite of the thing they are meant to teach.
  }

  function tick() {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= totalMs) return finish(false);

    let idx = timeline.findIndex((s) => elapsed >= s.from && elapsed < s.to);
    if (idx < 0) idx = timeline.length - 1;
    const step = timeline[idx];

    if (idx !== lastIndex) {
      lastIndex = idx;
      cue(step);
      $('pkLabel').textContent = step.kind === 'title' ? step.label : step.label;
      $('pkSub').textContent = step.sub || step.cue || '';
      $('face').dataset.kind = step.kind;
    }

    const left = Math.max(0, step.to - elapsed);
    $('pkClock').textContent = fmtClock(Math.max(0, totalMs - elapsed));
    $('pkBar').style.width = `${((elapsed / totalMs) * 100).toFixed(1)}%`;
    // A tick in the last three seconds of a long hold, so you know it is nearly
    // over without having to look.
    if ((step.kind === 'hold' || step.kind === 'ramp') && left <= 3000 && left > 2900) buzz(BUZZ.countdown);
  }

  async function start() {
    running = true;
    startedAt = Date.now();
    lastIndex = -1;
    $('intro').hidden = true;
    $('run').hidden = false;
    document.body.classList.add('in-session');
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      /* no wake lock: the session still runs while the screen is on */
    }
    timer = setInterval(tick, 200);
    tick();
  }

  function stopTimers() {
    clearInterval(timer);
    timer = null;
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
    document.body.classList.remove('in-session');
  }

  /** One question, then it is logged exactly like a hands-free session. */
  function finish(quit) {
    if (!running) return;
    running = false;
    stopTimers();
    buzz(BUZZ.done);
    const elapsed = Date.now() - startedAt;

    if (quit && elapsed < 45000) {
      toast('Too short to log');
      location.hash = '#/kegels';
      return;
    }

    mount.innerHTML = `
      <div class="rating-gate">
        <h2>How did that feel?</h2>
        <div class="rating-grid">
          <button data-r="easy"><b>Easy</b></button>
          <button data-r="solid"><b>Solid</b></button>
          <button data-r="hard"><b>Hard</b></button>
          <button data-r="failed"><b>Struggled</b></button>
        </div>
        <label class="check"><input type="checkbox" id="pain"> Pain, aching or heaviness</label>
      </div>`;
    const pain = mount.querySelector('#pain');
    mount.querySelectorAll('.rating-grid button').forEach((b) =>
      b.addEventListener('click', () => commit(b.dataset.r, pain.checked, quit, elapsed))
    );
  }

  function commit(rating, discomfort, quit, elapsedMs) {
    const scored = program.scoreFromRating(rating);
    const workSteps = session.steps.filter(program.isWorkStep);
    // Credit the prescribed work only for the part of the timeline that
    // actually elapsed, quitting a third of the way in must not bank a full
    // session's contractions.
    const reached = timeline.filter((s) => program.isWorkStep(s) && s.to <= elapsedMs);
    const tutMs = reached.reduce((a, s) => a + (s.targetMs || 0), 0);

    const record = {
      id: `s_${Date.now()}`,
      ts: Date.now(),
      date: store.dayKey(),
      level: plan.level,
      type: plan.type === 'test' ? 'training' : plan.type,
      mode: 'auto',
      quit,
      durationSec: Math.round(elapsedMs / 1000),
      reps: reached.map((s) => ({ kind: s.kind, targetMs: s.targetMs, actualMs: s.targetMs })),
      totals: {
        contractions: reached.length,
        tutMs,
        longestHoldMs: reached.reduce((a, s) => Math.max(a, s.targetMs || 0), 0),
        avgHoldMs: reached.length ? Math.round(tutMs / reached.length) : 0,
      },
      ...scored,
      completion: workSteps.length ? reached.length / workSteps.length : 0,
      grade: program.grade(scored.score).letter,
      selfRating: rating,
      discomfort: !!discomfort,
    };

    const s = store.get();
    program.applyProgression(s, record);
    s.sessions.push(record);
    // Estimated sessions never set the max-hold PR: that number has to come
    // from a hold the app actually watched.
    if (record.totals.tutMs > s.prs.tutMs) s.prs.tutMs = record.totals.tutMs;
    if (record.score > s.prs.score) s.prs.score = record.score;
    const st = store.streak();
    if (st > s.prs.streak) s.prs.streak = st;
    program.checkBadges(s);
    store.save();

    haptic('done');
    toast('Logged, estimated score');
    location.hash = '#/kegels';
  }

  $('start').addEventListener('click', start);
  $('stop').addEventListener('click', () => finish(true));
  $('back').addEventListener('click', () => {
    stopTimers();
    running = false;
    location.hash = '#/kegels';
  });

  // Coming back to a throttled tab resyncs immediately rather than waiting for
  // the next interval, so the label matches where you actually are.
  const onVis = () => running && tick();
  document.addEventListener('visibilitychange', onVis);

  return {
    stop() {
      stopTimers();
      running = false;
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
