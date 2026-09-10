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

/** The boss: your best week, with his face on it, what has passed between you,
 *  and when you next meet. On the weeks he is the fixture the duel already
 *  carries him, so the card would be the same face and score twice. */
function bossHtml() {
  const said = dailyLine();
  const opp = arena.fixtureFor(arena.currentWeek());
  const playing = opp.id === 'nemesis' || opp.knockout === 'final';
  const n = playing ? null : arena.nemesisWeek();
  if (!n) return said ? `<p class="ar-said lone">${faceAvatar(32)}<span>${escapeHtml(said)}</span></p>` : '';

  // The record, then the countdown. The week he was set is on his own screen.
  const h = arena.headToHead();
  const meet = arena.nextMeeting();
  const sub = [];
  if (h.met) sub.push(`${h.w} - ${h.l}`);
  if (meet) sub.push(meet.away === 1 ? 'Next week' : `In ${meet.away} weeks`);
  if (!sub.length) sub.push(arena.weekLabel(n.key));

  return `<div class="ar-boss">
    <a class="ar-boss-who" href="#/arena/nemesis">
      ${faceAvatar(48)}
      <span class="ar-boss-name"><b>Your Nemesis</b><i>${escapeHtml(sub.join(' \u00b7 '))}</i></span>
      <b class="ar-boss-score">${pct(n.score)}</b>
    </a>
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
