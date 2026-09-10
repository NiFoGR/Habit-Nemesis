// The account screen: signed out it is the way in, signed in it is the record
// and the way out. One screen, because two would be a menu in front of a form.

import * as store from '../store.js';
import * as session from './session.js';
import { signInWith } from './oauth.js';
import * as sync from './sync.js';
import { configured } from './config.js';
import * as gate from './gate.js';
import { escapeHtml, toast, haptic, openSheet, relDay, relTime } from '../ui.js';
import { icon, logoMark } from '../icons.js';
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

/** Long enough that the gate has something to protect. The rule that actually
 *  holds is Supabase's own minimum, which docs/ACCOUNTS.md section 7 sets. */
const MIN_PASSWORD = 8;

/** Three steps. Length does most of the work, a second and third kind of
 *  character do the rest. No words: the rail is the whole of it. */
function strength(pw) {
  if (pw.length < MIN_PASSWORD) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (pw.length >= 14 || kinds >= 3) return 3;
  if (pw.length >= 10 || kinds >= 2) return 2;
  return 1;
}

/** Shown whether or not the address already had an account. Two answers would
 *  make this form a way of asking which addresses do. */
function checkYourEmail(address, again) {
  const sheet = openSheet(`
    <div class="acc-sent">
      <span class="acc-sent-mark">${icon('mail', 26)}</span>
      <h2>Check your email</h2>
      <p class="muted small">${escapeHtml(address)}</p>
    </div>
    <button class="btn ghost wide" id="again">Send it again</button>
    <button class="btn wide" data-close>Done</button>`);

  const btn = sheet.el.querySelector('#again');
  let timer = 0;
  let left = 0;
  const tick = () => {
    if (!btn.isConnected) return clearInterval(timer);
    left -= 1;
    btn.textContent = left > 0 ? `Send it again in ${left}s` : 'Send it again';
    btn.disabled = left > 0;
  };
  // A minute between sends, so a resend button is not an email cannon pointed
  // at whoever owns that address.
  const cool = () => {
    clearInterval(timer);
    left = 61;
    tick();
    timer = setInterval(tick, 1000);
  };
  cool();
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await again();
      cool();
    } catch (e) {
      toast(readable(e.message));
      btn.disabled = false;
    }
  });
  return sheet;
}

function signedOut(mount, by) {
  mount.innerHTML = `<div class="screen">${head}
    <div class="acc-seg" id="seg" role="tablist">
      <button class="acc-seg-b on" type="button" id="modeIn" role="tab" aria-selected="true">Sign in</button>
      <button class="acc-seg-b" type="button" id="modeUp" role="tab" aria-selected="false">Create account</button>
    </div>

    <form class="acc-form" id="form" novalidate>
      <div id="byEmail">
        <label class="field"><span>Email</span>
          <input type="email" id="email" autocomplete="email" inputmode="email"
            autocapitalize="off" autocorrect="off" spellcheck="false"
            value="${escapeHtml(gate.remembered())}"></label>
        <label class="field"><span>Password</span>
          <span class="pw">
            <input type="password" id="password" autocomplete="current-password">
            <button type="button" class="pw-show" id="eye" aria-label="Show password">Show</button>
          </span></label>
        <span class="pw-rail" id="rail" hidden data-at="0"><i></i><i></i><i></i></span>
      </div>

      <div id="byPhone" hidden>
        <label class="field"><span>Phone</span>
          <input type="tel" id="phone" autocomplete="tel" inputmode="tel" placeholder="+44 7700 900000"></label>
        <label class="field" id="codeField" hidden><span>Code</span>
          <input type="text" id="code" autocomplete="one-time-code" inputmode="numeric" maxlength="8"></label>
      </div>

      <p class="warn-inline" id="err" hidden></p>
      <button class="btn primary wide" id="go" type="submit">Sign in</button>
    </form>

    <div class="acc-alt">
      <button class="tail-btn" type="button" id="forgot">Forgot password</button>
      <button class="tail-btn" type="button" id="swap">Use a phone number</button>
    </div>

    <div class="acc-or"><span>or</span></div>

    <div class="acc-providers">
      <button class="btn wide" data-provider="google">Continue with Google</button>
      <button class="btn wide" data-provider="apple">Continue with Apple</button>
    </div>

    <p class="fineprint">By continuing you agree to the <a href="./legal/terms.html">terms</a> and the <a href="./legal/privacy.html">privacy&nbsp;policy</a>.</p>
  </div>`;

  const el = (id) => mount.querySelector('#' + id);
  const err = el('err');
  const go = el('go');
  let creating = false;
  let byPhone = false;
  let codeSent = false;
  let timer = 0;

  const label = () => (byPhone ? (codeSent ? 'Sign in' : 'Send code') : creating ? 'Create account' : 'Sign in');
  const say = (msg) => {
    err.textContent = msg;
    err.hidden = !msg;
  };
  const fail = (msg) => {
    say(readable(msg));
    haptic('miss');
  };
  const who = () => (byPhone ? el('phone').value.trim() : session.cleanEmail(el('email').value));

  /* ---- the wait ---- */

  /** The button counts the wait down rather than a line of text doing it: the
   *  thing you cannot press is the thing that should say why. */
  function hold(ms) {
    clearInterval(timer);
    const until = Date.now() + ms;
    const tick = () => {
      if (!go.isConnected) return clearInterval(timer);
      const left = until - Date.now();
      if (left <= 0) {
        clearInterval(timer);
        go.disabled = false;
        go.textContent = label();
        return;
      }
      go.disabled = true;
      go.textContent = `Try again in ${gate.saySoon(left)}`;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  const owed = () => {
    const ms = gate.waitLeft(who());
    if (ms > 0) hold(ms);
    return ms > 0;
  };

  /* ---- which form ---- */

  const setMode = (create) => {
    creating = create;
    say('');
    el('modeIn').classList.toggle('on', !create);
    el('modeUp').classList.toggle('on', create);
    el('modeIn').setAttribute('aria-selected', String(!create));
    el('modeUp').setAttribute('aria-selected', String(create));
    el('password').setAttribute('autocomplete', create ? 'new-password' : 'current-password');
    el('forgot').hidden = create;
    el('rail').hidden = !create;
    go.textContent = label();
    rail();
  };

  const setPhone = (on) => {
    byPhone = on;
    codeSent = false;
    say('');
    el('byEmail').hidden = on;
    el('byPhone').hidden = !on;
    el('codeField').hidden = true;
    el('seg').hidden = on;
    el('forgot').hidden = on || creating;
    el('swap').textContent = on ? 'Use an email address' : 'Use a phone number';
    go.textContent = label();
  };

  /** The rail, and nothing else: a password that is only just long enough gets
   *  one bar rather than a sentence about entropy. */
  function rail() {
    const bar = el('rail');
    if (bar.hidden) return;
    bar.dataset.at = String(strength(el('password').value));
  }

  el('modeIn').addEventListener('click', () => setMode(false));
  el('modeUp').addEventListener('click', () => setMode(true));
  el('swap').addEventListener('click', () => setPhone(!byPhone));
  el('password').addEventListener('input', rail);

  el('eye').addEventListener('click', () => {
    const field = el('password');
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    el('eye').textContent = show ? 'Hide' : 'Show';
    el('eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    field.focus();
  });

  if (by === 'phone') setPhone(true);
  else if (by === 'create') setMode(true);
  // A remembered address means the password is the only thing left to type.
  if (!byPhone && el('email').value) el('password').focus();

  /* ---- forgotten ---- */

  el('forgot').addEventListener('click', async () => {
    const address = session.cleanEmail(el('email').value);
    if (!address) return fail('Put your email in first.');
    if (owed()) return;
    const btn = el('forgot');
    btn.disabled = true;
    try {
      await session.sendReset(address);
      checkYourEmail(address, () => session.sendReset(address));
    } catch (e) {
      fail(e.message);
    }
    btn.disabled = false;
  });

  /* ---- in ---- */

  el('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    say('');
    if (byPhone) return submitPhone();

    const address = session.cleanEmail(el('email').value);
    const password = el('password').value;
    if (!address) return fail('Put your email in first.');
    if (password.length < MIN_PASSWORD) {
      return fail(`Passwords are at least ${MIN_PASSWORD} characters.`);
    }
    if (owed()) return;

    go.disabled = true;
    go.textContent = creating ? 'Creating' : 'Signing in';
    try {
      if (creating) {
        const { needsConfirmation } = await session.signUp(address, password);
        gate.pass(address);
        gate.remember(address);
        if (needsConfirmation) {
          go.disabled = false;
          go.textContent = label();
          el('password').value = '';
          rail();
          checkYourEmail(address, () => session.signUp(address, password));
          return;
        }
      } else {
        await session.signIn(address, password);
        gate.pass(address);
        gate.remember(address);
      }
      haptic('done');
      render(mount);
    } catch (e2) {
      // The address stays, the password goes: retyping the one you got right is
      // the thing that makes a wrong password twice as annoying as it is.
      el('password').value = '';
      rail();
      el('password').focus();
      go.disabled = false;
      go.textContent = label();
      fail(e2.message);
      const wait = gate.fail(address);
      if (wait > 0) hold(wait);
      else if (gate.triesLeft(address) <= 2) {
        say(`${readable(e2.message)} ${gate.triesLeft(address)} tries left.`);
      }
    }
  });

  async function submitPhone() {
    const number = el('phone').value.trim();
    if (!number) return fail('Put your number in first.');
    if (owed()) return;
    go.disabled = true;
    try {
      if (!codeSent) {
        go.textContent = 'Sending';
        await session.sendCode(number);
        codeSent = true;
        el('codeField').hidden = false;
        el('code').focus();
        go.disabled = false;
        go.textContent = label();
        return;
      }
      go.textContent = 'Signing in';
      await session.verifyCode(number, el('code').value.trim());
      gate.pass(number);
      haptic('done');
      render(mount);
    } catch (e2) {
      go.disabled = false;
      go.textContent = label();
      fail(e2.message);
      // A code is six digits, so this is the one worth counting hardest.
      if (codeSent) {
        const wait = gate.fail(number);
        if (wait > 0) hold(wait);
      }
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

/* ---------------- arriving ---------------- */

/** A moment on the way in, while the two copies settle themselves behind it.
 *  Shown once per sign-in, never on a launch that merely restored a session. */
function welcome(mount) {
  const name = session.emailOf();
  mount.innerHTML = `<div class="screen acc-hello">
    <span class="acc-hello-mark">${logoMark(52)}</span>
    <h1>Welcome back</h1>
    <p class="muted small">${escapeHtml(name)}</p>
  </div>`;

  // Long enough to be read. Reconciling an empty account takes no time at all,
  // and a greeting that flashes for eleven milliseconds is a flicker, not a
  // moment.
  const DWELL = 1200;
  const from = Date.now();

  (async () => {
    try {
      await sync.reconcile();
    } catch {
      /* the sheet or the next launch will settle it */
    }
    const rest = DWELL - (Date.now() - from);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
    if (!mount.isConnected || !mount.querySelector('.acc-hello')) return;
    if (store.syncState() === 'synced') return navigate('#/hub');
    signedIn(mount);
  })();
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

export function render(mount, { by } = {}) {
  if (!configured()) return unconfigured(mount);
  if (!session.available()) return unconfigured(mount);
  if (!session.signedIn()) return signedOut(mount, by);
  // Taking the flag is what clears it, so a greeting cannot repeat itself.
  return session.justArrived() ? welcome(mount) : signedIn(mount);
}
