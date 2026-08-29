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
  console.log('ok  no raw colours outside the palette');
  process.exit(0);
}
console.log(`${problems.length} to fix in www/styles.css:`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
