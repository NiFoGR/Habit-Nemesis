/* Build www/js/bible/canon.js and www/js/bible/lectionary.js from a plain-text
   export of The Orthodox Study Bible.

   Nothing this writes is scripture. It emits two things only:

     canon.js       how many chapters each book has and how many verses are in
                    each chapter, read off the navigation index the ebook ships
                    with ("Verses in Genesis Chapter 12" and the list under it).
     lectionary.js  the OSB's own personal-reading lectionary, which is a table
                    of *references*, keyed by offset from Pascha or by calendar
                    date.

   The verse text itself is deliberately not extracted. The PDF export mangles
   every italic and poetic passage into letter-spaced fragments ("B lessed is
   the m an / Who walks not in the counsel of the ungodly"), which is most of
   the Psalter, and a Bible that renders the Psalms as broken words is worse
   than no Bible at all. See docs/BIBLE.md.

   Usage: node tools/extract-bible-data.mjs <path-to-osb.txt>
*/

import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/extract-bible-data.mjs <path-to-osb.txt>');
  process.exit(1);
}
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'www', 'js', 'bible');
const lines = fs.readFileSync(src, 'utf8').split('\n').map(l => l.replace(/\f/g, ''));

/* ---- canon ---- */

// One entry per book, in the order the OSB prints them. `key` is how the
// ebook's index names the book; `name` is what we call it; `also` is the
// familiar Hebrew-canon name where the Septuagint name differs enough to
// confuse (3 Kingdoms is 1 Kings to everyone who grew up with a KJV).
const BOOKS = [
  ['gen',  'Genesis',              'Genesis',                  null,          'law',        false],
  ['exo',  'Exodus',               'Exodus',                   null,          'law',        false],
  ['lev',  'Leviticus',            'Leviticus',                null,          'law',        false],
  ['num',  'Numbers',              'Numbers',                  null,          'law',        false],
  ['deu',  'Deuteronomy',          'Deuteronomy',              null,          'law',        false],
  ['jos',  'Joshua',               'Joshua',                   null,          'history',    false],
  ['jdg',  'Judges',               'Judges',                   null,          'history',    false],
  ['rut',  'Ruth',                 'Ruth',                     null,          'history',    false],
  ['1ki',  '1 Kingdoms',           '1 Kingdoms',               '1 Samuel',    'history',    false],
  ['2ki',  '2 Kingdoms',           '2 Kingdoms',               '2 Samuel',    'history',    false],
  ['3ki',  '3 Kingdoms',           '3 Kingdoms',               '1 Kings',     'history',    false],
  ['4ki',  '4 Kingdoms',           '4 Kingdoms',               '2 Kings',     'history',    false],
  ['1ch',  '1 Chronicles',         '1 Chronicles',             null,          'history',    false],
  ['2ch',  '2 Chronicles',         '2 Chronicles',             null,          'history',    false],
  ['1es',  '1 Ezra',               '1 Ezra',                   '1 Esdras',    'history',    true ],
  ['2es',  '2 Ezra',               '2 Ezra',                   'Ezra',        'history',    false],
  ['neh',  'Nehemiah',             'Nehemiah',                 null,          'history',    false],
  ['tob',  'Tobit',                'Tobit',                    null,          'history',    true ],
  ['jdt',  'Judith',               'Judith',                   null,          'history',    true ],
  ['est',  'Esther',               'Esther',                   null,          'history',    false],
  ['1ma',  '1 Maccabees',          '1 Maccabees',              null,          'history',    true ],
  ['2ma',  '2 Maccabees',          '2 Maccabees',              null,          'history',    true ],
  ['3ma',  '3 Maccabees',          '3 Maccabees',              null,          'history',    true ],
  ['psa',  'Psalms',               'Psalms',                   null,          'wisdom',     false],
  ['job',  'Job',                  'Job',                      null,          'wisdom',     false],
  ['pro',  'Proverbs of Solomon',  'Proverbs',                 null,          'wisdom',     false],
  ['ecc',  'Ecclesiastes',         'Ecclesiastes',             null,          'wisdom',     false],
  ['sng',  'Song of Songs',        'Song of Songs',            null,          'wisdom',     false],
  ['wis',  'Wisdom of Solomon',    'Wisdom of Solomon',        null,          'wisdom',     true ],
  ['sir',  'Wisdom of Sirach',     'Wisdom of Sirach',         'Ecclesiasticus', 'wisdom',  true ],
  ['hos',  'Hosea',                'Hosea',                    null,          'prophets',   false],
  ['amo',  'Amos',                 'Amos',                     null,          'prophets',   false],
  ['mic',  'Micah',                'Micah',                    null,          'prophets',   false],
  ['joe',  'Joel',                 'Joel',                     null,          'prophets',   false],
  ['oba',  'Obadiah',              'Obadiah',                  null,          'prophets',   false],
  ['jon',  'Jonah',                'Jonah',                    null,          'prophets',   false],
  ['nah',  'Nahum',                'Nahum',                    null,          'prophets',   false],
  ['hab',  'Habakkuk',             'Habakkuk',                 null,          'prophets',   false],
  ['zep',  'Zephaniah',            'Zephaniah',                null,          'prophets',   false],
  ['hag',  'Haggai',               'Haggai',                   null,          'prophets',   false],
  ['zec',  'Zechariah',            'Zechariah',                null,          'prophets',   false],
  ['mal',  'Malachi',              'Malachi',                  null,          'prophets',   false],
  ['isa',  'Isaiah',               'Isaiah',                   null,          'prophets',   false],
  ['jer',  'Jeremiah',             'Jeremiah',                 null,          'prophets',   false],
  ['bar',  'Baruch',               'Baruch',                   null,          'prophets',   true ],
  ['lam',  'Lamentations of Jeremiah', 'Lamentations',         null,          'prophets',   false],
  ['epj',  'Epistle of Jeremiah',  'Epistle of Jeremiah',      null,          'prophets',   true ],
  ['eze',  'Ezekiel',              'Ezekiel',                  null,          'prophets',   false],
  ['dan',  'Daniel',               'Daniel',                   null,          'prophets',   false],
  ['mat',  'Matthew',              'Matthew',                  null,          'gospels',    false],
  ['mrk',  'Mark',                 'Mark',                     null,          'gospels',    false],
  ['luk',  'Luke',                 'Luke',                     null,          'gospels',    false],
  ['jhn',  'John',                 'John',                     null,          'gospels',    false],
  ['act',  'Acts',                 'Acts',                     null,          'acts',       false],
  ['rom',  'Romans',               'Romans',                   null,          'epistles',   false],
  ['1co',  '1 Corinthians',        '1 Corinthians',            null,          'epistles',   false],
  ['2co',  '2 Corinthians',        '2 Corinthians',            null,          'epistles',   false],
  ['gal',  'Galatians',            'Galatians',                null,          'epistles',   false],
  ['eph',  'Ephesians',            'Ephesians',                null,          'epistles',   false],
  ['php',  'Philippians',          'Philippians',              null,          'epistles',   false],
  ['col',  'Colossians',           'Colossians',               null,          'epistles',   false],
  ['1th',  '1 Thessalonians',      '1 Thessalonians',          null,          'epistles',   false],
  ['2th',  '2 Thessalonians',      '2 Thessalonians',          null,          'epistles',   false],
  ['1ti',  '1 Timothy',            '1 Timothy',                null,          'epistles',   false],
  ['2ti',  '2 Timothy',            '2 Timothy',                null,          'epistles',   false],
  ['tit',  'Titus',                'Titus',                    null,          'epistles',   false],
  ['phm',  'Philemon',             'Philemon',                 null,          'epistles',   false],
  ['heb',  'Hebrews',              'Hebrews',                  null,          'epistles',   false],
  ['jas',  'James',                'James',                    null,          'epistles',   false],
  ['1pe',  '1 Peter',              '1 Peter',                  null,          'epistles',   false],
  ['2pe',  '2 Peter',              '2 Peter',                  null,          'epistles',   false],
  ['1jn',  '1 John',               '1 John',                   null,          'epistles',   false],
  ['2jn',  '2 John',               '2 John',                   null,          'epistles',   false],
  ['3jn',  '3 John',               '3 John',                   null,          'epistles',   false],
  ['jud',  'Jude',                 'Jude',                     null,          'epistles',   false],
  ['rev',  'Revelation',           'Revelation',               null,          'revelation', false],
];

const idxRe = /^Verses in (?:Psalm (\d+)(?:\s*\(.*\))?|(.+?) Chapter (\d+))\s*$/;
const counts = new Map();   // index name -> Map(chapter -> highest verse number)

lines.forEach((line, i) => {
  const m = line.match(idxRe);
  if (!m) return;
  const key = m[1] ? 'Psalms' : m[2];
  const ch = Number(m[1] || m[3]);
  let highest = 0;
  for (let j = i + 1; j < i + 40; j++) {
    const t = (lines[j] || '').trim();
    if (!t) continue;
    if (/^Back to/.test(t)) break;
    const nums = t.split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s));
    if (!nums.length) break;
    highest = Math.max(highest, ...nums.map(Number));
  }
  if (!counts.has(key)) counts.set(key, new Map());
  counts.get(key).set(ch, highest);
});

const canon = BOOKS.map(([id, key, name, also, section, deutero]) => {
  const found = counts.get(key);
  if (!found) throw new Error(`no index entries for ${key}`);
  const chapters = [];
  for (let c = 1; c <= found.size; c++) {
    const v = found.get(c);
    if (!v) throw new Error(`${key}: missing chapter ${c}`);
    chapters.push(v);
  }
  return { id, name, also, section, deutero, chapters };
});

const totalCh = canon.reduce((a, b) => a + b.chapters.length, 0);
const totalV = canon.reduce((a, b) => a + b.chapters.reduce((x, y) => x + y, 0), 0);

/* ---- lectionary ---- */

// Every week in the movable cycle prints the same way: Monday through
// Saturday, then the Sunday that closes it. So one number per week places all
// seven days, and that number is the offset from Pascha of the week's Monday.
const ORDINALS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh',
  'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth',
  'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth', 'Twenty-First',
  'Twenty-Second', 'Twenty-Third', 'Twenty-Fourth', 'Twenty-Fifth', 'Twenty-Sixth',
  'Twenty-Seventh', 'Twenty-Eighth', 'Twenty-Ninth', 'Thirtieth', 'Thirty-First',
  'Thirty-Second'];

const WEEK_MONDAY = new Map([
  ['Fourth Week Before Lent', -76],
  ['Third Week Before Lent', -69],
  ['Meatfare Week', -62],
  ['Cheesefare Week', -55],
  ['First Week of Great Lent', -48],
  ['Second Week of Great Lent', -41],
  ['Third Week of Great Lent', -34],
  ['Fourth Week of Great Lent', -27],
  ['Fifth Week of Great Lent', -20],
  ['Sixth Week of Great Lent', -13],
  ['Bright Week', 1],
]);
for (let n = 2; n <= 7; n++) WEEK_MONDAY.set(`${ORDINALS[n]} Week of Pascha`, 7 * (n - 1) + 1);
for (let n = 1; n <= 32; n++) WEEK_MONDAY.set(`${ORDINALS[n]} Week after Pentecost`, 49 + 7 * (n - 1) + 1);

const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

const lecStart = lines.findIndex(l => l.trim() === 'LECTIONARY');
const lecEnd = lines.findIndex((l, i) => i > lecStart && l.trim() === 'GLOSSARY');
if (lecStart < 0 || lecEnd < 0) throw new Error('lectionary section not found');
const lec = lines.slice(lecStart + 1, lecEnd).map(l => l.trim());

// The ebook hyphenates ordinals with an en dash ("Twenty–First"), so headings
// are matched against a dash-normalised copy. Readings keep their own dashes,
// because "12:13–17" and "2:21—3:9" mean different things.
const flat = s => s.replace(/–/g, '-').replace(/\s+/g, ' ').trim();
const tidy = s => s.replace(/\s+/g, ' ').trim();

const movable = [];   // { offset, title, readings }
const fixed = [];     // { month, day, title, readings }
const around = [];    // days hung off Nativity or Theophany rather than a date
// The OSB closes the lectionary with commemorations a parish may or may not
// keep (Holy Monks, Hieromartyrs, and so on) wrapped in explanatory prose. They
// are nobody's personal reading plan, so they are parsed only to keep the
// scanner in step, and thrown away.
const feasts = [];

let week = null;      // { name, monday }
let pending = null;   // the label we are collecting readings for
let bucket = [];

function flush() {
  if (!pending) { bucket = []; return; }
  const readings = bucket.join(' ').replace(/\s+/g, ' ').trim();
  if (readings) pending.readings = readings;
  bucket = [];
  if (!pending.readings) { pending = null; return; }
  if (pending.kind === 'movable') movable.push({ offset: pending.offset, title: pending.title, readings: pending.readings });
  else if (pending.kind === 'fixed') fixed.push({ month: pending.month, day: pending.day, title: pending.title, readings: pending.readings });
  else if (pending.kind === 'around') around.push({ anchor: pending.anchor, side: pending.side, weekday: pending.weekday, nth: pending.nth, title: pending.title, readings: pending.readings });
  else feasts.push({ title: pending.title, readings: pending.readings });
  pending = null;
}

// A line is a heading if it names a week, a weekday, a Sunday, a feast with a
// date, or one of the all-caps section banners. Anything else is readings.
for (const raw of lec) {
  const text = tidy(raw);
  const line = flat(text);
  if (!line) continue;

  if (WEEK_MONDAY.has(line)) { flush(); week = { name: line, monday: WEEK_MONDAY.get(line) }; continue; }
  if (/^[A-Z][A-Z '\-&]+$/.test(line) && line.length > 3) {  // TRIODION, GREAT LENT, HOLY WEEK...
    flush();
    if (line === 'PASCHA') pending = { kind: 'movable', offset: 0, title: 'Pascha, the Resurrection of Christ', skipOne: true };
    continue;
  }

  // Holy Week and Bright Week name their days ("Holy Tuesday", "Bright Friday")
  let m = line.match(/^(Holy|Bright) (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/);
  if (m) {
    flush();
    const i = WEEKDAY.indexOf(m[2]);
    const base = m[1] === 'Holy' ? -6 : 1;
    pending = { kind: 'movable', offset: base + i, title: line };
    continue;
  }

  // Plain weekdays inside a week block
  m = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)(?:: (.+))?$/);
  if (m && week) {
    flush();
    const i = WEEKDAY.indexOf(m[1]);
    pending = { kind: 'movable', offset: week.monday + i, title: m[2] ? `${m[1]}: ${m[2]}` : m[1] };
    continue;
  }

  // Pentecost closes the seventh week of Pascha
  if (/^PENTECOST/i.test(line)) {
    flush();
    pending = { kind: 'movable', offset: 49, title: 'Pentecost, the Descent of the Holy Spirit', skipOne: true };
    continue;
  }
  if (pending && pending.skipOne) { pending.skipOne = false; continue; }

  // The Nativity and Theophany cycles hang their Saturdays and Sundays off the
  // feast rather than off a date of their own.
  m = line.match(/^(Saturday|Sunday) (before|after) (?:the )?(Nativity|Theophany)/);
  if (m) {
    flush();
    pending = { kind: 'around', anchor: m[3].toLowerCase(), side: m[2], weekday: m[1].toLowerCase(), nth: 1, title: line };
    continue;
  }
  m = line.match(/^Sunday of the Holy Ancestors of Christ/);
  if (m) {
    flush();
    pending = { kind: 'around', anchor: 'nativity', side: 'before', weekday: 'sunday', nth: 2, title: line };
    continue;
  }

  // The Sunday that closes the current week
  if (/Sunday/.test(line) && !/^\d/.test(line) && line.length < 160 && !/\d+:\d+/.test(line)) {
    const dated = line.match(/\(([A-Z][a-z]+) (\d+)(?:\/[^)]*)?\)\s*$/);
    if (dated && MONTHS.includes(dated[1])) { flush(); pending = { kind: 'fixed', month: MONTHS.indexOf(dated[1]) + 1, day: +dated[2], title: line }; continue; }
    if (week) { flush(); pending = { kind: 'movable', offset: week.monday + 6, title: line }; week = null; continue; }
    flush(); pending = { kind: 'feast', title: line }; continue;
  }

  // A fixed feast: a title carrying a calendar date
  m = line.match(/\(([A-Z][a-z]+) ?(\d+)(?:\s*\/[^)]*)?\)\s*$/);
  if (m && MONTHS.includes(m[1])) {
    flush();
    pending = { kind: 'fixed', month: MONTHS.indexOf(m[1]) + 1, day: +m[2], title: line };
    continue;
  }

  // A titled commemoration with no date and no weekday
  if (!/\d+:\d+/.test(line) && !/^\(/.test(line) && line.length < 90 && /^[A-Z]/.test(line)
      && !/^(VESPERS|LITURGY|BLESSING)/.test(line) && !pending) {
    flush();
    pending = { kind: 'feast', title: line };
    continue;
  }

  if (pending) bucket.push(text);
}
flush();

/* ---- write ---- */

const banner = n => `/* ${n}

   Generated by tools/extract-bible-data.mjs from a text export of The
   Orthodox Study Bible. Do not edit by hand; edit the tool and re-run it.

   This file holds no scripture. It is structure and references only. */\n\n`;

fs.writeFileSync(path.join(OUT, 'canon.js'),
  banner('The books of the Bible as the Orthodox Study Bible prints them.') +
  '// id, display name, the familiar Hebrew-canon name where it differs, which\n' +
  '// part of the story it belongs to, whether it sits outside the Protestant\n' +
  '// canon, and the number of verses in each of its chapters.\n' +
  'export const BOOKS = [\n' +
  canon.map(b => `  { id: '${b.id}', name: ${JSON.stringify(b.name)}, also: ${b.also ? JSON.stringify(b.also) : 'null'}, ` +
    `section: '${b.section}', deutero: ${b.deutero}, chapters: [${b.chapters.join(',')}] },`).join('\n') +
  '\n];\n');

fs.writeFileSync(path.join(OUT, 'lectionary.js'),
  banner('The Orthodox Study Bible lectionary, as a table of references.') +
  '// The OSB prints this "strictly as a rough guide for personal reading". It is\n' +
  '// not a liturgical lectionary, jurisdictions differ, and fixed feasts collide\n' +
  '// with the paschal cycle in ways no table can resolve. The app says so.\n\n' +
  '// Offset in days from Pascha. Pascha itself is 0.\n' +
  'export const MOVABLE = [\n' +
  movable.map(r => `  [${r.offset}, ${JSON.stringify(r.title)}, ${JSON.stringify(r.readings)}],`).join('\n') +
  '\n];\n\n' +
  '// Feasts fixed to a calendar date. Dates are New Calendar (Gregorian).\n' +
  'export const FIXED = [\n' +
  fixed.map(r => `  [${r.month}, ${r.day}, ${JSON.stringify(r.title)}, ${JSON.stringify(r.readings)}],`).join('\n') +
  '\n];\n\n' +
  '// The Nativity and Theophany cycles: [anchor, side, weekday, nth, title, readings].\n' +
  '// nth counts back or forward that many of that weekday from the feast.\n' +
  'export const AROUND = [\n' +
  around.map(r => `  ['${r.anchor}', '${r.side}', '${r.weekday}', ${r.nth}, ${JSON.stringify(r.title)}, ${JSON.stringify(r.readings)}],`).join('\n') +
  '\n];\n\n' +
  '');

console.log(`canon:      ${canon.length} books, ${totalCh} chapters, ${totalV} verses`);
console.log(`lectionary: ${movable.length} movable days, ${fixed.length} fixed feasts, ${around.length} around Nativity/Theophany`);
const off = movable.map(m => m.offset).sort((a, b) => a - b);
console.log(`            offsets ${off[0]} .. ${off[off.length - 1]}`);
const dupes = off.filter((v, i) => off[i - 1] === v);
if (dupes.length) console.log(`            duplicate offsets: ${[...new Set(dupes)].join(', ')}`);
