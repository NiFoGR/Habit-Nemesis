// The Arena screen. One page, in the order the questions get asked: where do
// I stand, am I winning this week, how is the Arc going, what have I done.
// Every opponent is a real week and every one is tappable.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import { captureFace, face, faceAvatar } from './face.js';
import { shareWeek } from './share.js';
import * as feats from './feats.js';
import { escapeHtml, openSheet, haptic, toast } from '../ui.js';
import { icon } from '../icons.js';
import { crest, UNRANKED } from './crest.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const hex = (h) => (h.colour ? habits.hexOf(h.colour) : 'var(--accent)');

/* --------------------- the ladder --------------------- */

function ladder(id) {
  const at = arena.divisionIndex(id);
  return `<a class="ar-ladder" href="#/arena/divisions"
    aria-label="Division ${escapeHtml(arena.divisionOf(id).name)}, ${at + 1} of ${arena.DIVISIONS.length}. See every division">
    <span class="ar-ladder-pips">${arena.DIVISIONS.map((d, i) => `<i class="${i <= at ? 'on' : ''} ${i === at ? 'here' : ''}" title="${escapeHtml(d.name)}"></i>`).join('')}</span>
    <span class="ar-ladder-go">Divisions ${icon('back', 13)}</span>
  </a>`;
}

/** Unranked: the ladder unlit, and a countdown to the week that places you.
 *  A bar would imply a position on it. */
function unrankedHero() {
  const left = arena.daysLeftInWeek();
  const live = arena.scoreWeek(arena.currentWeek());
  // Unlit, but still the way in: what you are about to be placed into is worth
  // reading before you are placed.
  return `<a class="ar-ladder none" href="#/arena/divisions" aria-label="See every division">
      <span class="ar-ladder-pips">${arena.DIVISIONS.map(() => '<i></i>').join('')}</span>
      <span class="ar-ladder-go">Divisions ${icon('back', 13)}</span>
    </a>
    <div class="ar-count">
      <b>${left}</b>
      <i>day${left === 1 ? '' : 's'} until you are placed</i>
    </div>
    <p class="ar-need">${live.void
      ? 'Nothing marked yet.'
      : `On ${pct(live.score)} you go in at ${escapeHtml(arena.divisionForScore(live.score).name)}.`}</p>`;
}

/** The month inside your division: floor left, next rung right. A 0-100 bar
 *  put every threshold within a few pixels of the last. */
function barTo(st) {
  const s = st.month.score;
  const floor = st.division.bar;
  const roof = st.next ? st.next.bar : 1;
  const span = Math.max(0.01, roof - floor);
  const at = Math.max(0, Math.min((s - floor) / span, 1));
  // The readout stops short of both ends, or half of it hangs off.
  const label = Math.min(92, Math.max(8, at * 100));
  const state = s >= roof ? 'up' : st.safe ? 'safe' : 'down';
  return `<div class="ar-bar ${state}">
    <div class="ar-bar-fill" style="width:${(at * 100).toFixed(1)}%"></div>
    <b class="ar-bar-now" style="left:${label.toFixed(1)}%">${pct(s)}</b>
  </div>
  <div class="ar-bar-ends">
    <span>${escapeHtml(st.division.name)} · ${pct(floor)}</span>
    <span>${st.next ? `${escapeHtml(st.next.name)} · ${pct(roof)}` : 'the top'}</span>
  </div>
  ${fromHere(st)}`;
}

/** The number the rest of the month has to average. The most useful line on
 *  the screen and the one nobody could work out for themselves. */
function fromHere(st) {
  const hold = arena.needFromHere(st.division.bar);
  const up = st.next ? arena.needFromHere(st.next.bar) : null;
  if (!hold) return '';
  const weeks = hold.weeks === 1 ? 'this week' : `each of the ${hold.weeks} weeks left`;

  // Promotion first when it is still reachable, then the floor. A need at or
  // below zero is already banked and is never printed: -94% is not a target.
  if (up && up.need > 0 && up.need <= 1) {
    return `<p class="ar-need">${pct(up.need)} ${escapeHtml(weeks)} takes you to ${escapeHtml(st.next.name)}.</p>`;
  }
  if (up && up.need <= 0) return '';
  if (hold.need <= 0) {
    return `<p class="ar-need">${escapeHtml(st.division.name)} is safe whatever happens.</p>`;
  }
  if (hold.need > 1) {
    return `<p class="ar-need">${escapeHtml(st.division.name)} is out of reach this month.</p>`;
  }
  return `<p class="ar-need">${pct(hold.need)} ${escapeHtml(weeks)} holds ${escapeHtml(st.division.name)}.</p>`;
}

/* ---------------- the week ---------------- */

function weekCard() {
  const key = arena.currentWeek();
  const live = arena.scoreWeek(key);
  const opp = arena.fixtureFor(key);
  const left = arena.daysLeftInWeek();
  const gap = live.score - opp.score;
  const state = live.void ? 'void' : gap > 0 ? 'ahead' : gap < 0 ? 'behind' : 'level';
  const verdict = live.void ? 'Not a fixture yet' : state === 'level' ? 'Level' : state === 'ahead' ? 'Ahead' : 'Behind';

  const rows = live.rows
    .map((r) => {
      const frac = r.due ? r.done / r.due : 0;
      const colour = r.linked ? 'var(--accent)' : hex(r);
      return `<div class="ar-row">
        <span class="ar-row-name">${escapeHtml(r.name)}</span>
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
        ${opp.id === 'nemesis' || opp.knockout === 'final' ? faceAvatar(38) : ''}
        <b>${pct(opp.score)}</b>
        <span>${escapeHtml(opp.name)}</span>
      </button>
    </div>
    <p class="ar-verdict"><b>${escapeHtml(verdict)}</b><i>${left === 1 ? 'Last day' : `${left} days left`}</i></p>

    <div class="ar-rows">${rows || '<p class="muted small">Nothing is due this week yet.</p>'}</div>
  </section>`;
}

/* ---------------- a past week, opened ---------------- */

export function openWeekSheet(key) {
  const stored = store.get().arena.weeks[key];
  const live = arena.scoreWeek(key);
  const score = stored ? stored.score : live.score;
  // Only a played match has a result. A 'record' week is a performance.
  const result = stored?.result === 'won' || stored?.result === 'lost' ? stored.result : '';
  const rows = live.rows
    .map((r) => {
      const colour = r.linked ? 'var(--accent)' : hex(r);
      return `<div class="ar-row">
        <span class="ar-row-name">${escapeHtml(r.name)}</span>
        <span class="ar-row-bar"><i style="width:${((r.done / Math.max(1, r.due)) * 100).toFixed(0)}%;background:${colour}"></i></span>
        <b>${r.done}/${r.due}</b>
      </div>`;
    })
    .join('');
  const nemesis = arena.nemesisWeek();
  const isNemesis = !!nemesis && nemesis.key === key;
  const said = arena.noteFor(key);
  const now = arena.scoreWeek(arena.currentWeek());
  const gap = Math.round((now.score - score) * 100);

  const sheet = openSheet(`
    ${isNemesis
      ? `<div class="nem-head">${faceAvatar(56)}<div><h2>Your Nemesis</h2>
          <p class="muted small">${escapeHtml(arena.weekLabel(key))} · your best week</p></div></div>`
      : `<h2>${escapeHtml(arena.weekLabel(key))}</h2>`}
    <p class="muted small">${escapeHtml(key.replace('-W', ', week '))}${
      result ? ` · ${result} against ${escapeHtml(stored.oppName || 'the bar')}` : ' · on the record, not played'
    }</p>
    <div class="ar-sheet-score ${result}"><b>${pct(score)}</b><span>${
      stored ? `${stored.done} of ${stored.due} cells` : `${live.done} of ${live.due} cells`
    }</span></div>
    ${said ? `<p class="said-quote">“${escapeHtml(said)}”</p>` : ''}
    ${isNemesis && key !== arena.currentWeek()
      ? `<p class="nem-gap ${gap >= 0 ? 'ahead' : 'behind'}">${
          gap >= 0 ? `You are ${gap} points ahead of him this week.` : `You are ${Math.abs(gap)} points behind him this week.`
        }</p>`
      : ''}
    <h3 class="ar-sub">The week, row by row</h3>
    <div class="ar-rows">${rows || '<p class="muted small">No rows were on the grid that week.</p>'}</div>
    ${isNemesis ? `<button class="btn ghost wide" id="faceSwap">${face() ? 'Change his face' : 'Give him a face'}</button>` : ''}
    ${live.due ? `<button class="btn ghost wide" id="shareWeek">${icon('external', 16)}<span>Share this week</span></button>` : ''}
    <button class="btn wide" data-close>Close</button>`);

  // Closed first: the card is a sheet of its own and two do not stack.
  document.getElementById('shareWeek')?.addEventListener('click', () => {
    sheet.close();
    shareWeek(key);
  });

  document.getElementById('faceSwap')?.addEventListener('click', async () => {
    haptic('press');
    if (await captureFace(key)) {
      toast('That is him now');
      openWeekSheet(key);
    }
  });
}

/* ---------------- form ---------------- */

/** Last eight, as a strip. A "Form" heading over eight W and L is a word doing
 *  their job. */
function formStrip() {
  const weeks = Object.entries(store.get().arena.weeks)
    .filter(([k, w]) => k < arena.currentWeek() && (w.result === 'won' || w.result === 'lost'))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-8);
  if (!weeks.length) return '';
  return `<div class="ar-form">
    ${weeks
      .map(([k, w]) => `<button class="ar-chip ${w.result}" data-week="${k}" aria-label="${escapeHtml(arena.weekLabel(k))}, ${w.result}">
        <b>${pct(w.score)}</b>
      </button>`)
      .join('')}
  </div>`;
}

/* ---------------------- the arc ---------------------- */

function arcCard() {
  const st = arena.arcState();

  if (st.phase === 'break' || st.phase === 'out') return arcClosed(st);
  if (st.phase === 'champion') return arcCup(st);
  if (st.phase === 'group') return arcGroup(st);
  return arcRound(st);
}

/** No cup on: a countdown, and the last one if there was one. */
function arcClosed(st) {
  // Never entered is not knocked out. Saying otherwise invents a defeat.
  const ended = st.phase !== 'out'
    ? ''
    : st.rec.qualified === false
      ? st.eligible
        ? `Out at the group stage of the ${escapeHtml(st.arc.name)}.`
        : `Not enough weeks played for the ${escapeHtml(st.arc.name)}.`
      : `Out in the ${escapeHtml(arena.KNOCKOUT[st.lostAt]?.name.toLowerCase() || 'knockout')} of the ${escapeHtml(st.arc.name)}.`;
  return `<a class="arc-wait" href="#/arena">
    <span class="arc-wait-mark">${icon('trophy', 20)}</span>
    <span class="arc-wait-text">
      <b>${escapeHtml(st.next.name)} Trophy</b>
      <i>${ended ? `${ended} Opens again in ` : 'Opens in '}<b>${st.opensIn}</b> day${st.opensIn === 1 ? '' : 's'}</i>
    </span>
  </a>`;
}

/** The group, live. The line between third and fourth is the only thing on it. */
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
            .map((r, i) => `<div class="ar-tr ${r.you ? 'you' : ''} ${g.eligible && i < 3 ? 'q' : 'nq'}" ${r.week ? `data-week="${r.week}"` : ''}>
              <span class="ar-pos">${i + 1}</span>
              <span class="ar-tn">${escapeHtml(r.name)}</span>
              <b>${pct(r.score)}</b>
            </div>`)
            .join('')}
        </div>`}
    ${g.eligible ? '' : `<p class="muted small">${escapeHtml(shortfall(g))}</p>`}
  </section>`;
}

/** Why this is not a cup yet. Nothing is green until it can qualify. */
function shortfall(g) {
  if (g.rivals < arena.ARC_MIN_RIVALS) return 'Not enough weeks on the record yet to make a field to beat.';
  return `${g.played} of ${g.need} weeks played. A cup wants at least ${g.need} of them.`;
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
  const rung = st.unranked ? UNRANKED : arena.divisionIndex(a.division);

  mount.innerHTML = `
    <div class="screen">
      <section class="ar-hero ${st.unranked ? 'unranked' : ''} ${!st.unranked && !st.next ? 'top' : ''}"
        style="--lift:${st.unranked ? 0 : rung}">
        <span class="ar-crest">${crest(rung, 104).replace('alt="" aria-hidden="true"', `alt="${escapeHtml(st.division.name)}"`)}</span>
        ${st.unranked
          ? unrankedHero()
          : `${ladder(a.division)}
        ${st.month.empty
          ? `<p class="ar-monthline">${st.placed ? 'nothing scored this month yet' : 'placement month'}</p>`
          : barTo(st)}`}
      </section>

      ${weekCard()}
      ${formStrip()}
      ${nemesisLine()}
      ${arcCard()}
    </div>`;

  wire(mount);
}

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
        <p>Your division's bar is ${pct(fixture.score)}. It stands in until the record can supply a real week. Every other rival is one you actually had.</p>
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

/** "42 of 100" in the feat's unit: hours and cm to one place, counts to none. */
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
        <span class="pill ghost">${c.earned} of ${c.total}</span>
      </header>

      ${sections
        .map(
          (s) => `<section class="card">
            <div class="ar-week-head">
              <h2>${escapeHtml(s.section)}</h2>
              <span class="pill ghost">${s.earned} of ${s.items.length}</span>
            </div>
            <div class="ft-grid">
              ${s.items.map(featTile).join('')}
            </div>
          </section>`
        )
        .join('')}
    </div>`;

  wireFeatTiles(mount);
}

/** Any screen showing feat tiles gets the same sheet. */
export function wireFeatTiles(mount) {
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
        <p class="centre muted small ft-cost">${escapeHtml(feats.priceOf(f.days))} of work, at the fastest it can be done.</p>
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
    ${f.earned || !f.need ? '' : `<span class="ft-bar"><i style="width:${(f.frac * 100).toFixed(0)}%"></i></span>`}
    <i class="ft-price">${escapeHtml(feats.priceOf(f.days))}</i>
  </button>`;
}
