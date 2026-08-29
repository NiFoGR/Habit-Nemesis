// The week, as a picture worth sending to someone.
//
// Drawn on a canvas at 1080x1350 (the tallest size every app takes without
// cropping), previewed in a sheet, then handed to the share sheet or saved.
// Nothing leaves the device unless you send it yourself.
//
// The background is generated: gradient, glow, the week's own seven columns
// and a little grain. Drop share-<division>.webp or share-banner.webp into
// art/ and it is used instead. See docs/ART.md.

import * as store from '../store.js';
import * as arena from './program.js';
import { crestSrc } from './crest.js';
import { artSrc } from '../artwork.js';
import { openSheet, saveFile, toast, haptic, chime } from '../ui.js';

const W = 1080;
const H = 1350;

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/* ---------------- paint ---------------- */

/** The stylesheet's own tokens, so the card cannot drift from the app. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const t = (n, fallback) => css.getPropertyValue(n).trim() || fallback;
  return {
    bg: t('--bg', '#0a0c10'),
    text: t('--text', '#e6eaf0'),
    muted: t('--muted', '#97a1b0'),
    faint: t('--faint', '#6b7686'),
    accent: t('--accent', '#22d3c5'),
    violet: t('--violet', '#a78bfa'),
    good: t('--good', '#4ade80'),
    danger: t('--danger', '#f87171'),
    surface: t('--surface', '#141821'),
  };
}

/** #rrggbb to rgba. Canvas has no colour-mix. */
function fade(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function loadImage(src) {
  return new Promise((done) => {
    if (!src) return done(null);
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

/** Cover, not stretch. */
function drawCover(ctx, img, alpha) {
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

/** Grain, drawn once as a tile. A flat gradient at this size looks printed. */
function grain(ctx) {
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tc = tile.getContext('2d');
  const px = tc.createImageData(size, size);
  for (let i = 0; i < px.data.length; i += 4) {
    const v = Math.random() * 255;
    px.data[i] = px.data[i + 1] = px.data[i + 2] = v;
    px.data[i + 3] = 12;
  }
  tc.putImageData(px, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
}

function background(ctx, p, rung, banner) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);

  if (banner) {
    drawCover(ctx, banner, 0.55);
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, fade(p.bg, 0.55));
    veil.addColorStop(0.5, fade(p.bg, 0.8));
    veil.addColorStop(1, fade(p.bg, 0.97));
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
  } else {
    // The glow climbs with the rung: Top G is lit, Bottom G is nearly dark.
    const lift = 0.06 + rung * 0.028;
    const glow = ctx.createRadialGradient(W / 2, 470, 0, W / 2, 470, 760);
    glow.addColorStop(0, fade(p.accent, lift));
    glow.addColorStop(1, fade(p.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const low = ctx.createRadialGradient(W, H, 0, W, H, 900);
    low.addColorStop(0, fade(p.violet, 0.09));
    low.addColorStop(1, fade(p.violet, 0));
    ctx.fillStyle = low;
    ctx.fillRect(0, 0, W, H);
  }

  // Seven hairlines: the week is behind everything on the card.
  ctx.strokeStyle = fade(p.text, 0.045);
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    const x = Math.round((W / 7) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78);
  edge.addColorStop(0, fade(p.bg, 0));
  edge.addColorStop(1, fade(p.bg, 0.65));
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);

  grain(ctx);
}

/* ---------------- type ---------------- */

const FACE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

function text(ctx, str, x, y, { size = 32, weight = 400, colour = '#fff', align = 'center', spacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${FACE}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.letterSpacing = '0px';
}

function pill(ctx, str, cx, y, { colour, size = 26, padX = 22, h = 52 }) {
  ctx.font = `700 ${size}px ${FACE}`;
  ctx.letterSpacing = '3px';
  const w = ctx.measureText(str).width + padX * 2 + 3;
  ctx.letterSpacing = '0px';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = fade(colour, 0.14);
  ctx.fill();
  ctx.strokeStyle = fade(colour, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, str, cx, y + h / 2 + size / 3, { size, weight: 700, colour, spacing: 3 });
  return w;
}

/* ---------------- the card ---------------- */

/** "10-16 August", or both months when the week straddles them. weekLabel is
 *  written for a fixture list and reads wrong under a card. */
function dates(key) {
  const a = new Date(`${arena.weekStart(key)}T12:00`);
  const b = new Date(`${arena.weekEnd(key)}T12:00`);
  const month = (d, style) => d.toLocaleDateString(undefined, { month: style });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}-${b.getDate()} ${month(b, 'long')}`
    : `${a.getDate()} ${month(a, 'short')} - ${b.getDate()} ${month(b, 'short')}`;
}

function facts(key) {
  const stored = store.get().arena.weeks[key];
  const live = arena.scoreWeek(key);
  const div = arena.divisionOf(store.get().arena.division);
  return {
    key,
    live: key === arena.currentWeek(),
    score: stored ? stored.score : live.score,
    done: stored ? stored.done : live.done,
    due: stored ? stored.due : live.due,
    result: stored?.result === 'won' || stored?.result === 'lost' ? stored.result : '',
    oppName: stored?.oppName || '',
    oppScore: stored?.oppScore ?? null,
    shape: arena.weekShape(key),
    rows: live.rows.slice().sort((a, b) => b.done / b.due - a.done / a.due).slice(0, 3),
    best: arena.isBestWeek(key),
    division: div,
    rung: arena.divisionIndex(div.id),
    unranked: !arena.hasRecord(),
  };
}

async function render(key) {
  const f = facts(key);
  const p = palette();
  const [crest, banner] = await Promise.all([
    loadImage(crestSrc(f.unranked ? -1 : f.rung)),
    loadImage(artSrc(`share-${f.division.id}`) || artSrc('share-banner')),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  background(ctx, p, f.rung, banner);

  const state = f.result === 'won' ? p.good : f.result === 'lost' ? p.danger : p.accent;

  // Header.
  text(ctx, 'NIFO', 72, 100, { size: 30, weight: 700, colour: p.text, align: 'left', spacing: 8 });
  text(ctx, f.key.replace('-W', ' · WEEK '), W - 72, 100, { size: 30, weight: 600, colour: p.faint, align: 'right', spacing: 4 });

  // Crest and division.
  if (crest) ctx.drawImage(crest, W / 2 - 100, 150, 200, 200);
  text(ctx, f.division.name.toUpperCase(), W / 2, 408, { size: 34, weight: 700, colour: p.muted, spacing: 10 });

  // The score, and nothing near it.
  text(ctx, pct(f.score), W / 2, 640, { size: 250, weight: 700, colour: p.text });
  text(ctx, `${f.done} of ${f.due} cells`, W / 2, 700, { size: 34, weight: 400, colour: p.muted });

  // The week's shape: one column a day, lit by how much of it you did.
  const top = Math.max(1, ...f.shape.map((d) => d.done));
  const colW = 96;
  const gap = 22;
  const left = (W - (colW * 7 + gap * 6)) / 2;
  const base = 920;
  f.shape.forEach((d, i) => {
    const frac = d.done / top;
    const x = left + i * (colW + gap);
    const h = Math.max(10, Math.round(frac * 180));
    ctx.beginPath();
    ctx.roundRect(x, base - h, colW, h, 14);
    // The best day at full strength, the rest in a narrow band: the heights are
    // honest, so the colour is what makes the peak findable.
    ctx.fillStyle = d.future || !d.done ? fade(p.text, 0.07) : fade(p.accent, frac === 1 ? 1 : 0.3 + frac * 0.25);
    ctx.fill();
    text(ctx, 'MTWTFSS'[i], x + colW / 2, base + 44, { size: 26, weight: 600, colour: p.faint, spacing: 2 });
  });

  // The verdict.
  ctx.beginPath();
  ctx.moveTo(72, 1024);
  ctx.lineTo(W - 72, 1024);
  ctx.strokeStyle = fade(p.text, 0.1);
  ctx.lineWidth = 2;
  ctx.stroke();

  const word = f.best ? 'BEST WEEK YET' : f.result === 'won' ? 'WEEK WON' : f.result === 'lost' ? 'WEEK LOST' : f.live ? 'IN PLAY' : 'ON THE RECORD';
  pill(ctx, word, W / 2, 1056, { colour: f.best ? p.violet : state });
  if (f.oppName && f.oppScore != null) {
    text(ctx, `against ${f.oppName} · ${pct(f.oppScore)}`, W / 2, 1160, { size: 30, weight: 400, colour: p.muted });
  }

  // Three rows, best first. Any more and the card is a spreadsheet again.
  let x = W / 2 - f.rows.reduce((a, r) => a + rowWidth(ctx, r) + 16, -16) / 2;
  for (const r of f.rows) {
    const w = rowWidth(ctx, r);
    ctx.beginPath();
    ctx.roundRect(x, 1200, w, 56, 28);
    ctx.fillStyle = fade(p.text, 0.06);
    ctx.fill();
    text(ctx, `${r.name} ${r.done}/${r.due}`, x + w / 2, 1237, { size: 26, weight: 600, colour: p.muted });
    x += w + 16;
  }

  text(ctx, dates(f.key), W / 2, 1312, { size: 28, weight: 400, colour: p.faint, spacing: 1 });

  return canvas;
}

function rowWidth(ctx, r) {
  ctx.font = `600 26px ${FACE}`;
  return Math.round(ctx.measureText(`${r.name} ${r.done}/${r.due}`).width) + 44;
}

/* ---------------- the sheet ---------------- */

const fileName = (key) => `nifo-${key.toLowerCase().replace('-w', '-week-')}.png`;

/** Preview first: a share sheet that opens on an image nobody has seen is a
 *  gamble, and this one is the point. */
export async function shareWeek(key) {
  haptic('press');
  const canvas = await render(key);
  const blob = await new Promise((done) => canvas.toBlob(done, 'image/png'));
  if (!blob) return toast('Could not make the picture here.');
  const url = URL.createObjectURL(blob);

  openSheet(`
    <h2>Your week</h2>
    <img class="sh-card" src="${url}" alt="Your week as a card">
    <button class="btn primary wide" id="shGo">Save or share</button>
    <button class="btn wide" data-close>Close</button>`,
  { onClose: () => URL.revokeObjectURL(url) });

  document.getElementById('shGo')?.addEventListener('click', async () => {
    haptic('press');
    const how = await saveFile(fileName(key), blob, 'image/png');
    if (how === 'shared' || how === 'downloaded') chime('feat');
  });
}
