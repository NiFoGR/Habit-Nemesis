// The Arena: the screen.
//
// One page, no tabs. The order is the order of the questions actually asked:
// where do I stand, am I winning this week, how is the Arc going, what have I
// done. A tab bar would have been four screens' worth of chrome hiding three
// answers, and you would still have had to visit all four to know how you were
// doing.
//
// Nothing here is a second view of the grid. The grid says which days you
// ticked; this says what those ticks are worth against an opponent, which is
// the only thing the grid cannot tell you.
//
// Every opponent on this screen is a real week out of your own record, and
// every one of them is tappable: the point of beating your best week is being
// able to look at it.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, openSheet, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { crest } from './crest.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const hex = (h) => (h.colour ? habits.hexOf(h.colour) : 'var(--accent)');

/* ---------------- the ladder ----------------
   Seven segments, filled up to where you are. Not seven colours: the app has
   one accent and colour answers "what state is this in", so the ladder says
   how far up you are by how much of it is lit, which is the one thing it has
   to say. Built from DIVISIONS rather than from the number seven, so adding a
   division does not strand the last one. */
function ladder(id) {
  const at = arena.divisionIndex(id);
  return `<div class="ar-ladder" role="img" aria-label="Division ${escapeHtml(arena.divisionOf(id).name)}, ${at + 1} of ${arena.DIVISIONS.length}">
    ${arena.DIVISIONS.map((d, i) => `<i class="${i <= at ? 'on' : ''} ${i === at ? 'here' : ''}" title="${escapeHtml(d.name)}"></i>`).join('')}
  </div>`;
}

/** The month, as a bar inside the division you are in: floor on the left, the
 *  next rung on the right. A bar spanning nought to a hundred put every
 *  threshold within a few pixels of the last and made a whole month's work
 *  invisible. Its colour says which way you are going, so nothing has to. */
function barTo(st) {
  const s = st.month.score;
  const floor = st.division.bar;
  const roof = st.next ? st.next.bar : 1;
  const span = Math.max(0.01, roof - floor);
  const at = Math.max(0, Math.min((s - floor) / span, 1));
  // The readout follows the fill but never all the way to either end: at 0%
  // and at 100% half of it hung off the side.
  const label = Math.min(92, Math.max(8, at * 100));
  const state = s >= roof ? 'up' : st.safe ? 'safe' : 'down';
  return `<div class="ar-bar ${state}">
    <div class="ar-bar-fill" style="width:${(at * 100).toFixed(1)}%"></div>
    <b class="ar-bar-now" style="left:${label.toFixed(1)}%">${pct(s)}</b>
  </div>
  <div class="ar-bar-ends">
    <span>${escapeHtml(st.division.name)} · ${pct(floor)}</span>
    <span>${st.next ? `${escapeHtml(st.next.name)} · ${pct(roof)}` : 'the top'}</span>
  </div>`;
}

/* ---------------- the week ---------------- */

/* ---------------- the week ---------------- */

/** The two scores, side by side, each as a share of the pair. Two bars of the
 *  same length would be the honest chart and the useless one: what matters is
 *  the gap, and a shared scale is the only way to see it. */
function race(mine, theirs) {
  const total = Math.max(0.0001, mine + theirs);
  const a = (mine / total) * 100;
  return `<div class="ar-race">
    <div class="ar-race-bar"><i class="me" style="width:${a.toFixed(1)}%"></i><i class="them" style="width:${(100 - a).toFixed(1)}%"></i></div>
  </div>`;
}

function weekCard() {
  const key = arena.currentWeek();
  const live = arena.scoreWeek(key);
  const opp = arena.fixtureFor(key);
  const left = arena.daysLeftInWeek();
  const gap = live.score - opp.score;
  const state = live.void ? 'void' : gap > 0 ? 'ahead' : gap < 0 ? 'behind' : 'level';
  const verdict = live.void
    ? 'Not a fixture yet'
    : state === 'level'
      ? 'Level'
      : `${state === 'ahead' ? 'Ahead' : 'Behind'} by ${pct(Math.abs(gap))}`;

  const rows = live.rows
    .map((r) => {
      const frac = r.due ? r.done / r.due : 0;
      const colour = r.linked ? 'var(--accent)' : hex(r);
      return `<div class="ar-row">
        <span class="ar-row-name" style="color:${colour}">${escapeHtml(r.name)}</span>
        <span class="ar-row-bar"><i style="width:${(frac * 100).toFixed(0)}%;background:${colour}"></i></span>
        <b>${r.done}/${r.due}</b>
      </div>`;
    })
    .join('');

  return `<section class="card ar-week ${state}">
    <div class="ar-week-head">
      <h2>${opp.knockout ? escapeHtml(arena.KNOCKOUT[opp.knockout].name) : 'This week'}</h2>
      <span class="pill ghost">${escapeHtml(arena.weekLabel(key))}</span>
    </div>

    <div class="ar-score">
      <div class="ar-side me">
        <b>${pct(live.score)}</b>
        <span>You</span>
      </div>
      <div class="ar-vs">${icon('versus', 20)}</div>
      <button class="ar-side them" id="oppBtn">
        <b>${pct(opp.score)}</b>
        <span>${escapeHtml(opp.name)}</span>
      </button>
    </div>
    ${race(live.score, opp.score)}
    <p class="ar-verdict"><b>${escapeHtml(verdict)}</b><i>${left === 1 ? 'Last day' : `${left} days left`}</i></p>
    <p class="muted small ar-oppline">${live.void ? 'Not enough owed yet to be a match.' : escapeHtml(opp.blurb)}</p>

    <div class="ar-rows">${rows || '<p class="muted small">Nothing is due this week yet.</p>'}</div>
  </section>`;
}

/* ---------------- a past week, opened ----------------
   The headline is the score that was *recorded* when the week closed, because
   that is what the result was decided on and a result does not move. The rows
   under it are read live, so they are labelled as the week rather than as a
   second total; there is deliberately no sum under them, because two numbers
   for one week is exactly the disagreement this app keeps getting wrong. */
export function openWeekSheet(key) {
  const stored = store.get().arena.weeks[key];
  const live = arena.scoreWeek(key);
  const score = stored ? stored.score : live.score;
  // Only a played match has a result to report. A week the Arena scored out
  // of older data is a performance and says so, without a verdict on it.
  const result = stored?.result === 'won' || stored?.result === 'lost' ? stored.result : '';
  const rows = live.rows
    .map((r) => {
      const colour = r.linked ? 'var(--accent)' : hex(r);
      return `<div class="ar-row">
        <span class="ar-row-name" style="color:${colour}">${escapeHtml(r.name)}</span>
        <span class="ar-row-bar"><i style="width:${((r.done / Math.max(1, r.due)) * 100).toFixed(0)}%;background:${colour}"></i></span>
        <b>${r.done}/${r.due}</b>
      </div>`;
    })
    .join('');
  openSheet(`
    <h2>${escapeHtml(arena.weekLabel(key))}</h2>
    <p class="muted small">${escapeHtml(key.replace('-W', ', week '))}${
      result ? ` · ${result} against ${escapeHtml(stored.oppName || 'the bar')}` : ' · on the record, not played'
    }</p>
    <div class="ar-sheet-score ${result}"><b>${pct(score)}</b><span>${
      stored ? `${stored.done} of ${stored.due} cells` : `${live.done} of ${live.due} cells`
    }</span></div>
    <h3 class="ar-sub">The week, row by row</h3>
    <div class="ar-rows">${rows || '<p class="muted small">No rows were on the grid that week.</p>'}</div>
    <button class="btn wide" data-close>Close</button>`);
}

/* ---------------- form ---------------- */

/** The last eight results, as a strip rather than as a card. A heading saying
 *  "Form" over eight W's and L's is a word doing a job the W's and L's have
 *  already done. */
function formStrip() {
  const weeks = Object.entries(store.get().arena.weeks)
    .filter(([k, w]) => k < arena.currentWeek() && (w.result === 'won' || w.result === 'lost'))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-8);
  if (!weeks.length) return '';
  return `<div class="ar-form">
    ${weeks
      .map(([k, w]) => `<button class="ar-chip ${w.result}" data-week="${k}" aria-label="${escapeHtml(arena.weekLabel(k))}, ${w.result}">
        <b>${w.result === 'won' ? 'W' : 'L'}</b><i>${pct(w.score)}</i>
      </button>`)
      .join('')}
  </div>`;
}

/* ---------------- the arc ----------------
   Not a permanent box. The cup has a shape - a build-up, an opening, a table,
   a knockout, a ceremony, and then nothing at all for a fortnight - and the
   screen has to have that shape too, or it is a scoreboard for a match that is
   not being played.

   Between cups it is one line and a date. That is the whole reason the arcs
   stopped tiling the year end to end: while you were always in a cup, a cup
   was never something you entered. */

function arcCard() {
  const st = arena.arcState();

  if (st.phase === 'break' || st.phase === 'out') return arcClosed(st);
  if (st.phase === 'champion') return arcCup(st);
  if (st.phase === 'group') return arcGroup(st);
  return arcRound(st);
}

/** No cup on. A countdown, and what happened in the last one if anything did. */
function arcClosed(st) {
  const ended = st.phase === 'out'
    ? st.rec.qualified === false
      ? `Out at the group stage of the ${escapeHtml(st.arc.name)}.`
      : `Out in the ${escapeHtml(arena.KNOCKOUT[st.lostAt]?.name.toLowerCase() || 'knockout')} of the ${escapeHtml(st.arc.name)}.`
    : '';
  return `<a class="arc-wait" href="#/arena">
    <span class="arc-wait-mark">${icon('trophy', 20)}</span>
    <span class="arc-wait-text">
      <b>${escapeHtml(st.next.name)} Trophy</b>
      <i>${ended ? `${ended} Opens again in ` : 'Opens in '}<b>${st.opensIn}</b> day${st.opensIn === 1 ? '' : 's'}</i>
    </span>
  </a>`;
}

/** The group stage, live. The line between third and fourth is the only thing
 *  on it that matters, so it is drawn. */
function arcGroup(st) {
  const g = arena.groupTable(st.arc);
  return `<section class="card">
    <div class="ar-week-head">
      <h2>${escapeHtml(st.label)}</h2>
      <span class="pill ghost">${st.groupLeft} week${st.groupLeft === 1 ? '' : 's'} to the knockout</span>
    </div>
    ${g.table.length <= 1
      ? '<p class="muted small">Your group fills up as you play weeks.</p>'
      : `<div class="ar-table">
          ${g.table
            .map((r, i) => `<div class="ar-tr ${r.you ? 'you' : ''} ${i < 3 ? 'q' : 'nq'}" ${r.week ? `data-week="${r.week}"` : ''}>
              <span class="ar-pos">${i + 1}</span>
              <span class="ar-tn">${escapeHtml(r.name)}</span>
              <b>${pct(r.score)}</b>
            </div>`)
            .join('')}
        </div>`}
  </section>`;
}

/** A knockout round you are in. */
function arcRound(st) {
  const rounds = ['qf', 'sf', 'final'];
  return `<section class="card ar-knock">
    <div class="ar-week-head">
      <h2>${escapeHtml(st.label)}</h2>
      <span class="pill ghost">${escapeHtml(st.round?.name || 'Knockout')}</span>
    </div>
    <div class="ar-bracket">
      ${rounds
        .map((id) => {
          const r = st.rec[id];
          const here = st.stage === id;
          const label = r === 'won' ? 'Won' : r === 'lost' ? 'Lost' : here ? 'Playing now' : rounds.indexOf(id) < rounds.indexOf(st.stage) ? 'Not played' : 'To come';
          return `<div class="ar-round ${r || ''} ${here ? 'here' : ''}">
            <b>${escapeHtml(arena.KNOCKOUT[id].name)}</b><span>${escapeHtml(label)}</span>
            <i>${escapeHtml(arena.KNOCKOUT[id].opponent)}</i>
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

/** Won. */
function arcCup(st) {
  return `<section class="card ar-won">
    <span class="cup-art">${icon('trophy', 30)}</span>
    <div>
      <b>${escapeHtml(st.trophy)} won</b>
      <i>The final is always your own best week. You beat it.</i>
    </div>
  </section>`;
}

/* ---------------- the screen ---------------- */

export function renderArena(mount) {
  const st = arena.standing();
  const a = store.get().arena;
  const rung = arena.divisionIndex(a.division);

  mount.innerHTML = `
    <div class="screen">
      <section class="ar-hero rung-${rung}">
        <span class="ar-crest">${crest(rung, 92)}</span>
        <h1 class="ar-rank">${escapeHtml(st.division.name)}</h1>
        <p class="ar-blurb">${escapeHtml(st.division.blurb)}</p>
        ${ladder(a.division)}
        ${st.month.empty
          ? `<p class="ar-monthline"><span class="muted">${st.placed ? 'nothing scored this month yet' : 'placement month'}</span></p>`
          : `${barTo(st)}
             <p class="ar-monthline">
               <b>${st.month.w}W–${st.month.l}L</b>
               <span class="muted">· ${arena.weeksLeft()} week${arena.weeksLeft() === 1 ? '' : 's'} left ·</span>
               <em class="${st.next && st.month.score >= st.next.bar ? 'up' : st.safe ? 'safe' : 'down'}">${
                 st.next && st.month.score >= st.next.bar ? 'promoting' : st.safe ? 'holding' : 'below the bar'
               }</em>
             </p>`}
      </section>

      ${weekCard()}
      ${formStrip()}
      ${nemesisLine()}
      ${arcCard()}
    </div>`;

  wire(mount);
}

/** The nemesis, named and reachable, on every visit. He is the one opponent
 *  who is always somewhere on the fixture list, so he gets a line of his own
 *  rather than only appearing in the weeks he happens to be drawn. */
function nemesisLine() {
  const n = arena.nemesisWeek();
  if (!n) return '';
  return `<button class="ar-nemesis" data-week="${n.key}">
    <span class="ar-nico">${icon('flash', 16)}</span>
    <span class="ar-nname"><b>Your Nemesis</b><i>${escapeHtml(arena.weekLabel(n.key))} · your best week</i></span>
    <b class="ar-nscore">${pct(n.score)}</b>
  </button>`;
}

function wire(mount) {
  const opp = mount.querySelector('#oppBtn');
  if (opp) {
    const key = arena.currentWeek();
    const fixture = arena.fixtureFor(key);
    opp.addEventListener('click', () => {
      haptic('press');
      if (fixture.week) return openWeekSheet(fixture.week);
      openSheet(`
        <h2>${escapeHtml(fixture.name)}</h2>
        <p class="muted small">${escapeHtml(fixture.blurb)}</p>
        <p>Your division's bar is ${pct(fixture.score)}. It stands in when the record cannot supply a real opponent yet — every other rival in here is a week you actually had, and there is no point inventing one.</p>
        <button class="btn wide" data-close>Close</button>`);
    });
  }

  mount.querySelectorAll('[data-week]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      openWeekSheet(el.dataset.week);
    })
  );
}

/** "42 of 100" in the feat's own unit, rounded the way the unit wants: hours
 *  and centimetres to one place, counts to none. */
function fmtNeed(f) {
  const dp = f.unit && /cm|h|s/.test(f.unit) ? 1 : 0;
  const round = (v) => (dp ? v.toFixed(1) : Math.round(v).toLocaleString());
  return `${round(Math.min(f.have, f.need))}${f.unit || ''} of ${round(f.need)}${f.unit || ''}`;
}

/* ---------------- every feat ---------------- */

export function renderFeats(mount) {
  const sections = feats.bySection();
  const c = feats.counts();

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>Feats</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="today">
        <div class="today-left">
          <h2>${c.earned} of ${c.total}</h2>
          <p class="muted small">Not achievements. Every one of these is something you could say out loud to another person and have it mean something.</p>
        </div>
      </div>

      ${sections
        .map(
          (s) => `<section class="card">
            <div class="ar-week-head">
              <h2>${escapeHtml(s.section)}</h2>
              <span class="pill ghost">${s.earned}/${s.items.length}</span>
            </div>
            <div class="ft-grid">
              ${s.items.map(featTile).join('')}
            </div>
          </section>`
        )
        .join('')}
    </div>`;

  mount.querySelectorAll('[data-feat]').forEach((el) =>
    el.addEventListener('click', () => {
      const f = feats.FEATS.find((x) => x.id === el.dataset.feat);
      if (!f) return;
      haptic('tick');
      const p = feats.progressOf(f);
      const at = feats.earnedAt(f.id);
      openSheet(`
        <div class="ft-big ${p.earned ? 'on' : ''}">${icon(f.icon, 30)}</div>
        <h2 class="centre">${escapeHtml(f.name)}</h2>
        <p class="muted small centre">${escapeHtml(f.blurb)}</p>
        ${p.earned
          ? `<p class="centre ft-when">Earned${at ? ` ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.</p>`
          : p.need
            ? `<div class="ar-bar plain"><div class="ar-bar-fill" style="width:${(p.frac * 100).toFixed(1)}%"></div></div>
               <p class="centre muted small">${escapeHtml(fmtNeed({ ...f, ...p }))}</p>`
            : '<p class="centre muted small">Not yet.</p>'}
        <button class="btn wide" data-close>Close</button>`);
    })
  );
}

function featTile(f) {
  return `<button class="ft ${f.earned ? 'on' : ''}" data-feat="${escapeHtml(f.id)}">
    <span class="ft-ico">${icon(f.icon, 19)}</span>
    <b>${escapeHtml(f.name)}</b>
    ${f.earned
      ? '<i class="ft-tick">' + icon('check', 12) + '</i>'
      : f.need
        ? `<span class="ft-bar"><i style="width:${(f.frac * 100).toFixed(0)}%"></i></span>`
        : '<i class="ft-locked">—</i>'}
  </button>`;
}
