// A timed habit, run rather than typed. Full screen, one numeral, a ring
// filling to the target. Pausing keeps the partial; leaving is a pause.
//
// The clock lives here, not in the store: minutes land in the record on
// every pause, every finish and every whole minute, so a killed app loses at
// most the seconds since the last one.

import * as habits from './program.js';
import { escapeHtml, chime, haptic, celebrate, reducedMotion } from '../ui.js';
import { icon } from '../icons.js';
import { announce } from '../arena/result.js';
import { navigate } from '../back.js';

/** The one timer. { id, key, elapsed (ms before `since`), since (ms or null) } */
let run = null;
let ticker = null;
let wakeLock = null;

const elapsedMs = () => (run ? run.elapsed + (run.since ? Date.now() - run.since : 0) : 0);
const minutes = () => Math.floor(elapsedMs() / 60000);

/** Minutes so far, into the record. The cell shows them at once. */
function commit() {
  if (!run) return;
  const m = minutes();
  if (m !== habits.valueOn(habits.byId(run.id), run.key)) {
    habits.setValue(run.id, run.key, m || undefined);
    announce();
  }
}

function pause() {
  if (!run?.since) return;
  run.elapsed += Date.now() - run.since;
  run.since = null;
  commit();
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

async function start() {
  if (!run || run.since) return;
  run.since = Date.now();
  try {
    wakeLock = await navigator.wakeLock?.request?.('screen');
  } catch {
    /* the screen may sleep */
  }
}

/* ---------------- the screen ---------------- */

export function renderTimer(mount, id) {
  const habit = habits.byId(id);
  if (!habit || habit.kind !== 'timed') return navigate('#/habits');
  const key = habits.today();
  // A different habit, or a new day: the old run is committed and dropped.
  if (run && (run.id !== id || run.key !== key)) {
    pause();
    run = null;
  }
  if (!run) {
    const had = habits.valueOn(habit, key);
    run = { id, key, elapsed: typeof had === 'number' && had > 0 ? had * 60000 : 0, since: null };
  }
  const colour = habits.hexOf(habit.colour);
  const target = habit.target || 0;
  // A legacy row with no target still gets a ring: an hour dial.
  const dial = target || 60;
  const r = 100;
  const c = 2 * Math.PI * r;

  mount.innerHTML = `
    <div class="screen timer" style="--hc:${colour}">
      <header class="screen-head">
        <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
        <h1 style="color:${colour}">${escapeHtml(habit.name)}</h1>
        <span class="icon-btn ghost"></span>
      </header>
      <div class="timer-body">
        <div class="timer-ring">
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
            <circle class="timer-fill" cx="110" cy="110" r="${r}" fill="none" stroke="${colour}" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" transform="rotate(-90 110 110)"/>
          </svg>
          <p class="timer-num" id="num">0:00</p>
        </div>
        <p class="timer-sub" id="sub">${target ? `of ${target} min` : 'minutes'}</p>
      </div>
      <div class="timer-actions">
        <button class="btn primary big" id="toggle">Start</button>
        <button class="btn" id="finish" hidden>Finish</button>
      </div>
    </div>`;

  const num = mount.querySelector('#num');
  const ring = mount.querySelector('.timer-ring');
  const fill = mount.querySelector('.timer-fill');
  const toggle = mount.querySelector('#toggle');
  const finish = mount.querySelector('#finish');
  let ticked = -1;

  const draw = () => {
    const ms = elapsedMs();
    const s = Math.floor(ms / 1000);
    num.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // The ring carries the state, so the numeral stays the subject.
    ring.classList.toggle('held', !run?.since);
    toggle.textContent = run?.since ? 'Pause' : ms ? 'Resume' : 'Start';
    finish.hidden = !ms;
    fill.setAttribute('stroke-dashoffset', (c * (1 - Math.min(1, ms / (dial * 60000)))).toFixed(1));
    if (target) {
      // The last ten seconds to the target, and the moment it lands.
      const left = target * 60 - s;
      if (run?.since && left <= 10 && left > 0 && left !== ticked) {
        ticked = left;
        chime('timer-tick');
      }
      if (run?.since && left === 0 && ticked !== 0) {
        ticked = 0;
        chime('timer-done');
        haptic('done');
        celebrate(ring, { count: 16, spread: 90, colour });
      }
    }
    // A whole minute is worth keeping.
    if (run?.since && s % 60 === 0) commit();
  };

  clearInterval(ticker);
  ticker = setInterval(draw, 250);
  draw();

  toggle.addEventListener('click', async () => {
    haptic('press');
    if (run.since) pause();
    else await start();
    draw();
  });

  finish.addEventListener('click', () => {
    pause();
    const m = minutes();
    if (m && !reducedMotion()) celebrate(finish, { count: 10, spread: 50, colour });
    if (m && !(target && m >= target)) chime('timer-done');
    haptic('done');
    clearInterval(ticker);
    run = null;
    navigate('#/habits');
  });
}

/** Leaving the screen is a pause. The router calls this on the way out. */
export function leaveTimer() {
  clearInterval(ticker);
  pause();
}
