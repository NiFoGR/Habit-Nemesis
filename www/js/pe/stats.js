// The numbers: size over time with a projection, volume, BPFSL response,
// insights, feats, session log.

import * as store from '../store.js';
import * as pe from './program.js';
import { escapeHtml, fmtHours, fmtClock, segmented, onSegment, barChart, relDay, lineChart, multiLine, scatter } from '../ui.js';
import { icon } from '../icons.js';
import * as feats from '../arena/feats.js';

let period = '30d';

/* ---------------- size chart with projection ---------------- */

/** History solid, projection dashed inside a band. The band is wide while the
 *  app is guessing and narrows as measurements accumulate. */
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

function peFeats() {
  const sec = feats.bySection().find((x) => x.section === 'PE');
  return sec ? `${sec.earned} of ${sec.items.length}` : '—';
}

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
  const corr = pe.volumeVsGain('bpel');
  const girth = pe.girthMap();

  const paired = sessions.filter((x) => x.bpfslBefore && x.bpfslAfter).slice(-12);

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="pe" aria-label="Back">${icon('back')}</button>
        <h1>Progress</h1>
        <button class="icon-btn" data-nav="pe-gallery" aria-label="Gallery">${icon('images')}</button>
      </header>

      ${segmented('period', pe.PERIODS, period)}

      <div class="stat-grid four">
        <div class="stat"><b>${ms.length ? pe.fmtLength(ms[ms.length - 1].bpel) : '-'}</b><span>BPEL now</span></div>
        <div class="stat"><b>${ms.length ? pe.fmtLength(ms[ms.length - 1].eg) : '-'}</b><span>girth now</span></div>
        <div class="stat"><b>${fmtHours(vol.stretch || 0)}</b><span>stretch this period</span></div>
        <div class="stat"><b>${fmtHours(vol.pump || 0)}</b><span>pump this period</span></div>
        <div class="stat"><b>${pe.peStreak()}</b><span>day streak</span></div>
        <div class="stat"><b>${inPeriod.length}</b><span>sessions</span></div>
        <div class="stat"><b>${fmtHours(lifetime)}</b><span>lifetime</span></div>
        <div class="stat"><b>${ms.length}</b><span>check-ins</span></div>
      </div>

      <section class="card">
        <div class="h-row">${icon('stretch', 16)}<h2>Length</h2></div>
        ${sizeChart(ms.filter((m) => m.bpel).map((m) => ({ ts: m.ts, value: m.bpel })), proj, 'var(--accent)', 'bpel')}
      </section>

      <section class="card">
        <div class="h-row">${icon('pump', 16)}<h2>Girth</h2></div>
        ${sizeChart(ms.filter((m) => m.eg).map((m) => ({ ts: m.ts, value: m.eg })), proj, 'var(--accent)', 'eg')}
      </section>

      ${proj ? `<section class="card projection">
        <div class="h-row">${icon('trend', 16)}<h2>Projected growth</h2></div>
        <div class="proj-rows">
          ${proj.points.map((p) => `<div class="proj-row">
            <span>${p.months}m</span>
            <b>${pe.fmtLength(p.bpel)}</b>
            <i>${pe.fmtLength(p.bpelLow, undefined, 1)} – ${pe.fmtLength(p.bpelHigh, undefined, 1)}</i>
          </div>`).join('')}
        </div>
        <div class="conf"><span>Confidence</span><div class="conf-bar"><i style="width:${(proj.confidence * 100).toFixed(0)}%"></i></div><span>${(proj.confidence * 100).toFixed(0)}%</span></div>
        <p class="fineprint">${(proj.lengthRate * 10).toFixed(1)} mm/month, from ${escapeHtml(proj.basis)}. Trials average ~1.5 cm over 3–6 months.</p>
      </section>` : ''}

      <section class="card">
        <div class="h-row">${icon('chart', 16)}<h2>Training volume</h2></div>
        <div class="legend">${Object.entries(vol).map(([t, v]) => `<i style="background:${pe.typeDef(t).colour}"></i> ${escapeHtml(pe.typeDef(t).label)} ${fmtHours(v)}`).join(' ')}</div>
        ${volumeBars(inPeriod, period)}
      </section>

      <section class="card">
        <div class="h-row">${icon('trend', 16)}<h2>Do the hours pay?</h2></div>
        ${corr.points.length >= 2
          ? `${scatter(corr.points, { xLabel: 'min/day', yLabel: 'mm/month', color: 'var(--accent)' })}
             <p class="fineprint">${escapeHtml(corr.verdict)}${corr.r != null ? ` (r = ${corr.r.toFixed(2)}, ${corr.points.length} gaps between check-ins)` : ''}</p>`
          : '<div class="chart-empty">Three check-ins a month apart fill this in</div>'}
      </section>

      ${girth ? `<section class="card">
        <div class="h-row">${icon('pump', 16)}<h2>Girth map</h2></div>
        <div class="stat-grid three">
          <div class="stat"><b>${pe.fmtLength(girth.thick)}</b><span>thickest</span></div>
          <div class="stat"><b>${pe.fmtLength(girth.base)}</b><span>base</span></div>
          <div class="stat"><b>${girth.taper >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(girth.taper), undefined, 2)}</b><span>thickest − base</span></div>
        </div>
        ${girth.entries.length > 1 ? `${multiLine([
          { colour: 'var(--accent)', points: girth.entries.map((m) => ({ ts: m.ts, value: m.eg })) },
          { colour: 'var(--muted)', dashed: true, points: girth.entries.map((m) => ({ ts: m.ts, value: m.baseGirth })) },
        ])}
        <div class="legend"><i style="background:var(--accent)"></i> thickest <i style="background:var(--muted)"></i> base</div>
        <p class="fineprint">Thickest ${girth.thickGain >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(girth.thickGain), undefined, 2)}, base ${girth.baseGain >= 0 ? '+' : '−'}${pe.fmtLength(Math.abs(girth.baseGain), undefined, 2)}. ${
          girth.taper > girth.taperFirst + 0.15
            ? 'The middle is growing faster than the base. Normal with pumping, worth watching if the gap widens.'
            : girth.taper < girth.taperFirst - 0.15
              ? 'The base is catching up with the middle. That is the more even shape.'
              : 'The two are moving together, which is the shape you want.'
        }</p>` : ''}
      </section>` : ''}

      <section class="card">
        <div class="h-row">${icon('pump', 16)}<h2>Pumping</h2></div>
        <div class="kv"><span>Sessions</span><b>${pumps.length}</b></div>
        <div class="kv"><span>Total time</span><b>${fmtHours(vol.pump || 0)}</b></div>
        <div class="kv"><span>Kegel cycles logged</span><b>${inPeriod.reduce((a, x) => a + (x.kegelCycles || 0), 0)}</b></div>
      </section>

      <section class="card">
        <div class="h-row">${icon('ruler', 16)}<h2>Before / after BPFSL</h2></div>
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
        <div class="h-row">${icon('trend', 16)}<h2>Session response over time</h2></div>
        ${lineChart(paired.map((x) => ((x.bpfslAfter - x.bpfslBefore) / x.bpfslBefore) * 100), { color: 'var(--good)' })}
      </section>` : ''}

      ${s.eq.length > 1 ? `<section class="card">
        <div class="h-row">${icon('droplet', 16)}<h2>Erection quality</h2></div>
        ${lineChart(pe.inPeriod(s.eq, period).map((e) => e.v), { color: 'var(--good)' })}
        <p class="fineprint">Weekly self-rating, 1–10. The outcome that actually matters. Watch it against volume.</p>
      </section>` : ''}

      ${insights.length ? `<section class="card">
        <div class="h-row">${icon('help', 16)}<h2>What the data says</h2></div>
        ${insights.map((i) => `<div class="insight ${i.level}">${escapeHtml(i.text)}</div>`).join('')}
      </section>` : ''}

      <section class="card">
        <div class="h-row">${icon('medal', 16)}<h2>Feats</h2></div>
        <div class="kv"><span>PE feats earned</span><b>${peFeats()}</b></div>
        <a class="btn ghost wide" href="#/arena/feats">${icon('medal', 16)}<span>All feats</span></a>
      </section>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Session log</h2></div>
        ${sessions.length ? sessions.slice().reverse().slice(0, 80).map(logRow).join('') : '<p class="muted small">Nothing logged yet.</p>'}
      </section>

      <section class="card">
        <div class="h-row">${icon('ruler', 16)}<h2>Measurement history</h2></div>
        ${ms.length ? ms.slice().reverse().map((m) => `<div class="kv">
          <span>${relDay(m.date)}</span>
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
  // pressure and hydroLevel only appear on sessions from an older build.
  const detail = [
    x.tensionKg ? `${x.tensionKg} kg` : null,
    x.pressure ? `${x.pressure.toFixed(1)} inHg` : null,
    x.hydroLevel ? `level ${x.hydroLevel}` : null,
    x.kegelCycles ? `${x.kegelCycles} kegels` : null,
  ].filter(Boolean).join(' · ');

  return `<details class="log-row">
    <summary>
      <span class="log-date">${relDay(x.date)}</span>
      <span class="log-label" style="color:${d.colour}">${icon(d.icon, 14)} ${escapeHtml(d.label)}</span>
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
