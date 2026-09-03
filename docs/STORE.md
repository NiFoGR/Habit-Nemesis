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

**Text.** Two fields, both required.

- **Short description**, 80 characters. Lead with the Arena, not the grid.
  Something like: `Your week plays your best week. Win, and climb the ladder.`
- **Full description**, 4000 characters. First two lines are what shows before
  "read more", so put the Arena there too.

**Graphics.** All required before Play will let you publish.

| Asset | Size | Notes |
|---|---|---|
| App icon | 512 x 512 PNG | 32-bit, opaque, square corners |
| Feature graphic | 1024 x 500 PNG or JPEG | 24-bit, no transparency. Play crops the edges and overlays your icon, so keep everything important in the middle |
| Phone screenshots | 2 minimum, 8 maximum | JPEG or 24-bit PNG, no alpha. 16:9 or 9:16, each side between 320px and 3840px |

Take the screenshots from the app itself, not a mockup tool. Six is the number
worth having, and the order decides whether anyone installs:

1. The fixture card. Your week against your best week.
2. The ladder.
3. The grid.
4. The week's result.
5. The Cabinet.
6. The Year.

Every habit app leads with a grid. Leading with the fixture is the only reason
anyone picks this one.

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
- **Data types:** under **Device or other IDs**, tick **Device or other IDs**.
  That is the advertising identifier, and AdMob uses it. Tick nothing else. The
  habits, the marked days and the Arena's history never leave the phone.
- **Collected or shared:** shared.
- **Purpose:** Advertising or marketing.
- **Is it required?** No, optional. Users can decline consent.
- **Is data encrypted in transit?** Yes.
- **Can users request deletion?** Yes, and link the privacy policy.
- **Location, personal info, photos, health, messages, contacts:** all no.

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
