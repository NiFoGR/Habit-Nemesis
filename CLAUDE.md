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

**The home screen is the grid.** Every commitment you have — the five the app
itself asks of you, and every habit you added — is a row. There is no menu
above it and no dashboard beside it, because both were the same list again.

Two rules, no exceptions:

- **The name goes there.** Tapping "Kegels" opens the Kegels section; tapping
  a habit opens its own screen.
- **The cell does it.** Tapping today starts the session, or marks the day.
  Only today acts; the days behind it are a record.

**One theme.** One accent, one sans, one set of state colours. Colour answers
*what state is this in* — done, due, missed — and nothing else. It does not
answer "which section am I in": that experiment ran for five sections and made
the app read as five apps. The two exceptions are both deliberate: a habit's
own colour, which you chose and which carries information the shape does not,
and the serif, which appears only on scripture and prayer text because reading
1,344 chapters in a UI sans is worse.

**Everything on the device.** No account, no server, no analytics. Saved state
is never trusted: it comes back through `hydrate()` in `store.js`, which
coerces every value to the type and range it is supposed to be.

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

There is no build step and no test runner. What there is:

- `node tools/serve.mjs` and drive it in a real browser. Chromium and
  Playwright are the way this has been checked: walk every route, click every
  control, run every player, and seed the store with fresh / heavily-used /
  exactly-one-of-each data, because empty and full both hide the off-by-one.
- Check the things a screen cannot tell you it got wrong: two screens
  disagreeing about the same number, a class rendered that the stylesheet never
  defines, `NaN` or `undefined` reaching the page.
- Adding a file means adding it to `ASSETS` in `www/sw.js` **and** bumping
  `CACHE`. Forgetting the bump ships code nobody can see.
