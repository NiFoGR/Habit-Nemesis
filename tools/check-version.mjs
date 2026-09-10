// package.json and www/js/version.js name one version. `npm run check:version`.
//
// The Android build reads package.json and the About page reads version.js.
// Two files, because www/ cannot read outside itself and the build cannot ship
// package.json. They drift the first time one is bumped without the other.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8')).version;
const src = readFileSync(root + 'www/js/version.js', 'utf8');
const app = /VERSION = '([^']+)'/.exec(src)?.[1];

if (pkg !== app) {
  console.log(`package.json says ${pkg}, www/js/version.js says ${app}. Bump both.`);
  process.exit(1);
}
console.log(`ok  version ${pkg} in both places`);
