# Feature design notes and backlog

## Kegels

Where the ideas came from, which ones got built, and which ones are parked. Kept so future-me does not re-solve solved problems or rebuild something that was deliberately rejected.

## The core insight

Every kegel app has the same fatal flaw: it is a **timer that assumes you complied**. It counts sessions, not contractions. It cannot tell a real 10-second hold from a phone sitting on the table.

NiFo's answer is **press-and-hold input**. You hold the screen for exactly as long as you hold the contraction. It costs nothing, it is discreet, it works one-handed in bed, and it converts the whole feature from a compliance log into an actual measurement instrument. Everything good in this design falls out of that one decision:

- a per-rep record → a real quality score, not a checkbox
- a fatigue curve within a set → feedback nobody else gives
- an honest personal-best hold → a number that visibly moves over weeks
- progression that responds to performance instead of the calendar

## What got built

### Program
- **104 weeks in six phases**, generated from a model rather than hand-written, with a deload every fourth week. Twelve hand-written levels ran out of progression in three months; this one overloads for two years.
- Promotion needs **time served (6 days) as well as three good sessions**, so a strong week cannot collapse the ladder.
- Fast + slow contraction blocks in every session; ramps (graded climb-hold-descend) from week 13; rapid pulse sets from week 49.
- Rest always ≥ hold. Breathing warm-up, reverse-kegel cool-down, every session.
- Weekly release day: down-training only, still counts for the streak.
- Every 7th session is a max-hold test with no prescribed target.

### Measurement and scoring
- Score /100 = completion (40) + fidelity (40) + consistency (20) + overhold bonus (≤5).
- Grades S/A/B/C/D. Rep dots live during the set; per-rep bar chart afterwards.
- Missed reps (no press within the grace window) are recorded as misses, not skipped.
- Quitting early saves a partial, remaining reps count as zero. Honest, not punitive.
- Hands-free mode for when holding the phone is impractical; those sessions are flagged "estimated" everywhere they appear.

### Progression
- 3 sessions at 80+ with full completion → level up.
- 2 consecutive sessions under 55 → deload (targets ×0.75 for 2 sessions).
- Pain flag → immediate 3-session deload. Pain is a stop sign, not a challenge.
- Bonus same-day sessions are logged but never accelerate promotion.

### Feedback
- End-of-session debrief: a plain-language account of what the session physically did, numbers vs. last session, fatigue-curve read, PRs, badges, level progress, and a closing line built from the user's own data.
- Pelvic Floor Index /1000: strength + volume + level + adherence in one number.

### Tracking
- 13-week heatmap, hold-quality trend, PR-hold trend, score trend, level history, badges, expandable per-session log with rep bars, JSON export/import.

### Teaching
- **First-run walkthrough**, seven steps, most with a practice rep on the hold pad: what the pelvic floor is, finding it, checking you have the right muscle, the kegel, **the reverse kegel**, what a session looks like, what to expect. Opens automatically on a genuinely fresh install; a link afterwards.
- The reverse kegel gets its own step and its own deep link (`#/tutorial?step=reverse`), because it is the instruction people most often meet with no explanation attached.
- **Roadmap screen**, all 104 weeks, six phases, what changes in each, where you are, and an ETA per phase from your actual pace.

### Practical
- **Pocket mode**, the same session paced entirely by vibration, with a near-black screen you can leave face down. Distinct buzz patterns for squeeze / flick / release / new block. No input means no per-rep measurement, so it is logged as estimated and never sets the max-hold PR.
- **Weekly review**, this week against last, six metrics with deltas, and one sentence saying what to change. Offered once a week.
- Wake lock during sessions. Haptics on every phase change (train with the screen face down). Optional sound cues.
- Discreet mode renames the section to "Core Training".
- Offline-first PWA; installs to the home screen; also builds to an APK.
- On-screen reminder that needs no notification permission.

## Deliberately rejected

- **Push notifications.** Requires permission prompts and a service worker push endpoint, i.e. a server. Not worth it for a single-user app. An in-app nudge covers 90% of the value.
- **Streak freezes / repair tokens.** Gamified dishonesty. The heatmap should show what happened.
- **Losing the streak on a missed day being softened.** Same reason. A missed day is a missed day; the release day already builds in legitimate rest.
- **Leaderboards / social.** Obviously not.
- **Cloud sync.** Would mean an account and a server for data that is nobody else's business. Export/import covers phone changes.
- **A "guided voice" coach.** Recording or TTS adds weight; the ring, the vibration and one line of cue text do the job.

## Backlog, roughly in order of value

1. **Reminder notifications via a scheduled local notification** if the app ever ships as an APK with Capacitor's LocalNotifications plugin, that path does not need a server, unlike web push.
2. **Symptom / outcome check-in**, an optional weekly 1-5 rating of the things you actually care about improving, plotted against training volume. This is the only way to know whether the training is working rather than just whether it is happening.
3. **Widget / quick tile** to start a session from the home screen.
4. **Watch companion** for hands-free hold tracking via wrist input.
5. **Multiple profiles**, irrelevant for now, but the store schema is already namespaced to allow it.

Built since this list was written: weekly review, the "knack" drills (the Power phase is built around the pre-brace), the adaptive target from the max-hold test (prescribed holds are capped at ~60% of tested max), the 90-second quick session, and selectable chart ranges.

## Notes for adding the next NiFo feature

The hub is a **Today screen**: `todayTasks()` in `www/js/app.js` builds the outstanding list across every feature, and the tiles below it render from `FEATURES`. A feature needs: an entry in `FEATURES`, a line in `todayTasks()` if it has a daily obligation, a render function, a route in `ROUTES`, and its own slice of the store. Keep the store schema additive, `hydrate()` in `store.js` merges saved state over the blank shape, so new fields appear on old saves instead of coming back `undefined`.

There is no "coming soon" list any more. A tile for something that does not exist is a promise the app cannot keep, and it made the hub read as mostly empty.


---

# PE

## The design decisions worth remembering

**One target, stated everywhere.** Two hours of stretching a day at no more than 10 kg. The PE home screen is a ring against it, the Today hub counts it, the warnings measure against it, and two achievements are defined by it. A goal that only appears in a settings screen is not a goal.

**Safety is a pre-flight check, not a disclaimer.** Every other app puts the warnings in a document nobody opens. `planWarnings()` runs against the actual planned session, this duration, this tension, your experience level, how much you have already done today, how many days since a rest day, and objects on the setup screen, before the timer starts.

**Enforced set breaks.** Pump damage comes from unbroken duration more than from peak pressure, so the timer stops every ~10 minutes by itself and tells you to release and inspect. Making the safe thing automatic beats hoping you remember.

**No fabricated precision.** A Hydromax has no gauge. Logging "8.0 kPa" from a water pump would be a made-up number that then pollutes every average and chart, and a 1–5 "by feel" scale, which is what the first version did, is the same invention with extra steps: it charts like data and is not. Pumping now records **duration only**. What is real is the clock and the enforced set breaks.

**BPFSL before/after is the real feedback loop.** Erect length moves too slowly to motivate anyone. Stretched flaccid length moves *within a session*, so every stretch session can end with an actual read on whether the tissue responded. The ~5% rule gives it a target.

**The gallery is encrypted, not hidden.** A PIN screen over an unencrypted photo store is decoration. AES-GCM with a PBKDF2-derived key means the bytes in IndexedDB are unreadable without the PIN, verified in the test suite by asserting the stored blob has no JPEG header. The cost is that there is no recovery, and the UI says so before you commit.

**Locks on backgrounding, not just on a timer.** The app-switcher preview is the obvious leak, so the key is dropped the moment the app loses visibility.

**Projections with error bars.** A single projected number would be a lie. The blend of own-data regression and a volume-based prior, weighted by how much data exists, produces a range plus an explicit confidence figure, and it is anchored to trial results (~1.5 cm over 3-6 months) rather than to what would be nice to hear.

**Cross-feature honesty.** Kegels done during a pump session count toward the Kegels streak and lifetime totals but are flagged `countsForPromotion: false`. Following a cadence is not measured reps, and letting it level you up would corrupt the one metric in that feature worth having.

## Deliberately rejected

- **Girth/length "gain calculators" with confident single numbers.** Every PE app has one, and they are all fiction.
- **Photo-based measurement estimation.** Angle, distance and lens distortion swamp the signal. Photos are for morale; the ruler is for measurement, and the compare view says exactly that.
- **Cloud backup of photos.** Obviously not.
- **Gamifying volume.** Achievements deliberately reward warm-ups, consistency, taking a decon break and BPFSL response, not "most hours pumped this week", which would push exactly the wrong behaviour.
- **A "routine builder" with preset programmes.** Considered; the honest version of a PE routine is "traction most days, warm up first, rest weekly", which is already what the app nudges you toward.

## Removed after the first version

**Warm-up as a session type, and routines.** Warming up is an instruction in the guide, not a thing to log; a "warm-up" entry in the volume chart made ten minutes with a rice sock look like training. Routines chained types that no longer exist. Stretching and pumping are the only two things you can log.

**Pump intensity.** See above, it was a number the device could not actually give.

**Jelqing and clamping.** Both are anecdote-only, and clamping is the easiest way to injure yourself of anything in common use. Cutting them leaves stretching (the only method with trial evidence) and pumping (girth and conditioning), which is what the feature is actually for. Retired types still render under their own names so old logs are not silently relabelled as something the user never did.

## Backlog

1. **Rest-day scheduling and decon planning**, a proper calendar rather than a running counter of consecutive days.
2. **Export of the encrypted gallery** as a single re-importable file, for phone changes.
3. **Session presets** per device (extender vs manual) with their own defaults.

Built since this list was written: local notifications from the APK build, the volume→gain correlation view ("Do the hours pay?"), the ghost-overlay photo capture with an alignment step, EQ tracking, and girth at two points (thickest and base) with the girth map that reads them against each other.

## App-wide

**Today, not a menu.** The hub asks "what is left today" and gives one button for the most urgent thing. A menu makes you decide before you can act, which is where a habit dies.

**App lock reuses the gallery PIN.** Two PINs for one app is how people end up writing them down. It re-arms on backgrounding, except while a session is running, a timer against a real contraction must not be thrown away because a message came in. It is also described honestly in settings: a door, not a safe. Only the photos are encrypted.
