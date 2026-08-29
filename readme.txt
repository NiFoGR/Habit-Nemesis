================================================================================
NiFo
A personal app of the few things that measurably improve a life, added one at
a time, running entirely on the phone.
================================================================================

No account. No server. No analytics. Nothing leaves the device. There is no
build step, no bundler and no framework: www/ is the app, plain ES modules,
open the folder and refresh the page.

--------------------------------------------------------------------------------
1. THE SHAPE OF IT
--------------------------------------------------------------------------------

Three rooms, and the grid is the one you land in.

  GRID      now       Every commitment you have is a row: the five the app
                      itself asks of you, and every habit you added. Above it
                      there is nothing but the date and how much of today is
                      left.
  ARENA     where     Your week, scored as a match against a real week out of
            you       your own record. A division, a fixture, a cup when one
            stand     is running.
  CABINET   what      Cups won, feats, years, and the lines you left yourself.
            you have  Nothing in here changes hour to hour.
            done

The bottom bar holds those three and appears nowhere else. Everything deeper
is a pushed screen with a corner arrow, so the reader and the session players
get the whole height.

Two rules on the grid, no exceptions:

  * The name goes there.  Tapping "Kegels" opens the Kegels section; tapping a
                          habit opens that habit's own screen.
  * The cell does it.     Tapping today starts the session, or marks the day.
                          Only today acts. The days behind it are a record.

One theme. One accent, one sans, one set of state colours, so colour answers
"what state is this in" - done, due, missed - and never "which section am I
in". Three deliberate exceptions: a habit's own colour, which you chose; the
serif, used only on scripture and prayer text; and the seven division crests,
which are artwork rather than something the app draws.

A NEW INSTALL IS ONLY THE THREE ROOMS. The five preloaded sections are what
this app is for, not what it is, and the person installing it may be someone
they have nothing to say to. They sit behind one button at the foot of
Settings, which takes a PIN and exactly one attempt: wrong, and the button is
gone for good. It is a door, not a lock - the PIN is a constant in
www/js/nifo.js like any other and nothing is encrypted. It exists so the app
can be handed to a friend. www/js/intro.js is what a locked install is shown
instead, once.

--------------------------------------------------------------------------------
2. THE FIVE
--------------------------------------------------------------------------------

KEGELS - a 104-week pelvic floor program.
  Six phases (Foundation, Control, Strength, Endurance, Power, Mastery) with
  every fourth week a deliberate deload. Five things get harder at once: hold
  length 3s to 20s, holds per session 8 to 20, quick flicks 10 to 30, ramps
  from week 13, rapid pulse sets from week 49; position climbs lying, seated,
  standing, mid-activity.

  It teaches you first - a walkthrough on first open, including the reverse
  kegel, with practice reps on the pad.

  It measures. You press and hold the screen for exactly as long as you hold
  the contraction, so the app records the true length of every rep instead of
  assuming you did what it asked. That is what makes the quality score, the
  fatigue curve and the personal bests honest. A hands-free mode exists;
  sessions recorded that way are flagged as estimated.

  Every session is scored out of 100: completion 40, hold fidelity 40,
  consistency 20. Score 80+ with full completion three sessions running, and
  once six days have been served at the current week, you move up. Two bad
  sessions, or one flagged for pain, and the targets drop for a while. Every
  seventh session is a max-hold test with no target at all.

  Also: a debrief in plain language at the end of every session; a weekly
  review against the seven days before; a 13-week heatmap, hold quality over
  time, per-rep breakdowns and a Pelvic Floor Index out of 1000; pocket mode,
  paced entirely by vibration with a near-black screen, which cannot measure
  and therefore never sets a personal best; a programmed weekly release day;
  a discreet mode that renames the section to "Core Training".
  Reasoning and sources: docs/KEGEL_PROGRAM.md

PE - stretching and pumping, against a two-hour daily target.
  Stretching carries a tension setting up to a 10 kg ceiling; pumping is
  duration only. The countdown runs on wall-clock time, so it keeps counting
  with the screen off or the app closed, and on the APK the end is a real
  Android alarm.

  Limits speak up before you start, not after: planned duration against the
  session guidance, today's total against the two-hour target, and how long
  since a rest day. Pump sessions get enforced set breaks every ~10 minutes.

  Pumping records no intensity at all, because the pump has no gauge and a
  1-5 "by feel" scale is an invention that charts like data.

  BPFSL is taken before and after a stretch session, which is the fastest
  honest feedback loop there is. A monthly check-in takes five measurements,
  none optional, one per screen with a diagram and the method, and warns when
  a reading jumps more than 1.5 cm because that is a typo, not a month.

  The camera overlays a ghost of last month's photo while you frame the new
  one and lets you align it afterwards; the alignment is baked in, so compare
  is honest. The gallery is AES-GCM encrypted with a key derived from your
  PIN, decrypted only in memory, re-locked after two minutes idle and instantly
  when the app is backgrounded. There is no recovery.

  Projection blends your own measured trend with what your volume would
  typically produce, as a range with a confidence figure that narrows as your
  data accumulates. One chart plots minutes a day against millimetres a month
  and can argue against training more - and does, when it should.
  Limits, projection maths and sources: docs/PE_PROGRAM.md

BIBLE - the whole Orthodox canon, bundled with the app.
  76 books, 1,344 chapters, read straight through from Genesis 1 to
  Revelation 22, opening where you left off. No daily portion and no plan,
  because a plan is a thing to fall behind on and the book already has an
  order.

  tools/lib/bible-parse.js reads a PDF export of the Orthodox Study Bible,
  which arrives with kerning turned into spaces ("B lessed is the m an") and
  every chapter opening transposed by its drop cap. Both are undone; about 99%
  of the 35,903 verses come out clean, and where a verse could not be
  recovered the reader says so rather than skipping it quietly.

  Every book has a screen answering the same six questions before you open it
  - who wrote it, when, where it sits in the story, what it is for, what to
  watch for, how the Church reads it toward Christ. The Gospels answer two
  more: who it was written for, and what only this one gives you.

  Prayer lives in this section, because it is the same practice: morning and
  night, both required, Greek and English, the ancient core bundled with room
  for the prayers you say from your own book. One tap to goarch.org for the
  day's readings, the calendar, fasts and saints.
  The parser and why the text ships: docs/BIBLE.md

WIND-DOWN - five minutes of paced breathing, last thing at night.
  Done lying down with the phone on your chest. A long exhale at around six
  breaths a minute, opened with three physiological sighs, paced by a tone
  that rises and falls with the breath and by vibration you can feel through a
  shirt. No score and nothing to beat, because it is the last thing before
  sleep. The screen goes black rather than off.
  Physiology and reasoning: docs/WINDDOWN.md

NIGHT LIGHT - the screen's colour temperature on a curve through the day.
  Across the whole phone, not just this app. Neutral in the morning, warming
  so slowly you never catch it happening, fully warm by bedtime. A Capacitor
  plugin drives Android's own Night Light where the permission allows and
  falls back to an overlay where it does not. It stands down for the PE
  gallery and the monthly check-in, where a colour cast would make a photo
  look like progress or hide it.
  Why the schedule is native, and why two filters: docs/NIGHTLIGHT.md

--------------------------------------------------------------------------------
3. HABITS, WHICH IS THE HOME SCREEN
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

The other five sit along the top of the grid, filled from their own records
and read-only, so there is never a second editable copy of one morning.
The maths, the frequency model and the day boundary: docs/HABITS.md

--------------------------------------------------------------------------------
4. THE ARENA
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

  Bottom G 20   NPC 30   Mentzer 40   Prospect 50   Contender 60
  Menace 70   Locked In 80   Top G 90   Full 100

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

THE ROSTER LOCKS ON MONDAY. A habit added on Wednesday goes on the grid at
once and starts counting next week, because otherwise adding one mid-week
changes the denominator of a match already in progress and you lose a fixture
for the crime of getting more ambitious. Archiving works the same way in
reverse, so you cannot dump the row you are failing.

FEATS, NOT ACHIEVEMENTS. Forty predicates over the record, held to one test:
could you say it out loud to another person and have it mean something? "Held
a contraction for sixty seconds" passes. "Opened the app seven days running"
does not.

THE YEAR - twelve months on a fixed scale, the division you finished each in,
the four Arcs, your best and worst week, and the rows that actually carried
the year.
All of it, including the arguments that were lost: docs/ARENA.md

--------------------------------------------------------------------------------
5. LAYOUT
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
    ui.js           formatting, haptics, notifications, SVG charts, the sheet
    icons.js        the inline SVG icon set and the logo mark
    settings.js     app-wide settings
    lock.js         the optional PIN gate
    nifo.js         whether this install has the five preloaded sections
    intro.js        the introduction, shown once on a new install
    names.js        what each section is called under discreet mode
    native.js       Capacitor bridge for real Android alarms
    nightlight.js   the night light: bridge, settings, browser fallback
    habits/         the grid, which is where you land
    arena/          the Arena, the Cabinet, the Arc, the feats
    kegels/  pe/  bible/  breathe/     one folder per feature
    pray/           the prayer rule, part of the Bible section
  bible/            the scripture itself, one JSON file per book, generated
  img/  icons/      the seven division crests, and the app icons
native/
  nightlight/       Capacitor plugin: the system-wide blue-light filter
  systemui/         Capacitor plugin: hides the Android navigation bar
signing/            the fixed APK key, so updates install over the top
tools/              dev server, icon generation, signing patch, data
                    extraction, and the Arena's calendar check
  lib/              the OSB parser, run by the extractors
CLAUDE.md           the standing rules: comments, writing, structure, theme
docs/
  CODEMAP.md        where every file is and what it does - the map
  KEGEL_PROGRAM.md  the kegel protocol and where it comes from
  PE_PROGRAM.md     PE limits, projection maths, sources
  BIBLE.md          the parser, what it recovers, why the text is bundled
  WINDDOWN.md       the physiology, and why the screen goes black not off
  HABITS.md         the scoring maths, the frequency model, the day boundary
  ARENA.md          weeks, divisions, arcs, feats, the roster lock
  NIGHTLIGHT.md     why the schedule is native, and the two filters
  BRAINSTORM.md     feature design notes and the backlog

Conventions the tree follows: one folder per feature; the same filenames in
each (program.js is domain logic, home.js the section's screens, session.js
the thing that runs); a setting lives where the thing it affects lives; Back
is not a link, it is a data-back attribute that back.js answers for; nothing
ships in www/ that only the tooling needs.

Comments are labels, not prose. Every file opens with one or two lines saying
what it is, a rule gets a line where the code cannot say it, and long files are
split by /* ---- section ---- */ banners, so grep -n "^/\* ---" <file> gives a
table of contents. CLAUDE.md is the full set of rules and is read before any
change.

--------------------------------------------------------------------------------
6. RUNNING IT
--------------------------------------------------------------------------------

  npm run dev                          http://localhost:8080
  node tools/serve.mjs 8080 dist-web   serve the packed copy instead

No build step, no bundler, no framework: edit a file and refresh. On a desktop,
hold Space instead of pressing the screen when testing a session.

  npm run check:arena    the one check in the repo - the Arena's calendar
                         maths (ISO weeks, which month a week belongs to,
                         which arc a month is in) asserted in bare node,
                         because that is the corner whose answers cannot be
                         read off a screen

Everything else is checked by driving it in a real browser: walk every route,
click every control, run every player, and seed the store with fresh /
heavily-used / exactly-one-of-each data, because empty and full both hide the
off-by-one.

Things worth watching for, because a screen cannot tell you it got them wrong:
two screens disagreeing about the same number; a class rendered that the
stylesheet never defines; NaN or undefined reaching the page; anything that
fires without a user gesture (a phone refuses to vibrate or start an
AudioContext without one); and animation on a screen that redraws itself -
nothing that is replaced can move, which is why marking a cell swaps that one
cell instead of re-rendering the page.

Adding a file means adding it to ASSETS in www/sw.js and bumping CACHE.
Forgetting the bump ships code nobody can see.

--------------------------------------------------------------------------------
7. GETTING IT ON A PHONE
--------------------------------------------------------------------------------

ANDROID - build the APK and sideload it. That is the full version, with the
scripture and the night light in it.

  From CI:  Actions tab -> "Build Android APK" -> Run workflow. About four
            minutes. Download the nifo-apk artifact, unzip, move the APK to
            the phone, tap it, allow "install from unknown sources".

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
  to uninstall, which wiped everything.

IPHONE, OR GIVING IT TO SOMEONE - an iPhone cannot sideload, so Add to Home
Screen is the only route, and it is a good one: it installs as a real app,
full screen, offline, with its own icon.

  npm run pack:web                     writes dist-web/, about 1 MB
  node tools/serve.mjs 8080 dist-web   check it first

Then host dist-web/ over HTTPS - any static host - open it in Safari, and
Share -> Add to Home Screen. HTTPS is not optional: a service worker will not
register without it and the app will not work offline.

The easy way is GitHub Pages: .github/workflows/pages.yml builds the packed
copy and deploys it on every push to the default branch. Switch Pages on once
under Settings -> Pages -> Source: GitHub Actions, and the app lives at
https://nifogr.github.io/NiFo-App/ from then on.

WHY THE HOSTED COPY IS NOT www/ ITSELF. pack-web.mjs writes www/ minus
www/bible/. That is 7 MB of the app's 8, for a section a locked install has no
way to open, so the hosted build is about 1 MB instead of about 8. Nothing
downstream has to know: sw.js keeps the scripture in a list of its own and
precaches it best-effort, so on that build those files are a 404 by design and
the app still installs and still works offline. pack-web.mjs measures its own
output, so the build stays small by measurement rather than by intention.

WHAT AN IPHONE DOES NOT GET, because Safari does not have it: reminders, the
night light, and the Android navigation-bar hiding. Every alarm in the app is
scheduled through Capacitor's LocalNotifications, and every one of those calls
returns early when hasAlarms() is false, so on an iPhone the reminder switches
save their time and nothing ever fires. Everything else - the grid, the Arena,
the Cabinet, the sessions, the vibration on newer phones - is the same app.

HANDING THE LINK TO SOMEONE ELSE: docs/INSTALL.md is written for them rather
than for you. Add to Home Screen step by step, what a locked install gets, and
why the backup matters on a phone that can clear its own storage.

--------------------------------------------------------------------------------
8. YOUR DATA
--------------------------------------------------------------------------------

Everything is in the device's local storage, plus IndexedDB for the encrypted
PE photos. Nothing is uploaded anywhere, so nothing can be recovered from
anywhere: reinstalling, clearing browser data or moving phones wipes it.

  Settings -> Export backup    writes a JSON file, through the share sheet on
                               a phone, to downloads in a browser
  Settings -> Import backup    restores it

Do it occasionally. If a backup was made with a different gallery PIN, the
import says so before it makes the photos already on the device unreadable.

Saved state is never trusted. It comes back through hydrate() in store.js,
which coerces every value to the type and range it is supposed to be - book
ids and chapter numbers against the real canon, habit colours against a closed
palette, divisions against the ladder - so a hand-edited backup cannot smuggle
anything into the page. hydrate() merges saved state over the blank shape, so
new fields appear on old saves instead of coming back undefined; keep the
schema additive and old installs keep working.

Two fields hydrate() deliberately defaults the opposite way to blank():
reaching hydrate at all means a saved state exists, so it is an install
already in use, and an update must not take the five off a phone that has been
running them for months.

--------------------------------------------------------------------------------
9. ADDING THE NEXT THING
--------------------------------------------------------------------------------

A feature is a folder under www/js/, a route in ROUTES in app.js, its own
slice of the store, and - if it is something you owe daily - an entry in
LINKED in www/js/habits/program.js, which is what puts it on the home grid as
a row with a start button.

Two things to check while you do it. What does a locked install see? The
router is an allow-list of the open routes for exactly that reason, so a new
section has to be let in on purpose rather than leaking by default. And does
the layout rule know how many of something there are? A rule that encodes a
count breaks the first time the count changes, and it breaks silently - the
section link row was a four-column grid with a comment explaining why a
wrapping row was wrong, and a fifth link then stranded itself for months.

The rule that beats the others: SIMPLE AND EFFECTIVE. Where there is a choice
between a clever answer and a plain one that does the same job, take the plain
one. No second view of the same data, no mode that could have been a setting,
no abstraction with one caller, no feature added because it would round out a
set. Every bad screen in this app's history came from adding rather than
removing - a hub that was a menu of things that did not exist, five section
palettes that made one app look like five, a Today list sitting above a grid
that already said the same thing - and the fix each time was to delete
something. If a change makes the app easier to describe in one sentence, it is
probably right. If explaining it needs an "and also", stop.

--------------------------------------------------------------------------------

THIS IS NOT MEDICAL ADVICE. It is a training tracker. Pain, urinary or bowel
symptoms, a new bend or lump, a change in erection quality, or a history of
pelvic surgery are reasons to see a doctor or a pelvic health physiotherapist
rather than to train harder.
