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

  /* ---- habit glyphs ---- */
  // Drawn inside a 20px ring, so one shape each and no interior detail.
  dumbbell: '<path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4"/><path d="M6.5 12h11"/>',
  steps: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5L9 9h5.5l4 7.5"/><path d="M12.5 16.5L9 9"/><path d="M13 5.5h2.5"/>',
  drop: '<path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  apple: '<path d="M12 7.5c-1.5-1.5-4-1.5-5.5 0C4 10 4.5 15 7 18.5c1.5 2 3 2 5 1 2 1 3.5 1 5-1 2.5-3.5 3-8.5.5-11-1.5-1.5-4-1.5-5.5 0z"/><path d="M12 7.5c0-2 1-3.5 3-4.5"/>',
  leaf: '<path d="M4 20C4 9 10 4 20 4c0 10-5 16-16 16z"/><path d="M4 20c3-5 7-9 11-11"/>',
  cup: '<path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2a2.5 2.5 0 0 1 0 5h-2"/>',
  pill: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 15.5l7-7"/>',
  heart: '<path d="M12 20.5s-8-4.8-8-11A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5c0 6.2-8 11-8 11z"/>',
  tooth: '<path d="M8 3.5c2 0 2.5 1 4 1s2-1 4-1c3 0 4.5 3 3.5 6s-2.5 5-3 8c-.3 2-1 3-2 3S13 17 12 17s-1.5 3.5-2.5 3.5-1.7-1-2-3c-.5-3-2.5-5-3-8s.5-6 3.5-6z"/>',
  bed: '<path d="M3 18V7"/><path d="M3 12h15a3 3 0 0 1 3 3v3"/><path d="M3 15.5h18"/><circle cx="7.5" cy="8.5" r="1.75"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/><path d="M14 4l-4 16"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5a2.5 2 0 0 0-5 0c0 2.5 5 1.5 5 4a2.5 2 0 0 1-5 0"/><path d="M12 6.5v11"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-6h4v6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2"/><path d="M9 9.5v.01M15 9.5v.01"/>',
  star: '<path d="M12 3l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8z"/>',
};

/** The glyphs a habit can carry, in picker order. The sanitiser holds the same list. */
export const HABIT_ICONS = [
  'dumbbell', 'steps', 'bike', 'drop', 'apple', 'leaf',
  'cup', 'pill', 'heart', 'tooth', 'bed', 'moon',
  'sun', 'book', 'pencil', 'code', 'music', 'chat',
  'coin', 'home', 'phone', 'ban', 'smile', 'star',
];

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
