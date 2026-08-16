# The kegel program: what it is and where it comes from

Notes behind the training plan in `www/js/program.js`. Written down so the numbers in the app are traceable to something rather than invented.

## The short version

There is **no single agreed protocol**. Published pelvic floor muscle training (PFMT) programs range from 5 to 200 contractions a day, and reviews say plainly that consensus on the exact dose does not exist. What they broadly agree on is the shape:

| Variable | Common range in the literature | What NiFo does |
|---|---|---|
| Contraction hold | 3–5s at the start, progressing to 8–10s+ | 3s at week 1 → 20s at week 103 |
| Rest between holds | at least equal to the hold | always ≥ the hold, never less |
| Reps per set | 8–15 | 8 → 20 |
| Sets per day | 2–3 (some intensive protocols use 6) | 2 by default, configurable 1–3 |
| Frequency | 3–7 days a week, daily is common | 6 training days + 1 release day |
| Fast contractions | 10 × ~1s alongside the slow work | 10 → 30 quick flicks per session |
| Program length | 12–20 weeks before judging results | 104 weeks, in six phases, then maintenance |
| Daily ceiling | keep total work under ~15 min | every week lands well under 15 min |

## The five principles the app is built on

### 1. Two fibre types, two kinds of rep

The pelvic floor contains both slow-twitch fibres (postural tone, endurance) and fast-twitch fibres (the rapid contraction that closes the urethra when abdominal pressure spikes from a cough, sneeze or lift). Quick contractions of about one second train the fast fibres; sustained holds train the slow ones. Training only one leaves half the muscle untouched, which is why intensive published protocols pair **10 fast (1s) with 10 slow (10s) contractions** in the same set.

Every NiFo session runs both blocks, in that order — flicks while fresh, holds after.

### 2. Rest at least as long as you hold

Protocols specify contraction and relaxation of **equal duration**. Under-resting means each rep starts more fatigued than the last, which turns a strength session into an endurance grind and is one of the most common reasons people stall. The app enforces this: the rest interval after a hold is never shorter than the hold itself, and it scales up automatically as targets grow.

### 3. Progressive overload, in a specific order

Progression is by **duration first, then repetitions, then sets**, and separately by **body position** — lying is easiest, sitting is harder, standing is harder again, and contracting under load (before a cough, lift or step) is hardest and most functional. Contractions beyond 10 seconds fatigue many people, but longer contraction time is associated with strength and endurance gains, so the ceiling should move upward within tolerance rather than being fixed.

NiFo moves five things at once, so no single variable has to carry the whole two years:

| Variable | Week 1 | Week 103 | Notes |
|---|---|---|---|
| Hold length | 3.0s | 20.0s | `3000 + 17000·t^0.85`, capped at 20s — past that a hold stops being productive |
| Holds per session | 8 | 20 | |
| Quick flicks | 10 | 30 | |
| Ramps | — | 6 | Introduced at week 13: climb in five steps, hold, descend in five |
| Rapid pulse sets | — | 2 × 10 | Introduced at week 49 |

Position climbs with the phase: lying → seated → standing → standing under load → any position mid-activity. The Power phase (weeks 65–84) is built around the pre-brace ("the knack") — contracting *before* a cough, lift or sneeze — which is the reflex that actually matters in daily life.

### 4. Relaxation is half the training

Doing too many kegels, or doing them without ever fully releasing, can produce a **hypertonic** pelvic floor — muscles that cannot relax. That causes pain, tension, and urinary or bowel symptoms that look exactly like weakness, and it gets **worse** with more squeezing. Adding contraction to an already over-contracted muscle raises tone further and reduces blood flow to tissue that is already short of it.

The counter-measure is down-training: reverse kegels (a conscious lengthening on the inhale) and diaphragmatic breathing, since the diaphragm and pelvic floor move together — inhale and the floor descends.

So: every NiFo session opens with breathing and closes with reverse kegels, one day a week is a release-only day with no strengthening at all, and flagging pain at the end of a session automatically reduces the targets for the next three.

### 5. Volume has a ceiling

Total kegel work should generally stay **under about 15 minutes a day**, with quality-controlled contractions beating high-quantity ones. Over-exercising causes fatigue and can worsen symptoms rather than improve them. The app's heaviest level is still comfortably under that ceiling, extra same-day sessions are logged as bonus work but do not accelerate promotion, and there is no way to grind your way up a level faster.

## The 104-week structure

A level *is* a week. Six phases, each four-week block ending in a deload week (every week where `n % 4 === 0`) at 70% of the hold target and 80% of the reps.

| Phase | Weeks | Position | Focus |
|---|---|---|---|
| Foundation | 1–8 | Lying, knees bent | Isolate the right muscle; nothing else moves |
| Control | 9–20 | Seated, spine tall | Same quality sitting up; graded control, not on/off |
| Strength | 21–40 | Standing | Upright strength — where the numbers start moving |
| Endurance | 41–64 | Standing or walking on the spot | Holding tone for longer |
| Power | 65–84 | Standing; brace before a cough or lift | Fast, automatic response under pressure |
| Mastery | 85–104 | Any position, including mid-activity | Everything at once, and keeping it |

The whole ladder is generated from a model rather than hand-written, so there is no cliff where the table runs out. The roadmap screen (`www/js/roadmap.js`) renders all 104 weeks with the phase each belongs to.

## Teaching it

The first visit to Kegels opens a walkthrough (`www/js/tutorial.js`) rather than a session. Seven steps, each with something to physically check and most with a practice rep on the hold pad: what the pelvic floor is, finding it via the stopping-wind cue, checking that the belly/buttocks/thighs stay still, the kegel itself, **the reverse kegel**, what a session looks like, and what to expect.

The reverse kegel gets a full step because it is the instruction people most often meet without an explanation. The app's definition is deliberately blunt — *the exact opposite of a kegel: instead of lifting the floor up and in, you let it drop down and out* — with the breathe-in cue as the way to find it, and an explicit statement of why it is in the program at all (a floor that only tightens ends up hypertonic, and more kegels make that worse). It is reachable on its own from the guide via `#/tutorial?step=reverse`.

## Timeline

Improvements are typically first noticed at **4–6 weeks**, with most of the change between **8 and 12 weeks** of consistent daily practice; trials generally run 12+ weeks and some recommend continuing 15–20 weeks. The app says this out loud in the debrief, because the single biggest failure mode is quitting in week two.

## Technique, and the one thing not to do

The correct contraction is a **lift up and in** — the muscles used to stop yourself passing wind — with the abdomen, buttocks and thighs staying still and breathing continuing normally.

Do **not** practise by repeatedly stopping the urine stream. It is at most a one-off way to identify the muscle; done as an exercise it can interfere with normal bladder emptying.

## How the app turns this into a score

- **Completion (40 pts)** — reps performed ÷ reps prescribed.
- **Fidelity (40 pts)** — mean of `min(actual hold ÷ target hold, 1.0)`. Capping each rep at 100% means overholding some reps can never compensate for cutting others short.
- **Consistency (20 pts)** — derived from the standard deviation of those per-rep ratios; a set that fades badly at the end scores lower than a flat one. This is the closest a phone can get to measuring fatigue resistance.
- **Overhold bonus (up to +5)** — applied only when *every* prescribed rep hit its target, so holding longer is rewarded without becoming a way to game the score.

Promotion requires **three sessions at 80+ with full completion** *and* **at least six days served at the current week**. Without the time gate, two strong days would skip a week of the plan and the two-year ladder would collapse into a few months; with it, 104 weeks takes a minimum of 1.7 years. Two consecutive sessions below 55, or one flagged for pain, triggers a deload of reduced targets.

Sessions logged from a pump cadence, or from pocket mode, carry no measured per-rep data. Pump-cadence sessions are excluded from promotion, deload lookbacks, charts and the heatmap entirely; pocket-mode sessions are scored from the self-rating and marked estimated, and never set the max-hold PR.

**Weekly review** (`www/js/review.js`) compares the last seven days against the seven before: sessions, days trained, average score, time under tension, contractions and best hold, each with a delta. It picks the single largest real change and says what to do about it, rather than listing everything that moved. Offered once per week and marked seen when opened.

**Pelvic Floor Index (0–1000)** combines best-ever hold (300), the last 7 days' time under tension (200), current level (300) and 14-day adherence (200). It is a made-up composite, not a clinical measure — its only job is to be a single number that moves when any of the things that matter move.

## Sources

- [Effects of a 6-week pelvic floor muscle training on neuromuscular activity in healthy young men (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13106149/)
- [Pelvic floor muscle training in men with post-prostatectomy urinary incontinence: a scoping review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11526213/)
- [Pelvic floor muscle exercise and training for coping with urinary incontinence (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8743604/)
- [The status of pelvic floor muscle training for women (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2997838/)
- [Pelvic Floor Muscle Training — overview (ScienceDirect)](https://www.sciencedirect.com/topics/nursing-and-health-professions/pelvic-floor-muscle-training)
- [Pelvic Floor Exercises (Physiopedia)](https://www.physio-pedia.com/Pelvic_Floor_Exercises)
- [Kegel exercises for ED: evidence-based guide (Ubie)](https://ubiehealth.com/doctors-note/kegel-exercises-erectile-dysfunction-best-guide-2211e3)
- [Kegel exercises (National Association For Continence)](https://nafc.org/kegel-exercises/)
- [Pelvic floor (kegel) exercises — patient handout (Rutgers Cancer Institute, PDF)](https://cinj.org/sites/cinj/files/documents/Pelvic-Floor-Kegel-Exercises-2022.pdf)
- [Kegels and quick flicks](https://www.ther3finery.com/post/kegels-and-quick-flicks)
- [Signs of overdoing kegels (Pelvis.nyc)](https://pelvis.nyc/overdoing-kegels-pelvic-floor-exercise-signs/)
- [Hypertonic pelvic floor and reverse kegel exercises (Intimina)](https://www.intimina.com/blog/hypertonic-pelvic-floor-and-reverse-kegel-exercises/)
- [Pelvic floor down-training (Beyond Basics PT)](https://beyondbasicsphysicaltherapy.com/blog/just-relax-the-details-of-pelvic-floor-down-training/)
- [Reverse kegel for men (Doctronic)](https://www.doctronic.ai/blog/reverse-kegel-for-men/)
- [Pelvic floor muscle training exercises (MedlinePlus)](https://medlineplus.gov/ency/article/003975.htm)

*Popular-health sources above are used for technique description and safety framing; the dose parameters come from the review and trial literature. None of this is medical advice.*
