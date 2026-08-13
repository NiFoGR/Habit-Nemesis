// The numbers screen: size over time with a projection, training volume,
// BPFSL response, insights, achievements and the full session log.

import * as store from '../store.js';
import * as pe from './program.js';
import { escapeHtml, fmtHours, fmtClock, segmented, onSegment, barChart, relDay, lineChart } from '../ui.js';

let period = '30d';

/* ---------------- size chart with projection ---------------- */

/** History as a solid line, the projection as a dashed continuation inside a
 *  shaded band. The band is the honest part: it is wide when the app is mostly
 *  guessing and narrows as real measurements accumulate. */
function sizeChart(points, proj, colour, key) {
  if (points.length < 1) return '<div class="chart-empty">Log a check-in to start this chart</div>';
  const w = 320;
  const h = 150;
  const padL = 34;
  const padR = 8;
  const padT = 10;
  const padB = 20;

  const t0 = points[0].ts;
  const horizon = proj ? proj.points[proj.points.length - 1].months : 0;
  const tEnd = Math.max(points[points.length - 1].ts, Date.now()) + horizon * 30.44 * 864e5;
  const span = Math.max(tEnd - t0, 30 * 864e5);

  const projLows = proj ? proj.points.map((p) => p[key + 'Low']).filter((v) => v != null) : [];
  const projHighs = proj ? proj.points.map((p) => p[key + 'High']).filter((v) => v != null) : [];
  const values = points.map((p) => p.value).concat(projLows, projHighs);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = Math.max((max - min) * 0.25, 0.4);
  min -= pad;
  max += pad;

  const x = (ts) => padL + ((ts - t0) / span) * (w - padL - padR);
  const y = (v) => h - padB - ((v - min) / (max - min)) * (h - padT - padB);

  const line = points.map((p) => `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `<circle cx="${x(p.ts).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3" fill="${colour}"/>`).join('');

  let band = '';
  let projLine = '';
  if (proj && projLows.length) {
    const lastPt = points[points.length - 1];
    const pts = proj.points.filter((p) => p[key] != null);
    const now = Date.now();
    const at = (m) => now + m * 30.44 * 864e5;
    const upper = [`${x(lastPt.ts)},${y(lastPt.value)}`].concat(pts.map((p) => `${x(at(p.months)).toFixed(1)},${y(p[key + 'High']).toFixed(1)}`));
    const lower = pts.map((p) => `${x(at(p.months)).toFixed(1)},${y(p[key + 'Low']).toFixed(1)}`).reverse().concat([`${x(lastPt.ts)},${y(lastPt.value)}`]);
    band = `<polygon points="${upper.concat(lower).join(' ')}" fill="${colour}" opacity="0.13"/>`;
    projLine = `<polyline points="${[`${x(lastPt.ts)},${y(lastPt.value)}`].concat(pts.map((p) => `${x(at(p.months)).toFixed(1)},${y(p[key]).toFixed(1)}`)).join(' ')}"
      fill="none" stroke="${colour}" stroke-width="2" stroke-dasharray="4 4" opacity="0.75"/>`;
  }

  const ticks = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15]
    .map((v) => `<text x="2" y="${(y(v) + 3).toFixed(1)}" class="ct">${v.toFixed(1)}</text>
                 <line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${w - padR}" y2="${y(v).toFixed(1)}" class="grid"/>`)
    .join('');

  const nowX = x(Date.now());
  return `<svg class="chart tall" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
    ${ticks}
    ${band}
    <line x1="${nowX.toFixed(1)}" y1="${padT}" x2="${nowX.toFixed(1)}" y2="${h - padB}" class="nowline"/>
    ${projLine}
    <polyline points="${line}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}
    <text x="${padL}" y="${h - 6}" class="ct">${new Date(t0).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</text>
    <text x="${w - padR}" y="${h - 6}" text-anchor="end" class="ct">${horizon ? `+${horizon}m` : 'now'}</text>
  </svg>`;
}

/* ---------------- volume ---------------- */

function volumeBars(sessions, periodId) {
  const p = pe.periodDef(periodId);
  const days = p.days || Math.max(14, Math.ceil((Date.now() - (sessions[0]?.ts || Date.now())) / 864e5));
  const byWeek = days > 45;
  const buckets = new Map();

  const keyFor = (ts) => {
    const d = new Date(ts);
    if (!byWeek) return store.dayKey(d);
    const dow = (d.getDay() + 6) % 7;
    return store.addDays(store.dayKey(d), -dow);
  };

  const count = byWeek ? Math.ceil(days / 7) : days;
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * (byWeek ? 7 : 1) * 864e5);
    buckets.set(keyFor(d.getTime()), {});
  }
  for (const s of sessions) {
    const k = keyFor(s.ts);
    if (!buckets.has(k)) continue;
    const b = buckets.get(k);
    b[s.type] = (b[s.type] || 0) + s.durationSec * 1000;
  }

  const bars = [...buckets.entries()].map(([k, types]) => {
    const total = Object.values(types).reduce((a, b) => a + b, 0);
    return {
      label: byWeek ? `week of ${k}` : relDay(k),
      short: byWeek ? k.slice(8) : k.slice(8),
      value: total,
      text: fmtHours(total),
      parts: Object.entries(types).map(([t, v]) => ({ value: v, colour: pe.typeDef(t).colour, label: pe.typeDef(t).label })),
    };
  });
  return barChart(bars, { h: 130 });
}

/* ---------------- screen ---------------- */

export function renderStats(mount) {
  const state = store.get();
  const s = state.pe;
  const sessions = s.sessions.slice().sort((a, b) => a.ts - b.ts);
  const inPeriod = pe.inPeriod(sessions, period);
  const vol = pe.volumeByType(inPeriod);
  const proj = pe.projection();
  const ms = s.measurements;
  const insights = pe.insights();

  const lifetime = sessions.reduce((a, x) => a + x.durationSec * 1000, 0);
  const pumps = inPeriod.filter((x) => x.type === 'pump');
  const avgPressure = pumps.filter((x) => x.pressure).length
    ? pumps.filter((x) => x.pressure).reduce((a, x) => a + x.pressure, 0) / pumps.filter((x) => x.pressure).length
    : null;
  const avgHydro = pumps.filter((x) => x.hydroLevel).length
    ? pumps.filter((x) => x.hydroLevel).reduce((a, x) => a + x.hydroLevel, 0) / pumps.filter((x) => x.hydroLevel).length
    : null;

  const paired = sessions.filter((x) => x.bpfslBefore && x.bpfslAfter).slice(-12);

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="pe" aria-label="Back">←</button>
        <h1>Progress</h1>
        <button class="icon-btn" data-nav="pe-gallery" aria-label="Gallery">▤</button>
      </header>

      ${segmented('period', pe.PERIODS, period)}

      <div class="stat-grid four">
        <div class="stat"><b>${ms.length ? pe.fmtLength(ms[ms.length - 1].bpel) : '—'}</b><span>BPEL now</span></div>
        <div class="stat"><b>${ms.length ? pe.fmtLength(ms[ms.length - 1].eg) : '—'}</b><span>girth now</span></div>
        <div class="stat"><b>${fmtHours(vol.stretch || 0)}</b><span>stretch this period</span></div>
        <div class="stat"><b>${fmtHours(vol.pump || 0)}</b><span>pump this period</span></div>
        <div class="stat"><b>${pe.peStreak()}</b><span>day streak</span></div>
        <div class="stat"><b>${inPeriod.length}</b><span>sessions</span></div>
        <div class="stat"><b>${fmtHours(lifetime)}</b><span>lifetime</span></div>
        <div class="stat"><b>${ms.length}</b><span>check-ins</span></div>
      </div>

      <section class="card">
        <h2>Length</h2>
        <p class="small muted">Bone-pressed erect length. Solid is measured; dashed is projected, and the shaded band is how uncertain that projection is.</p>
        ${sizeChart(ms.filter((m) => m.bpel).map((m) => ({ ts: m.ts, value: m.bpel })), proj, 'var(--accent)', 'bpel')}
      </section>

      <section class="card">
        <h2>Girth</h2>
        ${sizeChart(ms.filter((m) => m.eg).map((m) => ({ ts: m.ts, value: m.eg })), proj, 'var(--violet)', 'eg')}
      </section>

      ${proj ? `<section class="card projection">
        <h2>Projected growth</h2>
        <div class="proj-rows">
          ${proj.points.map((p) => `<div class="proj-row">
            <span>${p.months}m</span>
            <b>${pe.fmtLength(p.bpel)}</b>
            <i>${pe.fmtLength(p.bpelLow, undefined, 1)} – ${pe.fmtLength(p.bpelHigh, undefined, 1)}</i>
          </div>`).join('')}
        </div>
        <div class="conf"><span>Confidence</span><div class="conf-bar"><i style="width:${(proj.confidence * 100).toFixed(0)}%"></i></div><span>${(proj.confidence * 100).toFixed(0)}%</span></div>
        <p class="small muted">Based on ${escapeHtml(proj.basis)}, at your current ${proj.weeklyStretch.toFixed(0)} min/week of stretching and ${proj.weeklyPump.toFixed(0)} min/week of pumping. Change the volume and this changes with it.</p>
        <p class="fineprint">Rate used: ${(proj.lengthRate * 10).toFixed(1)} mm/month length, ${(proj.girthRate * 10).toFixed(1)} mm/month girth. Published traction trials average roughly 1.5 cm over 3-6 months, and gains front-load into the early months — a projection that promised a straight line forever would be lying.</p>
      </section>` : ''}

      <section class="card">
        <h2>Training volume</h2>
        <div class="legend">${Object.entries(vol).map(([t, v]) => `<i style="background:${pe.typeDef(t).colour}"></i> ${escapeHtml(pe.typeDef(t).label)} ${fmtHours(v)}`).join(' ')}</div>
        ${volumeBars(inPeriod, period)}
      </section>

      <section class="card">
        <h2>Pumping</h2>
        <div class="kv"><span>Sessions</span><b>${pumps.length}</b></div>
        <div class="kv"><span>Total time</span><b>${fmtHours(vol.pump || 0)}</b></div>
        ${avgPressure ? `<div class="kv"><span>Average pressure</span><b>${pe.fmtPressure(avgPressure)} · ${escapeHtml(pe.pressureBand(avgPressure).label)}</b></div>` : ''}
        ${avgHydro ? `<div class="kv"><span>Average intensity</span><b>Level ${avgHydro.toFixed(1)} / 5</b></div>` : ''}
        <div class="kv"><span>Kegel cycles logged</span><b>${inPeriod.reduce((a, x) => a + (x.kegelCycles || 0), 0)}</b></div>
      </section>

      <section class="card">
        <h2>Before / after BPFSL</h2>
        <p class="small muted">Each pair is one session. The gap between the bars is the tissue's response to that session — around 5% is what you are after.</p>
        ${paired.length ? `<div class="paired">${paired
          .map((x) => {
            const max = Math.max(...paired.map((p) => p.bpfslAfter)) * 1.05;
            return `<div class="pair" title="${escapeHtml(relDay(x.date))}">
              <i class="before" style="height:${(x.bpfslBefore / max) * 100}%"></i>
              <i class="after" style="height:${(x.bpfslAfter / max) * 100}%"></i>
            </div>`;
          })
          .join('')}</div>
          <div class="legend"><i class="before-key"></i> before <i class="after-key"></i> after</div>`
          : '<div class="chart-empty">Log BPFSL before and after a stretch session to fill this in</div>'}
      </section>

      ${paired.length > 1 ? `<section class="card">
        <h2>Session response over time</h2>
        <p class="small muted">Percentage stretch gained per session. A falling line means the tissue is adapting, or that you are tired.</p>
        ${lineChart(paired.map((x) => ((x.bpfslAfter - x.bpfslBefore) / x.bpfslBefore) * 100), { color: 'var(--good)' })}
      </section>` : ''}

      ${insights.length ? `<section class="card">
        <h2>What the data says</h2>
        ${insights.map((i) => `<div class="insight ${i.level}">${escapeHtml(i.text)}</div>`).join('')}
      </section>` : ''}

      <section class="card">
        <h2>Achievements</h2>
        <div class="badges">
          ${pe.ACHIEVEMENTS.map((a) => {
            const has = s.achievements.includes(a.id);
            return `<div class="badge ${has ? 'has' : ''}" title="${escapeHtml(a.desc)}"><b>${has ? '🏅' : '🔒'}</b><span>${escapeHtml(a.name)}</span></div>`;
          }).join('')}
        </div>
      </section>

      <section class="card">
        <h2>Session log</h2>
        ${sessions.length ? sessions.slice().reverse().slice(0, 80).map(logRow).join('') : '<p class="muted small">Nothing logged yet.</p>'}
      </section>

      <section class="card">
        <h2>Measurement history</h2>
        ${ms.length ? ms.slice().reverse().map((m) => `<div class="kv">
          <span>${new Date(m.ts).toLocaleDateString()}</span>
          <b>${pe.fmtLength(m.bpel)} × ${pe.fmtLength(m.eg)}${m.photoId ? ' 🔒' : ''}</b>
        </div>`).join('') : '<p class="muted small">No check-ins yet.</p>'}
      </section>
    </div>`;

  onSegment(mount, 'period', (v) => {
    period = v;
    renderStats(mount);
  });
}

function logRow(x) {
  const d = pe.typeDef(x.type);
  const detail = [
    x.tensionKg ? `${x.tensionKg} kg` : null,
    x.pressure ? pe.fmtPressure(x.pressure) : null,
    x.hydroLevel ? `level ${x.hydroLevel}` : null,
    x.strokes ? `${x.strokes} strokes` : null,
    x.kegelCycles ? `${x.kegelCycles} kegels` : null,
  ].filter(Boolean).join(' · ');

  return `<details class="log-row">
    <summary>
      <span class="log-date">${relDay(x.date)}</span>
      <span class="log-label" style="color:${d.colour}">${d.icon} ${escapeHtml(d.label)}</span>
      <span class="log-score">${fmtClock(x.durationSec * 1000)}</span>
    </summary>
    <div class="log-body">
      ${detail ? `<div class="kv"><span>Settings</span><b>${escapeHtml(detail)}</b></div>` : ''}
      ${x.bpfslBefore ? `<div class="kv"><span>BPFSL</span><b>${pe.fmtLength(x.bpfslBefore)} → ${pe.fmtLength(x.bpfslAfter)}</b></div>` : ''}
      <div class="kv"><span>Planned</span><b>${Math.round((x.plannedSec || 0) / 60)} min</b></div>
      ${x.quality ? `<div class="kv"><span>Felt</span><b>${escapeHtml(x.quality)}</b></div>` : ''}
      ${x.discomfort ? '<div class="kv warnrow"><span>Flagged</span><b>discomfort</b></div>' : ''}
      ${x.notes ? `<div class="kv"><span>Notes</span><b class="note-text">${escapeHtml(x.notes)}</b></div>` : ''}
    </div>
  </details>`;
}
