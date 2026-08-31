// Registers the app's own URL scheme with Android, so a provider sign-in can
// come back into the app.
//
// Google refuses to serve its sign-in pages to an embedded WebView, which is
// what a Capacitor app is, so the provider opens in a Custom Tab. The way back
// is a custom scheme: com.habitnemesis.app://auth. Without an intent filter for
// it, the tab lands on a page Android cannot open and the sign-in silently
// never finishes.
//
// android/ is regenerated on every build, so a hand-edited manifest is thrown
// away by the next CI run. This runs after `cap sync`, like patch-signing.mjs
// and patch-backup.mjs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const SCHEME = 'com.habitnemesis.app';
const HOST = 'auth';

if (!existsSync(MANIFEST)) {
  console.error(`${MANIFEST} not found. Run \`npx cap add android\` first.`);
  process.exit(1);
}

let xml = readFileSync(MANIFEST, 'utf8');

const MARK = `android:scheme="${SCHEME}"`;
if (xml.includes(MARK)) {
  console.log('deep link already registered');
  process.exit(0);
}

const FILTER = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" android:host="${HOST}" />
            </intent-filter>
`;

// After the launcher filter, so the two sit together and the launcher stays first.
const LAUNCHER = '<category android:name="android.intent.category.LAUNCHER" />';
const at = xml.indexOf(LAUNCHER);
if (at < 0) {
  console.error('No launcher intent filter in the manifest. Capacitor changed its template.');
  process.exit(1);
}
const close = xml.indexOf('</intent-filter>', at);
if (close < 0) {
  console.error('Malformed manifest: the launcher intent filter never closes.');
  process.exit(1);
}
const end = close + '</intent-filter>'.length;

xml = xml.slice(0, end) + '\n' + FILTER.trimEnd() + xml.slice(end);
writeFileSync(MANIFEST, xml);

// Checked rather than assumed: a silent no-op here is a sign-in that hangs.
const after = readFileSync(MANIFEST, 'utf8');
if (!after.includes(MARK) || !after.includes(`android:host="${HOST}"`)) {
  console.error('The intent filter did not land. Manifest left as it was.');
  process.exit(1);
}
console.log(`deep link registered: ${SCHEME}://${HOST}`);
