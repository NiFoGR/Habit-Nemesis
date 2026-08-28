# Code map

Where everything is, so finding it does not mean reading it.

Five rules the tree follows:

1. **One folder per feature.** `kegels/`, `pe/`, `bible/`, `breathe/`, `habits/`,
   `arena/`.
   Anything at the top level of `js/` is shell, used by all of them. `pray/` is
   not a feature of its own: prayer is part of the Bible section, and the
   folder holds the prayer texts and the guided rule it runs.
2. **The same filenames in each.** `program.js` is always the domain logic,
   `home.js` always the section's screens, `session.js` always the thing that
   runs. The folder disambiguates, so `pe/program.js` is unambiguous where a
   `pe-program.js` at the root would not be.
3. **A setting lives where the thing it affects lives.** App-wide options are
   in `settings.js`; per-section options are in that section's own screen.
4. **One theme, and colour means state.** One accent, one sans. Colour says
   done, due or missed — never which section you are in. The two exceptions
   are a habit's own colour and the serif on scripture.
5. **Back is not a link.** Every screen marks its corner control with
   `data-back`: with a nav key when it is plain navigation, bare when the
   screen handles Back itself. `back.js` reads that one attribute and answers
   for the arrow, the browser and the Android hardware button together.

Every file opens with a comment saying what it is and why it works the way it
does. Long files are split by `/* ---- section ---- */` banners, so
`grep -n "^/\* ---" <file>` gives you its table of contents.


## Shell

| File | Lines | What it is |
|---|---|---|
| `js/app.js` | 313 | Route table, shell state, boot. Nothing renders here. |
| `js/back.js` | 213 | What Back means: the corner arrow, the hardware button, history. |
| `js/icons.js` | 129 | The inline SVG icon set and the logo mark. |
| `js/lock.js` | 70 | The optional PIN gate. Owns whether the app is unlocked. |
| `js/nifo.js` | 53 | Whether this install has the five preloaded sections. |
| `js/intro.js` | 139 | The introduction, shown once on a new install. |
| `js/names.js` | 10 | What each section is called, under discreet mode. |
| `js/native.js` | 136 | Capacitor bridge for real Android alarms. |
| `js/nightlight.js` | 474 | The night light: the bridge, its settings screen, the browser fallback. |
| `js/settings.js` | 315 | App-wide settings: the grid, marking, feedback, privacy, data, reset. |
| `js/tabs.js` | 74 | The bottom bar: Cabinet, Grid, Arena. Drawn once, never rebuilt. |
| `js/store.js` | 948 | localStorage persistence and the input sanitiser. |
| `js/ui.js` | 523 | Shared helpers: formatting, haptics, notifications, SVG charts, the sheet. |

**A new install does not have the five.** `nifo.js` holds that, and it is a
structural fact about the tree rather than a setting: with it locked,
`habits/program.js` returns no linked rows, the router answers only the three
rooms and Settings, and Settings drops its Sections list. The door is one
button at the foot of Settings and it takes one attempt. `intro.js` is what a
locked install is shown instead, once.

## Kegels

| File | Lines | What it is |
|---|---|---|
| `js/kegels/home.js` | 239 | Kegels home, how-to, and Kegels settings. |
| `js/kegels/pocket.js` | 264 | Vibration-only session pacing. |
| `js/kegels/program.js` | 459 | The 104-week plan, scoring, progression. |
| `js/kegels/report.js` | 99 | End-of-session debrief. |
| `js/kegels/review.js` | 134 | The weekly review. |
| `js/kegels/roadmap.js` | 134 | All 104 weeks and the six phases. |
| `js/kegels/session.js` | 476 | The guided player and per-rep measurement. |
| `js/kegels/tracking.js` | 193 | Heatmap, charts, session log. |
| `js/kegels/tutorial.js` | 322 | Technique walkthrough, including the reverse kegel. |

## PE

| File | Lines | What it is |
|---|---|---|
| `js/pe/camera.js` | 246 | Ghost-overlay photo capture and alignment. |
| `js/pe/db.js` | 133 | IndexedDB photo storage and downscaling. |
| `js/pe/gallery.js` | 241 | Encrypted gallery, viewer, compare. |
| `js/pe/guide.js` | 165 | Safety reference and PE settings. |
| `js/pe/home.js` | 124 | PE home and the one-time safety gate. |
| `js/pe/measure.js` | 401 | The five-measurement monthly check-in. |
| `js/pe/pin.js` | 140 | PIN keypad and unlock flow. |
| `js/pe/program.js` | 445 | Session types, limits, projection. |
| `js/pe/stats.js` | 312 | Charts, period selector, projection, log. |
| `js/pe/timer.js` | 591 | Session runner, set breaks, kegels during pump. |
| `js/pe/vault.js` | 162 | PIN-derived AES-GCM encryption. |

## Bible

The prayer rule lives in this section too.

| File | Lines | What it is |
|---|---|---|
| `js/bible/book.js` | 92 | One book's context screen, the six questions. |
| `js/bible/canon.js` | 88 | **Generated.** 76 books, 1,344 chapters, verse counts. |
| `js/bible/context.js` | 841 | What every book is and what to watch for. |
| `js/bible/home.js` | 172 | Section home and settings. |
| `js/bible/parse.js` | 385 | The parser. Unused at runtime; kept for `tools/extract-bible-text.mjs`. |
| `js/bible/program.js` | 259 | Progress, streaks, marking, reading position. |
| `js/bible/read.js` | 133 | The shelf and the chapter grid. |
| `js/bible/reader.js` | 86 | One chapter on screen, Genesis to Revelation. |
| `js/bible/text.js` | 51 | Loads a book from `www/bible/`, cached in memory. |
| `js/bible/tracking.js` | 114 | Heatmap, canon progress, prayer, log. |
| `js/pray/home.js` | 104 | The prayers you added yourself. |
| `js/pray/prayers.js` | 240 | The bundled prayers and the two rules. |
| `js/pray/program.js` | 182 | What is owed today, streaks, heatmap data, alarms. |
| `js/pray/session.js` | 151 | The guided rule. |

**The scripture ships with the app**, as `www/bible/<id>.json`, one file per
book, generated by `tools/extract-bible-text.mjs` and precached for offline
reading by the service worker. It is 7 MB, which is why `tools/pack-web.mjs`
leaves it out of the hosted build — see [`docs/BIBLE.md`](BIBLE.md).
`parse.js` stays in the app unused at runtime, because it is what the extractor
runs.

## Native

| File | What it is |
|---|---|
| `native/nightlight/` | A Capacitor plugin: the system-wide blue-light filter. |
| `  Curve.java` | Colour temperature and the schedule. Pure, so it can be run on a desktop JVM. |
| `  OverlayService.java` | The foreground service that owns the schedule and repaints. |
| `  HardwareTint.java` | Android's own Night Light, driven directly where the permission allows. |
| `  NightLightPlugin.java` | The bridge. Configuration in, status out, nothing else. |
| `  BootReceiver.java` | Puts the filter back after a reboot. |

This is a plugin package rather than a script that patches the generated
project, because `android/` is regenerated on every build and would throw such
edits away. `package.json` pulls it in with a `file:` dependency and Capacitor
does the rest. [`docs/NIGHTLIGHT.md`](NIGHTLIGHT.md) explains why the schedule
lives in Java, and why there are two filters rather than one.

## Habits, which is the home screen

| File | Lines | What it is |
|---|---|---|
| `js/habits/program.js` | 842 | The record, the frequency model, the score, the streaks, the charts, the five linked rows. |
| `js/habits/home.js` | 710 | **The home screen.** The grid, marking, reordering, groups, the archive, the install prompt. |
| `js/habits/edit.js` | 360 | Creating and editing: the type, colour, frequency and reminder pickers. |
| `js/habits/tracking.js` | 313 | One habit in full, and the calendar you can write to. |

This folder is not a section any more, it is the front door: `#/hub` renders
`renderHome` from `home.js`. There used to be a `hub.js` holding a Today list
and a grid of section tiles above it; both were the same list the grid already
was, so all three collapsed into one screen and `hub.js` was deleted.

Three things are worth knowing before reading the code. **Streaks and scores
are computed on every read rather than stored**, because the past is editable
from the calendar and a cached streak would go stale the moment you corrected
it. **The five other features are rows**, filled from their own records, where
today's cell starts the thing and every cell behind it is read-only, so there
is never a second editable copy of one morning. And **the grid's options are
app options**, on `settings.js`, because the grid is the app.
[`docs/HABITS.md`](HABITS.md) has the scoring maths and the frequency model.

## The Arena, which is a reading of the grid

| File | Lines | What it is |
|---|---|---|
| `js/arena/program.js` | 1100 | Weeks, divisions, opponents, arcs, and the only part of the app that writes down what it could recompute. |
| `js/arena/home.js` | 484 | The Arena in one scrolling screen, and every feat on another. |
| `js/arena/year.js` | 297 | The Year: twelve months, four arcs, the rows that carried it. |
| `js/arena/result.js` | 252 | Telling you what happened — the full screen, and the one-line feat pop. |
| `js/arena/cabinet.js` | 147 | The Cabinet: cups, feats, years, and the lines you left. |
| `js/arena/feats.js` | 339 | Forty predicates over the record. The one catalogue. |
| `js/arena/crest.js` | 53 | The seven division crests: one file of artwork per rung, in `www/img/`. |
| `js/arena/moment.js` | 183 | The Arc's three ceremonies: it opens, you qualify, you win. |

Two rooms of the three, and the split is what stopped either being a stack of
cards: **Arena** is *now* — the division, this week's match, the cup that is
running — and **Cabinet** is *forever* — the cups won, the feats, the years,
the lines you left yourself. Nothing in the Cabinet changes hour to hour, which
is what lets it be still.

Four things to know. **`program.js` stores what it could derive**, alone in
this app, because a closed week's result is a historical fact rather than a
view — recomputing it would let a frequency edited this morning rewrite a match
won in March. **Nothing in `program.js` imports `feats.js`**, only the other
way, so the cycle cannot form; the callers invoke both. And **the roster locks
on Monday**, which is the rule that took the most argument and is the reason
adding a habit on Wednesday cannot lose you a match you had already won. And
**a cup has an off-season**: the four arcs used to tile the year end to end,
which meant you were always in one and so a cup was never something you
*entered*. Two weeks of nothing at the end of each quarter is what buys the
countdown its meaning.
[`docs/ARENA.md`](ARENA.md) has all of it, and `npm run check:arena` asserts
the parts that cannot be read off a screen.

## Wind-down

| File | Lines | What it is |
|---|---|---|
| `js/breathe/program.js` | 203 | The patterns, the timeline, the nightly record and the streak. |
| `js/breathe/session.js` | 309 | The five minutes: the audio timeline, the buzzes, the orb. |
| `js/breathe/home.js` | 185 | Section home, the record, and wind-down settings. |

The record lives on the section home rather than in a `tracking.js` of its own,
which is the one place this feature departs from the shape of the other three.
There is a single number worth keeping — whether you did it — so a second screen
to hold one heatmap would be a room with nothing in it.
[`docs/WINDDOWN.md`](WINDDOWN.md) explains the physiology and why the screen
goes black rather than off.
