// The Kegels section: its home screen, its how-to, and its settings.
//
// Everything reachable from the Kegels tile that is not the session player
// itself. The player is session.js, the plan is program.js.

import * as store from '../store.js';
import * as program from './program.js';
import { reviewDue } from './review.js';
import { renderTutorial } from './tutorial.js';
import { fmtMs, ringSvg, escapeHtml, toast, sparkline } from '../ui.js';
import { icon } from '../icons.js';
import { kegelName } from '../names.js';
import { scheduleDaily, cancelAlarm, ALARM_KEGEL_REMINDER } from '../native.js';

/* ---------------- home ---------------- */

export function renderKegels(mount) {
  const state = store.get();
  // Nobody's first kegel should be guesswork. Straight into the walkthrough on
  // a genuinely fresh install; after that it is a link, not a gate.
  if (!state.settings.tutorialDone && state.sessions.length === 0) {
    return renderTutorial(mount, { onExit: () => renderKegels(mount) });
  }
  const plan = program.planForToday(state);
  const def = program.levelDef(plan.level);
  const st = store.streak();

  // Last 7 days as dots: done / release / missed.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = store.addDays(store.dayKey(), -i);
    const on = store.sessionsOn(key);
    days.push({ key, cls: on.some((x) => x.type !== 'release') ? 'good' : on.length ? 'rest' : i === 0 ? 'today' : 'none' });
  }
  const weekScored = state.sessions.filter((x) => x.ts >= Date.now() - 7 * 864e5 && x.countsForPromotion !== false && x.type !== 'release');
  const weekAvg = weekScored.length ? Math.round(weekScored.reduce((a, x) => a + x.score, 0) / weekScored.length) : null;
  const recentScores = state.sessions
    .filter((x) => x.countsForPromotion !== false && x.type !== 'release')
    .slice(-20)
    .map((x) => x.score);

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(kegelName())}</h1>
        <button class="icon-btn" data-nav="track" aria-label="Tracking">${icon('chart')}</button>
      </header>

      <div class="today ${plan.type}">
        <div class="today-left">
          <h2>${escapeHtml(plan.type === 'release' ? 'Release day' : plan.type === 'test' ? 'Max hold test' : `Week ${plan.level}, ${def.name}`)}</h2>
          <p class="muted small">${st ? `${st}d streak` : 'No streak yet'}${weekAvg != null ? ` · avg ${weekAvg} this week` : ''}</p>
        </div>
        ${ringSvg(plan.target ? Math.min(plan.doneToday / plan.target, 1) : 0, `${plan.doneToday}/${plan.target}`, 'today', { size: 96 })}
      </div>

      ${!state.settings.tutorialDone ? `<a class="notice action" href="#/tutorial">${icon('help', 16)} Never done these before? Two minutes, and you will know exactly what to do.</a>` : ''}
      ${reviewDue(state) ? `<a class="notice action" href="#/review">${icon('calendar', 16)} Last week is ready to look at.</a>` : ''}
      ${reminderNotice(state, plan)}
      ${plan.deload ? '<div class="notice warn">Reduced targets. Ease through these.</div>' : ''}
      ${plan.complete ? '<div class="notice good">Done for today.</div>' : ''}

      <button class="btn primary big" id="start">${icon('play', 18)}<span>${plan.complete ? 'Bonus session' : 'Start'}</span></button>
      <div class="btn-row">
        <a class="btn ghost linkbtn" href="#/pocket">${icon('vibrate', 16)}<span>Pocket mode</span></a>
        ${plan.type === 'training' ? '<button class="btn ghost" id="quick">Quick · 90s</button>' : ''}
      </div>

      <div class="week-strip">${days.map((d) => `<i class="${d.cls}" title="${d.key}"></i>`).join('')}</div>

      <div class="stat-grid three">
        <div class="stat">${icon('target', 16)}<b>${state.program.qualifying}/${program.PROMOTION_TARGET}</b><span>to week ${Math.min(state.program.level + 1, program.MAX_LEVEL)}</span></div>
        <div class="stat">${icon('timer', 16)}<b>${fmtMs(state.prs.maxHoldMs)}</b><span>best hold</span></div>
        <div class="stat">${icon('route', 16)}<b>${Math.round((state.program.level / program.TOTAL_WEEKS) * 100)}%</b><span>of the plan</span></div>
      </div>

      ${recentScores.length > 1 ? `<section class="card">
        <div class="h-row">${icon('trend', 16)}<h2>Recent scores</h2></div>
        ${sparkline(recentScores, { color: 'var(--accent)', h: 44 })}
      </section>` : ''}

      <div class="linkrow">
        <a href="#/track">${icon('chart')} Tracking</a>
        <a href="#/roadmap">${icon('route')} The plan</a>
        <a href="#/review">${icon('calendar')} Your week</a>
        <a href="#/guide">${icon('help')} How to</a>
        <a href="#/kegels/settings">${icon('settings')} Settings</a>
      </div>
    </div>`;

  mount.querySelector('#start').addEventListener('click', () => {
    location.hash = '#/session';
  });
  mount.querySelector('#quick')?.addEventListener('click', () => {
    location.hash = '#/session?quick=1';
  });
}

/** In-app nudge past your chosen time. The real alarm is scheduled natively. */
function reminderNotice(state, plan) {
  const t = state.settings.reminder;
  if (!t || plan.complete) return '';
  const [h, m] = t.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return '';
  const left = plan.target - plan.doneToday;
  return `<div class="notice">${left} session${left === 1 ? '' : 's'} left today.</div>`;
}

/* ---------------- how to ---------------- */

export function renderGuide(mount) {
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="kegels" aria-label="Back">${icon('back')}</button>
        <h1>How to</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <a class="btn primary big linkbtn" href="#/tutorial">${icon('play', 18)}<span>Walk me through it</span></a>

      <section class="card">
        <h2>A kegel, in one paragraph</h2>
        <p class="small muted">There is a sheet of muscle slung across the bottom of your pelvis, the <b>pelvic floor</b>. It is what you tighten to stop yourself passing wind. A kegel is squeezing it deliberately: a lift <b>up and in</b>, towards your belly button. Then a full release. That is the whole movement.</p>
        <p class="small muted">You are doing it right when your <b>belly, buttocks and thighs stay completely still</b> and you are <b>still breathing</b>. If any of those move, ease off to half effort. a smaller contraction of the right muscle beats a hard squeeze of the wrong three.</p>
        <p class="warn-inline">Don't practise by stopping your urine mid-stream. Useful once as a test, a bad habit as training.</p>
      </section>

      <section class="card">
        <h2>A reverse kegel, in one paragraph</h2>
        <p class="small muted"><b>It is the exact opposite of a kegel.</b> Instead of lifting the floor up and in, you let it drop down and out. The easiest way to find it: breathe in slowly and let your belly widen, feeling the floor sink as the air comes in. Doing that sinking on purpose <i>is</i> a reverse kegel. Gently. It is a lengthening, never a strain or a hard push.</p>
        <p class="small muted">It matters because a muscle that only ever tightens ends up permanently tight, and a permanently tight pelvic floor causes the same problems as a weak one, and more kegels make it worse. That is why every session finishes with them.</p>
        <a class="btn ghost linkbtn" href="#/tutorial?step=reverse">${icon('help', 16)}<span>Show me, with practice</span></a>
      </section>

      <section class="card">
        <h2>The rules</h2>
        <ul class="rules">
          <li><b>Both kinds of rep.</b> Quick flicks train the fast-reacting fibres, long holds train stamina. Every session has both.</li>
          <li><b>Rest as long as you hold.</b> Under-resting is the single most common reason people stall.</li>
          <li><b>Let go completely.</b> A half-release means the muscle never gets to recover.</li>
          <li><b>Harder over time, in five ways:</b> hold length, holds per session, flicks, ramps, and later rapid pulses. Position climbs lying → sitting → standing → mid-activity.</li>
          <li><b>Don't do extra.</b> More volume doesn't speed it up; it just aches, and an overworked floor gets tighter rather than stronger.</li>
        </ul>
        <a class="btn ghost linkbtn" href="#/roadmap">${icon('route', 16)}<span>See all 104 weeks</span></a>
      </section>

      <section class="card">
        <h2>Timeline</h2>
        <p class="small muted">First changes around weeks 4–6, most of it between 8 and 12. Nothing in one session is visible. That is what the streak is for. The plan itself runs two years.</p>
      </section>

      <section class="card">
        <h2>Back off if</h2>
        <p class="small muted">Aching in the pelvis or lower back, heaviness, worse urinary symptoms, or pain during or after. Flag it at the end of a session and the program drops your targets automatically. Persistent symptoms → doctor or pelvic health physio. An over-tight floor gets <b>worse</b> with more kegels.</p>
      </section>
    </div>`;
}

/* ---------------- settings ---------------- */

export function renderKegelSettings(mount) {
  const s = store.get().settings;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="kegels" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(kegelName())}</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('target', 16)}<h2>How you train</h2></div>
        <label class="setting">
          <span><b>Input mode</b><i>Press-and-hold measures every rep. Hands-free paces you and scores from your rating.</i></span>
          <select id="inputMode">
            <option value="hold" ${s.inputMode === 'hold' ? 'selected' : ''}>Press and hold</option>
            <option value="auto" ${s.inputMode === 'auto' ? 'selected' : ''}>Hands-free</option>
          </select>
        </label>
        <label class="setting">
          <span><b>Sessions per day</b><i>Two is plenty to progress.</i></span>
          <select id="dailyTarget">
            ${[1, 2, 3].map((n) => `<option value="${n}" ${s.dailyTarget === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Release day</b><i>One day a week of down-training instead of strengthening.</i></span>
          <select id="restDay">
            ${days.map((d, n) => `<option value="${n}" ${s.restDay === n ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Daily reminder</b><i>An alarm at this time. Leave empty for none.</i></span>
          <input type="time" id="reminder" value="${escapeHtml(s.reminder || '')}">
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('help', 16)}<h2>Technique</h2></div>
        <a class="btn ghost linkbtn" href="#/tutorial">${icon('play', 16)}<span>Replay the walkthrough</span></a>
        <a class="btn ghost linkbtn" href="#/roadmap">${icon('route', 16)}<span>See all 104 weeks</span></a>
      </section>
    </div>`;

  const bind = (id, key, get = (e) => e.value) =>
    mount.querySelector('#' + id).addEventListener('change', (e) => {
      store.setSetting(key, get(e.target));
      toast('Saved');
    });
  bind('inputMode', 'inputMode');
  bind('dailyTarget', 'dailyTarget', (e) => Number(e.value));
  bind('restDay', 'restDay', (e) => Number(e.value));

  mount.querySelector('#reminder').addEventListener('change', (e) => {
    const v = e.target.value;
    store.setSetting('reminder', v);
    if (v) {
      const [h, m] = v.split(':').map(Number);
      scheduleDaily(ALARM_KEGEL_REMINDER, h, m, 'NiFo', 'Today\u2019s session is waiting.');
    } else {
      cancelAlarm(ALARM_KEGEL_REMINDER);
    }
    toast('Saved');
  });
}

