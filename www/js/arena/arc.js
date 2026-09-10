// The Arc: the seasonal cup. A button on the Arena, and the screen behind it.
//
// The screen is always three sections in one order: the cup, the group, the
// knockout. A state changes what a section says, never whether it is there.

import * as store from '../store.js';
import * as arena from './program.js';
import { escapeHtml, pct, chime, haptic, celebrate } from '../ui.js';
import { icon } from '../icons.js';
import { cup } from './cup.js';
import { wireWeeks } from './week-sheet.js';

const ROUNDS = ['qf', 'sf', 'final'];

/* Sounded once per state per session. Opening it four times is not four cups. */
let sounded = '';

/** What the screen shows, as one word. A break after a defeat is still that
 *  defeat; a break before you ever entered is not one. */
function shown(st) {
  // Summer holds no cup, whatever a saved file says.
  if (!st.arc.cup) return 'shut';
  if (st.phase === 'champion') return 'won';
  if (st.phase === 'out') return 'out';
  if (st.phase === 'break') return st.lostAt || st.rec.qualified === false ? 'out' : 'shut';
  if (st.phase === 'group') return 'group';
  return 'knockout';
}

/** Where it ended. Never entered is not knocked out. */
function ended(st) {
  if (st.lostAt) return `Out in the ${arena.KNOCKOUT[st.lostAt].name.toLowerCase()}`;
  return st.eligible ? 'Out at the group stage' : 'Not enough weeks played';
}

/* ---- the button on the Arena ---- */

/** One row: which cup, where it is up to, and the way in. */
export function arcHtml() {
  const st = arena.arcState();
  const state = shown(st);
  const arc = state === 'shut' ? st.next : st.arc;
  const tone = state === 'won' ? 'won' : state === 'group' || state === 'knockout' ? 'live' : '';
  return `<button class="arc-btn ${tone}" data-nav="arena-arc">
    <span class="arc-btn-art">${cup(arc.id, 34)}</span>
    <span class="arc-btn-text">
      <b>${escapeHtml(state === 'shut' ? st.nextLabel : st.label)}</b>
      <i>${escapeHtml(subtitle(st, state))}</i>
    </span>
    <span class="arc-btn-go">${icon('back', 16)}</span>
  </button>`;
}

function subtitle(st, state) {
  if (state === 'shut') return `Opens in ${st.opensIn} day${st.opensIn === 1 ? '' : 's'}`;
  if (state === 'won') return 'Won';
  if (state === 'out') return ended(st);
  if (state === 'group') {
    return st.eligible
      ? `Group stage, ${st.groupLeft} week${st.groupLeft === 1 ? '' : 's'} to the knockout`
      : `Group stage, ${st.played} of the ${st.need} weeks played`;
  }
  return st.round.name;
}

/* ---- the screen ---- */

export function renderArc(mount) {
  const st = arena.arcState();
  const state = shown(st);
  // Shut counts down to the next cup, so the whole screen is about that one.
  const arc = state === 'shut' ? st.next : st.arc;
  // Once. It sorts every stored week.
  const g = arena.groupTable(arc);

  mount.innerHTML = `
    <div class="screen arc" data-state="${state}">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>The Arc</h1>
        <span class="icon-btn ghost"></span>
      </header>
      ${cupSection(st, state, arc)}
      ${groupSection(st, state, g)}
      ${knockSection(st, state, arc)}
    </div>`;

  wireWeeks(mount);
  perform(mount, st, state);
}

/* ---- the cup ---- */

function cupSection(st, state, arc) {
  const eyebrow = state === 'shut' ? 'Next'
    : state === 'out' ? 'Out'
      : state === 'group' ? 'Group stage'
        : state === 'won' ? 'Champion' : st.round.name;
  const line = cupLine(st, state);
  return `<section class="arc-cup ${state}">
    <span class="arc-cup-art">${cup(arc.id, 132)}</span>
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h2 class="arc-cup-name">${escapeHtml(state === 'shut' ? st.nextLabel : st.label)}</h2>
    ${line ? `<p class="arc-cup-line">${line}</p>` : ''}
    ${state === 'won' && st.rec.note ? `<p class="said-quote">“${escapeHtml(st.rec.note)}”</p>` : ''}
  </section>`;
}

/** One fact, and only one. */
function cupLine(st, state) {
  const days = (n) => `<b>${n}</b> day${n === 1 ? '' : 's'}`;
  if (state === 'shut') return `Opens in ${days(st.opensIn)}`;
  if (state === 'out') return `${escapeHtml(ended(st))}. Opens again in ${days(st.opensIn)}`;
  if (state === 'group') return `<b>${st.groupLeft}</b> week${st.groupLeft === 1 ? '' : 's'} to the knockout`;
  if (state === 'knockout') return `${days(arena.daysLeftInWeek())} left`;
  // Champion: the cup, the year and the line you left. Nothing else.
  return '';
}

/* ---- the group ---- */

/** Every row is a week out of your own record, which the line has to say: a
 *  table of scores you have never seen reads as other people. */
function groupSection(st, state, g) {
  // Nothing has been played into a cup that has not opened, so the preview is
  // the field alone: your own row would be a 0% that means nothing.
  const preview = state === 'shut';
  const rows = preview ? g.table.filter((r) => !r.you) : g.table;
  const thin = preview ? g.rivals < arena.ARC_MIN_RIVALS : rows.length <= 1;

  if (thin) {
    return `<section class="card arc-group">
      <h2>The group</h2>
      <p class="arc-note">Your group fills up as you play weeks.</p>
    </section>`;
  }

  const verdict = preview || state === 'group' ? ''
    : st.rec.qualified === true ? 'Through'
      : st.rec.qualified === false ? 'Out here' : '';

  return `<section class="card arc-group">
    <div class="ar-fx-head">
      <h2>The group</h2>
      ${verdict ? `<span class="pill ${verdict === 'Through' ? 'done' : 'ghost'}">${verdict}</span>` : ''}
    </div>
    <p class="arc-note">${preview ? 'The field, fixed the day it opens.' : 'Weeks out of your own record.'}</p>
    <div class="ar-table">
      ${rows.map((r, i) => `<div class="ar-tr ${r.you ? 'you' : ''} ${!preview && g.eligible && i < 3 ? 'q' : 'nq'}" style="--i:${i}"${
        r.week ? ` data-week="${escapeHtml(r.week)}"` : ''
      }>
        <span class="ar-pos">${i + 1}</span>
        <span class="ar-tn">${escapeHtml(r.name)}</span>
        <b>${pct(r.score)}</b>
      </div>`).join('')}
    </div>
    ${preview || g.eligible ? '' : `<p class="arc-note">${escapeHtml(shortfall(g))}</p>`}
  </section>`;
}

/** Why this is not a cup yet. */
function shortfall(g) {
  if (g.rivals < arena.ARC_MIN_RIVALS) return 'Not enough weeks on the record to make a field to beat.';
  return `${g.played} of the ${g.need} weeks a cup wants.`;
}

/* ---- the knockout ---- */

/** Three columns at 320px gave each round forty pixels, so the rounds stack on
 *  a rail and step narrower instead: the bracket, read downwards. */
function knockSection(st, state, arc) {
  // The season's last three weeks are qf, sf and final, which is arcStage's
  // own rule. arcSeason, not st.season: in summer the two are different arcs.
  const weeks = arena.arcSeason(arc).slice(-3);
  const stored = store.get().arena.weeks;
  return `<section class="card arc-knock">
    <h2>The knockout</h2>
    <div class="arc-bracket">
      ${ROUNDS.map((id, i) => tie(st, state, id, i, weeks[i], stored[weeks[i]])).join('')}
    </div>
  </section>`;
}

/** A scoreline once it is played, the score so far while it is on, and the
 *  opponent it will be until then. */
function tie(st, state, id, i, key, week) {
  const r = state === 'shut' ? null : st.rec[id];
  const now = state === 'knockout' && st.stage === id;
  const played = r === 'won' || r === 'lost';

  const mine = played ? week?.score : now ? arena.scoreWeek(arena.currentWeek()).score : null;
  const theirs = played ? week?.oppScore : now ? st.fixture?.score : null;
  const who = (played ? week?.oppName : now ? st.fixture?.name : '') || arena.KNOCKOUT[id].who;
  const open = played ? key : now ? arena.currentWeek() : '';

  return `<div class="arc-tie ${r || ''} ${now ? 'now' : ''} ${played || now ? '' : 'todo'}" style="--i:${i}"${
    open ? ` data-week="${escapeHtml(open)}"` : ''
  }>
    <span class="arc-tie-node"></span>
    <span class="arc-tie-body">
      <b>${escapeHtml(arena.KNOCKOUT[id].name)}</b>
      <i>${escapeHtml(who)}</i>
    </span>
    ${mine == null || theirs == null ? ''
      : `<span class="arc-tie-score"><b>${pct(mine)}</b><i>${pct(theirs)}</i></span>`}
  </div>`;
}

/* ---- noise ---- */

/** Quiet unless something is on. A defeat makes no sound: a punishing noise is
 *  how you get someone to stop opening the app. */
function perform(mount, st, state) {
  const once = `${st.key}:${state}`;
  if (sounded === once) return;
  sounded = once;
  if (state === 'won') {
    chime('trophy');
    haptic('trophy');
    setTimeout(() => celebrate(mount.querySelector('.arc-cup-art'), {
      count: 30, spread: 150, colour: 'var(--warn)',
    }), 900);
  } else if (state === 'knockout') {
    // On the bracket landing, so the note names what has just arrived.
    setTimeout(() => { chime('phase'); haptic('kickoff'); }, 1000);
  }
}
