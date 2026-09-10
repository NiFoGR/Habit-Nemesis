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
    <div class="acc-who">
      <span class="acc-state" data-state="none">No account in this build</span>
      <span class="acc-mail">The record stays on this phone.</span>
    </div>
    <div class="set-rows">
      <a class="set-link" href="#/settings/data"><span>Your data</span><i>Export and restore</i>${icon('back', 16)}</a>
    </div>
  </div>`;
}

/* ---------------- signed out ---------------- */

function signedOut(mount, by) {
  mount.innerHTML = `<div class="screen">${head}
    <p class="acc-lead">One account, every phone. The app works the same without one.</p>

    <div class="acc-tabs" role="tablist">
      <button class="acc-tab on" id="tabEmail" role="tab" aria-selected="true">Email</button>
      <button class="acc-tab" id="tabPhone" role="tab" aria-selected="false">Phone</button>
    </div>

    <form class="acc-form" id="form">
      <div id="byEmail">
        <label class="field"><span>Email</span>
          <input type="email" id="email" autocomplete="email" inputmode="email"></label>
        <label class="field"><span>Password</span>
          <input type="password" id="password" autocomplete="current-password" minlength="8"></label>
      </div>
      <div id="byPhone" hidden>
        <label class="field"><span>Phone</span>
          <input type="tel" id="phone" autocomplete="tel" inputmode="tel" placeholder="+44 7700 900000"></label>
        <label class="field" id="codeField" hidden><span>Code</span>
          <input type="text" id="code" autocomplete="one-time-code" inputmode="numeric" maxlength="8"></label>
      </div>
      <p class="warn-inline" id="err" hidden></p>
      <button class="btn primary wide" id="go" type="submit">Sign in</button>
      <div class="acc-alt">
        <button class="tail-btn" type="button" id="toggle">Create an account</button>
        <button class="tail-btn" type="button" id="forgot">Forgot password</button>
      </div>
    </form>

    <div class="acc-or"><span>or</span></div>

    <div class="acc-providers">
      <button class="btn wide" data-provider="google">Continue with Google</button>
      <button class="btn wide" data-provider="apple">Continue with Apple</button>
    </div>

    <p class="fineprint">By continuing you agree to the <a href="./legal/terms.html">terms</a> and the <a href="./legal/privacy.html">privacy&nbsp;policy</a>.</p>
  </div>`;

  let creating = false;
  const el = (id) => mount.querySelector('#' + id);
  const err = el('err');
  const fail = (msg) => {
    err.textContent = readable(msg);
    err.hidden = false;
    haptic('miss');
  };

  let byPhone = false;
  let codeSent = false;
  const setTab = (phone) => {
    byPhone = phone;
    codeSent = false;
    err.hidden = true;
    el('byEmail').hidden = phone;
    el('byPhone').hidden = !phone;
    el('codeField').hidden = true;
    el('tabEmail').classList.toggle('on', !phone);
    el('tabPhone').classList.toggle('on', phone);
    el('tabEmail').setAttribute('aria-selected', String(!phone));
    el('tabPhone').setAttribute('aria-selected', String(phone));
    // A number has no password to make or reset, so neither tail applies.
    el('toggle').hidden = phone;
    el('forgot').hidden = phone;
    el('go').textContent = phone ? 'Send code' : creating ? 'Create account' : 'Sign in';
  };
  el('tabEmail').addEventListener('click', () => setTab(false));
  el('tabPhone').addEventListener('click', () => setTab(true));
  if (by === 'phone') setTab(true);

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
    if (byPhone) return submitPhone();
    const email = el('email').value.trim();
    const password = el('password').value;
    if (password.length < 8) return fail('Passwords need at least eight characters.');
    const go = el('go');
    const said = go.textContent;
    go.disabled = true;
    go.textContent = creating ? 'Creating' : 'Signing in';
    try {
      if (creating) {
        const { needsConfirmation } = await session.signUp(email, password);
        if (needsConfirmation) {
          toast('Check your email to confirm the account');
          go.disabled = false;
          go.textContent = said;
          return;
        }
      } else {
        await session.signIn(email, password);
      }
      haptic('done');
      await afterSignIn(mount);
    } catch (e2) {
      go.disabled = false;
      go.textContent = said;
      fail(e2.message);
    }
  });

  async function submitPhone() {
    const phone = el('phone').value.trim();
    if (!phone) return fail('Put your number in first.');
    const go = el('go');
    const said = go.textContent;
    go.disabled = true;
    try {
      if (!codeSent) {
        go.textContent = 'Sending';
        await session.sendCode(phone);
        codeSent = true;
        el('codeField').hidden = false;
        el('code').focus();
        go.disabled = false;
        go.textContent = 'Sign in';
        return;
      }
      go.textContent = 'Signing in';
      await session.verifyCode(phone, el('code').value.trim());
      haptic('done');
      await afterSignIn(mount);
    } catch (e2) {
      go.disabled = false;
      go.textContent = said;
      fail(e2.message);
    }
  }

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
    <div class="acc-who">
      <span class="acc-state" id="state" data-state="${dotState()}">${escapeHtml(stateLine())}</span>
      <span class="acc-mail">${escapeHtml(session.emailOf())}</span>
    </div>

    <div class="set-rows">
      <button type="button" class="set-link" id="push">
        <span>Sync now<i>Every change goes up on its own.</i></span>
      </button>
      <button type="button" class="set-link" id="pull">
        <span>Restore from account<i>Replaces what is on this phone.</i></span>
      </button>
      <button type="button" class="set-link" id="out"><span>Sign out</span></button>
    </div>

    <div class="set-rows">
      <button type="button" class="set-link danger" id="del"><span>Delete account</span></button>
    </div>
  </div>`;

  const state = mount.querySelector('#state');
  const say = (msg) => {
    state.textContent = msg;
    state.dataset.state = dotState();
  };
  const off = store.onSyncState(() => (state.isConnected ? say(stateLine()) : off()));

  mount.querySelector('#push').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await sync.push();
      store.setSyncState('synced');
      haptic('done');
      toast('Synced');
      say(stateLine());
    } catch (err) {
      toast(err.message);
    }
    btn.disabled = false;
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
    <p class="muted small">Your account and the copy of the record in it are deleted. No undo. The record on this phone is untouched. Type <b>delete</b> to confirm.</p>
    <input type="text" id="word" autocomplete="off" class="set-word" placeholder="delete">
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

/** The provider's wording, where the app has better. */
function readable(msg) {
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match.';
  if (/already registered/i.test(msg)) return 'That email already has an account.';
  if (/failed to fetch|network/i.test(msg)) return 'No connection.';
  return msg;
}

/** What the account holds, as one line. */
function stateLine() {
  const at = store.lastSynced();
  return {
    pending: 'Syncing',
    offline: 'Offline',
    error: 'Sync failed',
  }[store.syncState()] || (at ? `Synced ${relTime(at)}` : 'Nothing synced yet');
}

// The dot's colour, not the words: good, waiting, or failed.
const dotState = () => ({ pending: 'wait', offline: 'wait', error: 'bad' }[store.syncState()] || 'good');

/** The two copies settle themselves. A record already in the account comes
 *  down on its own when this phone is clean, and asks when it is not. */
async function afterSignIn(mount) {
  render(mount);
  await sync.reconcile();
  if (store.syncState() === 'synced') navigate('#/hub');
}

export function render(mount, { by } = {}) {
  if (!configured()) return unconfigured(mount);
  if (!session.available()) return unconfigured(mount);
  return session.signedIn() ? signedIn(mount) : signedOut(mount, by);
}
