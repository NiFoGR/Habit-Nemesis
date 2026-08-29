// Shared helpers: feedback, formatting, file saving, dependency-free SVG charts.

import { isNative } from './native.js';

let feedback = { haptics: true, sound: true };

/* ---------------- feedback switches ---------------- */
// Held here, not read here: store.js imports this module and cannot be imported
// back, so it pushes the pair in on every save.

/** Called by store.js only. */
export function setFeedback(s) {
  feedback = { haptics: s?.haptics !== false, sound: s?.sound !== false };
}

const PATTERNS = {
  tick: 12, press: 18, hit: [0, 30, 60, 30], go: 25, rest: 10, done: 22, miss: [0, 40, 40, 40], phase: [0, 20, 40, 20], level: [0, 40, 60, 40, 60, 80],
  // Arena: two beats for a win, three rising for a promotion.
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
      /* no gesture yet */
    }
  }
}

/* ---------------- sound ---------------- */
// One context and one chain: every voice goes through a master gain into a
// compressor. Two cues landing together is common (a day closing out is a mark
// and a win), and without the compressor that pair clips.

let ctx = null;
let master = null;

function audio() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 22;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master = ctx.createGain();
  // Everyday cues land around -15 dBFS and the ceremonies around -7, which is
  // audible on a phone speaker without being the loudest thing in the room.
  master.gain.value = 1.7;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

// A context made before the first gesture starts suspended and swallows the cue
// silently, so the first tap of a session is mute. Resume on the first touch.
const wake = () => {
  if (ctx && ctx.state === 'suspended') ctx.resume();
};
for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
  document.addEventListener(ev, wake, { capture: true, passive: true });
}

/** One voice. `at` is seconds from now. The filter opens with the note and
 *  closes over its release, which is what stops a sine reading as a test tone. */
function voice(freq, at, dur, { peak = 0.12, type = 'sine', glide = 0, bright = 4 } = {}) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * glide), t0 + dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(18000, freq * bright), t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.15), t0 + dur);
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter).connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** A filtered noise burst: the transient that makes a cue feel struck rather
 *  than played. Only the big moments get one. */
function strike(at, dur = 0.14, { peak = 0.16, tone = 1400 } = {}) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = tone;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = peak;
  src.connect(filter).connect(gain).connect(master);
  src.start(ctx.currentTime + at);
}

const N = {
  c2: 130.81, g2: 196.0, a2: 220.0,
  c: 261.63, d: 293.66, e: 329.63, f: 349.23, g: 392.0, a: 440.0, b: 493.88,
  C: 523.25, D: 587.33, E: 659.25, G: 783.99, A: 880.0, C2: 1046.5, E2: 1318.5,
};

/* One key throughout, so two cues overlapping are still music. Each entry is
   notes of [freq, at, dur, opts], plus an optional strike. Peaks are graded:
   a cell mark is a whisper, a cup is the loudest thing the app does. */
const CUES = {
  // the grid
  tick: { notes: [[N.A, 0, 0.05, { peak: 0.04, bright: 3 }]] },
  mark: { notes: [[N.E, 0, 0.07, { peak: 0.07 }], [N.A, 0.045, 0.14, { peak: 0.08 }]] },
  unmark: { notes: [[N.A, 0, 0.06, { peak: 0.05 }], [N.E, 0.04, 0.12, { peak: 0.05 }]] },
  skip: { notes: [[N.d, 0, 0.1, { peak: 0.05, type: 'triangle', bright: 2 }]] },
  // sessions
  go: { notes: [[N.c, 0, 0.12, { peak: 0.1 }], [N.g, 0.07, 0.22, { peak: 0.1 }]] },
  phase: { notes: [[N.G, 0, 0.12, { peak: 0.09 }]] },
  rest: { notes: [[N.e, 0, 0.18, { peak: 0.07, bright: 2.5 }]] },
  complete: { notes: [[N.c, 0, 0.14, { peak: 0.11 }], [N.e, 0.08, 0.14, { peak: 0.11 }], [N.G, 0.16, 0.4, { peak: 0.12 }]] },
  // the Arena
  win: { notes: [[N.g, 0, 0.16, { peak: 0.13 }], [N.C, 0.09, 0.34, { peak: 0.14 }]] },
  loss: { notes: [[N.e, 0, 0.2, { peak: 0.1, bright: 2.5 }], [N.c, 0.1, 0.4, { peak: 0.1, bright: 2 }]] },
  feat: { notes: [[N.C, 0, 0.12, { peak: 0.1 }], [N.E, 0.06, 0.12, { peak: 0.11 }], [N.G, 0.12, 0.12, { peak: 0.12 }], [N.C2, 0.18, 0.42, { peak: 0.13 }]] },
  // Promotion is struck: a transient, a triad, and one note left ringing above
  // it. Relegation is the same shape with no strike and a longer fall, because
  // a punishing noise is how you get someone to stop opening the app.
  promote: {
    strike: [0, 0.16, { peak: 0.18, tone: 1800 }],
    notes: [[N.c, 0.02, 0.24, { peak: 0.13 }], [N.e, 0.1, 0.24, { peak: 0.13 }], [N.G, 0.18, 0.3, { peak: 0.14 }], [N.C2, 0.3, 0.7, { peak: 0.12, bright: 6 }]],
  },
  relegate: {
    notes: [[N.G, 0, 0.3, { peak: 0.1, bright: 3 }], [N.e, 0.12, 0.34, { peak: 0.1, bright: 2.5 }], [N.c, 0.26, 0.8, { peak: 0.11, bright: 2, glide: 0.94 }]],
  },
  trophy: {
    strike: [0, 0.2, { peak: 0.2, tone: 2200 }],
    notes: [[N.c, 0.02, 0.2, { peak: 0.13 }], [N.g, 0.12, 0.2, { peak: 0.13 }], [N.C, 0.22, 0.2, { peak: 0.14 }], [N.E, 0.32, 0.2, { peak: 0.14 }], [N.G, 0.42, 0.9, { peak: 0.15 }], [N.C2, 0.42, 0.9, { peak: 0.08, bright: 6 }]],
  },
  // Not a scold. Low, short, and over.
  refuse: { notes: [[N.a2, 0, 0.12, { peak: 0.08, type: 'triangle', bright: 2 }]] },
};

/** Play a cue by name. Unknown names are silent rather than an error, so a
 *  screen naming a cue that does not exist yet is not a crash. */
export function chime(kind) {
  const cue = CUES[kind];
  if (!cue || !feedback.sound) return;
  try {
    if (!audio()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (cue.strike) strike(cue.strike[0], cue.strike[1], cue.strike[2]);
    for (const [freq, at, dur, opts] of cue.notes) voice(freq, at, dur, opts);
  } catch {
    /* audio is optional */
  }
}

/** Sparks from the centre of an element. Self-removing, and off under reduced motion. */
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

/** mm:ss, or h:mm:ss past an hour. */
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

/** Through the service worker where possible, so it shows in the background. */
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

/** Segmented control. Markup only, wire it with `onSegment`. */
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

/** Inline trend line for a headline number. Shape at a glance, not read off. */
export function sparkline(values, { color = 'var(--accent)', w = 120, h = 34, fill = true } = {}) {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return '';
  // All zeroes draws nothing: a flat line across an untouched tile reads as steady activity.
  if (vals.every((v) => v === 0)) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const flat = max - min < 1e-9;
  const span = flat ? 1 : max - min;
  const x = (i) => (i * w) / (vals.length - 1);
  // Flat sits mid-height, not on the floor: that would read as zero.
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

/** Vertical bars. `colour` is for a habit's own screen, which is not in the accent. */
export function barChart(bars, { h = 120, unit = '', colour = null } = {}) {
  if (!bars.length) return '<div class="chart-empty">Nothing logged in this period</div>';
  const max = Math.max(...bars.map((b) => b.value), 1);
  // Past about eight columns the labels collide, so thin them from the right.
  const every = Math.max(1, Math.ceil(bars.length / 8));
  return `<div class="barchart" style="--h:${h}px${colour ? `;--bar:${colour}` : ''}">${bars
    .map((b, i) => {
      const pctH = Math.max(b.value > 0 ? 3 : 0, (b.value / max) * 100);
      const stack = b.parts
        ? b.parts
            .filter((p) => p.value > 0)
            .map((p) => `<i style="height:${(p.value / b.value) * 100}%;background:${p.colour}" title="${escapeHtml(p.label)}"></i>`)
            .join('')
        : '<i style="height:100%"></i>';
      return `<div class="bar" title="${escapeHtml(b.label)}: ${escapeHtml(b.text || String(b.value) + unit)}">
        <div class="bar-stack" style="height:${pctH}%">${stack}</div>
        <span>${(bars.length - 1 - i) % every === 0 ? escapeHtml(b.short || b.label) : ''}</span>
      </div>`;
    })
    .join('')}</div>`;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

/** Line chart with area fill. Gaps are not drawn. */
export function lineChart(values, { w = 320, h = 110, pad = 10, color = 'var(--accent)', fill = true, labels = null } = {}) {
  if (!values.length) return '<div class="chart-empty">Not enough data yet</div>';
  // All zeros is a line on the floor pretending to be a chart.
  if (!values.some((v) => v)) return '<div class="chart-empty">Nothing recorded yet</div>';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const flat = max === min;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
  // Flat sits mid-height, not on the floor: that would read as zero.
  const y = (v) => (flat ? h / 2 : h - pad - ((v - min) / span) * (h - pad * 2));
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

/** Shared axes, plotted against real timestamps so irregular check-ins stay irregular. */
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

/** Scatter with a least-squares trend. */
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

  // Captions at the far end of the axis they name, never both in one corner.
  return `<svg class="chart tall" viewBox="0 0 ${w} ${h}" role="img">
    ${ticks}${zero}${line}${dots}
    <text x="2" y="${padT}" class="ct">${escapeHtml(yLabel)}</text>
    <text x="${w - padR}" y="${h - 4}" text-anchor="end" class="ct">${escapeHtml(xLabel)}</text>
  </svg>`;
}

/** Per-rep bars: the fatigue curve for one session. */
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

/** Progress ring. */
export function ringSvg(fraction, label, sub, { size = 168, color = null } = {}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(fraction, 1)));
  // Default is the logo's teal-to-violet sweep.
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
   Three routes, in the order a phone can use: share sheet, then download
   (browser only, it fails silently in the APK), then clipboard. Returns which
   one ran, so the toast can name it. */

export async function saveFile(name, text, mime = 'application/json') {
  // String for exports, Blob for a gallery photo.
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
      // Dismissing the sheet is an answer, not a reason to fall through.
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

  // Text only: "[object Blob]" on the clipboard is worse than refusing.
  if (typeof text === 'string') {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to the clipboard. Paste it somewhere that keeps it.');
      return 'copied';
    } catch {
      /* same message */
    }
  }
  toast('Could not save that here. Open NiFo in a browser and save from there.');
  return 'failed';
}

/* ---------------- the sheet ----------------
   Mounts as the first child of #app, not on <body>: back.js clicks the first
   #app [data-back] in document order, so the sheet takes the back gesture and
   the screen's own arrow underneath is left alone. */

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
  // The scrim itself only, which is also what back.js's synthetic click hits.
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) close();
  });
  document.addEventListener('keydown', onKey);

  const el = scrim.firstElementChild;
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el, close };
}
