// Generates the PWA / launcher icons as PNGs with zero dependencies.
// Draws the NiFo mark: a glowing progress ring on a dark rounded field.
// Run: node tools/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

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

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
// Smooth coverage for antialiasing: 1 inside, 0 outside, ramped over ~1px.
const band = (d, edge, soft = 1.2) => clamp01((edge - d) / soft + 0.5);

function drawIcon(size, { maskable, foreground = false }) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // Maskable icons get cropped by the launcher, so the artwork shrinks into the
  // safe zone; adaptive foreground layers are cropped hardest of all.
  const scale = foreground ? 0.44 : maskable ? 0.62 : 0.78;
  const rOuter = (size / 2) * scale;
  const ringW = rOuter * 0.26;
  const rMid = rOuter - ringW / 2;
  const dot = rOuter * 0.2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const dist = Math.hypot(dx, dy);

      // Background: deep slate, slightly lit from the top-left.
      const grad = clamp01((x + y) / (size * 2));
      let r = lerp(18, 9, grad);
      let g = lerp(26, 14, grad);
      let b = lerp(38, 22, grad);
      let a = foreground ? 0 : 255;

      if (!maskable) {
        // Rounded-square field for the plain icon. Maskable stays full-bleed
        // opaque, since Android crops it to its own shape.
        const rad = size * 0.22;
        const qx = Math.max(Math.abs(dx) - (size / 2 - rad), 0);
        const qy = Math.max(Math.abs(dy) - (size / 2 - rad), 0);
        a = Math.round(255 * band(Math.hypot(qx, qy), rad));
      }

      // The ring: teal at the top sweeping to violet, with a gap at the bottom
      // like a progress arc that is nearly closed.
      const ringCov = band(Math.abs(dist - rMid), ringW / 2);
      const ang = Math.atan2(dy, dx); // -PI..PI, -PI/2 is up
      let t = (ang + Math.PI / 2) / (Math.PI * 2);
      if (t < 0) t += 1;
      const gapStart = 0.9;
      const gapCov = t > gapStart ? clamp01((t - gapStart) * 26) : 0;
      const cov = ringCov * (1 - gapCov);
      if (cov > 0) {
        const rr = lerp(34, 167, t);
        const gg = lerp(211, 139, t);
        const bb = lerp(198, 250, t);
        r = lerp(r, rr, cov);
        g = lerp(g, gg, cov);
        b = lerp(b, bb, cov);
        if (foreground) a = Math.max(a, Math.round(255 * cov));
      }

      // Centre dot: the "held" contraction.
      const dotCov = band(dist, dot);
      if (dotCov > 0) {
        r = lerp(r, 240, dotCov);
        g = lerp(g, 253, dotCov);
        b = lerp(b, 250, dotCov);
        if (foreground) a = Math.max(a, Math.round(255 * dotCov));
      }

      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = a;
    }
  }
  return encodePng(size, px);
}

mkdirSync(new URL('../www/icons/', import.meta.url), { recursive: true });
const out = (name, buf) => {
  writeFileSync(new URL(`../www/icons/${name}`, import.meta.url), buf);
  console.log(`wrote icons/${name} (${buf.length} bytes)`);
};

out('icon-192.png', drawIcon(192, { maskable: false }));
out('icon-512.png', drawIcon(512, { maskable: false }));
out('icon-maskable-512.png', drawIcon(512, { maskable: true }));

// --android also stamps the launcher icons into the generated native project,
// which Capacitor otherwise ships with its own default logo.
if (process.argv.includes('--android')) {
  const RES = new URL('../android/app/src/main/res/', import.meta.url);
  // Adaptive-icon foregrounds are cropped hard, so the art sits in the inner
  // ~55% and the background comes from the colour resource below.
  const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, size] of Object.entries(DENSITIES)) {
    const dir = new URL(`mipmap-${d}/`, RES);
    mkdirSync(dir, { recursive: true });
    const legacy = drawIcon(size, { maskable: false });
    writeFileSync(new URL('ic_launcher.png', dir), legacy);
    writeFileSync(new URL('ic_launcher_round.png', dir), legacy);
    // Foreground layers are drawn at 108dp for a 48dp icon: 2.25x the density.
    writeFileSync(new URL('ic_launcher_foreground.png', dir), drawIcon(Math.round(size * 2.25), { maskable: true, foreground: true }));
  }
  // Splash images too, otherwise the app flashes Capacitor's white default
  // before the dark UI paints.
  const splash = drawIcon(768, { maskable: true });
  const splashDirs = ['drawable', 'drawable-v24'];
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) splashDirs.push(`drawable-port-${d}`, `drawable-land-${d}`);
  for (const d of splashDirs) {
    const dir = new URL(`${d}/`, RES);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('splash.png', dir), splash);
  }

  mkdirSync(new URL('values/', RES), { recursive: true });
  writeFileSync(
    new URL('values/ic_launcher_background.xml', RES),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0F14</color>\n</resources>\n'
  );
  console.log('stamped Android launcher icons');
}
