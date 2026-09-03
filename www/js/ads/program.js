// Ads. AdMob through Capacitor, behind Google's consent form.
//
// Where they go is the whole design. Marking a habit takes eight seconds and
// that is the only reason anyone keeps the app, so nothing goes near it: no
// interstitial on open, nothing on the grid, nothing rewarded, and nothing at
// all in the first days. The banner is on screens people scroll, and the one
// interstitial is on the week's result, which is a pause the app already asked
// for.
//
// Four things must all be true before an ad exists: an AdMob account is
// configured, this is the APK rather than a browser, the install is past its
// grace, and the UMP SDK says ads can be requested for this user.

import * as store from '../store.js';
import { isNative } from '../native.js';
import { APP_ID, GRACE_DAYS, bannerUnit, interstitialUnit, configured, TESTING } from './config.js';

const plugin = () => window.Capacitor?.Plugins?.AdMob;

// Screens people scroll, and nothing else. A path not on this list gets no
// banner, which is the safe direction to be wrong in.
const BANNER_SCREENS = new Set([
  '#/cabinet',
  '#/cabinet/feats',
  '#/cabinet/year',
  '#/arena/feats',
  '#/arena/year',
  '#/arena/divisions',
  '#/habits/archive',
  '#/habits/habit',
]);

let ready = false; // the SDK is up and this user can be served
let bannerUp = false;
let fullLoaded = false;

const available = () => configured() && isNative() && !!plugin();

/** Past the grace, counted from the first launch this device recorded. */
const pastGrace = () => Date.now() - store.get().createdAt >= GRACE_DAYS * 86400000;

/* ---------------- consent, then the SDK ---------------- */

/** Called once at boot. Never throws: an ad failure is not an app failure. */
export async function init() {
  if (!available()) return;
  try {
    const info = await plugin().requestConsentInfo();
    // REQUIRED means the EEA or the UK. Everywhere else this is already
    // NOT_REQUIRED and the form never appears.
    if (info?.status === 'REQUIRED' && info?.isConsentFormAvailable) {
      await plugin().showConsentForm();
    }
    const now = await plugin().requestConsentInfo();
    if (!now?.canRequestAds) return;
    await plugin().initialize({ initializeForTesting: TESTING });
    ready = true;
  } catch {
    ready = false;
  }
}

/** True when Google says this user is owed a way back into the consent form.
 *  Only the EEA and the UK are, so the Settings row hides everywhere else. */
export async function consentChangeable() {
  if (!available()) return false;
  try {
    const info = await plugin().requestConsentInfo();
    return info?.privacyOptionsRequirementStatus === 'REQUIRED';
  } catch {
    return false;
  }
}

/** The Settings row. Google's own form, which is the only compliant one. */
export async function openConsentForm() {
  if (!available()) return false;
  try {
    await plugin().showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

/* ---------------- the banner ---------------- */

/** One call per navigation. The router knows the path, this knows the rule. */
export function onRoute(path) {
  if (!ready || !pastGrace()) return;
  if (BANNER_SCREENS.has(path)) showBanner();
  else hideBanner();
}

async function showBanner() {
  if (bannerUp) return;
  bannerUp = true;
  try {
    await plugin().showBanner({
      adId: bannerUnit(),
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: TESTING,
    });
  } catch {
    bannerUp = false;
  }
}

async function hideBanner() {
  if (!bannerUp) return;
  bannerUp = false;
  try {
    await plugin().removeBanner();
  } catch {
    /* nothing to remove is fine */
  }
}

/* ---------------- the weekly interstitial ---------------- */

const due = (weekKey) => !!weekKey && store.get().ads.lastFull !== weekKey;

/** Loaded while the result is being read, so the ad is ready by the time the
 *  screen is left and nobody waits at a blank one. */
export async function prepareWeekly(weekKey) {
  if (!ready || !pastGrace() || fullLoaded || !due(weekKey)) return;
  try {
    await plugin().prepareInterstitial({ adId: interstitialUnit(), isTesting: TESTING });
    fullLoaded = true;
  } catch {
    fullLoaded = false;
  }
}

/** One a week, never two, and only on the way out of the result screen. */
export async function showWeekly(weekKey) {
  if (!ready || !fullLoaded || !due(weekKey)) return;
  fullLoaded = false;
  // Written before it shows, not after: a crash mid-ad must not owe a second.
  store.update((st) => {
    st.ads.lastFull = weekKey;
  });
  try {
    await plugin().showInterstitial();
  } catch {
    /* an ad that would not show is not worth telling anyone about */
  }
}
