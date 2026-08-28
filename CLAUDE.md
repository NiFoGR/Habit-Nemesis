# Working on NiFo

## The rule that beats the others

**SIMPLE AND EFFECTIVE.** When there is a choice between a clever answer and a
plain one that does the same job, take the plain one. No second view of the
same data, no mode that could have been a setting, no abstraction with one
caller, no feature added because it would round out a set.

This is not a style note. Every bad screen in this app's history came from
adding rather than removing: a hub that was a menu of things that did not
exist, five section palettes that made one app look like five, a Today list
sitting above a grid that already said the same thing. The fix each time was
to delete something.

If a change makes the app easier to describe in one sentence, it is probably
right. If explaining it needs an "and also", stop.

## The shape of the app

**Three rooms, and the grid is the one you land in.** Every commitment you
have — the five the app itself asks of you, and every habit you added — is a
row on it. Above the grid there is nothing but the date and how much of today
is left: no dashboard, no summary card, no second list.

The bar at the bottom holds the other two rooms. **Grid** is now, **Arena** is
where you stand, **Cabinet** is what you have done. This looks like the menu
this file used to forbid, and the rule it replaces was written about something
else: the old hub was a *list of the things the grid already listed*, the same
data twice, one tap apart. No two of these three rooms show the same number.

The bar appears on those three and nowhere else. Everything deeper is a pushed
screen with a corner arrow — one rule, rather than a list of exceptions, and
the reader and the session players get the whole height.

Two rules, no exceptions:

- **The name goes there.** Tapping "Kegels" opens the Kegels section; tapping
  a habit opens its own screen.
- **The cell does it.** Tapping today starts the session, or marks the day.
  Only today acts; the days behind it are a record.

**Every opponent in the Arena is a real week out of your own record.** There
are no invented rivals and no other people, which is the only thing that makes
beating one mean anything — and the reason you can tap any of them and look at
the grid they actually played.

**A cup has a shape, so the screen has one too.** The Arc is a build-up, an
opening, a table, a knockout and a ceremony, and then a fortnight of nothing.
Between cups it is one line and a date; while nothing is happening it is not a
box saying nothing is happening. That is why the four arcs stopped tiling the
year end to end: while you were always in a cup, a cup was never something you
entered.

**One thing per screen gets to be loud.** Everything used to be a bordered card
with a heading and a pill in the corner, so a live cup final looked exactly like
a settings row — which is what "it looks like a fancier Excel spreadsheet"
meant, and it was right. Whatever is live now is elevated; everything else
recedes. This is not licence to decorate: it is licence for hierarchy.

**One theme.** One accent, one sans, one set of state colours. Colour answers
*what state is this in* — done, due, missed — and nothing else. It does not
answer "which section am I in": that experiment ran for five sections and made
the app read as five apps. Three exceptions, all deliberate: a habit's own
colour, which you chose and which carries information the shape does not; the
serif, which appears only on scripture and prayer text because reading 1,344
chapters in a UI sans is worse; and the seven division crests, which are
artwork rather than something the app draws. The crests had a version built out
of chevrons and laurels in the one accent, on exactly the reasoning above, and
it was the wrong call: a rank badge is the single thing on screen whose whole
job is to be a picture of where you stand, and a drawn one cannot carry a
joke.

**Everything on the device.** No account, no server, no analytics. Saved state
is never trusted: it comes back through `hydrate()` in `store.js`, which
coerces every value to the type and range it is supposed to be.

**A new install is only the three rooms.** The five that came with this app —
kegels, PE, the Bible, prayer, the wind-down — are what it is *for*, not what
it *is*, and the person installing it may be someone they have nothing to say
to. So they are behind one button at the foot of Settings, and that button
takes one attempt. This is not security and must never be written as though it
were: the PIN is a constant in `nifo.js` like any other. It exists so the app
can be handed to a friend. `intro.js` is what a new install is shown instead.

Two consequences worth holding on to. Whatever is added, ask what a locked
install sees — the router is an allow-list of the open routes for exactly that
reason, so a new section has to be let in on purpose rather than leaking by
default. And `hydrate()` defaults both of these fields the *opposite* way to
`blank()`: reaching hydrate at all means a saved state exists, so it is an
install already in use, and an update must not take the five off a phone that
has been running them for months.

## Where things are

[`docs/CODEMAP.md`](docs/CODEMAP.md) is the map, and it is kept current. One
folder per feature, the same filenames in each, a setting lives where the thing
it affects lives, and Back is not a link.

Every file opens with a comment saying what it is and *why it works the way it
does*. Match that: the comments in this repo explain decisions, not syntax, and
several of them exist because the obvious alternative was tried and was worse.

## One failure mode worth naming

A layout rule that encodes **how many** of something there are will break the
first time that number changes, and it will break silently. The section link
row was a four-column grid with a comment explaining why a wrapping row was
wrong; a fifth link then stranded itself for months. `.btn.wide` had a top
margin only, because when it was written it was always last on the screen.

Prefer the rule that does not need to know the count.

## Before you push

There is no build step and one check, `npm run check:arena`, which asserts the
Arena's calendar maths in bare node because that is the one corner of the app
whose answers cannot be read off a screen. Everything else is:

- `node tools/serve.mjs` and drive it in a real browser. Chromium and
  Playwright are the way this has been checked: walk every route, click every
  control, run every player, and seed the store with fresh / heavily-used /
  exactly-one-of-each data, because empty and full both hide the off-by-one.
- Check the things a screen cannot tell you it got wrong: two screens
  disagreeing about the same number, a class rendered that the stylesheet never
  defines, `NaN` or `undefined` reaching the page.
- Anything the app does at a moment it was not opened by hand — a result on
  launch, a sound, a buzz — has had no user gesture, and a phone refuses to
  vibrate or start an `AudioContext` without one. Put it behind a tap.
- A screen that redraws itself is a screen that cannot animate: nothing that is
  replaced can move. Marking a cell swaps that one cell and nudges the numbers
  that changed, which is why the rings sweep instead of jumping and why the
  page no longer fades back in under your thumb.
- Adding a file means adding it to `ASSETS` in `www/sw.js` **and** bumping
  `CACHE`. Forgetting the bump ships code nobody can see.
