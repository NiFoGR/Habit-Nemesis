// App shell: routing, the NiFo hub, the Kegels home screen, guide and settings.

import * as store from './store.js';
import * as program from './program.js';
import { startSession } from './session.js';
import { renderReport } from './report.js';
import { renderTracking } from './tracking.js';
import { fmtMs, ringSvg, escapeHtml, toast, haptic } from './ui.js';
import * as peProgram from './pe/program.js';
import { renderPeHome } from './pe/home.js';
import { renderTimer } from './pe/timer.js';
import { renderMeasure } from './pe/measure.js';
import { renderStats } from './pe/stats.js';
import { renderGallery, leaveGallery } from './pe/gallery.js';
import { renderPeGuide } from './pe/guide.js';
import * as vault from './pe/vault.js';

const app = document.getElementById('app');
let activeSession = null;
let installPrompt = null;

const kegelName = () => (store.get().settings.discreet ? 'Core Training' : 'Kegels');

/* ---------------- the NiFo hub ---------------- */
// Features are registered here so adding the next one is a single entry.
const SOON = ['Sleep', 'Reading', 'Workouts', 'Money', 'Habits'];

/** Each feature supplies its own hub tile status, so the hub does not need to
 *  know anything about how a feature works. */
const FEATURES = [
  {
    id: 'kegels',
    icon: '◎',
    route: '#/kegels',
    name: () => kegelName(),
    blurb: 'Progressive pelvic floor training with real per-rep tracking',
    pills() {
      const state = store.get();
      const plan = program.planForToday(state);
      const st = store.streak();
      return [
        { text: plan.complete ? 'Done today' : `${plan.doneToday}/${plan.target} today`, done: plan.complete },
        { text: `Level ${state.program.level}`, ghost: true },
        st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
  },
  {
    id: 'pe',
    icon: '◈',
    route: '#/pe',
    name: () => (store.get().settings.discreet ? 'Length Training' : 'PE'),
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
  },
];

function renderHub() {
  app.innerHTML = `
    <div class="screen">
      <header class="hub-head">
        <div>
          <p class="eyebrow">NiFo</p>
          <h1>${greeting()}</h1>
        </div>
        <button class="icon-btn" data-nav="settings" aria-label="Settings">⚙</button>
      </header>

      <div class="feature-grid">
        ${FEATURES.map((f) => {
          let pills = [];
          try {
            pills = f.pills().filter(Boolean);
          } catch {
            pills = [];
          }
          return `<a class="feature" href="${f.route}">
            <div class="feature-icon">${f.icon}</div>
            <h2>${escapeHtml(f.name())}</h2>
            <p>${escapeHtml(f.blurb)}</p>
            <div class="feature-foot">
              ${pills.map((p) => `<span class="pill ${p.done ? 'done' : ''} ${p.ghost ? 'ghost' : ''}">${escapeHtml(p.text)}</span>`).join('')}
            </div>
          </a>`;
        }).join('')}
        ${SOON.map((n) => `<div class="feature soon"><div class="feature-icon">＋</div><h2>${n}</h2><p>Coming soon</p></div>`).join('')}
      </div>

      <p class="fineprint centre">Everything stays on this device.</p>
      <div id="installSlot"></div>
    </div>`;
  mountInstall();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

/* ---------------- Kegels home ---------------- */

function sessionOutline(level, type) {
  const def = program.levelDef(level);
  if (type === 'release') return ['Diaphragmatic breathing', 'Reverse kegels — no strengthening today'];
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
  const plan = program.planForToday(state);
  const def = program.levelDef(plan.level);
  const st = store.streak();
  const preview = program.buildSession({ level: plan.level, type: plan.type, deload: plan.deload });
  const mins = Math.max(1, Math.round(program.estimateDurationMs(preview) / 60000));
  const idx = program.pfi(state);
  const last = store.lastSession();

  app.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">←</button>
        <h1>${escapeHtml(kegelName())}</h1>
        <button class="icon-btn" data-nav="track" aria-label="Tracking">▤</button>
      </header>

      <div class="today ${plan.type}">
        <div class="today-left">
          <p class="eyebrow">${plan.type === 'release' ? 'Programmed release day' : plan.type === 'test' ? 'Benchmark day' : `Level ${plan.level} · ${escapeHtml(def.weekHint)}`}</p>
          <h2>${escapeHtml(plan.type === 'release' ? 'Down-training' : plan.type === 'test' ? 'Max hold test' : def.name)}</h2>
          <p class="muted small">${escapeHtml(plan.type === 'training' ? def.focus : plan.type === 'release' ? 'Teaching the muscle to let go. This is part of the program, not a day off.' : 'No prescribed target. Hold until it genuinely fades.')}</p>
        </div>
        ${ringSvg(plan.target ? Math.min(plan.doneToday / plan.target, 1) : 0, `${plan.doneToday}/${plan.target}`, 'today', { size: 104 })}
      </div>

      ${reminderNotice(state, plan)}
      ${plan.deload ? '<div class="notice warn">Reduced targets are active — you flagged discomfort or had two hard sessions. Ease through these.</div>' : ''}
      ${plan.complete ? `<div class="notice good">Today is done. Extra sessions are logged as bonus work but will not push you up a level any faster.</div>` : ''}

      <section class="card">
        <h2>Today's session <span class="tag">${mins} min</span></h2>
        <ul class="outline">${sessionOutline(plan.level, plan.type).map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
        <p class="cue"><b>Position:</b> ${escapeHtml(def.position)}</p>
        <p class="cue"><b>Cue:</b> ${escapeHtml(def.cue)}</p>
        <button class="btn primary big" id="start">${plan.complete ? 'Do a bonus session' : 'Start session'}</button>
        <button class="btn ghost" data-nav="guide">How to do this properly</button>
      </section>

      <div class="stat-grid">
        <div class="stat"><b>${st}</b><span>day streak</span></div>
        <div class="stat"><b>${state.program.qualifying}/${program.PROMOTION_TARGET}</b><span>to level ${Math.min(state.program.level + 1, program.MAX_LEVEL)}</span></div>
        <div class="stat"><b>${fmtMs(state.prs.maxHoldMs)}</b><span>longest hold</span></div>
        <div class="stat"><b>${idx}</b><span>PF Index</span></div>
      </div>

      ${last ? `<section class="card">
        <h2>Last session</h2>
        <div class="kv"><span>${escapeHtml(relLabel(last))}</span><b>${last.type === 'release' ? 'Release day' : `${last.score}/100 · ${program.grade(last.score).letter}`}</b></div>
        <div class="kv"><span>Longest hold</span><b>${fmtMs(last.totals?.longestHoldMs || 0)}</b></div>
        <div class="kv"><span>Time under tension</span><b>${fmtMs(last.totals?.tutMs || 0)}</b></div>
      </section>` : ''}

      <button class="btn ghost wide" data-nav="track">Open tracking</button>
      <div id="installSlot"></div>
    </div>`;

  app.querySelector('#start').addEventListener('click', () => {
    location.hash = '#/session';
  });
  mountInstall();
}

/** Deliberately not a push notification: no permission prompt, no background
 *  service, just a nudge on the screen once you are past your chosen time. */
function reminderNotice(state, plan) {
  const t = state.settings.reminder;
  if (!t || plan.complete) return '';
  const [h, m] = t.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return '';
  const left = plan.target - plan.doneToday;
  return `<div class="notice">It is past ${escapeHtml(t)} and you have ${left} session${left === 1 ? '' : 's'} left today. It takes about as long as scrolling this screen.</div>`;
}

function relLabel(s) {
  const d = new Date(s.ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/* ---------------- session + report ---------------- */

function runSession() {
  const state = store.get();
  const plan = program.planForToday(state);
  document.body.classList.add('in-session');
  activeSession = startSession(app, { level: plan.level, type: plan.type, deload: plan.deload }, (result) => {
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

/* ---------------- guide ---------------- */

function renderGuide() {
  app.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="kegels" aria-label="Back">←</button>
        <h1>Doing this properly</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <h2>Finding the right muscle</h2>
        <p>Two reliable cues: the muscles you would use to <b>stop yourself passing wind</b>, and the ones that make the base of the penis lift slightly. A correct contraction feels like a <b>lift up and in</b>, not a downward push.</p>
        <p>Check yourself in a mirror the first few times. If your buttocks, thighs or abdomen visibly tighten, or you hold your breath, you are recruiting the wrong things and the pelvic floor is getting a fraction of the work.</p>
        <p class="warn-inline">Do not practise by stopping your urine mid-stream. It is a one-off way to identify the muscle at most — done repeatedly it can interfere with normal bladder emptying.</p>
      </section>

      <section class="card">
        <h2>The five rules this program runs on</h2>
        <ol class="rules">
          <li><b>Train both fibre types.</b> Quick flicks build the fast-twitch response that fires when you cough or lift. Long holds build the slow-twitch endurance that holds tone all day. Doing only one leaves half the muscle untrained.</li>
          <li><b>Rest as long as you hold.</b> A 10-second hold gets 10 seconds of full release. Under-resting is the most common reason people plateau — the next rep is then just a fatigued version of the last.</li>
          <li><b>Full release matters as much as the squeeze.</b> Every session ends with reverse kegels and breathing. A pelvic floor stuck in permanent low-level tension causes the same symptoms as a weak one.</li>
          <li><b>Progress by seconds, then by reps, then by position.</b> Lying is easiest, standing is harder, standing under load is hardest. The levels move you along all three.</li>
          <li><b>Do not do more than the program asks.</b> Extra volume does not speed anything up and reliably causes aching. Total contraction work stays well under fifteen minutes a day for a reason.</li>
        </ol>
      </section>

      <section class="card">
        <h2>How long until anything changes</h2>
        <p>Pelvic floor muscle behaves like any other skeletal muscle. Most people feel the first changes somewhere around <b>weeks 4 to 6</b>, with the bulk of the improvement landing between <b>weeks 8 and 12</b> of consistent daily practice. Studies that show real effect sizes generally run 12 weeks or longer.</p>
        <p>Nothing you do in one session is visible. The point of the streak, the score and the index in this app is to make the invisible middle stretch feel like it is going somewhere.</p>
      </section>

      <section class="card">
        <h2>When to back off</h2>
        <p>Aching in the pelvis or lower back, a feeling of heaviness, worse urinary symptoms, or pain during or after training all mean stop and reduce. Flag "I felt pain" at the end of a session and the program automatically drops your targets for the next few sessions.</p>
        <p>If symptoms persist, an over-tight (hypertonic) pelvic floor is a real and reasonably common thing, and it gets <b>worse</b> with more kegels. That is a conversation for a doctor or a pelvic health physiotherapist, not something to train through.</p>
        <p class="fineprint">This app is a training tracker, not medical advice. It is not a substitute for assessment by a clinician, particularly if you have pain, urinary or bowel symptoms, or a history of pelvic surgery.</p>
      </section>

      <section class="card">
        <h2>Where the program comes from</h2>
        <p class="small muted">The structure follows the common ground across pelvic floor muscle training protocols: sets of 8-15 contractions held 3-10+ seconds with equal rest, performed daily, combining fast and slow contractions, progressed over 12+ weeks, with explicit down-training. Full notes and sources are in <code>docs/KEGEL_PROGRAM.md</code> in the repository.</p>
      </section>
    </div>`;
}

/* ---------------- settings ---------------- */

function renderSettings() {
  const s = store.get().settings;
  const pe = store.get().pe.settings;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  app.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="hub" aria-label="Back">←</button>
        <h1>Settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <h2>How you train</h2>
        <label class="setting">
          <span><b>Input mode</b><i>Press-and-hold measures every rep. Hands-free just paces you and scores from your own rating.</i></span>
          <select id="inputMode">
            <option value="hold" ${s.inputMode === 'hold' ? 'selected' : ''}>Press and hold</option>
            <option value="auto" ${s.inputMode === 'auto' ? 'selected' : ''}>Hands-free</option>
          </select>
        </label>
        <label class="setting">
          <span><b>Sessions per day</b><i>Most protocols use two or three. Two is plenty to progress.</i></span>
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
          <span><b>Daily reminder</b><i>A nudge when you open the app after this time. No notifications, no permissions.</i></span>
          <input type="time" id="reminder" value="${escapeHtml(s.reminder || '')}">
        </label>
      </section>

      <section class="card">
        <h2>Feedback</h2>
        <label class="setting toggle"><span><b>Vibration</b><i>Buzzes on every phase change so you can train without watching the screen.</i></span><input type="checkbox" id="haptics" ${s.haptics ? 'checked' : ''}></label>
        <label class="setting toggle"><span><b>Sound cues</b><i>A tone when a rep starts and when you reach the target.</i></span><input type="checkbox" id="sound" ${s.sound ? 'checked' : ''}></label>
        <label class="setting toggle"><span><b>Discreet mode</b><i>Renames the section to "Core Training" everywhere in the app.</i></span><input type="checkbox" id="discreet" ${s.discreet ? 'checked' : ''}></label>
      </section>

      <section class="card">
        <h2>PE</h2>
        <label class="setting">
          <span><b>Units</b><i>Applies to every length and girth in the app.</i></span>
          <select id="peUnits">
            <option value="cm" ${pe.units === 'cm' ? 'selected' : ''}>cm</option>
            <option value="in" ${pe.units === 'in' ? 'selected' : ''}>inches</option>
          </select>
        </label>
        <label class="setting">
          <span><b>Pump type</b><i>Water pumps have no gauge, so intensity is logged by feel instead of as a fake pressure reading.</i></span>
          <select id="pumpStyle">
            <option value="hydro" ${pe.pumpStyle === 'hydro' ? 'selected' : ''}>Water (Hydromax/Bathmate)</option>
            <option value="air" ${pe.pumpStyle === 'air' ? 'selected' : ''}>Air, with a gauge</option>
          </select>
        </label>
        <label class="setting">
          <span><b>Pressure unit</b><i>For gauged pumps.</i></span>
          <select id="pressureUnit">
            <option value="kPa" ${pe.pressureUnit === 'kPa' ? 'selected' : ''}>kPa</option>
            <option value="inHg" ${pe.pressureUnit === 'inHg' ? 'selected' : ''}>inHg</option>
          </select>
        </label>
        <label class="setting">
          <span><b>Check-in day</b><i>Which day of the month the measurement reminder appears.</i></span>
          <select id="measureDay">
            ${[1, 5, 10, 15, 20, 25, 28].map((d) => `<option value="${d}" ${pe.measureDay === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Gallery auto-lock</b><i>How long the gallery stays open without you touching it.</i></span>
          <select id="autoLockMin">
            ${[1, 2, 5, 10].map((m) => `<option value="${m}" ${pe.autoLockMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
      </section>

      <section class="card danger">
        <h2>Reset</h2>
        <p class="small muted">Deletes every session, badge and level. There is no undo — export a backup from the tracking screen first.</p>
        <button class="btn danger" id="reset">Erase all data</button>
      </section>

      <p class="fineprint centre">NiFo · everything on-device</p>
    </div>`;

  const bind = (id, key, get = (e) => e.value) =>
    app.querySelector('#' + id).addEventListener('change', (e) => {
      store.setSetting(key, get(e.target));
      toast('Saved');
    });

  bind('inputMode', 'inputMode');
  bind('dailyTarget', 'dailyTarget', (e) => Number(e.value));
  bind('restDay', 'restDay', (e) => Number(e.value));
  bind('reminder', 'reminder');
  bind('haptics', 'haptics', (e) => e.checked);
  bind('sound', 'sound', (e) => e.checked);
  bind('discreet', 'discreet', (e) => e.checked);

  const bindPe = (id, key, get = (e) => e.value) =>
    app.querySelector('#' + id).addEventListener('change', (e) => {
      store.update((st) => {
        st.pe.settings[key] = get(e.target);
      });
      toast('Saved');
    });
  bindPe('peUnits', 'units');
  bindPe('pumpStyle', 'pumpStyle');
  bindPe('pressureUnit', 'pressureUnit');
  bindPe('measureDay', 'measureDay', (e) => Number(e.value));
  bindPe('autoLockMin', 'autoLockMin', (e) => Number(e.value));

  app.querySelector('#reset').addEventListener('click', () => {
    if (confirm('Erase every session and start from level 1? This cannot be undone.')) {
      store.reset();
      toast('All data erased');
      location.hash = '#/hub';
    }
  });
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
  '#/track': () => renderTracking(app),
  '#/guide': renderGuide,
  '#/settings': renderSettings,
  '#/pe': () => renderPeHome(app),
  '#/pe/timer': (params) => renderTimer(app, { type: params.get('type') || 'stretch' }),
  '#/pe/measure': () => renderMeasure(app),
  '#/pe/stats': () => renderStats(app),
  '#/pe/gallery': () => renderGallery(app),
  '#/pe/guide': () => renderPeGuide(app),
};

const NAV = {
  hub: '#/hub', kegels: '#/kegels', track: '#/track', settings: '#/settings', guide: '#/guide',
  pe: '#/pe', 'pe-timer': '#/pe/timer', 'pe-measure': '#/pe/measure', 'pe-stats': '#/pe/stats',
  'pe-gallery': '#/pe/gallery', 'pe-guide': '#/pe/guide',
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

  const [path, query] = location.hash.split('?');
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
  if (document.visibilityState !== 'visible' && vault.isUnlocked()) {
    vault.lock();
    leaveGallery();
    if (location.hash.startsWith('#/pe/gallery')) location.hash = '#/pe';
  }
});

window.addEventListener('hashchange', route);

if (!location.hash) location.hash = '#/hub';
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
