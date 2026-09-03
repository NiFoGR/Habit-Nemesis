// Telling you what happened. Full screen for a week, a division or an Arc
// round; one sliding line for a feat, so the grid is not interrupted.
// Both announced once.

import * as arena from './program.js';
import * as feats from './feats.js';
import { captureFace, face, faceAvatar } from './face.js';
import { shareWeek } from './share.js';
import { escapeHtml, chime, celebrate, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, replaceWith } from '../back.js';
import * as ads from '../ads/program.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/** Feats earned since boot, held in memory: closing the app keeps them earned
 *  and re-announcing a week later would be worse. */
let queued = [];

/* ---------------- the one-line pop ---------------- */

/** Check and announce. Called where a feat is actually earned. */
export function announce() {
  const fresh = feats.check();
  fresh.forEach((f, i) => setTimeout(() => pop(f), i * 1400));
  return fresh;
}

/** Boot and every foreground: fold forward and hold anything new. Adds rather
 *  than replaces. */
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
  // chime and haptic honour the switches themselves.
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


/* Marked seen on the way OUT. Marking as it draws makes the screen eat what
 * put it there, and a reload loses it for good. Leaving is seeing, feats
 * included: feats.check() has already written them to the record. */
let showing = null;

export function leaveResult() {
  if (showing?.res) {
    arena.markSeen(showing.res.key);
    // The week's one ad, on the way out. Never over the result itself.
    ads.showWeekly(showing.res.key);
  }
  showing = null;
}

export function renderResult(mount) {
  if (!showing) {
    const res = arena.unseenResults();
    const fresh = queued;
    queued = [];
    // Nothing owed: the app was closed here and the launch restored the hash.
    // Replace, and to the grid.
    if (!res && !fresh.length) return replaceWith('#/hub');
    showing = { res, fresh, revealed: false };
    // Loaded now, shown on the way out, so the wait happens while reading.
    if (res) ads.prepareWeekly(res.key);
  }
  const { res, fresh } = showing;
  if (showing.revealed) return drawFull(mount, res, fresh);

  // Behind one tap: a screen reached by launching has had no gesture, so sound
  // and vibration would both be refused.
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
  // Rows read live, as fractions with no total: the headline is the decided score.
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
            <p class="muted small">${
              // Only if this week was the knockout. The arc block below reports
              // a round played in an earlier unseen week, and stamping its name
              // on this week's headline said the wrong week had been the final.
              res.arc?.week === res.key ? escapeHtml(arena.KNOCKOUT[res.arc.round]?.name || 'Knockout') : ''
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

      ${fresh.length
        ? `<section class="card">
            <h2>${fresh.length === 1 ? 'A feat' : `${fresh.length} feats`}</h2>
            ${fresh
              .map((f) => `<div class="rs-feat">
                <span class="ft-ico on">${icon(f.icon, 18)}</span>
                <span><b>${escapeHtml(f.name)}</b></span>
              </div>`)
              .join('')}
          </section>`
        : ''}

      ${res && arena.isBestWeek(res.key) ? noteBlock(res.key) : ''}

      <button class="btn primary big" id="onward" data-back>${escapeHtml(res ? 'Into the week' : 'Good')}</button>
      <div class="rs-exits">
        ${res ? `<button class="btn ghost" id="shareWeek">${icon('external', 16)}<span>Share</span></button>` : ''}
        <a class="btn ghost linkbtn" href="#/arena">${icon('trophy', 16)}<span>The Arena</span></a>
      </div>
    </div>`;

  const hero = mount.querySelector('#hero');
  // One sound, the biggest thing that happened here. The month's verdict has a
  // screen of its own now and brings its own.
  const kind = res?.arc?.won && res.arc.round === 'final' ? 'trophy' : res ? (won ? 'win' : 'loss') : 'feat';
  chime(kind);
  haptic(kind);
  if (hero && won) {
    setTimeout(() => celebrate(hero, { count: 22, spread: 130, colour: 'var(--good)' }), 120);
  }

  mount.querySelector('#shareWeek')?.addEventListener('click', () => shareWeek(res.key));
  wireNote(mount, res);
  mount.querySelector('#onward').addEventListener('click', () => navigate('#/hub'));
  window.scrollTo(0, 0);
}

/* ----------------------- notes ----------------------- */

function noteBlock(key) {
  const existing = arena.noteFor(key);
  const has = !!face();
  return `<section class="card note-ask" id="noteAsk">
    <h2>Your best week</h2>
    <p class="muted small">This week is your Nemesis now.</p>

    <div class="nem-ask">
      ${faceAvatar(64)}
      <div>
        <b>${has ? 'Put this week on him' : 'Give him a face'}</b>
      </div>
      <button class="btn small-btn" id="faceGo">${has ? 'Retake' : 'Take one'}</button>
    </div>

    <label class="fineprint" for="noteText">A line for whoever beats it.</label>
    <input type="text" id="noteText" maxlength="${arena.MAX_NOTE}" autocomplete="off"
      placeholder="Beat that." value="${escapeHtml(existing)}">
    <button class="btn" id="noteSave">${existing ? 'Change it' : 'Leave it'}</button>
  </section>`;
}

function wireNote(mount, res) {
  const save = mount.querySelector('#noteSave');
  if (!save || !res) return;

  mount.querySelector('#faceGo')?.addEventListener('click', async () => {
    haptic('press');
    if (!(await captureFace(res.key))) return;
    const slot = mount.querySelector('.nem-ask');
    if (!slot) return;
    slot.querySelector('.nem-face')?.replaceWith(nodeFrom(faceAvatar(64)));
    slot.querySelector('b').textContent = 'That is him now';
    slot.querySelector('#faceGo').textContent = 'Retake';
    chime('feat');
  });

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

/** One element from a markup string. */
function nodeFrom(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
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

