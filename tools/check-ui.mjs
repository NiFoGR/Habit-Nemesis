// The stylesheet's own rules, checked. `npm run check:ui`.
//
// One scale and one palette only work if drift fails a build. Saying it in
// CLAUDE.md was not enough: the app reached 45 hand-written font sizes on top
// of the eight it already had, which is what makes a screen look assembled by
// several people.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(root + 'www/styles.css', 'utf8');

// Everything before the first closing brace of :root declares the scale itself.
const declares = css.slice(0, css.indexOf('}', css.indexOf('--safe-t')));
const body = css.slice(declares.length);
const lineOf = (index) => declares.length + index === 0 ? 1 : css.slice(0, declares.length + index).split('\n').length;

const problems = [];

/* ---------------- type ---------------- */

const SIZES = [...declares.matchAll(/--f-([a-z]+):/g)].map((m) => m[1]);
for (const m of body.matchAll(/font-size:\s*([^;]+);/g)) {
  const value = m[1].trim();
  if (/^var\(--f-[a-z]+\)$/.test(value)) continue;
  if (value === 'inherit' || value === '1em' || value === '0.85em') continue;
  // A component that scales with its own --size carries its label with it.
  if (/^calc\(var\(--[a-z-]+\)/.test(value)) continue;
  problems.push(`${lineOf(m.index)}: font-size ${value}. Use one of ${SIZES.map((s) => `--f-${s}`).join(', ')}.`);
}

/* ---------------- corners ---------------- */

// Forty-five hand-written sizes was the type problem. Twenty-six corner radii
// was the same problem in another property, and it is what makes a screen read
// as a pile of unrelated boxes.
for (const m of body.matchAll(/border-radius:\s*([^;]+);/g)) {
  const value = m[1].trim();
  if (/^(0|50%|inherit)$/.test(value)) continue;
  if (value.split(/\s+/).every((part) => /^(var\(--r-[a-z]+\)|0)$/.test(part))) continue;
  problems.push(`${lineOf(m.index)}: border-radius ${value}. Use --r-card, --r-ctrl, --r-chip or --r-pill.`);
}

/* ---------------- space ---------------- */

// The same problem again, in a third property. The app carried 25 different
// hand-written spacing values, which is why two screens never shared a rhythm.
// Structural spacing, 16px and up, comes off the scale. Below 16 is optical:
// a nudge inside a control, not the rhythm between sections.
const SPACE = /^(?:margin|padding|gap|row-gap|column-gap)(?:-top|-bottom|-left|-right|-block|-inline)?$/;
for (const m of body.matchAll(/([a-z-]+):\s*([^;{]+);/g)) {
  if (!SPACE.test(m[1])) continue;
  const value = m[2].trim();
  // calc, clamp and env are doing something other than rhythm.
  if (/calc\(|clamp\(|env\(/.test(value)) continue;
  for (const px of value.matchAll(/(\d+)px/g)) {
    if (Number(px[1]) < 16) continue;
    problems.push(`${lineOf(m.index)}: ${m[1]} ${value}. Use --s-4 to --s-9, or --pad.`);
    break;
  }
}

/* ---------------- colour ---------------- */

// A hex outside :root is a colour nobody else can reuse and nothing can theme.
for (const m of body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
  const line = lineOf(m.index);
  const context = css.split('\n')[line - 1] || '';
  // A gradient stop is allowed: it is one shape's own light, not a UI colour.
  if (/gradient|shadow|filter/.test(context)) continue;
  problems.push(`${line}: raw colour ${m.group ? m[0] : m[0]}. Add a token or use one.`);
}

/* ---------------- report ---------------- */

if (!problems.length) {
  const n = [...body.matchAll(/font-size:/g)].length;
  console.log(`ok  ${n} font sizes, all on the scale (${SIZES.length} rungs)`);
  console.log(`ok  ${[...body.matchAll(/border-radius:/g)].length} corners, all on the four tokens`);
  console.log(`ok  ${[...body.matchAll(/(?:margin|padding|gap)[a-z-]*:/g)].length} spacings, structural ones on the scale`);
  console.log('ok  no raw colours outside the palette');
  process.exit(0);
}
console.log(`${problems.length} to fix in www/styles.css:`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
