// Small shared helpers: feedback, formatting and dependency-free SVG charts.

const PATTERNS = {
  tick: 12, press: 18, hit: [0, 30, 60, 30], go: 25, rest: 10, done: 22, miss: [0, 40, 40, 40], phase: [0, 20, 40, 20], level: [0, 40, 60, 40, 60, 80],
};

export function haptic(kind) {
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

/** Per-rep bars — the fatigue curve for a single session. */
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
export function ringSvg(fraction, label, sub, { size = 168, color = 'var(--accent)' } = {}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(fraction, 1)));
  return `<div class="ringwrap" style="--size:${size}px">
    <svg viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="${r}" class="rw-track"/>
      <circle cx="80" cy="80" r="${r}" class="rw-fill" stroke="${color}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>
    <div class="ringwrap-core"><b>${label}</b><span>${sub}</span></div>
  </div>`;
}
