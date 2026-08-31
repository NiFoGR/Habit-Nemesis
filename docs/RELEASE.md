# The road to a release

From what is in the tree today to a paid app on two stores. Written as
decisions and milestones rather than a wish list, because most of what is left
is not code.

Dates assume one person working evenings and weekends. Full time, halve them.

---

## Where it stands today

The app works. The grid, the Arena, the Cabinet, the feats, the year, the
share card, the PIN, the backup, offline, and a real Android build. That is
more finished product than most projects have when they start thinking about a
store, and it is worth saying plainly, because everything below is a list of
what is missing and lists like that read as though nothing is done.

What is missing is not features. It is the things that turn a personal app
into a product other people can be sold: an identity, artwork you own,
accounts, a way to take money, and two store listings.

---

## The five blockers

In the order they will hurt. Nothing ships past the first three.

### 1. The division artwork is other people's

`www/img/rank-*.webp` are photographs of real, identifiable people, several of
them recognisable public figures, at least one deceased, in what look like meme
crops. On a phone you sideloaded yourself that is nobody's business. On a paid
app in two stores it is three separate problems at once:

- **Copyright.** Somebody took each of those photographs and owns it.
- **Personality rights.** Using an identifiable person to sell a product needs
  their permission in most of the markets that matter, and their estate's after
  they die.
- **Review.** Both stores prohibit third-party IP you cannot show rights to,
  and both act on complaints faster than they act on appeals.

There is also a brand judgement underneath the legal one. "Top G" is bound to
one living person with an active criminal case attached to his name, and it is
the sort of association a store listing carries in public forever. That is
a call about who the app is for, and it is yours to make. The artwork is not a
call: every crest has to be replaced with something original before submission,
whatever the divisions end up being called.

Nine crests, three cups, and the share-card grounds. Budget £500 to £1,500 for
an illustrator, or draw them. `docs/ART.md` already says what each one has to
say and what size to send. **This is the long pole.** Start it first, because
it is the only item on this page that cannot be hurried by working harder.

### 2. There is no app mark

Deliberately. It is a dashed square in `www/js/icons.js` and
`tools/gen-icons.mjs`, and it looks unfinished on purpose so it cannot be
shipped by accident. Both stores need a 1024 x 1024 opaque PNG with no
transparency and no rounded corners. Do it with the crests, from the same hand.

### 3. Trader status publishes your address

Under the EU Digital Services Act, anyone taking money from EU users, ads
included, has to declare trader status and publish a name, address, email and
phone. Apple has enforced this since February 2025 and removes apps from all
27 EU storefronts until it is provided. Google requires the same through Play
Console.

An individual publishing that publishes their home address. **Form a limited
company, or buy a registered-office address, before the first submission.** UK
incorporation is £50 at Companies House and a registered office service is
about £50 a year. Doing it after the fact means changing the developer name on
a live listing, which is slow and loses the reviews.

### 4. There is no way to take money

No accounts, no entitlement, no billing. Milestones 2 and 3.

### 5. Nobody has tested it but you

Google requires a new personal Play Console account to run a closed test with
**12 testers opted in continuously for 14 days** before it will grant
production access. Not 12 sign-ups: 12 people who stay opted in for a
fortnight. This is the single most underestimated delay in shipping to Android
and it costs nothing to start early. Get the closed track running the week the
Play account exists, months before you need it.

---

## Milestone 0: the decisions you cannot take back

One evening. Everything after this depends on them, and each is expensive to
change once a store has it.

| Decision | Where it is now | Why it is permanent |
|---|---|---|
| Package name | `com.habitnemesis.app` | Play never lets you change it. A new one is a new app with zero installs and zero reviews. |
| Storage key | `habitnemesis.state.v1` | Changing it orphans every existing install's record. |
| Display name | Habit Nemesis | Changeable, but it is the search term you spend a year building. |
| Publisher | undecided | See blocker 3. Decide before the first submission, not after. |
| Free vs paid line | undecided | See milestone 3. Moving something from free to paid after launch is the fastest way to a one-star review pile. |

The first two are already set in the tree and are fine. Leave them.

---

## Milestone 1: make it shippable

Three to five weeks, and the artwork sets the pace.

- **The artwork.** Blockers 1 and 2.
- **A company or an address.** Blocker 3.
- **A domain and three pages.** A privacy policy, terms, and a support page
  with a real email. Both stores require URLs for these before review, and the
  privacy policy has to be accurate about the *next* version, not this one:
  write it for a world with accounts, sync and ads in it.
- **One thing in the code.** Add an `updatedAt` timestamp to every habit,
  group and entry, and start writing it now. Sync in milestone 2 needs to know
  which of two versions of a day is newer, and a timestamp cannot be
  reconstructed for history that was written without one. The schema is
  additive and `hydrate()` merges over `blank()`, so this is a small change
  today and an impossible one later. **Do this before anyone else installs the
  app.**
- **Screenshots and a listing.** Six per platform per device size, plus the
  text. The Arena is the thing nothing else has: lead with the fixture card and
  the ladder, not with a grid, because every habit app screenshot is a grid.

---

## Milestone 2: accounts and sync

Four to six weeks. The hardest engineering left, and the thing that makes the
rest possible: an entitlement has to live somewhere, and "the record survives a
new phone" is the most common reason people pay for an app like this.

### Keep local-first

The app's claim today is "no account, no server, nothing leaves this phone",
and that is a feature, not an accident. Do not trade it for sync. **The account
stays optional.** The app works forever without one; signing in adds a copy in
the cloud and a second device. Say exactly that on the sign-in screen, and the
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
Apple's tracking prompt. Google's UMP SDK handles the first. Expect most users
to decline the second and price the model on non-personalised rates.

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

Capacitor already builds it and `.github/workflows/android-apk.yml` already
signs it. Three things change for a release:

- **A real upload key.** The key in `signing/` is Android's public debug key.
  It must never sign a store build. Generate a release key, keep it in a GitHub
  secret, and turn on Play App Signing so losing it is not fatal.
- **A release build**, not `assembleDebug`. An `aab`, not an `apk`.
- **The 12-tester closed test.** Blocker 5. Start it first.

### iOS

The one thing that needs hardware you may not have. Capacitor supports iOS,
but `npx cap add ios` and every build after it need macOS and Xcode.

| Route | Cost | Worth it when |
|---|---|---|
| GitHub Actions macOS runner | free on a public repo | You only need CI builds. Debugging a native issue through CI logs is miserable. |
| Cloud Mac | £40 to £60 a month | A few weeks of setup, then cancel. |
| Mac mini | about £600 once | You intend to keep shipping iOS. Cheapest by month six. |

Beyond the build: reminders do not work. Every alarm goes through Android's
AlarmManager and returns early on iOS, so the reminder switches save a time and
nothing fires. Shipping that is a one-star review with a fair point in it.
Either implement iOS local notifications, which Capacitor supports and is a
day's work, or hide the switches on iOS. Do not ship a dead control.

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
| Apple Developer Program | £79 a year |
| Play Console | £20 once |
| Domain and email | £30 a year |
| Company and registered office | £50 once, £50 a year |
| Artwork | £500 to £1,500 |
| Mac, if you have none | £0 to £600 |
| Supabase | £0, then £20 a month |
| RevenueCat | £0 under $2,500 a month |
| **To the first listing** | **roughly £700 to £2,300** |

The variance is entirely the artwork and the Mac. Everything else is under
£200.

---

## The order to do it in

1. **This week.** Decide the publisher, register the company or the address,
   buy the domain, open the Play account, and start the 12-tester closed test.
   All of it is waiting time, so it should be waiting from today.
2. **Also this week.** Add `updatedAt` to habits, groups and entries. It gets
   harder every day the app is installed anywhere.
3. **Weeks 1 to 5.** Commission the artwork. Write the three legal pages while
   you wait.
4. **Weeks 4 to 10.** Accounts and sync, local-first, account optional.
5. **Weeks 10 to 13.** Billing, the paywall, and the ad placements above.
6. **Weeks 12 to 16.** iOS notifications, release signing, screenshots, both
   submissions.
7. **Launch.** Then widgets.

Sixteen weeks part time. Eight full time. The artwork and the 12 testers are
the only two things on the list that a longer day cannot shorten, which is why
both start in week one.

---

## The risks, honestly

**The market is crowded and the incumbents are free.** Loop is free, open
source and has widgets. Habitica is free. Streaks is £6 once. The Arena is the
only thing here that none of them have, and the whole marketing case has to be
that one idea: *your week plays the best week you ever had*. If that sentence
does not sell it, nothing on the feature list will.

**Ads and the promise are in tension.** The app currently says nothing leaves
the phone. An ad SDK is a third party on the device by definition. Either the
free tier's copy changes to be honest about that, or ads go and the model is
paid-only. Both are defensible. Saying the old thing while doing the new one is
not, and it is the kind of thing that gets written about.

**iOS without notifications is half an app**, and iOS is where people pay.

**The 12 testers are real people** who have to keep the app installed for a
fortnight. Line them up before you need them.

**A lifetime unlock is a promise about servers you have to keep.** If sync is
part of Pro and Pro can be bought once, you are paying for that person's
storage forever. Either cap it, or keep sync in the subscription and make
lifetime cover everything else.
