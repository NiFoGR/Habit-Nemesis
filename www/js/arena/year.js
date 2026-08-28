// The Year.
//
// The review, not a second competition: the Arc is the competition and putting
// another one on top of it would mean two tables saying the same thing four
// times a year apart. This is the page you scroll in January, and everything
// on it is a fact the record already holds - twelve months, four Arcs, the
// best week and the worst, the rows that carried the year and the ones that
// did not.
//
// The months chart is drawn here rather than through the shared barChart,
// which scales to its own tallest bar. For percentages that is a lie: a 44%
// month beside a 46% one would draw as a near-miss of a full column. Nought to
// a hundred, always, so a flat year looks flat.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { openWeekSheet } from './home.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Years we have anything for, oldest first. Always includes this one, so the
 *  screen is never empty on the day you open it. */
function years() {
  const set = new Set([String(new Date().getFullYear())]);
  for (const k of Object.keys(store.get().arena.weeks)) set.add(arena.monthOfWeek(k).slice(0, 4));
  return [...set].sort();
}

let shown = null;

export function renderYear(mount) {
  const list = years();
  const year = list.includes(shown) ? shown : list[list.length - 1];
  shown = year;
  const i = list.indexOf(year);

  const weeks = Object.entries(store.get().arena.weeks)
    .filter(([k]) => arena.monthOfWeek(k).startsWith(year))
    .map(([key, w]) => ({ key, ...w }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  const scored = weeks.filter((w) => w.result !== 'void' && w.due >= arena.VOID_CELLS);
  const won = weeks.filter((w) => w.result === 'won').length;
  const lost = weeks.filter((w) => w.result === 'lost').length;
  const mean = scored.length ? scored.reduce((a, w) => a + w.score, 0) / scored.length : 0;
  const cells = weeks.reduce((a, w) => a + (w.done || 0), 0);
  const best = [...scored].sort((a, b) => b.score - a.score)[0] || null;
  const worst = [...scored].sort((a, b) => a.score - b.score)[0] || null;

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="arena" aria-label="Back">${icon('back')}</button>
        <h1>The Year</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="yr-nav">
        <button class="icon-btn" id="prevY" ${i <= 0 ? 'disabled' : ''} aria-label="Previous year">${icon('back', 18)}</button>
        <b>${escapeHtml(year)}</b>
        <button class="icon-btn flip" id="nextY" ${i >= list.length - 1 ? 'disabled' : ''} aria-label="Next year">${icon('back', 18)}</button>
      </div>

      ${scored.length
        ? `<div class="stat-grid three">
            <div class="stat"><b>${pct(mean)}</b><span>the year</span></div>
            <div class="stat"><b>${won}–${lost}</b><span>won–lost</span></div>
            <div class="stat"><b>${cells.toLocaleString()}</b><span>cells kept</span></div>
          </div>

          <section class="card">
            <h2>The twelve months</h2>
            ${monthChart(year)}
            <p class="muted small">Each column is the mean of that month's weeks, on a fixed nought-to-a-hundred scale. The dotted line is the bar for the division you were in at the end of the year.</p>
          </section>

          <section class="card">
            <h2>The ladder</h2>
            ${ladderTrack(year)}
          </section>`
        : `<section class="card">
            <h2>Nothing scored yet</h2>
            <p class="muted small">A week enters the record the Monday after it ends. Come back when one has.</p>
          </section>`}

      ${best && worst
        ? `<section class="card">
            <h2>Two weeks</h2>
            <button class="ar-nemesis" data-week="${best.key}">
              <span class="ar-nico good">${icon('flash', 16)}</span>
              <span class="ar-nname"><b>Best week</b><i>${escapeHtml(arena.weekLabel(best.key))}</i></span>
              <b class="ar-nscore">${pct(best.score)}</b>
            </button>
            <button class="ar-nemesis" data-week="${worst.key}">
              <span class="ar-nico bad">${icon('warn', 16)}</span>
              <span class="ar-nname"><b>Worst week</b><i>${escapeHtml(arena.weekLabel(worst.key))}</i></span>
              <b class="ar-nscore">${pct(worst.score)}</b>
            </button>
          </section>`
        : ''}

      ${arcRow(year)}
      ${rowsOfYear(weeks)}
      ${featsOfYear(year)}
    </div>`;

  mount.querySelector('#prevY').addEventListener('click', () => {
    shown = list[i - 1];
    haptic('tick');
    renderYear(mount);
  });
  mount.querySelector('#nextY').addEventListener('click', () => {
    shown = list[i + 1];
    haptic('tick');
    renderYear(mount);
  });
  mount.querySelectorAll('[data-week]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      openWeekSheet(el.dataset.week);
    })
  );
}

function monthChart(year) {
  const months = store.get().arena.months;
  const endDiv = lastDivisionOf(year);
  const bar = arena.divisionOf(endDiv).bar;
  return `<div class="yr-chart" style="--bar-line:${(bar * 100).toFixed(1)}%">
    ${MONTHS.map((name, m) => {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      const rec = months[key];
      const live = !rec && key === arena.currentMonth() ? arena.monthScore(key) : null;
      const score = rec ? rec.score : live && !live.empty ? live.score : null;
      const cls = score == null ? 'none' : rec?.move === 'up' || rec?.move === 'placed' ? 'up' : rec?.move === 'down' ? 'down' : live ? 'live' : 'held';
      return `<div class="yr-col ${cls}" title="${escapeHtml(name)}${score == null ? '' : `: ${pct(score)}`}">
        <span class="yr-fill" style="height:${score == null ? 0 : (score * 100).toFixed(1)}%"></span>
        <i>${name[0]}</i>
      </div>`;
    }).join('')}
  </div>`;
}

/** The division you finished each month in, as a track. Reads left to right
 *  like the months above it, so the two line up column for column. */
function ladderTrack(year) {
  const months = store.get().arena.months;
  const seen = MONTHS.map((name, m) => months[`${year}-${String(m + 1).padStart(2, '0')}`]).filter(Boolean);
  if (!seen.length) return '<p class="muted small">No month has closed this year yet.</p>';
  const first = arena.divisionOf(seen[0].from);
  const last = arena.divisionOf(seen[seen.length - 1].to);
  const high = seen.reduce((a, m) => Math.max(a, arena.divisionIndex(m.to)), 0);
  return `<div class="yr-track">
    ${seen
      .map((m) => `<span class="yr-step ${m.move}" title="${escapeHtml(`${m.month}: ${m.move}`)}">
        ${icon(m.move === 'up' || m.move === 'placed' ? 'arrowUp' : m.move === 'down' ? 'arrowDown' : 'check', 13)}
        <i>${escapeHtml(arena.divisionOf(m.to).name)}</i>
      </span>`)
      .join('')}
  </div>
  <div class="kv"><span>Started</span><b>${escapeHtml(first.name)}</b></div>
  <div class="kv"><span>Highest</span><b>${escapeHtml(arena.DIVISIONS[high].name)}</b></div>
  <div class="kv"><span>Finished</span><b>${escapeHtml(last.name)}</b></div>`;
}

function lastDivisionOf(year) {
  const months = store.get().arena.months;
  const keys = Object.keys(months).filter((m) => m.startsWith(year)).sort();
  return keys.length ? months[keys[keys.length - 1]].to : store.get().arena.division;
}

function arcRow(year) {
  const arcs = store.get().arena.arcs;
  const mine = arena.ARCS.map((a) => ({ ...a, year: Number(year), rec: arcs[`${year}-${a.id}`] })).filter((a) => a.rec);
  if (!mine.length) return '';
  return `<section class="card">
    <h2>The Arcs</h2>
    <div class="yr-arcs">
      ${mine
        .map((a) => {
          const r = a.rec;
          const state = r.won ? 'won' : r.qualified === false ? 'out' : r.final === 'lost' ? 'final' : r.sf === 'lost' ? 'sf' : r.qf === 'lost' ? 'qf' : 'open';
          const label = { won: 'Won', out: 'Group stage', final: 'Runner-up', sf: 'Semi-final', qf: 'Quarter-final', open: 'In progress' }[state];
          // Only two states get a look of their own: won, and lost in the final.
          // The rest read as the label they carry.
          return `<div class="yr-arc ${r.won ? 'won' : state === 'final' ? 'final' : ''}">
            <span>${icon(r.won ? 'trophy' : 'ladder', 20)}</span>
            <b>${escapeHtml(a.name)}</b>
            <i>${escapeHtml(label)}</i>
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

/** The rows that made the year, summed across every week of it. This is the
 *  only place the app adds a habit up over a whole year, and it is worth it:
 *  a score is a decay curve and answers "lately", where this answers "all
 *  year", which are different questions and were being confused. */
function rowsOfYear(weeks) {
  if (!weeks.length) return '';
  const tally = new Map();
  for (const w of weeks) {
    for (const r of arena.scoreWeek(w.key).rows) {
      const t = tally.get(r.id) || { name: r.name, colour: r.colour, linked: r.linked, done: 0, due: 0 };
      t.done += r.done;
      t.due += r.due;
      tally.set(r.id, t);
    }
  }
  const rows = [...tally.values()].filter((r) => r.due >= 20).sort((a, b) => b.done / b.due - a.done / a.due);
  if (!rows.length) return '';
  return `<section class="card">
    <h2>The rows</h2>
    <div class="ar-rows">
      ${rows
        .map((r) => {
          const colour = r.linked ? 'var(--accent)' : r.colour ? habits.hexOf(r.colour) : 'var(--accent)';
          return `<div class="ar-row">
            <span class="ar-row-name" style="color:${colour}">${escapeHtml(r.name)}</span>
            <span class="ar-row-bar"><i style="width:${((r.done / r.due) * 100).toFixed(0)}%;background:${colour}"></i></span>
            <b>${pct(r.done / r.due)}</b>
          </div>`;
        })
        .join('')}
    </div>
    <p class="muted small">Every day the row was due, all year. Rows with fewer than twenty days are left out, because a habit added in December has nothing to say about the year.</p>
  </section>`;
}

function featsOfYear(year) {
  const earned = feats.FEATS.map((f) => ({ ...f, at: feats.earnedAt(f.id) }))
    .filter((f) => f.at && new Date(f.at).getFullYear() === Number(year))
    .sort((a, b) => a.at - b.at);
  if (!earned.length) return '';
  return `<section class="card">
    <h2>Feats of ${escapeHtml(year)}</h2>
    ${earned
      .map((f) => `<div class="rs-feat">
        <span class="ft-ico on">${icon(f.icon, 18)}</span>
        <span><b>${escapeHtml(f.name)}</b><i>${escapeHtml(new Date(f.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }))}</i></span>
      </div>`)
      .join('')}
  </section>`;
}
