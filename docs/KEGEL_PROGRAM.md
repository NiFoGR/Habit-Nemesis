# The kegel program: what it is and where it comes from

Notes behind the training plan in `www/js/program.js`. Written down so the numbers in the app are traceable to something rather than invented.

## The short version

There is **no single agreed protocol**. Published pelvic floor muscle training (PFMT) programs range from 5 to 200 contractions a day, and reviews say plainly that consensus on the exact dose does not exist. What they broadly agree on is the shape:

| Variable | Common range in the literature | What NiFo does |
|---|---|---|
| Contraction hold | 3–5s at the start, progressing to 8–10s+ | 3s at level 1 → 15s at level 12 |
| Rest between holds | at least equal to the hold | always ≥ the hold, never less |
| Reps per set | 8–15 | 8 → 15 |
| Sets per day | 2–3 (some intensive protocols use 6) | 2 by default, configurable 1–3 |
| Frequency | 3–7 days a week, daily is common | 6 training days + 1 release day |
| Fast contractions | 10 × ~1s alongside the slow work | 10 → 30 quick flicks per session |
| Program length | 12–20 weeks before judging results | 12 levels ≈ 12 weeks, then maintenance |
| Daily ceiling | keep total work under ~15 min | every level lands well under 15 min |

## The five principles the app is built on

### 1. Two fibre types, two kinds of rep

The pelvic floor contains both slow-twitch fibres (postural tone, endurance) and fast-twitch fibres (the rapid contraction that closes the urethra when abdominal pressure spikes from a cough, sneeze or lift). Quick contractions of about one second train the fast fibres; sustained holds train the slow ones. Training only one leaves half the muscle untouched, which is why intensive published protocols pair **10 fast (1s) with 10 slow (10s) contractions** in the same set.

Every NiFo session runs both blocks, in that order — flicks while fresh, holds after.

### 2. Rest at least as long as you hold

Protocols specify contraction and relaxation of **equal duration**. Under-resting means each rep starts more fatigued than the last, which turns a strength session into an endurance grind and is one of the most common reasons people stall. The app enforces this: the rest interval after a hold is never shorter than the hold itself, and it scales up automatically as targets grow.

### 3. Progressive overload, in a specific order

Progression is by **duration first, then repetitions, then sets**, and separately by **body position** — lying is easiest, sitting is harder, standing is harder again, and contracting under load (before a cough, lift or step) is hardest and most functional. Contractions beyond 10 seconds fatigue many people, but longer contraction time is associated with strength and endurance gains, so the ceiling should move upward within tolerance rather than being fixed.

NiFo's levels move all three: hold length 3s → 15s, reps 8 → 15, and position lying → seated → standing → under load. Level 9 explicitly introduces the pre-brace ("the knack"), which is the reflex that actually matters in daily life.

### 4. Relaxation is half the training

Doing too many kegels, or doing them without ever fully releasing, can produce a **hypertonic** pelvic floor — muscles that cannot relax. That causes pain, tension, and urinary or bowel symptoms that look exactly like weakness, and it gets **worse** with more squeezing. Adding contraction to an already over-contracted muscle raises tone further and reduces blood flow to tissue that is already short of it.

The counter-measure is down-training: reverse kegels (a conscious lengthening on the inhale) and diaphragmatic breathing, since the diaphragm and pelvic floor move together — inhale and the floor descends.

So: every NiFo session opens with breathing and closes with reverse kegels, one day a week is a release-only day with no strengthening at all, and flagging pain at the end of a session automatically reduces the targets for the next three.

### 5. Volume has a ceiling

Total kegel work should generally stay **under about 15 minutes a day**, with quality-controlled contractions beating high-quantity ones. Over-exercising causes fatigue and can worsen symptoms rather than improve them. The app's heaviest level is still comfortably under that ceiling, extra same-day sessions are logged as bonus work but do not accelerate promotion, and there is no way to grind your way up a level faster.

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

Promotion requires **three sessions at 80+ with full completion**. Two consecutive sessions below 55, or one flagged for pain, triggers a deload of reduced targets.

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
