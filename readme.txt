================================================================================
Habit Nemesis
A habit grid, and a week that plays the best week you ever had.
================================================================================

No analytics. The record lives on the phone, and an account is optional. Two
things do carry it off the device and the app says so rather than pretending
otherwise: Android's own backup, and an account if you sign in. The full
account of where it goes is www/legal/privacy.html.

There is no build step, no bundler and no framework: www/ is the app, plain ES
modules, open the folder and refresh the page.

Where it is going next, and what it costs to get there: docs/RELEASE.md

--------------------------------------------------------------------------------
1. THE SHAPE OF IT
--------------------------------------------------------------------------------

Three rooms, and the grid is the one you land in.

  GRID      now       Every commitment you have is a row. Above it there is
                      nothing but the date and how much of today is left.
  ARENA     where     Your week, scored as a match against a real week out of
            you       your own record. A division, a fixture, a cup when one
            stand     is running.
  CABINET   what      Cups won, feats, years, and the lines you left yourself.
            you have  Nothing in here changes hour to hour.
            done

The bottom bar holds those three and appears nowhere else. Everything deeper
is a pushed screen with a corner arrow.

Two rules on the grid, no exceptions:

  * The name goes there.  Tapping a habit opens that habit's own screen.
  * The cell does it.     Tapping today marks the day. Only today acts, by
                          one tap or one press. The days behind it are a
                          record, editable from the habit's own calendar.

One theme. One accent, one sans, one set of state colours, so colour answers
"what state is this in" - done, due, missed - and never "which screen am I
on". Two deliberate exceptions: a habit's own colour, which you chose, and the
nine division crests, which are artwork rather than something the app draws.

The app mark is a placeholder on purpose. It is a dashed square, in
www/js/icons.js and tools/gen-icons.mjs, and it is deliberately unfinished so
nobody mistakes it for a decision. See docs/ART.md.

--------------------------------------------------------------------------------
2. THE GRID
--------------------------------------------------------------------------------

Rows are habits, columns are the last few days. How many days, which way round
they run, and whether a tap or a press-and-hold marks them are all yours to
set.

A cell holds four states, not two: done, a lapse you recorded, a day you
skipped, and a day nothing was ever recorded on. The last two are optional,
because most days do not need the distinction and the ones that do need it
badly.

A score that behaves like a habit does. Loop Habit Tracker's exponential
average, unchanged: a thirteen-day half-life, so thirteen days in a row is
exactly 50% and a week off decays the score rather than resetting it.

A frequency is a fraction. Every day, every third day, three times a week, ten
times a month, three times in fourteen days - all the same pair of numbers. A
habit asking three days in seven is not late on the fourth.

Measurable habits with a floor or a ceiling. How many litres, how many pages -
and, the other way round, at most this many calories, where the score is full
under the cap and falls away above it.

Everything about a habit can be changed afterwards, the frequency and target
included. Scores and streaks are computed from the entries on every read
rather than stored, so an edit re-reads the whole history under the new rules
instead of leaving behind a number that was true under the old ones.
The maths, the frequency model and the day boundary: docs/HABITS.md

--------------------------------------------------------------------------------
3. THE ARENA
--------------------------------------------------------------------------------

Your week is a match and your opponent is you. Monday to Sunday, every row on
the grid, scored as the percentage of what was due that you actually did,
against a real week out of your own history. A habit asking five days in seven
owes five cells, not seven, and does not care which five.

Every opponent is a real week out of your own record. There are no invented
rivals and no other people, which is the only thing that makes beating one
mean anything - and the reason you can tap any of them and look at the grid
they actually played.

  Nemesis          the best week you have ever had
  Last Month You   this week, one month back
  Your Worst Self  your worst of the last thirteen
  The Standard     your division's bar with a face on it, standing in when the
                   record cannot supply a real week yet

Nine divisions, ten percent apart, settled monthly:

  Bottom G 20   NPC 30   Prospect 40   Contender 50   Menace 60
  Mentzer 70   Locked In 80   Top G 90   Full 100

A month is the mean of its weeks; clear the next bar and you go up one rung,
fall below your own and you go down one. One rung a month, whatever the score,
so the floor to Full is eight months at the very fastest. Full asks for
everything: one missed cell in a month and it is gone.

A new install is Unranked rather than starting somewhere, because with no
record there is no opponent, no division and no cup. The first week you
actually play places you outright, at whatever rung that week earns, and the
Arena counts down to it.

THE ARC - three cups a year, on the seasons. A build-up, an opening, a group
stage against five past selves, top three through, a quarter-final against
your best week of the last Arc, a semi against your best of the year, a final
against your Nemesis, a ceremony - and then a fortnight of nothing. The arcs
used to tile the year end to end, which meant you were always in a cup and so
a cup was never something you entered. The off-season is what buys the
countdown its meaning. A cup you were not there for is not yours either: the
group table needs weeks you actually played and a field of past selves to
beat, or it says so instead of handing you third place in a field of one.

A ROW OWES THE DAYS IT WAS THERE FOR. A habit added on Wednesday is on this
week's fixture and owes Wednesday to Sunday, not Monday to Sunday: it cannot
lose you the two days before it existed. Archiving is the same rule in reverse,
so you cannot dump the row you are failing. The earlier version cut mid-week
arrivals outright, which left a new install with nothing to score for its whole
first week.

FEATS, NOT ACHIEVEMENTS. Predicates over the record, held to one test: could
you say it out loud to another person and have it mean something? "A hundred
days unbroken" passes. "Opened the app seven days running" does not.

THE YEAR - twelve months on a fixed scale, the division you finished each in,
the three Arcs, your best and worst week, and the rows that actually carried
the year.
All of it, including the arguments that were lost: docs/ARENA.md

--------------------------------------------------------------------------------
4. LAYOUT
--------------------------------------------------------------------------------

www/                the entire app, plain ES modules, no build
  index.html        one page
  styles.css        one theme
  sw.js             offline service worker
  js/
    app.js          route table, shell state, boot - nothing renders here
    back.js         what Back means: corner arrow, hardware button, history
    tabs.js         the bottom bar: Cabinet, Grid, Arena
    store.js        localStorage persistence and the input sanitiser
    ui.js           formatting, haptics, SVG charts, the sheet
    icons.js        the inline SVG icon set and the placeholder app mark
    settings.js     app-wide settings
    lock.js         the optional PIN gate, PBKDF2 and AES-GCM
    intro.js        the introduction, shown once on a new install
    native.js       Capacitor bridge for real Android alarms
    artwork.js      where a crest or cup file lives, and the fallback
    habits/         the grid, which is where you land
    arena/          the Arena, the Cabinet, the Arc, the feats
  img/  icons/      the division crests, the seasonal cups, the app icons
native/
  systemui/         Capacitor plugin: hides the Android navigation bar
signing/            the fixed debug APK key, so sideloaded updates install
                    over the top. Never a release key - see signing/README.md
tools/              dev server, icon generation, signing and backup patches,
                    the art pipeline, and the two checks
CLAUDE.md           the standing rules: comments, writing, structure, theme
docs/
  CODEMAP.md        where every file is and what it does - the map
  HABITS.md         the scoring maths, the frequency model, the day boundary
  ARENA.md          weeks, divisions, arcs, feats, the roster lock
  ART.md            every image the app wants, and what it has to say
  INSTALL.md        putting it on a phone, written for someone else
  STORE.md          shipping to Google Play, step by step, console by console
  RELEASE.md        the road to the App Store and Play: accounts, money, dates
  BRAINSTORM.md     design notes and the backlog

Conventions the tree follows: one folder per feature; the same filenames in
each (program.js is domain logic, home.js the screens); a setting lives where
the thing it affects lives; Back is not a link, it is a data-back attribute
that back.js answers for; nothing ships in www/ that only the tooling needs.

Comments are labels, not prose. Every file opens with one or two lines saying
what it is, a rule gets a line where the code cannot say it, and long files are
split by /* ---- section ---- */ banners, so grep -n "^/\* ---" <file> gives a
table of contents. CLAUDE.md is the full set of rules and is read before any
change.

--------------------------------------------------------------------------------
5. RUNNING IT
--------------------------------------------------------------------------------

  npm run dev                          http://localhost:8080

No build step, no bundler, no framework: edit a file and refresh.

  npm run check          both of the below
  npm run check:arena    the Arena's calendar maths (ISO weeks, which month a
                         week belongs to, which arc a month is in) asserted in
                         bare node, because that is the corner whose answers
                         cannot be read off a screen
  npm run check:ui       the stylesheet's own rules: one type scale, one
                         palette, and a build that fails on drift

Everything else is checked by driving it in a real browser: walk every route,
click every control, and seed the store with fresh / heavily-used /
exactly-one-of-each data, because empty and full both hide the off-by-one.

Things worth watching for, because a screen cannot tell you it got them wrong:
two screens disagreeing about the same number; a class rendered that the
stylesheet never defines; NaN or undefined reaching the page; anything that
fires without a user gesture (a phone refuses to vibrate or start an
AudioContext without one); and animation on a screen that redraws itself -
nothing that is replaced can move, which is why marking a cell swaps that one
cell instead of re-rendering the page.

Adding a file means adding it to SHELL in www/sw.js and bumping CACHE.
Forgetting the bump ships code nobody can see.

--------------------------------------------------------------------------------
6. GETTING IT ON A PHONE
--------------------------------------------------------------------------------

Today it is a PWA plus a sideloadable debug APK. The store builds are
milestone 3 of docs/RELEASE.md and do not exist yet.

ANDROID - build the APK and sideload it. That build has real alarms.

  From CI:  Actions tab -> "Build Android APK" -> Run workflow. About four
            minutes. Download the habit-nemesis-apk artifact, unzip, move the
            APK to the phone, tap it, allow "install from unknown sources".

  Locally:  needs Node and the Android SDK

              npm install
              npx cap add android
              node tools/gen-icons.mjs --android
              npx cap sync android
              cd android && ./gradlew assembleDebug
              # android/app/build/outputs/apk/debug/app-debug.apk

  It is a debug build, which is what you want for your own phone. Every APK is
  signed with the same committed key in signing/, so updates install straight
  over the top and your data survives. Before that key existed, CI generated a
  throwaway one per build, Android refused the update, and the only way in was
  to uninstall, which wiped everything. That key must never sign a store
  release.

IPHONE, OR GIVING IT TO SOMEONE - an iPhone cannot sideload, so Add to Home
Screen is the only route until the App Store build exists, and it is a good
one: it installs as a real app, full screen, offline, with its own icon.

Host www/ over HTTPS - any static host - open it in Safari, and Share -> Add
to Home Screen. HTTPS is not optional: a service worker will not register
without it and the app will not work offline.

The easy way is GitHub Pages: .github/workflows/pages.yml deploys www/ on
every push to main. Switch Pages on once under Settings -> Pages -> Source:
GitHub Actions.

SOURCE HAS TO BE "GITHUB ACTIONS", NOT "DEPLOY FROM A BRANCH". On a branch,
Pages serves the repository root, and the root is not the app, so every URL
404s while pages.yml still reports a successful deploy. There is an index.html
at the repo root that redirects into www/ so a branch-served site works rather
than 404s. It is a net, not the route.

WHAT AN IPHONE DOES NOT GET, because Safari does not have it: reminders, and
the Android navigation-bar hiding. Every alarm in the app is scheduled through
Capacitor's LocalNotifications, and every one of those calls returns early
when hasAlarms() is false, so on an iPhone the reminder switches save their
time and nothing ever fires. Everything else - the grid, the Arena, the
Cabinet, the vibration on newer phones - is the same app.

HANDING THE LINK TO SOMEONE ELSE: docs/INSTALL.md is written for them rather
than for you.

--------------------------------------------------------------------------------
7. YOUR DATA
--------------------------------------------------------------------------------

Everything is in the device's local storage. Nothing is uploaded anywhere, so
nothing can be recovered from anywhere: reinstalling, clearing browser data or
moving phones wipes it.

  Settings -> Export backup    writes a JSON file, through the share sheet on
                               a phone, to downloads in a browser
  Settings -> Import backup    restores it
  Settings -> Habits as CSV    every habit by day, for a spreadsheet

Do it occasionally. Accounts and sync are milestone 1 of docs/RELEASE.md and
exist mostly to make this section shorter.

Saved state is never trusted. It comes back through hydrate() in store.js,
which coerces every value to the type and range it is supposed to be - habit
colours against a closed palette, divisions against the ladder, day keys
against a date shape - so a hand-edited backup cannot smuggle anything into
the page. hydrate() merges saved state over the blank shape, so new fields
appear on old saves instead of coming back undefined; keep the schema additive
and old installs keep working.

The PIN is a real lock. lock.js derives an AES-GCM key from it with PBKDF2 and
stores only an encrypted check blob, so a wrong PIN fails an auth tag and
nothing leaks. There is no recovery and the sheet says so before you commit.
An import never carries a PIN in: the one on this device stays.

--------------------------------------------------------------------------------
8. ADDING THE NEXT THING
--------------------------------------------------------------------------------

A feature is a folder under www/js/, a route in ROUTES in app.js, its own
slice of the store, and a line in www/sw.js.

One thing to check while you do it: does the layout rule know how many of
something there are? A rule that encodes a count breaks the first time the
count changes, and it breaks silently.

The rule that beats the others: SIMPLE AND EFFECTIVE. Where there is a choice
between a clever answer and a plain one that does the same job, take the plain
one. No second view of the same data, no mode that could have been a setting,
no abstraction with one caller, no feature added because it would round out a
set. Every bad screen in this app's history came from adding rather than
removing - a hub that was a menu of things that did not exist, a Today list
sitting above a grid that already said the same thing - and the fix each time
was to delete something. If a change makes the app easier to describe in one
sentence, it is probably right. If explaining it needs an "and also", stop.
