// R8 renamed the app without eating anything reached by name. Run after a
// release build, against the mapping file it writes.
//
// Two ways R8 goes wrong quietly. It keeps everything, and Play scores the
// bundle exactly as it did before. Or it renames something found by name at
// runtime, and the app dies with a green build behind it. The mapping file
// answers both, so it is read rather than trusted.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAP = root + 'android/app/build/outputs/mapping/release/mapping.txt';
const PLUGINS = root + 'android/app/src/main/assets/capacitor.plugins.json';

if (!existsSync(MAP)) {
  console.error('No mapping file: R8 did not run.');
  process.exit(1);
}
const map = readFileSync(MAP, 'utf8');

let bad = 0;
const fail = (line) => { console.error(line); bad++; };

/* ---- it ran ---- */

const renamed = map.split('\n').filter((l) => /^[^ ].* -> [a-z0-9.]+:$/.test(l)).length;
console.log(`classes renamed: ${renamed}`);
// Under a thousand means the keep rules are swallowing the app.
if (renamed <= 1000) fail(`Only ${renamed} classes renamed. R8 is being kept from working.`);

/* ---- it left the names that are looked up ---- */

// Capacitor calls Class.forName on every classpath in here as the first
// activity is created, so a rename is a crash on launch, not on first use.
// The list is read rather than written out: adding a plugin must not need
// this file edited, because nobody would remember.
const plugins = JSON.parse(readFileSync(PLUGINS, 'utf8')).map((p) => p.classpath);
if (plugins.length === 0) fail('capacitor.plugins.json lists no plugins. Capacitor changed its format.');

// The annotation R8 full mode folds to null, and the two widget components the
// manifest names as strings.
const byName = [
  ...plugins,
  'com.getcapacitor.annotation.CapacitorPlugin',
  'com.habitnemesis.widgets.GridWidgetProvider',
  'com.habitnemesis.widgets.WidgetActionReceiver',
];

for (const c of byName) {
  if (map.includes(`${c} -> ${c}:`)) console.log(`  kept  ${c}`);
  else fail(`${c} was renamed or dropped. A keep rule is missing.`);
}

process.exit(bad ? 1 : 0);
