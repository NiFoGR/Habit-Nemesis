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
| `js/app.js` | 184 | Route table, shell state, boot. Nothing renders here. |
| `js/back.js` | 135 | What Back means: the corner arrow, the hardware button, history. |
| `js/icons.js` | 102 | The inline SVG icon set, and the placeholder app mark. |
| `js/lock.js` | 123 | The optional PIN gate. Owns whether the app is unlocked. |
| `js/intro.js` | 277 | The introduction, shown once on a new install. |
| `js/native.js` | 86 | Capacitor bridge for real Android alarms. |
| `js/settings.js` | 273 | App-wide settings: the grid, marking, feedback, privacy, data, reset. |
| `js/tabs.js` | 59 | The bottom bar: Cabinet, Grid, Arena. Drawn once, never rebuilt. |
| `js/store.js` | 457 | localStorage persistence and the input sanitiser. |
| `js/ui.js` | 381 | Shared helpers: formatting, haptics, SVG charts, the sheet. |
| `js/artwork.js` | 25 | Where a crest or cup file lives, and what to draw when it is missing. |

**The PIN is a real lock, not a door.** `lock.js` derives an AES-GCM key from
the PIN with PBKDF2 and stores only an encrypted check blob, so a wrong PIN
fails an auth tag and nothing leaks. There is no recovery, and the sheet that
sets it says so before you commit.

## Habits, which is the home screen

| File | Lines | What it is |
|---|---|---|
| `js/habits/program.js` | 594 | The record, the frequency model, the score, the streaks, the charts. |
| `js/habits/home.js` | 711 | **The home screen.** The grid, marking, reordering, groups, the archive, the install prompt. |
| `js/habits/edit.js` | 339 | Creating and editing: the type, colour, frequency and reminder pickers. |
| `js/habits/tracking.js` | 280 | One habit in full, and the calendar you can write to. |

Two things are worth knowing before reading the code. **Streaks and scores are
computed on every read rather than stored**, because the past is editable from
the calendar and a cached streak would go stale the moment you corrected it.
And **the grid's options are app options**, on `settings.js`, because the grid
is the app. [`docs/HABITS.md`](HABITS.md) has the scoring maths and the
frequency model.

## The Arena, which is a reading of the grid

| File | Lines | What it is |
|---|---|---|
| `js/arena/program.js` | 1089 | Weeks, divisions, opponents, arcs, and the only part of the app that writes down what it could recompute. |
| `js/arena/home.js` | 453 | The Arena in one scrolling screen, and every feat on another. |
| `js/arena/year.js` | 274 | The Year: twelve months, four arcs, the rows that carried it. |
| `js/arena/result.js` | 252 | Telling you what happened: the full screen, and the one-line feat pop. |
| `js/arena/review.js` | 262 | The week in review: what slipped, what held. |
| `js/arena/cabinet.js` | 144 | The Cabinet: cups, feats, years, and the lines you left. |
| `js/arena/feats.js` | 404 | The predicates over the record. The one catalogue. |
| `js/arena/share.js` | 390 | The week as a picture, drawn on a canvas. |
| `js/arena/crest.js` | 41 | The division crests: one file of artwork per rung, in `www/img/`. |
| `js/arena/cup.js` | 23 | The three seasonal cups, same idea. |
| `js/arena/face.js` | 109 | Your Nemesis, with the face you gave it. |
| `js/arena/moment.js` | 150 | The Arc's three ceremonies: it opens, you qualify, you win. |
| `js/arena/rank.js` | 109 | The month settling: promotion, relegation, placement. |
| `js/arena/divisions.js` | 47 | Every rung and what it costs. |

Two rooms of the three, and the split is what stopped either being a stack of
cards: **Arena** is *now*, the division, this week's match, the cup that is
running, and **Cabinet** is *forever*, the cups won, the feats, the years, the
lines you left yourself. Nothing in the Cabinet changes hour to hour, which is
what lets it be still.

Four things to know. **`program.js` stores what it could derive**, alone in
this app, because a closed week's result is a historical fact rather than a
view: recomputing it would let a frequency edited this morning rewrite a match
won in March. **Nothing in `program.js` imports `feats.js`**, only the other
way, so the cycle cannot form; the callers invoke both. **The roster locks on
Monday**, which is the rule that took the most argument and is the reason
adding a habit on Wednesday cannot lose you a match you had already won. And
**a cup has an off-season**: the four arcs used to tile the year end to end,
which meant you were always in one and so a cup was never something you
*entered*. Two weeks of nothing at the end of each quarter is what buys the
countdown its meaning.
[`docs/ARENA.md`](ARENA.md) has all of it, and `npm run check:arena` asserts
the parts that cannot be read off a screen.

## Native

| File | What it is |
|---|---|
| `native/systemui/` | A Capacitor plugin: hides the Android navigation bar, so the app's own bottom bar is the bottom of the screen. |

A plugin package rather than a script that patches the generated project,
because `android/` is regenerated on every build and would throw such edits
away. `package.json` pulls it in with a `file:` dependency and Capacitor does
the rest.

## Tooling

Everything here is build-time and never ships in `www/`.

| File | What it is |
|---|---|
| `tools/serve.mjs` | The dev server. `npm run dev`. |
| `tools/check-arena.mjs` | The Arena's calendar maths, asserted. `npm run check:arena`. |
| `tools/check-ui.mjs` | The stylesheet's own rules: one type scale, one palette. `npm run check:ui`. |
| `tools/gen-icons.mjs` | PWA and launcher icons as PNGs, no dependencies. |
| `tools/art.mjs` | Takes a dropped-in image, makes the WebP the app loads, updates `sw.js`. |
| `tools/patch-signing.mjs` | Pins the debug signing key into the generated Gradle build. |
| `tools/patch-backup.mjs` | Turns on Android's own backup, which is what carries the record off the device. |
