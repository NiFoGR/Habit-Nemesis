// The three cups. Artwork, one file per season in www/img/, square,
// transparent, 256px, so one file serves the 68px ceremony and a 30px shelf.
//
// Until the artwork lands the trophy icon stands in, so every screen that shows
// a cup already asks for the right one by name.
//
//   winter   spring   autumn        blank = a shelf with nothing on it

import { artSrc } from '../artwork.js';
import { icon } from '../icons.js';

const BLANK = 'cup-blank';

export const cupSrc = (arcId) => artSrc(`cup-${arcId}`) || artSrc(BLANK);

/** `arcId` is winter, spring or autumn, or nothing for an empty shelf.
 *  Decorative: the season is always named beside it. */
export function cup(arcId, size = 64) {
  const src = cupSrc(arcId || BLANK);
  if (!src) return icon('trophy', Math.round(size * 0.5));
  return `<img class="cup-img ${arcId ? `cup-${arcId}` : 'cup-none'}" src="${src}"
    width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false">`;
}
