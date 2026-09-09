// Ads. Two jobs, and only one of them is about the store.
//
// The manifest meta-data is written on every build, configured or not. The
// Google Mobile Ads SDK ships a ContentProvider that reads it while the process
// starts, and throws when it is missing, so an app that never asks for an ad
// still cannot launch without it. Google's published sample app id stands in
// until there is an account.
//
// www/js/ads/config.js ships with TESTING = true, so a browser, a dev server
// and a sideloaded APK all serve Google's test units. Real units on a build you
// tap yourself is click fraud, and AdMob answers it by closing the account, not
// the build. Only a configured store bundle flips it, in the copy `cap sync`
// made, so the source in the repo is never the thing standing between a debug
// build and a ban.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CONFIG = 'android/app/src/main/assets/public/js/ads/config.js';
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const META = 'com.google.android.gms.ads.APPLICATION_ID';
/** Google's own sample. Belongs to no account and serves nothing. */
const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

if (!existsSync(CONFIG)) {
  console.error(`${CONFIG} not found. Run \`npx cap sync android\` first.`);
  process.exit(1);
}

const src = readFileSync(CONFIG, 'utf8');
const idOf = (name) => (new RegExp(`export const ${name} = '([^']*)'`).exec(src) || [])[1] ?? '';
const appId = idOf('APP_ID');
const live = !!appId && !!idOf('BANNER_ID');

// ca-app-pub-<16 digits>~<10 digits>. A unit id has a slash and would be
// accepted by the manifest, then fail at runtime with nothing to read.
if (appId && !/^ca-app-pub-\d{16}~\d{10}$/.test(appId)) {
  console.error(`APP_ID is "${appId}". An app id looks like ca-app-pub-0000000000000000~0000000000.`);
  process.exit(1);
}

const manifestId = live ? appId : SAMPLE_APP_ID;

/* ---------------- the manifest ---------------- */

let xml = readFileSync(MANIFEST, 'utf8');
if (xml.includes(META)) {
  // Tested before replacing: rewriting an id to the one already there is a
  // no-op, and a no-op must not read as a failure to find it.
  const pair = new RegExp(`(android:name="${META}"\\s*android:value=")[^"]*(")`);
  if (!pair.test(xml)) {
    console.error(`${META} is in the manifest in a shape this cannot rewrite.`);
    process.exit(1);
  }
  xml = xml.replace(pair, `$1${manifestId}$2`);
} else {
  const close = xml.indexOf('</application>');
  if (close < 0) {
    console.error('No </application> in the manifest. Capacitor changed its template.');
    process.exit(1);
  }
  const tag = `    <meta-data\n            android:name="${META}"\n            android:value="${manifestId}" />\n    `;
  xml = xml.slice(0, close) + tag + xml.slice(close);
}
writeFileSync(MANIFEST, xml);

/* ---------------- the units ---------------- */

if (live) {
  const flipped = src.replace(/export const TESTING = true;/, 'export const TESTING = false;');
  // Already flipped is done, not missing. Only neither shape is a changed file.
  if (flipped === src && !src.includes('export const TESTING = false;')) {
    console.error('TESTING was not found in config.js. Its declaration changed.');
    process.exit(1);
  }
  writeFileSync(CONFIG, flipped);
}

// Checked rather than assumed: a missing app id is a crash before the first frame.
const after = readFileSync(MANIFEST, 'utf8');
if (!after.includes(META) || !after.includes(manifestId)) {
  console.error('The app id did not land in the manifest. Build left as it was.');
  process.exit(1);
}
if (live && !readFileSync(CONFIG, 'utf8').includes('export const TESTING = false;')) {
  console.error('The ad configuration did not land. Build left as it was.');
  process.exit(1);
}

console.log(live
  ? `patch-ads: live units, app id ${manifestId}`
  : `patch-ads: no AdMob account, so no ads. Sample app id written so the SDK can start.`);
