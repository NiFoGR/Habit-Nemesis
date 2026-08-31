// The Arc: the seasonal cup, in whichever of its five states it is in.
//
// break and out are a countdown, group is a table, qf/sf/final are a bracket,
// champion is a trophy. One function per state, chosen once.

import * as arena from './program.js';
import { escapeHtml, pct } from '../ui.js';
import { icon } from '../icons.js';

export function arcHtml() {
  const st = arena.arcState();
  if (st.phase === 'break' || st.phase === 'out') return closed(st);
  if (st.phase === 'champion') return won(st);
  if (st.phase === 'group') return group(st);
  return knockout(st);
}

/** No cup on: a countdown, and the last one if there was one. */
function closed(st) {
  // Never entered is not knocked out. Saying otherwise invents a defeat.
  const ended = st.phase !== 'out'
    ? ''
    : st.rec.qualified === false
      ? st.eligible
        ? `Out at the group stage of the ${escapeHtml(st.arc.name)}.`
        : `Not enough weeks played for the ${escapeHtml(st.arc.name)}.`
      : `Out in the ${escapeHtml(arena.KNOCKOUT[st.lostAt]?.name.toLowerCase() || 'knockout')} of the ${escapeHtml(st.arc.name)}.`;
  return `<div class="arc-wait">
    <span class="arc-wait-mark">${icon('trophy', 20)}</span>
    <span class="arc-wait-text">
      <b>${escapeHtml(st.next.name)} Trophy</b>
      <i>${ended ? `${ended} Opens again in ` : 'Opens in '}<b>${st.opensIn}</b> day${st.opensIn === 1 ? '' : 's'}</i>
    </span>
  </div>`;
}

/** The group. The line between third and fourth is the only thing on it.
 *  Every row is a week out of your own record, which the subtitle has to say:
 *  a table of scores you have never seen before reads as other people. */
function group(st) {
  const g = arena.groupTable(st.arc);
  // No field yet means no table, and a card holding two apologies is worse
  // than the one line that says when it starts mattering.
  if (g.table.length <= 1) return waiting(st, 'Your group fills up as you play weeks.');

  const left = `${st.groupLeft} week${st.groupLeft === 1 ? '' : 's'} to the knockout`;
  return `<section class="card">
    <div class="ar-fx-head"><h2>${escapeHtml(st.label)}</h2></div>
    <p class="ar-fx-sub">Weeks out of your own record. Top three go through.</p>
    <p class="ar-fx-meta">${escapeHtml(left)}</p>
    <div class="ar-table">
      ${g.table
        .map((r, i) => `<div class="ar-tr ${r.you ? 'you' : ''} ${g.eligible && i < 3 ? 'q' : 'nq'}" ${r.week ? `data-week="${r.week}"` : ''}>
          <span class="ar-pos">${i + 1}</span>
          <span class="ar-tn">${escapeHtml(r.name)}</span>
          <b>${pct(r.score)}</b>
        </div>`)
        .join('')}
    </div>
    ${g.eligible ? '' : `<p class="ar-fx-none">${escapeHtml(shortfall(g))}</p>`}
  </section>`;
}

/** One line, when the cup is not yet a thing that can be won. */
function waiting(st, why) {
  return `<div class="arc-wait">
    <span class="arc-wait-mark">${icon('trophy', 20)}</span>
    <span class="arc-wait-text">
      <b>${escapeHtml(st.label)}</b>
      <i>${escapeHtml(why)} ${st.groupLeft} week${st.groupLeft === 1 ? '' : 's'} to the knockout.</i>
    </span>
  </div>`;
}

/** Why this is not a cup yet. Nothing is green until it can qualify. */
function shortfall(g) {
  if (g.rivals < arena.ARC_MIN_RIVALS) return 'Not enough weeks on the record yet to make a field to beat.';
  return `${g.played} of ${g.need} weeks played. A cup wants at least ${g.need} of them.`;
}

/** A knockout round you are in. */
function knockout(st) {
  const rounds = ['qf', 'sf', 'final'];
  return `<section class="card ar-knock">
    <div class="ar-fx-head">
      <h2>${escapeHtml(st.label)}</h2>
      <span class="pill ghost">${escapeHtml(st.round?.name || 'Knockout')}</span>
    </div>
    <div class="ar-bracket">
      ${rounds
        .map((id) => {
          const r = st.rec[id];
          const here = st.stage === id;
          const label = r === 'won' ? 'Won' : r === 'lost' ? 'Lost' : here ? 'Playing now'
            : rounds.indexOf(id) < rounds.indexOf(st.stage) ? 'Not played' : 'To come';
          return `<div class="ar-round ${r || ''} ${here ? 'here' : ''}">
            <b>${escapeHtml(arena.KNOCKOUT[id].name)}</b><span>${escapeHtml(label)}</span>
            <i>${escapeHtml(arena.KNOCKOUT[id].opponent)}</i>
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

function won(st) {
  return `<section class="card ar-won">
    <span class="cup-art">${icon('trophy', 30)}</span>
    <div>
      <b>${escapeHtml(st.trophy)} won</b>
      <i>The final is always your own best week. You beat it.</i>
    </div>
  </section>`;
}
