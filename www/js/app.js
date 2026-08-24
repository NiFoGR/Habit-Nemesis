// App shell.
//
// This file owns three things and nothing else: the route table, the shell
// state that screens must not each keep their own copy of (the running
// session, the install prompt), and boot. Every screen lives in its own
// module and is called from ROUTES below.
//
// Where things are:
//   hub.js            the Today screen and the feature registry
//   settings.js       app-wide settings
//   lock.js           the optional PIN gate
//   names.js          what each section is called
//   kegels/ pe/ bible/ breathe/ one folder per feature (pray/ is part of bible/)
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
import { renderBreatheHome, renderBreatheSettings } from './breathe/home.js';
import { startBreathe } from './breathe/session.js';
import * as breatheProgram from './breathe/program.js';
import { renderHub } from './hub.js';
import * as nightlight from './nightlight.js';
import { renderSettings } from './settings.js';
import { lockActive, renderLock, relock } from './lock.js';
import { initBack, navigate, replaceWith } from './back.js';
import * as vault from './pe/vault.js';
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
  '#/hub': () => renderHub(app),
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
  '#/breathe': () => renderBreatheHome(app),
  '#/breathe/run': () => runBreathe(),
  '#/breathe/settings': () => renderBreatheSettings(app),
  '#/settings/night': () => nightlight.renderNightlightSettings(app),
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
  nightlight: '#/settings/night',
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

  if (lockActive()) return renderLock(app, route);

  const [path, query] = location.hash.split('?');
  // One token set per section, swapped on the body. The shell stays the same
  // everywhere; only the palette and, for prayer, the type change.
  document.body.dataset.section = path.startsWith('#/pe') ? 'pe'
    : path.startsWith('#/bible') ? 'bible'
    : path.startsWith('#/breathe') ? 'breathe'
    : ['#/kegels', '#/kegels/settings', '#/session', '#/track', '#/guide', '#/roadmap', '#/review', '#/pocket', '#/tutorial'].includes(path) ? 'kegels'
    : 'hub';
  // The progress gallery and the monthly check-in's camera are the two screens
  // where a colour cast is not cosmetic: it would make a photo look like
  // progress, or hide it. The night light stands down for both.
  nightlight.suspend(path.startsWith('#/pe/gallery') || path.startsWith('#/pe/measure'));

  const fn = ROUTES[path] || (() => renderHub(app));
  fn(new URLSearchParams(query || ''));
  if (path !== '#/session') window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  navigate(NAV[nav.dataset.nav] || '#/hub');
});

// Screens that start running the moment you arrive. Leaving one replaces it
// instead of stacking on top, so Back cannot walk into a session you have just
// finished and set it going again.
const EPHEMERAL = ['#/session', '#/bible/pray', '#/pe/timer', '#/pe/measure', '#/pocket', '#/breathe/run'];

// Today is the default screen, settled before back.js takes its bearings below.
// replaceState rather than assignment: landing on the app should not leave a
// blank entry underneath Today for Back to fall into.
if (!location.hash) history.replaceState(history.state, '', '#/hub');

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
    if (lockActive()) route();
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
prayProgram.syncAlarms();
bibleProgram.syncAlarm();
breatheProgram.syncAlarm();

// The night light is the same story: the APK's filter service keeps its own
// copy of the schedule, and this is what puts the two back in step after a
// reinstall or a restored backup.
nightlight.init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
