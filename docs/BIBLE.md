# The Bible section

One room for reading and for the rule, why the app parses your own copy rather
than shipping one, and how the parser undoes what the PDF export did to the
text.

---

## Why reading and prayer are one section

They were two tiles for about a day. Splitting them meant the hub asked you
every morning to choose between the two halves of the same practice, and the
Bible tile had a lectionary telling you what to read on the fourteenth of
August whether or not you had read anything on the thirteenth.

Both are gone. The section opens where you left off, the rule sits underneath
with its two times, and there is no plan to fall behind on.

## Why the text is bundled, and why it wasn't at first

The Orthodox Study Bible's translations are under copyright: the front matter
allows a thousand verses, under half of any one book. There are 35,903 verses
here, and the app was then a public repository that deployed to a public
website. Shipping the full text there would have been redistributing a
commercial translation in bulk, which is not something the license covers and
not something to do regardless of what it covers.

**This repository is now private, and the GitHub Pages workflow has been
deleted.** That changes what shipping the text means: it is a personal copy of
a book you own, kept for personal use, not a public release. So the parsed text
is committed under `www/bible/`, one JSON file per book, and the reader loads it
directly. There is no import step.

If this repository is ever made public again, `www/bible/` has to come out
first and the app goes back to reading from a copy you import on the device,
which is how the first version of this feature worked and which
`www/js/bible/parse.js` still knows how to do.

The Prayer feature draws a related line for its own book: it bundles the
ancient core, which is in the public domain, and lets you type in the rest from
your own copy rather than including a copyrighted prayer book.

## What the export does to the text, and how it is undone

A PDF conversion of a print Bible arrives with two faults. Both are repaired in
`www/js/bible/parse.js`, which is also what `tools/extract-bible-text.mjs` runs
to generate the files in `www/bible/`. The reasoning is in the code beside each
fix.

### Letter spacing

The exporter turns the kerning after a wide glyph into a space, so every italic
and poetic passage arrives broken. This is Psalm 1 as it comes out:

```
B lessed is the m an
Who walks not in the counsel of the ungodly ,
```

That is most of the Psalter, every prophetic oracle, and the Beatitudes. Two
things make repairing it a decision rather than a guess.

**The gap has a cause, and the cause constrains it.** It only ever opens after
`m`, `v`, `w`, `y` or a lone letter, because those are the glyphs the typesetter
kerns. Every other space in the book is therefore known to be real and is never
touched. That one constraint is what keeps `it may be` and `any one of them`
intact while `heav en` and `m ourn` are joined.

**Fragments are re-segmented, not paired up.** `com m andm ents` needs a
four-way merge whose intermediate steps (`comm`, `commandm`) are not words, so
no rule that joins neighbouring pairs can ever reach it. The whole run goes
through dynamic programming instead, scoring each candidate segmentation by
summed log probability. That also settles the ambiguous cases on evidence
rather than on a hand-written exception: `may be` scores far better split than
joined, and `m an` far better joined than split.

**The vocabulary has to be learned somewhere the fault cannot reach**, or the
broken forms teach the repairer their own mistakes. Counted naively over the
whole book, `judgm` occurs 158 times and `ent` 247, and a segmenter will then
happily keep `judgm ent` apart. Choosing a "clean region" does not work either,
because the Beatitudes are poetry inside an otherwise clean gospel. What works
is positional: a fragment is only ever created *before* another lowercase word,
so a token appearing immediately before punctuation or a capital is, by
construction, a whole word. Counting only those positions gives a vocabulary the
artefact cannot contaminate, and in it every fragment reads zero.

Splitting a run that arrived with no spaces at all gets its own unfiltered
count, because that job is mostly function words and the positional vocabulary
is blind to them: `the` and `in` are almost never followed by punctuation.

### Drop caps

Every chapter opens with one, and the exporter emits the words beside the cap as
their own short line, out of order with the lines above and below:

```
again He entered Capernaum after some days, and it was heard that He was in the
2 And
house. 2Immediately many gathered together...
```

Nothing is lost, it is transposed, so the opening is put back in reading order.
Without this, verse 1 of all 1,344 chapters is missing outright. Where the cap
spans two printed lines the two fragments arrive concatenated, which is why
Genesis opened `Inandthedarkness`; those are split back into words by the same
segmenter.

## What it gets, and what it does not

From a full run over the OSB export:

| | |
|---|---|
| Books | 76 |
| Chapters | 1,344 |
| Verses recovered | 35,633 |
| Verses not recovered | 270 (0.75%) |
| Verses with a jammed run | 62 (0.17%) |
| Verses with stray digits | 65 (0.18%) |
| Parse time | about 1.5 seconds |
| Size on device | about 5 MB |

So roughly **99% of verses come out clean**. Psalm 22, the Beatitudes, John 1:1
and the end of Revelation all read correctly.

The residue is concentrated in chapter openings, because that is where the drop
cap is. Genesis 1:1 is the worst of them and still reads wrongly: the two
fragments beside its cap are recovered as words but land in the wrong order.

**A verse that could not be recovered is marked in the reader rather than
skipped.** A Bible that silently drops a verse is worse than one that admits to
it, because you cannot see the hole.

`tools/extract-bible-text.mjs` runs the same parser outside the browser and
prints these numbers, which is how a regression in it gets caught.

## How the text is stored

One JSON file per book under `www/bible/`, plus `_meta.json` for the summary
numbers the settings screen shows. `www/js/bible/text.js` fetches a book the
first time you open a chapter in it and keeps it in memory after that, and the
service worker precaches every file, so reading works offline from the first
launch rather than only after each book has been touched once.

`www/js/bible/parse.js` is still in the app, unused at runtime, because it is
the thing that would be needed again if this ever goes back to a device-side
import.

## The reader

One chapter on screen, Genesis 1 through to Revelation 22, with next and
previous. Reaching the bottom of a chapter marks it read, so the record builds
itself out of reading rather than out of remembering to tick something.

The unit is the chapter because it is the largest thing you can honestly say you
either read or did not. Verses are too fine to tick and would make the tracker
something you argue with.

## The context screens

Every one of the 76 books answers the same six questions: who wrote it, when,
where it sits in the story, what it is for, what to watch for while reading, and
how the Church reads it toward Christ. The four Gospels answer two more, which
are the only two that actually distinguish four accounts of the same events:
who it was written for, and what only this one gives you.

Written for this app, not copied. Where a traditional ascription is disputed the
entry says so rather than picking a side.

## What is deliberately not here

* **A lectionary or a reading plan.** Removed. A daily portion is a thing to
  fall behind on; the book has an order of its own and the reader follows it.
* **A verse-level tracker.** A chapter is the honest unit.
* **Silently dropping a verse the parser missed.** It is marked.
* **The text in a public place.** It is in this repository because this
  repository is private. It has never been, and must never be, in a GitHub
  Pages deployment or any other public surface. Note that Pages is public even
  when the repository is private, so `.github/workflows/pages.yml` was deleted
  outright rather than disabled: a workflow that is merely switched off is one
  click away from publishing the whole translation.

## Sources

* *The Orthodox Study Bible*, St. Athanasius Academy of Orthodox Theology, 2008.
  Old Testament: St. Athanasius Academy Septuagint. New Testament: New King
  James Version. The canon structure in `canon.js` is taken from this edition's
  own navigation index; its text is not in this repository.
* The Greek Orthodox Archdiocese of America, goarch.org, for the daily readings
  and the calendar the section links to.
