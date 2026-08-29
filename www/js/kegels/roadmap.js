// The 104 weeks and six phases, laid out so the plan visibly does not run out.

import * as store from '../store.js';
import * as program from './program.js';
import { escapeHtml, fmtMs } from '../ui.js';
import { icon } from '../icons.js';

const PHASE_ICON = {
  foundation: 'target',
  control: 'settings',
  strength: 'flash',
  endurance: 'timer',
  power: 'flame',
  mastery: 'medal',
};

/** Ranges are drawn between working weeks: including the deload makes a phase
 *  read as if it gets easier. */
function hardWeeks(from, to) {
  const weeks = [];
  for (let n = from; n <= to; n++) {
    const l = program.levelDef(n);
    if (!l.deloadWeek) weeks.push(l);
  }
  return weeks.length ? weeks : [program.levelDef(from), program.levelDef(to)];
}

/** Real pace is the slower of the qualifying sessions and the days served. */
function pace(state) {
  const hist = state.program.history;
  if (hist.length < 2) return null;
  const first = hist[0].at;
  const last = hist[hist.length - 1].at;
  const levelsGained = state.program.level - hist[0].level;
  if (levelsGained < 1 || last <= first) return null;
  return (last - first) / 864e5 / levelsGained; // days per level
}

export function renderRoadmap(mount) {
  const state = store.get();
  const level = state.program.level;
  const def = program.levelDef(level);
  const daysLeft = program.daysUntilEligible(state);
  const perLevel = pace(state);

  const pct = Math.round((level / program.TOTAL_WEEKS) * 100);
  const allHard = hardWeeks(1, program.TOTAL_WEEKS);
  const peak = allHard[allHard.length - 1];

  mount.innerHTML = `
    <div class="screen">
      <header class="screen-head">
        <button class="icon-btn" data-back="kegels" aria-label="Back">${icon('back')}</button>
        <h1>The plan</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="today">
        <div class="today-left">
          <h2>Week ${level} of ${program.TOTAL_WEEKS}</h2>
          <p class="muted small">${escapeHtml(def.name)}${perLevel ? ` · ${perLevel.toFixed(0)} days a level so far` : ''}</p>
        </div>
      </div>

      <div class="road-bar"><i style="width:${Math.max(1, pct)}%"></i></div>

      <section class="card">
        <div class="h-row">${icon('target', 16)}<h2>Right now</h2></div>
        <div class="kv"><span>Position</span><b>${escapeHtml(def.position)}</b></div>
        <div class="kv"><span>Quick flicks</span><b>${def.flicks.reps} × 1s</b></div>
        <div class="kv"><span>Holds</span><b>${def.holds.reps} × ${(def.holds.holdMs / 1000).toFixed(0)}s</b></div>
        ${def.ramps ? `<div class="kv"><span>Ramps</span><b>${def.ramps.reps} × ${(def.ramps.holdMs / 1000).toFixed(0)}s</b></div>` : ''}
        ${def.pulses ? `<div class="kv"><span>Pulses</span><b>${def.pulses.sets} × ${def.pulses.reps}</b></div>` : ''}
        <div class="kv"><span>To promote</span><b>${state.program.qualifying}/${program.PROMOTION_TARGET} good sessions${daysLeft ? ` · ${daysLeft}d served` : ' · time served'}</b></div>
        ${def.deloadWeek ? '<p class="fineprint">A deload week. Every fourth one is deliberately lighter. Easy weeks are where the adaptation lands.</p>' : ''}
      </section>

      <section class="card">
        <div class="h-row">${icon('route', 16)}<h2>Six phases, two years</h2></div>
        <div class="phase-list">
          ${program.PHASES.map((p) => {
            const state_ = level > p.to ? 'done' : level >= p.from ? 'on' : 'todo';
            const hard = hardWeeks(p.from, p.to);
            const startLvl = hard[0];
            const endLvl = hard[hard.length - 1];
            const eta = state_ === 'todo' && perLevel ? Math.round(((p.from - level) * perLevel) / 7) : null;
            return `<div class="phase ${state_}">
              <div class="phase-head">
                <span class="phase-ico">${icon(PHASE_ICON[p.id] || 'target', 18)}</span>
                <div>
                  <b>${escapeHtml(p.name)}</b>
                  <i>weeks ${p.from}–${p.to}</i>
                </div>
                ${state_ === 'done' ? `<span class="phase-tag">${icon('check', 14)}</span>` : state_ === 'on' ? '<span class="phase-tag on">here</span>' : eta ? `<span class="phase-tag">~${eta}w away</span>` : ''}
              </div>
              <p class="small muted">${escapeHtml(p.position)}. ${escapeHtml(p.focus)}</p>
              <div class="phase-nums">
                <span>holds ${(startLvl.holds.holdMs / 1000).toFixed(0)}s → ${(endLvl.holds.holdMs / 1000).toFixed(0)}s</span>
                <span>reps ${startLvl.holds.reps} → ${endLvl.holds.reps}</span>
                <span>flicks ${startLvl.flicks.reps} → ${endLvl.flicks.reps}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <section class="card">
        <div class="h-row">${icon('trend', 16)}<h2>What gets harder</h2></div>
        <p class="small muted">Five things grow at once, so the plan never has to lean on any one of them: hold length (3s → 20s), holds per session (8 → 20), flicks (10 → 30), ramps from week 13, and rapid pulse sets from week 49. Position climbs lying → seated → standing → mid-activity. Every fourth week is a deload.</p>
        <div class="kv"><span>Your best hold</span><b>${fmtMs(state.prs.maxHoldMs)}</b></div>
        <div class="kv"><span>The last working week asks for</span><b>${(peak.holds.holdMs / 1000).toFixed(0)}s × ${peak.holds.reps}</b></div>
      </section>

      <section class="card">
        <div class="h-row">${icon('calendar', 16)}<h2>Every week</h2></div>
        <div class="week-list">
          ${program.LEVELS.map((l) => `<div class="week-row ${l.n === level ? 'on' : l.n < level ? 'done' : ''}">
            <span class="wk">${l.n}</span>
            <b>${escapeHtml(l.name)}</b>
            <i>${l.holds.reps}×${(l.holds.holdMs / 1000).toFixed(0)}s · ${l.flicks.reps} flicks${l.ramps ? ` · ${l.ramps.reps} ramps` : ''}${l.pulses ? ` · ${l.pulses.sets}×${l.pulses.reps} pulses` : ''}</i>
          </div>`).join('')}
        </div>
      </section>
    </div>`;

  mount.querySelector('.week-row.on')?.scrollIntoView({ block: 'center' });
}
