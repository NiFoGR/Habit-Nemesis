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
import { RULES as PRAY_RULES } from './pray/prayers.js';
import { fmtHours, ringSvg, escapeHtml, sparkline } from './ui.js';
import { icon, logoMark } from './icons.js';
import { kegelName, peName } from './names.js';
import { reviewDue } from './kegels/review.js';

/* ---------------- the feature registry ---------------- */

/** Each feature supplies its own hub tile status, so the hub does not need to
 *  know anything about how a feature works. */
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
      return sparkline(scored.map((x) => x.score), { color: 'var(--accent)' });
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
      return sparkline(store.get().pe.measurements.map((m) => m.bpel), { color: 'var(--violet)' });
    },
  },
  {
    id: 'pray',
    icon: 'book',
    route: '#/pray',
    name: () => 'Prayer',
    blurb: 'Morning and night, both kept',
    pills() {
      const today = prayProgram.dayState();
      const st = prayProgram.streak();
      return [
        { text: today.complete ? 'Both kept' : `${today.kept}/2 today`, done: today.complete },
        st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark: () => '',
  },
  {
    id: 'bible',
    icon: 'scripture',
    route: '#/bible',
    name: () => 'Bible',
    blurb: 'What you have read, and what each book is for',
    pills() {
      const today = bibleProgram.dayRead();
      const st = bibleProgram.streak();
      const prog = bibleProgram.overallProgress();
      return [
        { text: today.any ? `${today.count} read today` : 'Nothing read today', done: today.any },
        { text: `${Math.round(prog.frac * 100)}% of the canon`, ghost: true },
        st ? { text: `${st}d streak`, ghost: true } : null,
      ];
    },
    spark() {
      // The hub is on its own palette, so this names the Bible section's gold
      // directly rather than reaching for a token that is not defined here.
      return sparkline(bibleProgram.history(4).map((d) => d.n), { color: '#d9b061' });
    },
  },
];

/* ---------------- Today ----------------
   The hub used to be a menu: two tiles and a list of things that did not exist
   yet. A menu makes you decide what to do before you can do anything, which is
   the moment a habit gets dropped. This answers the question instead: here is
   what is outstanding today, and the one button that starts it. */

/** Everything still owed today, across every feature, most urgent first. */
function todayTasks(state) {
  const out = [];
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

  for (const slot of prayProgram.SLOTS) {
    const kept = prayProgram.dayState()[slot];
    out.push({
      id: `pray-${slot}`,
      icon: slot === 'morning' ? 'sun' : 'moon',
      label: PRAY_RULES[slot].label,
      detail: kept
        ? `Kept ${new Date(kept).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
        : `${slot === 'morning' ? state.pray.settings.morningAt : state.pray.settings.eveningAt} · ${prayProgram.minutes(slot)} min`,
      done: !!kept,
      href: `#/pray/run?slot=${slot}`,
      cta: PRAY_RULES[slot].label,
    });
  }

  // Reading is a daily obligation like the prayer rule, so it belongs in the
  // list whether or not a plan is running: with no plan, the ask is simply
  // that something was read.
  const reading = bibleProgram.today();
  const readToday = bibleProgram.dayRead();
  const bibleDone = reading.kind === 'free' ? readToday.any : reading.complete;
  out.push({
    id: 'bible',
    icon: 'scripture',
    label: 'Bible',
    detail: bibleDone
      ? reading.kind === 'free'
        ? `${readToday.count} read today`
        : 'Today\u2019s reading done'
      : reading.kind === 'free'
        ? 'Nothing read today'
        : reading.items.length
          // The lectionary's items are named days carrying the passages, so
          // the useful line is the passages; a plan's items are the passages.
          ? reading.items.map((i) => i.detail || i.label).join(' · ')
          : 'Nothing appointed today',
    done: bibleDone,
    href: '#/bible',
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
    <div class="screen">
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
        ${tasks.map((t) => `<a class="task ${t.done ? 'done' : ''}" href="${t.href}">
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
