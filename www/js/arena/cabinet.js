// The Cabinet: what is finished, for ever. Cups, feats, years, and the lines
// you left. The Arena is now, this is the other half.

import * as store from '../store.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { cup } from './cup.js';
import { openWeekSheet } from './week-sheet.js';
import { wireFeatTiles } from './feats-screen.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/** '2026-autumn' back into an arc. */
function arcFromKey(key) {
  const [y, id] = key.split('-');
  const arc = arena.ARCS.find((a) => a.id === id) || arena.ARCS[0];
  return { ...arc, year: Number(y) };
}

export function renderCabinet(mount) {
  const st = store.get().arena;
  const cups = Object.entries(st.arcs)
    .filter(([, a]) => a.won)
    .sort()
    .map(([k, rec]) => ({ k, rec, arc: arcFromKey(k) }));
  const c = feats.counts();
  const open = arena.years().filter((y) => y.open);
  const left = arena.daysLeftInYear();
  const running = arena.yearAt(arena.currentYearIndex());
  const notes = arena.notes();

  mount.innerHTML = `
    <div class="screen">
      <header class="grid-head">
        <div class="gh-text">
          <h1>Cabinet</h1>
        </div>
        <div class="head-actions">
          <a class="icon-btn linkbtn" href="#/settings" aria-label="Settings">${icon('settings')}</a>
        </div>
      </header>

      <hr class="cut">
      <div class="cab-shelf">${shelf(cups)}</div>

      <section class="card">
        <div class="ar-fx-head">
          <h2>Feats</h2>
          <span class="pill ghost">${c.earned} of ${c.total}</span>
        </div>
        ${featList(c.earned)}
        <a class="btn ghost wide" href="#/cabinet/feats">${icon('medal', 16)}<span>All feats</span></a>
      </section>

      <section class="card">
        <h2>The year</h2>
        ${open.length
          ? `<div class="yr-chips">
              ${open
                .slice()
                .reverse()
                .map((y) => `<a class="yr-chip" href="#/cabinet/year?y=${y.n}">${escapeHtml(y.label)}</a>`)
                .join('')}
            </div>`
          : ''}
        <p class="cab-year">
          <span class="cab-year-lock">${icon('lock', 15)}</span>
          <b>${left}</b> day${left === 1 ? '' : 's'} until <b>${escapeHtml(running.label)}</b> is sealed
        </p>
      </section>

      ${notes.length
        ? `<section class="card">
            <div class="ar-fx-head">
              <h2>What you said</h2>
              <span class="pill ghost">${notes.length}</span>
            </div>
            ${notes
              .map((n) => `<button class="said" ${n.kind === 'week' ? `data-week="${escapeHtml(n.key)}"` : ''}>
                <span class="said-mark">${icon(n.kind === 'arc' ? 'trophy' : 'flash', 15)}</span>
                <span class="said-body">
                  <em>“${escapeHtml(n.note)}”</em>
                  <i>${escapeHtml(n.kind === 'arc' ? cupName(n.key) : `${arena.weekLabel(n.key)} · ${pct(n.score)}`)}</i>
                </span>
              </button>`)
              .join('')}
          </section>`
        : ''}
    </div>`;

  mount.querySelectorAll('[data-week]').forEach((el) =>
    el.addEventListener('click', () => {
      haptic('tick');
      openWeekSheet(el.dataset.week);
    })
  );
  mount.querySelectorAll('[data-cup]').forEach((el) => el.addEventListener('click', () => haptic('press')));
  wireFeatTiles(mount);
}

/* --------------------- the shelf --------------------- */

/** One plinth per cup that exists, not per win: winning Autumn three years
 *  running is three trophies of the same shape, so the shelf says so with a
 *  count rather than growing without end. */
function shelf(cups) {
  return arena.CUPS.map((a) => {
    const wins = cups.filter((x) => x.arc.id === a.id);
    const latest = wins[wins.length - 1];
    return `<button class="plinth ${wins.length ? 'won' : ''}" ${latest ? `data-cup="${escapeHtml(latest.k)}"` : 'disabled'}>
      <span class="plinth-art">${cup(wins.length ? a.id : '', 54)}${
        wins.length > 1 ? `<em class="plinth-n">${wins.length}</em>` : ''
      }</span>
      <i>${escapeHtml(a.name)}</i>
      ${wins.length ? `<u>${escapeHtml(wins.map((w) => w.arc.year).join(', '))}</u>` : ''}
    </button>`;
  }).join('');
}

/* --------------------- what is in the case --------------------- */

/** Short, and the year only when it is not this one. */
function when(at) {
  const d = new Date(at);
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

/** The last five taken, or the five nearest when nothing has been. */
function featList(earned) {
  const rows = earned
    ? feats.FEATS.map((f) => ({ ...f, at: feats.earnedAt(f.id) }))
      .filter((f) => f.at)
      .sort((a, b) => b.at - a.at)
      .slice(0, 5)
      .map((f) => row(f, when(f.at)))
    : feats.closest(5).map((f) => row(f, feats.priceOf(f.days), f.frac));
  return rows.join('');
}

/* No glyph: the catalogue reuses them, so five rows can carry three marks. */
function row(f, right, frac = 0) {
  return `<button class="cab-feat" data-feat="${escapeHtml(f.id)}">
    <span class="cab-feat-body">
      <b>${escapeHtml(f.name)}</b>
      ${frac > 0.02 ? `<span class="ft-bar"><i style="width:${(frac * 100).toFixed(0)}%"></i></span>` : ''}
    </span>
    <i>${escapeHtml(right)}</i>
  </button>`;
}

const cupName = (key) => {
  const arc = arcFromKey(key);
  return `${arc.name} Trophy ${arc.year}`;
};

