// Turns ads live in the store bundle, and nowhere else.
//
// www/js/ads/config.js ships with TESTING = true, so a browser, a dev server
// and a sideloaded APK all serve Google's test units. Real units on a build you
// tap yourself is click fraud, and AdMob answers it by closing the account, not
// the build. This flips the flag in the copy `cap sync` made, so the source in
// the repo is never the thing standing between a debug build and a ban.
//
// It also writes the AdMob app id into the manifest, which the Google Mobile
// Ads SDK reads on startup and crashes without.
//
// No ids configured is not an error: the bundle ships with no ads.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CONFIG = 'android/app/src/main/assets/public/js/ads/config.js';
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';

if (!existsSync(CONFIG)) {
  console.error(`${CONFIG} not found. Run \`npx cap sync android\` first.`);
  process.exit(1);
}

const src = readFileSync(CONFIG, 'utf8');
const idOf = (name) => (new RegExp(`export const ${name} = '([^']*)'`).exec(src) || [])[1] ?? '';
const appId = idOf('APP_ID');

if (!appId || !idOf('BANNER_ID')) {
  console.log('patch-ads: no AdMob ids in config.js, so this bundle ships with no ads.');
  process.exit(0);
}

// ca-app-pub-<16 digits>~<10 digits>. A unit id has a slash and would be
// accepted by the manifest, then fail at runtime with nothing to read.
if (!/^ca-app-pub-\d{16}~\d{10}$/.test(appId)) {
  console.error(`APP_ID is "${appId}". An app id looks like ca-app-pub-0000000000000000~0000000000.`);
  process.exit(1);
}

const live = src.replace(/export const TESTING = true;/, 'export const TESTING = false;');
if (live === src) {
  console.error('TESTING was not found in config.js. Its declaration changed.');
  process.exit(1);
}
writeFileSync(CONFIG, live);

let xml = readFileSync(MANIFEST, 'utf8');
const META = 'com.google.android.gms.ads.APPLICATION_ID';
if (!xml.includes(META)) {
  const tag = `
        <meta-data
            android:name="${META}"
            android:value="${appId}" />
`;
  const close = xml.indexOf('</application>');
  if (close < 0) {
    console.error('No </application> in the manifest. Capacitor changed its template.');
    process.exit(1);
  }
  xml = xml.slice(0, close) + tag.trimEnd() + '\n    ' + xml.slice(close);
  writeFileSync(MANIFEST, xml);
}

// Checked rather than assumed: either half missing is a crash on first launch.
const after = readFileSync(CONFIG, 'utf8');
if (!after.includes('export const TESTING = false;') || !readFileSync(MANIFEST, 'utf8').includes(appId)) {
  console.error('The ad configuration did not land. Build left as it was.');
  process.exit(1);
}
console.log(`patch-ads: live units, app id ${appId}`);
