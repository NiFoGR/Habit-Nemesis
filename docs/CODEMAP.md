# Code map

Where everything is, so finding it does not mean reading it.

Three rules the tree follows:

1. **One folder per feature.** `kegels/`, `pe/`, `pray/`, `bible/`. Anything at
   the top level of `js/` is shell, used by all of them.
2. **The same filenames in each.** `program.js` is always the domain logic,
   `home.js` always the section's screens, `session.js` always the thing that
   runs. The folder disambiguates, so `pe/program.js` is unambiguous where a
   `pe-program.js` at the root would not be.
3. **A setting lives where the thing it affects lives.** App-wide options are
   in `settings.js`; per-section options are in that section's own screen.

Every file opens with a comment saying what it is and why it works the way it
does. Long files are split by `/* ---- section ---- */` banners, so
`grep -n "^/\* ---" <file>` gives you its table of contents.


## Shell

| File | Lines | What it is |
|---|---|---|
| `js/app.js` | 196 | Route table, shell state, boot. Nothing renders here. |
| `js/hub.js` | 299 | The Today screen, the feature registry, the install prompt. |
| `js/icons.js` | 74 | The inline SVG icon set and the logo mark. |
| `js/lock.js` | 70 | The optional PIN gate. Owns whether the app is unlocked. |
| `js/names.js` | 10 | What each section is called, under discreet mode. |
| `js/native.js` | 65 | Capacitor bridge for real Android alarms. |
| `js/settings.js` | 199 | App-wide settings: feedback, privacy, data, reset. |
| `js/store.js` | 569 | localStorage persistence and the input sanitiser. |
| `js/ui.js` | 376 | Shared helpers: formatting, haptics, notifications, SVG charts. |

## Kegels

| File | Lines | What it is |
|---|---|---|
| `js/kegels/home.js` | 231 | Kegels home, how-to, and Kegels settings. |
| `js/kegels/pocket.js` | 263 | Vibration-only session pacing. |
| `js/kegels/program.js` | 496 | The 104-week plan, scoring, progression, badges. |
| `js/kegels/report.js` | 99 | End-of-session debrief. |
| `js/kegels/review.js` | 134 | The weekly review. |
| `js/kegels/roadmap.js` | 134 | All 104 weeks and the six phases. |
| `js/kegels/session.js` | 476 | The guided player and per-rep measurement. |
| `js/kegels/tracking.js` | 186 | Heatmap, charts, session log. |
| `js/kegels/tutorial.js` | 321 | Technique walkthrough, including the reverse kegel. |

## PE

| File | Lines | What it is |
|---|---|---|
| `js/pe/camera.js` | 246 | Ghost-overlay photo capture and alignment. |
| `js/pe/db.js` | 133 | IndexedDB photo storage and downscaling. |
| `js/pe/gallery.js` | 239 | Encrypted gallery, viewer, compare. |
| `js/pe/guide.js` | 165 | Safety reference and PE settings. |
| `js/pe/home.js` | 124 | PE home and the one-time safety gate. |
| `js/pe/measure.js` | 400 | The five-measurement monthly check-in. |
| `js/pe/pin.js` | 140 | PIN keypad and unlock flow. |
| `js/pe/program.js` | 492 | Session types, limits, projection, achievements. |
| `js/pe/stats.js` | 309 | Charts, period selector, projection, log. |
| `js/pe/timer.js` | 590 | Session runner, set breaks, kegels during pump. |
| `js/pe/vault.js` | 162 | PIN-derived AES-GCM encryption. |

## Prayer

| File | Lines | What it is |
|---|---|---|
| `js/pray/home.js` | 281 | Prayer home, tracking, my prayers, prayer settings. |
| `js/pray/prayers.js` | 240 | The bundled prayers and the two rules. |
| `js/pray/program.js` | 182 | What is owed today, streaks, heatmap data, alarms. |
| `js/pray/session.js` | 151 | The guided rule. |

## Bible

| File | Lines | What it is |
|---|---|---|
| `js/bible/book.js` | 92 | One book's context screen, the six questions. |
| `js/bible/canon.js` | 88 | **Generated.** 76 books, 1,344 chapters, verse counts. |
| `js/bible/context.js` | 841 | What every book is and what to watch for. |
| `js/bible/home.js` | 304 | Bible home, the plan picker, Bible settings. |
| `js/bible/lectionary.js` | 402 | **Generated.** The OSB lectionary as references. |
| `js/bible/pascha.js` | 177 | Orthodox Pascha, the season, the day's readings. |
| `js/bible/plans.js` | 142 | The six reading plans, and how a day is cut. |
| `js/bible/program.js` | 337 | Progress, streaks, marking, today's assignment. |
| `js/bible/read.js` | 144 | The shelf and the chapter grid. |
| `js/bible/tracking.js` | 97 | Heatmap, canon progress, log. |

The two generated files come from `tools/extract-bible-data.mjs`, which reads a
text export of the Orthodox Study Bible. **Neither holds any scripture**, only
structure and references, and the app does not contain the text of the Bible at
all. [`docs/BIBLE.md`](BIBLE.md) says why.

## Elsewhere

| Path | What it is |
|---|---|
| `www/index.html` | The shell page and the Content-Security-Policy |
| `www/styles.css` | Every style, including the per-section themes |
| `www/sw.js` | Offline service worker. **Add new modules to its ASSETS list** |
| `signing/` | The fixed APK signing key, so updates install over the top |
| `tools/gen-icons.mjs` | Draws all app and launcher icons from code |
| `tools/extract-bible-data.mjs` | Builds `bible/canon.js` and `bible/lectionary.js` |
| `tools/patch-signing.mjs` | Points the generated Android project at the key |
| `docs/` | The reasoning and sources behind each feature |

## Adding a feature

1. A folder under `www/js/`, following rule 2 above.
2. An entry in `FEATURES` in `hub.js` for the section tile.
3. A line in `todayTasks` in `hub.js` if it owes you something daily.
4. Routes in `ROUTES` and `NAV` in `app.js`.
5. Its slice of the store, added to `blank()` and `hydrate()` in `store.js`.
   Keep it additive: `hydrate` merges saved state over the blank shape, so new
   fields appear on old saves instead of coming back `undefined`.
6. Its modules added to `ASSETS` in `sw.js`, or it will not work offline.
7. A theme block in `styles.css` and a case in the router's section switch.

43 modules, 10,676 lines.
