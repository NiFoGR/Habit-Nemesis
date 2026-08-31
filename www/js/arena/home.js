// The Arena screen, assembled. Nothing is drawn here: each block is a module,
// in the order the questions get asked.
//
//   where do I stand   standing.js
//   am I winning       fixture.js
//   how have I been    fixture.js, the form strip
//   is a cup on        arc.js

import * as store from '../store.js';
import * as arena from './program.js';
import { face, faceAvatar } from './face.js';
import { standingHtml, rungOf } from './standing.js';
import { fixtureHtml, wireFixture, formHtml } from './fixture.js';
import { arcHtml } from './arc.js';
import { wireWeeks } from './week-sheet.js';
import { escapeHtml, pct } from '../ui.js';
import { icon } from '../icons.js';

export { openWeekSheet } from './week-sheet.js';
export { renderFeats, wireFeatTiles } from './feats-screen.js';

/** A line of his own, except on the weeks he is the fixture: the card above
 *  already carries the same face, the same week and the same score. */
function nemesisLine() {
  if (arena.fixtureFor(arena.currentWeek()).id === 'nemesis') return '';
  const n = arena.nemesisWeek();
  if (!n) return '';
  return `<button class="ar-nemesis" data-week="${n.key}">
    ${face() ? faceAvatar(36) : `<span class="ar-nico">${icon('flash', 16)}</span>`}
    <span class="ar-nname"><b>Your Nemesis</b><i>${escapeHtml(arena.weekLabel(n.key))}</i></span>
    <b class="ar-nscore">${pct(n.score)}</b>
  </button>`;
}

export function renderArena(mount) {
  // --lift tunes the glow behind the crest to how high you have climbed.
  mount.innerHTML = `
    <div class="screen arena" style="--lift:${rungOf()}">
      <header class="ar-head">${standingHtml()}</header>
      ${fixtureHtml()}
      ${formHtml(store.get().arena.weeks)}
      ${nemesisLine()}
      ${arcHtml()}
    </div>`;

  wireFixture(mount);
  wireWeeks(mount);
}
