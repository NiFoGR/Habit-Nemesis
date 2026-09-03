// Writes the version into the generated Android project.
//
// Capacitor's template ships versionCode 1 and versionName "1.0", and android/
// is rebuilt on every build, so without this every upload carries the same
// version. Play rejects a second upload at a versionCode it has already seen,
// which is the whole release stuck behind a number nobody set.
//
// One place to bump: the `version` field in package.json. versionCode is
// derived from it, so it moves whenever the name does and never goes backwards.
//
//   1.0.0 -> 10000      1.2.3 -> 10203      2.0.0 -> 20000
//
// Minor and patch are capped at 99 each, which is the arithmetic, not a policy.
// VERSION_CODE in the environment overrides it, for a rebuild of an upload Play
// already holds.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';

if (!existsSync(GRADLE)) {
  console.error(`${GRADLE} not found. Run \`npx cap add android\` first.`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || '');
if (!parts) {
  console.error(`package.json version is "${version}". It has to be major.minor.patch.`);
  process.exit(1);
}
const [, major, minor, patch] = parts.map(Number);
if (minor > 99 || patch > 99) {
  console.error(`Version ${version} does not fit: minor and patch each cap at 99.`);
  process.exit(1);
}

const derived = major * 10000 + minor * 100 + patch;
const override = process.env.VERSION_CODE ? Number(process.env.VERSION_CODE) : null;
if (override !== null && (!Number.isInteger(override) || override < 1)) {
  console.error(`VERSION_CODE is "${process.env.VERSION_CODE}". It has to be a whole number.`);
  process.exit(1);
}
const code = override ?? derived;

let gradle = readFileSync(GRADLE, 'utf8');
const before = gradle;
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${code}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

if (gradle === before) {
  console.error('Neither versionCode nor versionName was found. Capacitor changed its template.');
  process.exit(1);
}
writeFileSync(GRADLE, gradle);

// Checked rather than assumed: a silent no-op here is a rejected upload.
const after = readFileSync(GRADLE, 'utf8');
if (!after.includes(`versionCode ${code}`) || !after.includes(`versionName "${version}"`)) {
  console.error('The version did not land. Build file left as it was.');
  process.exit(1);
}
console.log(`version ${version}, versionCode ${code}${override !== null ? ' (VERSION_CODE override)' : ''}`);
