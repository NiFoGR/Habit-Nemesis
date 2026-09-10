// The record, kept in your account. Automatic: push on change, pull on launch,
// and a question only when both copies changed since they last agreed.
//
// Still a whole-record copy, not a merge. The failure people have is a new
// phone, and that case is silent: the server is ahead, this device is clean,
// so the record comes down. Two devices edited apart is the one case that
// asks, once, naming both timestamps.
//
// Every row that comes back goes through store.importJson(), so a server row
// is sanitised exactly like a file from a stranger. Nothing else writes.

import * as store from '../store.js';
import { supabase, user, signedIn, subscribe as onAuth } from './session.js';
import { escapeHtml, openSheet, relTime, haptic, toast } from '../ui.js';

const TABLE = 'habit_state';
// Coalesce. Never more than one push in thirty seconds.
const DEBOUNCE_MS = 5000;
const MIN_GAP_MS = 30000;

let timer = null;
let lastPush = 0;
let pending = false; // a change is waiting to go up
let applying = false; // a pull is writing the store
let askNext = false; // the next sign-in came from onboarding

const need = () => {
  const sb = supabase();
  if (!sb) throw new Error('No account service is configured for this build.');
  if (!user()) throw new Error('You are not signed in.');
  return sb;
};

const online = () => navigator.onLine !== false;

/** Has this device changed the record since it last agreed with the account? */
export function dirty() {
  const s = store.get().settings;
  return !!s.changedAt && s.changedAt > (s.syncedAt || '');
}

/* ---------------- the three verbs ---------------- */

/** Write this device's record to the account. */
export async function push() {
  const sb = need();
  const at = store.get().settings.changedAt;
  const state = JSON.parse(store.exportJson());
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: user().id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  store.markSynced();
  // A mark landed while the upload was in flight: it goes up next.
  if (store.get().settings.changedAt !== at) schedule();
  return true;
}

/** What the account holds, or null. RLS makes the caller's row the only one
 *  they can see, so this needs no filter of its own. */
export async function peek() {
  const sb = need();
  const { data, error } = await sb.from(TABLE).select('state, updated_at').maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Replace this device's record with the account's. */
export async function pull() {
  const remote = await peek();
  if (!remote) throw new Error('Your account has no record in it yet.');
  applying = true;
  try {
    store.importJson(JSON.stringify(remote.state));
    store.markSynced();
  } finally {
    applying = false;
  }
  return remote.updated_at;
}

/* ---------------- push on change ---------------- */

/** Every store write lands here. Only unsynced work is worth a push: the
 *  write that marks a push done must not schedule the next one. */
function schedule() {
  if (!signedIn() || applying || !dirty()) return;
  pending = true;
  store.setSyncState(online() ? 'pending' : 'offline');
  clearTimeout(timer);
  const wait = Math.max(DEBOUNCE_MS, MIN_GAP_MS - (Date.now() - lastPush));
  timer = setTimeout(flush, wait);
}

/** Send what is waiting. Offline is a state, not an error: it retries.
 *  Compare first: a row written by another device since this one last agreed
 *  with the account is a conflict, not something to write over. `force` is
 *  the answer to that question, already given. */
export async function flush({ force = false } = {}) {
  clearTimeout(timer);
  timer = null;
  if (!pending || !signedIn()) return;
  if (!online()) {
    store.setSyncState('offline');
    return;
  }
  try {
    if (!force) {
      const remote = await peek();
      const mine = store.lastSynced();
      if (remote && (!mine || remote.updated_at > mine)) {
        if (!document.querySelector('.sheet-scrim')) choose(remote);
        return;
      }
    }
    pending = false;
    await push();
    lastPush = Date.now();
    store.setSyncState('synced');
  } catch {
    store.setSyncState(online() ? 'error' : 'offline');
  }
}

/* ---------------- launch, and every sign-in ---------------- */

/** Settle the two copies. `ask` forces the sheet when the account holds a
 *  record, which is what onboarding wants: nothing imported in silence. */
export async function reconcile({ ask = false } = {}) {
  if (!signedIn()) return;
  if (!online()) {
    store.setSyncState(dirty() ? 'offline' : 'idle');
    return;
  }
  let remote;
  try {
    remote = await peek();
  } catch {
    store.setSyncState('error');
    return;
  }
  const mine = store.lastSynced();
  if (!remote) {
    pending = true;
    return flush({ force: true });
  }
  const ahead = !mine || remote.updated_at > mine;
  if (!ahead) {
    if (dirty()) {
      pending = true;
      return flush({ force: true });
    }
    store.setSyncState('synced');
    return;
  }
  // The new phone case. Invisible, except that the screen already drawn from
  // the old record is redrawn from the new one.
  if (!dirty() && !ask) {
    try {
      await pull();
      store.setSyncState('synced');
      redraw();
    } catch {
      store.setSyncState('error');
    }
    return;
  }
  // One sheet at a time. A launch that navigated away from it asks again next time.
  if (document.querySelector('.sheet-scrim')) return;
  choose(remote);
}

/** Both copies moved. One question, both dates, and the choice is the user's. */
function choose(remote) {
  const local = store.get().settings.changedAt;
  const sheet = openSheet(`
    <h2>Two copies of the record</h2>
    <p class="muted small">This phone and your account both changed since they last agreed. Keep one.</p>
    <div class="kv"><span>This phone</span><b>changed ${escapeHtml(local ? relTime(local) : 'recently')}</b></div>
    <div class="kv"><span>Your account</span><b>backed up ${escapeHtml(relTime(remote.updated_at))}</b></div>
    <div class="btn-row">
      <button class="btn" id="keepMine">Keep this phone's</button>
      <button class="btn primary" id="useTheirs">Use the account's</button>
    </div>`);
  sheet.el.querySelector('#keepMine').addEventListener('click', async () => {
    sheet.close();
    pending = true;
    await flush({ force: true });
    haptic('done');
    toast('Backed up');
  });
  sheet.el.querySelector('#useTheirs').addEventListener('click', async () => {
    sheet.close();
    try {
      await pull();
      store.setSyncState('synced');
      haptic('done');
      toast('Restored from your account');
      if (location.hash === '#/hub') redraw();
      else location.hash = '#/hub';
    } catch (e) {
      store.setSyncState('error');
      toast(e.message);
    }
  });
}

/** The router listens for this and draws the current route again. */
const redraw = () => window.dispatchEvent(new Event('hashchange'));

/** Onboarding signed in: the next session to arrive asks rather than imports. */
export function askOnNextSignIn() {
  askNext = true;
}

/** Wire once, after account.init(). Safe with no project configured. */
export function start() {
  if (!supabase()) return;
  store.subscribe(schedule);
  onAuth((session) => {
    if (!session) {
      pending = false;
      store.setSyncState('idle');
      return;
    }
    const ask = askNext;
    askNext = false;
    reconcile({ ask });
  });
  // Back online is a launch: compare before anything goes up.
  window.addEventListener('online', () => reconcile());
  // A hidden app may be killed. What is waiting goes now.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', () => flush());
  reconcile();
}
