# The handover prompt

Paste the block below into Claude Cowork on the machine that holds the repo and
the browser you are signed into. It does the accounts and dashboards this app
cannot do for itself.

Everything it needs to know is in `docs/ACCOUNTS.md` and `docs/STORE.md`. The
prompt points at them rather than repeating them, so it cannot go stale.

---

```
You have control of this computer. The job is to take Habit Nemesis from a
finished repository to a live listing on Google Play. All the code is written,
checked and pushed. What is missing is four accounts, eight values, and a
listing that only a person with a Play Console account can create.

REPO
The working copy is on this machine, a git clone of NiFoGR/Habit-Nemesis.
Find it before anything else. `docs/ACCOUNTS.md` and `docs/STORE.md` are the
runbooks; read both in full before you touch a browser. They are accurate and
current, and they are the source of truth. Where this prompt and a doc
disagree, the doc wins and you tell me.

ALREADY DONE. VERIFY, NEVER REDO.
Confirm each of these and change nothing. Creating a second Supabase project
would strand every account in the first, and cutting a second upload key would
make it a different app to Play forever.

- Supabase. The project exists, the schema is applied, and
  `www/js/account/config.js` holds the URL and the publishable key. Email
  sign-in works today.
- The release key. The keystore, its four GitHub secrets and the
  RELEASE_SIGNING variable are all set. The `aab` job runs and has produced a
  signed bundle.
- The keep-alive. It reads the project off `config.js` and needs no secret and
  no variable. It is green.
- Phone sign-in. Removed on purpose. Leave it removed and read step 8.
- GitHub Pages. Live, and the privacy policy resolves at
  https://nifogr.github.io/Habit-Nemesis/legal/privacy.html
- The store assets. `store/` holds the icon, the feature graphic and seven
  screenshots, all at Play's exact sizes. `npm run check:store` proves it.
- The listing copy. Title, short description and full description are written
  out in `docs/STORE.md` section 5, measured and within Play's limits.
- The division crest artwork. The photographs are a decision, recorded in
  `docs/ART.md` section 1. Do not raise it, do not replace them, do not suggest
  alternatives.

RULES, IN ORDER OF HOW BADLY THEY BREAK THINGS
1. The Supabase SECRET key never goes in `www/`. Only the publishable key.
   Everything under `www/` ships inside the APK and anyone can read it.
   `npm run check:release` fails the commit if you get this wrong; do not work
   around it, fix it.
2. Leave `TESTING = true` in `www/js/ads/config.js`. The release build flips it
   and only the release build. A debug APK serving real ads is click fraud and
   AdMob closes the account, not the build.
3. Do not widen where ads appear. The placement is deliberate and is written
   down in `docs/STORE.md`. Nothing on the grid, nothing on app open, nothing
   for the first three days.
4. Do not commit a keystore, a password, a token or a .env. The repo has one
   keystore, the debug one, on purpose.
5. Run `npm run check` before every commit and never push it red.
6. Never upload a bundle built from a dirty working copy. Push first, let CI
   build it, download that artifact.

WHERE YOU STOP AND HAND BACK TO ME
Drive the browser to the page, then stop and tell me what you need. Log in
yourself for none of these:
- Any sign-in, any two-factor prompt, any password.
- Any payment: the Play Console $25, Supabase $25 a month, Twilio credit.
- Identity verification. It wants a photo of my ID and that is mine to hand
  over, not yours.
- Choosing a company name or developer name shown to users. It is slow to
  change later.
- Anything that says "this cannot be undone" or "cannot be changed later".
Take a screenshot before and after each irreversible click.

THE ORDER

1. PLAY CONSOLE ACCOUNT.  docs/STORE.md section 1.
   Do this first and do not wait on anything else. Go to
   play.google.com/console, stop and let me sign in, choose a PERSONAL account,
   stop and let me pay the $25, then stop and let me do identity verification.
   Verification takes a day to a fortnight and blocks every step below it.
   Do not enter an address anywhere optional. Section 7 explains why.
   While it is pending, do steps 2 and 3, which need no Play account.

2. RECRUIT THE TESTERS.  docs/STORE.md section 6.
   Ask me for 15 Gmail addresses, not 12. Google requires 12 opted in
   continuously for 14 days, and since April 2026 it also rejects applications
   where the testers never opened the app. Some people will not follow through.
   Draft the message I will send them: what the app is, the opt-in link comes
   later, and that they need to actually open it a few times a week. Do not
   send it yourself.

3. ADMOB.  docs/STORE.md section 2.
   Sign up with the same Google account. Add app, Android, "not listed on a
   store yet", named Habit Nemesis. Copy the App ID, which has a tilde. Create
   a Banner unit named `browse-banner` and an Interstitial named `week-result`,
   both of which give ids with a slash. Put all three into
   `www/js/ads/config.js`. TESTING stays true.
   Then Privacy and messaging: create the European regulations message and turn
   Privacy options on, or users in the UK and EEA see no ads at all and the
   Settings row in the app has nothing to open.
   Commit as "The ads have an account", run `npm run check`, push.
   If AdMob is slow to approve, skip it. A bundle with no ad ids is ad-free and
   works; the ids can land in 1.0.1.

4. THE BUNDLE.
   Once identity verification clears. Do not build locally. Open the newest
   green run of "Build Android APK" on the branch, download the
   `habit-nemesis-aab` artifact, unzip it. That `.aab` is the upload. Tell me
   its versionCode and versionName before uploading; 1.0.0 is versionCode
   10000.

5. CREATE THE APP AND THE LISTING.  docs/STORE.md sections 5, 7, 8.
   In Play Console, Create app. Name "Habit Nemesis", English (UK), App, Free.
   Then fill the listing from section 5, which is the source. Copy it exactly,
   do not improve it, do not rewrite it, do not add keywords:
   - Title, short description and full description: the three blocks in
     section 5, verbatim.
   - App icon: `store/icon-512.png`
   - Feature graphic: `store/feature.png`
   - Phone screenshots: `store/01-arena.png` through `store/07-nemesis.png`,
     uploaded in that number order. The order is the point: the fixture leads,
     not the grid.
   - Category: Health & Fitness. Tags: habit tracker, self improvement.
   - Privacy policy URL:
     https://nifogr.github.io/Habit-Nemesis/legal/privacy.html
   Then App content:
   - Data safety: the answers are written out in section 8. They must match
     `www/legal/privacy.html` exactly. Do not invent an answer; if one is
     missing from the doc, stop and ask. Getting this wrong is one of the few
     things Play checks by hand.
   - Ads: yes, this app contains ads. Answer yes even if step 3 has not landed
     yet, because the SDK ships either way.
   - Content rating: fill the questionnaire honestly. It rates PEGI 3 and
     Everyone. No violence, no gambling, no user-generated content shared
     between users.
   - Target audience: 13 and over. Do not tick anything that makes it a
     children's app.
   - Countries: section 7. Deselect the 27 EU countries, keep the UK, the US,
     Canada, Australia and the rest. Ask me before changing this.

6. THE CLOSED TEST, WHICH STARTS THE CLOCK.  docs/STORE.md section 6.
   Testing, Closed testing, Create track. Upload the `.aab` from step 4.
   Create an email list with the addresses from step 2. Copy the opt-in link
   and give it to me to send. The 14 days start when the twelfth person opts
   in, not when the track was made, so tell me plainly that nothing counts
   until I send that link and they accept.
   This is the long pole. Everything below runs while it does.

7. GOOGLE SIGN-IN.  docs/ACCOUNTS.md section 3.
   Google Cloud Console, the redirect into Supabase, then the SHA-1 of the
   debug key, which is in that doc. A third SHA-1, the one Google re-signs with
   under Play App Signing, only exists after step 6 and has to be added then.
   Say so out loud when you get there, and remind me again after the upload.
   Verify: Google sign-in works in the browser build.

8. PHONE SIGN-IN.  ALREADY DECIDED: there is none.
   It was removed before 1.0. Do not enable Phone in Supabase, do not add Twilio
   credit, and do not put the tab back. docs/ACCOUNTS.md section 4 says what it
   would take if I ever change my mind, and I have not.

9. EMAIL THAT ACTUALLY SENDS.  docs/ACCOUNTS.md section 2.
   This is the one thing that will break a launch. Supabase's built-in sender
   allows TWO emails an hour for the whole project, shared by sign-ups, password
   resets and invites, so the 12 testers alone exhaust it on day one.
   There is no custom domain and there is not going to be one, so use Gmail SMTP
   with an app password: smtp.gmail.com, port 587, the app's own Gmail account.
   It sends genuinely from Google, so SPF and DKIM pass, which a third-party
   relay sending as a gmail.com address cannot do.
   Then raise the limit: Authentication > Rate Limits. Custom SMTP starts you at
   30 an hour whatever the provider allows.

10. PRODUCTION.
    On day 15, Dashboard, Apply for production access. Three sections to fill
    in. Google usually answers within 7 days and often rejects the first
    attempt, so do not treat one rejection as a disaster. Add the Play App
    Signing SHA-1 to the Google OAuth client from step 7.

WHEN YOU ARE DONE, OR WHEN YOU ARE BLOCKED
Write me one page: what is live, what each thing costs per month, what is still
switched off, what date the tester clock started and when it ends, and every
value you put somewhere that is not in the repo, named by where it lives rather
than by its value. Do not paste any secret into that summary or into the chat.

If anything in the runbooks turns out to be wrong or out of date, fix the doc in
the repo as part of the same commit. A runbook that lied once will lie again.
Two of them lied this month and both were caught late.
```
