// Inline SVG icons. 24px grid, 1.75 stroke, round caps, currentColor. No emoji.

const svg = (body, size) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true">${body}</svg>`;

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  // Sliders, not a gear: at 20px a gear's teeth turn into a sun.
  settings:
    '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-5-4-6-4-10 0 0-3 1.5-3 5 0 1.5-1 2-1.5 1.2C10 10 9.5 9 9.5 9 7 11 5 12.5 5 15a7 7 0 0 0 7 7z"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10v-6z"/><path d="M12 8v4M12 15.5v.01"/>',
  warn: '<path d="M12 3.5L22 20H2z"/><path d="M12 10v4M12 17v.01"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M9 3l2 6M15 3l-2 6"/>',
  flash: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  repeat: '<path d="M4 10a6 6 0 0 1 6-6h9"/><path d="M16 1l3 3-3 3"/><path d="M20 14a6 6 0 0 1-6 6H5"/><path d="M8 23l-3-3 3-3"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H19"/>',
  // The account row in Settings.
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  // Habits: a checklist. A calendar and a tick are both taken.
  habits: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6.2l1.4 1.4L7.6 4.9"/><path d="M3.5 12.2l1.4 1.4 2.7-2.7"/><path d="M3.5 18.2l1.4 1.4 2.7-2.7"/>',
  pencil: '<path d="M4 20.5h4l10.5-10.5-4-4L4 16.5z"/><path d="M14.5 6l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9L17.5 7"/><path d="M10.5 11v5M13.5 11v5"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.2"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
  // Skip: a day stepped over, not one failed.
  skip: '<path d="M5 6l8 6-8 6z"/><path d="M18 6v12"/>',
  // Reorder mode.
  reorder: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  // Filter: three rules, narrowing.
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  arrowUp: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
  caretUp: '<path d="M6 14.5l6-6 6 6"/>',
  caretDown: '<path d="M6 9.5l6 6 6-6"/>',
  arrowDown: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',

  /* ---- the Arena ---- */
  // Cup. A medal reads as a participation badge at 16px.
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 14v3M8.5 20h7M9.5 20l.6-3h3.8l.6 3"/>',
  // Fixture, not a fight. Has to read at 14px.
  versus: '<path d="M4 5l5 7-5 7"/><path d="M20 5l-5 7 5 7"/>',
  // Division crown.
  crown: '<path d="M4 17h16"/><path d="M4 17L3 7l5 4 4-6 4 6 5-4-1 10z"/>',
  // The divisions, as a thing you climb.
  ladder: '<path d="M7 3v18M17 3v18"/><path d="M7 8h10M7 12h10M7 16h10"/>',
};

/** icon('back') -> inline SVG string. */
export function icon(name, size = 20) {
  return svg(PATHS[name] || PATHS.target, size);
}

/* ---- the mark ---- */

// An N with two slits cut down its diagonal, on a 100 x 100 box with y down.
// Contours, outer first: the two after it are holes, so both the SVG below and
// the rasteriser in tools/gen-icons.mjs fill even-odd. Exported rather than
// copied, because the launcher icon and the mark on screen have to be one
// drawing and two point lists drift apart.
//
// The outer ring is a heavy N with every outside corner chamfered, which is
// what stops it reading as a typeface. The slits run parallel to the diagonal,
// wide where they meet a stem and tapering to a point: thin slivers, not
// wedges. Fattening them turns the middle into a zigzag and the letter stops
// being an N at launcher size.
export const MARK = [
  [
    [0, 11], [11, 0], [30, 0], [70, 56], [70, 0], [89, 0], [100, 11],
    [100, 89], [89, 100], [70, 100], [30, 44], [30, 100], [11, 100], [0, 89],
  ],
  [[26, 20], [40, 54], [26, 34]],
  [[56, 42], [70, 76], [56, 56]],
];

const points = (ring) => ring.map(([x, y]) => `${x},${y}`).join(' ');

/** The app mark. Takes its colour from the text colour around it. */
export function logoMark(size = 26) {
  return `<svg width="${size}" height="${size}" viewBox="-6 -6 112 112" fill="none" aria-hidden="true" class="logo-mark">
    <path fill="currentColor" fill-rule="evenodd" d="${MARK.map((ring) => `M${points(ring)}Z`).join('')}"/>
  </svg>`;
}
