# Getting it on Google Play

Everything left that is not code. Written for somebody who has never shipped an
app, so it says which button, not just which task.

Work top to bottom. Steps 1 and 2 are waiting time and should start today.
Everything after them can be done while they run.

---

## 1. The Play Console account

**Do this first. Step 6 cannot start until 14 days after it.**

1. Go to <https://play.google.com/console> and sign in with the Google account
   you want to own the app forever. Not a throwaway.
2. Choose a **personal** account. Pay the **$25**, once, for life.
3. Fill in the developer name. This is what users see under the app title, and
   changing it later is slow.
4. Google will ask you to verify your identity with a photo ID. It takes
   anywhere from a day to a fortnight, and nothing else can proceed until it
   clears.

**Do not enter an address anywhere optional.** See step 7.

## 2. The AdMob account and the two ad units

You need this before the ads in the app do anything.

1. Go to <https://admob.google.com> and sign up with the same Google account.
2. **Apps** > **Add app** > Android > "No, it is not listed on a store yet"
   (you can link it to Play later). Name it Habit Nemesis.
3. Copy the **App ID**. It looks like `ca-app-pub-1234567890123456~1234567890`,
   with a **tilde**.
4. **Ad units** > **Add ad unit** > **Banner**. Name it `browse-banner`. Copy
   the id, which looks like `ca-app-pub-1234567890123456/1234567890`, with a
   **slash**.
5. **Add ad unit** > **Interstitial**. Name it `week-result`. Copy that id too.
6. Paste all three into `www/js/ads/config.js`:

   ```js
   export const APP_ID = 'ca-app-pub-...~...';
   export const BANNER_ID = 'ca-app-pub-.../...';
   export const INTERSTITIAL_ID = 'ca-app-pub-.../...';
   ```

   Leave `TESTING = true`. The release build flips it, and only the release
   build. A debug APK serving real ads is click fraud, and AdMob answers that by
   closing the account rather than the build.

7. **Privacy and messaging** > **European regulations** > **Create message**.
   Pick your app, accept the defaults, publish it. This is the consent form the
   app shows, and without it users in the UK and the EEA see no ads at all.
8. Same screen, turn on **Privacy options** so the "Ad privacy choices" button
   in the app's Settings has a form to open.

The app is already written against all of this. Once the three ids are in that
file there is nothing else to do in the code.

### What ads actually do in the app

| Where | What |
|---|---|
| Cabinet, Feats, Year, Divisions, Archive, a habit's history | one banner at the foot |
| Leaving the week's result screen | one full-screen ad, once a week |
| Everywhere else | nothing |
| First three days after install | nothing at all |

Do not widen this. A habit tracker's session is fifteen seconds and an ad in
front of marking a day is the end of the app.

## 3. The four secrets and the switch

The release key exists and is not in the repo. See `signing/README.md` for the
fingerprint. Put the keystore file and its password in a password manager, then
in GitHub: **Settings** > **Secrets and variables** > **Actions**.

Under **Secrets**, four:

    RELEASE_KEYSTORE_B64        the keystore file, base64 encoded
    RELEASE_KEYSTORE_PASSWORD   the password
    RELEASE_KEY_ALIAS           habitnemesis-upload
    RELEASE_KEY_PASSWORD        the same password again

PKCS12 holds one password for the store and the key inside it, so the last two
being identical is correct.

Under **Variables**, one:

    RELEASE_SIGNING             true

Until that variable is set the AAB job never runs, which is why no store bundle
has ever been built. Set it, push, and the workflow produces
`habit-nemesis-*.aab` as an artifact. That file is what you upload.

## 4. The app icon

Play needs a **512 x 512 PNG, 32-bit, no transparency, no rounded corners**.
You do not have to make that yourself:

    cp your-icon.png art/source/mark.png
    npm run icons

Upload the `store/icon-512.png` it writes. The tool trims the padding off your
export and squares the corners, because Play rounds its own and a pre-rounded
icon comes out rounded twice with a pale seam in the gap.

Without that file the icons fall back to a polygon drawn in
`www/js/icons.js`, which is a reconstruction rather than the artwork.
`docs/ART.md` section 5 has the detail.

## 5. The listing

This section is the source. The Play Console is a copy of it, never the other
way round. HabitNow is the app to out-rank, and its short description is four
keyword phrases in one line, so the title carries the keyword and the short
description carries the one line the app is sold on.

**Title.** 30 characters, keyword in the searchable half.

    Habit Nemesis: Habit Tracker

**Short description.** Under 80 characters. Trim from the end to fit, and keep
the first clause whole.

    Your only opponent is the best week you have ever had. Habit tracker, no subscription.

**Full description.** 4000 characters. The first two lines show before "read
more", so the Arena goes there. Say `No subscription, ever.` once, near the
price. Name the timer: HabitNow charges for its equivalent.

**Graphics.** All required before Play will let you publish.

| Asset | Size | Notes |
|---|---|---|
| App icon | 512 x 512 PNG | 32-bit, opaque, square corners. `npm run icons` writes it to `store/` |
| Feature graphic | 1024 x 500 PNG or JPEG | The mark, the cut, black ground, the one line. Play crops the edges and overlays the icon, so nothing important near them |
| Phone screenshots | 2 minimum, 8 maximum | JPEG or 24-bit PNG, no alpha. 16:9 or 9:16, each side between 320px and 3840px |

Take the screenshots from the app itself, not a mockup tool. Seven, in this
order. The first two are the only ones most people see.

| | Screen | Caption |
|---|---|---|
| 1 | The Arena fixture. You versus your Nemesis, two numbers, the crest | The week is a match. You play your own best week. |
| 2 | The grid, filled, red on black | Every commitment, one screen, one tap. |
| 3 | The ladder | Nine divisions. Promotion, relegation, and a cup every quarter. |
| 4 | The Cabinet | Cups, feats and the years behind you. |
| 5 | A habit in full | Score, streaks and a calendar you can correct. |
| 6 | The widgets | The match, on your home screen. |
| 7 | The price | Free. One payment to remove ads. No subscription, ever. |

Every habit app leads with a grid. Leading with the fixture is the only reason
anyone picks this one.

**The one line.** `Your only opponent is the best week you have ever had.` It
goes on the first onboarding page, in the short description, and on the first
screenshot. Nowhere else. It stops working if it is everywhere.

**Category:** Health & Fitness. **Tags:** habit tracker, self improvement.

## 6. The 12 testers

**This is the one that takes a fortnight and cannot be hurried.**

A personal Play Console account opened after November 2023 cannot publish to
production until it has run a closed test with **12 testers opted in
continuously for 14 days**. Since April 2026 Google also rejects applications
where the testers never actually opened the app, so 12 names on a list is not
enough.

1. In Play Console: **Testing** > **Closed testing** > **Create track**.
2. Upload the AAB from step 3.
3. **Testers** > **Create email list**. Add 12 Gmail addresses. They must be
   Gmail or Google Workspace addresses, and they must be the address on that
   person's phone.
4. Copy the opt-in link and send it to all 12. Each has to open it and press
   **Become a tester**, then install from Play.
5. The 14 days start when the twelfth person opts in, not when you created the
   track. Anyone who opts out resets nothing but reduces the count below 12,
   which pauses the clock.
6. Ask them to open the app a few times a week. Tell them what it is for.
7. After 14 days, **Dashboard** > **Apply for production access**. Three
   sections to fill in. Google usually answers within 7 days.

Recruit the 12 before you need them. Friends and family count. This is the
single most underestimated delay in shipping to Android.

## 7. Countries, and why the EU is off

`www/legal/publisher.js` has no address in it, deliberately. Under the EU
Digital Services Act, anybody monetising an app in the EU has to declare trader
status and publish a name, address, email and phone. Play Console asks for it as
a required form field before it will list the app in the EU, ads included. An
individual filling that in publishes their home address.

So: **Countries and regions** > deselect the 27 EU countries. Keep the UK, the
US, Canada, Australia, and everywhere else. Nothing else changes.

The UK is not in the EU and needs no address. Google's consent requirement for
ads still covers the UK, which is why step 2 sets up the consent message anyway.

To sell into the EU later, buy a registered office or mail-forwarding address
for about £30 a year, put it in `publisher.js`, and switch the countries back
on. The legal pages already have the sentences for it and turn them on by
themselves when the field is filled.

## 8. Data safety, and the answers that match the app

**Policy** > **App content** > **Data safety**. Your answers have to agree with
`www/legal/privacy.html`, and Play checks. These are the correct ones for what
actually ships.

- **Does your app collect or share any required user data?** Yes.
- **Data types**, four:
  - **Personal info > Email address.** Collected, not shared. Purpose: account
    management. Optional: the app works without an account.
  - **Personal info > Phone number.** Collected, not shared. Purpose: account
    management. Optional, and only for the sign-in route that sends a code by
    text message. Declaring it is not optional once phone sign-in ships: Play
    checks the answers against `www/legal/privacy.html`, which names it.
  - **App activity > Other user-generated content.** Collected, not shared.
    Purpose: app functionality. That is the record, one JSON document, held in
    the user's account so a new phone can receive it. Optional.
  - **Device or other IDs.** Shared. Purpose: advertising or marketing. That is
    the advertising identifier, and AdMob uses it. Optional: users can decline
    consent.
- **Photos:** no. The face photo is part of the record document above and is
  never processed as a photo; declare it under app activity, not photos.
- **Is data encrypted in transit?** Yes.
- **Can users request deletion?** Yes. In the app under Settings, Account,
  Delete account, which runs `delete_own_account()` and removes the row and
  the auth user together. Link the privacy policy, section 11.
- **Location, health, messages, contacts:** all no.

The email address and the record are only collected in a build with
`www/js/account/config.js` filled. A build with it empty has no account and
declares the advertising identifier alone.

Then **App content** > **Ads** > "Yes, my app contains ads". Forgetting this is
a common rejection.

**Content rating:** fill the questionnaire honestly. This app rates PEGI 3 /
Everyone. It has no violence, no gambling and no user-generated content.

**Target audience:** 13 and over. Do not tick anything that makes it a children's
app, or the whole Families policy lands on you.

**Privacy policy URL:** the app publishes its own pages through GitHub Pages, so
`https://nifogr.github.io/Habit-Nemesis/legal/privacy.html`.

## 9. The order

| When | What |
|---|---|
| Today | Steps 1 and 2. Both are waiting time |
| Today | Recruit 12 testers. Ask more than 12, some will not follow through |
| Once identity clears | Step 3, then push and download the first AAB |
| Same day | Step 6, closed track up, opt-in link out. The 14 days start now |
| While it runs | Steps 4, 5, 7, 8 |
| Day 15 | Apply for production access |
| Day 15 to 22 | Google reviews. Budget one rejection, everybody gets one |

## 10. What it costs

| | |
|---|---|
| Play Console | £20, once |
| AdMob | free |
| Domain | not needed, GitHub Pages hosts the legal pages |
| Business address | £0 with the EU off, about £30 a year to switch it on |
| **Total to the first listing** | **about £20** |

---

## What is not in this document

**iOS.** Needs a Mac, £79 a year, and its own set of the above. One store at a
time.

**A paid tier.** There is no billing in the app and no entitlement to sell.
`docs/RELEASE.md` has the arithmetic on whether it is worth building.

**Accounts and sync.** The code is written and Supabase is unconfigured, so v1
ships local-only and the account row is hidden. Two strings in
`www/js/account/config.js` turn it on when there is a project to point at.
