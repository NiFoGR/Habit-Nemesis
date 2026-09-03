# Habit Nemesis: standing rules

Read before changing anything. These outrank habit and outrank the old code
still sitting in the tree.

## Comments

- A label, not prose. `// Promotion` beats a sentence saying it promotes you.
- One line. Never a paragraph, never a story, never the reason it was written.
- Only where it saves a future read: a non-obvious rule, a unit, an order that
  matters, a trap. If the code already says it, say nothing.
- Section banners split long files: `/* ---- scoring ---- */`.
- JSDoc only for a signature that is not obvious from the name. One line.
- Reasons and history go in the PR body, never in the file.

## Writing

Applies to comments, UI copy, docs, commits and PRs.

- No em dashes. Comma, colon or full stop.
- Short. Cut any sentence that does not change what the reader does.
- No hedging, no filler, no restating the heading.

## The app on screen

- Labels, not paragraphs. A screen reads in one glance or it is too long.
  A guide, a tutorial or a safety warning is the exception and may be prose.
- Prefer a visual cue to a sentence: bar, ring, dot, heatmap, chart, icon.
  Only when it fits and looks right. A bad chart is worse than a number.
- Numbers carry units, dates are short, nothing wraps to three lines.
- One accent, one sans. Colour means state (done, due, missed), never section.
  Exceptions: a habit's own colour, and the division crests.

### The scale, and how it stays one

Every size in the app is one of the ten rungs in `:root`, and every colour is
one of the tokens. `npm run check:ui` fails on a raw `font-size` or a hex
outside the palette. This is checked rather than asked for because asking did
not work: the app reached forty-five hand-written sizes on top of the eight it
already had, which is what makes one screen look assembled by several people.

- Pick the rung by the job, not by the pixels: `--f-mega` is a running numeral,
  `--f-hero` the one number a screen is about, `--f-sub` a screen's h1,
  `--f-head` a card's h2, `--f-fine` a caption, `--f-micro` an axis label.
- A new size means a missing rung. Add it to `:root` with a comment saying what
  it is for, or use the nearest one. Never both a rung and a rem.

### One state colour per block

A block gets at most one coloured line. If a bar already says "below the bar"
in amber, the sentence under it does not say it again in words: cut the words
and keep the bar. Everything else in the block is text, muted or faint.

Before adding a line to a screen, delete one. Two lines that agree are one line
and a repetition, and the repetition is what makes a screen feel bloated.

## Structure

- One folder per feature under `www/js/`. Shell files at the top level.
- Same filenames in each: `program.js` domain, `home.js` screens,
  `tracking.js` the record.
- A setting lives with the thing it affects. App-wide ones in `settings.js`.
- Export only what another file imports. Everything else stays local.
- No dead code. Delete it, git has it.
- Back is `data-back`, answered by `back.js`. Never a link.
- New or renamed file: update `SHELL` in `www/sw.js` and bump `CACHE`.
- Tooling lives in `tools/`, never in `www/`.

## Data

- localStorage on device. No account, no server, no analytics. Accounts are
  planned, not built: see `docs/RELEASE.md` before assuming either way.
- Schema additive: `hydrate()` merges saved state over `blank()`.
- Sanitise on read. A saved file is untrusted input.

## The mark

An N, cut through the diagonal. It exists twice over and the order matters:

- `art/source/mark.png` is the artwork, and wins whenever it is present.
- `MARK` in `www/js/icons.js` is a polygon, used on screen and as the stand-in
  for the icons when there is no file.

`tools/gen-icons.mjs` imports both, so there is no third copy to drift. It trims
the padding off an export and squares the corners, because both stores round
their own and a pre-rounded icon comes out rounded twice.

Changing either means re-running `npm run icons`. The store's copy lands in
`store/`, never in `www/`.

## Before pushing

- `npm run check` for the calendar maths and the stylesheet's own rules.
- `npm run dev` and walk the routes you touched. No console errors.
- Re-read the diff for text that got long and comments that became prose.
