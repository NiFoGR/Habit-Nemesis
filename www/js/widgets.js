// The home screen widgets' half of the bridge. A compact snapshot goes to the
// native plugin on every change, and the marks made on a widget while the app
// was shut come back through a queue on launch and on every resume.
//
// The app owns the truth. A queued mark is applied like a tap on the grid, so
// it goes through the same record, the same feats and the same sync.

import * as store from './store.js';
import * as habits from './habits/program.js';
import * as arena from './arena/program.js';
import { announce } from './arena/result.js';
import { isNative } from './native.js';
import { WEEKDAYS } from './ui.js';

const plugin = () => window.Capacitor?.Plugins?.HabitWidgets;
const available = () => isNative() && !!plugin();

const DAYS = 7;
const MAX_ROWS = 16;
const DEBOUNCE_MS = 400;

/* ---------------- the snapshot ---------------- */

/** Rows, the last seven days of marks, today's count, this week's match. */
export function snapshot() {
  const today = habits.today();
  const days = habits.recentDays(DAYS);
  const rows = habits.reminded().slice(0, MAX_ROWS).map((h, slot) => {
    const sum = habits.summary(h);
    return {
      id: h.id,
      name: h.name,
      colour: habits.hexOf(h.colour),
      kind: h.kind === 'yesno' ? 'yesno' : 'number',
      target: h.target || 1,
      marks: days.map((k) => {
        const raw = sum.index.get(k)?.raw;
        return typeof raw === 'number' ? raw : null;
      }),
      alarmToday: h.remindAt ? habits.alarmIdFor(slot, 0) : 0,
    };
  });
  const due = habits.dueToday();
  const key = arena.currentWeek();
  const live = arena.scoreWeek(key);
  let fixture = null;
  if (!(live.void && !live.due)) {
    const opp = arena.fixtureFor(key);
    const st = arena.standing();
    const you = Math.round(live.score * 100);
    const them = Math.round(opp.score * 100);
    fixture = {
      week: arena.weekLabel(key),
      you,
      them,
      themName: opp.name,
      state: you > them ? 'ahead' : you < them ? 'behind' : 'level',
      daysLeft: arena.daysLeftInWeek(),
      division: st.division.name,
      crest: `rank-${st.unranked ? 'unranked' : st.division.id}`,
    };
  }
  return {
    v: 1,
    today,
    days,
    dayLabels: days.map((k) => WEEKDAYS[new Date(`${k}T00:00:00`).getDay()][0]),
    rows,
    owed: { done: due.done, total: due.total },
    fixture,
  };
}

let timer = null;

function write() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    plugin().writeSnapshot({ json: JSON.stringify(snapshot()) }).catch(() => {});
  }, DEBOUNCE_MS);
}

/* ---------------- the queue ---------------- */

/** Marks made on a widget, applied in order. Only yes/no rows can be tapped there. */
async function drain() {
  let marks = [];
  try {
    marks = (await plugin().drainQueue())?.marks || [];
  } catch {
    return;
  }
  let applied = 0;
  for (const m of marks) {
    const habit = habits.byId(m?.habitId);
    if (!habit || habit.kind !== 'yesno' || !/^\d{4}-\d{2}-\d{2}$/.test(m.day) || m.day > habits.today()) continue;
    habits.setValue(habit.id, m.day, m.value === null ? undefined : habits.YES);
    applied++;
  }
  if (applied) {
    announce();
    window.dispatchEvent(new Event('hashchange'));
  }
}

/** Wire once at boot. Absent from a browser and from a build without the plugin. */
export function initWidgets() {
  if (!available()) return;
  store.subscribe(write);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') drain();
  });
  drain().then(write);
}
