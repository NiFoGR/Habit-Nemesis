# NiFo

A personal app. One place for the features I actually want, things that measurably improve my life, added one at a time.

Runs entirely on the phone. No account, no server, no analytics, nothing leaves the device.

**Feature 1 - Kegels:** a two-year, 104-week pelvic floor training program that measures every single rep, scores the quality of your holds, adapts to your performance, teaches you the technique from scratch, and tells you what actually happened at the end of each session.

**Feature 2 - PE:** stretching and pumping sessions against a two-hour daily target, safety limits that object *before* you start, a five-measurement monthly check-in with an encrypted photo gallery, before/after BPFSL per session, and a growth projection built from your own data rather than wishful thinking.

**Feature 3 - Bible:** the whole Orthodox canon read straight through, Genesis 1 to Revelation 22, parsed from a copy of the Orthodox Study Bible and bundled with the app. A screen for every book saying what it is before you open it, a record of everything you have read, and the morning and night prayer rule, which lives in the same section because it is the same practice.

**Feature 4 - Wind-down:** five minutes of paced breathing as the last thing in the day, done lying down with the phone on your chest. A long exhale at around six breaths a minute, opened with three physiological sighs, paced by a tone that rises and falls with the breath and by vibration you can feel through a shirt. No score and nothing to beat, because it is the last thing before sleep. [`docs/WINDDOWN.md`](docs/WINDDOWN.md).

**Feature 5 - Night light:** the screen's colour temperature on a curve through the day, across the whole phone rather than just this app. Neutral in the morning, warming so slowly you never catch it happening, fully warm by bedtime. A Capacitor plugin drives Android's own Night Light where it is allowed to and falls back to an overlay where it is not. [`docs/NIGHTLIGHT.md`](docs/NIGHTLIGHT.md).

The home screen is a **Today** list: what is outstanding across all four features, and one button for the most urgent thing.

Each section has its own palette. Kegels is teal on cool graphite, PE violet on deep plum, Bible the deep red of a Gospel book with a serif face, Wind-down indigo on near-black because it is used in an unlit room. One skeleton, four rooms.

---

## Getting it on your phone

Build the APK and sideload it.

### Why there is no web install

There used to be a second route: GitHub Pages served `www/`, and Chrome on
Android installed it as a PWA. That is gone, and it must stay gone.

`www/bible/` now holds the full text of the Orthodox Study Bible. Shipping that
inside an APK you install on your own phone is a personal copy of a book you
own. Publishing it to a website is redistributing a commercial translation, and
**GitHub Pages is public even when the repository is private** — private Pages
needs an Enterprise plan. So the deploy workflow has been deleted rather than
merely disabled, because a disabled workflow is one click away from being a
copyright problem. [`docs/BIBLE.md`](docs/BIBLE.md) explains the line in full.

If Pages was ever switched on for this repository, turn it off in
**Settings → Pages → Source: None**.

### Build an actual APK

1. Go to the **Actions** tab → **Build Android APK** → **Run workflow**.
2. When it finishes (~4 minutes), open the run and download the **`nifo-apk`** artifact.
3. Unzip it, move `nifo-<sha>.apk` to your phone, tap it, and allow "install from unknown sources" when Android asks.

It is a debug build, which is exactly what you want for installing on your own phone. Every APK is signed with the same committed key (`signing/`), so **updates install straight over the top and your data survives**. Before that key existed, CI generated a throwaway one per build, Android refused the update, and the only way in was to uninstall, which wiped everything. It cannot go on the Play Store as-is, that needs a signing key, which is worth doing only if you ever want to share it.

To build it locally instead, you need Node and the Android SDK, then:

```bash
npm install
npx cap add android
node tools/gen-icons.mjs --android
npx cap sync android
cd android && ./gradlew assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Backups matter

Data lives in the device's local storage. Reinstalling the app, clearing browser data, or moving phones will wipe it. **Tracking → Export backup** writes a JSON file; **Import backup** restores it. Do this occasionally.

---

## Running it on a computer

```bash
npm run dev          # http://localhost:8080
```

No build step, no bundler, no framework. Open the folder, edit a file, refresh.

Hold `Space` instead of pressing the screen when testing on a desktop.

---

## What is in the Kegels feature

**The program runs for two years.** 104 weeks in six phases. Foundation, Control, Strength, Endurance, Power, Mastery, with every fourth week a deliberate deload. Five things get harder at once so the plan never runs out: hold length (3s → 20s), holds per session (8 → 20), quick flicks (10 → 30), ramps from week 13, and rapid pulse sets from week 49. Position climbs lying → seated → standing → mid-activity. Moving up a week needs three good sessions *and* six days served, so it cannot be rushed. The **plan screen** shows all 104 weeks and where you are on them. Full reasoning and sources: [`docs/KEGEL_PROGRAM.md`](docs/KEGEL_PROGRAM.md).

**It teaches you first.** The first time you open Kegels you get a walkthrough, not a session: what the pelvic floor is, how to find it, how to check you are squeezing the right muscle and not your abs, the kegel itself, and, with its own step, because nobody ever explains it, **the reverse kegel**: the exact opposite of a kegel, letting the floor drop down and out instead of lifting it up and in, why that matters, and how to find it by breathing in. Most steps have a practice rep on the pad so you feel it before you are asked to do twenty.

**Real measurement.** You press and hold the screen for exactly as long as you hold the contraction, so the app records the true length of every rep instead of assuming you did what it asked. That single design decision is what makes everything downstream honest, the quality score, the fatigue curve, the personal bests. A hands-free mode exists for when holding the phone is impractical; sessions recorded that way are flagged as estimated.

**Quality, not just completion.** Every session is scored out of 100 from completion (40), hold fidelity (40) and consistency across the set (20), so fading on the last four reps costs you something and holding longer than asked earns you something, but only if nothing fell short.

**Progression that responds to you.** Score 80+ with full completion three sessions running, and once you have served your six days at the current week, you move up. Two bad sessions in a row, or one where you flag pain, and the targets drop automatically for a few sessions. Every seventh session is a max-hold test with no target at all, purely to measure your ceiling.

**The debrief.** At the end of every session you get a plain-language account of what just happened in your body, your numbers against your last session, any personal bests, where that puts you on the level ladder, and a closing line that cites your own data rather than cheerleading.

**Tracking.** A 13-week consistency heatmap, hold quality over time, personal-best progression, session scores, level history, badges, a per-rep breakdown of every logged session, and a single Pelvic Floor Index out of 1000 combining strength, volume, level and adherence.

**Pocket mode.** The same session paced entirely by vibration, with a near-black screen you can leave face down, for a desk, a bus, a queue. Distinct buzz patterns for squeeze, quick flick, release and new block. There is no input, so there is no per-rep measurement: those sessions are scored from your own rating, marked estimated everywhere they appear, and never set a personal best.

**Your week, once a week.** A review comparing the last seven days with the seven before, sessions, days trained, average score, time under tension, contractions, best hold, each with a delta, plus one sentence saying what to actually change.

**Details that matter in practice.** Screen stays awake mid-session. Vibration on every phase change so you can train with the phone face down. A programmed weekly release day. Discreet mode renames the whole section to "Core Training". Optional reminder, scheduled as a real Android alarm on the APK.

---

## What is in the PE feature

**Two things only: stretching and pumping.** Stretching carries a tension setting up to a **10 kg ceiling**; pumping is duration only. The countdown runs on wall-clock time, so it keeps counting with the screen off or the app closed, and on the APK the end is scheduled as a real Android alarm that rings even if the app has been killed.

**The target is two hours of stretching a day**, as much as you can manage, up to that. The PE home screen is a ring against it, the Today list counts it, and the warnings measure against it.

**Limits that speak up first.** A planned session is checked before it starts: duration against the session guidance, how much you have already done today against the two-hour target, and how many days you have gone without a rest day. Pump sessions get enforced set breaks, the timer stops every ~10 minutes and tells you to release and check the skin.

**Your Hydromax has no gauge**, so pumping records **no intensity at all**. A pressure reading would be invented, and a 1–5 "by feel" scale is the same invention with extra steps, it charts like data and is not. What gets stored is the clock and the breaks, because that is what is real.

**BPFSL before and after.** Bone-pressed flaccid stretched length taken either side of a stretch session is the fastest feedback loop available, it moves within one session, months before erect length does. About +5% means the tissue took the load, and the app tells you which side of that you landed on.

**Kegels while pumping.** Optional cadence during a pump session, using the hold length from whatever Kegels level you are on. Completed cycles are logged to both features, so the day counts for your Kegels streak too, but they cannot level you up there, because following a cadence is not the same as measured reps.

**Monthly check-in, five measurements, none optional.** BP flaccid stretched length, BP erect length, NBP erect length, erect girth at the thickest point, and erect girth at the very base. One per screen, each with a diagram, the exact method and why it is being asked for. The form warns when a reading jumps more than 1.5 cm, because that is a typo or a changed method, not a month of growth.

**Photos that are actually comparable.** The camera overlays a translucent ghost of last month's photo while you frame the new one, then lets you drag and zoom it into alignment afterwards. The alignment is baked into the saved image, so the compare view is honest.

**The gallery is encrypted, not hidden.** Photos are AES-GCM encrypted with a key derived from your PIN, stored as ciphertext, and decrypted only in memory while you are looking at them. It re-locks after two minutes idle and instantly when you background the app. There is no recovery, losing the PIN means losing the photos, which is the point.

**Projection.** A growth estimate blending your own measured trend with what your training volume would typically produce, shown as a range with a confidence figure that narrows as your own data accumulates. Traction trials average roughly 1.5 cm over 3–6 months, and the app says so rather than flattering you.

**Do the hours pay?** Each gap between check-ins is plotted as average minutes a day against millimetres a month, with a trend line. It is the one chart in the app that can argue against training more, and it does, when the correlation goes the wrong way.

**Girth map.** Thickest-point girth against base girth over time, with the gap between them called out, because pumping tends to move the middle before the base.

**Everything tracked forever**, with 7d / 30d / 90d / 6m / 1y / all-time selectors across the charts, plus achievements, insights drawn from your actual numbers, and a full session log.

Reasoning, safety numbers and sources: [`docs/PE_PROGRAM.md`](docs/PE_PROGRAM.md).

## What is in the Bible feature

**The scripture ships with the app.** This repository is private, which is what makes that the right call rather than a public redistribution of a commercial translation. There is no import step: open the section and it is already there. Reasoning and the numbers: [`docs/BIBLE.md`](docs/BIBLE.md).

**It reads straight through.** Genesis 1 to Revelation 22, next and previous, opening where you left off. There is no daily portion and no plan, because a plan is a thing to fall behind on and the book already has an order.

**The parser repairs what the PDF export broke.** A conversion of a print Bible arrives with the kerning turned into spaces, so the whole Psalter reads `B lessed is the m an`, and with every chapter opening transposed by its drop cap, which loses verse 1 of all 1,344 chapters. Both are undone: about **99% of the 35,903 verses come out clean**. Where a verse could not be recovered the reader says so rather than skipping it quietly, because a hole you cannot see is worse. `tools/extract-bible-text.mjs` runs the parser and regenerates the bundled text if you ever get a cleaner export.

**The real canon, from your own edition.** 76 books with the per-chapter verse counts read out of the OSB's own index, so the Psalms number 151 on Septuagint numbering, the four books of Kingdoms are called that, and Tobit, Judith, the three books of Maccabees, Wisdom, Sirach and Baruch are all there.

**A screen for every book, before you open it.** The same six questions for all 76: who wrote it, when, where it sits in the story, what it is for, what to watch for while you read, and how the Church reads it toward Christ. The four Gospels answer two more, which are the only two that actually distinguish four accounts of the same events: **who it was written for, and what only this one gives you.**

**The rule, in the same room.** Morning and night, both required, in Greek and English, with the ancient core bundled and room for the prayers you say yourself from your own book. Streaks, per-slot streaks and a 13-week heatmap.

**What you have read.** Chapter by chapter, marked as you reach the end of one, with a heatmap, a streak, a bar per part of the canon and books finished. A chapter is the unit because it is the largest thing you can honestly say you either read or did not.

**One tap to goarch.org** for the day's readings, the calendar, fasts and saints.

## Layout

```
www/               the entire app, plain ES modules, no build
  js/
    app.js         route table, shell state, boot
    hub.js         the Today screen and the feature registry
    settings.js    app-wide settings
    lock.js        the optional PIN gate
    names.js       what each section is called
    store.js       persistence and input sanitising
    ui.js          formatting, haptics, notifications, SVG charts
    icons.js       the inline SVG icon set
    native.js      real Android alarms via Capacitor
    nightlight.js  the night light bridge, settings and browser fallback
    kegels/        the Kegels feature
    pe/            the PE feature
    bible/         the Bible feature and reader
    pray/          the prayer rule, part of the Bible section
    breathe/       the wind-down
  bible/           the scripture itself, one JSON file per book, generated
  sw.js            offline service worker
native/
  nightlight/      Capacitor plugin: the system-wide blue-light filter
signing/           the fixed APK key, so updates install over the top
tools/             icon generation, signing patch, dev server, data extraction
docs/
  CODEMAP.md       where every file is and what it does
  KEGEL_PROGRAM.md the kegel protocol and where it comes from
  PE_PROGRAM.md    PE limits, projection maths and sources
  BIBLE.md         the parser, what it recovers, and why the text is bundled
  WINDDOWN.md      the physiology, and why the screen goes black not off
  NIGHTLIGHT.md    why the schedule is native, and the two filters
  BRAINSTORM.md    feature design notes and the backlog
```

**[`docs/CODEMAP.md`](docs/CODEMAP.md) is the map.** One folder per feature,
the same filenames in each, and a setting lives where the thing it affects
lives.

## Adding the next feature

`FEATURES` in `www/js/hub.js` is the registry the section tiles render from, and `todayTasks()` beside it builds the Today list. A new feature is an entry in both, plus a module that renders into `#app` and a route in `ROUTES`. Keep the store schema additive, `hydrate()` in `store.js` merges saved state over the blank shape, so new fields appear on old saves instead of coming back `undefined`.

---

**This is not medical advice.** It is a training tracker. Pain, urinary or bowel symptoms, a new bend or lump, a change in erection quality, or a history of pelvic surgery are reasons to see a doctor or a pelvic health physiotherapist rather than to train harder.
