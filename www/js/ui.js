// Small shared helpers: feedback, formatting, saving a file, and
// dependency-free SVG charts.

import { isNative } from './native.js';

/* ---------------- whether the app is allowed to make a noise ----------------
   Two switches, held here rather than read here. This module is imported *by*
   the store and cannot import it back, so the store pushes the pair in through
   `setFeedback` on every save. Before that each caller checked for itself,
   which meant the session players honoured the setting and the grid, the
   Arena and every toast did not. */

let feedback = { haptics: true, sound: true };

/** Called by store.js. Never call it from a screen. */
export function setFeedback(s) {
  feedback = { haptics: s?.haptics !== false, sound: s?.sound !== false };
}

const PATTERNS = {
  tick: 12, press: 18, hit: [0, 30, 60, 30], go: 25, rest: 10, done: 22, miss: [0, 40, 40, 40], phase: [0, 20, 40, 20], level: [0, 40, 60, 40, 60, 80],
  // The Arena. A win is two beats and a promotion is three rising ones, so
  // the phone tells you which happened before you have read anything.
  win: [0, 35, 50, 90], loss: [0, 120], promote: [0, 40, 50, 40, 50, 120], relegate: [0, 160, 80, 160],
  feat: [0, 25, 40, 25, 40, 60], trophy: [0, 60, 60, 60, 60, 60, 60, 200],
};

export function haptic(kind) {
  if (!feedback.haptics) return;
  const p = PATTERNS[kind];
  if (p && navigator.vibrate) {
    try {
      navigator.vibrate(p);
    } catch {
      /* some browsers refuse without a gesture; not worth surfacing */
    }
  }
}

let audioCtx = null;
export function beep(freq = 880, ms = 60) {
  if (!feedback.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000 + 0.02);
  } catch {
    /* audio is a nicety, never a requirement */
  }
}

/* ---------------- the Arena's own sound and light ----------------
   The app had one beep and one buzz, which is right for a session player where
   a cue must not become a performance. A result is different: a week you won
   should land, and landing is what a short rise in pitch and a handful of
   sparks are for.

   Whether either is allowed is decided once, at the top of this file. */

const NOTES = { c: 261.63, e: 329.63, g: 392.0, a: 440.0, b: 493.88, C: 523.25, E: 659.25, G: 783.99, C2: 1046.5 };

/** One note in an envelope that opens fast and closes slowly, so a motif reads
 *  as music rather than as a row of clicks. */
function tone(ctx, freq, at, dur, peak = 0.14, type = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + at);
  osc.stop(ctx.currentTime + at + dur + 0.02);
}

/** Motifs, not sound effects. Each one is the shape of what happened: up for
 *  a win, down for a loss, a full triad for a promotion, and a run for a feat. */
const MOTIFS = {
  win: [[NOTES.g, 0, 0.16], [NOTES.C, 0.09, 0.3]],
  loss: [[NOTES.e, 0, 0.18], [NOTES.c, 0.1, 0.34]],
  promote: [[NOTES.c, 0, 0.2], [NOTES.e, 0.08, 0.2], [NOTES.G, 0.16, 0.42]],
  relegate: [[NOTES.G, 0, 0.2], [NOTES.e, 0.09, 0.2], [NOTES.c, 0.18, 0.46]],
  feat: [[NOTES.C, 0, 0.14], [NOTES.E, 0.06, 0.14], [NOTES.G, 0.12, 0.14], [NOTES.C2, 0.18, 0.4]],
  trophy: [[NOTES.c, 0, 0.18], [NOTES.g, 0.1, 0.18], [NOTES.C, 0.2, 0.18], [NOTES.E, 0.3, 0.18], [NOTES.G, 0.4, 0.7]],
  tick: [[NOTES.a, 0, 0.06]],
};

export function chime(kind) {
  const motif = MOTIFS[kind];
  if (!motif || !feedback.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    // A context created before the first gesture starts suspended, and a
    // suspended context swallows the whole motif silently.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (const [freq, at, dur] of motif) tone(audioCtx, freq, at, dur);
  } catch {
    /* audio is a nicety, never a requirement */
  }
}

/** A short burst of sparks from the middle of an element.
 *
 *  No library and no canvas: a dozen absolutely positioned dots that animate
 *  out on the compositor and delete themselves. It costs nothing, it cannot
 *  leak - the wrapper removes itself on the longest animation's end - and it
 *  does nothing at all when the reader has asked for less motion. */
export function celebrate(el, { colour = 'var(--accent)', count = 14, spread = 90 } = {}) {
  if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div');
  wrap.className = 'sparks';
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = spread * (0.55 + Math.random() * 0.65);
    const s = document.createElement('i');
    s.style.cssText = `--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px;` +
      `--d:${(0.5 + Math.random() * 0.45).toFixed(2)}s;--w:${(3 + Math.random() * 4).toFixed(1)}px;background:${colour}`;
    wrap.appendChild(s);
  }
  el.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1200);
}

export function fmtMs(ms) {
  if (!ms) return '0s';
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

export const pct = (v) => `${Math.round(v * 100)}%`;

export function fmtDuration(sec) {
  if (!sec) return '0s';
  return sec < 90 ? `${Math.round(sec)}s` : `${Math.round(sec / 60)} min`;
}

/** mm:ss, or h:mm:ss once it runs past an hour. */
export function fmtClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export function fmtHours(ms) {
  const h = ms / 3600000;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.round(ms / 60000)}m`;
}

/* ---------------- notifications ---------------- */

export async function askNotifyPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Fires through the service worker when possible, so the notification still
 *  appears when the app is in the background. */
export async function notify(title, body) {
  haptic('hit');
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', vibrate: [200, 100, 200], tag: 'nifo-timer', renotify: true };
    if (reg?.showNotification) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- small components ---------------- */

/** Segmented control. Returns markup; wire it up with `onSegment`. */
export function segmented(name, options, active) {
  return `<div class="segmented" data-seg="${escapeHtml(name)}">${options
    .map((o) => `<button type="button" data-val="${escapeHtml(o.id)}" class="${o.id === active ? 'on' : ''}">${escapeHtml(o.label)}</button>`)
    .join('')}</div>`;
}

export function onSegment(root, name, fn) {
  const el = root.querySelector(`[data-seg="${name}"]`);
  if (!el) return;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-val]');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    fn(b.dataset.val);
  });
}

/** Tiny inline trend line for a headline number. No axes, no labels, it is
 *  there to show shape at a glance, not to be read off. */
export function sparkline(values, { color = 'var(--accent)', w = 120, h = 34, fill = true } = {}) {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return '';
  // Nothing ever happened, so draw nothing. A per-day series is zero-filled
  // rather than empty, so without this a section you have never touched gets a
  // confident straight line across its tile — which reads as steady activity
  // and is the exact opposite of the truth. Sections whose series is genuinely
  // empty already render no line, so this also stops two tiles from carrying a
  // graph while the other two do not.
  if (vals.every((v) => v === 0)) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const flat = max - min < 1e-9;
  const span = flat ? 1 : max - min;
  const x = (i) => (i * w) / (vals.length - 1);
  // A flat series sits on the mid-line rather than pinned to the floor, which
  // would read as "zero" instead of "unchanged".
  const y = (v) => (flat ? h / 2 : h - 3 - ((v - min) / span) * (h - 6));
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = fill
    ? `<polygon points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity="0.13"/>`
    : '';
  const last = vals[vals.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    ${area}<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${w}" cy="${y(last).toFixed(1)}" r="2.5" fill="${color}"/>
  </svg>`;
}

/** Donut for a small set of parts, weekly volume by session type. */
export function donut(parts, { size = 104, thickness = 13, centre = '' } = {}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = total
    ? parts
        .filter((p) => p.value > 0)
        .map((p) => {
          const len = (p.value / total) * c;
          const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
            stroke="${p.colour}" stroke-width="${thickness}"
            stroke-dasharray="${Math.max(0, len - 2).toFixed(1)} ${(c - len + 2).toFixed(1)}"
            stroke-dashoffset="${(-offset).toFixed(1)}"/>`;
          offset += len;
          return seg;
        })
        .join('')
    : '';
  return `<div class="ringwrap" style="--size:${size}px">
    <svg viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${thickness}"/>
      ${arcs}
    </svg>
    ${centre ? `<div class="ringwrap-core"><b>${escapeHtml(centre)}</b></div>` : ''}
  </div>`;
}

/** Vertical bars with labels, used for volume by day.
 *  `colour` exists for the one caller that is not drawing in the app accent:
 *  a habit's own screen, where every other mark takes the colour you chose for
 *  it and a teal chart in the middle read as a piece of another screen. */
export function barChart(bars, { h = 120, unit = '', colour = null } = {}) {
  if (!bars.length) return '<div class="chart-empty">Nothing logged in this period</div>';
  const max = Math.max(...bars.map((b) => b.value), 1);
  return `<div class="barchart" style="--h:${h}px${colour ? `;--bar:${colour}` : ''}">${bars
    .map((b) => {
      const pctH = Math.max(b.value > 0 ? 3 : 0, (b.value / max) * 100);
      const stack = b.parts
        ? b.parts
            .filter((p) => p.value > 0)
            .map((p) => `<i style="height:${(p.value / b.value) * 100}%;background:${p.colour}" title="${escapeHtml(p.label)}"></i>`)
            .join('')
        : '<i style="height:100%"></i>';
      return `<div class="bar" title="${escapeHtml(b.label)}: ${escapeHtml(b.text || String(b.value) + unit)}">
        <div class="bar-stack" style="height:${pctH}%">${stack}</div>
        <span>${escapeHtml(b.short || b.label)}</span>
      </div>`;
    })
    .join('')}</div>`;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function relDay(key) {
  const today = new Date();
  const [y, m, d] = key.split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return fmtDate(key);
}

let toastTimer = null;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- charts ---------------- */

/** Line chart with an area fill. Values are plain numbers; gaps are not drawn. */
export function lineChart(values, { w = 320, h = 110, pad = 10, color = 'var(--accent)', fill = true, labels = null } = {}) {
  if (!values.length) return '<div class="chart-empty">Not enough data yet</div>';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = fill ? `<path d="M${x(0)},${h - pad} L${pts.join(' L')} L${x(values.length - 1)},${h - pad} Z" fill="url(#lg)" opacity="0.35"/>` : '';
  const dots = values.length <= 30 ? values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5" fill="${color}"/>`).join('') : '';
  const lab = labels
    ? `<text x="${pad}" y="${h - 1}" class="ct">${escapeHtml(labels[0])}</text><text x="${w - pad}" y="${h - 1}" text-anchor="end" class="ct">${escapeHtml(labels[1])}</text>`
    : '';
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${area}<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${lab}
  </svg>`;
}

/** Two or more series on shared axes, plotted against real timestamps so
 *  irregular check-ins are not stretched into an even rhythm. */
export function multiLine(series, { w = 320, h = 150, padL = 34, padR = 8, padT = 10, padB = 22 } = {}) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return '<div class="chart-empty">Two check-ins fill this in</div>';
  const t0 = Math.min(...all.map((p) => p.ts));
  const t1 = Math.max(...all.map((p) => p.ts));
  const span = Math.max(t1 - t0, 864e5);
  let min = Math.min(...all.map((p) => p.value));
  let max = Math.max(...all.map((p) => p.value));
  const pad = Math.max((max - min) * 0.2, 0.3);
  min -= pad;
  max += pad;

  const x = (ts) => padL + ((ts - t0) / span) * (w - padL - padR);
  const y = (v) => h - padB - ((v - min) / (max - min)) * (h - padT - padB);

  const grid = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15]
    .map((v) => `<text x="2" y="${(y(v) + 3).toFixed(1)}" class="ct">${v.toFixed(1)}</text>
                 <line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${w - padR}" y2="${y(v).toFixed(1)}" class="grid"/>`)
    .join('');

  const lines = series
    .map((s) => {
      const pts = s.points.map((p) => `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      const dots = s.points.map((p) => `<circle cx="${x(p.ts).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.5" fill="${s.colour}"/>`).join('');
      return `<polyline points="${pts}" fill="none" stroke="${s.colour}" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="4 4"' : ''}/>${dots}`;
    })
    .join('');

  return `<svg class="chart tall" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
    ${grid}${lines}
    <text x="${padL}" y="${h - 5}" class="ct">${new Date(t0).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</text>
    <text x="${w - padR}" y="${h - 5}" text-anchor="end" class="ct">${new Date(t1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</text>
  </svg>`;
}

/** Scatter with an optional least-squares trend line. Used for "did the hours
 *  actually buy anything", the one chart that can talk you out of a habit. */
export function scatter(points, { w = 320, h = 160, xLabel = '', yLabel = '', color = 'var(--accent)', trend = true } = {}) {
  if (points.length < 2) return '<div class="chart-empty">Three check-ins fill this in</div>';
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 26;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs, 0);
  const x1 = Math.max(...xs) * 1.08 || 1;
  let y0 = Math.min(...ys, 0);
  let y1 = Math.max(...ys, 0);
  if (y1 - y0 < 1e-6) y1 = y0 + 1;
  const padY = (y1 - y0) * 0.15;
  y0 -= padY;
  y1 += padY;

  const X = (v) => padL + ((v - x0) / (x1 - x0 || 1)) * (w - padL - padR);
  const Y = (v) => h - padB - ((v - y0) / (y1 - y0)) * (h - padT - padB);

  const zero = y0 <= 0 && y1 >= 0 ? `<line x1="${padL}" y1="${Y(0).toFixed(1)}" x2="${w - padR}" y2="${Y(0).toFixed(1)}" class="grid zero"/>` : '';
  const ticks = [y0 + (y1 - y0) * 0.2, y1 - (y1 - y0) * 0.2]
    .map((v) => `<text x="2" y="${(Y(v) + 3).toFixed(1)}" class="ct">${v.toFixed(1)}</text>`)
    .join('');

  let line = '';
  if (trend && points.length >= 3) {
    const n = points.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
    if (sxx > 0) {
      const slope = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
      const b = my - slope * mx;
      line = `<line x1="${X(x0).toFixed(1)}" y1="${Y(b + slope * x0).toFixed(1)}"
        x2="${X(x1).toFixed(1)}" y2="${Y(b + slope * x1).toFixed(1)}"
        stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.6"/>`;
    }
  }

  const dots = points
    .map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="${color}" opacity="0.85">
      <title>${escapeHtml(p.label || `${p.x.toFixed(0)} → ${p.y.toFixed(2)}`)}</title></circle>`)
    .join('');

  // Axis captions sit at the far end of the axis they name, y at the top of
  // the vertical, x at the right of the horizontal, so neither is mistaken
  // for the other, which is exactly what happens with both in the same corner.
  return `<svg class="chart tall" viewBox="0 0 ${w} ${h}" role="img">
    ${ticks}${zero}${line}${dots}
    <text x="2" y="${padT}" class="ct">${escapeHtml(yLabel)}</text>
    <text x="${w - padR}" y="${h - 4}" text-anchor="end" class="ct">${escapeHtml(xLabel)}</text>
  </svg>`;
}

/** Per-rep bars, the fatigue curve for a single session. */
export function repBars(reps, { h = 54 } = {}) {
  if (!reps.length) return '';
  return `<div class="repbars" style="--h:${h}px">${reps
    .map((r) => {
      const ratio = Math.min(r.actualMs / r.targetMs, 1.3);
      const cls = r.actualMs < 250 ? 'miss' : ratio >= 0.98 ? 'good' : ratio >= 0.75 ? 'ok' : 'low';
      const title = `${r.kind} · ${(r.actualMs / 1000).toFixed(1)}s of ${(r.targetMs / 1000).toFixed(0)}s`;
      return `<i class="${cls}" style="height:${Math.max(4, ratio * h).toFixed(0)}px" title="${escapeHtml(title)}"></i>`;
    })
    .join('')}</div>`;
}

/** Progress ring used on the report and the hub. */
export function ringSvg(fraction, label, sub, { size = 168, color = null } = {}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(fraction, 1)));
  // Unless a specific colour is asked for, the ring uses the logo's teal-to-
  // violet sweep, which is where the app gets its identity from.
  const gid = `rg${Math.random().toString(36).slice(2, 8)}`;
  const stroke = color || `url(#${gid})`;
  return `<div class="ringwrap" style="--size:${size}px">
    <svg viewBox="0 0 160 160">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#22d3c5"/><stop offset="100%" stop-color="#a78bfa"/>
      </linearGradient></defs>
      <circle cx="80" cy="80" r="${r}" class="rw-track"/>
      <circle cx="80" cy="80" r="${r}" class="rw-fill" stroke="${stroke}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>
    <div class="ringwrap-core"><b>${label}</b><span>${sub}</span></div>
  </div>`;
}

/* ---------------- handing a file to the user ----------------
   `<a download>` is the whole story on a desktop and none of it on a phone.
   The APK's WebView has no download handler at all, so the anchor click
   returned, the toast said "downloaded", and nothing had happened anywhere -
   which is what "I clicked export and I cannot find it" was. iOS in standalone
   mode is nearly as bad: it opens the blob in a viewer you cannot save from.

   So there are three routes, tried in the order that a phone can actually
   use, and the toast names the one that ran rather than guessing.
     1. The share sheet, if the platform can share a real file. This is the
        good answer on iOS and in a mobile browser: Files, Drive, a message.
     2. A download, in a browser only. Skipped in the APK precisely because it
        is the route that fails silently there.
     3. The clipboard, which works everywhere and cannot fail quietly.

   Returns what happened, so a caller that wants to say more can. */
export async function saveFile(name, text, mime = 'application/json') {
  // `text` is a string for the exports and a Blob for a gallery photo.
  const file = (() => {
    try {
      return new File([text], name, { type: mime });
    } catch {
      return null;
    }
  })();

  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      toast('Saved');
      return 'shared';
    } catch (e) {
      // Dismissing the share sheet is an answer, not a failure to fall through.
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }

  if (!isNative()) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Saved to your downloads as ${name}`);
    return 'downloaded';
  }

  // Text only: a photo on the clipboard as the string "[object Blob]" is worse
  // than an honest refusal.
  if (typeof text === 'string') {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to the clipboard. Paste it somewhere that keeps it.');
      return 'copied';
    } catch {
      /* falls through to the same message */
    }
  }
  toast('Could not save that here. Open NiFo in a browser and save from there.');
  return 'failed';
}

/* ---------------- the sheet ----------------
   A modal, which the app went five features without needing. Habits needs
   three: the frequency picker, the value keypad and the type chooser, all of
   which are questions asked in the middle of a screen you must not lose your
   place on.

   It mounts as the first child of `#app` rather than on `<body>`, which is the
   whole trick: `back.js` answers a back gesture by clicking the first
   `#app [data-back]` in document order, and a bare `data-back` means "this
   screen handles back itself". So a sheet in that position takes the hardware
   button, the browser's back and the scrim tap through one path, and the
   underlying screen's corner arrow is left alone underneath it. */

export function openSheet(html, { onClose } = {}) {
  const app = document.getElementById('app');
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.setAttribute('data-back', '');
  scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  app.insertBefore(scrim, app.firstChild);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    scrim.remove();
    onClose?.();
  };
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  // Only a tap on the scrim itself, and only a click whose target is the scrim
  // — which is also what back.js's synthetic click produces.
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) close();
  });
  document.addEventListener('keydown', onKey);

  const el = scrim.firstElementChild;
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el, close };
}
