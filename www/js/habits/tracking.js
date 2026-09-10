// One habit in full: score, history, calendar, every streak, and which days of
// the week it happens on. The calendar is the one chart you can write to, and
// everything else recomputes from it.

import * as store from '../store.js';
import * as habits from './program.js';
import { escapeHtml, lineChart, openSheet, haptic, fmtDate, fmtRange, WEEKDAYS } from '../ui.js';
import { icon } from '../icons.js';
import { announce } from '../arena/result.js';

const SCORE_PERIODS = {
  day: { label: 'Day', buckets: 30 },
  week: { label: 'Week', buckets: 26 },
  month: { label: 'Month', buckets: 24 },
  quarter: { label: 'Quarter', buckets: 12 },
  year: { label: 'Year', buckets: 10 },
};

// Module state, not a setting: a way of looking at this screen, not a preference.
let scorePeriod = 'month';
let editing = false;

/* ---------------- buckets ---------------- */

function bucketKey(key, period, firstDay) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (period === 'day') return key;
  if (period === 'week') {
    const shift = (dt.getDay() - firstDay + 7) % 7;
    return store.dayKey(new Date(y, m - 1, d - shift));
  }
  if (period === 'month') return key.slice(0, 7);
  if (period === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return String(y);
}

/** End of bucket, not mean: the score is already an average with a memory. */
function scoreSeries(sum, period) {
  const firstDay = habits.settings().firstDay;
  const { buckets } = SCORE_PERIODS[period];
  const last = new Map();
  for (const d of sum.days) last.set(bucketKey(d.key, period, firstDay), d.score);
  const keys = [...last.keys()].sort().slice(-buckets);
  return { values: keys.map((k) => Math.round(last.get(k) * 100)), keys };
}

function periodSelect(id, value, options) {
  return `<select class="chart-period" id="${id}">${Object.entries(options)
    .map(([k, v]) => `<option value="${k}" ${k === value ? 'selected' : ''}>${v.label || v}</option>`)
    .join('')}</select>`;
}

/* ---------------- the screen ---------------- */

export function renderHabitDetail(mount, id) {
  const habit = habits.byId(id);
  if (!habit) {
    mount.innerHTML = `
      <div class="screen habits">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1>Not found</h1><span class="icon-btn ghost"></span>
        </header>
        <div class="empty-state"><h2>That habit is gone</h2>
          <p class="muted">It was deleted, or the link is older than the app's data.</p>
          <a class="btn linkbtn" href="#/habits">Back to the grid</a></div>
      </div>`;
    return;
  }

  const sum = habits.summary(habit);
  const colour = habits.hexOf(habit.colour);

  const draw = () => {
    const scores = scoreSeries(sum, scorePeriod);
    // Six weeks to aim at, twenty to look at.
    const cal = habits.calendar(sum, editing ? 6 : 20);
    // Nothing to compare against inside the first month.
    const month = sum.days.length > 30 ? Math.round((sum.score - habits.scoreAgo(sum, 30)) * 100) : 0;
    // Under a fortnight a trend line is jitter.
    const trend = sum.days.length >= 14;
    const per = SCORE_PERIODS[scorePeriod].label.toLowerCase();
    const streaks = streaksHtml(sum, colour);

    mount.innerHTML = `
      <div class="screen habits hb-detail" style="--hc:${colour}">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1 style="color:${colour}">${escapeHtml(habit.name)}</h1>
          <a class="icon-btn linkbtn" href="#/habits/edit?id=${encodeURIComponent(habit.id)}" aria-label="Edit">${icon('pencil')}</a>
        </header>

        <div class="hb-top">
          <b class="hb-score">${Math.round(sum.score * 100)}%</b>
          ${month === 0 ? '' : `<span class="hb-move ${month > 0 ? 'up' : 'down'}">${month > 0 ? '+' : ''}${month}% this month</span>`}
        </div>
        <p class="hb-why">${escapeHtml(whyLine(sum))}</p>
        <p class="hb-facts">${[
          escapeHtml(habits.freqLabel(habit.freq)),
          habit.remindAt ? escapeHtml(habit.remindAt) : '',
          sum.streak ? `${sum.streak} day streak` : '',
          `${fmtTotal(habit, sum)} in all`,
        ].filter(Boolean).join(' · ')}</p>

        ${trend
          ? `<section class="card">
          <div class="h-row"><h2>Score</h2>${periodSelect('scoreP', scorePeriod, SCORE_PERIODS)}</div>
          ${scores.values.length > 2
            ? lineChart(scores.values, { color: colour, labels: [bucketLabel(scores.keys[0]), bucketLabel(scores.keys[scores.keys.length - 1])] })
            : `<div class="chart-empty">${scores.values.length} ${per}${scores.values.length === 1 ? '' : 's'} so far.</div>`}
        </section>`
          : ''}

        <section class="card">
          <div class="h-row"><h2>Calendar</h2>
            <button class="chipbtn hb-edit ${editing ? 'on' : ''}" id="editCal">${icon('pencil', 14)}<span>${editing ? 'Done' : 'Edit'}</span></button></div>
          ${calendarHtml(cal, editing)}
        </section>

        ${streaks
          ? `<section class="card"><div class="h-row"><h2>Streaks</h2></div>${streaks}</section>`
          : ''}

        ${habit.notes
          ? `<section class="card"><div class="h-row"><h2>Notes</h2></div>
              <p class="hb-note">${escapeHtml(habit.notes)}</p></section>`
          : ''}
      </div>`;

    mount.querySelector('#scoreP')?.addEventListener('change', (e) => {
      scorePeriod = e.target.value;
      draw();
    });
    mount.querySelector('#editCal').addEventListener('click', () => {
      haptic('press');
      editing = !editing;
      draw();
    });
    if (editing) wireCalendarEdit(mount, habit, () => renderHabitDetail(mount, id));
  };

  draw();
}

function fmtTotal(habit, sum) {
  if (!habits.measurable(habit)) return String(sum.total);
  // Minutes read as hours past two of them.
  if (habit.kind === 'timed' && sum.total >= 120) return `${(sum.total / 60).toFixed(1)}h`;
  const v = Math.round(sum.total * 100) / 100;
  return v >= 10000 ? `${Math.round(v / 1000)}k` : String(v);
}

/** One sentence on why the score moved this week. Computed, never stored. */
function whyLine(sum) {
  const m = habits.movement(sum);
  const points = (n) => `${n} point${n === 1 ? '' : 's'}`;
  if (m.days < 7) return `${m.days} day${m.days === 1 ? '' : 's'} on the record.`;
  // One day is worth naming. More than one, the calendar shows which.
  const only = m.misses.length === 1 ? `, on ${WEEKDAYS[new Date(`${m.misses[0]}T00:00:00`).getDay()]}` : '';
  // A counted thing, so a numeral, the way the rest of the app counts.
  const count = m.misses.length || 'No';
  if (m.delta < 0) return `Down ${points(-m.delta)} this week. ${count} miss${m.misses.length === 1 ? '' : 'es'}${only}.`;
  if (m.delta > 0) return `Up ${points(m.delta)} this week. ${m.kept} of 7 days kept.`;
  return `Level this week. ${m.kept} of 7 days kept.`;
}

function bucketLabel(key) {
  if (!key) return '';
  if (/^\d{4}$/.test(key)) return key;
  if (/^\d{4}-Q\d$/.test(key)) return key.replace('-', ' ');
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return fmtDate(key).replace(/^\w+,?\s*/, '');
}

/* ---------------- the calendar ---------------- */

function calendarHtml(cal, editing) {
  return `<div class="hcal ${editing ? 'on' : ''}">
    <div class="hcal-body">
      ${cal.cols
        .map((c) => `<div class="hcal-col">
          <span class="hcal-mon">${escapeHtml(c.label)}</span>
          ${c.cells
            .map((d) => {
              const cls = d.future
                ? 'future'
                : d.skipped
                  ? 'skip'
                  : d.hit
                    ? 'on'
                    : d.satisfied
                      ? 'carried'
                      : d.lapse
                        ? 'lapse'
                        : d.before
                          ? 'void'
                          : '';
              // The date only while you are aiming at it. A heatmap otherwise.
              return `<button class="hc-cell ${cls} ${d.today ? 'now' : ''}" data-day="${d.key}"
                ${d.future || !editing ? 'disabled' : ''} title="${d.key}">${editing ? d.day : ''}</button>`;
            })
            .join('')}
        </div>`)
        .join('')}
    </div>
    <div class="hcal-side"><span class="hcal-mon"></span>${cal.rowLabels.map((d) => `<i>${d}</i>`).join('')}</div>
  </div>`;
}

function wireCalendarEdit(mount, habit, refresh) {
  mount.querySelector('.hcal')?.addEventListener('click', (e) => {
    if (!e.currentTarget.classList.contains('on')) return;
    const cell = e.target.closest('.hc-cell');
    if (!cell || cell.disabled) return;
    const key = cell.dataset.day;
    if (habits.measurable(habit)) return openPastValue(habit, key, refresh);
    haptic('tick');
    habits.setValue(habit.id, key, habits.nextValue(habit, key));
    announce();
    refresh();
  });
}

function openPastValue(habit, key, refresh) {
  const sheet = openSheet(`
    <h2>${escapeHtml(habit.name)}</h2>
    <p class="muted small">${escapeHtml(key)}</p>
    <div class="measure-row">
      <input type="number" inputmode="decimal" step="any" min="0" id="v"
        value="${typeof habits.valueOn(habit, key) === 'number' && habits.valueOn(habit, key) >= 0 ? habits.valueOn(habit, key) : ''}">
      <span>${escapeHtml(habit.unit || '')}</span>
    </div>
    <div class="btn-row">
      <button class="btn" id="clear">Clear</button>
      <button class="btn primary" id="save">Save</button>
    </div>`);
  const input = sheet.el.querySelector('#v');
  input.focus();
  const done = (v) => {
    habits.setValue(habit.id, key, v);
    announce();
    sheet.close();
    refresh();
  };
  sheet.el.querySelector('#save').addEventListener('click', () => {
    const v = Number(input.value);
    done(input.value === '' || !Number.isFinite(v) ? undefined : Math.max(0, v));
  });
  sheet.el.querySelector('#clear').addEventListener('click', () => done(undefined));
}

/* ---------------- streaks ---------------- */

/** The five longest, longest first. Empty until one of them beats a single day. */
function streaksHtml(sum, colour) {
  const list = sum.streaks.filter((s) => s.len > 1).slice(0, 5);
  if (!list.length) return '';
  const max = list[0].len;
  return `<div class="streak-list">${list
    .map((s) => `<div class="streak-row">
      <span class="streak-when">${escapeHtml(fmtRange(s.from, s.to))}</span>
      <span class="streak-bar"><i style="width:${Math.max(6, (s.len / max) * 100)}%;background:${colour}"></i></span>
      <b>${s.len}</b>
    </div>`)
    .join('')}</div>`;
}

