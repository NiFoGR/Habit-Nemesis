# NiFo: standing rules

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
- Prefer a visual cue to a sentence: bar, ring, dot, heatmap, chart, icon.
  Only when it fits and looks right. A bad chart is worse than a number.
- Numbers carry units, dates are short, nothing wraps to three lines.
- One accent, one sans. Colour means state (done, due, missed), never section.
  Exceptions: a habit's own colour, the serif on scripture, division crests.

## Structure

- One folder per feature under `www/js/`. Shell files at the top level.
- Same filenames in each: `program.js` domain, `home.js` screens,
  `session.js` the thing that runs, `tracking.js` the record.
- A setting lives with the thing it affects. App-wide ones in `settings.js`.
- Export only what another file imports. Everything else stays local.
- No dead code. Delete it, git has it.
- Back is `data-back`, answered by `back.js`. Never a link.
- New or renamed file: update `SHELL` in `www/sw.js` and bump `CACHE`.
- Tooling lives in `tools/`, never in `www/`.

## Data

- localStorage on device. No account, no server, no analytics.
- Schema additive: `hydrate()` merges saved state over `blank()`.
- Sanitise on read. A saved file is untrusted input.

## Before pushing

- `npm run check:arena` for the calendar maths.
- `npm run dev` and walk the routes you touched. No console errors.
- Re-read the diff for text that got long and comments that became prose.
