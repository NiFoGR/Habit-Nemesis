# Habits

The sixth feature, and the one the other five are not: a room with nothing in
it until you put something there. Kegels encodes a 104-week protocol, PE
encodes safety limits, the Bible section encodes a canon. This encodes only
the shape of a question asked once a day, and leaves the question to you.

It is a port of [Loop Habit Tracker](https://github.com/iSoron/uhabits)'s model
into NiFo's shape. Loop's model is the right one and there was no reason to
invent a worse one: an exponential score rather than a percentage, a frequency
expressed as a fraction rather than as a weekday pattern, and four states in a
cell rather than two.

## The record

One map, `entries[habitId][dayKey]`, and four values:

| Stored | Means | On the grid |
|---|---|---|
| absent | nothing was recorded | × , or ? with question marks on |
| `0` | you answered no | a red × |
| `1` | done | a tick in the habit's colour |
| any number | the measurement | the value and its unit |
| `-1` | skipped | a skip mark |

Nothing else is stored. **Streaks and scores are computed on every read.** Every
other section in NiFo caches its streak, which is safe there because the past is
written once, by a session that has just ended. Here the past is editable from
the calendar on purpose, so a cached streak would be wrong the moment you
corrected last Tuesday. The cost is one pass over the habit's history per
render, memoised until the next write, which for a decade of daily entries is a
few thousand additions.

## Frequency is a fraction

Every one of the five rows in the picker is the same pair of numbers, `n` times
in `d` days:

| The picker says | `n` | `d` |
|---|---|---|
| Every day | 1 | 1 |
| Every 3 days | 1 | 3 |
| 3 times per week | 3 | 7 |
| 10 times per month | 10 | 30 |
| 3 times in 14 days | 3 | 14 |

A day is **satisfied** when the window of `d` days ending on it holds at least
`n` ticks — or when you ticked it, which is the case the window alone gets
wrong. Mark one day of a habit that asks for four a week and the window still
holds one; a window-only rule would score that day zero and break the streak on
the day you actually did the thing. So doing it always counts, and the window is
what carries the days between.

Loop does this differently and arrives in nearly the same place. It walks groups
of `n` consecutive ticks, builds an interval of `d` days from the oldest of each
group, snaps overlapping intervals apart, and paints every day inside one. The
trailing window says the same thing in one sentence. The two disagree only in
the run-up to the first satisfied day: the window needs `d` days of history
before it can carry anything, so a three-times-a-week habit starts its streak
about five days after the first tick rather than at it.

## The score

Loop's exponential moving average, unchanged, because it is right:

```
freq       = n / d
multiplier = 0.5 ^ (√freq / 13)
score(t)   = score(t-1) × multiplier + value(t) × (1 − multiplier)
```

For a daily habit the multiplier is `0.5^(1/13) ≈ 0.9481`: a **thirteen-day
half-life**. Thirteen consecutive days scores exactly 50%, twenty-six exactly
75%, and a week off decays the score rather than resetting it. A percentage of
days kept cannot do any of that — it treats a lapse in March as it treats one
this morning, and it cannot be moved once there is a year of data behind it.

Rarer habits get a multiplier closer to 1, so they rise and fall more slowly.
Three times a week is not punished for the four days it never asked for, and it
takes proportionally longer to build.

`value(t)` is:

- **yes/no** — 1 if the day is satisfied, 0 otherwise.
- **measurable, at least** — `min(value / target, 1)`, so 1.4 of a 2-litre
  target is worth 0.7. Partial credit exists only for daily habits; a
  non-daily one is satisfied or it is not.
- **measurable, at most** — 1 at or under the target, falling away above it and
  reaching 0 at twice the target. This is the shape of a calorie cap, and of
  anything you are trying to do less of.
- **skipped** — the day leaves the series entirely rather than scoring zero.

A day with nothing recorded scores zero under both target types, including a
ceiling. Not logging is not evidence of having stayed under, and the skip is
there for the days that genuinely did not count.

## Streaks

Consecutive satisfied-or-skipped days, ending today, or yesterday if today has
not happened yet — the same grace `store.streak()` gives every other section, so
an evening habit does not read as broken at nine in the morning.

A streak is measured in **calendar days, skips included**: five days off with a
good reason, between ten kept days on either side, is a streak of twenty-five
and not of twenty. Saying otherwise would make a skip a half-punishment, which
is the one thing it must not be. A run made of nothing but skips is not a
streak at all.

## The day boundary

`dayStartHour` moves when a day begins, up to 06:00, so something ticked at
01:00 belongs to the night you were still up for. **It shifts this section
only.** The other five record against midnight and rewriting their history to
agree would be a far bigger change than the setting is worth; the linked rows
below are therefore read on their own boundary, which can disagree with the
grid's by a few hours around midnight.

## The linked rows

The five other features appear at the top of the grid, read-only, filled from
their own records: a day is done when there is a kegel session, a PE session, a
chapter read, both halves of the rule, or a wind-down on it.

This is the answer to the obvious objection to a habit tracker inside an app
that already tracks five things. Without them you would keep two records of the
same morning, and they would disagree by Friday. They are not tappable here for
the same reason: of two records of one fact, the editable one is always the one
that ends up wrong.

They read `store.get()` directly rather than importing each feature's program
module. The store schema is the contract both already depend on, so the grid
cannot be broken by a change to how, say, PE computes a projection.

The grid asks "did you do it", not "did you hit the target": one kegel session
is a done day here even when the plan asked for two. The targets live in their
own sections, and a row that went red for a half-finished day would be a second
opinion on a question those sections already answer.

## What the sanitiser has to be careful about

`cleanHabits()` in `store.js` is the only part of the sanitiser dealing with
data whose *shape* the user defines, so three rules differ from the rest of the
file:

- **A bad id drops the habit** instead of being replaced with a fresh one.
  Everywhere else a bad id is regenerated, which is right for a session because
  a session carries its own data. A habit does not: its record lives in
  `entries` under that id, so a new one would silently orphan every day ever
  marked.
- **A bad day key drops the entry** instead of falling back to today, which is
  what `dateKey()` does. Defaulting is right for a session that has to land
  somewhere; here it would pile a whole file of junk onto this morning.
- **Entries whose habit no longer exists are dropped**, so deleting a habit
  cannot leave a record behind for a later habit to inherit by id collision.

Colours are stored as ids from a closed list rather than as hex strings, because
a colour is interpolated into a `style` attribute and a free-text one would be a
hole in the wall the CSP is holding up.
