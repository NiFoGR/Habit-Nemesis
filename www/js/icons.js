// Inline SVG icon set. One visual language: 24px grid, 1.75 stroke, round caps,
// currentColor. No emoji, they render differently on every device and cannot
// take the app's colours.

const svg = (body, size) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true">${body}</svg>`;

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  // Sliders rather than a gear: at 20px a gear's teeth turn into a sun.
  settings:
    '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  ruler:
    '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M7 8v3M12 8v4M17 8v3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-5-4-6-4-10 0 0-3 1.5-3 5 0 1.5-1 2-1.5 1.2C10 10 9.5 9 9.5 9 7 11 5 12.5 5 15a7 7 0 0 0 7 7z"/>',
  stretch: '<path d="M12 3v18"/><path d="M8 6.5L12 2.5l4 4M8 17.5l4 4 4-4"/>',
  pump: '<circle cx="12" cy="14" r="6"/><path d="M9 5h6M12 5v3"/>',
  camera:
    '<path d="M3 8.5h3.5L8 6h8l1.5 2.5H21a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  images: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-6 6"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10v-6z"/><path d="M12 8v4M12 15.5v.01"/>',
  warn: '<path d="M12 3.5L22 20H2z"/><path d="M12 10v4M12 17v.01"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M9 3l2 6M15 3l-2 6"/>',
  flash: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-.7.7-.7 1.3M12 16.5v.01"/>',
  repeat: '<path d="M4 10a6 6 0 0 1 6-6h9"/><path d="M16 1l3 3-3 3"/><path d="M20 14a6 6 0 0 1-6 6H5"/><path d="M8 23l-3-3 3-3"/>',
  droplet: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z"/>',
  // The two-year ladder, pocket mode and the app lock.
  route: '<circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M6 7.5v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4"/>',
  vibrate: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 9v6M20 9v6"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M17 5l2 2M14 8l2 2"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H19"/>',
  // Open on a lectern, with the cross on the page, so it reads as scripture
  // rather than as the closed book the prayer section already uses.
  scripture:
    '<path d="M12 6.5C10.5 5 8 4.3 4 4.3V18c4 0 6.5.7 8 2.2 1.5-1.5 4-2.2 8-2.2V4.3c-4 0-6.5.7-8 2.2z"/><path d="M12 6.5v14"/><path d="M15.5 10h4M17.5 8v4"/>',
  // Prayer: the two slots, and a link that leaves the app.
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  // A breath: the centre held, two rings of it moving out. Reads as expansion
  // rather than as lungs, which at 20px turn into a smudge.
  breath:
    '<circle cx="12" cy="12" r="3.2"/><path d="M8.4 8.6a5.4 5.4 0 0 0 0 6.8M15.6 8.6a5.4 5.4 0 0 1 0 6.8"/><path d="M5.2 5.8a10 10 0 0 0 0 12.4M18.8 5.8a10 10 0 0 1 0 12.4"/>',
  // Half a sun, filled. Colour temperature has no obvious glyph, and a moon
  // already means the night prayers, so this says "warmth" instead of "night".
  warmth:
    '<circle cx="12" cy="12" r="4.6"/><path d="M12 7.4a4.6 4.6 0 0 0 0 9.2z" fill="currentColor" stroke="none"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};

/** icon('back') → inline SVG string. */
export function icon(name, size = 20) {
  return svg(PATHS[name] || PATHS.target, size);
}

/** The NiFo mark itself, the same arc-and-dot as the launcher icon. */
export function logoMark(size = 26) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true" class="logo-mark">
    <defs><linearGradient id="nifoG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3c5"/><stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient></defs>
    <circle cx="20" cy="20" r="14" stroke="url(#nifoG)" stroke-width="5.5"
            stroke-linecap="round" stroke-dasharray="79 88" transform="rotate(-72 20 20)"/>
    <circle cx="20" cy="20" r="4" fill="#f0fdfa"/>
  </svg>`;
}
