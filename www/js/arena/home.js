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

/** The month score as a bar with the two thresholds on it: where you stop
 *  being safe, and where you go up. A bare percentage cannot show that 71% is
 *  a hair from promotion in one division and a relegation in the next. */
function barTo(st) {
  const s = st.month.score;
  const floor = st.division.bar;
  const roof = st.next ? st.next.bar : 1;
  // The bar spans this division only, so movement inside it is visible. A bar
  // spanning 0-100% put every threshold within a few pixels of the last.
  const span = Math.max(0.01, roof - floor);
  const at = Math.max(0, Math.min((s - floor) / span, 1));
  // The readout follows the fill, but never all the way to either end: at 0%
  // and at 100% half of it hung off the side of the card.
  const label = Math.min(92, Math.max(8, at * 100));
  const state = s >= roof ? 'up' : st.safe ? 'safe' : 'down';
  return `<div class="ar-bar ${state}">
    <div class="ar-bar-fill" style="width:${(at * 100).toFixed(1)}%"></div>
    <b class="ar-bar-now" style="left:${label.toFixed(1)}%">${pct(s)}</b>
  </div>
  <div class="ar-bar-ends">
    <span>${escapeHtml(st.division.name)} · ${pct(floor)}</span>
    <span>${st.next ? `${escapeHtml(st.next.name)} · ${pct(roof)}` : 'top of the ladder'}</span>
  </div>`;
}

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
    <p class="muted small ar-oppline">${live.void
      ? `A week counts once at least ${arena.VOID_CELLS} cells are owed across ${arena.VOID_DAYS} days. So far, ${live.due} across ${live.days}.`
      : `${escapeHtml(opp.blurb)}${opp.week ? ' · tap to see it' : ''}`}</p>

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

/* ---------------- the arc ---------------- */

function arcCard() {
  const arc = arena.arcOfMonth(arena.currentMonth());
  const key = arena.arcKey(arc);
  const rec = store.get().arena.arcs[key] || { qualified: null, qf: null, sf: null, final: null, won: false };
  const { stage } = arena.arcStage(arena.currentWeek());
  const inGroup = !stage || stage === 'group';

  let body;
  if (inGroup) {
    const g = arena.groupTable(arc);
    body = g.table.length <= 1
      ? `<p class="muted small">The group fills up as you play weeks. Every rival in it will be a week you actually had, so there is nothing here until there is a record to seed it from.</p>`
      : `<div class="ar-table">
          ${g.table
            .map((r, i) => `<div class="ar-tr ${r.you ? 'you' : ''} ${i < 3 ? 'q' : ''}" ${r.week ? `data-week="${r.week}"` : ''}>
              <span class="ar-pos">${i + 1}</span>
              <span class="ar-tn">${escapeHtml(r.name)}</span>
              <b>${pct(r.score)}</b>
            </div>`)
            .join('')}
        </div>
        <p class="muted small">Top three go through. ${g.played} of ${g.groupWeeks.length} group weeks played · you are ${
          g.qualifies ? 'through as it stands' : 'outside the three'
        }.</p>`;
  } else {
    // What is actually on today, asked of the same function that decides the
    // week's fixture. Reading `stage` alone said "Playing now" under a final
    // the week card was not playing, because a round is only live if the one
    // before it was won.
    const live = arena.arcFixture(arena.currentWeek());
    const weeks = arena.arcWeeks(arc);
    const weekOf = { qf: weeks[weeks.length - 3], sf: weeks[weeks.length - 2], final: weeks[weeks.length - 1] };
    const round = (id) => {
      const r = rec[id];
      const here = live?.knockout === id;
      const gone = !r && !here && weekOf[id] <= arena.currentWeek();
      const label = r === 'won' ? 'Won'
        : r === 'lost' ? 'Lost'
        : rec.qualified === false ? 'Did not qualify'
        : here ? 'Playing now'
        : gone ? 'Not played'
        : 'To come';
      return `<div class="ar-round ${r || ''} ${here ? 'here' : ''}">
        <b>${escapeHtml(arena.KNOCKOUT[id].name)}</b><span>${escapeHtml(label)}</span>
        <i>${escapeHtml(arena.KNOCKOUT[id].opponent)}</i>
      </div>`;
    };
    body = rec.qualified === false
      ? `<p class="muted small">You did not make the top three of the group. The Arc runs again next quarter, and the group is seeded from the weeks you have had since.</p>`
      : `<div class="ar-bracket">${round('qf')}${round('sf')}${round('final')}</div>
         ${arcNote(rec, live)}`;
  }

  // Oldest first, so the cabinet reads as a record rather than as whatever
  // order the object happened to be built in.
  const cabinet = Object.entries(store.get().arena.arcs).filter(([, a]) => a.won).sort();
  return `<section class="card">
    <div class="ar-week-head">
      <h2>${escapeHtml(arena.arcLabel(arc))}</h2>
      <span class="pill ghost">${inGroup ? 'Group stage' : escapeHtml(arena.KNOCKOUT[stage].name)}</span>
    </div>
    ${body}
    ${cabinet.length
      ? `<div class="ar-cabinet">
          ${cabinet.map(([k]) => `<span class="ar-cup">${icon('trophy', 18)}<i>${escapeHtml(cupLabel(k))}</i></span>`).join('')}
        </div>`
      : ''}
  </section>`;
}

/** The line under the bracket, when there is one to say. There are two very
 *  different reasons for a round not being live and one sentence covered both,
 *  so a semi-final you lost was explained as a week that passed before the
 *  Arena existed. */
function arcNote(rec, live) {
  const lost = ['qf', 'sf', 'final'].find((k) => rec[k] === 'lost');
  if (lost === 'final') {
    return '<p class="muted small">Runner-up. The final is always your own best week, and this time it held. It is kept either way: a cabinet with only wins in it is a participation trophy.</p>';
  }
  if (lost) {
    return `<p class="muted small">Out in the ${escapeHtml(arena.KNOCKOUT[lost].name.toLowerCase())}. The league does not stop, so there is still a match every week, and the next Arc starts again from the group stage.</p>`;
  }
  if (!live && rec.qualified) {
    return '<p class="muted small">A round is only live if the one before it was won, so a knockout week that passed before the Arena was keeping score is left unplayed. The next Arc starts from the group stage.</p>';
  }
  return '';
}

/** '2026-summer' → 'Summer 2026', without rebuilding the arc object. */
function cupLabel(key) {
  const [year, id] = key.split('-');
  const arc = arena.ARCS.find((a) => a.id === id);
  return arc ? arena.arcLabel({ ...arc, year: Number(year) }) : key;
}

/* ---------------- feats ---------------- */

function featsCard() {
  const c = feats.counts();
  const next = feats.closest(3);
  return `<section class="card">
    <div class="ar-week-head">
      <h2>Feats</h2>
      <span class="pill ghost">${c.earned} of ${c.total}</span>
    </div>
    ${next.length
      ? `<div class="ar-next">
          ${next
            .map((f) => `<div class="ar-nextrow">
              <span class="ar-nico">${icon(f.icon, 16)}</span>
              <span class="ar-nname"><b>${escapeHtml(f.name)}</b><i>${escapeHtml(fmtNeed(f))}</i></span>
              <span class="ar-row-bar"><i style="width:${(f.frac * 100).toFixed(0)}%"></i></span>
            </div>`)
            .join('')}
        </div>`
      : '<p class="muted small">Every feat is earned. There is nothing left on the list.</p>'}
    <a class="btn ghost wide" href="#/arena/feats">${icon('medal', 16)}<span>All feats</span></a>
  </section>`;
}

/** "42 of 100" in the feat's own unit, rounded the way the unit wants: hours
 *  and centimetres to one place, counts to none. */
function fmtNeed(f) {
  const dp = f.unit && /cm|h|s/.test(f.unit) ? 1 : 0;
  const round = (v) => (dp ? v.toFixed(1) : Math.round(v).toLocaleString());
  return `${round(Math.min(f.have, f.need))}${f.unit || ''} of ${round(f.need)}${f.unit || ''}`;
}

/* ---------------- the screen ---------------- */

export function renderArena(mount) {
  const st = arena.standing();
  const a = store.get().arena;
  const played = arena.playedWeeks().length;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>The Arena</h1>
        <a class="icon-btn linkbtn" href="#/arena/year" aria-label="The Year">${icon('calendar')}</a>
      </header>

      <section class="card ar-rank">
        <div class="ar-rank-top">
          <span class="ar-crown">${icon('crown', 22)}</span>
          <div class="ar-rank-name">
            <b>${escapeHtml(st.division.name)}</b>
            <i>${escapeHtml(st.division.blurb)}</i>
          </div>
        </div>
        ${ladder(a.division)}
        ${st.month.empty
          ? `<p class="muted small ar-monthline">No week has finished this month yet. ${
              st.placed ? 'Your division holds until one does.' : 'Your first full month sets your division outright.'
            }</p>`
          : `${barTo(st)}
             <p class="ar-monthline">
               <b>${st.month.w}W–${st.month.l}L</b>
               <span class="muted">this month · ${arena.weeksLeft()} week${arena.weeksLeft() === 1 ? '' : 's'} left · ${
                 // Three states, no arithmetic. This used to read "92% to Top G",
                 // which looks like ninety-two per cent of the way there and
                 // means ninety-two points short. The bar above shows the
                 // distance; this line only has to say which way it is going.
                 st.next && st.month.score >= st.next.bar
                   ? `promoting to ${escapeHtml(st.next.name)}`
                   : st.safe
                     ? `holding ${escapeHtml(st.division.name)}`
                     : `below the bar for ${escapeHtml(st.division.name)}`
               }</span>
             </p>`}
        ${st.placed ? '' : '<p class="notice">Placement. Nothing can relegate you until a first month has been scored.</p>'}
      </section>

      ${weekCard()}

      <section class="card">
        <div class="ar-week-head">
          <h2>Form</h2>
          <span class="pill ghost">${played} week${played === 1 ? '' : 's'} on record</span>
        </div>
        ${formStrip() || '<p class="muted small">Your first result lands the Monday after your first full week.</p>'}
        ${nemesisLine()}
      </section>

      ${arcCard()}
      ${featsCard()}

      <a class="btn ghost wide" href="#/arena/year">${icon('calendar', 16)}<span>The Year</span></a>
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
