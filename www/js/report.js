// The end-of-session debrief.
//
// The rule here: never say anything generic. Every line is derived from what
// actually happened in the session that just finished, compared against this
// user's own history. Motivation that cites your numbers back to you survives
// contact with a bad day; "Great job!!" does not.

import * as store from './store.js';
import * as program from './program.js';
import { fmtMs, fmtDuration, repBars, ringSvg, escapeHtml } from './ui.js';

const s = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function delta(now, before, fmt = (v) => String(Math.round(v))) {
  if (!before) return null;
  const diff = now - before;
  if (Math.abs(diff) < before * 0.02) return { dir: 'flat', text: 'same as last time' };
  return {
    dir: diff > 0 ? 'up' : 'down',
    text: `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))} vs last session`,
  };
}

/** The narrative: what the session physically did, in plain language. */
function whatHappened(record, prior) {
  const t = record.totals;
  const out = [];

  if (record.type === 'release') {
    out.push(
      'No strengthening today, and that was the point. You spent the session lengthening the pelvic floor and syncing it to your breath — on the inhale the diaphragm drops and the floor drops with it.'
    );
    out.push(
      'A muscle that can only clench is not a strong muscle, it is a stiff one. Down-training days are what keep the strength you are building usable, and they protect you from the over-tight floor that catches people who only ever squeeze.'
    );
    return out;
  }

  if (record.type === 'test') {
    const best = t.longestHoldMs;
    const prev = prior?.prsBefore ?? 0;
    out.push(
      `You held for ${fmtMs(best)} before it faded. That number is your honest maximum voluntary contraction — no prescribed target, no pacing, just how long the muscle could actually sustain force today.`
    );
    if (prev && best > prev) out.push(`Last time your ceiling was ${fmtMs(prev)}. It moved. That is measurable strength, not a feeling.`);
    else if (prev) out.push(`Your best remains ${fmtMs(prev)}. Max tests swing with sleep, stress and how recently you trained — one flat test means nothing on its own.`);
    return out;
  }

  const flicks = record.reps.filter((r) => r.kind === 'flick' && r.actualMs > 250).length;
  const holds = record.reps.filter((r) => r.kind === 'hold' && r.actualMs > 250);
  const ramps = record.reps.filter((r) => r.kind === 'ramp' && r.actualMs > 250).length;

  out.push(
    `You put your pelvic floor under load ${s(t.contractions, 'time', 'times')} for a total of ${fmtMs(t.tutMs)} of time under tension, and your longest single hold was ${fmtMs(t.longestHoldMs)}.`
  );

  const parts = [];
  if (flicks) parts.push(`${s(flicks, 'quick flick', 'quick flicks')} hitting the fast-twitch fibres — the ones that fire in a fraction of a second to shut things off when pressure spikes`);
  if (holds.length) parts.push(`${s(holds.length, 'endurance hold', 'endurance holds')} loading the slow-twitch fibres that hold resting tone all day`);
  if (ramps) parts.push(`${s(ramps, 'graded ramp', 'graded ramps')} training control rather than raw force — climbing and descending under command`);
  if (parts.length) out.push(`That broke down as ${parts.join(', and ')}.`);

  if (holds.length >= 3) {
    const half = Math.ceil(holds.length / 2);
    const first = holds.slice(0, half).reduce((a, r) => a + r.actualMs / r.targetMs, 0) / half;
    const second = holds.slice(half).reduce((a, r) => a + r.actualMs / r.targetMs, 0) / (holds.length - half);
    if (second >= first * 0.97) {
      out.push('Your last holds were as strong as your first ones. Holding form to the end of the set is the fatigue resistance that actually shows up in daily life.');
    } else if (second >= first * 0.85) {
      out.push('You faded slightly through the set, which is normal and is exactly the stimulus that builds endurance — the muscle only adapts because it ran short.');
    } else {
      out.push('You dropped off noticeably in the back half of the set. That is real fatigue, not weakness: it means the early reps were genuine. Next time, take the full rest between holds — under-resting is the most common reason sets collapse.');
    }
  }

  out.push(
    'None of this changes anything today. Pelvic floor muscle is skeletal muscle: it responds over weeks, with most people noticing something around week 4 to 6 and the bulk of the change landing between weeks 8 and 12. Today was one deposit into that.'
  );
  return out;
}

/** The closing line. Picked by circumstance, always citing a real number. */
function motivation({ record, outcome, prs, badges }, state) {
  const st = store.streak();
  const total = state.sessions.length;
  if (outcome.levelUp) return `Level ${outcome.from} → ${outcome.to}. You earned that by scoring 80+ on three sessions in a row, which means the last level stopped being hard. The new one will not feel like that for a while — good.`;
  if (prs.length) return `You just set a personal best: ${prs[0].label.toLowerCase()} is now ${prs[0].value}, up from ${prs[0].was}. Records are the receipts.`;
  if (badges.length) return `Unlocked "${badges[0].name}" — ${badges[0].desc.toLowerCase()}.`;
  if (record.discomfort) return 'You flagged discomfort, so the program has stepped itself down for the next few sessions. Backing off on purpose is training, not quitting.';
  if (st >= 7) return `${st} days straight. Consistency is the only variable in this that you fully control, and you are currently winning it.`;
  if (record.type === 'release') return 'Rest is programmed, not permitted. You did today\'s job by not squeezing.';
  if (record.score >= 85) return `${record.score}/100. Two more like that and the program moves you up.`;
  if (record.score < 55) return `Not your best — ${record.score}/100 — but a rough session that got finished still counts more than a perfect one that never started. Session ${total} is in the log.`;
  return `Session ${total} logged. The graph only ever goes up if you keep feeding it days like this one.`;
}

export function renderReport(mount, result, onDone) {
  const { record, outcome, prs, badges, plan } = result;
  const state = store.get();
  // Comparisons are only meaningful against sessions that were actually
  // measured — not against a cadence logged from a pump session.
  const priorSessions = state.sessions.filter(
    (x) => x.id !== record.id && x.type === record.type && x.countsForPromotion !== false
  );
  const prior = priorSessions.length ? priorSessions[priorSessions.length - 1] : null;
  const g = program.grade(record.score);
  const st = store.streak();
  const nextLevel = program.levelDef(state.program.level);

  const avgDelta = prior ? delta(record.totals.avgHoldMs, prior.totals.avgHoldMs, (v) => fmtMs(v)) : null;
  const tutDelta = prior ? delta(record.totals.tutMs, prior.totals.tutMs, (v) => fmtMs(v)) : null;
  const scoreDelta = prior ? delta(record.score, prior.score) : null;

  const isRelease = record.type === 'release';
  const stats = [
    { k: 'Contractions', v: record.totals.contractions },
    { k: 'Time under tension', v: fmtMs(record.totals.tutMs), d: tutDelta },
    { k: 'Longest hold', v: fmtMs(record.totals.longestHoldMs) },
    { k: 'Average hold', v: fmtMs(record.totals.avgHoldMs), d: avgDelta },
  ];

  const workReps = record.reps.filter((r) => r.kind !== 'flick');

  mount.innerHTML = `
    <div class="report">
      <div class="report-hero ${outcome.levelUp ? 'levelup' : ''}">
        ${isRelease
          ? ringSvg(1, '✓', 'released', { color: 'var(--calm)' })
          : ringSvg(record.score / 100, String(record.score), `${g.letter} · ${g.label}`, {
              color: record.score >= 85 ? 'var(--good)' : record.score >= 62 ? 'var(--accent)' : 'var(--warn)',
            })}
        <h1>${isRelease ? 'Release day complete' : record.type === 'test' ? 'Max hold test complete' : 'Session complete'}</h1>
        <p class="muted">Level ${record.level} · ${escapeHtml(plan.def.name)} · ${fmtDuration(record.durationSec)}${record.quit ? ' · ended early' : ''}${record.estimated ? ' · estimated from your rating' : ''}</p>
        ${!isRelease && scoreDelta ? `<p class="hero-delta ${scoreDelta.dir}">${scoreDelta.text}</p>` : ''}
        ${outcome.levelUp ? `<div class="levelup-banner">LEVEL UP → ${outcome.to}</div>` : ''}
      </div>

      ${!isRelease ? `<div class="stat-grid">
        ${stats.map((x) => `<div class="stat"><b>${x.v}</b><span>${x.k}</span>${x.d ? `<i class="d ${x.d.dir}">${x.d.text}</i>` : ''}</div>`).join('')}
      </div>` : ''}

      <section class="card">
        <h2>What just happened</h2>
        ${whatHappened(record, { prsBefore: prior?.totals.longestHoldMs }).map((p) => `<p>${p}</p>`).join('')}
      </section>

      ${workReps.length > 1 ? `<section class="card">
        <h2>Your holds, rep by rep</h2>
        <p class="muted small">Each bar is one contraction against its target. Flat is good; a staircase down is fatigue.</p>
        ${repBars(workReps)}
        <div class="legend"><i class="good"></i> on target <i class="ok"></i> close <i class="low"></i> short <i class="miss"></i> missed</div>
      </section>` : ''}

      ${prs.length ? `<section class="card pr">
        <h2>Personal bests</h2>
        ${prs.map((p) => `<div class="pr-row"><b>${escapeHtml(p.label)}</b><span>${escapeHtml(p.was)} → <em>${escapeHtml(p.value)}</em></span></div>`).join('')}
      </section>` : ''}

      ${badges.length ? `<section class="card">
        <h2>Unlocked</h2>
        ${badges.map((b) => `<div class="pr-row"><b>🏅 ${escapeHtml(b.name)}</b><span>${escapeHtml(b.desc)}</span></div>`).join('')}
      </section>` : ''}

      <section class="card">
        <h2>Where this puts you</h2>
        <div class="prog-line">
          <div class="prog-bar"><i style="width:${(outcome.qualifying / program.PROMOTION_TARGET) * 100}%"></i></div>
          <span>${outcome.qualifying} / ${program.PROMOTION_TARGET} sessions toward level ${Math.min(state.program.level + 1, program.MAX_LEVEL)}</span>
        </div>
        <p class="small muted">Sessions count toward promotion when you score 80+ and complete every rep.${state.program.deload > 0 ? ` Reduced targets are active for the next ${s(state.program.deload, 'session', 'sessions')}.` : ''}</p>
        <div class="kv"><span>Streak</span><b>${s(st, 'day', 'days')}</b></div>
        <div class="kv"><span>Pelvic Floor Index</span><b>${program.pfi(state)} <em>${program.pfiBand(program.pfi(state))}</em></b></div>
        <p class="small muted nextup"><b>Next up:</b> level ${state.program.level} — ${escapeHtml(nextLevel.name)}. ${escapeHtml(nextLevel.focus)}</p>
      </section>

      <div class="motivation">${motivation({ record, outcome, prs, badges }, state)}</div>

      <button class="btn primary big" id="reportDone">Done</button>
    </div>`;

  mount.querySelector('#reportDone').addEventListener('click', onDone);
  mount.scrollTop = 0;
}
