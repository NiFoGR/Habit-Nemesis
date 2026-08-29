// Shell: route table, shell state, boot. Screens live in their own modules.

import * as store from './store.js';
import * as program from './kegels/program.js';
import { startSession } from './kegels/session.js';
import { renderReport } from './kegels/report.js';
import { renderTracking } from './kegels/tracking.js';
import { renderTutorial } from './kegels/tutorial.js';
import { renderRoadmap } from './kegels/roadmap.js';
import { renderPocket } from './kegels/pocket.js';
import { renderReview } from './kegels/review.js';
import { renderKegels, renderGuide, renderKegelSettings } from './kegels/home.js';
import { renderPeHome } from './pe/home.js';
import { renderTimer } from './pe/timer.js';
import { renderMeasure } from './pe/measure.js';
import { renderStats } from './pe/stats.js';
import { renderGallery, leaveGallery } from './pe/gallery.js';
import { renderPeGuide, renderPeSettings } from './pe/guide.js';
import { renderMyPrayers } from './pray/home.js';
import { startRule } from './pray/session.js';
import * as prayProgram from './pray/program.js';
import { renderBibleHome, renderBibleSettings } from './bible/home.js';
import { renderReader } from './bible/reader.js';
import { renderRead } from './bible/read.js';
import { renderBookContext } from './bible/book.js';
import { renderBibleTracking } from './bible/tracking.js';
import * as bibleProgram from './bible/program.js';
import { renderHome, renderArchive } from './habits/home.js';
import { renderHabitEdit } from './habits/edit.js';
import { renderHabitDetail } from './habits/tracking.js';
import * as habitsProgram from './habits/program.js';
import { renderArena, renderFeats } from './arena/home.js';
import { renderCabinet } from './arena/cabinet.js';
import * as arenaProgram from './arena/program.js';
import { renderYear } from './arena/year.js';
import { renderResult, collect, hasResults, leaveResult } from './arena/result.js';
import { renderMoment, hasMoment, leaveMoment } from './arena/moment.js';
import { renderRank, hasRank, leaveRank } from './arena/rank.js';
import { renderWeekReview } from './arena/review.js';
import { renderBreatheHome, renderBreatheSettings } from './breathe/home.js';
import { startBreathe } from './breathe/session.js';
import * as breatheProgram from './breathe/program.js';
import * as nightlight from './nightlight.js';
import { renderSettings } from './settings.js';
import { lockActive, renderLock, relock } from './lock.js';
import { nifoUnlocked } from './nifo.js';
import { renderIntro, introDue } from './intro.js';
import { initBack, navigate, replaceWith } from './back.js';
import { initTabs, syncTabs } from './tabs.js';
import * as vault from './pe/vault.js';
import * as native from './native.js';
import { haptic } from './ui.js';

const app = document.getElementById('app');

/** The screen the router has to stop before navigating. */
let activeSession = null;

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
      navigate('#/kegels');
      return;
    }
    haptic(result.outcome.levelUp ? 'level' : 'done');
    renderReport(app, result, () => {
      navigate('#/kegels');
    });
  });
}

function runRule(params) {
  const slot = prayProgram.SLOTS.includes(params?.get?.('slot')) ? params.get('slot') : 'morning';
  activeSession = startRule(app, slot, () => {
    activeSession = null;
    navigate('#/bible');
  });
}

function runBreathe() {
  activeSession = startBreathe(app, () => {
    activeSession = null;
    navigate('#/breathe');
  });
}

/* ---------------- router ---------------- */

const ROUTES = {
  '#/hub': () => renderHome(app),
  '#/kegels': () => renderKegels(app),
  '#/session': runSession,
  '#/pocket': () => (activeSession = renderPocket(app)),
  '#/tutorial': (params) => renderTutorial(app, { only: params.get('step') }),
  '#/roadmap': () => renderRoadmap(app),
  '#/review': () => renderReview(app),
  '#/track': () => renderTracking(app),
  '#/guide': () => renderGuide(app),
  '#/settings': () => renderSettings(app),
  '#/pe': () => renderPeHome(app),
  '#/pe/timer': (params) => renderTimer(app, { type: params.get('type') || 'stretch', repeat: params.get('repeat') === '1' }),
  '#/pe/measure': () => renderMeasure(app),
  '#/pe/stats': () => renderStats(app),
  '#/pe/gallery': () => renderGallery(app),
  '#/pe/guide': () => renderPeGuide(app),
  '#/pe/settings': () => renderPeSettings(app),
  '#/kegels/settings': () => renderKegelSettings(app),
  '#/bible': () => renderBibleHome(app),
  '#/bible/reader': (params) => renderReader(app, { book: params.get('book'), ch: params.get('ch') }),
  '#/bible/books': (params) => renderRead(app, { book: params.get('book') }),
  '#/bible/book': (params) => renderBookContext(app, params.get('id')),
  '#/bible/track': () => renderBibleTracking(app),
  '#/bible/settings': () => renderBibleSettings(app),
  '#/bible/pray': (params) => runRule(params),
  '#/bible/prayers': () => renderMyPrayers(app),
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
  '#/arena/year': (params) => renderYear(app, params.get('y')),
  '#/breathe': () => renderBreatheHome(app),
  '#/breathe/run': () => runBreathe(),
  '#/breathe/settings': () => renderBreatheSettings(app),
  '#/settings/night': () => nightlight.renderNightlightSettings(app),
  '#/intro': () => renderIntro(app),
};

const NAV = {
  hub: '#/hub', kegels: '#/kegels', track: '#/track', settings: '#/settings', guide: '#/guide',
  roadmap: '#/roadmap', review: '#/review', tutorial: '#/tutorial', pocket: '#/pocket',
  pe: '#/pe', 'pe-timer': '#/pe/timer', 'pe-measure': '#/pe/measure', 'pe-stats': '#/pe/stats',
  'pe-gallery': '#/pe/gallery', 'pe-guide': '#/pe/guide', 'pe-settings': '#/pe/settings',
  'kegel-settings': '#/kegels/settings',
  bible: '#/bible', 'bible-books': '#/bible/books',
  'bible-track': '#/bible/track', 'bible-settings': '#/bible/settings',
  'bible-prayers': '#/bible/prayers',
  breathe: '#/breathe', 'breathe-settings': '#/breathe/settings',
  habits: '#/habits', 'habits-archive': '#/habits/archive',
  arena: '#/arena', cabinet: '#/cabinet',
  'cabinet-feats': '#/cabinet/feats', 'cabinet-year': '#/cabinet/year',
  nightlight: '#/settings/night',
  intro: '#/intro',
};

const OPEN_WHEN_LOCKED = ['#/hub', '#/habits', '#/arena', '#/cabinet', '#/settings', '#/intro'];

let lastHash = '';

function route() {
  if (activeSession) {
    activeSession.stop();
    activeSession = null;
    document.body.classList.remove('in-session');
  }
  // Frees the decrypted object URLs.
  if (lastHash.startsWith('#/pe/gallery') && !location.hash.startsWith('#/pe/gallery')) leaveGallery();
  // Both consume their payload on the way out.
  if (lastHash.startsWith('#/arena/result') && !location.hash.startsWith('#/arena/result')) leaveResult();
  if (lastHash.startsWith('#/arena/moment') && !location.hash.startsWith('#/arena/moment')) leaveMoment();
  if (lastHash.startsWith('#/arena/rank') && !location.hash.startsWith('#/arena/rank')) leaveRank();
  lastHash = location.hash;

  if (lockActive()) return renderLock(app, route);

  const [path, query] = location.hash.split('?');

  if (introDue() && path !== '#/intro') return replaceWith('#/intro');

  // Allow-list, so a new route fails closed.
  if (!nifoUnlocked() && !OPEN_WHEN_LOCKED.some((p) => path === p || path.startsWith(p + '/'))) {
    return replaceWith('#/hub');
  }
  // Night light off where a cast would fake progress.
  nightlight.suspend(path.startsWith('#/pe/gallery') || path.startsWith('#/pe/measure'));

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
  if (path !== '#/session') window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  navigate(NAV[nav.dataset.nav] || '#/hub');
});

// Never left on the back stack: these start on arrival.
const EPHEMERAL = ['#/session', '#/bible/pray', '#/pe/timer', '#/pe/measure', '#/pocket', '#/breathe/run', '#/habits/edit', '#/arena/result', '#/arena/rank', '#/arena/moment', '#/arena/review', '#/intro'];

// One restore point a day, before anything can write over the day's record.
store.snapshot();

// Close the Arena's books before the first render.
collect();

// replaceState: no blank entry under the grid.
if (!location.hash) history.replaceState(history.state, '', '#/hub');

initTabs({ badges: () => ({ arena: hasResults() }) });

// APK only: hide the system nav bar.
native.hideNavBar();

initBack({
  resolve: (key) => NAV[key] || '#/hub',
  ephemeral: (hash) => EPHEMERAL.some((r) => hash.startsWith(r)),
});

// Background locks the vault.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Catches a week that ended while backgrounded.
    collect();
    native.hideNavBar();
    if (lockActive()) route();
    else if (location.hash.startsWith('#/hub') && (hasResults() || hasRank() || hasMoment())) route();
    return;
  }
  // Not mid-session: a running timer survives a glance away.
  if (store.get().settings.appLock && !activeSession) relock();

  if (vault.isUnlocked()) {
    vault.lock();
    leaveGallery();
    if (location.hash.startsWith('#/pe/gallery')) replaceWith('#/pe');
  }
});

window.addEventListener('hashchange', route);

route();

// Re-arm on every launch. A locked install has none.
if (nifoUnlocked()) {
  prayProgram.syncAlarms();
  bibleProgram.syncAlarm();
  breatheProgram.syncAlarm();
}
habitsProgram.syncAlarms();
// Arc alarms: opens, group ends, round ends.
arenaProgram.syncAlarms();

// Resync the filter's own copy of the schedule.
nightlight.init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Persistent storage. No-op in Safari.
navigator.storage?.persist?.().catch(() => {});
