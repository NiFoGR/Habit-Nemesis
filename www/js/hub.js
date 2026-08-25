// The Today screen: the app's front door.
//
// Two things live here. `FEATURES` is the registry every section tile renders
// from, and `todayTasks` is the list of what is still owed today across all of
// them. Adding a feature means adding an entry to each, and nothing else on
// this screen needs to know about it.

import * as store from './store.js';
import * as program from './kegels/program.js';
import * as peProgram from './pe/program.js';
import * as prayProgram from './pray/program.js';
import * as bibleProgram from './bible/program.js';
import * as breatheProgram from './breathe/program.js';
import { RULES as PRAY_RULES } from './pray/prayers.js';
import { fmtHours, fmtDuration, ringSvg, escapeHtml, sparkline } from './ui.js';
import { icon, logoMark } from './icons.js';
import { kegelName, peName } from './names.js';
import { reviewDue } from './kegels/review.js';

/* ---------------- the feature registry ---------------- */

/** Each feature supplies its own hub tile status, so the hub does not need to
 *  know anything about how a feature works. */
// Every tile's trend line takes the accent its own tile is painted with,
// which styles.css sets per section. These used to be four literals here -
// two of them raw hex - so a tile's line and its icon were coloured in two
// different files and drifted apart.
const TILE = 'var(--tile, var(--accent))';

/** Which section a Today row belongs to, taken from where it goes. Colour on
 *  the hub means "which part of the app this is", so the Bible row and the
 *  Bible tile have to agree; before this the row was teal and the tile was
 *  terracotta, on the same screen, for the same word. */
function sectionOf(href = '') {
  if (href.startsWith('#/bible')) return 'bible';
  if (href.startsWith('#/pe')) return 'pe';
  if (href.startsWith('#/breathe')) return 'breathe';
  if (href.startsWith('#/kegels') || href.startsWith('#/session')) return 'kegels';
  return '';
}

const FEATURES = [
  {
    id: 'kegels',
    icon: 'target',
    route: '#/kegels',
    name: () => kegelName(),
    blurb: 'Progressive pelvic floor training with real per-rep tracking',
    pills() {
      const state = store.get();
      const plan = program.planForToday(state);
      const st = store.streak();
      return [
        { text: plan.complete ? 'Done today' : `${plan.doneToday}/${plan.target} today`, done: plan.complete },
        { text: `Week ${state.program.level}/${program.TOTAL_WEEKS}`, ghost: true },
        st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark() {
      const scored = store.get().sessions.filter((x) => x.countsForPromotion !== false && x.type !== 'release').slice(-14);
      return sparkline(scored.map((x) => x.score), { color: TILE });
    },
  },
  {
    id: 'pe',
    icon: 'trend',
    route: '#/pe',
    name: () => peName(),
    blurb: 'Stretching, pumping and monthly measurements with a private gallery',
    pills() {
      const pe = store.get().pe;
      const st = peProgram.peStreak();
      const latest = pe.measurements[pe.measurements.length - 1];
      const week = peProgram.weeklyVolumeMs(null, 1);
      const due = peProgram.measurementDue();
      return [
        { text: week ? `${(week / 3600000).toFixed(1)}h this week` : 'Nothing this week', done: week > 0 },
        latest ? { text: peProgram.fmtLength(latest.bpel), ghost: true } : null,
        due.due ? { text: 'Check-in due', ghost: true } : st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark() {
      return sparkline(store.get().pe.measurements.map((m) => m.bpel), { color: TILE });
    },
  },
  {
    id: 'bible',
    icon: 'scripture',
    route: '#/bible',
    name: () => 'Bible',
    blurb: 'Reading, and the morning and night rule',
    pills() {
      const today = bibleProgram.dayRead();
      const rule = prayProgram.dayState();
      const prog = bibleProgram.overallProgress();
      return [
        { text: rule.complete ? 'Rule kept' : `${rule.kept}/2 rule`, done: rule.complete },
        { text: today.any ? `${today.count} read today` : 'Nothing read today', done: today.any },
        { text: `${Math.round(prog.frac * 100)}% read`, ghost: true },
      ];
    },
    spark() {
      return sparkline(bibleProgram.history(4).map((d) => d.n), { color: TILE });
    },
  },
  {
    id: 'breathe',
    icon: 'breath',
    route: '#/breathe',
    name: () => 'Wind-down',
    blurb: 'Five minutes of paced breathing, so you fall asleep from the parasympathetic side',
    pills() {
      const today = breatheProgram.dayState();
      const st = breatheProgram.streak();
      const p = breatheProgram.PATTERNS[breatheProgram.settings().pattern];
      return [
        { text: today.done ? 'Done tonight' : 'Not yet tonight', done: today.done },
        p ? { text: p.short, ghost: true } : null,
        st ? { text: `${st} night${st === 1 ? '' : 's'}`, ghost: true } : null,
      ];
    },
    spark() {
      return sparkline(breatheProgram.history(4).map((d) => d.ms / 60000), { color: TILE });
    },
  },
];

/* ---------------- Today ----------------
   The hub used to be a menu: two tiles and a list of things that did not exist
   yet. A menu makes you decide what to do before you can do anything, which is
   the moment a habit gets dropped. This answers the question instead: here is
   what is outstanding today, and the one button that starts it. */

/** Everything still owed today, in the order a day actually runs.
 *
 *  The morning rule opens the list, with everything that has no fixed hour in
 *  between. That is not cosmetic: the two rules bracket the day, so a list that
 *  buried the morning behind three training rows was asking you to scroll past
 *  the first thing you owe.
 *
 *  The night rule used to close the list, on the grounds that putting anything
 *  after it read as though something came after it. The wind-down is the one
 *  thing that genuinely does: you pray, and then you lie down and breathe until
 *  you are ready to sleep. So it takes the last row and the rule keeps the one
 *  above it. */
function todayTasks(state) {
  const rule = (slot) => {
    const kept = prayProgram.dayState()[slot];
    return {
      id: `pray-${slot}`,
      icon: slot === 'morning' ? 'sun' : 'moon',
      label: PRAY_RULES[slot].label,
      detail: kept
        ? `Kept ${new Date(kept).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
        : `${slot === 'morning' ? state.pray.settings.morningAt : state.pray.settings.eveningAt} · ${prayProgram.minutes(slot)} min`,
      done: !!kept,
      href: `#/bible/pray?slot=${slot}`,
      cta: PRAY_RULES[slot].label,
    };
  };

  const out = [rule('morning')];

  const plan = program.planForToday(state);
  const left = Math.max(0, plan.target - plan.doneToday);
  out.push({
    id: 'kegels',
    icon: 'target',
    label: plan.type === 'release' ? 'Release day' : kegelName(),
    detail: plan.complete
      ? 'Done today'
      : plan.type === 'release'
        ? 'Down-training, no strengthening'
        : `${left} session${left === 1 ? '' : 's'} left · week ${plan.level}`,
    done: plan.complete,
    href: '#/session',
    cta: plan.complete ? 'Bonus session' : plan.type === 'test' ? 'Max hold test' : 'Start',
  });

  if (state.pe.settings.safetyAck || state.pe.sessions.length) {
    const todayStretch = state.pe.sessions
      .filter((s) => s.date === store.dayKey() && s.type === 'stretch')
      .reduce((a, s) => a + s.durationSec * 1000, 0);
    const goal = peProgram.DAILY_STRETCH_GOAL_MS;
    const hit = todayStretch >= goal;
    out.push({
      id: 'pe',
      icon: 'stretch',
      label: `${peName()} · stretching`,
      detail: hit ? 'Two hours done' : `${fmtHours(todayStretch)} of 2h · ${fmtHours(goal - todayStretch)} left`,
      done: hit,
      href: '#/pe/timer?type=stretch',
      cta: 'Stretch',
      frac: Math.min(todayStretch / goal, 1),
    });
  }

  // Reading has no time of day attached, so it is one row that says where you
  // are rather than what is owed.
  const readToday = bibleProgram.dayRead();
  const pos = bibleProgram.position();
  out.push({
    id: 'bible',
    icon: 'scripture',
    label: 'Bible',
    detail: readToday.any
      ? `${readToday.count} chapter${readToday.count === 1 ? '' : 's'} today`
      : bibleProgram.refName(`${pos.book}:${pos.ch}`),
    done: readToday.any,
    href: `#/bible/reader?book=${pos.book}&ch=${pos.ch}`,
    cta: 'Read',
  });

  const due = peProgram.measurementDue();
  if (due.due && state.pe.settings.safetyAck) {
    out.push({
      id: 'measure',
      icon: 'ruler',
      label: 'Monthly check-in',
      detail: due.reason,
      done: false,
      href: '#/pe/measure',
      cta: 'Measure',
    });
  }

  out.push(rule('evening'));

  // Last, and after the night rule on purpose: this is the thing you do lying
  // down with the light already off.
  const wind = breatheProgram.dayState();
  const pattern = breatheProgram.PATTERNS[state.breathe.settings.pattern];
  out.push({
    id: 'breathe',
    icon: 'breath',
    label: 'Wind-down',
    detail: wind.done
      ? `${fmtDuration(wind.ms / 1000)} breathing`
      : `${state.breathe.settings.minutes} min · ${pattern ? pattern.short : 'paced breathing'}`,
    done: wind.done,
    href: '#/breathe/run',
    cta: 'Wind down',
  });
  return out;
}

export function renderHub(mount) {
  const state = store.get();
  const tasks = todayTasks(state);
  const outstanding = tasks.filter((t) => !t.done);
  const next = outstanding[0];
  const doneCount = tasks.length - outstanding.length;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const kStreak = store.streak();

  mount.innerHTML = `
    <div class="screen hub">
      <header class="hub-head">
        <div class="brand-row">${logoMark(28)}<h1>NiFo</h1></div>
        <button class="icon-btn" data-nav="settings" aria-label="Settings">${icon('settings')}</button>
      </header>

      <div class="today hub-today">
        <div class="today-left">
          <h2>${outstanding.length ? `${outstanding.length} thing${outstanding.length === 1 ? '' : 's'} left` : 'All done today'}</h2>
          <p class="muted small">${escapeHtml(today)}${kStreak ? ` · ${kStreak}d streak` : ''}</p>
        </div>
        ${ringSvg(tasks.length ? doneCount / tasks.length : 1, `${doneCount}/${tasks.length}`, 'today', { size: 96 })}
      </div>

      ${reviewDue(state) ? `<a class="notice action" href="#/review">${icon('calendar', 16)} Your week is ready.</a>` : ''}
      ${!state.settings.tutorialDone ? `<a class="notice action" href="#/tutorial">${icon('help', 16)} Start here. How to do a kegel.</a>` : ''}

      <div class="task-list">
        ${tasks.map((t) => `<a class="task ${sectionOf(t.href)} ${t.done ? 'done' : ''}" href="${t.href}">
          <span class="task-ico">${t.done ? icon('check', 18) : icon(t.icon, 18)}</span>
          <span class="task-text"><b>${escapeHtml(t.label)}</b><i>${escapeHtml(t.detail)}</i></span>
          ${t.frac ? `<span class="task-mini"><i style="width:${(t.frac * 100).toFixed(0)}%"></i></span>` : ''}
        </a>`).join('')}
      </div>

      ${next ? `<a class="btn primary big linkbtn" href="${next.href}">${icon('play', 18)}<span>${escapeHtml(next.cta)}</span></a>` : ''}

      <h3 class="sec-head">Sections</h3>
      <div class="feature-grid">
        ${FEATURES.map((f) => {
          let pills = [];
          try {
            pills = f.pills().filter(Boolean);
          } catch {
            pills = [];
          }
          let spark = '';
          try {
            spark = f.spark();
          } catch {
            spark = '';
          }
          return `<a class="feature ${f.id}" href="${f.route}">
            <div class="feature-head">${icon(f.icon, 22)}<h2>${escapeHtml(f.name())}</h2></div>
            <div class="feature-foot">
              ${pills.map((p) => `<span class="pill ${p.done ? 'done' : ''} ${p.ghost ? 'ghost' : ''}">${escapeHtml(p.text)}</span>`).join('')}
            </div>
            ${spark ? `<div class="feature-spark">${spark}</div>` : ''}
          </a>`;
        }).join('')}
      </div>

      <div id="installSlot"></div>
    </div>`;
  mountInstall();
}


/* ---------------- install prompt ----------------
   Lives here because the slot it fills is on this screen. Chrome fires the
   event once, whenever it feels like it, which may be before or after the hub
   has rendered, so the prompt is stashed and mounted from both directions. */

let installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  mountInstall();
});

function mountInstall() {
  const slot = document.getElementById('installSlot');
  if (!slot || !installPrompt) return;
  slot.innerHTML = '<button class="btn ghost wide" id="installBtn">Install NiFo to your home screen</button>';
  slot.querySelector('#installBtn').addEventListener('click', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    slot.innerHTML = '';
  });
}
