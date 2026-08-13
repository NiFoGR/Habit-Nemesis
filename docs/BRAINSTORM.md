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
- 12 levels, ~1 week each, each with name, focus, cue, body position and prescription.
- Fast + slow contraction blocks in every session; ramps (graded climb-hold-descend) from level 4.
- Rest always ≥ hold. Breathing warm-up, reverse-kegel cool-down, every session.
- Weekly release day: down-training only, still counts for the streak.
- Every 7th session is a max-hold test with no prescribed target.

### Measurement and scoring
- Score /100 = completion (40) + fidelity (40) + consistency (20) + overhold bonus (≤5).
- Grades S/A/B/C/D. Rep dots live during the set; per-rep bar chart afterwards.
- Missed reps (no press within the grace window) are recorded as misses, not skipped.
- Quitting early saves a partial — remaining reps count as zero. Honest, not punitive.
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

### Practical
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

1. **Reminder notifications via a scheduled local notification** if the app ever ships as an APK with Capacitor's LocalNotifications plugin — that path does not need a server, unlike web push.
2. **Weekly review screen** — a Sunday summary: days trained, total contractions, hold trend, what changed, what to focus on next week.
3. **Symptom / outcome check-in** — an optional weekly 1-5 rating of the things you actually care about improving, plotted against training volume. This is the only way to know whether the training is working rather than just whether it is happening.
4. **Position and "knack" drills as their own block** — pre-brace before a simulated cough, at level 9+.
5. **Adaptive target from the max-hold test** — set the next block's hold target at ~60% of tested max instead of a fixed table, which is how strength training normally prescribes load.
6. **Session presets** — a 90-second "minimum viable session" for days that are falling apart, so the streak survives without pretending it was a full session (logged distinctly).
7. **Widget / quick tile** to start a session from the home screen.
8. **Watch companion** for hands-free hold tracking via wrist input.
9. **Charts with selectable ranges** (30/90/all) once there is enough history for the current fixed windows to feel cramped.
10. **Multiple profiles** — irrelevant for now, but the store schema is already namespaced to allow it.

## Notes for adding NiFo feature #2

The hub renders from `FEATURES` in `www/js/app.js`; placeholders come from `SOON`. A feature needs: an entry in `FEATURES`, a render function, a route in `ROUTES`, and its own slice of the store. Keep the store schema additive — `hydrate()` in `store.js` merges saved state over the blank shape, so new fields appear on old saves instead of coming back `undefined`.


---

# PE

## The design decisions worth remembering

**Safety is a pre-flight check, not a disclaimer.** Every other app puts the warnings in a document nobody opens. `planWarnings()` runs against the actual planned session — this pressure, this duration, your experience level, whether you warmed up, how many days since a rest day — and objects on the setup screen, before the timer starts. A warning you see while choosing 25 kPa is worth fifty pages of general advice.

**Enforced set breaks.** Pump damage comes from unbroken duration more than from peak pressure, so the timer stops every ~10 minutes by itself and tells you to release and inspect. Making the safe thing automatic beats hoping you remember.

**No fabricated precision.** A Hydromax has no gauge. Logging "8.0 kPa" from a water pump would be a made-up number that then pollutes every average and chart. Water pumps get a 1–5 intensity by feel, clearly labelled as a diary entry.

**BPFSL before/after is the real feedback loop.** Erect length moves too slowly to motivate anyone. Stretched flaccid length moves *within a session*, so every stretch session can end with an actual read on whether the tissue responded. The ~5% rule gives it a target.

**The gallery is encrypted, not hidden.** A PIN screen over an unencrypted photo store is decoration. AES-GCM with a PBKDF2-derived key means the bytes in IndexedDB are unreadable without the PIN — verified in the test suite by asserting the stored blob has no JPEG header. The cost is that there is no recovery, and the UI says so before you commit.

**Locks on backgrounding, not just on a timer.** The app-switcher preview is the obvious leak, so the key is dropped the moment the app loses visibility.

**Projections with error bars.** A single projected number would be a lie. The blend of own-data regression and a volume-based prior, weighted by how much data exists, produces a range plus an explicit confidence figure — and it is anchored to trial results (~1.5 cm over 3-6 months) rather than to what would be nice to hear.

**Cross-feature honesty.** Kegels done during a pump session count toward the Kegels streak and lifetime totals but are flagged `countsForPromotion: false`. Following a cadence is not measured reps, and letting it level you up would corrupt the one metric in that feature worth having.

## Deliberately rejected

- **Girth/length "gain calculators" with confident single numbers.** Every PE app has one, and they are all fiction.
- **Photo-based measurement estimation.** Angle, distance and lens distortion swamp the signal. Photos are for morale; the ruler is for measurement, and the compare view says exactly that.
- **Cloud backup of photos.** Obviously not.
- **Gamifying volume.** Achievements deliberately reward warm-ups, consistency, taking a decon break and BPFSL response — not "most hours pumped this week", which would push exactly the wrong behaviour.
- **A "routine builder" with preset programmes.** Considered; the honest version of a PE routine is "traction most days, warm up first, rest weekly", which is already what the app nudges you toward.

## Backlog

1. **Local notifications from the APK build** (Capacitor LocalNotifications) so reminders fire without the app open — the web notification only fires while the page is alive.
2. **Routines**: chain warm-up → stretch → pump → cool-down into one flow with automatic transitions, rather than three separate timers.
3. **Rest-day scheduling and decon planning** — a proper calendar rather than a running counter of consecutive days.
4. **Correlation view**: weekly volume plotted against the following month's measured gain, once there are enough months to say anything. This is the question the whole feature exists to answer.
5. **Photo alignment guides** — a faint outline of the previous photo while framing the new one, so the monthly series is actually comparable.
6. **Export of the encrypted gallery** as a single re-importable file, for phone changes.
7. **EQ (erection quality) tracking** — a weekly 1-10, plotted against training volume. Overtraining shows up here first, before it shows up as injury.
8. **Session presets** per device (extender vs manual vs pump) with their own defaults.
9. **Girth measurement at multiple points** (base, mid, glans) rather than one number.
