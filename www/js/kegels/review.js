// The weekly review: last seven days against the seven before them.
//
// Daily numbers are mostly noise, one bad session says nothing. A week is the
// shortest window where the comparison means something, so this is the one
// place the app is allowed to say "better" or "worse" out loud. Everything on
// it is a difference, not a total; totals are what the tracking screen is for.

import * as store from '../store.js';
import * as program from './program.js';
import * as pe from '../pe/program.js';
import { escapeHtml, fmtMs, fmtHours, sparkline } from '../ui.js';
import { icon } from '../icons.js';

/** Monday of the week a given day falls in. Used both to slice the data and to
 *  decide whether this week's review has already been seen. */
export function weekStart(key = store.dayKey()) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return store.addDays(key, -((dt.getDay() + 6) % 7));
}

/** True when a new week has begun and this week's review has not been opened.
 *  A review of a week with nothing in it is not worth interrupting for. */
export function reviewDue(state = store.get()) {
  if (state.settings.weeklyReviewSeen === weekStart()) return false;
  return state.sessions.some((s) => s.ts >= Date.now() - 14 * 864e5);
}

function windowMs(daysAgoFrom, daysAgoTo) {
  const now = Date.now();
  return { from: now - daysAgoFrom * 864e5, to: now - daysAgoTo * 864e5 };
}

/** Everything the review needs, for one seven-day window. */
function summarise(sessions, { from, to }) {
  const inWin = sessions.filter((s) => s.ts >= from && s.ts < to && s.type !== 'release');
  const scored = inWin.filter((s) => s.countsForPromotion !== false);
  const days = new Set(inWin.map((s) => s.date)).size;
  const tut = inWin.reduce((a, s) => a + (s.totals?.tutMs || 0), 0);
  const contractions = inWin.reduce((a, s) => a + (s.totals?.contractions || 0), 0);
  const best = inWin.reduce((a, s) => Math.max(a, s.totals?.longestHoldMs || 0), 0);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;
  return { sessions: inWin.length, days, tut, contractions, best, avg, scores: scored.map((s) => s.score) };
}

const delta = (now, then, fmt = (v) => String(v), { good = 'up' } = {}) => {
  if (then == null || now == null) return '';
  const d = now - then;
  if (Math.abs(d) < 1e-9) return '<i class="dl flat">no change</i>';
  const better = good === 'up' ? d > 0 : d < 0;
  return `<i class="dl ${better ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${escapeHtml(fmt(Math.abs(d)))}</i>`;
};

/** The one sentence worth reading. Picks the largest real change and says what
 *  to do about it, rather than listing everything that moved. */
function verdict(now, prev, state) {
  if (!now.sessions) return { level: 'warn', text: 'Nothing logged this week. One session today restarts everything. The plan does not punish a gap, it just waits.' };
  if (!prev.sessions) return { level: 'good', text: `${now.sessions} session${now.sessions === 1 ? '' : 's'} across ${now.days} day${now.days === 1 ? '' : 's'}. That is your baseline. Next week has something to beat.` };

  const dSessions = now.sessions - prev.sessions;
  const dAvg = now.avg != null && prev.avg != null ? now.avg - prev.avg : 0;

  if (dSessions <= -3) return { level: 'warn', text: `${Math.abs(dSessions)} fewer sessions than last week. Consistency is the whole mechanism. Drop the daily target to one rather than missing days entirely.` };
  if (dAvg <= -8) return { level: 'warn', text: `Your average score fell ${Math.abs(dAvg)} points. That is usually under-resting: rest at least as long as you hold, or the reps at the end of a set are worthless.` };
  if (dSessions >= 3 && dAvg >= 0) return { level: 'good', text: `${dSessions} more sessions than last week and the quality held. That is exactly how promotion is meant to happen.` };
  if (dAvg >= 8) return { level: 'good', text: `Average score up ${dAvg} points. The holds are landing on target. ${state.program.qualifying}/${program.PROMOTION_TARGET} banked towards week ${Math.min(state.program.level + 1, program.MAX_LEVEL)}.` };
  if (now.days >= 6) return { level: 'good', text: `${now.days} days out of seven. Steady is the goal; nothing here needs changing.` };
  return { level: 'info', text: `${now.sessions} sessions across ${now.days} days, about the same as last week. One more day a week is the smallest change that would move things.` };
}

export function renderReview(mount) {
  const state = store.get();
  const now = summarise(state.sessions, windowMs(7, 0));
  const prev = summarise(state.sessions, windowMs(14, 7));
  const v = verdict(now, prev, state);

  const peNow = state.pe.sessions.filter((s) => s.ts >= Date.now() - 7 * 864e5);
  const pePrev = state.pe.sessions.filter((s) => s.ts >= Date.now() - 14 * 864e5 && s.ts < Date.now() - 7 * 864e5);
  const peNowMs = peNow.reduce((a, s) => a + s.durationSec * 1000, 0);
  const pePrevMs = pePrev.reduce((a, s) => a + s.durationSec * 1000, 0);
  const goalWeek = pe.DAILY_STRETCH_GOAL_MS * 7;

  const levelUps = state.program.history.filter((h) => h.at >= Date.now() - 7 * 864e5);

  // Mark it read the moment it is opened, so the prompt does not reappear.
  store.update((st) => {
    st.settings.weeklyReviewSeen = weekStart();
  });

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-nav="kegels" aria-label="Back">${icon('back')}</button>
        <h1>Your week</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="notice ${v.level === 'good' ? 'good' : v.level === 'warn' ? 'warn' : ''}">${escapeHtml(v.text)}</div>

      ${levelUps.length ? `<div class="notice good">${icon('medal', 16)} Moved up to week ${levelUps[levelUps.length - 1].level} this week.</div>` : ''}

      <section class="card">
        <div class="h-row">${icon('target', 16)}<h2>Kegels · this week vs last</h2></div>
        <div class="cmp-row"><span>Sessions</span><b>${now.sessions}</b>${delta(now.sessions, prev.sessions)}</div>
        <div class="cmp-row"><span>Days trained</span><b>${now.days}/7</b>${delta(now.days, prev.days)}</div>
        <div class="cmp-row"><span>Average score</span><b>${now.avg ?? '-'}</b>${delta(now.avg, prev.avg)}</div>
        <div class="cmp-row"><span>Time under tension</span><b>${fmtMs(now.tut)}</b>${delta(now.tut, prev.tut, fmtMs)}</div>
        <div class="cmp-row"><span>Contractions</span><b>${now.contractions}</b>${delta(now.contractions, prev.contractions)}</div>
        <div class="cmp-row"><span>Best hold</span><b>${fmtMs(now.best)}</b>${delta(now.best, prev.best, fmtMs)}</div>
        ${now.scores.length > 1 ? sparkline(now.scores, { color: 'var(--accent)', h: 44 }) : ''}
      </section>

      ${state.pe.sessions.length ? `<section class="card">
        <div class="h-row">${icon('stretch', 16)}<h2>PE · this week vs last</h2></div>
        <div class="cmp-row"><span>Total time</span><b>${fmtHours(peNowMs)}</b>${delta(peNowMs, pePrevMs, fmtHours)}</div>
        <div class="cmp-row"><span>Sessions</span><b>${peNow.length}</b>${delta(peNow.length, pePrev.length)}</div>
        <div class="cmp-row"><span>Of the weekly target</span><b>${Math.round((peNow.filter((s) => s.type === 'stretch').reduce((a, s) => a + s.durationSec * 1000, 0) / goalWeek) * 100)}%</b></div>
        <p class="fineprint">Target is two hours a day, 14 across a full week.</p>
      </section>` : ''}

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Where you are</h2></div>
        <div class="kv"><span>Week of the plan</span><b>${state.program.level} of ${program.TOTAL_WEEKS}</b></div>
        <div class="kv"><span>Phase</span><b>${escapeHtml(program.levelDef(state.program.level).name)}</b></div>
        <div class="kv"><span>Toward the next week</span><b>${state.program.qualifying}/${program.PROMOTION_TARGET} sessions${program.daysUntilEligible(state) ? ` · ${program.daysUntilEligible(state)}d served` : ''}</b></div>
        <div class="kv"><span>Streak</span><b>${store.streak()} days</b></div>
      </section>

      <div class="linkrow">
        <a href="#/roadmap">${icon('route')} The plan</a>
        <a href="#/track">${icon('chart')} All tracking</a>
      </div>
    </div>`;
}
