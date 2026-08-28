// The tracking screen: every day you trained, every rep you logged, and the
// trend lines that only mean something once there are a few weeks of them.

import * as store from '../store.js';
import * as program from './program.js';
import { fmtMs, fmtDuration, lineChart, repBars, escapeHtml, relDay, ringSvg } from '../ui.js';
import { icon } from '../icons.js';
import * as feats from '../arena/feats.js';

const WEEKS = 13; // a full 12-week block plus the current week

function heatLevel(score, type, scored = true) {
  if (type === 'release' || !scored) return 'rest';
  if (score >= 90) return 'l4';
  if (score >= 75) return 'l3';
  if (score >= 55) return 'l2';
  return 'l1';
}

function heatmap(state) {
  const byDay = new Map();
  for (const s of state.sessions) {
    const cur = byDay.get(s.date);
    if (!cur || s.score > cur.score) byDay.set(s.date, s);
  }
  const counts = state.sessions.reduce((m, s) => m.set(s.date, (m.get(s.date) || 0) + 1), new Map());

  // Grid runs Monday-first, ending on the current week.
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const end = store.addDays(store.dayKey(today), 6 - dow);
  const start = store.addDays(end, -(WEEKS * 7 - 1));

  let cells = '';
  for (let w = 0; w < WEEKS; w++) {
    cells += '<div class="hm-col">';
    for (let d = 0; d < 7; d++) {
      const key = store.addDays(start, w * 7 + d);
      const rec = byDay.get(key);
      const future = key > store.dayKey(today);
      const n = counts.get(key) || 0;
      const cls = future ? 'future' : rec ? heatLevel(rec.score, rec.type, rec.countsForPromotion !== false) : 'none';
      const title = future
        ? key
        : rec
        ? `${relDay(key)} · ${n} session${n > 1 ? 's' : ''} · ${rec.type === 'release' ? 'release day' : rec.countsForPromotion === false ? 'logged during a pump session' : `best score ${rec.score}`}`
        : `${relDay(key)} · nothing logged`;
      cells += `<i class="${cls}" title="${escapeHtml(title)}"></i>`;
    }
    cells += '</div>';
  }
  return `<div class="heatmap">${cells}</div>
    <div class="hm-key"><span>less</span><i class="none"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><i class="rest"></i><span>release</span></div>`;
}

function sessionRow(s, idx) {
  const g = program.grade(s.score);
  const label = s.type === 'release' ? 'Release day'
    : s.type === 'test' ? 'Max hold test'
    : s.source === 'pe-pump' ? 'During a pump session'
    : `Week ${s.level}`;
  const work = s.reps ? s.reps.filter((r) => r.kind !== 'flick') : [];
  return `<details class="log-row" ${idx === 0 ? 'open' : ''}>
    <summary>
      <span class="log-date">${relDay(s.date)}</span>
      <span class="log-label">${label}</span>
      <span class="log-score ${s.type === 'release' || s.countsForPromotion === false ? 'rest' : ''}">${s.type === 'release' || s.countsForPromotion === false ? icon('check', 15) : s.score}</span>
    </summary>
    <div class="log-body">
      <div class="kv"><span>Grade</span><b>${s.type === 'release' ? 'Restored' : s.countsForPromotion === false ? 'Not scored' : `${g.letter} · ${g.label}`}${s.estimated && s.countsForPromotion !== false ? ' (estimated)' : ''}</b></div>
      <div class="kv"><span>Contractions</span><b>${s.totals?.contractions ?? 0}</b></div>
      <div class="kv"><span>Time under tension</span><b>${fmtMs(s.totals?.tutMs || 0)}</b></div>
      <div class="kv"><span>Longest hold</span><b>${fmtMs(s.totals?.longestHoldMs || 0)}</b></div>
      <div class="kv"><span>Average hold</span><b>${fmtMs(s.totals?.avgHoldMs || 0)}</b></div>
      <div class="kv"><span>Duration</span><b>${fmtDuration(s.durationSec || 0)}</b></div>
      ${s.selfRating ? `<div class="kv"><span>Felt</span><b>${escapeHtml(s.selfRating)}</b></div>` : ''}
      ${s.discomfort ? '<div class="kv warnrow"><span>Flagged</span><b>discomfort</b></div>' : ''}
      ${work.length > 1 ? repBars(work, { h: 42 }) : ''}
    </div>
  </details>`;
}

/** How many of one section's feats are earned. The count lives here rather
 *  than a second copy of the catalogue: the tracking screen says how the
 *  kegel programme is going, and this is one line of that. */
function sectionCount(section) {
  const sec = feats.bySection().find((s) => s.section === section);
  return sec ? `${sec.earned} of ${sec.items.length}` : '—';
}

export function renderTracking(mount) {
  const state = store.get();
  const sessions = state.sessions;
  const trained = sessions.filter((s) => s.type !== 'release');
  // Cadence-following logged from a pump session has no measured reps behind
  // it, so it counts for volume and streaks but is kept out of the quality
  // trends, where a placeholder score would read as a bad session.
  const scored = trained.filter((s) => s.countsForPromotion !== false);
  const totals = store.totals();
  const st = store.streak();
  const idx = program.pfi(state);

  const recent = scored.slice(-30);
  const avgHolds = recent.map((s) => (s.totals?.avgHoldMs || 0) / 1000).filter((v) => v > 0);
  const scores = recent.map((s) => s.score);

  const bestHoldSeries = [];
  let running = 0;
  for (const s of scored) {
    running = Math.max(running, s.totals?.longestHoldMs || 0);
    bestHoldSeries.push(running / 1000);
  }

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="kegels" aria-label="Back">${icon('back')}</button>
        <h1>Tracking</h1>
        <button class="icon-btn" data-nav="settings" aria-label="Settings">${icon('settings')}</button>
      </header>

      <div class="pfi-hero">
        ${ringSvg(Math.min(idx / 1000, 1), String(idx), program.pfiBand(idx), { size: 150 })}
        <div>
          <div class="h-row">${icon('target', 16)}<h2>Pelvic Floor Index</h2></div>
          <p class="small muted">One number out of 1000, combining your best hold, your weekly volume, your level and how consistently you have shown up over the last two weeks.</p>
        </div>
      </div>

      <div class="stat-grid four">
        <div class="stat"><b>${st}</b><span>day streak</span></div>
        <div class="stat"><b>${state.prs.streak || st}</b><span>best streak</span></div>
        <div class="stat"><b>${totals.sessions}</b><span>sessions</span></div>
        <div class="stat"><b>${totals.contractions.toLocaleString()}</b><span>contractions</span></div>
        <div class="stat"><b>${fmtMs(state.prs.maxHoldMs)}</b><span>longest hold</span></div>
        <div class="stat"><b>${Math.round(totals.tutMs / 60000)}m</b><span>lifetime tension</span></div>
        <div class="stat"><b>${state.program.level}</b><span>week of the plan</span></div>
        <div class="stat"><b>${state.prs.score || 0}</b><span>best score</span></div>
      </div>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Consistency</h2></div>
        <p class="small muted">Last 13 weeks. Brighter is a better session; teal marks a programmed release day.</p>
        ${heatmap(state)}
      </section>

      <section class="card">
        <div class="h-row">${icon('trend', 16)}<h2>Hold quality over time</h2></div>
        <p class="small muted">Average hold length per session, in seconds. This is the line that matters most.</p>
        ${avgHolds.length > 1 ? lineChart(avgHolds, { color: 'var(--accent)' }) : '<div class="chart-empty">Two sessions and this starts drawing</div>'}
      </section>

      <section class="card">
        <div class="h-row">${icon('medal', 16)}<h2>Personal best hold</h2></div>
        <p class="small muted">Your ceiling in seconds. It only steps up.</p>
        ${bestHoldSeries.length > 1 ? lineChart(bestHoldSeries, { color: 'var(--good)' }) : '<div class="chart-empty">Not enough sessions yet</div>'}
      </section>

      <section class="card">
        <div class="h-row">${icon('chart', 16)}<h2>Session scores</h2></div>
        ${scores.length > 1 ? lineChart(scores, { color: 'var(--accent)' }) : '<div class="chart-empty">Not enough sessions yet</div>'}
      </section>

      <section class="card">
        <div class="h-row">${icon('target', 16)}<h2>Progress through the plan</h2></div>
        <ol class="timeline">
          ${state.program.history
            .map((h) => `<li><b>Week ${h.level}</b><span>${escapeHtml(program.levelDef(h.level).name)}</span><i>${new Date(h.at).toLocaleDateString()}</i></li>`)
            .reverse()
            .join('')}
        </ol>
      </section>

      <section class="card">
        <div class="h-row">${icon('medal', 16)}<h2>Feats</h2></div>
        <p class="muted small">One list for the whole app, held to one test: something you could say out loud to another person and have it mean something.</p>
        <div class="kv"><span>Kegel feats earned</span><b>${sectionCount('Kegels')}</b></div>
        <a class="btn ghost wide" href="#/arena/feats">${icon('medal', 16)}<span>All feats</span></a>
      </section>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Session log</h2></div>
        ${sessions.length ? sessions.slice().reverse().slice(0, 60).map(sessionRow).join('') : '<p class="muted">Nothing logged yet.</p>'}
      </section>

      <section class="card">
        <div class="h-row">${icon('shield', 16)}<h2>Your data</h2></div>
        <p class="small muted">Everything is stored on this device only. Back it up before you clear browser data or move phones.</p>
        <a class="btn ghost linkbtn" href="#/settings">${icon('settings', 16)}<span>Backups, under Settings</span></a>
      </section>
    </div>`;

}
