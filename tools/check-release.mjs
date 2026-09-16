// What must be true of anything that ships. `npm run check:release`.
//
// Every rule here is one CLAUDE.md or docs/STORE.md already states. They are
// checked rather than asked for because the one that matters most, the secret
// key, is a mistake you only make once and cannot take back: a key in `www/`
// is a key in the APK, and an APK is public.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const problems = [];

/** Every file under a directory, recursively. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = walk(join(root, 'www'));
const rel = (p) => relative(root, p);

/* ---------------- no source maps ---------------- */
// There is no build step, so there is nothing to map. One appearing means a
// bundler arrived and shipped the sources with it.
for (const path of files) {
  if (path.endsWith('.map')) problems.push(`${rel(path)}: a source map in www/. Nothing here is built, so nothing needs one.`);
}
for (const path of files.filter((p) => /\.(js|css)$/.test(p))) {
  if (/^\/\/[#@] sourceMappingURL=/m.test(readFileSync(path, 'utf8'))) {
    problems.push(`${rel(path)}: a sourceMappingURL comment.`);
  }
}

/* ---------------- no secret key ---------------- */
// The publishable key is public by design and its payload says "anon". The
// service key says "service_role" and bypasses Row Level Security, which is
// the only thing keeping one user's rows from another's.
//
// Every JWT found is decoded rather than pattern-matched: the same word
// encodes three different ways depending on where it lands in the base64, and
// a check that catches one of the three is worse than none.
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;

function roleOf(payload) {
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).role || '';
  } catch {
    return '';
  }
}

const PLAIN = [
  [/\bsb_secret_[A-Za-z0-9_-]{8,}/, 'a Supabase secret key'],
  [/\bSUPABASE_SERVICE_ROLE\b/, 'the service role name'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
];

for (const path of files.filter((p) => /\.(js|html|json|css)$/.test(p))) {
  const src = readFileSync(path, 'utf8');
  for (const [re, what] of PLAIN) {
    if (re.test(src)) problems.push(`${rel(path)}: ${what}. The secret key never goes in www/.`);
  }
  for (const m of src.matchAll(JWT)) {
    const role = roleOf(m[1]);
    if (role && role !== 'anon') {
      problems.push(`${rel(path)}: a JWT whose role is "${role}". Only the anon key belongs in www/.`);
    }
  }
}

/* ---------------- ads are test units in the tree ---------------- */
// tools/patch-ads.mjs flips this in the copied assets during a store build, so
// the source is never what stands between a sideloaded APK and a closed AdMob
// account.
const ads = readFileSync(join(root, 'www/js/ads/config.js'), 'utf8');
if (!/export const TESTING = true;/.test(ads)) {
  problems.push('www/js/ads/config.js: TESTING is not true. Only the store bundle flips it.');
}

/* ---------------- one keystore, and it is the debug one ---------------- */
const keys = walk(join(root, 'signing')).filter((p) => /\.(keystore|jks|p12)$/.test(p)).map(rel);
if (keys.length !== 1 || keys[0] !== 'signing/debug.keystore') {
  problems.push(`signing/: expected only signing/debug.keystore, found ${keys.join(', ') || 'nothing'}.`);
}

/* ---------------- the scheme, and the package, which are not the same ----------------
   A provider sign-in returns through a custom scheme, and three files name it
   separately. Drift is silent: sign-in opens the browser, the browser returns to
   a scheme nothing is listening for, and the user is left on a blank tab.

   The scheme is deliberately not the package id. RFC 3986 gives a scheme
   letters, digits, plus, minus and dot, while an Android package may also carry
   an underscore, so a package is not always a legal scheme. `new URL()` throws
   on one that is not, and native.js parses every deep link with it. */
const valueOf = (path, re) => (re.exec(readFileSync(join(root, path), 'utf8')) || [])[1] || '';

const schemes = {
  'www/js/account/config.js': valueOf('www/js/account/config.js', /NATIVE_SCHEME = '([^']+)'/),
  'tools/patch-deeplink.mjs': valueOf('tools/patch-deeplink.mjs', /const SCHEME = '([^']+)'/),
  'tools/patch-shortcuts.mjs': valueOf('tools/patch-shortcuts.mjs', /const SCHEME = '([^']+)'/),
};
if (new Set(Object.values(schemes)).size !== 1) {
  problems.push(`the URL scheme disagrees: ${Object.entries(schemes).map(([f, v]) => `${f} says "${v}"`).join(', ')}`);
}

const scheme = schemes['www/js/account/config.js'];
// Checked rather than assumed: this shipped once as the package id, and an
// underscore in it takes out every deep link in the app at the same time.
if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) {
  problems.push(`"${scheme}" is not a legal URL scheme, so new URL() throws and every deep link breaks. Letters, digits, plus, minus and dot only, starting with a letter.`);
}

const packages = {
  'capacitor.config.json': valueOf('capacitor.config.json', /"appId"\s*:\s*"([^"]+)"/),
  'tools/patch-shortcuts.mjs': valueOf('tools/patch-shortcuts.mjs', /const PACKAGE = '([^']+)'/),
};
if (new Set(Object.values(packages)).size !== 1) {
  problems.push(`the package name disagrees: ${Object.entries(packages).map(([f, v]) => `${f} says "${v}"`).join(', ')}`);
}

const pkg = packages['capacitor.config.json'];
// Play holds the first upload to this for ever, and it refuses a bundle whose
// package does not match the listing.
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(pkg)) {
  problems.push(`"${pkg}" is not a valid Android package: two or more segments, each starting with a letter, letters digits and underscore only.`);
}

/* ---------------- the privacy page and the store answers agree ---------------- */
// Play checks one against the other, and a sign-in route added without saying
// so is the way an app gets pulled rather than warned.
const privacy = readFileSync(join(root, 'www/legal/privacy.html'), 'utf8');
const store = readFileSync(join(root, 'docs/STORE.md'), 'utf8');
const phoneAuth = /signInWithOtp/.test(readFileSync(join(root, 'www/js/account/session.js'), 'utf8'));
if (phoneAuth) {
  if (!/phone number/i.test(privacy)) problems.push('www/legal/privacy.html: the app signs in by phone and the policy does not say so.');
  if (!/Phone number/.test(store)) problems.push('docs/STORE.md: Data safety does not declare the phone number.');
}

if (problems.length) {
  console.error('\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`ok  ${files.length} shipped files, no source maps, no secret, ads on test units`);
console.log('ok  one keystore and it is the debug one');
console.log(`ok  scheme "${scheme}" in three places, package "${pkg}" in two, both legal`);
console.log('ok  the privacy page and the store answers name the same sign-in routes');
