# Design notes and backlog

Where the ideas came from, which ones got built, and which ones are parked.
Kept so future-me does not re-solve solved problems or rebuild something that
was deliberately rejected.

# Habits

A port rather than an invention: Loop Habit Tracker's model. Loop's model is
right and there was no reason to build a worse one from scratch.

## The core insight

The app encodes only the shape of a question asked once a day and leaves the
question to you, which means the design problem is the opposite of the usual
one: not "what should this do" but "what must it refuse to decide for you". The
answer turned out to be almost nothing. Name, question, colour, unit, target, whether the target is
a floor or a ceiling, frequency, group, position in the list, reminder, and the
value on any past day are all editable at any time.

That is only affordable because **nothing derived is stored**. Scores and
streaks are recomputed on every read, so changing a habit's frequency re-reads
its whole history under the new rule rather than leaving a number behind that
was true under the old one. Every other section caches its streak, which is
safe there because the past is written once by a session that has just ended.

## What got built

### The model
- Four states in a cell, not two: done, a recorded lapse, a skip, and nothing
  recorded. The last two are settings, because most days do not need the
  distinction and the ones that do need it badly.
- Frequency as a fraction, n in d. Five rows in the picker, one pair of numbers
  behind them.
- Loop's exponential score, unchanged. Thirteen-day half-life for a daily
  habit; rarer habits decay and build more slowly in proportion.
- Ceiling targets, for the habits where the win is a low number.
- Skips leave the score untouched and keep the streak running through them,
  measured in calendar days.

### The screens
- The grid: rows, day columns, one tap. Drag to reorder, arrows for anyone who
  would rather not, groups with a score of their own.
- One habit in full: overview, score, history, calendar, every streak, and the
  weekday-by-month bubble chart that tells you a habit has quietly become a
  weekend-only habit.
- The calendar is writable. A tracker you cannot correct stops being a record
  of what happened and becomes a record of what you remembered to press.

## Deliberately rejected

- **Importing from Loop.** The full backup is a SQLite file, and reading one
  would mean shipping a database engine into an app with no build step. CSV
  export stays, as the way out; there is no way in, by choice.
- **One Today row per habit.** Fourteen habits would bury the six things the
  app itself asks of you, and the ring above them would stop meaning anything.
- **Editable linked rows.** Of two records of the same morning, the editable
  one is always the one that ends up wrong.
- **Loop's interval snapping.** The trailing window says nearly the same thing
  in a sentence you can hold in your head. They disagree only in the run-up to
  the first satisfied day.
- **A percentage of days kept.** It weighs a lapse in March exactly as it
  weighs one this morning, and stops moving at all once a year is behind it.

## Backlog

- Notes on a day, not only on a habit.
- A home-screen widget, which is the one thing the source app does that this
  cannot.


---

# The polish pass

Forty screenshots of every screen in the app, each asked the same ten
questions. Kept because the useful finding was not any one of the fixes, it
was that **three of them were the same bug wearing different clothes**: a rule
written for the content that existed on the day it was written, quietly broken
by the next thing added.

- `.linkrow` was a four-column grid, with a comment explaining that a wrapping
  row would leave the last link stranded. Then a fifth link was added to two
  sections, and the fixed grid stranded it *and* left it left-aligned. The
  comment had correctly diagnosed a problem and then hard-coded the count.
  It is a centred wrapping row now, which is right at four links or at six.
- `.btn.wide` had `margin-top` only, because when it was written it was always
  the last thing on a screen. The first card placed after one sat flush against
  it, on two different screens, for months.
- `barChart` took no colour, because when it was written there was one accent
  and every chart used it. On a habit's own screen it was then the single mark
  not in that habit's colour.

**The lesson to carry:** a layout rule that encodes *how many* of something
there are will break the first time that number changes, and it will break
silently, because nothing throws. When writing one, prefer the rule that does
not need to know the count.

The same pass found four places using a text glyph where the icon set exists -
`✕`, `⌫`, and `✓` twice - each of which had been written before the icon it
needed was added, and none of which anything would ever flag.

## Deliberately not changed

- **Ten rows of best streaks** on a habit screen. It is a lot of screen, but
  that screen is where you go to see exactly that.
- **The unlabelled week strip** on the grid header. A caption for a seven-bar
  strip costs more room than it buys.
