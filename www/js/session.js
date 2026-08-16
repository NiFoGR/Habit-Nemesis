// The guided session player.
//
// The interesting part is the input model. In "hold" mode you physically press
// and hold the screen for as long as you hold the contraction, so the app gets
// a real measurement of every single rep instead of a self-report. That is what
// makes the quality score, the fatigue curve and the max-hold PR meaningful.

import * as store from './store.js';
import * as program from './program.js';
import { haptic, beep, fmtMs } from './ui.js';

const R = 132;
const CIRC = 2 * Math.PI * R;
// How long you get to start a rep before it counts as missed.
const AWAIT_GRACE_MS = 6000;
// Hard stop so a forgotten finger on the screen cannot log a 40s "hold".
const OVERHOLD_LIMIT = 1.7;

export function startSession(mount, opts, onFinish) {
  const plan = program.buildSession(opts);
  const state = store.get();
  const mode = state.settings.inputMode;
  const isAuto = mode === 'auto';

  // Every work step is pre-registered, so reps you never got to still count
  // against completion. Quitting early is honest, not free.
  const reps = plan.steps
    .filter(program.isWorkStep)
    .map((s) => ({ kind: s.kind, targetMs: s.targetMs, actualMs: 0 }));
  let repCursor = 0;

  mount.innerHTML = `
    <div class="player" id="player">
      <div class="player-top">
        <button class="icon-btn" id="quit" aria-label="End session">✕</button>
        <div class="player-progress"><i id="prog"></i></div>
        <button class="icon-btn" id="pause" aria-label="Pause">❚❚</button>
      </div>

      <div class="player-phase">
        <div class="phase-label" id="phaseLabel">Get ready</div>
        <div class="phase-sub" id="phaseSub">${plan.def.position}</div>
      </div>

      <div class="stage" id="stage">
        <svg class="ring" viewBox="0 0 320 320" aria-hidden="true">
          <circle class="ring-track" cx="160" cy="160" r="${R}"></circle>
          <circle class="ring-target" cx="160" cy="160" r="${R}" id="ringTarget"></circle>
          <circle class="ring-fill" cx="160" cy="160" r="${R}" id="ringFill"
                  stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"></circle>
        </svg>
        <div class="stage-core" id="core">
          <div class="core-big" id="coreBig">3</div>
          <div class="core-small" id="coreSmall">starting</div>
        </div>
        <button class="hold-pad" id="pad" aria-label="Press and hold while you contract"></button>
      </div>

      <div class="player-cue" id="cue"></div>

      <div class="player-bottom">
        <div class="rep-meter"><span id="repText">—</span></div>
        <div class="rep-dots" id="dots"></div>
      </div>
    </div>`;

  const $ = (id) => mount.querySelector('#' + id);
  const el = {
    player: $('player'), prog: $('prog'), phaseLabel: $('phaseLabel'), phaseSub: $('phaseSub'),
    ringFill: $('ringFill'), ringTarget: $('ringTarget'), coreBig: $('coreBig'), coreSmall: $('coreSmall'),
    cue: $('cue'), repText: $('repText'), dots: $('dots'), pad: $('pad'), stage: $('stage'),
  };

  let i = -1;
  let step = null;
  let phase = 'idle'; // idle | title | timed | await | active | done
  let t0 = 0;
  let pausedAt = 0;
  let raf = 0;
  let pressStart = 0;
  let currentRep = null;
  let block = null; // the work step that owns the current set, kept through rests
  let blockStart = 0;
  let finished = false;
  const startedAt = Date.now();
  let wakeLock = null;

  navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});

  const sound = () => state.settings.sound;
  const buzz = (p) => state.settings.haptics && haptic(p);

  function setRing(pct, cls) {
    const p = Math.max(0, Math.min(pct, 1));
    el.ringFill.setAttribute('stroke-dashoffset', String(CIRC * (1 - p)));
    el.player.dataset.mode = cls;
  }

  function setTargetMark(frac) {
    // Dashed marker showing where the prescribed target sits on the ring.
    if (frac == null) {
      el.ringTarget.style.opacity = '0';
      return;
    }
    el.ringTarget.style.opacity = '0.9';
    const at = CIRC * Math.max(0, Math.min(frac, 1));
    el.ringTarget.setAttribute('stroke-dasharray', `3 ${CIRC}`);
    el.ringTarget.setAttribute('stroke-dashoffset', String(-at));
  }

  /** Dots stay on screen through the rest intervals too, so you can see how the
   *  set is going at the moment you most want to know: while recovering. */
  function renderDots() {
    if (!block) {
      el.dots.innerHTML = '';
      el.repText.textContent = '';
      return;
    }
    const inWork = program.isWorkStep(step);
    const doneCount = repCursor - blockStart;
    el.repText.textContent = inWork ? `rep ${step.rep} of ${block.of}` : `${Math.min(doneCount, block.of)} of ${block.of} done`;
    el.dots.innerHTML = Array.from({ length: block.of }, (_, k) => {
      const r = reps[blockStart + k];
      let cls = 'pending';
      if (k < doneCount && r) cls = r.actualMs >= r.targetMs * 0.85 ? 'good' : r.actualMs > 250 ? 'partial' : 'miss';
      else if (inWork && k === step.rep - 1) cls = 'current';
      return `<i class="${cls}"></i>`;
    }).join('');
  }

  function advance() {
    i++;
    if (i >= plan.steps.length) return finish();
    step = plan.steps[i];
    el.prog.style.width = `${(i / plan.steps.length) * 100}%`;

    if (step.kind === 'title') {
      phase = 'title';
      block = null; // a title always starts a new set
      el.phaseLabel.textContent = step.label;
      el.phaseSub.textContent = step.sub || '';
      el.coreBig.textContent = '';
      el.coreSmall.textContent = '';
      el.cue.textContent = '';
      setTargetMark(null);
      setRing(0, 'title');
      renderDots();
      buzz('phase');
      t0 = performance.now();
      return;
    }

    el.cue.textContent = step.cue || '';
    if (program.isWorkStep(step)) {
      currentRep = reps[repCursor];
      if (step.of) {
        if (!block || step.rep === 1) blockStart = repCursor;
        block = step;
      }
      el.phaseLabel.textContent = step.label;
      el.phaseSub.textContent = step.kind === 'max' ? 'as long as you can' : `${(step.targetMs / 1000).toFixed(0)}s target`;
      renderDots();
      if (isAuto) {
        phase = 'timed';
        t0 = performance.now();
        buzz('go');
        if (sound()) beep(880);
      } else {
        phase = 'await';
        t0 = performance.now();
        el.coreBig.textContent = '';
        el.coreSmall.textContent = 'press & hold';
        buzz('go');
        if (sound()) beep(880);
      }
      return;
    }

    // Passive steps: rest, breathing, reverse kegels.
    phase = 'timed';
    currentRep = null;
    el.phaseLabel.textContent = step.label;
    const next = plan.steps[i + 1];
    el.phaseSub.textContent =
      step.kind === 'rest' && next && program.isWorkStep(next) && next.of
        ? `next: rep ${next.rep} of ${next.of}`
        : '';
    setTargetMark(null);
    renderDots();
    t0 = performance.now();
    if (step.kind === 'rest') buzz('rest');
  }

  function commitRep(actualMs) {
    if (!currentRep) return;
    currentRep.actualMs = actualMs;
    repCursor++;
    currentRep = null;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (phase === 'paused' || phase === 'done') return;
    const elapsed = now - t0;

    if (phase === 'title') {
      setRing(Math.min(elapsed / 1400, 1), 'title');
      if (elapsed > 1400) advance();
      return;
    }

    if (phase === 'timed') {
      const dur = step.targetMs;
      const p = elapsed / dur;
      const isWork = program.isWorkStep(step);
      const kind = isWork ? 'work' : step.kind === 'rest' ? 'rest' : 'breath';
      // Breathing steps shrink on the exhale so the ring mirrors the lungs.
      const exhale = step.kind === 'breath' && /out/i.test(step.label);
      setRing(exhale ? 1 - p : p, kind);
      el.coreBig.textContent = Math.max(0, Math.ceil((dur - elapsed) / 1000));
      el.coreSmall.textContent = isWork ? 'hold it' : step.kind === 'rest' ? 'release fully' : 'follow along';
      if (elapsed >= dur) {
        if (isWork) commitRep(dur); // hands-free mode credits the prescribed time
        advance();
      }
      return;
    }

    if (phase === 'await') {
      const left = AWAIT_GRACE_MS - elapsed;
      setRing(Math.max(0, left / AWAIT_GRACE_MS), 'await');
      el.coreBig.textContent = '';
      el.coreSmall.textContent = 'press & hold';
      if (left <= 0) {
        commitRep(0); // missed rep, recorded as missed
        buzz('miss');
        advance();
      }
      return;
    }

    if (phase === 'active') {
      const held = now - pressStart;
      const target = step.targetMs;
      const p = held / target;
      setRing(Math.min(p, 1), p >= 1 ? 'over' : 'work');
      el.coreBig.textContent = (held / 1000).toFixed(1);
      el.coreSmall.textContent = p >= 1 ? 'strong — ease off when you fade' : `of ${(target / 1000).toFixed(0)}s`;
      if (p >= 1 && p < 1.03) {
        buzz('hit');
        if (sound()) beep(1320, 80);
      }
      const limit = step.kind === 'max' ? 120000 : target * OVERHOLD_LIMIT;
      if (held >= limit) release();
    }
  }

  function press(ev) {
    ev.preventDefault();
    if (phase !== 'await') return;
    // Capture the pointer so a thumb drifting off the pad mid-contraction does
    // not end the rep early — only lifting off does.
    try {
      el.pad.setPointerCapture(ev.pointerId);
    } catch {
      /* capture is a nicety; the pad still works without it */
    }
    phase = 'active';
    pressStart = performance.now();
    buzz('press');
    el.stage.classList.add('pressing');
    setTargetMark(1);
  }

  function release() {
    if (phase !== 'active') return;
    const held = performance.now() - pressStart;
    el.stage.classList.remove('pressing');
    setTargetMark(null);
    if (held < 250) {
      // A stray tap is not a rep — go back to waiting.
      phase = 'await';
      t0 = performance.now();
      return;
    }
    commitRep(Math.round(held));
    buzz('done');
    advance();
  }

  function togglePause() {
    if (phase === 'active') return; // never pause mid-contraction
    if (phase === 'paused') {
      t0 = performance.now() - pausedAt;
      phase = el.player.dataset.prevPhase || 'timed';
      el.player.classList.remove('paused');
    } else {
      pausedAt = performance.now() - t0;
      el.player.dataset.prevPhase = phase;
      phase = 'paused';
      el.player.classList.add('paused');
      el.coreSmall.textContent = 'paused';
    }
  }

  /** One question before the results. In hands-free mode it is the only signal
   *  we have about effort, so it drives the score; in hold mode it is context.
   *  Either way, "it hurt" is treated as a stop sign by the progression engine. */
  function finish(quit = false) {
    if (finished) return;
    finished = true;
    phase = 'done';
    cancelAnimationFrame(raf);
    wakeLock?.release?.().catch(() => {});
    detach();

    if (plan.type === 'release' || plan.type === 'quick') return commit(quit, null, false);

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
      b.addEventListener('click', () => commit(quit, b.dataset.r, pain.checked))
    );
  }

  function commit(quit, rating, discomfort) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const done = reps.filter((r) => r.actualMs > 250);
    const holdish = done.filter((r) => r.kind !== 'flick');
    const totals = {
      contractions: done.length,
      tutMs: done.reduce((a, r) => a + r.actualMs, 0),
      longestHoldMs: done.reduce((a, r) => Math.max(a, r.actualMs), 0),
      avgHoldMs: holdish.length ? Math.round(holdish.reduce((a, r) => a + r.actualMs, 0) / holdish.length) : 0,
    };

    let scored;
    if (plan.type === 'release') {
      scored = { score: 0, completion: 1, fidelity: 0, consistency: 0, estimated: false };
    } else if (plan.type === 'test') {
      const best = totals.longestHoldMs;
      const prev = store.get().prs.maxHoldMs || 1;
      scored = {
        score: Math.round(Math.min(100, best >= prev ? 100 : (best / prev) * 92)),
        completion: best > 250 ? 1 : 0,
        fidelity: Math.min(1, best / 30000),
        consistency: 1,
        estimated: false,
      };
    } else if (isAuto) {
      scored = program.scoreFromRating(rating);
    } else {
      scored = program.scoreSession(reps);
    }

    const record = {
      id: `s_${Date.now()}`,
      ts: Date.now(),
      date: store.dayKey(),
      level: plan.level,
      type: plan.type,
      mode,
      quit,
      durationSec,
      reps,
      totals,
      ...scored,
      grade: program.grade(scored.score).letter,
      selfRating: rating,
      discomfort: !!discomfort,
    };

    const s = store.get();
    const prevBest = { ...s.prs };
    const outcome = program.applyProgression(s, record);
    s.sessions.push(record);

    const prs = [];
    if (totals.longestHoldMs > s.prs.maxHoldMs) {
      s.prs.maxHoldMs = totals.longestHoldMs;
      if (prevBest.maxHoldMs > 0) prs.push({ key: 'hold', label: 'Longest hold', value: fmtMs(totals.longestHoldMs), was: fmtMs(prevBest.maxHoldMs) });
    }
    if (totals.tutMs > s.prs.tutMs) {
      s.prs.tutMs = totals.tutMs;
      if (prevBest.tutMs > 0) prs.push({ key: 'tut', label: 'Most time under tension', value: fmtMs(totals.tutMs), was: fmtMs(prevBest.tutMs) });
    }
    if (record.score > s.prs.score) {
      s.prs.score = record.score;
      if (prevBest.score > 0) prs.push({ key: 'score', label: 'Best session score', value: String(record.score), was: String(prevBest.score) });
    }
    const st = store.streak();
    if (st > s.prs.streak) s.prs.streak = st;

    const badges = program.checkBadges(s);
    store.save();

    onFinish({ record, outcome, prs, badges, plan });
  }

  function onQuit() {
    const anyWork = reps.some((r) => r.actualMs > 250);
    if (!anyWork) {
      detach();
      cancelAnimationFrame(raf);
      wakeLock?.release?.().catch(() => {});
      finished = true;
      onFinish(null);
      return;
    }
    if (confirm('End the session here? What you have done so far will be saved and scored as a partial.')) {
      finish(true);
    }
  }

  const onKey = (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (phase === 'await') press(e);
    }
  };
  const onKeyUp = (e) => {
    if (e.code === 'Space') release();
  };

  el.pad.addEventListener('pointerdown', press);
  el.pad.addEventListener('pointerup', release);
  el.pad.addEventListener('pointercancel', release);
  el.pad.addEventListener('contextmenu', (e) => e.preventDefault());
  $('pause').addEventListener('click', togglePause);
  $('quit').addEventListener('click', onQuit);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  function detach() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
  }

  // Short countdown so the first rep is not a scramble.
  el.phaseLabel.textContent = plan.type === 'release' ? 'Release day' : plan.type === 'test' ? 'Max hold test' : `Week ${plan.level} · ${plan.def.name}`;
  el.phaseSub.textContent = plan.def.position;
  el.cue.textContent = isAuto ? 'Follow the ring.' : 'Press and hold while you squeeze.';
  let countdown = 3;
  el.coreBig.textContent = String(countdown);
  el.coreSmall.textContent = 'get into position';
  const tick = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(tick);
      advance();
      raf = requestAnimationFrame(loop);
    } else {
      el.coreBig.textContent = String(countdown);
      buzz('tick');
    }
  }, 1000);

  return {
    stop() {
      clearInterval(tick);
      cancelAnimationFrame(raf);
      detach();
      wakeLock?.release?.().catch(() => {});
    },
  };
}
