// Google and Apple, which are harder than they look inside a WebView.
//
// Google refuses to serve its own sign-in pages to an embedded WebView and
// answers 403 disallowed_useragent. A Capacitor app is an embedded WebView, so
// calling signInWithOAuth in the page cannot work on the APK. The provider
// opens in a Custom Tab instead and returns through the app's own URL scheme,
// carrying only the authorisation code; PKCE keeps the verifier on the device.
//
// In a browser none of that applies and a plain redirect is right.

import { supabase, redirectTo } from './session.js';
import { isNative } from '../native.js';

const plugin = (name) => window.Capacitor?.Plugins?.[name];

/** Start a provider sign-in. Resolves when the flow has been handed off, not
 *  when it has succeeded: the session arrives through onAuthStateChange. */
export async function signInWith(provider) {
  const sb = supabase();
  if (!sb) throw new Error('No account service is configured for this build.');

  if (!isNative()) {
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (error) throw error;
    return;
  }

  const browser = plugin('Browser');
  if (!browser) throw new Error('This build cannot open a browser for sign-in.');

  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo(), skipBrowserRedirect: true },
  });
  if (error) throw error;
  await browser.open({ url: data.url, presentationStyle: 'popover' });
}

/** The other half: the deep link coming back. Armed once, at boot. */
export function listenForReturn() {
  const app = plugin('App');
  if (!app || !isNative()) return;
  app.addListener('appUrlOpen', async ({ url }) => {
    const sb = supabase();
    // Only our own auth callback. Anything else through the scheme is ignored,
    // and a malformed URL must not throw inside the listener.
    if (!sb || typeof url !== 'string' || !url.startsWith(redirectTo())) return;
    let code = null;
    try {
      code = new URL(url).searchParams.get('code');
    } catch {
      return;
    }
    if (!code) return;
    plugin('Browser')?.close?.();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) console.warn('sign-in did not complete', error.message);
  });
}
