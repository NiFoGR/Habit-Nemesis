# NiFo

A personal app. One place for the features I actually want — things that measurably improve my life — added one at a time.

Runs entirely on the phone. No account, no server, no analytics, nothing leaves the device.

**Feature 1 — Kegels:** a progressive 12-week pelvic floor training program that measures every single rep, scores the quality of your holds, adapts the difficulty to your performance, and tells you what actually happened at the end of each session.

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

**The program.** Twelve levels, roughly a week each, built on how pelvic floor muscle training is actually prescribed: quick flicks for the fast-twitch fibres and progressively longer endurance holds for the slow-twitch fibres, rest always at least as long as the contraction, progressed by seconds → reps → body position, with reverse kegels and diaphragmatic breathing in every session. Full reasoning and sources: [`docs/KEGEL_PROGRAM.md`](docs/KEGEL_PROGRAM.md).

**Real measurement.** You press and hold the screen for exactly as long as you hold the contraction, so the app records the true length of every rep instead of assuming you did what it asked. That single design decision is what makes everything downstream honest — the quality score, the fatigue curve, the personal bests. A hands-free mode exists for when holding the phone is impractical; sessions recorded that way are flagged as estimated.

**Quality, not just completion.** Every session is scored out of 100 from completion (40), hold fidelity (40) and consistency across the set (20), so fading on the last four reps costs you something and holding longer than asked earns you something — but only if nothing fell short.

**Progression that responds to you.** Score 80+ with full completion three sessions running and you move up a level. Two bad sessions in a row, or one where you flag pain, and the targets drop automatically for a few sessions. Every seventh session is a max-hold test with no target at all, purely to measure your ceiling.

**The debrief.** At the end of every session you get a plain-language account of what just happened in your body, your numbers against your last session, any personal bests, where that puts you on the level ladder, and a closing line that cites your own data rather than cheerleading.

**Tracking.** A 13-week consistency heatmap, hold quality over time, personal-best progression, session scores, level history, badges, a per-rep breakdown of every logged session, and a single Pelvic Floor Index out of 1000 combining strength, volume, level and adherence.

**Details that matter in practice.** Screen stays awake mid-session. Vibration on every phase change so you can train with the phone face down. A programmed weekly release day. Discreet mode renames the whole section to "Core Training". Optional on-screen reminder with no notification permissions involved.

---

## Layout

```
www/                 the entire app — plain ES modules, no build
  index.html
  styles.css
  js/
    app.js           routing, hub, kegels home, guide, settings
    program.js       the 12 levels, scoring, progression, index, badges
    session.js       the guided player and per-rep measurement
    report.js        the end-of-session debrief
    tracking.js      heatmap, charts, log, backups
    store.js         localStorage persistence
    ui.js            formatting, haptics, SVG charts
  sw.js              offline service worker
tools/
  gen-icons.mjs      draws all app and launcher icons from code
  serve.mjs          dev server
docs/
  KEGEL_PROGRAM.md   the training protocol and where it comes from
  BRAINSTORM.md      feature design notes and the backlog
```

## Adding the next feature

`FEATURES` in `www/js/app.js` is the registry the hub renders from. A new feature is an entry there plus a module that renders into `#app` and a route in `ROUTES`. The placeholder tiles on the hub are just strings in `SOON` — replace them as they get built.

---

**This is not medical advice.** It is a training tracker. Pain, urinary or bowel symptoms, or a history of pelvic surgery are reasons to see a doctor or a pelvic health physiotherapist rather than to train harder.
