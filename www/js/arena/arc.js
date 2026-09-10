// The Arc: the seasonal cup. A button on the Arena, and the screen behind it.
//
// The screen is always three sections in one order: the cup, the group, the
// knockout. A state changes what a section says, never whether it is there.

import * as store from '../store.js';
import * as arena from './program.js';
import { escapeHtml, pct, chime, haptic, celebrate, reducedMotion, openSheet } from '../ui.js';
import { icon } from '../icons.js';
import { cup } from './cup.js';
import { wireWeeks } from './week-sheet.js';

const ROUNDS = ['qf', 'sf', 'final'];

/* The draw and its noise, once per state per session. */
let played = '';

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What the screen shows, as one word. A break after a defeat is still that
 *  defeat; a break before you ever entered is not one. */
function shown(st) {
  // Summer holds no cup, whatever a saved file says.
  if (!st.arc.cup) return 'shut';
  if (st.phase === 'champion') return 'won';
  if (st.phase === 'entry') return 'entry';
  if (st.phase === 'out') return 'out';
  if (st.phase === 'break') return st.lostAt || st.rec.qualified === false ? 'out' : 'shut';
  if (st.phase === 'group') return 'group';
  return 'knockout';
}

/** Where it ended. Losing the group is not losing a round. */
const endedAt = (st) =>
  st.lostAt ? `Out in the ${arena.KNOCKOUT[st.lostAt].name.toLowerCase()}` : 'Out at the group stage';

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
  if (state === 'shut') return `Opens in ${plural(st.opensIn, 'day')}`;
  if (state === 'entry') return `Not entered, ${plural(st.opensIn, 'day')} to the ${st.next.name}`;
  if (state === 'won') return 'Won';
  if (state === 'out') return endedAt(st);
  if (state === 'group') {
    return st.played >= st.need
      ? `${ORDINALS[st.place]} of ${st.field}, ${plural(st.groupLeft, 'week')} to the knockout`
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
  const fresh = played !== `${st.key}:${state}` && !reducedMotion();

  mount.innerHTML = `
    <div class="screen arc ${fresh ? 'deal' : ''}" data-state="${state}">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>The Arc</h1>
        <span class="icon-btn ghost"></span>
      </header>
      ${cupSection(st, state, arc, g)}
      ${groupSection(st, state, g)}
      ${knockSection(st, state, arc)}
    </div>`;

  wireWeeks(mount);
  wireSheets(mount, g, arc);
  if (played !== `${st.key}:${state}`) {
    played = `${st.key}:${state}`;
    perform(mount, state);
  }
}

/* ---- the cup ---- */

/** The trophy, whose cup it is, and the one line the screen is about. */
function cupSection(st, state, arc, g) {
  const s = status(st, state, g);
  return `<section class="arc-cup ${state}">
    <span class="arc-cup-art">${cup(arc.id, 128)}</span>
    <p class="eyebrow">${escapeHtml(state === 'shut' ? st.nextLabel : st.label)}</p>
    <h2 class="arc-status ${s.tone} ${s.head.length > 15 ? 'long' : ''}">${
      // A word a span: without it "Semi-final" broke across two lines at its hyphen.
      s.head.split(' ').map((w) => `<span>${escapeHtml(w)}</span>`).join(' ')
    }</h2>
    ${s.fact ? `<p class="arc-fact">${escapeHtml(s.fact)}</p>` : ''}
    ${state === 'won' && st.rec.note ? `<p class="said-quote">“${escapeHtml(st.rec.note)}”</p>` : ''}
  </section>`;
}

/** The headline and the single fact under it, both read off the record. */
function status(st, state, g) {
  const days = (n) => plural(n, 'day');
  const weeks = (n) => plural(n, 'week');
  if (state === 'shut') return { head: `Opens in ${days(st.opensIn)}`, tone: 'cold', fact: 'The weeks you play now become the field.' };
  if (state === 'entry') return { head: 'Not in this cup', tone: 'cold', fact: `${st.nextLabel} opens in ${days(st.opensIn)}` };
  if (state === 'won') return { head: 'Champion', tone: 'gold', fact: '' };
  if (state === 'out') return { head: endedAt(st), tone: 'cold', fact: `Opens again in ${days(st.opensIn)}` };
  if (state === 'knockout') return { head: st.round.name, tone: 'live', fact: `${days(arena.daysLeftInWeek())} left` };
  // Group. Turning up comes first: a place in a field you have not made is noise.
  const short = st.need - st.played;
  if (short > 0) return { head: `${weeks(short)} to qualify`, tone: 'live', fact: `${weeks(st.groupLeft)} of the group left` };
  const seat = `${ORDINALS[g.place]} of ${g.table.length}, ${weeks(st.groupLeft)} to the knockout`;
  return g.place <= arena.ARC_THROUGH
    ? { head: 'In the hunt', tone: 'good', fact: seat }
    : { head: 'Outside the cut', tone: 'warn', fact: seat };
}

/* ---- the group ---- */

/** The gate first, then the field. Every row is a week out of your own record,
 *  which the gate's note has to say: a table of scores you have never seen
 *  reads as other people. */
function groupSection(st, state, g) {
  // Nothing has been played into a cup that has not opened, so the preview is
  // the field alone: your own row would be a 0% that means nothing.
  const preview = state === 'shut';
  const rows = preview ? g.table.filter((r) => !r.you) : g.table;
  const cut = !preview && g.eligible;

  return `<section class="card arc-group">
    <h2>The group</h2>
    ${gate(st, state, g)}
    ${rows.length > 1 ? `<div class="arc-field">
      ${rows.map((r, i) => `<div class="arc-row ${r.you ? 'you' : ''} ${cut && i + 1 === arena.ARC_THROUGH ? 'through' : ''}"
        style="--w:${(r.score * 100).toFixed(0)}%;--i:${i}"${r.week ? ` data-week="${escapeHtml(r.week)}"` : ''}>
        <span class="arc-row-pos">${i + 1}</span>
        <span class="arc-row-name">${escapeHtml(r.name)}</span>
        <b>${pct(r.score)}</b>
      </div>`).join('')}
    </div>
    <p class="arc-note">Every rival here is a week you have played.</p>` : ''}
  </section>`;
}

/** The one bar the screen is about: what stands between you and the knockout.
 *  The field a cup needs first, then the weeks you owe it. The label carries
 *  the verdict once there is one, because a settled cup cannot be re-run. */
function gate(st, state, g) {
  const settled = st.rec.qualified !== null && state !== 'shut';
  let label = 'Qualification';
  let have = g.played;
  let want = g.need;
  let tone = 'live';
  let note = `Top ${arena.ARC_THROUGH} of the field go through.`;

  if (g.rivals < arena.ARC_MIN_RIVALS) {
    label = 'The field';
    have = g.rivals;
    want = arena.ARC_MIN_RIVALS;
    tone = 'cold';
    note = 'A cup needs weeks on the record to play against.';
  } else if (state === 'entry') {
    tone = 'cold';
    note = 'Too few group weeks left to reach it.';
  } else if (state === 'shut') {
    // Nothing has been played into a cup that has not opened, so nothing is live.
    tone = 'cold';
  } else if (settled) {
    label = st.rec.qualified ? 'Through' : 'Out here';
    tone = st.rec.qualified ? 'good' : 'cold';
    note = `Top ${arena.ARC_THROUGH} of the field went through.`;
    // You cannot be through without having turned up, whatever the live count.
    if (st.rec.qualified) have = Math.max(have, want);
  } else if (have >= want) {
    tone = g.place <= arena.ARC_THROUGH ? 'good' : 'warn';
  }

  // Clamped: the gate is a threshold, so past it there is no more of it.
  const done = Math.min(have, want);
  const w = (done / Math.max(1, want)) * 100;
  return `<button class="arc-gate ${tone}" id="arcGate">
    <span class="arc-gate-top"><i>${escapeHtml(label)}</i><b>${done} of ${want} weeks</b></span>
    <span class="arc-gate-bar"><i style="width:${w.toFixed(0)}%"></i></span>
    <span class="arc-gate-note">${escapeHtml(note)}${icon('back', 13)}</span>
  </button>`;
}

/* ---- the knockout ---- */

/** Three columns at 320px gave each round forty pixels, so the rounds run down
 *  a rail instead: the bracket, read downwards, the final at the bottom. */
function knockSection(st, state, arc) {
  // The season's last three weeks are qf, sf and final, which is arcStage's
  // own rule. arcSeason, not st.season: in summer the two are different arcs.
  const weeks = arena.arcSeason(arc).slice(-3);
  const stored = store.get().arena.weeks;
  return `<section class="card arc-knock">
    <h2>The knockout</h2>
    <div class="arc-bracket">
      ${ROUNDS.map((id, i) => tie(st, state, id, i, weeks[i], stored[weeks[i]], arc)).join('')}
    </div>
    ${prize(state)}
  </section>`;
}

/** What the final is worth. Nothing once this cup is out of reach: a prize you
 *  can no longer play for is a taunt. */
function prize(state) {
  if (state === 'out') return '';
  return `<p class="arc-note">${state === 'won'
    ? 'The cup is in the Cabinet.'
    : 'Win the final and the cup goes in the Cabinet.'}</p>`;
}

/** A scoreline once it is played, the score so far while it is on, and the
 *  opponent it will be until then. The final carries the cup instead. */
function tie(st, state, id, i, key, week, arc) {
  const r = state === 'shut' || state === 'entry' ? null : st.rec[id];
  const now = state === 'knockout' && st.stage === id;
  const done = r === 'won' || r === 'lost';

  const mine = done ? week?.score : now ? arena.scoreWeek(arena.currentWeek()).score : null;
  const theirs = done ? week?.oppScore : now ? st.fixture?.score : null;
  const who = (done ? week?.oppName : now ? st.fixture?.name : '') || arena.KNOCKOUT[id].who;
  const open = done ? key : now ? arena.currentWeek() : '';
  const scored = mine != null && theirs != null;

  return `<div class="arc-tie ${id} ${r || ''} ${now ? 'now' : ''} ${done || now ? '' : 'todo'}" style="--i:${i}"${
    open ? ` data-week="${escapeHtml(open)}"` : ` data-round="${id}"`
  }>
    <span class="arc-tie-node"></span>
    <span class="arc-tie-body">
      <b>${escapeHtml(arena.KNOCKOUT[id].name)}</b>
      <i>${escapeHtml(who)}</i>
    </span>
    ${scored ? `<span class="arc-tie-score"><b>${pct(mine)}</b><i>${pct(theirs)}</i></span>`
      : done || now ? ''
        // The prize where the score will be, and a lock on the rounds before it.
        : id === 'final' ? `<span class="arc-tie-prize">${cup(arc.id, 34)}</span>`
          : `<span class="arc-tie-lock">${icon('lock', 15)}</span>`}
  </div>`;
}

/* ---- what a tap explains ---- */

function wireSheets(mount, g, arc) {
  mount.querySelector('#arcGate')?.addEventListener('click', () => {
    haptic('tick');
    openSheet(`
      <h2>Getting to the knockout</h2>
      <p class="muted small">Every rival in the group is a week you have played.</p>
      <ul class="arc-rules">
        <li><span><b>${arena.ARC_MIN_RIVALS} weeks</b> on the record outside this cup</span><i>${g.rivals} so far</i></li>
        <li><span><b>${g.need} of the ${g.groupWeeks.length}</b> group weeks played</span><i>${g.played} so far</i></li>
        <li><span><b>Top ${arena.ARC_THROUGH}</b> of the field go through</span><i>${g.table.length > 1 ? `${ORDINALS[g.place]} now` : 'no field yet'}</i></li>
      </ul>
      <button class="btn wide" data-close>Close</button>`);
  });

  mount.querySelectorAll('[data-round]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      const round = arena.KNOCKOUT[el.dataset.round];
      const week = arena.arcSeason(arc).slice(-3)[ROUNDS.indexOf(round.id)];
      openSheet(`
        <h2>${escapeHtml(round.name)}</h2>
        <p class="muted small">${escapeHtml(arena.weekLabel(week))}</p>
        <p>You play ${escapeHtml(round.opponent)}.</p>
        ${round.id === 'final' ? `<div class="arc-sheet-cup">${cup(arc.id, 96)}</div>` : ''}
        <button class="btn wide" data-close>Close</button>`);
    })
  );
}

/* ---- noise ---- */

/** Quiet unless something is on. A defeat makes no sound: a punishing noise is
 *  how you get someone to stop opening the app. */
function perform(mount, state) {
  if (state === 'won') {
    chime('trophy');
    haptic('trophy');
    setTimeout(() => celebrate(mount.querySelector('.arc-cup-art'), {
      count: 30, spread: 150, colour: 'var(--warn)',
    }), 560);
  } else if (state === 'knockout') {
    // On the bracket landing, so the note names what has just arrived.
    setTimeout(() => { chime('phase'); haptic('kickoff'); }, 620);
  }
}
