// Back: one answer for the corner arrow, the Android button and history.
//
//   1. Screen drew its own way out, press it.
//   2. Else unwind our own history.
//   3. Else go up one screen.
//   4. Only at the top does back leave the app.
//
// Screens mark their corner control: data-back="key" is plain nav, bare
// data-back means the screen handles it.

/** Nav key to hash. From the router. */
let resolve = () => '#/hub';

/** Does this screen run something? From the router. */
let ephemeral = () => false;

/* ---------------- history depth ---------------- */
// history.length never shrinks, so each entry is stamped with a serial and we
// read the stamp off the entry we are on. Survives replace() and same-hash back.

let seq = 0;      // last serial handed out
let here = 0;     // serial of the entry we are on
let first = 0;    // serial of the entry the app launched on
let was = '';     // hash we were on before the current navigation

/** Is there an entry of our own behind this one? */
const canGoBack = () => here > first;

/** The screen beneath this one, or null at the bottom. */
const beneath = () => history.state?.nifoUnder ?? null;

/** Kept across a replace: the browser wipes history.state. */
let carried = null;

function onNavigated() {
  const stamp = history.state?.nifoState;
  if (typeof stamp === 'number') {
    // Seen before: back, forward, or the hashchange after a popstate.
    here = stamp;
    carried = null;
    was = location.hash;
    return;
  }
  // No stamp means new. A replace carries the serial, a push lands on top.
  here = carried ? carried.serial : ++seq;
  const under = carried ? carried.under : was;
  carried = null;
  history.replaceState({ ...(history.state || {}), nifoState: here, nifoUnder: under }, '');
  was = location.hash;
}

/** Replace, not push. Going up must not leave the old screen behind you. */
export function replaceWith(hash) {
  if (location.hash === hash) return;
  carried = { serial: here, under: beneath() };
  location.replace(hash);
}

/* ---------------- the decision ---------------- */

const cornerButton = () => document.querySelector('#app [data-back]');

/** Back. Returns false when it means "leave the app". */
export function goBack() {
  const corner = cornerButton();

  // 1. Screen owns it.
  if (corner && corner.getAttribute('data-back') === '') {
    corner.click();
    return true;
  }

  // 2. Our own history.
  if (canGoBack()) {
    history.back();
    return true;
  }

  // 3. Up one, replacing so going up leaves no trail.
  const up = corner ? resolve(corner.getAttribute('data-back')) : null;
  if (up && up !== location.hash) {
    replaceWith(up);
    return true;
  }

  // 4. Top of the tree.
  return false;
}

/** Way out for a screen that handles Back itself. `fallback` when no history. */
export function leaveTo(fallback) {
  if (canGoBack()) return history.back();
  replaceWith(fallback);
}

/** Navigate. A screen that runs something is replaced, never stacked. */
export function navigate(hash) {
  if (!ephemeral(location.hash)) {
    location.hash = hash;
    return;
  }
  // Already behind us, so unwind instead of replacing.
  if (canGoBack() && beneath() === hash) return history.back();
  replaceWith(hash);
}

/* ---------------- wiring ---------------- */

/** `resolve` maps a nav key to a hash; `ephemeral` flags screens that run. */
export function initBack(opts) {
  resolve = opts.resolve;
  ephemeral = opts.ephemeral;

  // The launch entry is the floor.
  history.replaceState({ ...(history.state || {}), nifoState: 0, nifoUnder: null }, '');
  seq = here = first = 0;
  was = location.hash;
  // Both: a push raises only hashchange, a same-hash back only popstate.
  window.addEventListener('popstate', onNavigated);
  window.addEventListener('hashchange', onNavigated);

  // A back arrow is a gesture, not a link. Bare data-back is left alone.
  document.addEventListener('click', (e) => {
    const corner = e.target.closest('[data-back]');
    if (!corner || corner.getAttribute('data-back') === '') return;
    e.preventDefault();
    goBack();
  });

  wireHardwareBack();
}

/** Capacitor App plugin, APK only. */
function wireHardwareBack() {
  const app = window.Capacitor?.Plugins?.App;
  if (!app?.addListener) return;
  // Capacitor stops finishing the activity once something listens.
  app.addListener('backButton', () => {
    if (!goBack()) app.exitApp?.();
  });
}
