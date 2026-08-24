// The night light: the screen's colour temperature, on a schedule.
//
// Two implementations, and which one you get depends on where the app is
// running.
//
//   In the APK it is a real system-wide filter. A foreground service in
//   native/nightlight/ owns the schedule and repaints once a minute, so it
//   keeps working with NiFo closed, across a reboot, and over every other app
//   on the phone. Nothing in this file computes a colour there: it writes the
//   configuration and reads the status back, and that is the whole contract.
//   Putting the schedule on the web side would mean a night light that only
//   worked while you had NiFo open, which is not a night light.
//
//   In a browser there is no such thing as a system-wide filter, so the same
//   settings drive a full-screen overlay over NiFo's own pages. That exists so
//   `npm run dev` is not a dead screen, and because it is genuinely better in
//   one respect: CSS can multiply, which is the correct model, where an Android
//   overlay window can only wash (see OverlayService.java for why).
//
// The maths below is therefore the browser's own, and the preview's fallback.
// On the APK the preview asks the plugin for its samples instead, so the curve
// you are shown is the curve the service will actually run rather than a
// reimplementation that agrees with it today and not after the next edit.

import * as store from './store.js';
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

/* ---------------- the maths, mirrored ----------------
   Kept deliberately identical to Curve.java. If one of the two ever has to
   change, both do; the preview on the APK comes from the Java side precisely so
   a drift here shows up as the browser looking wrong rather than as the phone
   quietly doing something other than what the settings screen drew. */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampK = (k) => clamp(Math.round(k), MIN_KELVIN, MAX_KELVIN);
const mod = (v, m) => ((v % m) + m) % m;

/** Interpolates in mireds. Kelvin is perceptually lopsided; see Curve.java. */
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

/** Per-channel multipliers, normalised so the day temperature is exactly 1,1,1
 *  and "on" in daylight is a genuine no-op rather than a permanent faint tint. */
export function multipliers(kelvin, dayKelvin, intensity = 1) {
  const t = kelvinToRgb(kelvin);
  const d = kelvinToRgb(dayKelvin);
  let m = [0, 1, 2].map((i) => (d[i] <= 0 ? 1 : t[i] / d[i]));
  const max = Math.max(...m);
  if (max > 0) m = m.map((v) => v / max);
  // Intensity pulls the whole thing back towards neutral rather than towards
  // black, so turning it down weakens the tint instead of dimming the screen.
  const k = clamp(intensity, 0, 1);
  return m.map((v) => 1 + (v - 1) * k);
}

/** The colour white ends up when this filter is applied. Used for the preview
 *  swatches, which is exactly the question "what will this look like". */
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
  // A multiplier of 1 across the board is white, and multiplying by white is a
  // no-op, so the element comes out of the compositor's way entirely.
  if (m.every((v) => v > 0.995)) {
    node.style.display = 'none';
    return;
  }
  node.style.display = 'block';
  node.style.background = `rgb(${m.map((v) => Math.round(255 * v)).join(',')})`;
}

/* ---------------- the public surface ---------------- */

/** Pushes the current settings wherever they need to go, and repaints. */
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

/** Held off while a screen that needs true colour is open: the progress gallery
 *  and the camera. Judging a photo through an amber wash is misleading and
 *  comparing two of them is worse. */
export function suspend(on) {
  const next = !!on;
  if (next === suspended) return;
  suspended = next;
  if (isNative()) {
    try {
      plugin().setSuspended({ suspended: next });
    } catch {
      /* the filter stays as it is; nothing here is worth surfacing */
    }
    return;
  }
  paintBrowser();
}

/** Called once at boot. */
export function init() {
  // Any suspend left set by a crash mid-gallery is cleared here, which is what
  // makes a plain flag safe to use for it rather than a timed pause.
  suspended = false;
  if (isNative()) {
    try {
      plugin().setSuspended({ suspended: false });
    } catch {
      /* nothing to recover: configure() below re-states everything anyway */
    }
    sync();
    return;
  }
  paintBrowser();
  clearInterval(timer);
  // A minute is finer than the eye can follow a ramp this slow, and costs
  // nothing. Coming back to a backgrounded tab repaints immediately, since a
  // throttled interval may have missed hours.
  timer = setInterval(paintBrowser, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') paintBrowser();
  });
}

/* ---------------- settings ---------------- */

// Bare numbers, because the label beside them has the room to explain and a
// long <option> squeezes that label into a column two words wide.
const NIGHT_CHOICES = [1900, 2200, 2700, 3400, 4200];
const DAY_CHOICES = [6500, 5800, 5000];

export async function renderNightlightSettings(mount) {
  const n = store.get().nightlight;
  const st = await status();

  const modeLine = {
    hardware: ['good', 'System filter', 'Driving Android’s own Night Light. This is the real thing: a hardware colour transform over everything, including the lock screen, and it does not lift blacks.'],
    overlay: ['ok', 'Overlay', 'An amber layer drawn over every app. It works everywhere, but it lifts blacks slightly, because a window cannot multiply. See below for the way around that.'],
    blocked: ['bad', 'Needs permission', 'NiFo cannot draw over other apps yet, so there is nothing to filter with.'],
    page: ['ok', 'This app only', 'Running in a browser, so the filter covers NiFo’s own screens and nothing else. Install the APK for a phone-wide one.'],
    suspended: ['ok', 'Held off', 'A photo screen is open, so the filter is out of the way until you leave it.'],
    off: ['muted', 'Off', 'Nothing is being filtered.'],
  }[st?.mode || 'off'] || ['muted', 'Off', ''];

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
        <p class="small muted">${modeLine[2]}</p>
        ${st && st.enabled && !st.neutral ? `<div class="kv"><span>Screen temperature</span><b>${st.kelvin}K</b></div>` : ''}
        ${st?.mode === 'blocked' ? `<button class="btn primary" id="grant">Allow drawing over other apps</button>` : ''}
        ${st?.native && st.enabled ? `<button class="btn ghost" id="pauseBtn">${st.pausedUntil > Date.now() ? 'Resume now' : 'Pause for an hour'}</button>` : ''}
      </section>

      <section class="card">
        <div class="h-row">${icon('flash', 16)}<h2>On</h2></div>
        <label class="setting toggle">
          <span><b>Night light</b><i>${isNative() ? 'Filters the whole phone, not just NiFo, and keeps running with the app closed.' : 'Filters NiFo’s own screens. A phone-wide filter needs the APK.'}</i></span>
          <input type="checkbox" id="enabled" ${n.enabled ? 'checked' : ''}>
        </label>
        <label class="setting">
          <span><b>Shape</b><i>How the warmth arrives across the day.</i></span>
        </label>
        ${segmented('curve', [{ id: 'gradual', label: 'All day' }, { id: 'flux', label: 'Evening only' }], n.curve)}
        <p class="small muted" id="curveNote"></p>
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
        <button class="btn ghost" id="matchRule">Match my prayer rule times</button>
      </section>

      <section class="card">
        <div class="h-row">${icon('moon', 16)}<h2>Warmth</h2></div>
        <label class="setting">
          <span><b>At night</b><i>Where the ramp ends up by bedtime. A bulb is about 2700K, a candle 1900K.</i></span>
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
          <span><b>Strength</b><i>Weakens the tint without changing the temperatures.</i></span>
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

      <section class="card">
        <div class="h-row">${icon('help', 16)}<h2>The honest version</h2></div>
        <p class="fineprint">An overlay covers the screen in amber. That takes blue out of bright pixels correctly, and lifts black pixels slightly towards amber, which is the wrong direction. No app can avoid it: windows are blended over one another by the system, and no app can ask for a multiply.</p>
        <p class="fineprint">Android's own Night Light does not have that problem, because it is a real colour transform on the display. NiFo will drive it instead, automatically, if you grant one permission from a computer, once:</p>
        <p class="fineprint"><code>adb shell pm grant ${escapeHtml(st?.packageName || 'gr.nifo.app')} android.permission.WRITE_SECURE_SETTINGS</code></p>
        <p class="fineprint">Nothing needs switching on afterwards; the next minute takes the better road. Note that the system filter cannot go as warm as the overlay, usually stopping near 2600K.</p>
      </section>
    </div>`;

  /* ---- wiring ---- */

  const set = (patch) => {
    store.update((s) => Object.assign(s.nightlight, patch));
    sync();
    drawStrip();
    drawCurveNote();
  };

  const $ = (id) => mount.querySelector('#' + id);

  $('enabled').addEventListener('change', (e) => {
    set({ enabled: e.target.checked });
    // Turning it on with no permission is a dead end unless we say so.
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
  $('intensity').addEventListener('input', (e) => set({ intensity: Number(e.target.value) / 100 }));

  $('matchRule').addEventListener('click', () => {
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

  function drawCurveNote() {
    const c = cfg();
    const el2 = $('curveNote');
    if (!el2) return;
    el2.textContent = c.curve === 'gradual'
      ? `Warming from ${fromMin(c.wakeMin)}, so slowly you will not catch it happening, and fully warm by ${fromMin(c.sleepMin)}.`
      : `Daylight until ${fromMin(mod(c.sleepMin - c.transitionMin, 1440))}, then down to ${c.nightKelvin}K over ${c.transitionMin} minutes.`;
  }

  /** The whole day as swatches. On the APK the samples come from the service's
   *  own maths, so this is a picture of what will happen rather than of what a
   *  second implementation thinks will happen. */
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

  drawCurveNote();
  drawStrip();
}
