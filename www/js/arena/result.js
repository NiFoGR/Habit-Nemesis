// Telling you what happened.
//
// Two sizes of the same job. A week that ended, a division that moved or an
// Arc round that was played gets the full screen, because those are the three
// moments the whole feature exists for and a number quietly changing while you
// were not looking is not a moment. A feat earned mid-tap gets one line that
// slides in and goes away again, because interrupting the grid to hand you a
// certificate would make you stop ticking things.
//
// Both are announced once. The full screen marks the week seen the instant it
// renders rather than when you press the button, so backing out of it does not
// bounce you straight back in.

import * as store from '../store.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, chime, celebrate, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, replaceWith } from '../back.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/** Feats earned since boot that the full screen has not shown yet. Held in
 *  memory on purpose: if the app is closed before the screen appears, the feat
 *  is still earned and still in the list, and re-announcing it a week later
 *  would be worse than not announcing it at all. */
let queued = [];

/* ---------------- the one-line pop ---------------- */

/** Check for newly earned feats and announce each one. Called from the places
 *  a feat is actually earned - a cell tapped on the grid, a session finished,
 *  a measurement saved - which is where the old badge checks were called from,
 *  so this replaces them one for one rather than adding a new sweep. */
export function announce() {
  const fresh = feats.check();
  fresh.forEach((f, i) => setTimeout(() => pop(f), i * 1400));
  return fresh;
}

/** Boot, and every return to the app: fold the record forward and hold
 *  anything new for the full screen. Adds rather than replaces, because this
 *  runs again every time the app comes back to the foreground and a feat
 *  earned at launch must not be dropped by a check that found nothing. */
export function collect() {
  arena.sync();
  const fresh = feats.check();
  if (fresh.length) queued = queued.concat(fresh);
  return queued;
}

export function hasResults() {
  return !!arena.unseenResults() || queued.length > 0;
}

function pop(feat) {
  // No settings check here or below: chime and haptic honour the two switches
  // themselves, so every caller in the app gets it right for free.
  chime('feat');
  haptic('feat');
  const el = document.createElement('button');
  el.className = 'feat-pop';
  el.innerHTML = `<span class="fp-ico">${icon(feat.icon, 20)}</span>
    <span class="fp-text"><i>Feat earned</i><b>${escapeHtml(feat.name)}</b></span>`;
  el.addEventListener('click', () => {
    el.remove();
    navigate('#/arena/feats');
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  celebrate(el, { count: 10, spread: 60 });
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

/* ---------------- the full screen ---------------- */

const MOVES = {
  up: { word: 'Promoted', chime: 'promote', haptic: 'promote' },
  down: { word: 'Relegated', chime: 'relegate', haptic: 'relegate' },
  held: { word: 'Held', chime: null, haptic: null },
  placed: { word: 'Placed', chime: 'promote', haptic: 'promote' },
};

/* Marked seen on the way OUT, not on the way in.
 *
 * The first version marked it as it drew, which meant the screen ate the very
 * thing that put it there: render it a second time - and the router will, on a
 * reload, or when a navigation resolves twice - and it finds nothing owed and
 * throws you off it. Worse, a reload while the result was up lost it for good.
 *
 * Marking on the way out fixes both directions, and the feats it was carrying
 * go back on the queue if you leave without revealing, so nothing is ever
 * announced to an empty room. `leaveResult` is the router's, the same way the
 * gallery's object URLs are. */
let showing = null;

export function leaveResult() {
  if (showing?.res) arena.markSeen(showing.res.key);
  if (showing && !showing.revealed && showing.fresh.length) queued = showing.fresh.concat(queued);
  showing = null;
}

export function renderResult(mount) {
  if (!showing) {
    const res = arena.unseenResults();
    const fresh = queued;
    queued = [];
    // Nothing owed. That happens for one real reason: the app was closed on
    // this screen, so the next launch restores the hash and arrives here with
    // the announcement already made. Replace rather than navigate, and go to
    // the grid rather than the Arena - a launch lands on the grid, always, and
    // a screen that should not have existed must not sit on the back stack.
    if (!res && !fresh.length) return replaceWith('#/hub');
    showing = { res, fresh, revealed: false };
  }
  const { res, fresh } = showing;
  if (showing.revealed) return drawFull(mount, res, fresh);

  // The result is behind one tap, and that is not ceremony for its own sake.
  // A screen reached by the app opening has had no gesture on it, so a phone
  // refuses to vibrate and an AudioContext refuses to start: played on arrival
  // the whole thing would be silent and still. The tap is what makes the sound
  // legal, and a week you won is worth a moment of not knowing anyway.
  mount.innerHTML = `
    <div class="screen result">
      <section class="rs-hero pending">
        <p class="eyebrow">${res ? escapeHtml(arena.weekLabel(res.key)) : 'Since you were last here'}</p>
        <h1 class="rs-word">${res ? 'Your week is in' : fresh.length === 1 ? 'A feat' : `${fresh.length} feats`}</h1>
        <p class="muted small">${res
          ? `Against ${escapeHtml(res.week.oppName || 'the bar')}.`
          : 'Earned while you were about your business.'}</p>
        <button class="btn primary big" id="reveal">${res ? 'See the result' : 'Show me'}</button>
      </section>
    </div>`;

  mount.querySelector('#reveal').addEventListener('click', () => {
    showing.revealed = true;
    drawFull(mount, res, fresh);
  });
}

function drawFull(mount, res, fresh) {
  const won = res?.week.result === 'won';
  const move = res?.month ? MOVES[res.month.move] || MOVES.held : null;
  // Rows are read live and shown as fractions with no total under them. The
  // headline is the score the week was decided on, and one week must never
  // carry two numbers.
  const rows = res ? arena.scoreWeek(res.key).rows.filter((r) => r.due) : [];
  const ranked = [...rows].sort((a, b) => b.done / b.due - a.done / a.due);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  mount.innerHTML = `
    <div class="screen result">
      ${res
        ? `<section class="rs-hero ${won ? 'won' : 'lost'}" id="hero">
            <p class="eyebrow">${escapeHtml(arena.weekLabel(res.key))}</p>
            <h1 class="rs-word">${won ? 'Week won' : 'Week lost'}</h1>
            <div class="rs-score">
              <span class="me"><b>${pct(res.week.score)}</b><i>You</i></span>
              <span class="vs">${icon('versus', 18)}</span>
              <span class="them"><b>${pct(res.week.oppScore)}</b><i>${escapeHtml(res.week.oppName || 'The Standard')}</i></span>
            </div>
            <p class="muted small">${res.week.done} of ${res.week.due} cells${
              // Only if this week was the knockout. The arc block below reports
              // a round played in an earlier unseen week, and stamping its name
              // on this week's headline said the wrong week had been the final.
              res.arc?.week === res.key ? ` · ${escapeHtml(arena.KNOCKOUT[res.arc.round]?.name || 'Knockout')}` : ''
            }</p>
          </section>`
        : ''}

      ${res && best && worst && best.id !== worst.id && worst.done < worst.due
        ? `<section class="card rs-detail">
            <div class="kv"><span>Carried you</span><b>${escapeHtml(best.name)} <em>${best.done}/${best.due}</em></b></div>
            <div class="kv"><span>Cost you</span><b>${escapeHtml(worst.name)} <em>${worst.done}/${worst.due}</em></b></div>
          </section>`
        : ''}

      ${res?.arc ? arcBlock(res.arc) : ''}
      ${move ? moveBlock(res.month, move) : ''}

      ${fresh.length
        ? `<section class="card">
            <h2>${fresh.length === 1 ? 'A feat' : `${fresh.length} feats`}</h2>
            ${fresh
              .map((f) => `<div class="rs-feat">
                <span class="ft-ico on">${icon(f.icon, 18)}</span>
                <span><b>${escapeHtml(f.name)}</b><i>${escapeHtml(f.blurb)}</i></span>
              </div>`)
              .join('')}
          </section>`
        : ''}

      ${res && arena.isBestWeek(res.key) ? noteBlock(res.key) : ''}

      <button class="btn primary big" id="onward" data-back>${escapeHtml(res ? 'Into the week' : 'Good')}</button>
      <a class="btn ghost wide" href="#/arena">${icon('trophy', 16)}<span>The Arena</span></a>
    </div>`;

  const hero = mount.querySelector('#hero');
  // One sound, and it is the biggest thing that happened: a promotion outranks
  // the week that earned it, and an Arc won outranks both. Three motifs on top
  // of one another was noise, and you could not tell which was which.
  const kind = res?.arc?.won && res.arc.round === 'final' ? 'trophy' : move?.chime || (res ? (won ? 'win' : 'loss') : 'feat');
  chime(kind);
  haptic(move?.haptic || (res ? (won ? 'win' : 'loss') : 'feat'));
  if (hero && (won || move?.word === 'Promoted')) {
    setTimeout(() => celebrate(hero, { count: 22, spread: 130, colour: 'var(--good)' }), 120);
  }

  wireNote(mount, res);
  mount.querySelector('#onward').addEventListener('click', () => navigate('#/hub'));
  window.scrollTo(0, 0);
}

/* ---------------- a line for whoever has to beat it ----------------
   Offered on the week that becomes your best, and read back to you by that
   same week when it turns up as your Nemesis. It is the only free text in the
   Arena and it is the only thing in here that is not a number, which is the
   point: a number cannot say anything to you. */

function noteBlock(key) {
  const existing = arena.noteFor(key);
  return `<section class="card note-ask" id="noteAsk">
    <h2>Your best week</h2>
    <p class="muted small">You have never had a better one. Leave a line for whoever has to beat it — because that will be you, and he will be reading it.</p>
    <input type="text" id="noteText" maxlength="${arena.MAX_NOTE}" autocomplete="off"
      placeholder="Beat that." value="${escapeHtml(existing)}">
    <button class="btn" id="noteSave">${existing ? 'Change it' : 'Leave it'}</button>
  </section>`;
}

function wireNote(mount, res) {
  const save = mount.querySelector('#noteSave');
  if (!save || !res) return;
  const field = mount.querySelector('#noteText');
  save.addEventListener('click', () => {
    arena.setNote(res.key, field.value);
    haptic('press');
    const box = mount.querySelector('#noteAsk');
    box.innerHTML = field.value.trim()
      ? `<h2>Left on the record</h2><p class="said-quote">“${escapeHtml(field.value.trim().slice(0, arena.MAX_NOTE))}”</p>
         <p class="muted small">He will see it the next time this week comes up as your Nemesis.</p>`
      : '<h2>Nothing said</h2><p class="muted small">The week stands on its own, then.</p>';
  });
}

function arcBlock(arc) {
  const round = arena.KNOCKOUT[arc.round];
  if (!round) return '';
  const final = arc.round === 'final';
  return `<section class="card rs-arc ${arc.won ? 'won' : 'out'}">
    <span class="rs-cup">${icon('trophy', 26)}</span>
    <div>
      <b>${arc.won ? (final ? 'Arc won' : `${round.name} won`) : `${round.name} lost`}</b>
      <i>${arc.won && final ? 'The final is always your own best week. You beat it.' : escapeHtml(`Against ${round.opponent}.`)}</i>
    </div>
  </section>`;
}

function moveBlock(month, move) {
  const from = arena.divisionOf(month.from);
  const to = arena.divisionOf(month.to);
  const monthName = new Date(`${month.month}-04T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `<section class="card rs-move ${month.move}">
    <p class="eyebrow">${escapeHtml(monthName)} · ${pct(month.score)} · ${month.w}W–${month.l}L</p>
    <h2>${escapeHtml(move.word)}</h2>
    <div class="rs-move-row">
      <span class="rs-div ${month.move === 'down' ? 'gone' : ''}">${escapeHtml(from.name)}</span>
      ${month.from === month.to ? '' : `<span class="rs-arrow">${icon(month.move === 'down' ? 'arrowDown' : 'arrowUp', 16)}</span>
      <span class="rs-div now">${escapeHtml(to.name)}</span>`}
    </div>
    <p class="muted small">${escapeHtml(to.blurb)}</p>
  </section>`;
}
