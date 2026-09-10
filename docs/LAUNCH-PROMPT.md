# The handover prompt

Paste the block below into Claude Cowork on the machine that holds the repo and
the browser you are signed into. It does the accounts and dashboards this app
cannot do for itself.

Everything it needs to know is in `docs/ACCOUNTS.md` and `docs/STORE.md`. The
prompt points at them rather than repeating them, so it cannot go stale.

---

```
You have control of this computer. The job is to take Habit Nemesis from
"finished code" to "live on Google Play". The code is done. What is missing is
accounts, dashboards and eight values pasted into two files.

REPO
The working copy is on this machine, a git clone of NiFoGR/Habit-Nemesis.
Find it before anything else. `docs/ACCOUNTS.md` and `docs/STORE.md` are the
runbooks; read both in full before you touch a browser. They are accurate and
current, and they are the source of truth. Where this prompt and a doc disagree,
the doc wins and you tell me.

RULES, IN ORDER OF HOW BADLY THEY BREAK THINGS
1. The Supabase SECRET key never goes in `www/`. Only the publishable key,
   the one labelled public or anon. Everything under `www/` ships inside the
   APK and anyone can read it. `npm run check:release` fails the commit if you
   get this wrong; do not work around it, fix it.
2. Leave `TESTING = true` in `www/js/ads/config.js`. The release build flips it
   and only the release build. A debug APK serving real ads is click fraud and
   AdMob closes the account, not the build.
3. Do not widen where ads appear. The placement is deliberate and is written
   down in `docs/STORE.md`. Nothing on the grid, nothing on app open, nothing
   for the first three days.
4. Do not commit a keystore, a password, a token or a .env. The repo has one
   keystore, the debug one, on purpose.
5. Run `npm run check` before every commit and never push it red.

WHERE YOU STOP AND HAND BACK TO ME
Log in yourself for none of these. Drive the browser to the page, then stop and
tell me what you need:
- Any sign-in, any two-factor prompt, any password.
- Any payment: the Play Console $25, Supabase $25 a month, Twilio credit.
- Choosing a domain for email, or a company name shown to users.
- Anything that says "this cannot be undone" or "this cannot be changed later".
Take a screenshot before and after each irreversible click.

THE ORDER
Work these in order and report after each one. Do not skip ahead: later steps
need ids from earlier ones.

1. SUPABASE, and the two values.  docs/ACCOUNTS.md section 1.
   Create the project in an EU region, this is not optional, the privacy policy
   says the data is in the EU. Run all of `supabase/schema.sql` in the SQL
   editor. Put the Project URL and the publishable key into
   `www/js/account/config.js`. Commit that file on its own with the message
   "The account has a project".
   Verify: `npm run dev`, open the app, the introduction now has a Sign in page
   that it did not have before. Create an account, sign out, sign back in.

2. EMAIL THAT ACTUALLY SENDS.  docs/ACCOUNTS.md section 2.
   The built-in sender allows two emails an hour for the whole project. Set up
   custom SMTP before anyone but me uses it. Stop and ask me for the domain.

3. GOOGLE SIGN-IN.  docs/ACCOUNTS.md section 3.
   Google Cloud Console, then the redirect into Supabase, then the SHA-1 of the
   debug key, which is in that doc. Note out loud that a third SHA-1, the one
   Google re-signs with under Play App Signing, has to be added after the first
   upload, and remind me at step 8.
   Verify: Google sign-in works in the browser build.

4. PHONE SIGN-IN.  docs/ACCOUNTS.md section 4.
   This is the one with a running bill per person. Read the fraud section before
   you turn anything on, set the rate limit and the country allow list in the
   same sitting, and stop and ask me before adding Twilio credit.
   If I say no to phone, follow the "If you would rather not" paragraph in that
   section exactly, and let `npm run check:release` prove you got all of it.

5. ADMOB.  docs/STORE.md section 2.
   The app, then a Banner unit named browse-banner, then an Interstitial named
   week-result. Three ids into `www/js/ads/config.js`. TESTING stays true.
   Then Privacy and messaging: create the European regulations message and turn
   Privacy options on, or users in the UK and EEA see no ads at all and the
   Settings row has nothing to open.
   Commit as "The ads have an account".

6. THE RELEASE KEY AND THE FOUR SECRETS.  docs/STORE.md section 3.
   The keystore must not enter the repo. Base64 it, put it and the three
   passwords into GitHub Actions secrets, set the RELEASE_SIGNING variable to
   true. Then push and confirm the aab job runs and produces a bundle.

7. THE KEEP-ALIVE.  docs/ACCOUNTS.md section 6.
   A free Supabase project pauses after seven days of no traffic, and a
   reviewer opening a paused app sees every sign-in fail and rejects it. Either
   set the three repository values for the keep-alive workflow, or tell me to
   pay the $25 a month. Say which you did.

8. PLAY CONSOLE.  docs/STORE.md sections 1, 4, 5, 6, 7, 8.
   The listing, the icon, the 12 testers, the countries, and Data safety. The
   Data safety answers are written out in section 8 and they must match
   `www/legal/privacy.html` exactly, including the phone number if step 4 went
   ahead. Do not invent an answer; if one is missing from the doc, stop and ask.
   After the first upload, add the Play App Signing SHA-1 to the Google OAuth
   client from step 3.

WHEN YOU ARE DONE
Write me one page: what is live, what each thing costs per month, what is still
switched off, and every value you put somewhere that is not in the repo, named
by where it lives rather than by its value. Do not paste any secret into that
summary or into the chat.

If anything in the runbooks turns out to be wrong or out of date, fix the doc in
the repo as part of the same commit. A runbook that lied once will lie again.
```
