// One crest per division. Artwork in www/img/, square, transparent, 384px, so
// one file serves the 92px hero and a 28px badge.
//
// Keyed by division id, never by rung number: a rung inserted in the middle of
// the ladder would otherwise renumber every file above it. The filename comes
// from the generated manifest, so a badge sent as a PNG and replaced later by
// a WebP needs no change here either.

import { artSrc } from '../artwork.js';
import { DIVISIONS } from './program.js';

/** Not a rung: before your first week there is nothing to be a picture of. */
export const UNRANKED = -1;

const idOf = (i) => (i === UNRANKED ? 'unranked' : (DIVISIONS[Math.max(0, Math.min(i, DIVISIONS.length - 1))] || {}).id);

export const crestSrc = (i) => artSrc(`rank-${idOf(i)}`);

/** The colour each crest is actually painted in, for the rail beside it.
 *  CLAUDE.md keeps colour for state, with a division's crest as one of the
 *  named exceptions. Taken off the artwork, not invented. */
const HUE = {
  bottom: '#f472b6',
  npc: '#c8a97e',
  mentzer: '#ef4444',
  prospect: '#b98b62',
  contender: '#cbd5e1',
  menace: '#fbbf24',
  locked: '#9a8250',
  topg: '#a855f7',
  full: '#22d3c5',
};

export const crestHue = (i) => HUE[idOf(i)] || 'var(--accent)';

/** `i` is the rung, or UNRANKED. Decorative: the name is always beside it. */
export function crest(i, size = 64) {
  const id = idOf(i);
  return `<img class="crest rung-${id}" src="${crestSrc(i)}"
    width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false">`;
}
