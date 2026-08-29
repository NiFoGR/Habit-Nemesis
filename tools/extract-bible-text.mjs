// Generates the bundled Bible text from a plain-text export of the Orthodox
// Study Bible you own. The parser is tools/lib/bible-parse.js.
//
//   node tools/extract-bible-text.mjs <path-to-osb.txt>
//
// Writes www/bible/<book>.json and www/bible/_meta.json.

import fs from 'node:fs';
import path from 'node:path';
import { parseBible, looksLikeOsb } from './lib/bible-parse.js';
import { BOOKS } from '../www/js/bible/canon.js';

const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/extract-bible-text.mjs <path-to-osb.txt>');
  process.exit(1);
}

const raw = fs.readFileSync(src, 'utf8');
if (!looksLikeOsb(raw)) console.warn('warning: this does not look like the OSB text export');

const t0 = Date.now();
const { books, stats } = parseBible(raw);
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'www', 'bible');
fs.mkdirSync(OUT, { recursive: true });

let bytes = 0;
for (const b of BOOKS) {
  const json = JSON.stringify(books[b.id] || {});
  bytes += json.length;
  fs.writeFileSync(path.join(OUT, `${b.id}.json`), json);
}
fs.writeFileSync(path.join(OUT, '_meta.json'), JSON.stringify(stats));

console.log(`parsed in ${secs}s`);
console.log(`  books    ${stats.books}`);
console.log(`  chapters ${stats.chapters}`);
console.log(`  verses   ${stats.verses.toLocaleString()}`);
console.log(`  missing  ${stats.missing} (${(100 * stats.missing / (stats.verses + stats.missing)).toFixed(2)}%)`);
console.log(`  size     ${(bytes / 1e6).toFixed(1)} MB across ${BOOKS.length} files`);

// Spot checks: a regression shows up as a wrong sentence, not a moved number.
const [, , , b, c, v] = process.argv;
const probes = b ? [[b, +c, +v]] : [['gen', 1, 1], ['psa', 22, 1], ['mat', 5, 4], ['jhn', 3, 16], ['rev', 22, 21]];
console.log('\nprobes:');
for (const [id, ch, n] of probes) {
  const t = books[id]?.[ch]?.[n];
  console.log(`  ${id} ${ch}:${n}  ${t ? JSON.stringify(t.slice(0, 70)) : '(missing)'}`);
}
