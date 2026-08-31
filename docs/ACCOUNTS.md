# Turning the account on

Everything in the app is written. Nothing works until a Supabase project exists,
because the app has no server of its own and cannot make one for you.

This page is the whole of what you have to do. It is about twenty minutes for
email sign-in, another twenty for Google, and Apple is blocked on the $99
developer account.

Until you do any of it the app runs exactly as it does now, local only, and the
account screen says so rather than showing a form that cannot work.

---

## What is already built

| | |
|---|---|
| `www/js/account/config.js` | The two values you paste. The only file you edit. |
| `www/js/account/session.js` | Sign up, sign in, sign out, password reset, delete account. |
| `www/js/account/oauth.js` | Google and Apple, including the WebView dance the APK needs. |
| `www/js/account/sync.js` | Back up and restore the record. |
| `www/js/account/screen.js` | The screen, in all three states. |
| `supabase/schema.sql` | The table, the row-level security, the delete function. |
| `tools/patch-deeplink.mjs` | Registers the URL scheme so a provider sign-in can return. |
| `.github/workflows/supabase-keepalive.yml` | Stops a free project pausing itself. |

---

## 1. The project, and the two values

1. Sign up at supabase.com and create a project. **Pick an EU region**: the
   privacy policy says the data is held in the EU, and moving a project later
   means moving the data.
2. Open the SQL Editor, paste all of `supabase/schema.sql`, run it. It is safe
   to run twice.
3. Go to **Settings > API** and copy two things: the **Project URL** and the
   **publishable** key (the long one labelled public or anon, not the secret
   one).
4. Put them in `www/js/account/config.js`.

That is email sign-in working.

> **The secret key never goes in `www/`.** Everything under `www/` is shipped to
> the phone and readable by anyone who looks. The publishable key is meant to be
> public; row-level security is what protects the data, and `schema.sql` turns it
> on for every table.

## 2. Email, properly

The built-in mail sender allows **two emails an hour for the whole project**.
That is fine for testing yourself and useless in public: the third person to
sign up in an hour gets nothing.

Set up custom SMTP before anyone else uses it. Resend is free to 3,000 emails a
month and takes about ten minutes: create an account, verify a domain, then put
the SMTP host, port, user and password into **Authentication > Emails > SMTP
Settings**. The limit becomes 30 an hour and is adjustable from there.

The app uses a password rather than a magic link for exactly this reason. A link
sends an email on every single sign-in; a password sends one, at sign-up.

## 3. Google

Free, and about twenty minutes.

1. In the **Google Cloud Console**, create a project, then
   **APIs & Services > Credentials > Create credentials > OAuth client ID**.
2. Fill in the consent screen first if it asks. External, and your app's name.
3. Create a **Web application** client. Under *Authorised redirect URIs* add
   the callback Supabase shows you on its Google provider page, which looks like
   `https://<your-ref>.supabase.co/auth/v1/callback`.
4. Paste the client ID and client secret into Supabase,
   **Authentication > Providers > Google**, and enable it.
5. For the Android build you also need the app's **SHA-1** registered on an
   Android OAuth client. The committed debug key's is:

   ```
   14:FA:A5:7E:A9:84:6B:0F:EC:9C:C0:82:F0:A4:DB:92:87:46:B6:7B
   ```

   You will end up registering three over time: that debug key, your release
   upload key, and the key Google re-signs with under Play App Signing. Missing
   the third is why Google sign-in works in a sideloaded APK and fails for every
   user who installs from the store.

**Why the app opens a browser tab for this.** Google refuses to serve its
sign-in pages inside an embedded WebView and answers `403 disallowed_useragent`.
A Capacitor app is an embedded WebView. So the provider opens in a Custom Tab
and returns through `com.habitnemesis.app://auth`, with PKCE keeping the secret
half on the device. `tools/patch-deeplink.mjs` registers that scheme, and it
runs on every build because `android/` is regenerated each time and would throw
a hand-edited manifest away.

## 4. Apple

**Blocked until you pay the $99 a year.** Sign in with Apple needs a Services
ID and a signing key, and both live behind Certificates, Identifiers & Profiles,
which a free Apple account cannot open. The button is built and will work the
day the account exists.

One rule worth knowing before you get there: Apple's guideline 4.8 does not
name Sign in with Apple any more, it lists criteria, and Google Sign-In fails
the one about keeping the email private. Email and password on its own is
covered by the exception for your own account system. **So an iOS build with
email only owes Apple nothing. Adding the Google button is what obliges you to
add Apple's too.**

## 5. Do not let a free project pause itself

This is the one that catches people, and it is worth reading twice.

A free project is **paused after seven days of low database activity**, and only
a manual click in the dashboard brings it back. Between submitting a build and
having daily users, nobody touches the database. A reviewer opening a paused
app sees every sign-in fail, and rejects it.

Two ways out:

- **Pay the $25 a month before you submit.** Paid projects are never paused.
  This is the answer if the app is real.
- **Or run the keep-alive.** `.github/workflows/supabase-keepalive.yml` reads one
  row a day. Set the repository variable `SUPABASE_CONFIGURED` to `true` and the
  secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. GitHub disables
  scheduled workflows in a repo with no commits for 60 days, so this is a
  backstop, not a guarantee.

---

## What sync does, and what it does not

It is a **backup**, not a live merge, and that is on purpose.

The failure people actually have is a new phone, not two phones edited at the
same minute. A background merge that silently picks a winner can lose a day
nobody notices for weeks. So the app offers the newer copy and lets you choose,
once, instead of deciding for you every time.

Signing in on a device that has a record already asks before it replaces
anything. Restoring asks. Nothing is overwritten quietly.

A true per-cell merge needs a timestamp on every cell. `store.js` now stamps
every habit and group, which is the half that cannot be reconstructed after the
fact and is why it is already there. The rest is a milestone in
[`docs/RELEASE.md`](RELEASE.md).

## What the account holds

One row per user: your user id, the same record `Settings > Export backup`
writes, and when it was last written. Nothing else. It comes back in through
`store.js`'s `hydrate()`, the same sanitiser that reads a file you import, so a
row from a server is trusted exactly as much as a file from a stranger.

Three things never leave the device: your PIN's check blob, whether the app lock
is on, and when this device last backed up. They describe the phone, not the
record.
