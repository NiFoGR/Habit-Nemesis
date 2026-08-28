# The Arena

The competitive layer: a weekly match, a monthly division, a seasonal cup, and
a permanent record of things you actually did.

Everything in it is computed from data the app already has. **There are no
invented opponents.** Every rival is a real week out of your own history, which
is the only reason beating one means anything — and the reason you can tap any
of them and look at the actual grid they played.

## Three rhythms, one ladder

| | |
|---|---|
| **A week is a match** | Monday to Sunday, one opponent, won or lost |
| **A month is a season** | your record promotes, holds or relegates you |
| **A quarter is an Arc** | a knockout cup with a trophy at the end |

They are not three systems. The week is the unit; the month counts the weeks;
the Arc is a bracket laid over the same weeks.

## The divisions

| Division | Month score |
|---|---|
| Top G | 92% |
| Locked In | 84% |
| Menace | 74% |
| Contender | 60% |
| Prospect | 45% |
| NPC | 25% |
| Bottom G | — |

At the end of a month: **at or above the next division's bar** promotes you,
**at or above your own** holds you, **below it** relegates you one step.

A fixture is won by **matching** the opponent, not only by beating them. A draw
went to the opponent in the first version, which was harsh and unambiguous and
also broken: the moment you have one perfect week your Nemesis is a perfect
week, and every fixture against him is unwinnable for ever. You cannot do
better than everything, so doing everything has to be enough.

Your first completed month is a **placement season** — it sets your division
and cannot relegate you, because there is nothing to relegate you from.

## The score

> **A week scores the percentage of what was due that you did.**

A **daily** row owes one cell per day. A row asking for **n days in d** owes
`n × elapsed ÷ d` cells over the week, floored — five in seven owes five, and
does not care which five. A skipped day leaves both halves of the fraction, as
it does everywhere else in this app.

That second rule is not what shipped first, and the difference is worth
keeping. The first version asked the habits engine whether each day was
*satisfied*, which for a 3-in-7 habit is true on the days it does not ask for.
But that engine's window is **trailing** — a Monday can only be carried by the
seven days before it, which belong to last week. So the same five days scored
100% done Monday to Friday and 71% done Wednesday to Sunday, a brand new habit
was marked down for its first week whatever you did, and a genuine weekend
habit scored 43% for a perfect week.

The window is right for a running score, which has to answer *are you keeping
up* without looking into the future. It is wrong for a fixed week, which can
see the whole of itself. So the Arena counts the quota and the engine keeps its
window; neither had to change for the other.

The quota is **floored** so that slack is real: five in seven means two days
off, and being at nothing on Monday is not yet being behind. It catches up as
the week does, and by Sunday it is exactly the five.

**A month is the mean of its weeks**, not one big recomputed percentage. Each
week had a fixed, fair roster, so the month is an average of clean numbers
rather than a blend of two different bars. It also makes the record and the
score the same object.

**A week is only a fixture if at least `VOID_CELLS` cells were due across at
least `VOID_DAYS` days** — four, and three. Otherwise it is void: no result,
like a rained-off match.

Both floors are needed. Cells alone was set at seven, which a single daily
habit hits exactly and loses the moment you skip a day, so somebody keeping one
thing could never play. Days alone would let a fortnight of one habit through.
Together they are the honest reading of *was this a week*, and a week you
skipped your way through fails the second floor however many rows you keep —
which is the case the rule exists for.

## The roster, and why it locks on Monday

The roster is the five features the app asks of you — if the grid is set to
show them — plus **every habit that existed before this Monday**.

The five follow the display setting rather than always counting. There was a
version that scored them regardless, on the reasoning that a display toggle
must not move your division. It is the wrong trade: somebody who has turned
them off has said they are not what they are keeping, and losing a week to five
rows you cannot see is a bug however defensible the rule behind it.

A habit added on Wednesday appears on your grid at once and starts counting
next week.

This is the rule that took the most argument, so the reasoning is worth
keeping. Ten daily habits is seventy cells a week; do 56 and you are on 80%.
Add an eleventh on Wednesday and, counted immediately, it puts five more cells
in the denominator: nail all five and you are on 81%, miss them and you are on
75%.

Two things are wrong with that, and only the first is obvious.

**It punishes ambition at the exact moment you have it.** The day you add a
habit is the day you are most motivated, and docking your score for something
you have not built yet teaches you not to add habits. It is harshest on the
hardest ones, which are the ones most worth adding.

**It rigs a match already in progress.** Your opponent is a past week whose
score was fixed under its own roster. Add a habit on Wednesday and you are
judged on eleven rows while they were judged on ten — so you lose a match you
would have won *because you tried to improve*. Once a result feels arbitrary
the division is worthless.

A **season** would have been too long: thirty days of a habit sitting on the
grid not counting is its own kind of demotivating. A week is the smallest
window that keeps a match fair, and six days is a bearable wait.

Archiving follows the same rule in reverse — a habit archived on Saturday still
counts for that week, so you cannot dump the one you are failing.

## Opponents

| | |
|---|---|
| **Your Nemesis** | your best week ever |
| **Last Month You** | the same week, one month back |
| **The Standard** | your division's bar, personified |
| **Your Worst Self** | your worst week of the last thirteen |

Your Worst Self is drawn from a rolling window, not from all time: a record
going back a year hands you a 17% week from before you knew what you were
doing, and beating that says nothing. Thirteen weeks back is still a real week,
still yours, and still one you would be ashamed to lose to.

Losing to Your Worst Self is meant to sting. When you beat the Nemesis he is
replaced by the week that just beat him, so he can never be beaten permanently.

## Two rooms

The Arena is **now**: the division you are in, the week you are playing, the
cup that is running. The Cabinet is **for ever**: the cups you have won, the
feats, the years, and the lines you left yourself.

Splitting them is what stopped either being a stack of five cards. Nothing in
the Cabinet changes hour to hour, which is what lets that room be still.

## The Arc

Four a year, on the meteorological seasons: **Winter** (Dec–Feb), **Spring**
(Mar–May), **Summer** (Jun–Aug), **Autumn** (Sep–Nov).

**A cup has an off-season.** The last two weeks of every quarter are not part
of any tournament. The arcs used to tile the year end to end, which meant you
were always in one — and something you are always in is not something you
*enter*. Two weeks of nothing is what buys the countdown its meaning, and it is
why the Arc leaves the screen entirely between cups and comes back as a date.

So a thirteen-week quarter is eight group weeks, three knockout weeks and a
fortnight of nothing.

**Group stage** — the season, less its last three weeks. A table of you and five
past selves whose scores are already fixed, so the whole table is visible from
day one and you can see exactly what qualifying costs. **Top three go through.**

**Knockout** — the last three weeks, and the opponents escalate:

| Round | Opponent |
|---|---|
| Quarter-final | your best week of the previous Arc |
| Semi-final | your best week of this year |
| **Final** | **your Nemesis — your best week ever** |

So winning an Arc requires the best week of your life, in the last week of the
season, with everything on it. The boss is your own ceiling, and you only meet
him if you earn the tie.

Trophies are permanent, and so are the defeats: *Winter Arc 2026 — lost in the
semi, 81% to 84%* is kept, because a cabinet with only wins in it is a
participation trophy.

Being knocked out is not dead time. The league never stops, so there is still a
match every week — and the moment you are out, the Arc section becomes the
countdown to the next one, which is the same thing it shows during the break.

### What is on screen, and when

| Phase | The Arc is |
|---|---|
| **break** | one line and a date: *Autumn Arc Trophy · opens in 5 days* |
| **group** | the live table, with the qualification line drawn across it |
| **qf / sf / final** | the round you are in, and the bracket around it |
| **out** | how it ended, and the countdown to the next one |
| **champion** | the cup |

Three of those get a full-screen moment the first time you see them, and each
fires once: **opening night**, **qualification night**, and **the ceremony**.
What is stored is that you have seen it — the record already says it happened.

### Shouting through the door

Three real Android alarms, on the same machinery as the prayer and reading
reminders, re-armed on every launch because a launch is exactly when what is
true about them has changed:

- the morning a cup opens
- the morning its group stage ends
- the evening before a round you are actually in finishes

The temptation was to schedule the whole bracket in advance. It is the wrong
call: those rounds depend on winning, and a phone that announces a final you
were knocked out of is worse than a phone that says nothing.

## A line for whoever has to beat it

Set a new best week and you are offered one sentence — capped at 140
characters, the only free text anywhere in the Arena. It is stored on that
week, and it comes back at you when that week turns up as your Nemesis.

It earns its place because every other opponent here is a number, and a number
cannot say anything to you. Getting shit-talked by yourself from four months
ago is a different kind of motivation from a percentage.

Winning an Arc offers the same, and that one goes on the trophy.

## The Year

**365 days from the day your record starts**, not a calendar year, written like
a season: **26/27**.

A calendar year would hand somebody who installed in November a six-week "year"
to review, and the whole point of the screen is that it covers a long time.

**It is locked while it runs.** The Cabinet shows a countdown and nothing else
until the year is over, and past years are always open. A review you can read
early is not a review, it is a dashboard.

The anchor is stored rather than derived. Derived from the earliest recorded
day it would move every boundary backwards the first time you corrected an old
date from the calendar, and a year that had already unlocked would lock itself
again.

## Feats

Not achievements. A feat is something you did, and the test in the code is:

> Could you say it out loud to another person and have it mean something?

*Held a contraction for thirty seconds* passes. *Opened the app seven days
running* does not. The second is a fact about using an app; only the first is a
fact about your life. That test retired both of the catalogues the app used to
have — fifteen kegel badges and fifteen PE achievements, neither of which knew
the other existed and neither visible outside its own section — and everything
worth keeping was carried into the one list. Nothing had to be migrated:
because a feat is a predicate, anything you had already earned is earned again
the first time the list is checked.

Feats are **predicates over the record**, not flags handed out by whatever
screen happened to be open. Only the date each was first seen is stored, so
they can be announced once — and if that is ever lost the feats themselves
recompute from the data.

## What is stored, and the one rule this breaks

Almost everything here is derived on read, like the rest of the habits engine.
Two things are not:

- **A closed week's result.** Once a week is over its score is written down and
  never recomputed. Otherwise changing a habit's frequency today would silently
  rewrite matches you already won, and editing the past from the calendar would
  let you backfill a defeat into a victory.
- **Your division, and the arc bracket.** These are standings, which is a
  historical fact rather than a view.

This is a deliberate departure from *nothing derived is stored*, and it is the
same distinction the rest of the app already makes: a session that has ended is
written once, and only the live one is recomputed.

## Backfill

The Arena is not empty on the day it ships. On first run it computes and stores
a score for every past week the habits data covers, up to `MAX_BACKFILL_WEEKS`.
Those weeks are marked **`record`** rather than won or lost, and the difference
is the whole honesty of it: they are the opponents, not the results. Playing
them out retrospectively would hand you a form guide full of matches you never
knew you were in, and a result screen on first launch announcing a week you
lost before the feature existed.

The months still close from them, so you arrive at the division your record has
actually earned rather than at the bottom of a ladder you have been climbing
for eight months.

## Correcting the record

The stored scores carry a `scoring` version. Bumping it re-scores every week
that was **never played** — the ones the Arena computed out of older data — and
re-derives any standing that rested on nothing else, the division included.

Weeks that were actually played are left alone, even when the rule that
produced them has since been corrected. A result is a historical fact, and the
whole reason the Arena stores anything at all is that facts do not move.

It has run once, for the frequency rule above.

## Announcing it

A week that ended, a division that moved and an Arc round that was played get
the **result screen**, on the way to the grid, once. A number quietly changing
while you were not looking is not a moment.

The result is behind one tap, and that is not ceremony for its own sake: a
screen reached by the app opening has had no gesture on it, so the phone
refuses to vibrate and an `AudioContext` refuses to start. Played on arrival
the whole thing would be silent and still. The tap is what makes the sound
legal — and a week you won is worth a moment of not knowing anyway.

A feat earned mid-tap gets one line instead, sliding in and going away again,
because interrupting the grid to hand you a certificate would make you stop
ticking things.

## Checking it

`npm run check:arena` runs `tools/check-arena.mjs` in bare node. It asserts the
things that cannot be read off a screen — ISO weeks across a new year and a
clock change, the month a week belongs to, the season a month is in, what came
before it, the Monday lock and the void floors. Every check in it is one that
was wrong once.
