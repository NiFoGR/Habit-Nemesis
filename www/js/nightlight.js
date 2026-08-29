// Night light: colour temperature on a schedule.
//
// APK: a foreground service in native/nightlight/ owns the schedule and the
// filter. This file only writes config and reads status back.
// Browser: the same settings drive a full-screen overlay over NiFo's pages.
//
// So the maths below is the browser's, and the preview's fallback. On the APK
// the preview asks the plugin for its samples instead.

import * as store from './store.js';
import { nifoUnlocked } from './nifo.js';
import { escapeHtml, segmented, onSegment, toast } from './ui.js';
import { icon } from './icons.js';

const plugin = () => window.Capacitor?.Plugins?.NightLight;
export const isNative = () => !!window.Capacitor?.isNativePlatform?.() && !!plugin();

export const MIN_KELVIN = 1900;
export const MAX_KELVIN = 6500;

/* ---------------- config ---------------- */

export const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

export const fromMin = (min) => {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

function cfg(over = {}) {
  const n = store.get().nightlight;
  return {
    enabled: n.enabled,
    curve: n.curve,
    wakeMin: toMin(n.wakeAt),
    sleepMin: toMin(n.sleepAt),
    dayKelvin: n.dayKelvin,
    nightKelvin: n.nightKelvin,
    transitionMin: n.transitionMin,
    intensity: n.intensity,
    ...over,
  };
}

/* ---------------- the maths, mirrored ---------------- */
// Identical to Curve.java on purpose. Change one, change both.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampK = (k) => clamp(Math.round(k), MIN_KELVIN, MAX_KELVIN);
const mod = (v, m) => ((v % m) + m) % m;

/** Mireds, not kelvin: kelvin is perceptually lopsided. See Curve.java. */
export function lerpKelvin(from, to, f) {
  const a = 1e6 / clampK(from);
  const b = 1e6 / clampK(to);
  return clampK(1e6 / (a + (b - a) * clamp(f, 0, 1)));
}

export function kelvinAt(c, minuteOfDay) {
  let dayLen = mod(c.sleepMin - c.wakeMin, 1440);
  if (dayLen === 0) dayLen = 1440;
  const since = mod(minuteOfDay - c.wakeMin, 1440);
  if (since >= dayLen) return c.nightKelvin;

  const warmUp = Math.min(c.transitionMin, dayLen);
  if (since < warmUp) return lerpKelvin(c.nightKelvin, c.dayKelvin, since / warmUp);

  const t = (since - warmUp) / Math.max(1, dayLen - warmUp);
  if (c.curve === 'flux') {
    const startsAt = 1 - Math.min(1, c.transitionMin / Math.max(1, dayLen - warmUp));
    if (t < startsAt) return c.dayKelvin;
    return lerpKelvin(c.dayKelvin, c.nightKelvin, (t - startsAt) / Math.max(1e-6, 1 - startsAt));
  }
  return lerpKelvin(c.dayKelvin, c.nightKelvin, Math.pow(t, 1.6));
}

export function kelvinToRgb(kelvin) {
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}

/** Per-channel multipliers, normalised so daylight is exactly 1,1,1. */
export function multipliers(kelvin, dayKelvin, intensity = 1) {
  const t = kelvinToRgb(kelvin);
  const d = kelvinToRgb(dayKelvin);
  let m = [0, 1, 2].map((i) => (d[i] <= 0 ? 1 : t[i] / d[i]));
  const max = Math.max(...m);
  if (max > 0) m = m.map((v) => v / max);
  // Intensity pulls towards neutral, not towards black.
  const k = clamp(intensity, 0, 1);
  return m.map((v) => 1 + (v - 1) * k);
}

/** What white becomes under the filter. Used for the preview swatches. */
export function whiteUnder(kelvin, dayKelvin, intensity = 1) {
  const m = multipliers(kelvin, dayKelvin, intensity);
  return `rgb(${m.map((v) => Math.round(255 * v)).join(',')})`;
}

const minuteNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/* ---------------- the browser overlay ---------------- */

let el = null;
let timer = null;
let suspended = false;

function overlay() {
  if (el && el.isConnected) return el;
  el = document.createElement('div');
  el.id = 'nightlight';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}

function paintBrowser() {
  const c = cfg();
  const node = overlay();
  if (!c.enabled || suspended) {
    node.style.display = 'none';
    return;
  }
  const m = multipliers(kelvinAt(c, minuteNow()), c.dayKelvin, c.intensity);
  // All-1 is white, so the element leaves the compositor entirely.
  if (m.every((v) => v > 0.995)) {
    node.style.display = 'none';
    return;
  }
  node.style.display = 'block';
  node.style.background = `rgb(${m.map((v) => Math.round(255 * v)).join(',')})`;
}

/* ---------------- the public surface ---------------- */

/** Push the current settings wherever they go, and repaint. */
export async function sync() {
  const c = cfg();
  if (isNative()) {
    try {
      return await plugin().configure({ ...c, clearPause: true });
    } catch {
      return null;
    }
  }
  paintBrowser();
  return null;
}

export async function status() {
  if (isNative()) {
    try {
      return await plugin().status();
    } catch {
      return null;
    }
  }
  const c = cfg();
  const kelvin = kelvinAt(c, minuteNow());
  return {
    native: false,
    enabled: c.enabled,
    running: c.enabled && !suspended,
    kelvin,
    neutral: kelvin >= c.dayKelvin - 40,
    mode: !c.enabled ? 'off' : suspended ? 'suspended' : 'page',
  };
}

export async function pause() {
  if (!isNative()) {
    toast('Pausing needs the app, not the browser');
    return null;
  }
  try {
    return await plugin().pause();
  } catch {
    return null;
  }
}

export async function requestPermission() {
  if (!isNative()) return;
  try {
    await plugin().requestOverlayPermission();
  } catch {
    toast('Could not open the permission screen');
  }
}

/** Held off for the gallery and the camera: an amber wash misreads a photo. */
export function suspend(on) {
  const next = !!on;
  if (next === suspended) return;
  suspended = next;
  if (isNative()) {
    try {
      plugin().setSuspended({ suspended: next });
    } catch {
      /* leave the filter as it is */
    }
    return;
  }
  paintBrowser();
}

/** Called once at boot. */
export function init() {
  // Clears a suspend left by a crash mid-gallery.
  suspended = false;
  if (isNative()) {
    try {
      plugin().setSuspended({ suspended: false });
    } catch {
      /* configure() re-states everything below */
    }
    sync();
    return;
  }
  paintBrowser();
  clearInterval(timer);
  // A minute is finer than the eye follows. Repaint on foreground: a throttled
  // interval may have missed hours.
  timer = setInterval(paintBrowser, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') paintBrowser();
  });
}

/* ---------------- settings ---------------- */

// Bare numbers: a long <option> squeezes the label beside it.
const NIGHT_CHOICES = [1900, 2200, 2700, 3400, 4200];
const DAY_CHOICES = [6500, 5800, 5000];

export async function renderNightlightSettings(mount) {
  const n = store.get().nightlight;
  const st = await status();

  const modeLine = {
    hardware: ['good', 'System filter'],
    overlay: ['ok', 'Overlay'],
    blocked: ['bad', 'Needs permission'],
    page: ['ok', 'This app only'],
    suspended: ['ok', 'Held off'],
    off: ['muted', 'Off'],
  }[st?.mode || 'off'] || ['muted', 'Off'];

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="settings" aria-label="Back">${icon('back')}</button>
        <h1>Night light</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('warmth', 16)}<h2>Right now</h2>
          <span class="pill ${modeLine[0] === 'good' ? 'done' : 'ghost'}">${escapeHtml(modeLine[1])}</span></div>
        ${st && st.enabled && !st.neutral ? `<div class="kv"><span>Screen temperature</span><b>${st.kelvin}K</b></div>` : ''}
        ${st?.mode === 'blocked' ? `<button class="btn primary" id="grant">Allow drawing over other apps</button>` : ''}
        ${st?.native && st.enabled ? `<button class="btn ghost" id="pauseBtn">${st.pausedUntil > Date.now() ? 'Resume now' : 'Pause for an hour'}</button>` : ''}
      </section>

      <section class="card">
        <label class="setting toggle">
          <span><b>Night light</b><i>${isNative() ? 'Filters the whole phone, not just NiFo, and keeps running with the app closed.' : 'Filters NiFo’s own screens. A phone-wide filter needs the APK.'}</i></span>
          <input type="checkbox" id="enabled" ${n.enabled ? 'checked' : ''}>
        </label>
        <label class="setting">
          <span><b>Shape</b></span>
        </label>
        ${segmented('curve', [{ id: 'gradual', label: 'All day' }, { id: 'flux', label: 'Evening only' }], n.curve)}
      </section>

      <section class="card">
        <div class="h-row">${icon('sun', 16)}<h2>Your day</h2></div>
        <label class="setting">
          <span><b>Up at</b></span>
          <input type="time" id="wakeAt" value="${escapeHtml(n.wakeAt)}">
        </label>
        <label class="setting">
          <span><b>In bed by</b></span>
          <input type="time" id="sleepAt" value="${escapeHtml(n.sleepAt)}">
        </label>
        ${nifoUnlocked() ? '<button class="btn ghost" id="matchRule">Match my prayer rule times</button>' : ''}
      </section>

      <section class="card">
        <div class="h-row">${icon('moon', 16)}<h2>Warmth</h2></div>
        <label class="setting">
          <span><b>At night</b><i>A bulb is 2700K, a candle 1900K.</i></span>
          <select id="nightKelvin">
            ${NIGHT_CHOICES.map((k) => `<option value="${k}" ${n.nightKelvin === k ? 'selected' : ''}>${k}K</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>In the day</b><i>6500K is neutral, so nothing is tinted until the ramp starts.</i></span>
          <select id="dayKelvin">
            ${DAY_CHOICES.map((k) => `<option value="${k}" ${n.dayKelvin === k ? 'selected' : ''}>${k}K</option>`).join('')}
          </select>
        </label>
        <label class="setting">
          <span><b>Strength <em id="intensityVal">${Math.round(n.intensity * 100)}%</em></b><i>Weakens the tint, not the temperatures.</i></span>
          <input type="range" id="intensity" min="20" max="100" step="5" value="${Math.round(n.intensity * 100)}">
        </label>
        <label class="setting">
          <span><b>Transition</b><i>How long the change at each end takes.</i></span>
          <select id="transitionMin">
            ${[20, 40, 60, 90, 120].map((m) => `<option value="${m}" ${n.transitionMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('chart', 16)}<h2>Across the day</h2></div>
        <div class="nl-strip" id="strip"></div>
        <div class="nl-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        <p class="fineprint">White, as it will look at each hour.${isNative() ? ' Drawn from the service’s own numbers, not a copy of them.' : ''}</p>
      </section>

      ${isNative() && st?.mode !== 'hardware' ? `<section class="card">
        <div class="h-row">${icon('help', 16)}<h2>The honest version</h2></div>
        <p class="fineprint">The overlay washes amber over the screen: correct on bright pixels, and it lifts black a little. No app can avoid that, because windows are blended over one another and none can ask for a multiply.</p>
        <p class="fineprint">Android's own filter is a real colour transform, so it does not. NiFo drives it instead once this is granted. Granted once, and it survives reboots and updates.</p>
        <p class="fineprint"><code id="nlGrant">adb shell pm grant ${escapeHtml(st?.packageName || 'gr.nifo.app')} android.permission.WRITE_SECURE_SETTINGS</code></p>
        <button class="btn ghost wide" id="nlCopy">${icon('key', 16)}<span>Copy the command</span></button>
        <p class="fineprint"><b>From a computer:</b> USB debugging on, plug in, run it.</p>
        <p class="fineprint"><b>From the phone alone:</b> Developer options, then Wireless debugging, then Shizuku (free) or LADB (paid).</p>
        <p class="fineprint"><b>Or nothing.</b> This buys black staying black, and stops near 2600K where the overlay reaches 1900K.</p>
      </section>` : ''}
    </div>`;

  /* ---- wiring ---- */

  // Copying beats retyping a 78-character command.
  const copyBtn = mount.querySelector('#nlCopy');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const text = mount.querySelector('#nlGrant')?.textContent?.trim() || '';
    try {
      await navigator.clipboard.writeText(text);
      toast('Command copied');
    } catch {
      // Clipboard needs a secure context and can be refused, so fall back to selecting.
      const r = document.createRange();
      r.selectNodeContents(mount.querySelector('#nlGrant'));
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      toast('Selected. Long-press to copy.');
    }
  });

  const set = (patch) => {
    store.update((s) => Object.assign(s.nightlight, patch));
    sync();
    drawStrip();
  };

  const $ = (id) => mount.querySelector('#' + id);

  $('enabled').addEventListener('change', (e) => {
    set({ enabled: e.target.checked });
    // Say so: turning it on without permission is a dead end.
    if (e.target.checked && isNative()) {
      status().then((s) => {
        if (s?.mode === 'blocked') renderNightlightSettings(mount);
      });
    }
  });
  onSegment(mount, 'curve', (id) => set({ curve: id }));
  $('wakeAt').addEventListener('change', (e) => set({ wakeAt: e.target.value }));
  $('sleepAt').addEventListener('change', (e) => set({ sleepAt: e.target.value }));
  $('nightKelvin').addEventListener('change', (e) => set({ nightKelvin: Number(e.target.value) }));
  $('dayKelvin').addEventListener('change', (e) => set({ dayKelvin: Number(e.target.value) }));
  $('transitionMin').addEventListener('change', (e) => set({ transitionMin: Number(e.target.value) }));
  $('intensity').addEventListener('input', (e) => {
    const el = $('intensityVal');
    if (el) el.textContent = `${e.target.value}%`;
    set({ intensity: Number(e.target.value) / 100 });
  });

  $('matchRule')?.addEventListener('click', () => {
    const p = store.get().pray.settings;
    set({ wakeAt: p.morningAt, sleepAt: p.eveningAt });
    $('wakeAt').value = p.morningAt;
    $('sleepAt').value = p.eveningAt;
    toast(`Up at ${p.morningAt}, bed by ${p.eveningAt}`);
  });

  $('grant')?.addEventListener('click', async () => {
    await requestPermission();
    toast('Come back once it is switched on');
  });

  $('pauseBtn')?.addEventListener('click', async () => {
    await pause();
    renderNightlightSettings(mount);
  });

  /** The day as swatches. On the APK the samples come from the service's own maths. */
  async function drawStrip() {
    const strip = $('strip');
    if (!strip) return;
    const c = cfg();
    let samples = null;
    if (isNative()) {
      try {
        const r = await plugin().curve({ ...c, step: 15 });
        samples = r?.samples || null;
      } catch {
        samples = null;
      }
    }
    if (!samples) {
      samples = [];
      for (let m = 0; m < 1440; m += 15) samples.push({ min: m, kelvin: kelvinAt(c, m) });
    }
    strip.innerHTML = samples
      .map((s) => `<i style="background:${whiteUnder(s.kelvin, c.dayKelvin, c.intensity)}" title="${fromMin(s.min)} · ${s.kelvin}K"></i>`)
      .join('');
  }
  drawStrip();
}
