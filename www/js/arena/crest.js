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

/** `i` is the rung, or UNRANKED. Decorative: the name is always beside it. */
export function crest(i, size = 64) {
  const id = idOf(i);
  return `<img class="crest rung-${id}" src="${crestSrc(i)}"
    width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false">`;
}
