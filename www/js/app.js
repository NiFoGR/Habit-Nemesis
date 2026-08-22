// App shell: routing, the NiFo hub, the Kegels home screen, guide and settings.

import * as store from './store.js';
import * as program from './program.js';
import { startSession } from './session.js';
import { renderReport } from './report.js';
import { renderTracking } from './tracking.js';
import { usage as photoUsage } from './pe/db.js';
import { fmtMs, fmtHours, ringSvg, escapeHtml, toast, haptic, sparkline } from './ui.js';
import { icon, logoMark } from './icons.js';
import * as peProgram from './pe/program.js';
import { renderPeHome } from './pe/home.js';
import { renderTimer } from './pe/timer.js';
import { renderMeasure } from './pe/measure.js';
import { renderStats } from './pe/stats.js';
import { renderGallery, leaveGallery } from './pe/gallery.js';
import { renderPeGuide, renderPeSettings } from './pe/guide.js';
import { renderPrayHome, renderPrayStats, renderMyPrayers, renderPraySettings } from './pray/home.js';
import { startRule } from './pray/session.js';
import * as prayProgram from './pray/program.js';
import { RULES as PRAY_RULES } from './pray/prayers.js';
import { renderTutorial } from './tutorial.js';
import { renderRoadmap } from './roadmap.js';
import { renderPocket } from './pocket.js';
import { renderReview, reviewDue } from './review.js';
import * as vault from './pe/vault.js';
import { scheduleDaily, cancelAlarm, ALARM_KEGEL_REMINDER, ALARM_PRAY_MORNING, ALARM_PRAY_EVENING } from './native.js';

const app = document.getElementById('app');
let activeSession = null;
let installPrompt = null;

const kegelName = () => (store.get().settings.discreet ? 'Core Training' : 'Kegels');
const peName = () => (store.get().settings.discreet ? 'Length Training' : 'PE');

/* ---------------- the NiFo hub ---------------- */

/** Each feature supplies its own hub tile status, so the hub does not need to
 *  know anything about how a feature works. */
const FEATURES = [
  {
    id: 'kegels',
    icon: 'target',
    route: '#/kegels',
    name: () => kegelName(),
    blurb: 'Progressive pelvic floor training with real per-rep tracking',
    pills() {
      const state = store.get();
      const plan = program.planForToday(state);
      const st = store.streak();
      return [
        { text: plan.complete ? 'Done today' : `${plan.doneToday}/${plan.target} today`, done: plan.complete },
        { text: `Week ${state.program.level}/${program.TOTAL_WEEKS}`, ghost: true },
        st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark() {
      const scored = store.get().sessions.filter((x) => x.countsForPromotion !== false && x.type !== 'release').slice(-14);
      return sparkline(scored.map((x) => x.score), { color: 'var(--accent)' });
    },
  },
  {
    id: 'pe',
    icon: 'trend',
    route: '#/pe',
    name: () => peName(),
    blurb: 'Stretching, pumping and monthly measurements with a private gallery',
    pills() {
      const pe = store.get().pe;
      const st = peProgram.peStreak();
      const latest = pe.measurements[pe.measurements.length - 1];
      const week = peProgram.weeklyVolumeMs(null, 1);
      const due = peProgram.measurementDue();
      return [
        { text: week ? `${(week / 3600000).toFixed(1)}h this week` : 'Nothing this week', done: week > 0 },
        latest ? { text: peProgram.fmtLength(latest.bpel), ghost: true } : null,
        due.due ? { text: 'Check-in due', ghost: true } : st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark() {
      return sparkline(store.get().pe.measurements.map((m) => m.bpel), { color: 'var(--violet)' });
    },
  },
  {
    id: 'pray',
    icon: 'book',
    route: '#/pray',
    name: () => 'Prayer',
    blurb: 'Morning and night, both kept',
    pills() {
      const today = prayProgram.dayState();
      const st = prayProgram.streak();
      return [
        { text: today.complete ? 'Both kept' : `${today.kept}/2 today`, done: today.complete },
        st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark: () => '',
  },
];

/* ---------------- Today ----------------
   The hub used to be a menu: two tiles and a list of things that did not exist
   yet. A menu makes you decide what to do before you can do anything, which is
   the moment a habit gets dropped. This answers the question instead: here is
   what is outstanding today, and the one button that starts it. */

/** Everything still owed today, across both features, most urgent first. */
function todayTasks(state) {
  const out = [];
  const plan = program.planForToday(state);
  const left = Math.max(0, plan.target - plan.doneToday);

  out.push({
    id: 'kegels',
    icon: 'target',
    label: plan.type === 'release' ? 'Release day' : kegelName(),
    detail: plan.complete
      ? 'Done today'
      : plan.type === 'release'
        ? 'Down-training, no strengthening'
        : `${left} session${left === 1 ? '' : 's'} left · week ${plan.level}`,
    done: plan.complete,
    href: '#/session',
    cta: plan.complete ? 'Bonus session' : plan.type === 'test' ? 'Max hold test' : 'Start',
  });

  if (state.pe.settings.safetyAck || state.pe.sessions.length) {
    const todayStretch = state.pe.sessions
      .filter((s) => s.date === store.dayKey() && s.type === 'stretch')
      .reduce((a, s) => a + s.durationSec * 1000, 0);
    const goal = peProgram.DAILY_STRETCH_GOAL_MS;
    const hit = todayStretch >= goal;
    out.push({
      id: 'pe',
      icon: 'stretch',
      label: `${peName()} · stretching`,
      detail: hit ? 'Two hours done' : `${fmtHours(todayStretch)} of 2h · ${fmtHours(goal - todayStretch)} left`,
      done: hit,
      href: '#/pe/timer?type=stretch',
      cta: 'Stretch',
      frac: Math.min(todayStretch / goal, 1),
    });
  }

  for (const slot of prayProgram.SLOTS) {
    const kept = prayProgram.dayState()[slot];
    out.push({
      id: `pray-${slot}`,
      icon: slot === 'morning' ? 'sun' : 'moon',
      label: PRAY_RULES[slot].label,
      detail: kept
        ? `Kept ${new Date(kept).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
        : `${slot === 'morning' ? state.pray.settings.morningAt : state.pray.settings.eveningAt} · ${prayProgram.minutes(slot)} min`,
      done: !!kept,
      href: `#/pray/run?slot=${slot}`,
      cta: PRAY_RULES[slot].label,
    });
  }

  const due = peProgram.measurementDue();
  if (due.due && state.pe.settings.safetyAck) {
    out.push({
      id: 'measure',
      icon: 'ruler',
      label: 'Monthly check-in',
      detail: due.reason,
      done: false,
      href: '#/pe/measure',
      cta: 'Measure',
    });
  }

  return out;
}

function renderHub() {
  const state = store.get();
  const tasks = todayTasks(state);
  const outstanding = tasks.filter((t) => !t.done);
  const next = outstanding[0];
  const doneCount = tasks.length - outstanding.length;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const kStreak = store.streak();

  app.innerHTML = `
    <div class="screen">
      <header class="hub-head">
        <div class="brand-row">${logoMark(28)}<h1>NiFo</h1></div>
        <button class="icon-btn" data-nav="settings" aria-label="Settings">${icon('settings')}</button>
      </header>

      <div class="today hub-today">
        <div class="today-left">
          <h2>${outstanding.length ? `${outstanding.length} thing${outstanding.length === 1 ? '' : 's'} left` : 'All done today'}</h2>
          <p class="muted small">${escapeHtml(today)}${kStreak ? ` · ${kStreak}d streak` : ''}</p>
        </div>
        ${ringSvg(tasks.length ? doneCount / tasks.length : 1, `${doneCount}/${tasks.length}`, 'today', { size: 96 })}
      </div>

      ${reviewDue(state) ? `<a class="notice action" href="#/review">${icon('calendar', 16)} Your week is ready.</a>` : ''}
      ${!state.settings.tutorialDone ? `<a class="notice action" href="#/tutorial">${icon('help', 16)} Start here. How to do a kegel.</a>` : ''}

      <div class="task-list">
        ${tasks.map((t) => `<a class="task ${t.done ? 'done' : ''}" href="${t.href}">
          <span class="task-ico">${t.done ? icon('check', 18) : icon(t.icon, 18)}</span>
          <span class="task-text"><b>${escapeHtml(t.label)}</b><i>${escapeHtml(t.detail)}</i></span>
          ${t.frac ? `<span class="task-mini"><i style="width:${(t.frac * 100).toFixed(0)}%"></i></span>` : ''}
        </a>`).join('')}
      </div>

      ${next ? `<a class="btn primary big linkbtn" href="${next.href}">${icon('play', 18)}<span>${escapeHtml(next.cta)}</span></a>` : ''}

      <h3 class="sec-head">Sections</h3>
      <div class="feature-grid">
        ${FEATURES.map((f) => {
          let pills = [];
          try {
            pills = f.pills().filter(Boolean);
          } catch {
            pills = [];
          }
          let spark = '';
          try {
            spark = f.spark();
          } catch {
            spark = '';
          }
          return `<a class="feature ${f.id}" href="${f.route}">
            <div class="feature-head">${icon(f.icon, 22)}<h2>${escapeHtml(f.name())}</h2></div>
            <div class="feature-foot">
              ${pills.map((p) => `<span class="pill ${p.done ? 'done' : ''} ${p.ghost ? 'ghost' : ''}">${escapeHtml(p.text)}</span>`).join('')}
            </div>
            ${spark ? `<div class="feature-spark">${spark}</div>` : ''}
          </a>`;
        }).join('')}
      </div>

      <div id="installSlot"></div>
    </div>`;
  mountInstall();
}

/* ---------------- Kegels home ---------------- */

function sessionOutline(level, type) {
  const def = program.levelDef(level);
  if (type === 'release') return ['Diaphragmatic breathing', 'Reverse kegels, no strengthening'];
  if (type === 'test') return ['One maximum hold, to failure', 'Sets your strength baseline'];
  const out = [
    `${def.flicks.reps} quick flicks · 1s on, 2s off`,
    `${def.holds.reps} holds · ${def.holds.holdMs / 1000}s on, ${def.holds.restMs / 1000}s off`,
  ];
  if (def.ramps) out.push(`${def.ramps.reps} ramps · climb, hold ${def.ramps.holdMs / 1000}s, descend`);
  out.push('Reverse kegels + breathing to finish');
  return out;
}

function renderKegels() {
  const state = store.get();
  // Nobody's first kegel should be guesswork. Straight into the walkthrough on
  // a genuinely fresh install; after that it is a link, not a gate.
  if (!state.settings.tutorialDone && state.sessions.length === 0) {
    return renderTutorial(app, { onExit: () => renderKegels() });
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

  app.innerHTML = `
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

  app.querySelector('#start').addEventListener('click', () => {
    location.hash = '#/session';
  });
  app.querySelector('#quick')?.addEventListener('click', () => {
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

function relLabel(s) {
  const d = new Date(s.ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/* ---------------- session + report ---------------- */

function runSession(params) {
  const state = store.get();
  const plan = program.planForToday(state);
  const quick = params?.get?.('quick') === '1';
  document.body.classList.add('in-session');
  activeSession = startSession(app, { level: plan.level, type: quick ? 'quick' : plan.type, deload: plan.deload }, (result) => {
    document.body.classList.remove('in-session');
    activeSession = null;
    if (!result) {
      location.hash = '#/kegels';
      return;
    }
    haptic(result.outcome.levelUp ? 'level' : 'done');
    renderReport(app, result, () => {
      location.hash = '#/kegels';
    });
  });
}

function runRule(params) {
  const slot = prayProgram.SLOTS.includes(params?.get?.('slot')) ? params.get('slot') : 'morning';
  activeSession = startRule(app, slot, () => {
    activeSession = null;
    location.hash = '#/pray';
  });
}

/* ---------------- guide ---------------- */

function renderGuide() {
  app.innerHTML = `
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

/* ---------------- settings ----------------
   One rule decides what goes here: a setting lives where the thing it affects
   lives. Anything true of the whole app is on this screen; anything true of one
   section is on that section's own settings screen, reachable from its home.

   This page used to hold the kegel training options, three PE fields and a link
   to the kegel walkthrough, while Prayer kept its own screen. Two models at
   once, and a page that grew every time a feature did. */

function settingsNav() {
  return `<div class="set-nav">
    <a href="#/kegels/settings">${icon('target', 18)}<span><b>${escapeHtml(kegelName())}</b><i>Input, daily target, release day, reminder</i></span></a>
    <a href="#/pe/settings">${icon('trend', 18)}<span><b>${escapeHtml(peName())}</b><i>Units, session defaults, check-in day</i></span></a>
    <a href="#/pray/settings">${icon('book', 18)}<span><b>Prayer</b><i>Language, times, reminders</i></span></a>
  </div>`;
}

function renderSettings() {
  const s = store.get().settings;
  const pe = store.get().pe.settings;

  app.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">${icon('back')}</button>
        <h1>Settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <h3 class="sec-head">Sections</h3>
      ${settingsNav()}

      <h3 class="sec-head">Everywhere</h3>

      <section class="card">
        <div class="h-row">${icon('flash', 16)}<h2>Feedback</h2></div>
        <label class="setting toggle">
          <span><b>Vibration</b><i>Buzzes on every phase change, so you can train with the screen face down.</i></span>
          <input type="checkbox" id="haptics" ${s.haptics ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Sound cues</b><i>A tone when a rep starts and when you reach the target.</i></span>
          <input type="checkbox" id="sound" ${s.sound ? 'checked' : ''}>
        </label>
        <label class="setting toggle">
          <span><b>Discreet mode</b><i>Renames Kegels to "Core Training" and PE to "Length Training".</i></span>
          <input type="checkbox" id="discreet" ${s.discreet ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('lock', 16)}<h2>Privacy</h2></div>
        <label class="setting toggle">
          <span><b>Lock the app</b><i>${vault.isSet() ? 'Asks for your gallery PIN when you open NiFo.' : 'Set a gallery PIN first, under Progress then Gallery.'}</i></span>
          <input type="checkbox" id="appLock" ${s.appLock ? 'checked' : ''} ${vault.isSet() ? '' : 'disabled'}>
        </label>
        <label class="setting">
          <span><b>Gallery auto-lock</b><i>How long the gallery stays open untouched.</i></span>
          <select id="autoLockMin">
            ${[1, 2, 5, 10].map((m) => `<option value="${m}" ${pe.autoLockMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
        <p class="fineprint">The app lock is a door, not a safe. It keeps someone who picks up your phone out, but sessions and measurements are stored unencrypted like any other app's data. Only the photos are actually encrypted, and that is what the PIN protects.</p>
      </section>

      <section class="card">
        <div class="h-row">${icon('images', 16)}<h2>Data</h2></div>
        <div class="kv"><span>On this device</span><b id="usage">checking</b></div>
        <p class="fineprint">Everything lives on this phone. Reinstalling the app or clearing browser data wipes it, so export occasionally.</p>
        <div class="btn-row">
          <button class="btn" id="exportBtn">Export backup</button>
          <button class="btn" id="importBtn">Import backup</button>
        </div>
        <input type="file" id="importFile" accept="application/json" hidden>
      </section>

      <section class="card danger">
        <div class="h-row">${icon('warn', 16)}<h2>Reset</h2></div>
        <p class="small muted">Erases every session, measurement, prayer day and badge. No undo. Export a backup first.</p>
        <button class="btn danger" id="reset">Erase all data</button>
      </section>

      <p class="fineprint centre">NiFo, everything on-device</p>
    </div>`;

  const bind = (id, key, get = (e) => e.value) =>
    app.querySelector('#' + id).addEventListener('change', (e) => {
      store.setSetting(key, get(e.target));
      toast('Saved');
    });
  bind('haptics', 'haptics', (e) => e.checked);
  bind('sound', 'sound', (e) => e.checked);
  bind('discreet', 'discreet', (e) => e.checked);

  app.querySelector('#autoLockMin').addEventListener('change', (e) => {
    store.update((st) => {
      st.pe.settings.autoLockMin = Number(e.target.value);
    });
    toast('Saved');
  });

  app.querySelector('#appLock').addEventListener('change', (e) => {
    store.setSetting('appLock', e.target.checked);
    // Turning it on takes effect at the next launch. Locking someone out of the
    // screen they just enabled it on would be absurd.
    appUnlocked = true;
    toast(e.target.checked ? 'The app will ask for your PIN next time' : 'App lock off');
  });

  showUsage();
  wireBackup();

  app.querySelector('#reset').addEventListener('click', () => {
    if (confirm('Erase everything and start from scratch? This cannot be undone.')) {
      store.reset();
      toast('All data erased');
      location.hash = '#/hub';
    }
  });
}

/** Storage is worth showing because it is the thing that fills up, and because
 *  a backup is the only defence against it being cleared. */
async function showUsage() {
  const el = app.querySelector('#usage');
  if (!el) return;
  try {
    const est = await navigator.storage?.estimate?.();
    const mb = est?.usage ? est.usage / 1048576 : null;
    el.textContent = mb == null ? 'unknown' : mb < 1 ? 'under 1 MB' : `${mb.toFixed(1)} MB`;
  } catch {
    el.textContent = 'unknown';
  }
}

function wireBackup() {
  app.querySelector('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nifo-backup-${store.dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  });

  const file = app.querySelector('#importFile');
  app.querySelector('#importBtn').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      let keepVault = false;
      // Photos are encrypted under the PIN recorded in whichever vault wins, so
      // a backup from another device would orphan the ones already here.
      const count = await photoCount();
      if (count > 0 && store.backupChangesVault(text)) {
        keepVault = !confirm(
          `This backup was made with a different gallery PIN, and there ${count === 1 ? 'is 1 photo' : `are ${count} photos`} stored on this device.\n\n` +
            "OK: use the backup's PIN. The photos already here become permanently unreadable.\n" +
            "Cancel: keep this device's PIN, and restore everything else."

        );
      }
      const res = store.importJson(text, { keepVault });
      toast(keepVault ? 'Backup restored, gallery PIN kept' : res.vaultChanged ? 'Backup restored, gallery PIN replaced' : 'Backup restored');
      renderSettings();
    } catch (err) {
      toast(`Could not read that file: ${err.message}`);
    }
  });
}

async function photoCount() {
  try {
    const u = await photoUsage();
    return u?.count || 0;
  } catch {
    return 0;
  }
}

/* ---------------- section settings ---------------- */

function renderKegelSettings() {
  const s = store.get().settings;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  app.innerHTML = `
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
    app.querySelector('#' + id).addEventListener('change', (e) => {
      store.setSetting(key, get(e.target));
      toast('Saved');
    });
  bind('inputMode', 'inputMode');
  bind('dailyTarget', 'dailyTarget', (e) => Number(e.value));
  bind('restDay', 'restDay', (e) => Number(e.value));

  app.querySelector('#reminder').addEventListener('change', (e) => {
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

/* ---------------- app lock ----------------
   Reuses the gallery PIN rather than inventing a second one: two PINs for one
   app is how people end up writing them down. Unlocking here also unlocks the
   vault, which is the behaviour you want. The alternative is being asked for
   the same PIN twice in a row on the way to the gallery. */

let appUnlocked = false;

const lockActive = () => store.get().settings.appLock && vault.isSet() && !appUnlocked;

function renderLock() {
  app.innerHTML = `
    <div class="screen lock-screen">
      <div class="lock-brand">${logoMark(44)}<h1>NiFo</h1></div>
      <p class="muted small centre">Enter your PIN</p>
      <input type="password" id="pin" inputmode="numeric" autocomplete="off" class="pin-input" placeholder="••••">
      <p class="warn-inline" id="err" hidden>Wrong PIN</p>
      <button class="btn primary big" id="go">Unlock</button>
    </div>`;

  const pin = app.querySelector('#pin');
  const err = app.querySelector('#err');
  const go = app.querySelector('#go');

  const attempt = async () => {
    if (!pin.value) return;
    go.disabled = true;
    const ok = await vault.unlock(pin.value).catch(() => false);
    go.disabled = false;
    if (!ok) {
      err.hidden = false;
      pin.value = '';
      haptic('miss');
      return;
    }
    appUnlocked = true;
    haptic('done');
    route();
  };

  go.addEventListener('click', attempt);
  pin.addEventListener('keydown', (e) => {
    err.hidden = true;
    if (e.key === 'Enter') attempt();
  });
  pin.focus();
}

/* ---------------- install prompt ---------------- */

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  mountInstall();
});

function mountInstall() {
  const slot = document.getElementById('installSlot');
  if (!slot || !installPrompt) return;
  slot.innerHTML = '<button class="btn ghost wide" id="installBtn">Install NiFo to your home screen</button>';
  slot.querySelector('#installBtn').addEventListener('click', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    slot.innerHTML = '';
  });
}

/* ---------------- router ---------------- */

const ROUTES = {
  '#/hub': renderHub,
  '#/kegels': renderKegels,
  '#/session': runSession,
  '#/pocket': () => (activeSession = renderPocket(app)),
  '#/tutorial': (params) => renderTutorial(app, { only: params.get('step') }),
  '#/roadmap': () => renderRoadmap(app),
  '#/review': () => renderReview(app),
  '#/track': () => renderTracking(app),
  '#/guide': renderGuide,
  '#/settings': renderSettings,
  '#/pe': () => renderPeHome(app),
  '#/pe/timer': (params) => renderTimer(app, { type: params.get('type') || 'stretch', repeat: params.get('repeat') === '1' }),
  '#/pe/measure': () => renderMeasure(app),
  '#/pe/stats': () => renderStats(app),
  '#/pe/gallery': () => renderGallery(app),
  '#/pe/guide': () => renderPeGuide(app),
  '#/pe/settings': () => renderPeSettings(app),
  '#/kegels/settings': renderKegelSettings,
  '#/pray': () => renderPrayHome(app),
  '#/pray/run': (params) => runRule(params),
  '#/pray/stats': () => renderPrayStats(app),
  '#/pray/prayers': () => renderMyPrayers(app),
  '#/pray/settings': () => renderPraySettings(app),
};

const NAV = {
  hub: '#/hub', kegels: '#/kegels', track: '#/track', settings: '#/settings', guide: '#/guide',
  roadmap: '#/roadmap', review: '#/review', tutorial: '#/tutorial', pocket: '#/pocket',
  pe: '#/pe', 'pe-timer': '#/pe/timer', 'pe-measure': '#/pe/measure', 'pe-stats': '#/pe/stats',
  'pe-gallery': '#/pe/gallery', 'pe-guide': '#/pe/guide', 'pe-settings': '#/pe/settings',
  'kegel-settings': '#/kegels/settings',
  pray: '#/pray', 'pray-stats': '#/pray/stats', 'pray-prayers': '#/pray/prayers',
  'pray-settings': '#/pray/settings',
};

let lastHash = '';

function route() {
  if (activeSession) {
    activeSession.stop();
    activeSession = null;
    document.body.classList.remove('in-session');
  }
  // Leaving the gallery frees the decrypted object URLs it handed to <img>.
  if (lastHash.startsWith('#/pe/gallery') && !location.hash.startsWith('#/pe/gallery')) leaveGallery();
  lastHash = location.hash;

  if (lockActive()) return renderLock();

  const [path, query] = location.hash.split('?');
  // One token set per section, swapped on the body. The shell stays the same
  // everywhere; only the palette and, for prayer, the type change.
  document.body.dataset.section = path.startsWith('#/pe') ? 'pe'
    : path.startsWith('#/pray') ? 'pray'
    : ['#/kegels', '#/kegels/settings', '#/session', '#/track', '#/guide', '#/roadmap', '#/review', '#/pocket', '#/tutorial'].includes(path) ? 'kegels'
    : 'hub';
  const fn = ROUTES[path] || renderHub;
  fn(new URLSearchParams(query || ''));
  if (path !== '#/session') window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  location.hash = NAV[nav.dataset.nav] || '#/hub';
});

// Locking the vault the moment the app is backgrounded keeps decrypted photos
// off the app switcher preview and out of a phone handed to someone else.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (lockActive()) route();
    return;
  }
  // Backgrounding re-arms the app lock, that is the whole point of it. A
  // session in progress is the exception: a timer running against a real
  // contraction must not be thrown away because you glanced at a message.
  // Note this is independent of the vault's own idle auto-lock, so a gallery
  // that times out after two minutes does not eject you from the app.
  if (store.get().settings.appLock && !activeSession) appUnlocked = false;

  if (vault.isUnlocked()) {
    vault.lock();
    leaveGallery();
    if (location.hash.startsWith('#/pe/gallery')) location.hash = '#/pe';
  }
});

window.addEventListener('hashchange', route);

if (!location.hash) location.hash = '#/hub';
route();

// The prayer reminders are the only alarms that must survive a reinstall of the
// app's own state, so they are re-armed from settings on every launch rather
// than only when the times are edited.
prayProgram.syncAlarms();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
