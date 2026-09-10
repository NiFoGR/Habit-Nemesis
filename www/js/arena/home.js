// The Arena screen, assembled. Each block is a module, in the order the
// questions get asked.
//
//   who am I, what am I chasing   standing.js
//   am I winning                  fixture.js
//   how have I been               fixture.js, the form strip
//   what stands in the way        the boss, below
//   is a cup on                   arc.js

import * as store from '../store.js';
import * as arena from './program.js';
import { faceAvatar } from './face.js';
import { standingHtml, rungOf } from './standing.js';
import { fixtureHtml, wireFixture, formHtml } from './fixture.js';
import { arcHtml } from './arc.js';
import { wireWeeks } from './week-sheet.js';
import { dailyLine } from './line.js';
import { escapeHtml, pct } from '../ui.js';

export { openWeekSheet } from './week-sheet.js';
export { renderFeats, wireFeatTiles } from './feats-screen.js';

/** The boss: your best week, with his face on it and his line for the day.
 *  On the weeks he is the fixture the duel already carries him, so the card
 *  would be the same face, the same week and the same score twice. */
function bossHtml() {
  const said = dailyLine();
  const opp = arena.fixtureFor(arena.currentWeek());
  const playing = opp.id === 'nemesis' || opp.knockout === 'final';
  const n = playing ? null : arena.nemesisWeek();
  if (!n) return said ? `<p class="ar-said lone">${faceAvatar(32)}<span>${escapeHtml(said)}</span></p>` : '';
  return `<div class="ar-boss">
    <button class="ar-boss-who" data-week="${n.key}">
      ${faceAvatar(48)}
      <span class="ar-boss-name"><b>Your Nemesis</b><i>${escapeHtml(arena.weekLabel(n.key))}</i></span>
      <b class="ar-boss-score">${pct(n.score)}</b>
    </button>
    ${said ? `<p class="ar-said">${escapeHtml(said)}</p>` : ''}
  </div>`;
}

export function renderArena(mount) {
  // --lift tunes the glow behind the crest to how high you have climbed.
  mount.innerHTML = `
    <div class="screen arena" style="--lift:${rungOf()}">
      <header class="ar-head">${standingHtml()}</header>
      ${fixtureHtml()}
      ${formHtml(store.get().arena.weeks)}
      ${bossHtml()}
      ${arcHtml()}
    </div>`;

  wireFixture(mount);
  wireWeeks(mount);
}
