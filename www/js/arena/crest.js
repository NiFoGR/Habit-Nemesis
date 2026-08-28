// The seven crests.
//
// These are artwork, not drawings the app makes: one file per rung in
// `www/img/`, cropped from the set that was drawn for them. The version before
// this one built each crest as an SVG out of chevrons, laurels and a crown,
// on the reasoning that rank should be shape rather than colour so the app
// kept one theme. That reasoning holds for the rest of the app and does not
// hold here, for the same reason a habit keeps the colour you chose for it: a
// rank badge is the one thing on the screen whose whole job is to be a picture
// of where you are, and the drawn version could not carry a joke.
//
//   0 Bottom G   dashed, pink, barely a shield
//   1 NPC        orange
//   2 Prospect   silver
//   3 Contender  gold
//   4 Menace     purple
//   5 Locked In  red
//   6 Top G      gold, crowned
//
// Square, transparent, 256px, about 10KB each, so one file answers the 92px
// hero and a 28px badge without a second size. They are precached with
// everything else, so a crest is never a hole on the screen while it loads.

const ART = [
  'rank-0-bottom',
  'rank-1-npc',
  'rank-2-prospect',
  'rank-3-contender',
  'rank-4-menace',
  'rank-5-locked',
  'rank-6-topg',
];

export const crestSrc = (i) => `./img/${ART[Math.max(0, Math.min(i, ART.length - 1))]}.webp`;

/**
 * `i` is the division's rung, 0 to 6. Returns an `<img>`, sized in pixels.
 * Decorative: the division's name is always next to it, so nothing is lost by
 * hiding it from a screen reader.
 */
export function crest(i, size = 64) {
  const rung = Math.max(0, Math.min(i, ART.length - 1));
  return `<img class="crest rung-${rung}" src="${crestSrc(rung)}" width="${size}" height="${size}"
    alt="" aria-hidden="true" draggable="false">`;
}
