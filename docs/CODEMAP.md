# Code map

Where everything is, so finding it does not mean reading it.

Four rules the tree follows:

1. **One folder per feature.** `habits/` and `arena/`. Anything at the top
   level of `js/` is shell, used by both.
2. **The same filenames in each.** `program.js` is always the domain logic,
   `home.js` always the screens. The folder disambiguates, so
   `habits/program.js` is unambiguous where a `habits-program.js` at the root
   would not be.
3. **One theme, and colour means state.** One accent, one sans. Colour says
   done, due or missed, never which room you are in. The two exceptions are a
   habit's own colour and the division crests.
4. **Back is not a link.** Every screen marks its corner control with
   `data-back`: with a nav key when it is plain navigation, bare when the
   screen handles Back itself. `back.js` reads that one attribute and answers
   for the arrow, the browser and the Android hardware button together.

Every file opens with a comment saying what it is and why it works the way it
does. Long files are split by `/* ---- section ---- */` banners, so
`grep -n "^/\* ---" <file>` gives you its table of contents.


## Shell

| File | Lines | What it is |
|---|---|---|
| `js/app.js` | 193 | Route table, shell state, boot. Nothing renders here. |
| `js/back.js` | 135 | What Back means: the corner arrow, the hardware button, history. |
| `js/icons.js` | 93 | The inline SVG icon set, and the app mark as one polygon. |
| `js/lock.js` | 123 | The optional PIN gate. Owns whether the app is unlocked. |
| `js/intro.js` | 274 | The introduction, shown once on a new install. |
| `js/native.js` | 160 | Capacitor bridge: Android alarms, the buttons on a reminder, the notification permission. |
| `js/widgets.js` | 110 | The home screen widgets' half: the snapshot on every change, the queue drained on resume. |
| `js/settings.js` | 400 | App-wide settings: six pages from one table, and the account card. |
| `js/version.js` | 3 | The version string About shows. Checked against package.json. |
| `js/tabs.js` | 59 | The bottom bar: Cabinet, Grid, Arena. Drawn once, never rebuilt. |
| `js/store.js` | 492 | localStorage persistence and the input sanitiser. |
| `js/ui.js` | 354 | Shared helpers: formatting, haptics, SVG charts, the sheet. |
| `js/artwork.js` | 25 | Where a crest or cup file lives, and what to draw when it is missing. |
| `js/vendor/supabase.js` | | The Supabase client, vendored so `script-src 'self'` holds. |

**The PIN is a real lock, not a door.** `lock.js` derives an AES-GCM key from
the PIN with PBKDF2 and stores only an encrypted check blob, so a wrong PIN
fails an auth tag and nothing leaks. There is no recovery, and the sheet that
sets it says so before you commit.

## Habits, which is the home screen

| File | Lines | What it is |
|---|---|---|
| `js/habits/program.js` | 609 | The record, the frequency model, the score, the streaks, the charts. |
| `js/habits/home.js` | 407 | **The home screen.** The screens and what arranges them: the grid, reordering, groups, the archive, the install prompt. |
| `js/habits/grid.js` | 142 | The grid's HTML: header, rows, cells, rings. Builds markup, never wires it. |
| `js/habits/marking.js` | 173 | Marking a day: tap and long-press wiring, the cell swap, the keypad sheet. |
| `js/habits/edit.js` | 344 | Creating and editing: the type, colour, frequency and reminder pickers. |
| `js/habits/tracking.js` | 279 | One habit in full, and the calendar you can write to. |

Two things are worth knowing before reading the code. **Streaks and scores are
computed on every read rather than stored**, because the past is editable from
the calendar and a cached streak would go stale the moment you corrected it.
And **the grid's options are app options**, on `settings.js`, because the grid
is the app. [`docs/HABITS.md`](HABITS.md) has the scoring maths and the
frequency model.

## The Arena, which is a reading of the grid

The domain is five modules in dependency order, re-exported whole by
`program.js` so every screen has one import.

| File | Lines | What it is |
|---|---|---|
| `js/arena/ladder.js` | 32 | The nine divisions. Imports nothing, so `store.js` reads it too. |
| `js/arena/calendar.js` | 204 | ISO weeks, the months they file under, the arcs laid over them. Dates only. |
| `js/arena/scoring.js` | 162 | The roster, the days each row owed, and what a week is worth. |
| `js/arena/fixtures.js` | 164 | Who you play: the four opponents, the knockout, the group table. |
| `js/arena/ledger.js` | 245 | The write path. `sync()` and everything it settles. The only code that stores a result. |
| `js/arena/program.js` | 390 | The re-export, plus what sits across the parts: arc state, moments, alarms, notes, years, standing, the review. |
| `js/arena/home.js` | 48 | The Arena screen, assembled. Every block below it, in the order the questions get asked. |
| `js/arena/standing.js` | 109 | Where you stand: the crest, the division by name, the ladder. |
| `js/arena/fixture.js` | 106 | This week's match on one track, and the form strip. |
| `js/arena/arc.js` | 114 | The Arc, in whichever of its five states it is in. |
| `js/arena/week-sheet.js` | 88 | One week, opened. Reached from every screen that names a week. |
| `js/arena/year.js` | 274 | The Year: twelve months, the cups, the rows that carried it. |
| `js/arena/result.js` | 259 | Telling you what happened: the full screen, and the one-line feat pop. |
| `js/arena/review.js` | 262 | The week in review: what slipped, what held. |
| `js/arena/cabinet.js` | 145 | The Cabinet: cups, feats, years, and the lines you left. |
| `js/arena/feats.js` | 404 | The predicates over the record. The one catalogue. |
| `js/arena/feats-screen.js` | 75 | Every feat on a screen, and the sheet one opens into. |
| `js/arena/share.js` | 390 | The week as a picture, drawn on a canvas. |
| `js/arena/crest.js` | 41 | The division crests: one file of artwork per rung, in `www/img/`. |
| `js/arena/cup.js` | 23 | The three seasonal cups, same idea. |
| `js/arena/face.js` | 100 | Your Nemesis, with the face you gave it. |
| `js/arena/nemesis.js` | 113 | The head to head, the succession, the next meeting. All derived. |
| `js/arena/nemesis-screen.js` | 82 | His screen: who he is now, the record, and the ones he replaced. |
| `js/arena/moment.js` | 150 | The Arc's three ceremonies: it opens, you qualify, you win. |
| `js/arena/rank.js` | 109 | The month settling: promotion, relegation, placement. |
| `js/arena/divisions.js` | 47 | Every rung and what it costs. |

Two rooms of the three, and the split is what stopped either being a stack of
cards: **Arena** is *now*, the division, this week's match, the cup that is
running, and **Cabinet** is *forever*, the cups won, the feats, the years, the
lines you left yourself. Nothing in the Cabinet changes hour to hour, which is
what lets it be still.

Four things to know. **`ledger.js` stores what it could derive**, alone in
this app, because a closed week's result is a historical fact rather than a
view: recomputing it would let a frequency edited this morning rewrite a match
won in March. **Nothing in the domain imports `feats.js`**, only the other
way, so the cycle cannot form; the callers invoke both. **A row owes only the days it
was on the grid for**, which is the rule that took the most argument: adding a
habit on Wednesday cannot lose you Monday, and archiving on Wednesday cannot
erase it. And
**a cup has an off-season**: the arcs used to tile the year end to end,
which meant you were always in one and so a cup was never something you
*entered*. Two weeks of nothing at the end of each quarter is what buys the
countdown its meaning.
[`docs/ARENA.md`](ARENA.md) has all of it, and `npm run check:arena` asserts
the parts that cannot be read off a screen.

## Accounts, which are optional

| File | Lines | What it is |
|---|---|---|
| `js/account/config.js` | 23 | The Supabase project values. Empty until a project exists; see `docs/ACCOUNTS.md`. |
| `js/account/session.js` | 121 | The client, sign up, sign in, reset, sign out, delete. |
| `js/account/oauth.js` | 59 | Google sign-in: a Custom Tab out, a deep link back. |
| `js/account/sync.js` | 230 | Automatic: push on change, pull on launch, ask on a real conflict. Whole-record, not a merge. |
| `js/account/gate.js` | 176 | Five tries then a wait, per account and per device. A courtesy, not a defence. |
| `js/account/screen.js` | 251 | The Account screen in its three states: unconfigured, signed out, signed in. |

The account is a copy of the record, never the record. Everything pulled from
it goes through `store.js`'s sanitiser like any other untrusted file.
`SECURITY.md` is the model; `docs/ACCOUNTS.md` is the setup.

With no project configured the account card, the intro's last page and the
grid's nudge are all absent rather than dead ends.

## Ads, which are optional too

| File | Lines | What it is |
|---|---|---|
| `js/ads/config.js` | 38 | The AdMob app and unit ids, and the testing flag. Empty until an account exists; see `docs/STORE.md`. |
| `js/ads/program.js` | 150 | Consent, the banner rule, and the one interstitial a week. |

Four things must all be true before an ad exists: ids configured, running in
the APK, past the three-day grace, and Google's consent platform saying ads can
be requested. `app.js` calls `onRoute()` on every navigation, so the banner is
decided in one place and a screen not on the list cannot acquire one by
accident. `tools/patch-ads.mjs` turns the real units on in the store bundle and
nowhere else.

## Legal

`www/legal/`: privacy, terms, licences, wellbeing, one shared stylesheet, and
`publisher.js`, the single file naming the publisher. Unset fields render as
`[NOT SET]` so a placeholder cannot pass for a policy.

## Native

| File | What it is |
|---|---|
| `native/systemui/` | A Capacitor plugin: hides the Android navigation bar, so the app's own bottom bar is the bottom of the screen. |
| `native/widgets/` | A Capacitor plugin: three home screen widgets drawn from a snapshot the app writes, and a queue of the marks tapped on them. Its README is the contract. |

Plugin packages rather than scripts that patch the generated project,
because `android/` is regenerated on every build and would throw such edits
away. `package.json` pulls each in with a `file:` dependency and Capacitor does
the rest.

**Reminders are one-shots, a week ahead.** `habits/program.js` plans one per
row per day, skips any day already answered, and the plan is re-armed on
every change to the record. That is what cancels a reminder the moment its
cell is marked, from the grid, from a widget or from the reminder's own Done
button. Android caps an app at 500 alarms, which is why the week is the
horizon: reminders stop a week after the last time the app was opened.

## Tooling

Everything here is build-time and never ships in `www/`.

| File | What it is |
|---|---|
| `tools/serve.mjs` | The dev server. `npm run dev`. |
| `tools/check-arena.mjs` | The Arena's calendar maths, asserted. `npm run check:arena`. |
| `tools/check-ui.mjs` | The stylesheet's own rules: one type scale, one palette. `npm run check:ui`. |
| `tools/check-version.mjs` | package.json and version.js agree. `npm run check:version`. |
| `tools/png.mjs` | PNG in, PNG out, and the box filter between. Shared, so art and icons cannot drift. |
| `tools/gen-icons.mjs` | PWA, launcher and store icons. Uses `art/source/mark.png` when it exists, `MARK` otherwise. |
| `tools/art.mjs` | Takes a dropped-in image, makes the WebP the app loads, updates `sw.js`. |
| `tools/patch-signing.mjs` | Pins the debug signing key into the generated Gradle build. |
| `tools/patch-backup.mjs` | Turns on Android's own backup, which is what carries the record off the device. |
| `tools/check-release.mjs` | Refuses a push that ships a source map, a secret, live ad units or the wrong keystore. |
| `tools/patch-deeplink.mjs` | Registers `com.habitnemesis.app://auth`, which sign-in returns through, and `://open`, which carries a route. |
| `tools/patch-shortcuts.mjs` | The launcher shortcuts, Mark today and Arena, with their icons drawn from `icons.js`. |
| `tools/patch-release-signing.mjs` | Release signing from CI secrets. Refuses the debug key and a debuggable config. |
| `tools/patch-version.mjs` | Stamps versionCode and versionName from `package.json`. Play rejects a repeat versionCode. |
| `tools/patch-ads.mjs` | Turns the real ad units live, in the store bundle only, and writes the AdMob app id into the manifest. |
