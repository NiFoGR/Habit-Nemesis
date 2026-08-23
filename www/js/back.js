// What "back" means, in one place.
//
// Three things ask that question and they were all answering it differently.
//
//   The Android hardware button. Capacitor finishes the activity when nothing
//   has registered a `backButton` listener, so in the APK back quit the app
//   from any screen, mid-session included. That is the "it exits the app" bug.
//
//   The arrow in the top left. Most screens set an explicit hash, which pushes
//   a *new* history entry, so going "back" from Kegels to Today and then
//   pressing the hardware button took you forwards into Kegels again. Screens
//   that render inside another screen's route (the first-run walkthrough) had
//   no entry to unwind at all and simply redrew themselves, which is the
//   "unresponsive" bug.
//
//   The browser's own back, in the PWA, which was the only one that worked.
//
// The rule now, in order:
//
//   1. If the screen drew its own way out, back presses it. A running session
//      gets to ask before it throws itself away, a walkthrough steps back a
//      page. The screen already contains that logic behind its corner button,
//      so this presses the button rather than duplicating it.
//   2. Otherwise unwind our own history.
//   3. With no history to unwind, go to the screen above this one, so arriving
//      straight onto a deep screen from a notification is not a dead end.
//   4. Only at the top of the tree does back leave the app.
//
// Screens opt in by marking their corner button:
//
//   data-back="kegels"   plain navigation. Unwind history; `kegels` is where
//                        to go if there is none.
//   data-back            (no value) the screen handles it itself. Its own
//                        click handler runs and nothing here interferes.

/** Resolves a nav key to a hash. Supplied by the router, which owns the table. */
let resolve = () => '#/hub';

/** True for a screen that runs something. Supplied by the router. */
let ephemeral = () => false;

/* ---------------- is there anything behind us? ----------------
   `history.length` is no help: it counts entries from before the app loaded and
   never shrinks. So each entry gets stamped with a serial as it is created, and
   the question becomes whether the one we are on was created after the one we
   started on.

   Serials, not a running tally, because a tally drifts. Two things break it:
   going back to an entry with the *same hash* fires `popstate` but no
   `hashchange`, so a hashchange-only listener silently loses count; and
   `location.replace` wipes `history.state`, so the entry it lands on is
   indistinguishable from a freshly pushed one. Reading a stamp off the entry
   we are actually on is immune to both. */

let seq = 0;      // last serial handed out
let here = 0;     // serial of the entry we are on
let first = 0;    // serial of the entry the app launched on
let was = '';     // hash we were on before the current navigation

/** True when there is an entry of our own behind this one. */
const canGoBack = () => here > first;

/** The screen sitting directly beneath this one, or null at the bottom. */
const beneath = () => history.state?.nifoUnder ?? null;

/** Held across a replace, since the browser wipes `history.state` doing one. */
let carried = null;

function onNavigated() {
  const stamp = history.state?.nifoState;
  if (typeof stamp === 'number') {
    // An entry we have already seen: back, forward, or the hashchange that
    // follows a popstate. Reading it is idempotent, which is why both events
    // can share this handler.
    here = stamp;
    carried = null;
    was = location.hash;
    return;
  }
  // No stamp, so the entry was just created. A replace carries the serial and
  // the screen underneath, because it put nothing new on the stack; anything
  // else is a push, and lands on top of wherever we just were.
  here = carried ? carried.serial : ++seq;
  const under = carried ? carried.under : was;
  carried = null;
  history.replaceState({ ...(history.state || {}), nifoState: here, nifoUnder: under }, '');
  was = location.hash;
}

/**
 * Swap the current screen for `hash` rather than stacking on top of it.
 * Going *up* out of a screen has to replace: pushing would leave the screen you
 * just left sitting behind you, so the next Back would walk straight back into
 * it.
 */
export function replaceWith(hash) {
  if (location.hash === hash) return;
  carried = { serial: here, under: beneath() };
  location.replace(hash);
}

/* ---------------- the decision ---------------- */

/** The corner control of whatever is on screen, or null. */
const cornerButton = () => document.querySelector('#app [data-back]');

/**
 * Act on a back gesture.
 * @returns {boolean} false when back means "leave the app", which only the
 *          caller that can actually do that gets to act on.
 */
export function goBack() {
  const corner = cornerButton();

  // 1. The screen owns it.
  if (corner && corner.getAttribute('data-back') === '') {
    corner.click();
    return true;
  }

  // 2. Our own history.
  if (canGoBack()) {
    history.back();
    return true;
  }

  // 3. The screen above this one. Replaces rather than pushes: going up must
  //    not build a trail that going back then has to walk down again.
  const up = corner ? resolve(corner.getAttribute('data-back')) : null;
  if (up && up !== location.hash) {
    replaceWith(up);
    return true;
  }

  // 4. Top of the tree.
  return false;
}

/**
 * Leave the current screen, from a screen that handles Back itself.
 * Unwinds history where there is any, so coming out of the same screen twice
 * does not leave two entries behind to walk back down through.
 * @param {string} fallback where to go when there is no history, e.g. opened
 *        straight onto this screen from a notification.
 */
export function leaveTo(fallback) {
  if (canGoBack()) return history.back();
  replaceWith(fallback);
}

/**
 * Go to `hash`.
 * Leaving a screen that *runs* something replaces it rather than stacking on
 * top of it, because those screens start on arrival. Pushing would leave the
 * session you have just finished sitting behind you, and Back would start it
 * again from the beginning.
 */
export function navigate(hash) {
  if (!ephemeral(location.hash)) {
    location.hash = hash;
    return;
  }
  // Leaving a screen that runs something. Where that is simply where we came
  // from, unwind to it: the entry is already sitting there, and replacing
  // would leave an identical screen one Back press away doing nothing.
  if (canGoBack() && beneath() === hash) return history.back();
  replaceWith(hash);
}

/* ---------------- wiring ---------------- */

/**
 * @param {object} opts
 * @param {(key: string) => string} opts.resolve nav key to hash
 * @param {(hash: string) => boolean} opts.ephemeral is this a screen that runs
 *        something, and so must not be left on the back stack
 */
export function initBack(opts) {
  resolve = opts.resolve;
  ephemeral = opts.ephemeral;

  // Whatever we launched on is the floor. Back never goes below it.
  history.replaceState({ ...(history.state || {}), nifoState: 0, nifoUnder: null }, '');
  seq = here = first = 0;
  was = location.hash;
  // Both events, because neither fires for every navigation on its own:
  // pushes raise only hashchange, and a back to the same hash only popstate.
  window.addEventListener('popstate', onNavigated);
  window.addEventListener('hashchange', onNavigated);

  // A back arrow with a destination is a back gesture, not a link to somewhere
  // that happens to be behind us, so it goes through the same four rules.
  // A bare data-back is the screen's own button and is left alone.
  document.addEventListener('click', (e) => {
    const corner = e.target.closest('[data-back]');
    if (!corner || corner.getAttribute('data-back') === '') return;
    e.preventDefault();
    goBack();
  });

  wireHardwareBack();
}

/** Capacitor's App plugin, present only in the APK. */
function wireHardwareBack() {
  const app = window.Capacitor?.Plugins?.App;
  if (!app?.addListener) return;
  // Registering at all is half the fix: Capacitor only stops finishing the
  // activity once something is listening.
  app.addListener('backButton', () => {
    if (!goBack()) app.exitApp?.();
  });
}
