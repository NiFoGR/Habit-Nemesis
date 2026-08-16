# NiFo

A personal app. One place for the features I actually want — things that measurably improve my life — added one at a time.

Runs entirely on the phone. No account, no server, no analytics, nothing leaves the device.

**Feature 1 — Kegels:** a two-year, 104-week pelvic floor training program that measures every single rep, scores the quality of your holds, adapts to your performance, teaches you the technique from scratch, and tells you what actually happened at the end of each session.

**Feature 2 — PE:** stretching and pumping sessions against a two-hour daily target, safety limits that object *before* you start, a five-measurement monthly check-in with an encrypted photo gallery, before/after BPFSL per session, and a growth projection built from your own data rather than wishful thinking.

The home screen is a **Today** list: what is outstanding across both features, and one button for the most urgent thing.

---

## Getting it on your phone

Two ways. The first takes about thirty seconds.

### Option A — install it as an app from the browser (fastest)

The app is a PWA, so Chrome on Android will install it to your home screen with its own icon, its own window (no browser bar) and full offline support. It behaves like any other installed app.

1. Turn Pages on once: **Settings → Pages → Source: GitHub Actions**. (The
   workflow cannot do this for you — its token is not allowed to create a Pages
   site, so the deploy fails until this is ticked.)
2. Re-run **Actions → Deploy to GitHub Pages**, or push anything to `main`. It
   publishes to `https://nifogr.github.io/NiFo-App/`.
3. Open that link in **Chrome on your phone** → menu (⋮) → **Add to Home screen** / **Install app**.

That is a real installed app: it opens fullscreen, works with no signal, and keeps your data between launches.

### Option B — build an actual APK

If you want a genuine `.apk` file to sideload:

1. Go to the **Actions** tab → **Build Android APK** → **Run workflow**.
2. When it finishes (~4 minutes), open the run and download the **`nifo-apk`** artifact.
3. Unzip it, move `nifo-<sha>.apk` to your phone, tap it, and allow "install from unknown sources" when Android asks.

It is an unsigned debug build, which is exactly what you want for installing on your own phone. It cannot go on the Play Store as-is — that needs a signing key, which is worth doing only if you ever want to share it.

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

**The program runs for two years.** 104 weeks in six phases — Foundation, Control, Strength, Endurance, Power, Mastery — with every fourth week a deliberate deload. Five things get harder at once so the plan never runs out: hold length (3s → 20s), holds per session (8 → 20), quick flicks (10 → 30), ramps from week 13, and rapid pulse sets from week 49. Position climbs lying → seated → standing → mid-activity. Moving up a week needs three good sessions *and* six days served, so it cannot be rushed. The **plan screen** shows all 104 weeks and where you are on them. Full reasoning and sources: [`docs/KEGEL_PROGRAM.md`](docs/KEGEL_PROGRAM.md).

**It teaches you first.** The first time you open Kegels you get a walkthrough, not a session: what the pelvic floor is, how to find it, how to check you are squeezing the right muscle and not your abs, the kegel itself, and — with its own step, because nobody ever explains it — **the reverse kegel**: the exact opposite of a kegel, letting the floor drop down and out instead of lifting it up and in, why that matters, and how to find it by breathing in. Most steps have a practice rep on the pad so you feel it before you are asked to do twenty.

**Real measurement.** You press and hold the screen for exactly as long as you hold the contraction, so the app records the true length of every rep instead of assuming you did what it asked. That single design decision is what makes everything downstream honest — the quality score, the fatigue curve, the personal bests. A hands-free mode exists for when holding the phone is impractical; sessions recorded that way are flagged as estimated.

**Quality, not just completion.** Every session is scored out of 100 from completion (40), hold fidelity (40) and consistency across the set (20), so fading on the last four reps costs you something and holding longer than asked earns you something — but only if nothing fell short.

**Progression that responds to you.** Score 80+ with full completion three sessions running, and once you have served your six days at the current week, you move up. Two bad sessions in a row, or one where you flag pain, and the targets drop automatically for a few sessions. Every seventh session is a max-hold test with no target at all, purely to measure your ceiling.

**The debrief.** At the end of every session you get a plain-language account of what just happened in your body, your numbers against your last session, any personal bests, where that puts you on the level ladder, and a closing line that cites your own data rather than cheerleading.

**Tracking.** A 13-week consistency heatmap, hold quality over time, personal-best progression, session scores, level history, badges, a per-rep breakdown of every logged session, and a single Pelvic Floor Index out of 1000 combining strength, volume, level and adherence.

**Pocket mode.** The same session paced entirely by vibration, with a near-black screen you can leave face down — for a desk, a bus, a queue. Distinct buzz patterns for squeeze, quick flick, release and new block. There is no input, so there is no per-rep measurement: those sessions are scored from your own rating, marked estimated everywhere they appear, and never set a personal best.

**Your week, once a week.** A review comparing the last seven days with the seven before — sessions, days trained, average score, time under tension, contractions, best hold — each with a delta, plus one sentence saying what to actually change.

**Details that matter in practice.** Screen stays awake mid-session. Vibration on every phase change so you can train with the phone face down. A programmed weekly release day. Discreet mode renames the whole section to "Core Training". Optional reminder, scheduled as a real Android alarm on the APK.

---

## What is in the PE feature

**Two things only: stretching and pumping.** Stretching carries a tension setting up to a **10 kg ceiling**; pumping is duration only. The countdown runs on wall-clock time, so it keeps counting with the screen off or the app closed, and on the APK the end is scheduled as a real Android alarm that rings even if the app has been killed.

**The target is two hours of stretching a day** — as much as you can manage, up to that. The PE home screen is a ring against it, the Today list counts it, and the warnings measure against it.

**Limits that speak up first.** A planned session is checked before it starts: duration against the session guidance, how much you have already done today against the two-hour target, and how many days you have gone without a rest day. Pump sessions get enforced set breaks — the timer stops every ~10 minutes and tells you to release and check the skin.

**Your Hydromax has no gauge**, so pumping records **no intensity at all**. A pressure reading would be invented, and a 1–5 "by feel" scale is the same invention with extra steps — it charts like data and is not. What gets stored is the clock and the breaks, because that is what is real.

**BPFSL before and after.** Bone-pressed flaccid stretched length taken either side of a stretch session is the fastest feedback loop available — it moves within one session, months before erect length does. About +5% means the tissue took the load, and the app tells you which side of that you landed on.

**Kegels while pumping.** Optional cadence during a pump session, using the hold length from whatever Kegels level you are on. Completed cycles are logged to both features, so the day counts for your Kegels streak too — but they cannot level you up there, because following a cadence is not the same as measured reps.

**Monthly check-in, five measurements, none optional.** BP flaccid stretched length, BP erect length, NBP erect length, erect girth at the thickest point, and erect girth at the very base. One per screen, each with a diagram, the exact method and why it is being asked for. The form warns when a reading jumps more than 1.5 cm, because that is a typo or a changed method, not a month of growth.

**Photos that are actually comparable.** The camera overlays a translucent ghost of last month's photo while you frame the new one, then lets you drag and zoom it into alignment afterwards. The alignment is baked into the saved image, so the compare view is honest.

**The gallery is encrypted, not hidden.** Photos are AES-GCM encrypted with a key derived from your PIN, stored as ciphertext, and decrypted only in memory while you are looking at them. It re-locks after two minutes idle and instantly when you background the app. There is no recovery — losing the PIN means losing the photos, which is the point.

**Projection.** A growth estimate blending your own measured trend with what your training volume would typically produce, shown as a range with a confidence figure that narrows as your own data accumulates. Traction trials average roughly 1.5 cm over 3–6 months, and the app says so rather than flattering you.

**Do the hours pay?** Each gap between check-ins is plotted as average minutes a day against millimetres a month, with a trend line. It is the one chart in the app that can argue against training more — and it does, when the correlation goes the wrong way.

**Girth map.** Thickest-point girth against base girth over time, with the gap between them called out, because pumping tends to move the middle before the base.

**Everything tracked forever**, with 7d / 30d / 90d / 6m / 1y / all-time selectors across the charts, plus achievements, insights drawn from your actual numbers, and a full session log.

Reasoning, safety numbers and sources: [`docs/PE_PROGRAM.md`](docs/PE_PROGRAM.md).

## Layout

```
www/                 the entire app — plain ES modules, no build
  index.html
  styles.css
  js/
    app.js           routing, Today hub, kegels home, guide, settings, app lock
    program.js       the 104-week plan, scoring, progression, index, badges
    session.js       the guided player and per-rep measurement
    tutorial.js      the technique walkthrough, incl. the reverse kegel
    roadmap.js       all 104 weeks and the six phases
    pocket.js        vibration-only session pacing
    review.js        the weekly review
    report.js        the end-of-session debrief
    tracking.js      heatmap, charts, log, backups
    store.js         localStorage persistence and input sanitising
    ui.js            formatting, haptics, notifications, SVG charts
    icons.js         the inline SVG icon set and the logo mark
    native.js        Capacitor local notifications (real Android alarms)
    pe/
      program.js     session types, safety limits, projection, achievements
      home.js        PE home and the one-time safety gate
      timer.js       session runner, set breaks, kegel-during-pump
      measure.js     the five-measurement monthly check-in
      camera.js      ghost-overlay photo capture and alignment
      gallery.js     encrypted gallery, viewer, compare
      stats.js       charts, period selector, projection, log
      guide.js       technique and safety reference
      vault.js       PIN-derived AES-GCM encryption
      db.js          IndexedDB photo storage + image downscaling
      pin.js         PIN keypad and unlock flow
  sw.js              offline service worker
tools/
  gen-icons.mjs      draws all app and launcher icons from code
  serve.mjs          dev server
docs/
  KEGEL_PROGRAM.md   the kegel protocol and where it comes from
  PE_PROGRAM.md      PE safety limits, projection maths and sources
  BRAINSTORM.md      feature design notes and the backlog
```

## Adding the next feature

`FEATURES` in `www/js/app.js` is the registry the section tiles render from, and `todayTasks()` builds the Today list. A new feature is an entry in both, plus a module that renders into `#app` and a route in `ROUTES`. Keep the store schema additive — `hydrate()` in `store.js` merges saved state over the blank shape, so new fields appear on old saves instead of coming back `undefined`.

---

**This is not medical advice.** It is a training tracker. Pain, urinary or bowel symptoms, a new bend or lump, a change in erection quality, or a history of pelvic surgery are reasons to see a doctor or a pelvic health physiotherapist rather than to train harder.
