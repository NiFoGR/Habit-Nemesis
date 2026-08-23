# The Bible feature

Where the data comes from, why the app does not contain the text of the Bible,
and how the church calendar is worked out.

---

## The decision that shaped everything else

The obvious version of this feature is a Bible reader: the text on the screen,
a tap to mark a chapter read, done. That version was attempted first and
abandoned, and the reason is worth writing down so it is not attempted again.

The source was a plain-text export of the Orthodox Study Bible. Two things
killed it.

**The text is not recoverable at the quality scripture deserves.** PDF text
extraction preserves prose reasonably and destroys anything italic or poetic.
Every poetic passage in the book comes out letter-spaced, with spaces inserted
inside words. This is Psalm 1 as the export gives it:

```
B lessed is the m an
Who walks not in the counsel of the ungodly ,
Nor stands in the way of sinners,
```

That is not a handful of bad characters to patch. It is the whole Psalter,
2,534 verses, the most-read book in Orthodox practice, plus every prophetic
oracle and every hymn in the New Testament. Chapter openings are mangled
separately, because the print edition sets them as drop caps and the extractor
interleaves the drop cap with the lines beside it: Genesis 1:1 comes out as
`1 Inandthedarkness` on one line with its neighbours on others. A verse-anchored
parse aligned about 61% of verses before the accuracy of the aligned ones was
even in question. Shipping that would mean a Bible with broken words scattered
through it, which is worse than no Bible at all.

**And it could not be shipped anyway.** The OSB's front matter grants
quotation of up to 1,000 verses, under 50% of any one book. The app has 35,903
verses in front of it, and this repository is public and deploys to GitHub
Pages. Bundling the text would be redistribution, not quotation.

The Prayer feature had already made this decision once, for the same reason:
*"A full modern prayer book is a copyrighted translation, so the app does not
ship one."* It bundles the ancient core, links out for the rest, and lets you
type in what you actually say. Bible does the same thing. **You read from the
copy you own. The app tracks it, and tells you what you are about to read.**

So what is in the repository is structure and references, which are facts about
the book rather than the book:

* how many chapters each of the 76 books has, and how many verses in each;
* the lectionary, which is a table of citations;
* book introductions written for this app, not copied from the OSB's.

## What was extracted, and how

`tools/extract-bible-data.mjs` takes a path to the text export and writes two
files. It is committed so the extraction is reproducible, not because it needs
to run again.

### The canon

The ebook carries a navigation index: for every chapter, a heading
(`Verses in Genesis Chapter 12`) followed by the verse numbers in that chapter.
Parsing it yields **76 books, 1,344 chapters, 35,903 verses**, with exactly one
chapter where the printed verse list skips a number (3 Kingdoms 16, which lists
41 verses and numbers up to 42). That is an authoritative structure taken from
the edition itself rather than from a generic verse-count table that would
disagree with the book in your hands. The Psalms are the obvious case: this
Bible has 151 of them, numbered as the Septuagint numbers them, and a table
built for a Protestant canon would be wrong about both.

Book names follow the OSB, so the four books of Kingdoms are 1 to 4 Kingdoms
rather than 1 and 2 Samuel and 1 and 2 Kings. Each book carries the familiar
Hebrew-canon name alongside, because that is what most references use, and
because the lectionary itself cites `1 Kings 17` when it means 3 Kingdoms.

### The lectionary

The OSB prints a lectionary and describes it, in its own words, as intended
"strictly as a rough guide for personal reading" and "not for liturgical use".
The app repeats that on screen rather than quietly presenting it as the
authoritative daily reading, and links to goarch.org for a real one.

Every week of the movable cycle prints the same way, Monday through Saturday
followed by the Sunday that closes it, so one number per week places all seven
days: the offset from Pascha of that week's Monday. That gives **349 days from
Pascha minus 76 to Pascha plus 273**, with no gaps and no collisions. On top of
that sit **20 feasts fixed to calendar dates** and **9 days hung off the
Nativity and Theophany** (the Saturday before Nativity, and so on), which are
computed rather than dated because they move with the weekday.

## Working out the day

`pascha.js` computes Orthodox Pascha with Meeus's algorithm, which returns a
date on the Julian calendar, and converts it through the Julian day number
rather than by adding thirteen days. The thirteen-day offset is correct only
until 2100, and a hard-coded constant that silently goes wrong is worse than
the four extra lines. Checked against the published dates for 2020 to 2030.

Everything else is measured in days from there. A date in February belongs to
the cycle of the Pascha still ahead of it, not the one ten months behind, so
the changeover is placed at 77 days before Pascha, the day before the Triodion
opens.

Two limits are shown to the user rather than papered over:

* **The table runs out.** The OSB stops at the thirty-second week after
  Pentecost. In a year with a late Pascha there are more weeks than that before
  the next Triodion, and the Nativity and Theophany cycles cut across them. When
  the requested day is past the end of the table the app says so and points at
  goarch.org, instead of showing a reading that is not today's.
* **Fixed feasts collide with the cycle.** They supersede it, so both are shown,
  the feast first.

The seasons and fasts are derived from the same offset: Great Lent, Holy Week,
the Pentecostarion, the Apostles', Dormition and Nativity fasts, ordinary
Wednesdays and Fridays, and the fast-free weeks. It is a line of context under
the date, not a rule book, and the app does not pretend otherwise.

## Reading plans

Two shapes, and they behave differently on purpose.

**The lectionary is driven by the date.** The church appoints what it appoints
for the fourteenth of August whether or not you read anything on the thirteenth.
There is nothing to fall behind on and nothing to catch up.

**Everything else is driven by position.** Today's reading is the next one you
have not done, never the one the calendar says you should be on. If a plan
advanced by the calendar, a missed day would delete a chapter out of it, and a
year-long plan would quietly become a ten-month plan with holes. So the plan
waits, and the app tells you how many days behind the calendar you have drifted.
That number is information, not a debt, and it is never fixed by throwing
readings away.

Chapters are spread across a plan by cumulative division rather than a fixed
per-day count, so 1,344 chapters over 365 days lands on Revelation 22 on day
365 instead of running out in November with a stub week.

The plans are: the lectionary; the whole Bible in one year or two; the New
Testament in 90 days; the four Gospels in a month; the Psalter in a week by the
twenty kathismata, which is how the Church has read it for centuries; and no
plan at all.

## The context screens

The part of a study Bible that is genuinely useful and that nobody reads,
because it is four pages of small print in front of the thing you came for.

Every one of the 76 books answers the same six questions, in the same order:
who wrote it, when, where it sits in the story, what it is for, what to watch
for while reading, and how the Church reads it toward Christ. A fixed shape is
what makes them comparable, so Habakkuk and Colossians can be held in the same
map rather than as unrelated facts.

The four Gospels answer two more, because the useful question about a gospel is
never "what happened" but **"who was this written for, and what does only this
one give me"**, and no one ever says it out loud.

These are written for this app. Where a traditional ascription is disputed, the
entry says so rather than picking a side.

## What is deliberately not here

* **The text of the Bible.** For the two reasons at the top.
* **An import-your-own-file path.** It was designed and dropped: it would mean
  shipping the parser and the letter-spacing repair anyway, and handing the user
  a Psalter that reads as `B lessed is the m an`. The failure would just have
  been on their device rather than in the repository.
* **A verse-level tracker.** A chapter is the largest unit you can honestly say
  you either read or did not. Verses are too fine to tick and would turn the
  tracker into a thing you argue with.
* **A full liturgical calendar with saints' commemorations.** That is a
  different project, it varies by jurisdiction, and goarch.org already does it
  properly and is one tap away.
* **Ticking a lectionary passage marking its chapter read.** Reading
  Romans 2:10-16 is not reading Romans 2. The day's log records what it was.

## Sources

* *The Orthodox Study Bible*, St. Athanasius Academy of Orthodox Theology, 2008.
  Old Testament: St. Athanasius Academy Septuagint. New Testament: New King
  James Version. The canon structure and the lectionary references come from
  this edition; its text does not.
* Jean Meeus, *Astronomical Algorithms*, for the paschal computation.
* The Greek Orthodox Archdiocese of America, goarch.org, for the authoritative
  daily readings the app links to.
