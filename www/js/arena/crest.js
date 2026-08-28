// The seven crests.
//
// The answer to "it looks like a fancier Excel spreadsheet" is not seven
// colours - that experiment ran once already, made the app read as six apps,
// and got deleted. It is seven pieces of artwork that grow in *complexity*, so
// where you are on the ladder is a shape rather than a label.
//
//   Bottom G   an empty shield, one chevron
//   NPC        an empty shield, two chevrons
//   Prospect   the shield begins to fill
//   Contender  filled, three chevrons
//   Menace     filled on the brand ramp
//   Locked In  laurels
//   Top G      laurels and a crown
//
// One accent and the brand gradient, which is the same pair the logo mark and
// the bottom bar use, so nothing new enters the palette. Drawn at a 48 grid and
// scaled, because it has to survive being 22px on a bottom bar and 96px at the
// top of the Arena.

const SHIELD = 'M24 3.5 41 9.5v13c0 10.5-7 18.6-17 21.8C14 41.1 7 33 7 22.5v-13z';

/** Unique per call: two copies of one gradient id on a page is invalid markup,
 *  and Safari resolves both to whichever it saw first. */
const uid = () => `cr${Math.random().toString(36).slice(2, 7)}`;

/** A chevron pointing up, `n` of them stacked from the bottom of the shield. */
function chevrons(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = 31 - i * 6.5;
    out.push(`<path d="M15 ${y} 24 ${y - 6} 33 ${y}" fill="none" stroke="currentColor" stroke-width="3.2"
      stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  return out.join('');
}

const LAURELS = `
  <path d="M4.5 16c-2.6 5.4-1.6 12.4 2.2 16.6M9.5 14.4c-2.2 4.6-1.4 10.6 1.9 14.2" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
  <path d="M43.5 16c2.6 5.4 1.6 12.4-2.2 16.6M38.5 14.4c2.2 4.6 1.4 10.6-1.9 14.2" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.75"/>`;

/* Sits above the shield, never on it. Drawn outside the group that shrinks and
   drops the shield to make room, because a crown cutting through the top edge
   reads as a shield that has been broken rather than one that has been won. */
const CROWN = `
  <path d="M14 10.5 15.5 2l4.2 4.6L24 1.2l4.3 5.4L32.5 2 34 10.5z" fill="none" stroke="currentColor"
    stroke-width="2.2" stroke-linejoin="round"/>`;

/**
 * `i` is the division's rung, 0 to 6.
 * Returns a standalone inline SVG, sized in pixels.
 */
export function crest(i, size = 64) {
  const id = uid();
  const rung = Math.max(0, Math.min(i, 6));
  // Every rung differs from the one below it, and never by one thing only:
  // chevrons carry the climb, the shield carries how solid you are, and the
  // last two rungs earn ornament. Bottom G's shield is dashed because at that
  // point you do not really have one.
  const chev = [1, 1, 2, 2, 3, 3, 3][rung];
  const brand = rung >= 4;
  const fill = brand ? `url(#${id})` : ['none', 'none', 'rgba(34,211,197,0.10)', 'rgba(34,211,197,0.20)'][rung];
  const laurels = rung >= 5;
  const crown = rung >= 6;

  return `<svg class="crest rung-${rung}" width="${size}" height="${size}" viewBox="0 0 48 48"
      fill="none" role="img" aria-hidden="true">
    ${brand ? `<defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3c5" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.4"/>
    </linearGradient></defs>` : ''}
    ${crown ? CROWN : ''}
    <g${crown ? ' transform="translate(2.88 8) scale(0.88)"' : ''}>
      ${laurels ? LAURELS : ''}
      <path d="${SHIELD}" fill="${fill}" stroke="currentColor" stroke-width="2.4"
        stroke-linejoin="round" opacity="${rung === 0 ? 0.45 : rung === 1 ? 0.7 : 1}"
        ${rung === 0 ? 'stroke-dasharray="5 4"' : ''}/>
      ${chevrons(chev)}
    </g>
  </svg>`;
}
