// The technique walkthrough. Runs once on the first visit to Kegels, and stays
// reachable from the guide afterwards.
//
// Written for someone who has never done this and does not know what a reverse
// kegel is. Every instruction is a physical thing you can check on yourself,
// there is no anatomy vocabulary that is not immediately explained, and every
// idea gets practised before the next one arrives, reading about a muscle you
// cannot see does not teach you to find it.

import * as store from '../store.js';
import { icon } from '../icons.js';
import { haptic, toast } from '../ui.js';
import { leaveTo } from '../back.js';

/* ---------------- diagrams ----------------
   Deliberately schematic: a side-on outline with the floor drawn as a sling,
   and one arrow showing which way it is supposed to move. A realistic drawing
   would be less clear, not more. */

const sling = (arrow) => {
  const arrows = {
    up: `<path d="M100 118 L100 74" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
         <path d="M92 84 L100 72 L108 84" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    down: `<path d="M100 74 L100 118" stroke="var(--violet)" stroke-width="4" stroke-linecap="round"/>
           <path d="M92 106 L100 120 L108 106" fill="none" stroke="var(--violet)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    none: '',
  };
  // The viewBox has to leave room below the sling for both the deepest curve
  // (the reverse kegel) and its label, or the caption falls off the canvas.
  return `<svg class="diagram" viewBox="0 0 200 172" role="img" aria-hidden="true">
    <path d="M40 20 Q100 6 160 20" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
    <text x="100" y="16" text-anchor="middle" class="dg-lab">belly</text>
    <path d="M34 40 L34 112" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
    <path d="M166 40 L166 112" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
    <path d="M34 112 Q100 ${arrow === 'up' ? 118 : arrow === 'down' ? 148 : 132} 166 112"
      fill="none" stroke="${arrow === 'down' ? 'var(--violet)' : 'var(--accent)'}" stroke-width="5" stroke-linecap="round"/>
    <text x="100" y="${arrow === 'down' ? 168 : 152}" text-anchor="middle" class="dg-lab">pelvic floor</text>
    ${arrows[arrow] || ''}
  </svg>`;
};

/* ---------------- the steps ---------------- */

const STEPS = [
  {
    id: 'what',
    title: 'What you are training',
    body: `
      <p>There is a sheet of muscle slung across the bottom of your pelvis, like a hammock between your pubic bone at the front and your tailbone at the back. That sheet is the <b>pelvic floor</b>.</p>
      <p>It is the muscle you use to stop yourself passing wind, and the one that twitches at the end of a pee. You already own it and already use it. You have just never trained it on purpose.</p>
      ${sling('none')}
      <p class="small muted">Training it improves bladder control, erection firmness and ejaculatory control. It is a muscle: it responds to load and rest exactly like any other.</p>`,
  },
  {
    id: 'find',
    title: 'Find it',
    body: `
      <p>Do this now, sitting where you are:</p>
      <ol class="rules">
        <li>Imagine you are about to <b>pass wind in a quiet room</b> and need to stop it.</li>
        <li>Tighten to stop it.</li>
      </ol>
      <p>That squeeze, right at the back between your legs, is the pelvic floor. That is the muscle.</p>
      <p class="warn-inline">Do not practise by stopping your urine mid-stream. It is a useful one-off test but a bad habit, and doing it regularly causes bladder problems.</p>`,
    practice: { kind: 'find', label: 'Squeeze and hold it', ms: 3000, reps: 1, prompt: 'Hold the pad while you hold that squeeze.' },
  },
  {
    id: 'check',
    title: 'Check you have the right one',
    body: `
      <p>Almost everyone who is new to this squeezes the wrong things. Put one hand flat on your belly and squeeze again. Run through the list:</p>
      <ul class="rules">
        <li><b>Belly still?</b> If your hand rises or the stomach hardens, you are bracing your abs, not lifting the floor.</li>
        <li><b>Buttocks still?</b> If you shift in the seat, you are clenching your glutes.</li>
        <li><b>Thighs still?</b> Same. They stay completely soft.</li>
        <li><b>Still breathing?</b> If you held your breath, you were straining rather than contracting.</li>
      </ul>
      <p>If any of those moved, ease off to about half effort and try again. A quieter contraction that is <i>the right muscle</i> beats a hard one that is the wrong three.</p>`,
    practice: { kind: 'find', label: 'Hand on belly, squeeze', ms: 4000, reps: 1, prompt: 'Belly, buttocks and thighs stay still. Keep breathing.' },
  },
  {
    id: 'kegel',
    title: 'The kegel',
    body: `
      <p>A kegel is that squeeze done properly. The direction matters: it is a lift <b>up and in</b>, not a push.</p>
      ${sling('up')}
      <p>Think of the hammock lifting towards your belly button. Squeeze, hold, then let go <b>completely</b>. The release is half the exercise, and letting go slowly is a skill in itself.</p>
      <p class="small muted">In a session you will do two kinds: short sharp ones (quick flicks) for the fast-reacting fibres, and longer holds for stamina. Both matter, so every session has both.</p>`,
    practice: { kind: 'kegel', label: 'Lift up and in', ms: 4000, reps: 3, prompt: 'Three of them. Full release between each. Count to three.' },
  },
  {
    id: 'reverse',
    title: 'The reverse kegel',
    body: `
      <p>This is the one nobody explains, so plainly: <b>a reverse kegel is the exact opposite of a kegel.</b> Instead of lifting the floor up and in, you let it drop down and out.</p>
      ${sling('down')}
      <p>Ways to find it:</p>
      <ul class="rules">
        <li><b>Breathe in slowly and deeply</b>, letting your belly widen. Feel the floor sink as the air comes in. That sinking <i>is</i> the movement. A reverse kegel is doing it on purpose.</li>
        <li>Or: the very gentle feeling of <b>starting to pee</b>, or of blowing up a balloon slowly.</li>
      </ul>
      <p class="warn-inline">Gentle only. This is a lengthening and a letting-go, never a hard bear-down or a strain.</p>
      <p><b>Why bother:</b> a muscle that can only tighten and never fully release ends up permanently tight, and a permanently tight pelvic floor causes the same symptoms as a weak one: worse control, aching, worse erections. More kegels make that <i>worse</i>. Reverse kegels are the counterweight, which is why every session ends with them.</p>`,
    practice: { kind: 'reverse', label: 'Breathe in, let it drop', ms: 5000, reps: 2, prompt: 'Do not squeeze anything. Breathe in and let the floor sink and soften.' },
  },
  {
    id: 'session',
    title: 'What a session looks like',
    body: `
      <ol class="rules">
        <li><b>Warm up.</b> A couple of slow breaths so the floor starts relaxed.</li>
        <li><b>Quick flicks.</b> Sharp on, sharp off.</li>
        <li><b>Holds.</b> Squeeze and hold for the target, then rest just as long.</li>
        <li><b>Release.</b> Reverse kegels and breathing to finish.</li>
      </ol>
      <p>Two sessions a day, about four minutes each. The app paces you and counts.</p>
      <p><b>Press and hold the screen while you squeeze, and let go when you let go.</b> That is how it measures every single rep instead of taking your word for it, and why the quality score means anything.</p>
      <p class="small muted">Prefer not to hold the phone? Settings → Input mode → Hands-free just paces you instead.</p>`,
  },
  {
    id: 'expect',
    title: 'What to expect',
    body: `
      <ul class="rules">
        <li><b>Weeks 4–6</b> before you notice anything. Most of the change lands between weeks 8 and 12.</li>
        <li><b>Nothing in one session</b> is visible. That is what the streak is for.</li>
        <li><b>Do not do extra.</b> More volume does not speed this up; it just leaves you aching, and an overworked floor gets tighter, not stronger.</li>
        <li><b>Aching, heaviness or pain</b> means stop. Flag it at the end of a session and the plan drops your targets on its own.</li>
      </ul>
      <p>The plan runs 104 weeks and keeps getting harder the whole way. You are at week 1.</p>`,
  },
];

/* ---------------- the practice pad ---------------- */

/** A stripped-down version of the session player: no scoring, no records, just
 *  the feeling of the interaction so the first real session is not the first
 *  time they have ever pressed the pad. */
function practicePad(host, cfg, onDone) {
  let rep = 0;
  let holding = false;
  let start = 0;
  let raf = 0;

  host.innerHTML = `
    <div class="tut-practice">
      <div class="tut-pad-wrap">
        <svg class="tut-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" class="tp-track"/>
          <circle cx="60" cy="60" r="52" class="tp-fill" id="tpFill"
            stroke-dasharray="326.7" stroke-dashoffset="326.7"/>
        </svg>
        <button class="tut-pad" id="tpPad" type="button">
          <b id="tpBig">${cfg.kind === 'reverse' ? 'hold' : 'press'}</b>
          <span id="tpSmall">${cfg.reps > 1 ? `0 of ${cfg.reps}` : 'and hold'}</span>
        </button>
      </div>
      <p class="small muted centre" id="tpMsg">${cfg.prompt}</p>
    </div>`;

  const pad = host.querySelector('#tpPad');
  const fill = host.querySelector('#tpFill');
  const big = host.querySelector('#tpBig');
  const small = host.querySelector('#tpSmall');
  const msg = host.querySelector('#tpMsg');
  const C = 326.7;

  const setRing = (p) => fill.setAttribute('stroke-dashoffset', String(C * (1 - Math.max(0, Math.min(p, 1)))));

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!holding) return;
    const held = performance.now() - start;
    const p = held / cfg.ms;
    setRing(p);
    big.textContent = (held / 1000).toFixed(1);
    small.textContent = p >= 1 ? 'good, let go' : `of ${(cfg.ms / 1000).toFixed(0)}s`;
    if (p >= 1 && p < 1.04) haptic('hit');
    if (held > cfg.ms * 2) up();
  }

  function down(e) {
    e.preventDefault();
    if (holding) return;
    holding = true;
    start = performance.now();
    haptic('press');
    pad.classList.add('on');
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* not essential */
    }
  }

  function up() {
    if (!holding) return;
    const held = performance.now() - start;
    holding = false;
    pad.classList.remove('on');
    setRing(0);
    if (held < 400) {
      big.textContent = 'press';
      small.textContent = 'and hold';
      return;
    }
    rep++;
    haptic('done');
    if (rep >= cfg.reps) {
      cancelAnimationFrame(raf);
      pad.classList.add('done');
      big.innerHTML = icon('check', 26);
      small.textContent = 'got it';
      msg.textContent = held >= cfg.ms * 0.8 ? 'That is the movement. Next.' : 'Shorter than the target. The plan builds it up.';
      onDone();
      return;
    }
    big.textContent = 'press';
    small.textContent = `${rep} of ${cfg.reps}`;
    msg.textContent = 'Let go completely, then go again.';
  }

  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  raf = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(raf);
}

/* ---------------- screen ---------------- */

/**
 * @param {HTMLElement} mount
 * @param {object} opts
 * @param {string} [opts.only] render a single step by id, used for the
 *        "what is a reverse kegel?" link, which should not replay everything
 * @param {()=>void} [opts.onExit]
 */
export function renderTutorial(mount, { only = null, onExit = null } = {}) {
  const steps = only ? STEPS.filter((s) => s.id === only) : STEPS;
  let i = 0;
  let teardown = null;

  const leave = () => {
    teardown?.();
    if (onExit) onExit();
    else leaveTo('#/kegels');
  };

  function draw() {
    teardown?.();
    teardown = null;
    const step = steps[i];
    const last = i === steps.length - 1;

    mount.innerHTML = `
      <div class="screen tut">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <h1>${step.title}</h1>
          <button class="icon-btn ${steps.length > 1 ? 'text-btn' : 'ghost'}" id="skip" aria-label="Skip">${steps.length > 1 ? 'Skip' : ''}</button>
        </header>

        ${steps.length > 1 ? `<div class="step-bar">${steps.map((_, n) => `<i class="${n < i ? 'done' : n === i ? 'on' : ''}"></i>`).join('')}</div>` : ''}

        <section class="card tut-body">${step.body}</section>

        <div id="practice"></div>

        <button class="btn primary big" id="next" ${step.practice ? 'disabled' : ''}>
          ${last ? 'Start training' : 'Next'}
        </button>
        ${step.practice ? '<button class="btn ghost" id="skipPractice">Skip the practice</button>' : ''}
      </div>`;

    const next = mount.querySelector('#next');
    const go = () => {
      if (last) {
        if (!only) {
          store.update((st) => {
            st.settings.tutorialDone = true;
          });
        }
        leave();
      } else {
        i++;
        draw();
      }
    };
    next.addEventListener('click', go);

    mount.querySelector('#back').addEventListener('click', () => {
      if (i === 0) return leave();
      i--;
      draw();
    });
    mount.querySelector('#skip').addEventListener('click', () => {
      if (steps.length === 1) return leave();
      store.update((st) => {
        st.settings.tutorialDone = true;
      });
      toast('You can reopen this from How to');
      leave();
    });
    mount.querySelector('#skipPractice')?.addEventListener('click', () => {
      next.disabled = false;
      next.focus();
    });

    if (step.practice) {
      teardown = practicePad(mount.querySelector('#practice'), step.practice, () => {
        next.disabled = false;
      });
    }
  }

  draw();
}

export const TUTORIAL_STEP_IDS = STEPS.map((s) => s.id);
