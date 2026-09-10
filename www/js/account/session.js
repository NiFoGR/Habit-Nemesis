// The account: who is signed in, and the four ways in and out.
//
// Optional by design. The app is local-first and works forever without one, so
// every export here answers safely when no project is configured and when the
// device is offline. Signing in adds a copy in the cloud and a second device;
// it is never a gate in front of the grid.

import { SUPABASE_URL, SUPABASE_KEY, configured, NATIVE_REDIRECT } from './config.js';
import { isNative } from '../native.js';

let client = null;
let current = null; // the session, or null
const listeners = new Set();

/** The vendored UMD bundle defines window.supabase. Absent means the script tag
 *  is gone from index.html, which is a build mistake rather than a state. */
function create() {
  if (!configured()) return null;
  const lib = window.supabase;
  if (!lib?.createClient) {
    console.warn('supabase-js did not load; the account is unavailable');
    return null;
  }
  return lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The APK has no page navigation to read a token off, and PKCE keeps the
      // verifier here so only the code travels through the deep link.
      detectSessionInUrl: !isNative(),
      flowType: 'pkce',
    },
  });
}

export function supabase() {
  if (client === null) client = create();
  return client;
}

export const available = () => !!supabase();
export const session = () => current;
export const user = () => current?.user || null;
export const signedIn = () => !!current;
export const emailOf = () => current?.user?.email || current?.user?.phone || '';

/** Called once at boot. Safe to call when no project is configured. */
export async function init() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession().catch(() => ({ data: {} }));
  current = data?.session || null;
  sb.auth.onAuthStateChange((_event, s) => {
    current = s;
    listeners.forEach((fn) => fn(current));
  });
  return current;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------------- arriving ---------------- */
// Set where a sign-in actually happens rather than read off the auth state,
// because onAuthStateChange also fires for the session a cold launch restored,
// and being greeted every time you open the app is not a greeting.

let arrived = false;
export const markArrived = () => { arrived = true; };
/** True once, then false. Reading it is taking it. */
export const justArrived = () => {
  const v = arrived;
  arrived = false;
  return v;
};

/* ---------------- email ---------------- */
// Password, not a magic link. A link emails on every sign-in and the project's
// mail allowance is small; a password emails once, at sign-up.

/** Addresses are compared as written by whoever typed them, so they are folded
 *  once here rather than at four call sites. */
export const cleanEmail = (v) => String(v || '').trim().toLowerCase();

/** Signing up never says whether the address was already taken.
 *
 *  Two different answers turn this form into a way of asking the app which of a
 *  list of addresses has an account here, which is worth having for anyone
 *  writing a phishing mail. Supabase hides it too when confirmations are on,
 *  and returns "already registered" when they are off, so this holds either
 *  way round: the screen says an email is on its way, whatever happened. */
export async function signUp(email, password) {
  const sb = need();
  const { data, error } = await sb.auth.signUp({ email: cleanEmail(email), password });
  if (error) {
    if (/already registered|already exists|user_already_exists/i.test(error.message)) {
      return { needsConfirmation: true };
    }
    throw error;
  }
  // No session back means the project asks for a confirmed address first.
  if (data.session) markArrived();
  return { needsConfirmation: !data.session };
}

export async function signIn(email, password) {
  const sb = need();
  const { error } = await sb.auth.signInWithPassword({ email: cleanEmail(email), password });
  if (error) throw error;
  markArrived();
}

/** Also silent about whether the address exists, which is Supabase's own
 *  behaviour and the reason the screen says the same thing either way. */
export async function sendReset(email) {
  const sb = need();
  const { error } = await sb.auth.resetPasswordForEmail(cleanEmail(email), { redirectTo: redirectTo() });
  if (error) throw error;
}

/* ---------------- phone ---------------- */
// A code, not a password. A number has no address to send a reset to, so the
// code is the whole of it: ask for one, then verify it.

export async function sendCode(phone) {
  const sb = need();
  const { error } = await sb.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyCode(phone, token) {
  const sb = need();
  const { error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  markArrived();
}

/** A signed-in user is named by whichever one they used. */
export const phoneOf = () => current?.user?.phone || '';

export async function signOut() {
  const sb = supabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  current = null;
  listeners.forEach((fn) => fn(null));
}

/** Where a provider or a reset link comes back to. */
export const redirectTo = () => (isNative() ? NATIVE_REDIRECT : location.origin + location.pathname);

function need() {
  const sb = supabase();
  if (!sb) throw new Error('No account service is configured for this build.');
  return sb;
}

/* ---------------- leaving ---------------- */

/** Erase the account and everything on the server, then sign out.
 *  Both stores require this to be reachable from inside the app. The row goes
 *  first: an auth user with no rows is recoverable, orphan rows are not. */
export async function deleteAccount() {
  const sb = need();
  const id = user()?.id;
  if (!id) throw new Error('You are not signed in.');
  const { error: rowError } = await sb.from('habit_state').delete().eq('user_id', id);
  if (rowError) throw rowError;
  // Deleting the auth user itself needs a privileged key, so it runs as a
  // database function that checks auth.uid() for itself. See supabase/schema.sql.
  const { error } = await sb.rpc('delete_own_account');
  if (error) throw error;
  await signOut();
}
