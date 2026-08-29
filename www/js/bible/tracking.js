// Bible tracking: heatmap, progress through the canon, prayer, log.
// The section bars answer the real question, which is which parts you have
// never been into.

import * as store from '../store.js';
import * as bible from './program.js';
import * as pray from '../pray/program.js';
import { BOOKS } from './canon.js';
import { escapeHtml, fmtDate, relDay } from '../ui.js';
import { icon } from '../icons.js';

export function renderBibleTracking(mount) {
  const hist = bible.history(13);
  const t30 = bible.totals(30);
  const st = store.get().bible;
  const prog = bible.overallProgress();

  const cols = [];
  for (let i = 0; i < hist.length; i += 7) cols.push(hist.slice(i, i + 7));

  // Recent days, newest first.
  const log = Object.entries(st.days)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 30);

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>Tracking</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="stat-grid">
        <div class="stat"><b>${bible.streak()}</b><span>day streak</span></div>
        <div class="stat"><b>${st.best}</b><span>best streak</span></div>
        <div class="stat"><b>${t30.items}</b><span>chapters, 30d</span></div>
        <div class="stat"><b>${Math.round(t30.rate * 100)}%</b><span>days read, 30d</span></div>
      </div>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Last 13 weeks</h2></div>
        <div class="heatmap">
          ${cols.map((c) => `<div class="hm-col">${c.map((d) => `<i class="${d.cls}" title="${d.key}: ${d.n} read"></i>`).join('')}</div>`).join('')}
        </div>
        <div class="hm-key">
          <span>less</span><i class="none"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>more</span>
        </div>
      </section>

      <section class="card">
        <div class="h-row">${icon('chart', 16)}<h2>Through the canon</h2>
          <span class="pill ghost">${prog.read}/${prog.total}</span></div>
        ${bible.SECTIONS.map((sec) => {
          const sp = bible.sectionProgress(sec.id);
          return `<div class="sec-prog">
            <span class="sp-name">${escapeHtml(sec.name)}</span>
            <span class="sp-bar"><i style="width:${(sp.frac * 100).toFixed(1)}%"></i></span>
            <em>${sp.read}/${sp.total}</em>
          </div>`;
        }).join('')}
      </section>

      <section class="card">
        <div class="h-row">${icon('sun', 16)}<h2>Prayer</h2>
          <span class="pill ghost">${pray.streak()}d streak</span></div>
        <div class="stat-grid">
          <div class="stat"><b>${pray.totals(30).full}</b><span>full days, 30d</span></div>
          <div class="stat"><b>${pray.totals(30).morning}</b><span>mornings, 30d</span></div>
          <div class="stat"><b>${pray.totals(30).evening}</b><span>nights, 30d</span></div>
          <div class="stat"><b>${pray.lifetime()}</b><span>prayers, all time</span></div>
        </div>
        <div class="heatmap">
          ${(() => { const h = pray.history(13); const cols = [];
            for (let i = 0; i < h.length; i += 7) cols.push(h.slice(i, i + 7));
            return cols.map((c) => `<div class="hm-col">${c.map((d) => `<i class="pr-${d.cls}" title="${d.key}"></i>`).join('')}</div>`).join(''); })()}
        </div>
        <div class="hm-key"><i class="pr-none"></i> none <i class="pr-half"></i> one <i class="pr-full"></i> both</div>
      </section>

      <section class="card">
        <div class="h-row">${icon('medal', 16)}<h2>Books finished</h2>
          <span class="pill ghost">${bible.booksFinished()}/${BOOKS.length}</span></div>
        ${(() => {
          const done = BOOKS.filter((b) => bible.bookProgress(b.id).read >= b.chapters.length);
          if (!done.length) return '<p class="muted small">None yet. Mark is sixteen chapters, if you want one quickly.</p>';
          return `<div class="chip-wrap">${done.map((b) => `<a class="pill done" href="#/bible/book?id=${b.id}">${escapeHtml(b.name)}</a>`).join('')}</div>`;
        })()}
      </section>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Log</h2></div>
        ${log.length
          ? `<div class="log-list">${log.map(([key, d]) => `
              <div class="log-row">
                <span class="lr-day"><b>${escapeHtml(relDay(key))}</b>${
                  // relDay repeats fmtDate for anything older than yesterday.
                  relDay(key) === fmtDate(key) ? '' : `<i>${escapeHtml(fmtDate(key))}</i>`
                }</span>
                <span class="lr-what">
                  ${d.chapters.map((u) => `<a class="pill ghost" href="#/bible/reader?book=${u.split(':')[0]}&ch=${u.split(':')[1]}">${escapeHtml(bible.refName(u))}</a>`).join('')}
                </span>
              </div>`).join('')}</div>`
          : '<p class="muted small">Nothing logged yet.</p>'}
      </section>
    </div>`;
}
