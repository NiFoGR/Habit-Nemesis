// The Cabinet: what is finished, for ever. Cups, feats, years, and the lines
// you left. The Arena is now, this is the other half.

import * as store from '../store.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { cup } from './cup.js';
import { openWeekSheet, wireFeatTiles } from './home.js';

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

      <div class="cab-shelf">${shelf(cups)}</div>

      ${bands(feats.bySection().flatMap((s) => s.items))}
      <a class="btn ghost wide" href="#/cabinet/feats">${icon('medal', 16)}<span>All ${c.total} feats</span></a>

      <div class="vault small">
        <span class="vault-lock">${icon('lock', 20)}</span>
        <b class="vault-count">${left}</b>
        <span class="vault-unit">day${left === 1 ? '' : 's'}</span>
        <p class="vault-label">until <b>${escapeHtml(running.label)}</b> is sealed</p>
      </div>
      ${open.length
        ? `<div class="yr-chips">
            ${open
              .slice()
              .reverse()
              .map((y) => `<a class="yr-chip" href="#/cabinet/year?y=${y.n}">${escapeHtml(y.label)}</a>`)
              .join('')}
          </div>`
        : ''}

      ${notes.length
        ? `<section class="card">
            <div class="ar-week-head">
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

/* --------------------- feats by price --------------------- */

// Named by what they cost, so the bands need no heading of their own.
const BANDS = [
  { name: 'Years', min: 350 },
  { name: 'Months', min: 60 },
  { name: 'Weeks', min: 14 },
  { name: 'Days', min: 0 },
];

function bands(all) {
  return BANDS.map((b, i) => {
    const hi = i ? BANDS[i - 1].min : Infinity;
    const items = all.filter((f) => f.days >= b.min && f.days < hi);
    if (!items.length) return '';
    const got = items.filter((f) => f.earned).length;
    return `<section class="cab-band">
      <div class="cab-bandhead"><h2>${b.name}</h2><span class="pill ghost">${got} of ${items.length}</span></div>
      <div class="cab-bar"><i style="width:${((got / items.length) * 100).toFixed(0)}%"></i></div>
      <div class="cab-hexes">
        ${items.map((f) => `<button class="hex ${f.earned ? 'on' : ''}" data-feat="${escapeHtml(f.id)}"
          aria-label="${escapeHtml(f.name)}, ${escapeHtml(feats.priceOf(f.days))}">${icon(f.icon, 15)}</button>`).join('')}
      </div>
    </section>`;
  }).join('');
}

const cupName = (key) => {
  const arc = arcFromKey(key);
  return `${arc.name} Trophy ${arc.year}`;
};

