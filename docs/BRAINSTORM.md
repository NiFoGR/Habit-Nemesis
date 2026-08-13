# Kegel feature — design notes and backlog

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
