// The Cabinet: what is finished, for ever. Cups, feats, years, and the lines
// you left. The Arena is now, this is the other half.

import * as store from '../store.js';
import * as arena from './program.js';
import * as feats from './feats.js';
import { escapeHtml, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { openWeekSheet } from './home.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/** '2026-summer' back into an arc. */
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
  const next = feats.closest(2);
  const open = arena.years().filter((y) => y.open);
  const left = arena.daysLeftInYear();
  const running = arena.yearAt(arena.currentYearIndex());
  const notes = arena.notes();

  mount.innerHTML = `
    <div class="screen">
      <header class="grid-head">
        <div class="gh-text">
          <h1>Cabinet</h1>
          <p>What you have done</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn linkbtn" href="#/settings" aria-label="Settings">${icon('settings')}</a>
        </div>
      </header>

      <section class="cab-cups ${cups.length ? '' : 'empty'}">
        ${cups.length
          ? cups
              .map(({ k, rec, arc }) => `<button class="cup" data-cup="${escapeHtml(k)}">
                <span class="cup-art">${icon('trophy', 30)}</span>
                <b>${escapeHtml(arc.name)} Trophy</b>
                <i>${escapeHtml(String(arc.year))}${arc.id === 'winter' ? `/${String(arc.year + 1).slice(2)}` : ''}</i>
                ${rec.note ? `<em>“${escapeHtml(rec.note)}”</em>` : ''}
              </button>`)
              .join('')
          : `<div class="cup-empty">
              <span class="cup-art">${icon('trophy', 30)}</span>
              <b>No cups yet</b>
              <i>Four a year. Winter, spring, summer, autumn.</i>
            </div>`}
      </section>

      <section class="card">
        <div class="ar-week-head">
          <h2>Feats</h2>
          <span class="pill ghost">${c.earned} of ${c.total}</span>
        </div>
        ${next.length
          ? `<div class="ar-next">
              ${next
                .map((f) => `<div class="ar-nextrow">
                  <span class="ar-nico">${icon(f.icon, 16)}</span>
                  <span class="ar-nname"><b>${escapeHtml(f.name)}</b><i>${escapeHtml(nearly(f))}</i></span>
                  <span class="ar-row-bar"><i style="width:${(f.frac * 100).toFixed(0)}%"></i></span>
                </div>`)
                .join('')}
            </div>`
          : '<p class="muted small">Every feat is earned. There is nothing left on the list.</p>'}
        <a class="btn ghost wide" href="#/cabinet/feats">${icon('medal', 16)}<span>All feats</span></a>
      </section>

      <section class="card">
        <div class="ar-week-head">
          <h2>The Year</h2>
          <span class="pill ghost">${open.length ? `${open.length} sealed` : 'none yet'}</span>
        </div>
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
      </section>

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
}

const cupName = (key) => {
  const arc = arcFromKey(key);
  return `${arc.name} Trophy ${arc.year}`;
};

function nearly(f) {
  const dp = f.unit && /cm|h|s/.test(f.unit) ? 1 : 0;
  const round = (v) => (dp ? v.toFixed(1) : Math.round(v).toLocaleString());
  return `${round(Math.min(f.have, f.need))}${f.unit || ''} of ${round(f.need)}${f.unit || ''}`;
}
