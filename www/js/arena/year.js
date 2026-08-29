// The Year: 365 days from the day the record starts, written 26/27, locked
// until it has been lived.
//
// A review, not a second competition. The months chart is drawn here rather
// than with barChart, which scales to its tallest bar: on percentages that
// draws a 44% month as a near-miss of a full column. Always 0 to 100, and as
// many columns as the year has months, counted from the data.

import * as store from '../store.js';
import * as habits from '../habits/program.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { openWeekSheet } from './home.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const MONTH_LETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const shortMonth = (m) => MONTH_LETTER[Number(m.split('-')[1]) - 1];

export function renderYear(mount, want) {
  const open = arena.years().filter((y) => y.open);
  if (!open.length) return renderLocked(mount);

  const n = Number(want);
  const year = open.find((y) => y.n === n) || open[open.length - 1];
  const at = open.findIndex((y) => y.n === year.n);

  const weeks = arena.weeksOfYear(year).map((key) => ({ key, ...store.get().arena.weeks[key] }));
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
        <button class="icon-btn" data-back="cabinet" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(year.label)}</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <p class="yr-span">${escapeHtml(span(year))}</p>

      ${open.length > 1
        ? `<div class="yr-nav">
            <button class="icon-btn" id="prevY" ${at <= 0 ? 'disabled' : ''} aria-label="Earlier year">${icon('back', 18)}</button>
            <b>${escapeHtml(year.label)}</b>
            <button class="icon-btn flip" id="nextY" ${at >= open.length - 1 ? 'disabled' : ''} aria-label="Later year">${icon('back', 18)}</button>
          </div>`
        : ''}

      ${scored.length
        ? `<div class="stat-grid three">
            <div class="stat"><b>${pct(mean)}</b><span>the year</span></div>
            <div class="stat"><b>${won}–${lost}</b><span>won–lost</span></div>
            <div class="stat"><b>${cells.toLocaleString()}</b><span>cells kept</span></div>
          </div>

          <section class="card">
            <h2>Month by month</h2>
            ${monthChart(year)}
          </section>

          <section class="card">
            <h2>The ladder</h2>
            ${ladderTrack(year)}
          </section>`
        : `<section class="card">
            <h2>Nothing scored</h2>
            <p class="muted small">No week of this year made it onto the record.</p>
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

  mount.querySelector('#prevY')?.addEventListener('click', () => hop(mount, open[at - 1]));
  mount.querySelector('#nextY')?.addEventListener('click', () => hop(mount, open[at + 1]));
  mount.querySelectorAll('[data-week]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      openWeekSheet(el.dataset.week);
    })
  );
}

function hop(mount, year) {
  if (!year) return;
  haptic('tick');
  renderYear(mount, year.n);
}

const span = (y) => {
  const fmt = (k) => {
    const [yy, mm, dd] = k.split('-').map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  };
  return `${fmt(y.from)} – ${fmt(y.to)}`;
};

/** The countdown, and the whole screen: a review you can open early is a dashboard. */
function renderLocked(mount) {
  const left = arena.daysLeftInYear();
  const y = arena.yearAt(arena.currentYearIndex());
  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="cabinet" aria-label="Back">${icon('back')}</button>
        <h1>The Year</h1>
        <span class="icon-btn ghost"></span>
      </header>
      <section class="vault">
        <span class="vault-lock">${icon('lock', 26)}</span>
        <b class="vault-count">${left}</b>
        <span class="vault-unit">day${left === 1 ? '' : 's'}</span>
        <p class="vault-label">until <b>${escapeHtml(y.label)}</b> is sealed</p>
        <p class="muted small">${escapeHtml(span(y))}</p>
      </section>

    </div>`;
}

function monthChart(year) {
  const months = store.get().arena.months;
  const bar = arena.divisionOf(lastDivisionOf(year)).bar;
  const cols = arena.monthsOfYear(year);
  return `<div class="yr-chart" style="--bar-line:${(bar * 100).toFixed(1)}%">
    ${cols
      .map((key) => {
        const rec = months[key];
        const live = !rec && key === arena.currentMonth() ? arena.monthScore(key) : null;
        const score = rec ? rec.score : live && !live.empty ? live.score : null;
        const cls = score == null ? 'none'
          : rec?.move === 'up' || rec?.move === 'placed' ? 'up'
            : rec?.move === 'down' ? 'down'
              : live ? 'live' : 'held';
        return `<div class="yr-col ${cls}" title="${escapeHtml(key)}${score == null ? '' : `: ${pct(score)}`}">
          <span class="yr-fill" style="height:${score == null ? 0 : (score * 100).toFixed(1)}%"></span>
          <i>${shortMonth(key)}</i>
        </div>`;
      })
      .join('')}
  </div>`;
}

/** The division each month finished in, as a track. */
function ladderTrack(year) {
  const months = store.get().arena.months;
  const seen = arena.monthsOfYear(year).map((m) => (months[m] ? { m, ...months[m] } : null)).filter(Boolean);
  if (!seen.length) return '<p class="muted small">No month of this year closed.</p>';
  const first = arena.divisionOf(seen[0].from);
  const last = arena.divisionOf(seen[seen.length - 1].to);
  const high = seen.reduce((a, m) => Math.max(a, arena.divisionIndex(m.to)), 0);
  return `<div class="yr-track">
    ${seen
      .map((m) => `<span class="yr-step ${m.move}" title="${escapeHtml(`${m.m}: ${m.move}`)}">
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
  const mine = arena.monthsOfYear(year).filter((m) => months[m]);
  return mine.length ? months[mine[mine.length - 1]].to : store.get().arena.division;
}

function arcRow(year) {
  const arcs = store.get().arena.arcs;
  const mine = Object.entries(arcs)
    .filter(([k]) => {
      const weeks = arena.arcSeason(arcFromKey(k));
      const first = weeks[0];
      return first && first >= arena.weeksOfYear(year)[0] && first <= arena.weeksOfYear(year).slice(-1)[0];
    })
    .map(([k, rec]) => ({ k, rec, arc: arcFromKey(k) }));
  if (!mine.length) return '';
  return `<section class="card">
    <h2>The cups</h2>
    <div class="yr-arcs">
      ${mine
        .map(({ k, rec, arc }) => {
          const state = rec.won ? 'won'
            : rec.qualified === false ? 'out'
              : rec.final === 'lost' ? 'final'
                : rec.sf === 'lost' ? 'sf'
                  : rec.qf === 'lost' ? 'qf' : 'open';
          const label = { won: 'Won', out: 'Group stage', final: 'Runner-up', sf: 'Semi-final', qf: 'Quarter-final', open: 'Running' }[state];
          return `<div class="yr-arc ${rec.won ? 'won' : state === 'final' ? 'final' : ''}" data-arc="${escapeHtml(k)}">
            <span>${icon(rec.won ? 'trophy' : 'ladder', 20)}</span>
            <b>${escapeHtml(arc.name)}</b>
            <i>${escapeHtml(label)}</i>
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

/** '2026-autumn' back into an arc. */
function arcFromKey(key) {
  const [y, id] = key.split('-');
  const arc = arena.ARCS.find((a) => a.id === id) || arena.ARCS[0];
  return { ...arc, year: Number(y) };
}

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
  </section>`;
}

function featsOfYear(year) {
  const from = new Date(`${year.from}T00:00`).getTime();
  const to = new Date(`${year.to}T23:59`).getTime();
  const earned = feats.FEATS.map((f) => ({ ...f, at: feats.earnedAt(f.id) }))
    .filter((f) => f.at && f.at >= from && f.at <= to)
    .sort((a, b) => a.at - b.at);
  if (!earned.length) return '';
  return `<section class="card">
    <h2>Feats of ${escapeHtml(year.label)}</h2>
    ${earned
      .map((f) => `<div class="rs-feat">
        <span class="ft-ico on">${icon(f.icon, 18)}</span>
        <span><b>${escapeHtml(f.name)}</b><i>${escapeHtml(new Date(f.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }))}</i></span>
      </div>`)
      .join('')}
  </section>`;
}
