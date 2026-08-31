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
  tick: 12, press: 18, hit: [0, 30, 60, 30], done: 22, miss: [0, 40, 40, 40], level: [0, 40, 60, 40, 60, 80],
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
// silently, so the first tap after opening is mute. Resume on the first touch.
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
  c: 261.63, d: 293.66, e: 329.63, g: 392.0,
  C: 523.25, E: 659.25, G: 783.99, A: 880.0, C2: 1046.5,
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
  complete: { notes: [[N.c, 0, 0.14, { peak: 0.11 }], [N.e, 0.08, 0.14, { peak: 0.11 }], [N.G, 0.16, 0.4, { peak: 0.12 }]] },
  // the Arena
  phase: { notes: [[N.G, 0, 0.12, { peak: 0.09 }]] },
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

export const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/* ---------------- small components ---------------- */

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
  toast('Could not save that here. Open the app in a browser and save from there.');
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
