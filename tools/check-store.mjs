// The listing assets, checked against what Play actually accepts.
//
// `store/` is the one directory whose contents are never exercised by running
// the app, so a wrong size sits there until an upload is refused. The numbers
// below are Play's, not ours: an icon Play will not take is worth a red mark
// here rather than a rejected listing.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';

const DIR = 'store/';
const MB = 1024 * 1024;

let failed = 0;
const ok = (msg) => console.log(`ok  ${msg}`);
const bad = (msg) => { failed++; console.log(`FAIL ${msg}`); };

/** width, height, bit depth and colour type, straight off IHDR. */
function head(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], colour: b[25], bytes: b.length };
}

if (!existsSync(DIR)) {
  console.log(`FAIL ${DIR} does not exist`);
  process.exit(1);
}

/* ---------------- the icon ---------------- */
{
  const f = `${DIR}icon-512.png`;
  const i = existsSync(f) && head(f);
  if (!i) bad('icon-512.png is missing or not a PNG');
  else if (i.w !== 512 || i.h !== 512) bad(`icon-512.png is ${i.w}x${i.h}, Play wants 512x512`);
  else if (i.bytes > MB) bad(`icon-512.png is ${(i.bytes / MB).toFixed(1)}MB, Play caps the icon at 1MB`);
  // 32-bit means RGBA. Play still refuses a transparent one, which gen-icons
  // handles by squaring the corners, so only the channel is checked here.
  else if (i.colour !== 6) bad(`icon-512.png is colour type ${i.colour}, Play wants 32-bit PNG`);
  else ok(`the icon is 512x512, 32-bit, ${(i.bytes / 1024).toFixed(0)}KB`);
}

/* ---------------- the feature graphic ---------------- */
{
  const f = `${DIR}feature.png`;
  const i = existsSync(f) && head(f);
  if (!i) bad('feature.png is missing or not a PNG. Play will not publish without it');
  else if (i.w !== 1024 || i.h !== 500) bad(`feature.png is ${i.w}x${i.h}, Play wants 1024x500`);
  else if (i.colour === 6) bad('feature.png carries an alpha channel. Play refuses one');
  else ok(`the feature graphic is 1024x500, no alpha, ${(i.bytes / 1024).toFixed(0)}KB`);
}

/* ---------------- the screenshots ---------------- */
{
  const shots = readdirSync(DIR).filter((n) => /^\d\d-.*\.png$/.test(n)).sort();
  if (shots.length < 2) bad(`${shots.length} screenshots. Play wants at least 2`);
  else if (shots.length > 8) bad(`${shots.length} screenshots. Play takes at most 8`);
  else {
    let bent = 0;
    for (const n of shots) {
      const i = head(DIR + n);
      if (!i) { bad(`${n} is not a PNG`); bent++; continue; }
      // 320 to 3840 a side, and 16:9 or 9:16. Ours are 9:16 exactly.
      const side = Math.min(i.w, i.h) >= 320 && Math.max(i.w, i.h) <= 3840;
      const ratio = Math.abs(i.w / i.h - 9 / 16) < 0.001 || Math.abs(i.w / i.h - 16 / 9) < 0.001;
      if (!side) { bad(`${n} is ${i.w}x${i.h}, each side has to be 320 to 3840`); bent++; }
      else if (!ratio) { bad(`${n} is ${i.w}x${i.h}, which is neither 16:9 nor 9:16`); bent++; }
      else if (i.colour === 6) { bad(`${n} carries an alpha channel`); bent++; }
      else if (i.bytes > 8 * MB) { bad(`${n} is over Play's 8MB a screenshot`); bent++; }
    }
    if (!bent) ok(`${shots.length} screenshots, all 9:16 and no alpha`);
  }
}

/* ---------------- the words ---------------- */
// The listing copy lives in the doc, so the doc is what gets measured.
{
  const doc = readFileSync('docs/STORE.md', 'utf8');
  const short = /\n    (Your only opponent[^\n]*)\n/.exec(doc);
  if (!short) bad('docs/STORE.md no longer holds the short description');
  else if (short[1].length > 80) bad(`the short description is ${short[1].length} characters, Play caps it at 80`);
  else ok(`the short description is ${short[1].length} of 80 characters`);

  const full = /```\n(Your only opponent[\s\S]*?)```/.exec(doc);
  if (!full) bad('docs/STORE.md no longer holds the full description');
  else if (full[1].length > 4000) bad(`the full description is ${full[1].length} characters, Play caps it at 4000`);
  else ok(`the full description is ${full[1].trim().length} of 4000 characters`);
}

if (failed) {
  console.log(`\n${failed} listing asset(s) Play would refuse.`);
  process.exit(1);
}
