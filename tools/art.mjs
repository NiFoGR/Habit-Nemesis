// Turns the artwork in art/ into the assets the app ships.
//
//   node tools/art.mjs        (npm run art)
//
// Drop a file in art/ named after the asset it becomes: rank-6-topg.png,
// cup-winter.png, feat-streak30.png. It is downscaled to the size that asset
// appears at, written to www/img/, added to the service worker's precache list
// and the cache version is bumped.
//
// PNG in, PNG out, with only node:zlib: the repo has no image dependency and is
// not getting one. A .webp is passed through untouched, because nothing here
// can encode one and every export tool can. WebP is about a quarter the size,
// so it is worth asking for.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const SRC = root + 'art/';
const OUT = root + 'www/img/';
const SW = root + 'www/sw.js';
const MANIFEST = root + 'www/js/artwork.js';

/* ---------------- what each family is for ---------------- */

// Ranks and cups are heroes as well as badges; a feat medal never exceeds 44px.
// A share banner is not square and is drawn to cover, so it goes through as
// sent: 1080x1350 is what the card wants and the budget says the rest.
const FAMILIES = [
  { match: /^rank-/, size: 256, budget: 60000 },
  { match: /^cup-/, size: 256, budget: 60000 },
  { match: /^mark-/, size: 512, budget: 90000 },
  { match: /^feat-/, size: 128, budget: 20000 },
  { match: /^share-/, pass: true, budget: 300000 },
];

const familyOf = (name) => FAMILIES.find((f) => f.match.test(name));
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

/* ---------------- PNG ---------------- */

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA8 out of a PNG. Only what a design tool exports: 8-bit truecolour with
 *  or without alpha, no interlacing, no palette. Anything else says so. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let colour = 0;
  const idat = [];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`${data[8]}-bit PNG: export 8-bit`);
      colour = data[9];
      if (colour !== 6 && colour !== 2) throw new Error('export RGB or RGBA, not palette or greyscale');
      if (data[12] !== 0) throw new Error('interlaced PNG: export without Adam7');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    i += len + 12;
  }

  const channels = colour === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4);

  // Undo the per-line filters. Each line names its own, and every one of them
  // refers back to the line above, so this has to run in order.
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 0xff;
      else if (filter === 2) line[x] = (line[x] + b) & 0xff;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { width, height, rgba: out };
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- resize ---------------- */

/** Box filter, premultiplied. Averaging straight RGBA drags the colour of fully
 *  transparent pixels into the edge, which is the halo you get around cut-out
 *  artwork downscaled naively. */
function resize(src, sw, sh, size) {
  const out = Buffer.alloc(size * size * 4);
  const xs = sw / size;
  const ys = sh / size;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * ys);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ys));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * xs);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xs));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 4;
          const al = src[i + 3] / 255;
          r += src[i] * al;
          g += src[i + 1] * al;
          b += src[i + 2] * al;
          a += src[i + 3];
          n++;
        }
      }
      const d = (y * size + x) * 4;
      const alpha = a / n;
      const un = alpha > 0 ? 255 / alpha : 0;
      out[d] = Math.min(255, Math.round((r / n) * un));
      out[d + 1] = Math.min(255, Math.round((g / n) * un));
      out[d + 2] = Math.min(255, Math.round((b / n) * un));
      out[d + 3] = Math.round(alpha);
    }
  }
  return out;
}

/* ---------------- run ---------------- */

if (!existsSync(SRC)) {
  console.log(`Nothing to do: ${SRC} does not exist.\nDrop artwork in there named after the asset, e.g. rank-6-topg.png.`);
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => /\.(png|webp)$/i.test(f));
if (!files.length) {
  console.log('art/ holds no .png or .webp files.');
  process.exit(0);
}

const written = [];
const problems = [];

for (const file of files.sort()) {
  const name = file.replace(/\.(png|webp)$/i, '');
  const family = familyOf(name);
  if (!family) {
    problems.push(`${file}: name it rank-*, cup-*, mark-*, feat-* or share-*. See docs/ART.md.`);
    continue;
  }
  const src = readFileSync(SRC + file);

  if (family.pass || /\.webp$/i.test(file)) {
    const ext = /\.webp$/i.test(file) ? 'webp' : 'png';
    writeFileSync(`${OUT}${name}.${ext}`, src);
    written.push({ name: `${name}.${ext}`, bytes: src.length, note: 'passed through' });
    if (src.length > family.budget) {
      problems.push(`${name}.${ext} is ${kb(src.length)}, over the ${kb(family.budget)} budget. Send it as WebP.`);
    }
    continue;
  }

  try {
    const { width, height, rgba } = decodePng(src);
    if (width !== height) problems.push(`${file} is ${width}x${height}: it should be square, and it has been squashed.`);
    const out = encodePng(family.size, resize(rgba, width, height, family.size));
    writeFileSync(`${OUT}${name}.png`, out);
    written.push({ name: `${name}.png`, bytes: out.length, note: `${width}px to ${family.size}px` });
    if (out.length > family.budget) {
      problems.push(`${name}.png is ${kb(out.length)}, over the ${kb(family.budget)} budget. Export it as .webp instead and it will be about a quarter of that.`);
    }
  } catch (e) {
    problems.push(`${file}: ${e.message}`);
  }
}

/* The app asks for an asset by name, not by filename: a badge sent as a PNG and
   later replaced by a WebP must not need a code change. The map is generated
   rather than looked up at runtime, so it costs no request. */
function writeManifest() {
  const all = readdirSync(OUT).filter((f) => /\.(png|webp)$/i.test(f)).sort();
  const pairs = all.map((f) => `  '${f.replace(/\.(png|webp)$/i, '')}': '${f}',`).join('\n');
  writeFileSync(MANIFEST, `// Generated by tools/art.mjs. Do not edit: run \`npm run art\`.\n` +
    `// Asset name to the file that holds it, so the extension is the tool's problem.\n\n` +
    `export const ARTWORK = {\n${pairs}\n};\n\n` +
    `export const artSrc = (name) => (ARTWORK[name] ? \`./img/\${ARTWORK[name]}\` : '');\n`);
}

/* The service worker precaches by name, so a new asset has to be listed and the
   cache version has to move or nobody who already has the app will see it. */
if (written.length) {
  writeManifest();
  let sw = readFileSync(SW, 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/img\/([^']+)'/g)].map((m) => m[1]));
  const fresh = written.map((w) => w.name).filter((n) => !listed.has(n));
  if (fresh.length) {
    const anchor = "  // Crests. Precached: one arriving late leaves a hole where the screen is.\n";
    const block = fresh.map((n) => `  './img/${n}',\n`).join('');
    sw = sw.includes(anchor) ? sw.replace(anchor, anchor + block) : sw.replace("  './img/", block + "  './img/");
    const version = Number(sw.match(/nifo-v(\d+)/)[1]) + 1;
    sw = sw.replace(/nifo-v\d+/, `nifo-v${version}`);
    writeFileSync(SW, sw);
    console.log(`sw.js: ${fresh.length} added, cache bumped to nifo-v${version}`);
  }
}

console.log(`\n${written.length} written to www/img/`);
for (const w of written) console.log(`  ${w.name.padEnd(26)} ${kb(w.bytes).padStart(8)}  ${w.note}`);
if (problems.length) {
  console.log(`\n${problems.length} to look at:`);
  for (const p of problems) console.log(`  ${p}`);
}
