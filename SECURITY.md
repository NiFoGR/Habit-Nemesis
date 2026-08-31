# Security model

What protects what, what does not, and why the second list is deliberate.
Read this before adding anything that checks, licenses or verifies on the
device.

## The one rule

**Nothing on the device is trusted, including our own app.** A phone belongs
to its owner. Anyone can decompile the APK, edit the JavaScript in its assets,
re-sign it, and run the result. Tools like Lucky Patcher automate exactly that,
and no amount of obfuscation, packing or "tamper detection" changes it: every
client-side check ships alongside the code that can delete it. Vendors selling
unhackable clients are selling a slower week for the person patching.

So the app is built the other way round. Nothing valuable lives in the client,
and then there is nothing to crack:

| Thing someone might attack | Where it actually lives | What a patched client gets |
|---|---|---|
| Another user's record | Postgres behind Row Level Security keyed to `auth.uid()` | Their own row and nothing else. The policy runs on the server. |
| Account identity | Supabase Auth. Tokens are issued server-side | Nothing. A patched client cannot mint a token. |
| Account deletion | A definer function that reads `auth.uid()` itself | It can only delete the caller. |
| The paid tier, when it exists | **Server-side entitlement, verified against the store** | This is the Lucky Patcher answer, below. |
| The user's own record | Their phone. It is theirs | Their own data. Editing your own habit tracker is not an attack. |

## The Lucky Patcher answer

What those tools actually do is patch the in-app-purchase check inside the
APK so `isPurchased()` returns true. That works on any app that asks itself
whether the user paid.

The defence is that the app never asks itself. When the paid tier is built:

1. The purchase receipt is verified **server-side** against Google and Apple
   (RevenueCat does this, or the Play Developer API directly).
2. The entitlement is a row the server writes, and anything the entitlement
   unlocks that matters, sync above all, is **served**, not switched on
   locally. A patched client can flip its own cosmetics; it cannot make the
   server store its data or answer its requests.
3. Never gate with a local boolean the server did not issue. A flag in
   localStorage is a request to be patched.

Play Integrity and Play App Signing are the platform's own tamper tools and
come with the store account. Use them when the listing exists. Do not add
root detection or client-side integrity checks beyond that: they punish
legitimate users, they are stripped in minutes, and they create the false
belief that the client can be trusted.

## What a shipped build must be

- **Release builds only.** A debug APK is debuggable: anyone with the phone
  can attach an inspector and read or rewrite the record live. The committed
  key in `signing/` is Android's public debug key, exists so sideloaded
  updates install over each other, and signs `assembleDebug` and nothing
  else. Store builds go through `npm run android:aab`, which signs with the
  release key from the environment and refuses to run without it.
  `tools/patch-release-signing.mjs` also refuses the debug alias and a config
  that forces WebView debugging on.
- **The CSP stays strict.** `script-src 'self'`, no inline script, no eval,
  and `connect-src` names the one host the app may talk to. This is why a
  stored-XSS attempt in the record cannot execute even if a rendering bug
  slips through.
- **Everything read is sanitised.** `hydrate()` in `www/js/store.js` is the
  trust boundary. A backup file, a synced row and localStorage itself all come
  through it: every value coerced to type and range, ids matched to closed
  patterns, colours to a closed set, the face image only as strict base64
  JPEG. A synced row is trusted exactly as much as a file from a stranger.
- **No secrets in `www/`.** Everything under it ships to every phone. The
  Supabase publishable key is public by design; the secret key, the release
  keystore and its passwords exist only as CI secrets.

## Reporting

Found something anyway? Email the address in `www/legal/publisher.js` and
give us a fortnight before publishing. No bounty yet, credit gladly given.
