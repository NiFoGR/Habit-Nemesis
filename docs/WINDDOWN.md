# The wind-down

Five minutes of paced breathing, done lying down, as the last thing in the day.
Why it is the last thing, why the exhale is the long half, and why the screen
goes black.

---

## What it is for

Falling asleep is not a thing you do, it is a thing that happens once you stop
being aroused. The autonomic nervous system has two settings and the whole day
is spent in one of them; the point of this feature is to spend five minutes
deliberately in the other one, and then go to sleep from there.

The lever is the breath, and it is not a metaphor. Heart rate rises on the
in-breath and falls on the out-breath, because the vagus nerve is inhibited
during inhalation and released during exhalation. Make the out-breath the longer
of the two, at somewhere near six breaths a minute, and the balance across the
whole cycle shifts to the parasympathetic side, and stays shifted for a while
after you stop.

So everything here serves one mechanism. The patterns are all slow. Two of the
three are exhale-weighted. Nothing asks you to do anything with your body except
breathe, because tensing to perform an exercise is sympathetic activity and
would be working against the point.

## The three patterns

| | | Why it is here |
|---|---|---|
| **Extended exhale** | 4 in, 8 out | The default. Twice as long out as in, which is the strongest of the three for coming down, and slow enough to hold for five minutes without concentrating. |
| **Coherent** | 5.5 in, 5.5 out | About six breaths a minute, where heart-rate variability peaks. Even, so it is easier if a long exhale makes you feel short of air. |
| **4-7-8** | 4 in, 7 hold, 8 out | Weil's. The held breath settles some people and makes others tense, which is why it is offered rather than chosen for you. |

Three, and no more. Every extra pattern is a decision to make at bedtime, and
bedtime is the worst time to be offered one.

## The opening sighs

Every session opens with three **physiological sighs**: a full inhale, a second
short one stacked on top of it, then a long release. Two inhales in a row
reinflate alveoli that have collapsed over the course of the day, and the long
exhale that follows offloads CO2 in one breath. It is the fastest voluntary way
to drop arousal, faster than the paced breathing that follows, so it goes at the
front where it does the most good.

They are also the reason the session is easy to start when wound up. Beginning a
five-minute slow pattern from a racing baseline is unpleasant and people quit;
beginning it thirty seconds after three sighs is not.

## Why the exhale is where the session ends

The timeline is built out of whole breaths only. A five-minute setting produces
whatever number of complete breaths fits inside five minutes, and the session
ends there — 4:55 rather than 5:00 exactly.

Cutting to the clock instead would end the session mid-inhale, on the one phase
you least want it to end on. The number on the settings screen is a budget, not
a target, and the screen says what the budget actually buys.

## How you are paced

Three channels, and they fail independently on purpose.

**Sound** is the reliable one. The whole session is written onto the
`AudioContext` timeline in one pass before the first breath: a single oscillator
whose pitch and volume are automated across every phase. That makes it
sample-accurate and completely immune to timer throttling, which is the failure
mode that matters here, because this runs with the screen black and the phone
face up on your chest. Two nodes for five minutes, so it costs nothing. The tone
rises through a fifth as you breathe in and falls back as you breathe out, so
you follow an envelope rather than counting beeps.

**Vibration** marks the turn of each phase and nothing else: one soft pulse in,
two out, three light taps to hold. A continuous buzz through a breath is the
opposite of the thing this is for, and it empties the battery arguing with you.
The stacked second inhale of a sigh deliberately gets no buzz of its own, since
a second pulse there would read as a new instruction rather than a continuation.

**The screen** is the least important and is drawn accordingly. A dim orb that
expands and contracts, near-black behind it, and a tap anywhere puts even that
out. It is a light source pointed at your face at bedtime, so the default is as
little of it as will still be useful.

### Why the screen is black rather than off

Because it cannot be off. `navigator.vibrate` is suppressed on a hidden
document, and timers are throttled hard once Android sleeps the screen, so a
wind-down that ran with the screen genuinely off would lose two of its three
channels and drift on the third. `pocket.js` reached the same conclusion for the
same reason.

So the session holds a wake lock and paints the screen black instead, which is
the closest honest approximation. Sound alone does survive the screen sleeping,
so a session with vibration turned off would in principle keep pacing you
correctly — but the app does not pretend to offer that, because the wake lock is
held either way.

## What is recorded, and what is not

One entry per day: when it was done, how long it ran, which pattern. That is the
whole record.

There is no score and no grade, for exactly the reason the prayer rule has none.
This is the last thing before sleep. Being marked out of ten at 23:00 is the
opposite of the point, and a number to beat would turn a wind-down into one more
thing to perform. The finish screen says goodnight and gets out of the way.

**A session under a minute is not recorded.** Below that you picked the phone up
and put it down again; above it you breathed. Leaving early otherwise records
what actually happened rather than nothing, which is where this differs from the
prayer rule: a rule is kept or it is not, but four minutes of breathing is four
minutes of breathing.

## Where it sits

Last on the Today list, after the night rule.

That list had a deliberate rule that nothing came after the night prayers,
because putting anything there read as though something came after them. The
wind-down is the one thing that genuinely does: you pray, and then you lie down
and breathe until you are ready to sleep. So it takes the last row and the rule
keeps the one above it.

The reminder should be set after the night prayers for the same reason. The
settings screen says so.

## What is deliberately not here

* **A score, a grade, or anything to beat.** Covered above.
* **Breath sensing.** A phone resting on your belly does rise and fall with each
  breath, and the accelerometer can pick that up, so a real biofeedback loop is
  possible. It is not here because it is sensitive to how the phone happens to
  lie, and a pacer that tells you you are breathing wrongly when it is actually
  confused is worse than a metronome.
* **More patterns.** Three is already one more than most nights need.
* **A guided voice.** Something has to be recorded, played and listened to, and
  a voice at bedtime is a thing to get sick of by the second week.
