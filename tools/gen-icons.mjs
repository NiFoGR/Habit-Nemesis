// PWA and launcher icons as PNGs, no dependencies.
//   node tools/gen-icons.mjs [--android]
//
// The mark's geometry comes from www/js/icons.js rather than being drawn again
// here. The launcher icon and the mark on screen have to be the same drawing,
// and the surest way to keep them the same is to have only one of them.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { MARK } from '../www/js/icons.js';
import { decodePng, encodePng, resize } from './png.mjs';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
// Antialiasing coverage: 1 inside, 0 outside, ramped over ~1px.
const band = (d, edge, soft = 1.2) => clamp01((edge - d) / soft + 0.5);

/** Signed distance from (x, y) to the mark's outline, in its own 100 x 100 box.
 *  Negative inside. Nearest edge for the magnitude, winding for the sign, so a
 *  notch reads as outside rather than as a second inside. */
function sdMark(px, py) {
  let best = Infinity;
  let sign = 1;
  // Every contour feeds one loop. The crossing count flips the sign per ring,
  // which is even-odd, so the two slits come out as holes.
  for (const ring of MARK) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const ex = xj - xi;
      const ey = yj - yi;
      const wx = px - xi;
      const wy = py - yi;
      const t = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey));
      const bx = wx - ex * t;
      const by = wy - ey * t;
      best = Math.min(best, bx * bx + by * by);
      const c1 = py >= yi;
      const c2 = py < yj;
      const c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sign = -sign;
    }
  }
  return sign * Math.sqrt(best);
}

const BG = [10, 12, 16]; // --bg
const INK = [230, 36, 41]; // --mark

/* ---- the mark as a file ---- */

/** `art/source/mark.png`, squared off, or null when there is no file.
 *  Under source/ because that is the half of art/ the art pipeline ignores, and
 *  the app mark is not one of its families.
 *
 *  A design tool exports an app icon the way the stores show it: rounded
 *  corners, and white or transparent around them. Both stores round the corners
 *  themselves, so shipping that gets you an icon rounded twice with a pale halo
 *  in the gap. This trims the padding back to the artwork and floods whatever
 *  was outside the rounding with the tile's own corner colour, which squares it
 *  off without touching the drawing inside. */
function markFile() {
  const path = new URL('../art/source/mark.png', import.meta.url);
  if (!existsSync(path)) return null;
  const { width, height, rgba } = decodePng(readFileSync(path));

  // Padding is whatever the outermost pixel is: white on a white export,
  // transparent on a cut-out one.
  const pad = [rgba[0], rgba[1], rgba[2], rgba[3]];
  const isPad = (i) =>
    rgba[i + 3] < 8 || (Math.abs(rgba[i] - pad[0]) < 12 && Math.abs(rgba[i + 1] - pad[1]) < 12 && Math.abs(rgba[i + 2] - pad[2]) < 12 && pad[3] > 8);

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isPad((y * width + x) * 4)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < left || bottom < top) throw new Error('art/mark.png is one flat colour.');

  // The tile's own corner colour, taken just inside the crop where the rounding
  // has already given way to the background.
  const w = right - left + 1;
  const h = bottom - top + 1;
  const probe = ((top + Math.round(h * 0.5)) * width + left + 2) * 4;
  const fill = [rgba[probe], rgba[probe + 1], rgba[probe + 2]];

  const cropped = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((top + y) * width + left + x) * 4;
      const d = (y * w + x) * 4;
      if (isPad(s)) {
        cropped[d] = fill[0];
        cropped[d + 1] = fill[1];
        cropped[d + 2] = fill[2];
      } else {
        cropped[d] = rgba[s];
        cropped[d + 1] = rgba[s + 1];
        cropped[d + 2] = rgba[s + 2];
      }
      cropped[d + 3] = 255;
    }
  }
  return { rgba: cropped, width: w, height: h, fill };
}

const FILE = markFile();

/** The mark, red on near-black. `play` is the store listing's icon: square to
 *  the edge, because Play rounds the corners itself and a rounded PNG comes out
 *  rounded twice. */
function drawIcon(size, opts) {
  return FILE ? fromFile(size, opts) : fromPolygon(size, opts);
}

/** The artwork, scaled to the frame. Cropped variants get it inset over the
 *  tile's own colour, so the launcher's crop takes background and not drawing. */
function fromFile(size, { maskable, foreground = false, play = false }) {
  const inset = foreground ? 0.62 : maskable ? 0.78 : 1;
  const span = Math.round(size * inset);
  const art = resize(FILE.rgba, FILE.width, FILE.height, span);
  const px = Buffer.alloc(size * size * 4);
  const off = Math.round((size - span) / 2);
  const c = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const ax = x - off;
      const ay = y - off;
      const inside = ax >= 0 && ay >= 0 && ax < span && ay < span;
      const s = (ay * span + ax) * 4;
      px[i] = inside ? art[s] : FILE.fill[0];
      px[i + 1] = inside ? art[s + 1] : FILE.fill[1];
      px[i + 2] = inside ? art[s + 2] : FILE.fill[2];
      px[i + 3] = 255;

      if (foreground) px[i + 3] = inside ? art[s + 3] : 0;
      else if (!maskable && !play) {
        // Rounded for the PWA. Maskable and the store icon stay square: the
        // launcher and Play each crop to their own shape.
        const tileRad = size * 0.22;
        const qx = Math.max(Math.abs(x + 0.5 - c) - (size / 2 - tileRad), 0);
        const qy = Math.max(Math.abs(y + 0.5 - c) - (size / 2 - tileRad), 0);
        px[i + 3] = Math.round(255 * band(Math.hypot(qx, qy), tileRad));
      }
    }
  }
  return encodePng(size, px);
}

/** The stand-in, drawn from MARK, used until art/mark.png exists. */
function fromPolygon(size, { maskable, foreground = false, play = false }) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // Maskable and adaptive foregrounds are cropped, so the mark shrinks into the
  // safe zone. Everything else gets the roomier draw.
  const scale = foreground ? 0.42 : maskable ? 0.56 : 0.68;
  // Glyph units per pixel, and the top-left of the glyph box in pixels.
  const span = size * scale;
  const origin = c - span / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;

      let [r, g, b] = BG;
      let a = foreground ? 0 : 255;

      if (!maskable && !play) {
        // Maskable and the store icon stay full-bleed opaque: the launcher and
        // Play each crop to their own shape.
        const tileRad = size * 0.22;
        const qx = Math.max(Math.abs(dx) - (size / 2 - tileRad), 0);
        const qy = Math.max(Math.abs(dy) - (size / 2 - tileRad), 0);
        a = Math.round(255 * band(Math.hypot(qx, qy), tileRad));
      }

      // Into glyph space, where the mark is 100 units wide.
      const gx = ((x + 0.5 - origin) / span) * 100;
      const gy = ((y + 0.5 - origin) / span) * 100;
      // The distance is in glyph units, so the ~1px feather is too.
      const cov = band(sdMark(gx, gy), 0, (100 / span) * 1.2);

      if (cov > 0) {
        r = lerp(r, INK[0], cov);
        g = lerp(g, INK[1], cov);
        b = lerp(b, INK[2], cov);
        if (foreground) a = Math.max(a, Math.round(255 * cov));
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
// iOS composites onto white and rounds the corners itself, so it takes the
// maskable draw: a transparent corner would turn white and be rounded twice.
out('apple-touch-icon.png', drawIcon(180, { maskable: true }));

// The store listing's icon. Not in www/: nothing ships in the app that only a
// store needs. Square to the edge, opaque, because Play rounds it itself.
mkdirSync(new URL('../store/', import.meta.url), { recursive: true });
const storeIcon = drawIcon(512, { maskable: false, play: true });
writeFileSync(new URL('../store/icon-512.png', import.meta.url), storeIcon);
console.log(`wrote store/icon-512.png (${storeIcon.length} bytes)`);

if (process.argv.includes('--android')) {
  const RES = new URL('../android/app/src/main/res/', import.meta.url);
  // Adaptive foregrounds are cropped hard, so the art sits in the inner ~55%.
  const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, size] of Object.entries(DENSITIES)) {
    const dir = new URL(`mipmap-${d}/`, RES);
    mkdirSync(dir, { recursive: true });
    const legacy = drawIcon(size, { maskable: false });
    writeFileSync(new URL('ic_launcher.png', dir), legacy);
    writeFileSync(new URL('ic_launcher_round.png', dir), legacy);
    // Foregrounds are 108dp for a 48dp icon: 2.25x.
    writeFileSync(new URL('ic_launcher_foreground.png', dir), drawIcon(Math.round(size * 2.25), { maskable: true, foreground: true }));
  }
  // Splash too, or the app flashes Capacitor's white default.
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
