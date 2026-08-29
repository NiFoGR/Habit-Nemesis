// One habit in full: score, history, calendar, every streak, and which days of
// the week it happens on. The calendar is the one chart you can write to, and
// everything else recomputes from it.

import * as store from '../store.js';
import * as habits from './program.js';
import { escapeHtml, barChart, lineChart, openSheet, haptic, fmtDate } from '../ui.js';
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
let historyPeriod = 'week';
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

/** Habits you made only. The five have richer screens inside their sections. */
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
          <p class="muted">It was deleted. The five the app asks of you keep their numbers in their own sections.</p>
          <a class="btn linkbtn" href="#/habits">Back to the grid</a></div>
      </div>`;
    return;
  }

  const sum = habits.summary(habit);
  const colour = habits.hexOf(habit.colour);

  const draw = () => {
    const scores = scoreSeries(sum, scorePeriod);
    const bars = habits.history(sum, historyPeriod, 14);
    const cal = habits.calendar(sum, 17);
    const freq = habits.weekdayByMonth(sum, 8);
    const month = Math.round((sum.score - habits.scoreAgo(sum, 30)) * 100);
    const year = Math.round((sum.score - habits.scoreAgo(sum, 365)) * 100);
    // The tile is the delta, so it is coloured rather than repeated underneath.
    const deltaClass = (v) => (v > 0 ? 'good-text' : v < 0 ? 'warn-inline' : '');

    mount.innerHTML = `
      <div class="screen habits" style="--hc:${colour}">
        <header class="screen-head">
          <button class="icon-btn" data-back="habits" aria-label="Back">${icon('back')}</button>
          <h1 style="color:${colour}">${escapeHtml(habit.name)}</h1>
          <a class="icon-btn linkbtn" href="#/habits/edit?id=${encodeURIComponent(habit.id)}" aria-label="Edit">${icon('pencil')}</a>
        </header>

        <div class="habit-hero">
          ${habit.question && habit.question !== habit.name
            ? `<h2 style="color:${colour}">${escapeHtml(habit.question)}</h2>` : ''}
          <p class="muted small">
            ${icon('calendar', 14)} ${escapeHtml(habits.freqLabel(habit.freq))}
            · ${icon('bell', 14)} ${habit.remindAt ? escapeHtml(habit.remindAt) : 'no reminder'}
          </p>
        </div>

        <section class="card">
          <div class="h-row">${icon('chart', 16)}<h2>Overview</h2></div>
          <div class="stat-grid three">
            <div class="stat"><b style="color:${colour}">${Math.round(sum.score * 100)}%</b><span>score</span></div>
            <div class="stat"><b class="${deltaClass(month)}">${month > 0 ? '+' : ''}${month}%</b><span>month</span></div>
            <div class="stat"><b class="${deltaClass(year)}">${year > 0 ? '+' : ''}${year}%</b><span>year</span></div>
            <div class="stat"><b>${sum.streak}</b><span>streak</span></div>
            <div class="stat"><b>${sum.best}</b><span>best</span></div>
            <div class="stat"><b>${fmtTotal(habit, sum)}</b><span>total</span></div>
          </div>
        </section>

        <section class="card">
          <div class="h-row">${icon('trend', 16)}<h2>Score</h2>${periodSelect('scoreP', scorePeriod, SCORE_PERIODS)}</div>
          ${scores.values.length > 1
            ? lineChart(scores.values, { color: colour, labels: [bucketLabel(scores.keys[0]), bucketLabel(scores.keys[scores.keys.length - 1])] })
            : '<div class="chart-empty">A few days of answers fill this in</div>'}
        </section>

        <section class="card">
          <div class="h-row">${icon('calendar', 16)}<h2>History</h2>${periodSelect('histP', historyPeriod, {
            day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year',
          })}</div>
          ${barChart(bars, { unit: habit.unit ? ` ${habit.unit}` : '', colour })}
        </section>

        <section class="card">
          <div class="h-row">${icon('calendar', 16)}<h2>Calendar</h2>
            <button class="chipbtn ${editing ? 'on' : ''}" id="editCal">${icon('pencil', 14)}<span>${editing ? 'Done' : 'Edit'}</span></button></div>
          ${calendarHtml(cal)}
          <div class="hm-key">
            <i class="hc-cell on"></i> done
            <i class="hc-cell carried"></i> covered
            ${habits.settings().skipDays ? '<i class="hc-cell skip"></i> skipped' : ''}
            <i class="hc-cell"></i> not done
          </div>
          ${editing ? '<p class="fineprint">Tap any day to change it. This is the record, not a scoreboard: correcting it is the right thing to do.</p>' : ''}
        </section>

        <section class="card">
          <div class="h-row">${icon('flame', 16)}<h2>Best streaks</h2></div>
          ${streaksHtml(sum, colour)}
        </section>

        <section class="card">
          <div class="h-row">${icon('repeat', 16)}<h2>Frequency</h2></div>
          ${freq.max ? freqHtml(freq, colour) : '<div class="chart-empty">Which days of the week this happens on, once it has happened</div>'}
        </section>

        ${habit.notes
          ? `<section class="card"><div class="h-row">${icon('book', 16)}<h2>Notes</h2></div>
              <p class="muted small">${escapeHtml(habit.notes)}</p></section>`
          : ''}
      </div>`;

    mount.querySelector('#scoreP').addEventListener('change', (e) => {
      scorePeriod = e.target.value;
      draw();
    });
    mount.querySelector('#histP').addEventListener('change', (e) => {
      historyPeriod = e.target.value;
      draw();
    });
    mount.querySelector('#editCal')?.addEventListener('click', () => {
      editing = !editing;
      draw();
    });
    if (editing) wireCalendarEdit(mount, habit, () => renderHabitDetail(mount, id));
  };

  draw();
}

function fmtTotal(habit, sum) {
  if (habit.kind !== 'number') return String(sum.total);
  const v = Math.round(sum.total * 100) / 100;
  return v >= 10000 ? `${Math.round(v / 1000)}k` : String(v);
}

function bucketLabel(key) {
  if (!key) return '';
  if (/^\d{4}$/.test(key)) return key;
  if (/^\d{4}-Q\d$/.test(key)) return key.replace('-', ' ');
  if (/^\d{4}-\d{2}$/.test(key)) return `${key.slice(5)}/${key.slice(2, 4)}`;
  return fmtDate(key).replace(/^\w+,?\s*/, '');
}

/* ---------------- the calendar ---------------- */

function calendarHtml(cal) {
  return `<div class="hcal">
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
                        : '';
              return `<button class="hc-cell ${cls} ${d.today ? 'now' : ''}" data-day="${d.key}"
                ${d.future ? 'disabled' : ''} title="${d.key}">${d.day}</button>`;
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
    const cell = e.target.closest('.hc-cell');
    if (!cell || cell.disabled) return;
    const key = cell.dataset.day;
    if (habit.kind === 'number') return openPastValue(habit, key, refresh);
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

/* ---------------- streaks and frequency ---------------- */

function streaksHtml(sum, colour) {
  const list = sum.streaks.slice(0, 10);
  if (!list.length) return '<p class="muted small">No streak yet. One day is a streak of one.</p>';
  const max = list[0].len;
  return `<div class="streak-list">${list
    .map((s) => `<div class="streak-row">
      <span>${escapeHtml(shortDate(s.from))}</span>
      <span class="streak-bar"><i style="width:${Math.max(8, (s.len / max) * 100)}%;background:${colour}">${s.len}</i></span>
      <span>${escapeHtml(shortDate(s.to))}</span>
    </div>`)
    .join('')}</div>`;
}

function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}

function freqHtml(freq, colour) {
  return `<div class="freq-grid">
    ${freq.rows
      .map((r) => `<div class="fq-row">
        ${r.cells.map((n) => `<i style="--d:${n ? Math.max(4, Math.round((n / freq.max) * 15)) : 0}px;color:${colour}" title="${n}"></i>`).join('')}
        <span>${r.label}</span>
      </div>`)
      .join('')}
    <div class="fq-row months">${freq.cols.map((c) => `<em>${c.label}</em>`).join('')}<span></span></div>
  </div>`;
}
