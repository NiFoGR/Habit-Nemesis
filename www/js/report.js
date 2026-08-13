// End-of-session result. Numbers first, one line of context, done.

import * as store from './store.js';
import * as program from './program.js';
import { fmtMs, fmtDuration, repBars, ringSvg, escapeHtml } from './ui.js';

function delta(now, before, fmt = (v) => String(Math.round(v))) {
  if (!before) return null;
  const diff = now - before;
  if (Math.abs(diff) < before * 0.02) return { dir: 'flat', text: 'same' };
  return { dir: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}` };
}

/** One line, picked by what actually happened. */
function line({ record, outcome, prs, badges }, state) {
  const st = store.streak();
  if (outcome.levelUp) return `Level ${outcome.from} → ${outcome.to}.`;
  if (prs.length) return `New best: ${prs[0].label.toLowerCase()} ${prs[0].value}, was ${prs[0].was}.`;
  if (badges.length) return `Unlocked: ${badges[0].name}.`;
  if (record.discomfort) return 'Targets dropped for the next few sessions.';
  if (record.type === 'release') return 'Rest day done.';
  if (record.type === 'quick') return 'Short one, but the streak holds.';
  if (st >= 7) return `${st} days straight.`;
  if (record.score >= 85) return `${program.PROMOTION_TARGET - outcome.qualifying} more like that to level up.`;
  if (record.score < 55) return 'Rough one. Still logged.';
  return `Session ${state.sessions.length}.`;
}

/** Fatigue read from the user's own holds — the one thing worth explaining. */
function fatigueNote(record) {
  const holds = record.reps.filter((r) => r.kind === 'hold' && r.actualMs > 250);
  if (holds.length < 3) return null;
  const half = Math.ceil(holds.length / 2);
  const first = holds.slice(0, half).reduce((a, r) => a + r.actualMs / r.targetMs, 0) / half;
  const second = holds.slice(half).reduce((a, r) => a + r.actualMs / r.targetMs, 0) / (holds.length - half);
  if (second >= first * 0.97) return 'Held form to the end.';
  if (second >= first * 0.85) return 'Slight fade late — normal.';
  return 'Big drop-off late. Take the full rest between holds.';
}

export function renderReport(mount, result, onDone) {
  const { record, outcome, prs, badges, plan } = result;
  const state = store.get();
  const priorSessions = state.sessions.filter(
    (x) => x.id !== record.id && x.type === record.type && x.countsForPromotion !== false
  );
  const prior = priorSessions.length ? priorSessions[priorSessions.length - 1] : null;
  const g = program.grade(record.score);
  const isRelease = record.type === 'release';
  const avgDelta = prior ? delta(record.totals.avgHoldMs, prior.totals.avgHoldMs, (v) => fmtMs(v)) : null;
  const workReps = record.reps.filter((r) => r.kind !== 'flick');
  const note = fatigueNote(record);

  mount.innerHTML = `
    <div class="report">
      <div class="report-hero ${outcome.levelUp ? 'levelup' : ''}">
        ${isRelease
          ? ringSvg(1, '✓', 'released', { color: 'var(--calm)' })
          : ringSvg(record.score / 100, String(record.score), g.letter, {
              color: record.score >= 85 ? 'var(--good)' : record.score >= 62 ? 'var(--accent)' : 'var(--warn)',
            })}
        <p class="muted">Level ${record.level} · ${fmtDuration(record.durationSec)}${record.quit ? ' · ended early' : ''}${record.estimated ? ' · estimated' : ''}</p>
        ${outcome.levelUp ? `<div class="levelup-banner">LEVEL ${outcome.to}</div>` : ''}
      </div>

      ${!isRelease ? `<div class="stat-grid">
        <div class="stat"><b>${record.totals.contractions}</b><span>reps</span></div>
        <div class="stat"><b>${fmtMs(record.totals.tutMs)}</b><span>under tension</span></div>
        <div class="stat"><b>${fmtMs(record.totals.longestHoldMs)}</b><span>longest</span></div>
        <div class="stat"><b>${fmtMs(record.totals.avgHoldMs)}</b><span>average</span>${avgDelta ? `<i class="d ${avgDelta.dir}">${avgDelta.text}</i>` : ''}</div>
      </div>` : ''}

      ${workReps.length > 1 ? `<section class="card">
        ${repBars(workReps)}
        ${note ? `<p class="small muted">${escapeHtml(note)}</p>` : ''}
      </section>` : ''}

      ${prs.length ? `<section class="card pr">
        ${prs.map((p) => `<div class="pr-row"><b>${escapeHtml(p.label)}</b><span>${escapeHtml(p.was)} → <em>${escapeHtml(p.value)}</em></span></div>`).join('')}
      </section>` : ''}

      ${badges.length ? `<section class="card">
        ${badges.map((b) => `<div class="pr-row"><b>🏅 ${escapeHtml(b.name)}</b><span>${escapeHtml(b.desc)}</span></div>`).join('')}
      </section>` : ''}

      ${!isRelease && record.type !== 'quick' ? `<div class="prog-line">
        <div class="prog-bar"><i style="width:${(outcome.qualifying / program.PROMOTION_TARGET) * 100}%"></i></div>
        <span>${outcome.qualifying}/${program.PROMOTION_TARGET} to level ${Math.min(state.program.level + 1, program.MAX_LEVEL)}</span>
      </div>` : ''}

      <div class="motivation">${escapeHtml(line({ record, outcome, prs, badges }, state))}</div>

      <button class="btn primary big" id="reportDone">Done</button>
    </div>`;

  mount.querySelector('#reportDone').addEventListener('click', onDone);
  mount.scrollTop = 0;
}
