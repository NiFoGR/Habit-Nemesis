// Shell: route table, shell state, boot. Screens live in their own modules.

import * as store from './store.js';
import { renderHome, renderArchive } from './habits/home.js';
import { renderHabitEdit } from './habits/edit.js';
import { renderHabitDetail } from './habits/tracking.js';
import * as habitsProgram from './habits/program.js';
import { renderArena, renderFeats } from './arena/home.js';
import { renderDivisions } from './arena/divisions.js';
import { renderCabinet } from './arena/cabinet.js';
import * as arenaProgram from './arena/program.js';
import { renderYear } from './arena/year.js';
import { renderResult, collect, hasResults, leaveResult } from './arena/result.js';
import { renderMoment, hasMoment, leaveMoment } from './arena/moment.js';
import { renderRank, hasRank, leaveRank } from './arena/rank.js';
import { renderWeekReview } from './arena/review.js';
import { renderSettings } from './settings.js';
import { lockActive, renderLock, relock } from './lock.js';
import { renderIntro, introDue } from './intro.js';
import { initBack, navigate, replaceWith } from './back.js';
import { initTabs, syncTabs } from './tabs.js';
import * as native from './native.js';

const app = document.getElementById('app');

/** The screen the router has to stop before navigating. */
let activeSession = null;

/* ---------------- router ---------------- */

const ROUTES = {
  '#/hub': () => renderHome(app),
  '#/settings': () => renderSettings(app),
  // Aliases. A pinned link must not land on a dead route.
  '#/habits': () => renderHome(app),
  '#/habits/habit': (params) => renderHabitDetail(app, params.get('id')),
  '#/habits/edit': (params) => renderHabitEdit(app, { id: params.get('id'), kind: params.get('kind') }),
  '#/habits/archive': () => renderArchive(app),
  '#/arena': () => renderArena(app),
  '#/arena/result': () => renderResult(app),
  '#/arena/moment': () => renderMoment(app),
  '#/arena/rank': () => renderRank(app),
  '#/arena/review': () => renderWeekReview(app),
  '#/cabinet': () => renderCabinet(app),
  '#/cabinet/feats': () => renderFeats(app),
  '#/cabinet/year': (params) => renderYear(app, params.get('y')),
  // Moved to the Cabinet. Aliases kept.
  '#/arena/feats': () => renderFeats(app),
  '#/arena/divisions': () => renderDivisions(app),
  '#/arena/year': (params) => renderYear(app, params.get('y')),
  '#/intro': () => renderIntro(app),
};

const NAV = {
  hub: '#/hub', settings: '#/settings',
  habits: '#/habits', 'habits-archive': '#/habits/archive',
  arena: '#/arena', cabinet: '#/cabinet',
  'cabinet-feats': '#/cabinet/feats', 'cabinet-year': '#/cabinet/year',
  intro: '#/intro',
};

let lastHash = '';

function route() {
  if (activeSession) {
    activeSession.stop();
    activeSession = null;
    document.body.classList.remove('in-session');
  }
  // Both consume their payload on the way out.
  if (lastHash.startsWith('#/arena/result') && !location.hash.startsWith('#/arena/result')) leaveResult();
  if (lastHash.startsWith('#/arena/moment') && !location.hash.startsWith('#/arena/moment')) leaveMoment();
  if (lastHash.startsWith('#/arena/rank') && !location.hash.startsWith('#/arena/rank')) leaveRank();
  lastHash = location.hash;

  if (lockActive()) return renderLock(app, route);

  const [path, query] = location.hash.split('?');

  if (introDue() && path !== '#/intro') return replaceWith('#/intro');

  // Result, then cup, on the way to the grid.
  // The week, then the month, then the cup. Each screen's way out is the grid,
  // and the grid sends you on to the next, so they queue with no code to
  // sequence them.
  if (path === '#/hub') {
    if (hasResults()) return replaceWith('#/arena/result');
    if (hasRank()) return replaceWith('#/arena/rank');
    if (hasMoment()) return replaceWith('#/arena/moment');
  }

  syncTabs(path);

  const fn = ROUTES[path] || (() => renderHome(app));
  fn(new URLSearchParams(query || ''));
  // Animate arrival, not a partial redraw.
  app.querySelector('.screen')?.classList.add('enter');
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  navigate(NAV[nav.dataset.nav] || '#/hub');
});

// Never left on the back stack: these start on arrival.
const EPHEMERAL = ['#/habits/edit', '#/arena/result', '#/arena/rank', '#/arena/moment', '#/arena/review', '#/intro'];

// One restore point a day, before anything can write over the day's record.
store.snapshot();

// Close the Arena's books before the first render.
collect();

// replaceState: no blank entry under the grid.
if (!location.hash) history.replaceState(history.state, '', '#/hub');

// A number where there is one to give. The grid counts what today still owes,
// which is the only badge you can act on without opening anything.
initTabs({
  badges: () => {
    const due = habitsProgram.dueToday();
    return { grid: due.total - due.done, arena: hasResults() };
  },
});

// APK only: hide the system nav bar.
native.hideNavBar();

initBack({
  resolve: (key) => NAV[key] || '#/hub',
  ephemeral: (hash) => EPHEMERAL.some((r) => hash.startsWith(r)),
});

/* ---------------- the day turning ----------------
   Every screen is dated, so midnight is a change to all of them. Left open
   across it, the grid used to show yesterday until the next navigation. */

let onDay = habitsProgram.today();

function dayTurned() {
  const now = habitsProgram.today();
  if (now === onDay) return false;
  // Not over an open sheet: redrawing would take the screen out from under it.
  // The next minute asks again.
  if (document.querySelector('.sheet-scrim')) return false;
  onDay = now;
  store.snapshot();
  collect();
  route();
  return true;
}

setInterval(dayTurned, 60000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Catches a week that ended while backgrounded.
    collect();
    native.hideNavBar();
    if (dayTurned()) return;
    if (lockActive()) route();
    else if (location.hash.startsWith('#/hub') && (hasResults() || hasRank() || hasMoment())) route();
    return;
  }
  if (store.get().settings.appLock) relock();
});

window.addEventListener('hashchange', route);

route();

habitsProgram.syncAlarms();
// Arc alarms: opens, group ends, round ends.
arenaProgram.syncAlarms();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Persistent storage. No-op in Safari.
navigator.storage?.persist?.().catch(() => {});
