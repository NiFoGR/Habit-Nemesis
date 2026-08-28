// App shell.
//
// This file owns three things and nothing else: the route table, the shell
// state that screens must not each keep their own copy of (the running
// session, the install prompt), and boot. Every screen lives in its own
// module and is called from ROUTES below.
//
// Where things are:
//   tabs.js           the bottom bar: Cabinet, Grid, Arena
//   habits/home.js    the Grid, which is where you land
//   arena/home.js     the Arena: where you stand, right now
//   arena/cabinet.js  the Cabinet: what you have done, for ever
//   settings.js       app-wide settings
//   lock.js           the optional PIN gate
//   nifo.js           whether this install has the five preloaded sections
//   intro.js          the introduction, shown once on a new install
//   names.js          what each section is called
//   kegels/ pe/ bible/ breathe/ habits/ one folder per feature
//                     (pray/ is part of bible/)
//
// docs/CODEMAP.md has the full map.

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

/** The one screen that outlives a render, so the router can stop it. */
let activeSession = null;
let installPrompt = null;

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
  // The grid is the home screen. This stays as an alias so older links, a
  // pinned shortcut or a notification cannot land on a route that is gone.
  '#/habits': () => renderHome(app),
  '#/habits/habit': (params) => renderHabitDetail(app, params.get('id')),
  '#/habits/edit': (params) => renderHabitEdit(app, { id: params.get('id'), kind: params.get('kind') }),
  '#/habits/archive': () => renderArchive(app),
  '#/arena': () => renderArena(app),
  '#/arena/result': () => renderResult(app),
  '#/arena/moment': () => renderMoment(app),
  '#/cabinet': () => renderCabinet(app),
  '#/cabinet/feats': () => renderFeats(app),
  '#/cabinet/year': (params) => renderYear(app, params.get('y')),
  // The feats and the review moved into the Cabinet when it became a room of
  // its own. These stay so a pinned shortcut or a notification cannot land on
  // a route that is gone, which is the same reason #/habits still answers.
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
  // Leaving the gallery frees the decrypted object URLs it handed to <img>.
  if (lastHash.startsWith('#/pe/gallery') && !location.hash.startsWith('#/pe/gallery')) leaveGallery();
  // The two announcement screens each consume what put them on screen, so they
  // hold it until you actually leave. Letting go is the router's job for the
  // same reason freeing those object URLs is: only the router knows you left.
  if (lastHash.startsWith('#/arena/result') && !location.hash.startsWith('#/arena/result')) leaveResult();
  if (lastHash.startsWith('#/arena/moment') && !location.hash.startsWith('#/arena/moment')) leaveMoment();
  lastHash = location.hash;

  if (lockActive()) return renderLock(app, route);

  const [path, query] = location.hash.split('?');

  // A new install is introduced before it is used. Nothing else has happened
  // yet, so this can sit ahead of every other interception below.
  if (introDue() && path !== '#/intro') return replaceWith('#/intro');

  // What a locked install can reach, written as the list of what is open
  // rather than the list of what is shut. The five sections are eleven route
  // prefixes between them and would grow again with the next screen; the three
  // rooms, Settings and the introduction do not. Getting this wrong in the
  // open direction shows a stranger a pelvic floor programme and in the closed
  // direction shows them the grid, so it is written to fail closed.
  if (!nifoUnlocked() && !OPEN_WHEN_LOCKED.some((p) => path === p || path.startsWith(p + '/'))) {
    return replaceWith('#/hub');
  }
  // There used to be a token set per section, swapped on the body here, so
  // every section had its own accent. Six accents made the app read as six
  // apps, and it meant colour answered "where am I" instead of "what state is
  // this in". One theme now, so there is nothing to swap.
  // The progress gallery and the monthly check-in's camera are the two screens
  // where a colour cast is not cosmetic: it would make a photo look like
  // progress, or hide it. The night light stands down for both.
  nightlight.suspend(path.startsWith('#/pe/gallery') || path.startsWith('#/pe/measure'));

  // A week that ended, and then a cup that opened, are shown on the way to the
  // grid rather than instead of it: the grid is where you always land, so this
  // is the one place that can catch you without hijacking a deep link into a
  // session or a notification.
  //
  // They queue behind each other with no code to sequence them: the result
  // screen's way out is the grid, and the grid is what sends you on to the
  // moment.
  if (path === '#/hub') {
    if (hasResults()) return replaceWith('#/arena/result');
    if (hasMoment()) return replaceWith('#/arena/moment');
  }

  syncTabs(path);

  const fn = ROUTES[path] || (() => renderHome(app));
  fn(new URLSearchParams(query || ''));
  // The entry animation belongs to arriving somewhere, not to a screen
  // updating part of itself. Adding it here is what lets a cell on the grid
  // change without the whole page fading back in behind it.
  app.querySelector('.screen')?.classList.add('enter');
  if (path !== '#/session') window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  navigate(NAV[nav.dataset.nav] || '#/hub');
});

// Screens that must not be left on the back stack. Mostly those that start
// running the moment you arrive, so Back cannot walk into a session you have
// just finished and set it going again.
//
// The habit form is here for the neighbouring reason: it is finished by its own
// Save button, and coming out of it has to land on the grid you were adding to
// rather than on a second copy of the form.
//
// The Arena's result screen is here for a third reason again: it is shown once
// and consumes what put it there as you leave, so an entry for it on the back
// stack is an entry that renders an empty screen and bounces you out of it.
// The introduction is the same shape: finishing it is what makes it stop
// happening, so there must be nothing behind you to walk back into.
const EPHEMERAL = ['#/session', '#/bible/pray', '#/pe/timer', '#/pe/measure', '#/pocket', '#/breathe/run', '#/habits/edit', '#/arena/result', '#/arena/moment', '#/intro'];

// The Arena's books are closed before anything renders, so the first screen
// after a week ends is the result of it rather than a grid with a number that
// has quietly moved. It writes only when something has actually finished.
collect();

// Today is the default screen, settled before back.js takes its bearings below.
// replaceState rather than assignment: landing on the app should not leave a
// blank entry underneath Today for Back to fall into.
if (!location.hash) history.replaceState(history.state, '', '#/hub');

// The bar is drawn once and then only ever has a class toggled on it. The dot
// on a tab is asked for on every route change rather than pushed, so nothing
// has to remember to clear it.
initTabs({ badges: () => ({ arena: hasResults() }) });

// Two bars at the bottom of a phone is one too many, so the system one goes in
// the APK. A no-op in a browser, and a no-op in an older APK that does not
// carry the plugin.
native.hideNavBar();

// Back is its own gesture, not a link that happens to point backwards. back.js
// says why, and owns the Android hardware button along with it.
initBack({
  resolve: (key) => NAV[key] || '#/hub',
  ephemeral: (hash) => EPHEMERAL.some((r) => hash.startsWith(r)),
});

// Locking the vault the moment the app is backgrounded keeps decrypted photos
// off the app switcher preview and out of a phone handed to someone else.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // A phone left open across Sunday midnight would otherwise sit on last
    // week's fixture until it was force-quit. sync() writes only when a week
    // has actually ended, so this costs nothing on every other return.
    collect();
    native.hideNavBar();
    if (lockActive()) route();
    else if (location.hash.startsWith('#/hub') && (hasResults() || hasMoment())) route();
    return;
  }
  // Backgrounding re-arms the app lock, that is the whole point of it. A
  // session in progress is the exception: a timer running against a real
  // contraction must not be thrown away because you glanced at a message.
  // Note this is independent of the vault's own idle auto-lock, so a gallery
  // that times out after two minutes does not eject you from the app.
  if (store.get().settings.appLock && !activeSession) relock();

  if (vault.isUnlocked()) {
    vault.lock();
    leaveGallery();
    if (location.hash.startsWith('#/pe/gallery')) replaceWith('#/pe');
  }
});

window.addEventListener('hashchange', route);

route();

// The prayer and reading reminders must survive a reinstall of the app's own
// state, so they are re-armed from settings on every launch rather than only
// when the times are edited.
// Three of these belong to sections a locked install does not have, so it has
// nothing to be reminded of. The habits' own reminders are everyone's.
if (nifoUnlocked()) {
  prayProgram.syncAlarms();
  bibleProgram.syncAlarm();
  breatheProgram.syncAlarm();
}
habitsProgram.syncAlarms();
// The Arc's three: the day a cup opens, the day its group stage ends, and the
// evening before a round you are in finishes. Re-armed here because a launch
// is exactly when what is true about them has changed.
arenaProgram.syncAlarms();

// The night light is the same story: the APK's filter service keeps its own
// copy of the schedule, and this is what puts the two back in step after a
// reinstall or a restored backup.
nightlight.init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Everything is on the device, which means the browser is allowed to throw it
// away to reclaim space. Asking marks the origin as worth keeping where the
// browser supports it, and is a no-op where it does not - Safari among them,
// which is the reason the iPhone answer is "add it to the Home Screen": an
// installed PWA is not subject to the seven-day eviction a tab is.
navigator.storage?.persist?.().catch(() => {});
