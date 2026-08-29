// The seven crests. Artwork, one file per rung in www/img/, square,
// transparent, 256px, so one file serves the 92px hero and a 28px badge.
// The filename comes from the generated manifest, so a badge sent as a PNG and
// replaced later by a WebP needs no change here.
//
//   0 Bottom G   1 NPC   2 Prospect   3 Contender
//   4 Menace     5 Locked In         6 Top G

import { artSrc } from '../artwork.js';

const ART = [
  'rank-0-bottom',
  'rank-1-npc',
  'rank-2-prospect',
  'rank-3-contender',
  'rank-4-menace',
  'rank-5-locked',
  'rank-6-topg',
];

/** Not a rung: drawn, not cropped. Before your first week there is nothing to
 *  be a picture of. */
export const UNRANKED = -1;
const UNRANKED_ART = 'rank-unranked';

export const crestSrc = (i) =>
  artSrc(i === UNRANKED ? UNRANKED_ART : ART[Math.max(0, Math.min(i, ART.length - 1))]);

/** `i` is the rung, 0 to 6, or UNRANKED. Decorative: the name is always beside it. */
export function crest(i, size = 64) {
  const rung = i === UNRANKED ? UNRANKED : Math.max(0, Math.min(i, ART.length - 1));
  return `<img class="crest rung-${rung === UNRANKED ? 'none' : rung}" src="${crestSrc(rung)}"
    width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false">`;
}
