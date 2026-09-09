// The account screen: signed out it is the way in, signed in it is the record
// and the way out. One screen, because two would be a menu in front of a form.

import * as store from '../store.js';
import * as session from './session.js';
import { signInWith } from './oauth.js';
import * as sync from './sync.js';
import { configured } from './config.js';
import { escapeHtml, toast, haptic, openSheet, relDay, relTime } from '../ui.js';
import { icon } from '../icons.js';
import { navigate } from '../back.js';

const head = `<header class="screen-head">
  <button class="icon-btn" data-back="settings" aria-label="Back">${icon('back')}</button>
  <h1>Account</h1>
  <span class="icon-btn ghost"></span>
</header>`;

/** No project in this build. Says so rather than offering a form that cannot work. */
function unconfigured(mount) {
  mount.innerHTML = `<div class="screen">${head}
    <section class="card">
      <h2>Not in this build</h2>
      <p class="muted small">This copy of the app has no account service configured, so there is nothing to sign in to. Everything works exactly as it does now, on this device.</p>
    </section>
    <p class="fineprint">Your record is on this phone. Your data, in Settings, has the backup.</p>
  </div>`;
}

/* ---------------- signed out ---------------- */

function signedOut(mount) {
  mount.innerHTML = `<div class="screen">${head}
    <section class="card">
      <h2>Keep the record</h2>
      <p class="muted small">Your account holds the grid, the ladder and the cabinet. New phone, same record. Optional: the app works the same without one.</p>
    </section>

    <form class="card acc-form" id="form">
      <label class="field"><span>Email</span>
        <input type="email" id="email" autocomplete="email" inputmode="email" required></label>
      <label class="field"><span>Password</span>
        <input type="password" id="password" autocomplete="current-password" minlength="8" required></label>
      <p class="warn-inline" id="err" hidden></p>
      <button class="btn primary wide" id="go" type="submit">Sign in</button>
      <div class="acc-alt">
        <button class="tail-btn" type="button" id="toggle">Create an account</button>
        <button class="tail-btn" type="button" id="forgot">Forgot password</button>
      </div>
    </form>

    <div class="acc-or"><span>or</span></div>

    <div class="acc-providers">
      <button class="btn wide" data-provider="google">${icon('external', 16)}<span>Continue with Google</span></button>
      <button class="btn wide" data-provider="apple">${icon('external', 16)}<span>Continue with Apple</span></button>
    </div>

    <p class="fineprint">By continuing you agree to the <a href="./legal/terms.html">terms</a> and the <a href="./legal/privacy.html">privacy policy</a>.</p>
  </div>`;

  let creating = false;
  const el = (id) => mount.querySelector('#' + id);
  const err = el('err');
  const fail = (msg) => {
    err.textContent = msg;
    err.hidden = false;
    haptic('miss');
  };

  el('toggle').addEventListener('click', () => {
    creating = !creating;
    err.hidden = true;
    el('go').textContent = creating ? 'Create account' : 'Sign in';
    el('toggle').textContent = creating ? 'I already have one' : 'Create an account';
    el('password').setAttribute('autocomplete', creating ? 'new-password' : 'current-password');
  });

  el('forgot').addEventListener('click', async () => {
    const email = el('email').value.trim();
    if (!email) return fail('Put your email in first.');
    try {
      await session.sendReset(email);
      toast('Check your email for a reset link');
    } catch (e) {
      fail(e.message);
    }
  });

  el('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = el('email').value.trim();
    const password = el('password').value;
    if (password.length < 8) return fail('Passwords need at least eight characters.');
    el('go').disabled = true;
    try {
      if (creating) {
        const { needsConfirmation } = await session.signUp(email, password);
        if (needsConfirmation) {
          toast('Check your email to confirm the account');
          el('go').disabled = false;
          return;
        }
      } else {
        await session.signIn(email, password);
      }
      haptic('done');
      await afterSignIn(mount);
    } catch (e2) {
      el('go').disabled = false;
      fail(e2.message);
    }
  });

  mount.querySelectorAll('[data-provider]').forEach((b) =>
    b.addEventListener('click', async () => {
      haptic('press');
      try {
        await signInWith(b.dataset.provider);
      } catch (e) {
        fail(e.message);
      }
    })
  );
}

/* ---------------- signed in ---------------- */

function signedIn(mount) {
  mount.innerHTML = `<div class="screen">${head}
    <section class="card">
      <h2>Signed in</h2>
      <p class="muted small">${escapeHtml(session.emailOf())}</p>
    </section>

    <section class="card">
      <h2>Your record</h2>
      <p class="muted small" id="state">${escapeHtml(stateLine())}</p>
      <div class="set-actions">
        <button class="btn" id="push">Sync now</button>
        <button class="btn" id="pull">Restore from account</button>
      </div>
      <p class="fineprint">Every change goes up on its own. Restoring replaces what is on this phone, so it asks first.</p>
    </section>

    <div class="set-actions">
      <button class="btn wide" id="out">Sign out</button>
    </div>

    <button class="btn danger wide" id="del">Delete account</button>
    <p class="fineprint">Deletes your account and the copy of the record in it. What is on this phone stays until you erase it in Settings.</p>
  </div>`;

  const state = mount.querySelector('#state');
  const say = (msg) => {
    state.textContent = msg;
  };
  const off = store.onSyncState(() => (state.isConnected ? say(stateLine()) : off()));

  mount.querySelector('#push').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await sync.push();
      store.setSyncState('synced');
      haptic('done');
      toast('Synced');
      say(stateLine());
    } catch (err) {
      toast(err.message);
    }
    e.target.disabled = false;
  });

  mount.querySelector('#pull').addEventListener('click', async () => {
    let remote;
    try {
      remote = await sync.peek();
    } catch (err) {
      return toast(err.message);
    }
    if (!remote) return toast('Your account has no record in it yet.');
    const before = store.exportJson();
    try {
      await sync.pull();
      haptic('done');
      navigate('#/hub');
      toast(`Restored the copy from ${relDay(remote.updated_at.slice(0, 10))}`, { undo: () => { store.importJson(before); window.dispatchEvent(new Event('hashchange')); } });
    } catch (err) {
      toast(err.message);
    }
  });

  mount.querySelector('#out').addEventListener('click', async () => {
    await session.signOut();
    toast('Signed out');
    render(mount);
  });

  mount.querySelector('#del').addEventListener('click', () => confirmDelete(mount));
}

/** Two steps, because it cannot be undone and one tap is not a decision. */
function confirmDelete(mount) {
  const sheet = openSheet(`
    <h2>Delete your account</h2>
    <p class="warn-inline">This cannot be undone.</p>
    <p class="muted small">Your account and the record backed up in it are deleted. The record on this phone is untouched, and Settings can still export it.</p>
    <p class="muted small">Type <b>delete</b> to confirm.</p>
    <input type="text" id="word" autocomplete="off" class="text-input" placeholder="delete">
    <div class="btn-row">
      <button class="btn ghost" data-close>Keep it</button>
      <button class="btn danger" id="go">Delete</button>
    </div>`);

  sheet.el.querySelector('#go').addEventListener('click', async () => {
    if (sheet.el.querySelector('#word').value.trim().toLowerCase() !== 'delete') return haptic('miss');
    try {
      await session.deleteAccount();
      sheet.close();
      toast('Account deleted');
      render(mount);
    } catch (e) {
      toast(e.message);
    }
  });
}

/** What the account holds, as one line. */
function stateLine() {
  const at = store.lastSynced();
  return {
    pending: 'Syncing.',
    offline: 'Offline. Syncs when you are back.',
    error: 'Could not reach your account.',
  }[store.syncState()] || (at ? `Synced ${relTime(at)}.` : 'Nothing synced yet.');
}

/** The two copies settle themselves. A record already in the account comes
 *  down on its own when this phone is clean, and asks when it is not. */
async function afterSignIn(mount) {
  render(mount);
  await sync.reconcile();
  if (store.syncState() === 'synced') navigate('#/hub');
}

export function render(mount) {
  if (!configured()) return unconfigured(mount);
  if (!session.available()) return unconfigured(mount);
  return session.signedIn() ? signedIn(mount) : signedOut(mount);
}
