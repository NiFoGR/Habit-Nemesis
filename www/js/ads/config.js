// The AdMob account this build talks to. The only file to edit when the units
// change.
//
// FILL BEFORE THE STORE BUILD. Every value comes from the AdMob dashboard, and
// docs/STORE.md says where each one is. Until they are set the app shows no ads
// at all and every ad call is a no-op, which is what a browser and a sideloaded
// APK want anyway.
//
// The ids are public by design: they are compiled into the app and any user can
// read them. They name an ad slot, not an account, and nothing can be spent
// with them.

// ca-app-pub-0000000000000000~0000000000, AdMob > Apps > App settings.
export const APP_ID = '';

// ca-app-pub-0000000000000000/0000000000, one per unit.
export const BANNER_ID = '';
export const INTERSTITIAL_ID = '';

// Google's own test units. Serving real ads to yourself is click fraud, and
// AdMob closes the account rather than the build, so a debug APK uses these.
export const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
export const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

// True everywhere except the store bundle: tools/patch-ads.mjs flips it in the
// copied assets during the release build, so the source is never the thing
// standing between a debug APK and a banned account.
export const TESTING = true;

/** No ids means no ads, and the app behaves exactly as it did before them. */
export const configured = () => !!APP_ID && !!BANNER_ID;

export const bannerUnit = () => (TESTING ? TEST_BANNER : BANNER_ID);
export const interstitialUnit = () => (TESTING ? TEST_INTERSTITIAL : INTERSTITIAL_ID);

// Days after install before the first ad. The habit of opening the app is not
// formed yet, and that is the only window that decides whether anyone stays.
export const GRACE_DAYS = 3;
