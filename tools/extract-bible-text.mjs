// Checks the Bible parser against a real copy, outside the browser.
//
// The app parses your Bible on the phone (www/js/bible/parse.js) and stores it
// there; nothing is written into this repository. This script runs that exact
// parser over a file and reports what it got, which is how the extraction is
// verified and how a regression in it would be caught.
//
//   node tools/extract-bible-text.mjs <path-to-osb.txt> [book chapter verse]

import fs from 'node:fs';
import { parseBible, looksLikeOsb } from '../www/js/bible/parse.js';

const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/extract-bible-text.mjs <path-to-osb.txt> [book chapter verse]');
  process.exit(1);
}

const raw = fs.readFileSync(src, 'utf8');
if (!looksLikeOsb(raw)) console.warn('warning: this does not look like the OSB text export');

const t0 = Date.now();
const { books, stats } = parseBible(raw);
const secs = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`parsed in ${secs}s`);
console.log(`  books    ${stats.books}`);
console.log(`  chapters ${stats.chapters}`);
console.log(`  verses   ${stats.verses.toLocaleString()}`);
console.log(`  missing  ${stats.missing} (${(100 * stats.missing / (stats.verses + stats.missing)).toFixed(2)}%)`);

// A handful of verses that are easy to check by eye, so a regression in the
// repair shows up as a wrong sentence rather than as a number moving.
const [, , , b, c, v] = process.argv;
const probes = b ? [[b, +c, +v]] : [['gen', 1, 1], ['psa', 22, 1], ['mat', 5, 4], ['jhn', 3, 16], ['rev', 22, 21]];
console.log('\nprobes:');
for (const [id, ch, n] of probes) {
  const t = books[id]?.[ch]?.[n];
  console.log(`  ${id} ${ch}:${n}  ${t ? JSON.stringify(t.slice(0, 70)) : '(missing)'}`);
}

// Two crude health checks over the whole text.
let jam = 0, digit = 0, total = 0;
for (const book of Object.values(books)) {
  for (const chap of Object.values(book)) {
    for (const t of Object.values(chap)) {
      total++;
      if (/[A-Za-z]{16,}/.test(t)) jam++;
      if (/[a-z]\d|\d[a-z]/.test(t)) digit++;
    }
  }
}
const pc = (n) => `${((100 * n) / total).toFixed(2)}%`;
console.log(`\nverses with a jammed run   ${jam} ${pc(jam)}`);
console.log(`verses with a stray digit  ${digit} ${pc(digit)}`);
