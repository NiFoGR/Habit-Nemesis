# The road to a release

From what is in the tree today to a paid app on two stores. Written as
decisions and milestones rather than a wish list, because most of what is left
is not code.

Dates assume one person working evenings and weekends. Full time, halve them.

---

## Where it stands today

The app works. The grid, the Arena, the Cabinet, the feats, the year, the
share card, the PIN, the backup, offline, and a real Android build.

Since this page was first written, most of the code on it has been done:
`updatedAt` on every record, the account and sync layer, the legal set, the
release key, the AAB job, ads with consent, working reminders, and a stamped
version. What is left is mostly not code. It is an icon, a Play account, twelve
people, and a listing.

`docs/STORE.md` is the step-by-step for all of that. This page is the reasoning
behind it and the plan past launch.

---

## The blockers

In the order they will hurt.

### 1. There is no app mark

Deliberately. It is a dashed square in `www/js/icons.js` and
`tools/gen-icons.mjs`, and it looks unfinished on purpose so it cannot be
shipped by accident. Play wants 512 x 512, opaque, square corners. `docs/ART.md`
section 5 has the prompt and what to do with the result.

**This is the only thing standing between the current tree and an upload.**

### 2. Nobody has tested it but you

Google requires a new personal Play Console account to run a closed test with
**12 testers opted in continuously for 14 days** before it will grant
production access. Not 12 sign-ups: 12 people who stay opted in for a
fortnight, and since April 2026 people who actually open the app. This is the
single most underestimated delay in shipping to Android and it costs nothing to
start early. Get the closed track running the week the Play account exists.

### 3. The division artwork is other people's

`www/img/rank-*.webp` carry likenesses of real, identifiable people, at least
one deceased. Two divisions are named after real people as well. On a phone you
sideloaded yourself that is nobody's business. On a store listing it is
copyright, personality rights, and a store policy that acts on complaints faster
than it acts on appeals.

**Kept on purpose, at the owner's decision.** Recorded here because it is the
one risk on this page that arrives as a takedown rather than a rejection, and
because a takedown lands on the whole listing, not on one file. Replacing the
set is nine crests, three cups and the share grounds; `docs/ART.md` says what
each has to say and the prompts that produce them.

### 4. There is no way to take money

Ads ship. Beyond them there is no billing, no entitlement and no paywall.
Milestone 3, and it needs accounts first.

### 5. Trader status, and why the EU is off

Under the EU Digital Services Act, anyone monetising in the EU has to declare
trader status and publish a name, address, email and phone. Play Console asks
for it as a required field, so an individual either publishes their home address
or does not list in the EU.

**Settled for now: no address, and the 27 EU countries stay off.** The legal
pages read correctly without one and turn the address sentences back on by
themselves when `www/legal/publisher.js` is filled. A registered office is about
£30 a year whenever the EU is worth having.

---

## Milestone 0: the decisions you cannot take back

One evening. Everything after this depends on them, and each is expensive to
change once a store has it.

| Decision | Where it is now | Why it is permanent |
|---|---|---|
| Package name | `com.habitnemesis.app` | Play never lets you change it. A new one is a new app with zero installs and zero reviews. |
| Storage key | `habitnemesis.state.v1` | Changing it orphans every existing install's record. |
| Display name | Habit Nemesis | Changeable, but it is the search term you spend a year building. |
| Publisher | sole trader, no address | Set in `www/legal/publisher.js`. Changing the developer name on a live listing is slow and loses the reviews. |
| Free vs paid line | free with ads | See milestone 3. Moving something from free to paid after launch is the fastest way to a one-star review pile. |

All four are set in the tree. Leave them.

---

## Milestone 1: make it shippable

Mostly done. What is left is the icon and the console work.

- **The icon.** Blocker 1, and the only code-adjacent thing outstanding.
  `docs/ART.md` section 5.
- ~~A company or an address.~~ Settled: no address, EU off. Blocker 5.
- ~~The legal pages.~~ `www/legal/` has privacy, terms, wellbeing and licences,
  each written against the code rather than a template, and published through
  GitHub Pages so the URLs Play asks for already exist. No domain needed.
- ~~`updatedAt` on every record.~~ Done, and stamped on every write. Sync needs
  it to tell two versions of a day apart, and it could not have been added
  after other people had installs.
- **Screenshots and a listing.** Six, plus the text. The Arena is the thing
  nothing else has: lead with the fixture card and the ladder, not with a grid,
  because every habit app screenshot is a grid. `docs/STORE.md` step 5.

---

## Milestone 2: accounts and sync

**Built, and switched off.** `www/js/account/` has email, Google and Apple
sign-in, the sync layer and account deletion. `supabase/schema.sql` has the
tables with row-level security on every one.

What is missing is a Supabase project. `SUPABASE_URL` and `SUPABASE_KEY` in
`www/js/account/config.js` are empty, so the app runs local-only and the account
row is hidden rather than offered as a dead end. Two strings turn it on.

V1 ships without it. The simplest launch has no server to run, no password
resets at midnight and no Data Safety answers about a database. Turn it on when
there is a reason to.

### Keep local-first

The app's claim is that your record never leaves the phone, and that is a
feature, not an accident. Do not trade it for sync. **The account stays
optional.** The app works forever without one; signing in adds a copy in the
cloud and a second device. Say exactly that on the sign-in screen, and the
people who came for the privacy stay.

### The shape of it

The store is one JSON blob today, which does not sync. Split it into three
things that do:

| Table | Conflict rule | Why |
|---|---|---|
| `habits` and `groups` | last write wins per record, with tombstones for deletes | Metadata. Two devices editing one habit's colour is rare and losing one edit is survivable. |
| `entries` | last write wins per `(habitId, dayKey)` cell | Each cell is one scalar written by one person. Per-cell, this is conflict-free in practice: two phones editing the same day of the same habit in the same minute is the only losing case. |
| `arena.weeks` / `months` / `arcs` | first write wins, then immutable | A closed week is a historical fact. Nothing may rewrite a match that was already played, which is the rule the Arena is built on. |

That is deliberately not a CRDT library. Per-cell last-write-wins over a map of
scalars is the boring answer, and the boring answer is right here.

### What to build it on

**Supabase.** Postgres, row-level security, auth, an EU region, a free tier
that covers the first few thousand users, and $25 a month after. The data is
SQL you can export and leave with, which Firebase's is not. A hand-written API
on a small box is also fine and is more work than it looks once you are doing
password resets at midnight.

### What the stores demand the moment accounts exist

- **Sign in with Apple**, if you offer any other third-party sign-in. Not
  optional, and rejections for it are common.
- **Account deletion inside the app**, on both stores, plus a web route Google
  can link to. Deletion means deletion, not deactivation.
- **Privacy labels** on both, a `PrivacyInfo.xcprivacy` manifest on iOS, and
  Google's Data Safety form. All three must agree with each other and with your
  privacy policy.
- **GDPR.** A lawful basis, an export, a delete, and a processor agreement with
  whoever holds the database. The export already exists in Settings, which is
  most of the work done.

---

## Milestone 3: money

Two to three weeks once accounts exist.

### The honest arithmetic first

A habit tracker's session is fifteen seconds, one to three times a day. That is
the whole business model in one sentence, and it is why ads are a floor rather
than a plan:

| At this size | Ads, roughly | Subscriptions, roughly |
|---|---|---|
| 1,000 daily users | £120 to £200 a month | £30 to £60 a month |
| 10,000 daily users | £1,200 to £2,000 a month | £300 to £600 a month |
| 50,000 daily users | £6,000 to £10,000 a month | £1,500 to £3,000 a month |

Ads assume three impressions per user per day at a blended £1.50 to £2.50
eCPM, which is realistic for a short-session utility and nothing like the
figures quoted for games. Subscriptions assume 2% of monthly users converting
at about £20 a year net of the store's cut, which is a normal rate for this
category and a good one for a first app.

Two things follow. Ads earn more than subscriptions at every size, which is not
what most people expect. And **neither is a job until roughly 50,000 daily
users**, which is a real number of people and takes years or money to reach.
Plan for a side income that grows, and be pleased if it is wrong.

The one exception worth chasing: a **lifetime unlock**. Habit trackers sell
them unusually well, because the promise is "this holds my record forever" and
a subscription contradicts it. Streaks charges once. HabitKit charges once. A
£29.99 lifetime converts a slice of people who will never take a subscription,
and it costs nothing to offer beside one.

### The rule that is not negotiable

**Never sell the record.** No paying to restore a broken streak, no watching an
ad to fix a missed day, no buying a division. The app is worth something only
because the number on it is true, and every one of those mechanics is a
business selling you a lie about your own life. It is also the only thing this
app has that its competitors do not, so protecting it is commercial sense as
well as principle.

### Where the ads go

**Built.** `www/js/ads/program.js` enforces every rule below, and the router
decides the banner, so a screen not on the list cannot get one by accident. Ads
stay off until `www/js/ads/config.js` has an AdMob account in it.

Not in the daily ritual. An interstitial between opening the app and marking a
habit would be the end of it: the entire value is that marking takes eight
seconds, and an ad triples that.

- **Yes:** a single banner or native unit at the foot of the browsing screens.
  The Cabinet, the Year, the archive, a habit's own history. Screens people
  scroll rather than screens people transact on.
- **Yes, once a week:** one interstitial on the Monday result screen, which is
  a natural pause where you have just been told something. One a week, never
  two.
- **No:** anything on the grid, anything on app open, anything rewarded, and
  anything at all for the first three days after install, because the habit of
  opening the app is not formed yet and that is the only window that matters.

On the technical side, AdMob has required a Google-certified consent platform
for EEA and UK traffic since January 2024, and personalised ads on iOS need
Apple's tracking prompt. Google's own UMP handles the first and the app calls
it before any ad code runs, with the re-open Google requires in Settings. Expect
most users to decline the second and price the model on non-personalised rates.

### The free and paid line

Free has to be a real app or nobody stays long enough to pay. Paywall depth and
convenience, never the core loop.

| Free | Pro |
|---|---|
| Unlimited habits, the whole grid | Sync and a second device |
| The Arena: weeks, fixtures, divisions | The full year and full history |
| Feats, cups, the Cabinet | Themes, icon colours, widgets |
| Export and CSV | The share card without a watermark |
| The PIN | No ads |

The Arena stays free. It is the reason to choose this app over the twenty
others, and hiding it means nobody ever finds out it is there.

Price it at about £2.99 a month, £19.99 a year, £29.99 once. Annual is the one
to push; lifetime is the one that converts the people who would otherwise never
pay.

### What the stores take

- **Apple:** $99 a year, and 30% falling to **15%** through the Small Business
  Program while you earn under $1M a year. Enrol on day one. It is a form.
- **Google:** $25 once, and since 30 June 2026 in the US, UK and EEA a **10%
  service fee** on the first $1M plus a **5% billing fee** if you use Google's
  billing. 15% all in, the same as before, but only 10% if you take payment
  elsewhere.
- **Ads are not in-app purchases.** Neither store takes a cut of them.

Use RevenueCat rather than writing receipt validation twice. Free under
$2,500 a month of tracked revenue, and it is the difference between a week of
work and an afternoon.

---

## Milestone 4: the two stores

Three to four weeks of wall clock, much of it waiting.

### Android

The pipeline is built. `.github/workflows/android-apk.yml` has an `aab` job that
runs `bundleRelease` against the real upload key, stamps the version, and turns
the ad units live. It is gated on the repository variable `RELEASE_SIGNING`, so
it has never run.

- ~~A real upload key.~~ Cut on 31 August 2026. `signing/README.md` has the
  fingerprint. The four secrets still need adding: `docs/STORE.md` step 3.
- ~~A release build, an `aab` not an `apk`.~~ Done.
- ~~The API level.~~ Play stopped accepting API 35 for new apps on 31 August
  2026. Capacitor 8 targets 36, which is why the upgrade happened.
- ~~versionCode.~~ `tools/patch-version.mjs` stamps it from `package.json`.
  Capacitor's default of 1 would have been rejected on the second upload.
- **Set `RELEASE_SIGNING` to `true`.** One variable, and the first store bundle
  builds itself.
- **The 12-tester closed test.** Blocker 2. Start it first.

### iOS

The one thing that needs hardware you may not have. Capacitor supports iOS,
but `npx cap add ios` and every build after it need macOS and Xcode.

| Route | Cost | Worth it when |
|---|---|---|
| GitHub Actions macOS runner | free on a public repo | You only need CI builds. Debugging a native issue through CI logs is miserable. |
| Cloud Mac | £40 to £60 a month | A few weeks of setup, then cancel. |
| Mac mini | about £600 once | You intend to keep shipping iOS. Cheapest by month six. |

Reminders should carry over. `www/js/native.js` goes through Capacitor's
LocalNotifications, which is cross-platform, and the permission ask added for
Android 13 covers the iOS authorisation prompt through the same call. Untested
on a device, because there is no device. Verify it before submitting rather than
assuming it: a reminder switch that saves a time and never fires is a one-star
review with a fair point in it.

### Both

Screenshots per device size, the listing text, an age rating, the data-safety
declarations, the trader status, and a first review that will take between a
day and a week. Budget one rejection. Everyone gets one.

---

## Milestone 5: after it is out

Launching is where the work starts, not where it stops.

- **Widgets.** The single most requested feature in every habit app, the one
  thing Loop does that this does not, and worth more to retention than any
  screen you could add instead.
- **Onboarding measured, not guessed.** Day-1 and day-7 retention are the only
  numbers that predict revenue, and both are decided in the first five minutes.
  The intro already exists; instrument it and cut the pages people drop on.
- **Analytics that keep the promise.** If the app says nothing leaves the
  phone, aggregate counts are the most you can take, and the privacy policy has
  to say so. Do not quietly become a normal app.
- **Ask for reviews**, once, after someone wins a week. Never on open.

---

## What it costs

| | |
|---|---|
**To the first Play listing, as things now stand:**

| | |
|---|---|
| Play Console | £20 once |
| AdMob | free |
| Domain and email | £0, GitHub Pages hosts the legal pages |
| Registered office | £0 with the EU off, about £30 a year to switch it on |
| Icon | £0 generated, or what an illustrator charges |
| **Total** | **about £20** |

**Later, if it is worth it:**

| | |
|---|---|
| Apple Developer Program | £79 a year |
| Mac, if you have none | £0 to £600 |
| Replacing the crest artwork | £500 to £1,500 |
| Supabase | £0, then £20 a month |
| RevenueCat | £0 under $2,500 a month |

---

## The order to do it in

1. **Today.** Open the Play account and the AdMob account, and line up 12
   testers. All three are waiting time, so they should be waiting from today.
   `docs/STORE.md` steps 1, 2 and 6.
2. **This week.** Generate the icon and redraw it in both files.
   `docs/ART.md` section 5.
3. **The day identity verification clears.** Add the four secrets, set
   `RELEASE_SIGNING`, and download the first AAB. Closed track up, opt-in link
   out, and the 14 days start.
4. **While the 14 days run.** Screenshots, the listing text, the feature
   graphic, Data Safety, the country list with the EU off.
5. **Day 15.** Apply for production access. Budget one rejection.
6. **After launch.** Widgets, then accounts, then a paid tier if the numbers
   say so.

Three weeks of wall clock, most of it waiting on Google. The 12 testers are the
only thing on the list a longer day cannot shorten, which is why they start
first.

---

## The risks, honestly

**The market is crowded and the incumbents are free.** Loop is free, open
source and has widgets. Habitica is free. Streaks is £6 once. The Arena is the
only thing here that none of them have, and the whole marketing case has to be
that one idea: *your week plays the best week you ever had*. If that sentence
does not sell it, nothing on the feature list will.

**Ads and the promise were in tension, and the copy moved.** An ad SDK is a
third party on the device by definition, so "nothing leaves this phone" could
not survive AdMob. The claim is now about the record, which is the part that is
still exactly true: the habits, the marked days and the Arena's history are
never sent anywhere. Settings, the privacy policy and the terms all say the same
thing. Saying the old thing while doing the new one is what gets written about.

**The crest artwork is a takedown waiting to be filed**, and a takedown lands on
the listing rather than on one file. Kept knowingly. Blocker 3.

**The 12 testers are real people** who have to keep the app installed for a
fortnight. Line them up before you need them.

**A lifetime unlock is a promise about servers you have to keep.** If sync is
part of Pro and Pro can be bought once, you are paying for that person's
storage forever. Either cap it, or keep sync in the subscription and make
lifetime cover everything else.
