// The sign-in gate. Five tries, then a wait that doubles.
//
// This is a courtesy, not a defence, and the difference matters. The key that
// talks to Supabase ships inside the app, so anyone determined enough calls the
// auth endpoint directly and never sees this screen at all. What the gate does
// is stop a mistyped password becoming forty requests, and make a stolen phone
// slow to guess at. The control that actually holds is Supabase's own rate
// limit, and docs/ACCOUNTS.md section 7 is how it is set.
//
// Two counters, because one is trivially stepped around. Per account, so a wait
// on one address does not lock the others; and per device, so typing a new
// address every sixth try does not reset anything.
//
// Its own localStorage key rather than a slice of the record: this is what one
// phone remembers about signing in, and sync copies the record whole, so a
// wrong password here must not lock a tablet there.
//
// The address last signed in with is kept here too, in plain text, because the
// whole point of it is to be shown. The counters are folded instead: a list of
// addresses that were tried is worth nothing to anybody.

const KEY = 'habitnemesis.gate.v1';

/** Tries before the first wait. */
export const FREE = 5;
/** The first wait, then twice that, and so on. */
export const FIRST = 30000;
/** Long enough to give up on, short enough not to be a lockout. */
export const CAP = 900000;
/** Failures across every account before the device itself waits. */
export const DEVICE_FREE = 20;
/** A device count older than this is forgotten. */
export const WINDOW = 900000;
/** Accounts remembered at once. Enough for a shared phone, bounded on purpose. */
const KEEP = 20;

/* ---------------- the maths ---------------- */

/** The wait after `n` failures. Nothing until the free ones are used up, then
 *  thirty seconds doubling to the cap. */
export function waitFor(n) {
  const over = n - FREE;
  if (over <= 0) return 0;
  return Math.min(CAP, FIRST * 2 ** (over - 1));
}

/** A wait as words. Seconds under a minute, then whole minutes. */
export function saySoon(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.ceil(s / 60)} min`;
}

/** An identifier, folded so a reader of the store cannot see who was tried.
 *  Not a secret: the address is on the screen. It keeps a second plaintext copy
 *  from existing, which is all a hash can honestly do here. */
export function idOf(identifier) {
  const s = String(identifier || '').trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/* ---------------- what is written down ---------------- */

const blank = () => ({ who: {}, device: { n: 0, at: 0 }, last: '' });

/** Saved state is untrusted input here as everywhere else. */
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return blank();
    const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
    const who = {};
    for (const [k, v] of Object.entries(raw.who || {}).slice(0, KEEP)) {
      if (/^[a-z0-9]{1,12}$/.test(k) && v && typeof v === 'object') {
        who[k] = { n: Math.min(num(v.n), 99), until: num(v.until), at: num(v.at) };
      }
    }
    const last = typeof raw.last === 'string' && raw.last.length <= 254 ? raw.last : '';
    return { who, device: { n: Math.min(num(raw.device?.n), 999), at: num(raw.device?.at) }, last };
  } catch {
    return blank();
  }
}

function write(state) {
  // Oldest first, so the newest KEEP survive a shared phone.
  const kept = Object.entries(state.who)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify({ who: Object.fromEntries(kept), device: state.device, last: state.last || '' }));
  } catch {
    /* a full or blocked store is not worth failing a sign-in over */
  }
}

/* ---------------- asking, and answering ---------------- */

/** How long this identifier must wait, in milliseconds. 0 means go ahead.
 *
 *  A clock moved forward skips a wait, and nothing on the device can stop that,
 *  which is the other half of why the server limit is the real one. A clock
 *  moved back is caught: a wait set in what is now the future is still running.
 */
export function waitLeft(identifier, now = Date.now()) {
  const st = read();
  const row = st.who[idOf(identifier)];
  const mine = row ? Math.max(row.until - now, row.at > now ? row.until - row.at : 0) : 0;
  const dev = st.device.at && now - st.device.at < WINDOW && st.device.n >= DEVICE_FREE
    ? waitFor(st.device.n - DEVICE_FREE + FREE) - (now - st.device.at)
    : 0;
  return Math.max(0, mine, dev);
}

/** Record a failure and return the wait it earned. */
export function fail(identifier, now = Date.now()) {
  const st = read();
  const key = idOf(identifier);
  const row = st.who[key] || { n: 0, until: 0, at: 0 };
  row.n += 1;
  row.at = now;
  row.until = now + waitFor(row.n);
  st.who[key] = row;
  // The device count is a window, not a total: an honest week of typos is not
  // the same thing as two hundred tries in ten minutes.
  if (!st.device.at || now - st.device.at >= WINDOW) st.device = { n: 0, at: now };
  st.device.n += 1;
  st.device.at = now;
  write(st);
  return waitLeft(identifier, now);
}

/** Signed in. Everything this identifier owed is cleared, and the device's
 *  count with it: a person who knows a password is not the attacker. */
export function pass(identifier) {
  const st = read();
  delete st.who[idOf(identifier)];
  st.device = { n: 0, at: 0 };
  write(st);
}

/** Tries left before the next wait, for the line on screen. */
export function triesLeft(identifier) {
  const row = read().who[idOf(identifier)];
  return Math.max(0, FREE - (row ? row.n : 0));
}

/* ---------------- who was here last ---------------- */

/** The address this phone last signed in with, so nobody types it twice. */
export function remembered() {
  return read().last;
}

export function remember(email) {
  const st = read();
  st.last = String(email || '').trim().toLowerCase().slice(0, 254);
  write(st);
}

export function forget() {
  const st = read();
  st.last = '';
  write(st);
}

/** Testing only: forget everything. */
export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to remove is fine */
  }
}
