// The week in review. Offered on Sunday, while the week is still live and can
// still be fixed, and for two days after, when it cannot.
//
// The result screen owns the verdict against your opponent. This owns the shape
// of the week: the score, the days, the rows, what broke, what is still owed.
//
// Five beats, one tap apart. A list of all of it at once is a spreadsheet.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, chime, celebrate, haptic, WEEKDAYS_LONG } from '../ui.js';
import { icon } from '../icons.js';
import { navigate } from '../back.js';
import { shareWeek } from './share.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const points = (v) => Math.round(v * 100);
const still = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

/* ---------------- the week, as numbers ---------------- */

/** Feats first earned inside the window. bySection is already filtered by the
 *  lock, so a private one cannot leak into a review. */
function featsIn(from, to) {
  return feats.bySection()
    .flatMap((s) => s.items)
    .filter((f) => f.at && store.dayKey(new Date(f.at)) >= from && store.dayKey(new Date(f.at)) <= to);
}

function readWeek(key) {
  const live = key === arena.currentWeek();
  const saved = arena.weekScore(key);
  const now = arena.scoreWeek(key);
  const sums = new Map(arena.rosterFor(key).map((h) => [h.id, habits.summary(h)]));
  const shape = arena.weekShape(key);
  const played = arena.playedWeeks().filter((p) => p.key !== key);
  const prev = arena.weekScore(arena.prevWeek(key));
  const from = arena.weekStart(key);
  const to = arena.weekEnd(key);
  const today = habits.today();

  const rows = now.rows.slice().sort((a, b) => b.done / b.due - a.done / a.due);
  const open = rows.filter((r) => r.done < r.due && !sums.get(r.id)?.index.get(today)?.hit);

  return {
    key,
    live,
    score: live ? now.score : saved.score,
    done: live ? now.done : saved.done,
    due: live ? now.due : saved.due,
    rows,
    shape,
    average: played.length ? played.reduce((a, p) => a + p.score, 0) / played.length : null,
    prev: prev.void || !prev.due ? null : prev,
    alive: habits.active().map((h) => habits.summary(h)).filter((s) => s?.streak).sort((a, b) => b.streak - a.streak),
    broke: habits.brokenIn(from, to)[0] || null,
    fresh: featsIn(from, to),
    opponent: live ? arena.fixtureFor(key) : null,
    open: open.length,
    // Cells still owed anywhere in the week, not just today.
    owed: rows.reduce((a, r) => a + (r.due - r.done), 0),
  };
}

/* -------------------- the beats -------------------- */

const weekday = (key) => WEEKDAYS_LONG[new Date(`${key}T00:00:00`).getDay()];

function scoreBeat(w) {
  const gap = w.average == null ? null : points(w.score - w.average);
  return `
    <p class="eyebrow">The score</p>
    <b class="rv-big" id="count">0%</b>
    <p class="rv-sub">${w.done} of ${w.due} cells</p>
    <div class="rv-gauge" style="--w:${pct(w.score)}${gap == null ? '' : `;--avg:${pct(w.average)}`}">
      <i></i>${gap == null ? '' : '<u></u>'}
    </div>
    ${gap == null
      ? '<p class="rv-note">Your first week on the record.</p>'
      : `<p class="rv-note">Your average is ${pct(w.average)}
          <b class="${gap >= 0 ? 'up' : 'down'}">${signed(gap)}</b></p>`}`;
}

function daysBeat(w) {
  const top = Math.max(1, ...w.shape.map((d) => d.done));
  const today = habits.today();
  const bars = w.shape.map((d, i) => {
    const state = `${d.future ? 'future' : d.done === top ? 'top' : d.done ? '' : 'none'}${d.key === today ? ' now' : ''}`;
    return `<span class="rv-day ${state}" style="--h:${Math.round((d.done / top) * 100)}%;--i:${i}">
      <i class="rv-bar"></i>
      <em>${d.done || ''}</em>
      <u>${weekday(d.key)[0]}</u>
    </span>`;
  }).join('');

  return `
    <p class="eyebrow">The days</p>
    <div class="rv-days">${bars}</div>`;
}

function rowsBeat(w) {
  const list = w.rows.map((r, i) => {
    const colour = r.colour ? habits.hexOf(r.colour) : 'var(--accent)';
    return `<li style="--c:${colour};--w:${Math.round((r.done / r.due) * 100)}%;--i:${i}">
      <span class="rv-rname">${escapeHtml(r.name)}</span>
      <span class="rv-rbar"><i></i></span>
      <b>${r.done}/${r.due}</b>
    </li>`;
  }).join('');

  const longest = w.alive[0];
  return `
    <p class="eyebrow">The rows</p>
    <ul class="rv-rows">${list}</ul>
    ${longest
      ? `<div class="rv-kv"><span>Streaks alive</span><b>${w.alive.length} · ${escapeHtml(longest.habit.name)} at ${longest.streak}</b></div>`
      : ''}
    ${w.broke
      ? `<div class="rv-kv"><span>Broke</span><b class="down">${escapeHtml(w.broke.habit.name)} at ${w.broke.len}</b></div>`
      : ''}`;
}

/** The last beat. Live, it is what today can still take. Settled, it is the
 *  number the next week has to beat: the result screen already gave the verdict. */
function verdictBeat(w) {
  const shown = w.fresh.slice(0, 3);
  const featBlock = shown.length
    ? `<div class="rv-feats">
        ${shown.map((f) => `<span class="rv-feat">${icon(f.icon, 15)}${escapeHtml(f.name)}</span>`).join('')}
        ${w.fresh.length > shown.length ? `<a class="rv-feat more" href="#/cabinet/feats">${w.fresh.length - shown.length} more</a>` : ''}
      </div>`
    : '';

  if (w.live) {
    const opp = w.opponent;
    const ahead = w.score >= opp.score;
    const need = Math.max(0, Math.ceil(opp.score * w.due) - w.done);
    const stake = ahead
      ? 'One day left to drop it.'
      : need <= w.open
        ? `${need} of today's ${w.open} beats him.`
        : need <= w.owed
          ? `${need} cells short. Today holds ${w.open} of them.`
          : 'He has this one. Take the day anyway.';
    return `
      <p class="eyebrow">Still on the table</p>
      <div class="rv-vs">
        <span><b>${pct(w.score)}</b><i>You</i></span>
        <span class="rv-versus">${icon('versus', 18)}</span>
        <span><b>${pct(opp.score)}</b><i>${escapeHtml(opp.name)}</i></span>
      </div>
      <p class="rv-stake ${ahead ? 'up' : need <= w.owed ? '' : 'down'}">${escapeHtml(stake)}</p>
      ${featBlock}`;
  }

  const d = w.prev ? points(w.score - w.prev.score) : null;
  const head = d == null ? 'On the record' : d > 0 ? `Up ${d} on last week` : d < 0 ? `Down ${-d} on last week` : 'Level with last week';
  return `
    <p class="eyebrow">The verdict</p>
    <h1 class="rv-title ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${escapeHtml(head)}</h1>
    ${featBlock}`;
}

/* -------------------- the screen -------------------- */

const BEATS = [
  { build: scoreBeat, next: 'The days', cue: 'tick' },
  { build: daysBeat, next: 'The rows', cue: 'tick' },
  { build: rowsBeat, next: 'The verdict', cue: 'tick' },
  { build: verdictBeat, next: '', cue: '' },
];

let step = 0;

export function renderWeekReview(mount) {
  step = 0;
  const key = arena.reviewWeek();
  const w = readWeek(key);
  if (!w.due) return empty(mount);
  draw(mount, w);
}

function empty(mount) {
  mount.innerHTML = `
    <div class="screen rv">
      <div class="rv-body">
        <p class="eyebrow">The week in review</p>
        <h1 class="rv-title">Not yet</h1>
        <p class="rv-sub">Come back Sunday.</p>
      </div>
      <button class="btn primary big" id="out" data-back>Back to the grid</button>
    </div>`;

  mount.querySelector('#out').addEventListener('click', () => navigate('#/hub'));
}

function draw(mount, w) {
  const cover = step === 0;
  const beat = BEATS[step - 1];
  const last = step === BEATS.length;

  mount.innerHTML = `
    <div class="screen rv" data-step="${step}">
      <div class="rv-dots">${BEATS.map((_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>

      <div class="rv-body">
        ${cover
          ? `<p class="eyebrow">${escapeHtml(arena.weekLabel(w.key))}</p>
             <h1 class="rv-title">The week in review</h1>
             <p class="rv-sub">${w.live ? 'One day left, nothing settled.' : 'Closed.'}</p>`
          : beat.build(w)}
      </div>

      <button class="btn primary big" id="next">${cover ? 'Open it' : last ? 'Back to the grid' : escapeHtml(beat.next)}</button>
      ${last ? `<button class="btn ghost wide" id="share">${icon('external', 16)}<span>Share this week</span></button>` : ''}
    </div>`;

  if (step === 1) countUp(mount.querySelector('#count'), w.score);
  if (last) finish(mount, w);
  else if (!cover) {
    chime(beat.cue);
    haptic('tick');
  }

  mount.querySelector('#share')?.addEventListener('click', () => shareWeek(w.key));
  mount.querySelector('#next').addEventListener('click', () => {
    haptic('press');
    if (last) return navigate('#/hub');
    step++;
    draw(mount, w);
  });
  window.scrollTo(0, 0);
}

/** The score arrives rather than appearing. The one number worth waiting on. */
function countUp(el, to) {
  if (!el) return;
  if (still()) {
    el.textContent = pct(to);
    return;
  }
  const ms = 900;
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / ms);
    // Ease out: fast off the mark, then settling on the number.
    el.textContent = pct(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function finish(mount, w) {
  arena.markReviewed(w.key);
  const good = w.live ? w.score >= w.opponent.score : w.prev && w.score > w.prev.score;
  chime(good ? 'win' : 'phase');
  haptic(good ? 'win' : 'tick');
  if (good) setTimeout(() => celebrate(mount.querySelector('.rv-body'), { count: 18, spread: 120, colour: 'var(--good)' }), 140);
}
