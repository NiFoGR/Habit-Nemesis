// Bible home, the plan picker and Bible settings.
//
// The home screen is today's reading and nothing else above the fold. Whatever
// plan you are on, the answer to "what am I reading" is the first thing on the
// page and it is tickable in place, because a tracker that makes you navigate
// somewhere to record what you did is a tracker you stop using in a fortnight.

import * as store from '../store.js';
import * as bible from './program.js';
import { PLANS, planById } from './plans.js';
import { CONTEXT } from './context.js';
import { escapeHtml, ringSvg, haptic, toast } from '../ui.js';
import { icon } from '../icons.js';

const GOARCH = 'https://www.goarch.org/chapel';

/* ---------------- today's reading ---------------- */

/** The tickable list of what today asks for. Shared by the home screen so the
 *  two kinds of plan, appointed passages and assigned chapters, render the
 *  same way and are ticked the same way. */
function todayList(t) {
  if (!t.items.length) return '<p class="muted small">Nothing appointed for today in the table.</p>';

  return `<div class="read-list">${t.items.map((it) => {
    const done = it.type === 'chapter'
      ? bible.chapterRead(...it.id.split(':'))
      : bible.refDone(it.id);
    return `<button class="read-item ${done ? 'done' : ''}" data-kind="${it.type}" data-id="${escapeHtml(it.id)}">
      <span class="ri-box">${done ? icon('check', 16) : ''}</span>
      <span class="ri-text">
        <b>${escapeHtml(it.label)}</b>
        ${it.detail ? `<i>${bible.linkRefs(it.detail, escapeHtml)}</i>` : ''}
      </span>
    </button>`;
  }).join('')}</div>`;
}

/** Wires the tick buttons. Everything on this screen mutates the same state,
 *  so the whole screen is re-rendered rather than patched: it is one list of at
 *  most a dozen rows and correctness is worth more than the repaint. */
function bindTicks(mount, rerender) {
  mount.querySelectorAll('.read-item').forEach((el) => {
    el.addEventListener('click', () => {
      const { kind, id } = el.dataset;
      if (kind === 'chapter') {
        const [book, ch] = id.split(':');
        if (bible.chapterRead(book, ch)) bible.unmarkChapter(book, +ch);
        else bible.markChapter(book, +ch);
      } else if (bible.refDone(id)) bible.unmarkRef(id);
      else bible.markRef(id);
      haptic('tick');
      rerender();
    });
  });
}

/* ---------------- home ---------------- */

export function renderBibleHome(mount) {
  const rerender = () => renderBibleHome(mount);
  const st = store.get().bible;
  const t = bible.today();
  const prog = bible.overallProgress();
  const streak = bible.streak();
  const season = bible.season();
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  // A cycle repeats, so its plan-day count keeps climbing past the length of
  // the cycle. Everything shown to the reader uses the wrapped number.
  const shown = t.kind === 'cycle' ? t.day % t.plan.days || t.plan.days : t.day;
  const nextShown = t.kind === 'cycle' ? (shown % t.plan.days) + 1 : shown + 1;

  // The plan line has to say something different for each kind of plan, and
  // saying nothing useful is worse than saying nothing.
  const planLine = t.kind === 'date'
    ? escapeHtml(season.name || 'The church year')
    : t.kind === 'free'
      ? 'No plan. Chapters you mark still count.'
      : t.kind === 'cycle'
        ? `Day ${shown} of ${t.plan.days}`
        : `Day ${shown} of ${t.of}`;

  const behind = t.behind > 0
    ? `<p class="notice small">${t.behind} day${t.behind === 1 ? '' : 's'} behind the calendar. Nothing has been skipped; the plan waits for you.</p>`
    : '';

  const gap = t.gap
    ? `<p class="notice small">The printed table runs out here. Between the last week after Pentecost and the next Triodion the readings vary by year, so check goarch.org for today.</p>`
    : '';

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="hub" aria-label="Back">${icon('back')}</button>
        <h1>Bible</h1>
        <button class="icon-btn" data-nav="bible-track" aria-label="Tracking">${icon('chart')}</button>
      </header>

      <div class="today bible-today">
        <div class="today-left">
          <h2>${t.complete ? 'Today is read' : "Today's reading"}</h2>
          <p class="muted small">${escapeHtml(today)}${season.fast ? ` · ${escapeHtml(season.fast)}` : ''}</p>
          <p class="muted small">${planLine}</p>
        </div>
        ${ringSvg(prog.frac, `${Math.round(prog.frac * 100)}%`, 'canon', { size: 92, color: 'var(--accent)' })}
      </div>

      ${behind}${gap}

      <section class="card">
        <div class="h-row">${icon('book', 16)}<h2>${escapeHtml(t.plan.short)}</h2></div>
        ${t.kind === 'free'
          ? freeBlock()
          : todayList(t)}
        ${t.plan.note ? `<p class="muted tiny">${escapeHtml(t.plan.note)}</p>` : ''}
        ${(t.kind === 'sequence' || t.kind === 'cycle') && t.complete
          ? `<button class="btn primary wide" id="planDone">Day ${shown} done, on to day ${nextShown}</button>`
          : ''}
      </section>

      <div class="stat-grid">
        <div class="stat"><b>${streak}</b><span>day streak</span></div>
        <div class="stat"><b>${st.best}</b><span>best</span></div>
        <div class="stat"><b>${prog.read}</b><span>of ${bible.TOTAL_CHAPTERS} chapters</span></div>
        <div class="stat"><b>${bible.booksFinished()}</b><span>of 76 books</span></div>
      </div>

      <a class="btn ghost linkbtn ext" href="${GOARCH}" target="_blank" rel="noopener noreferrer">
        ${icon('book', 16)}<span>The day's readings at goarch.org</span>${icon('external', 14)}
      </a>

      <div class="linkrow">
        <a href="#/bible/read">${icon('book')} The books</a>
        <a href="#/bible/plans">${icon('route')} Plans</a>
        <a href="#/bible/track">${icon('chart')} Tracking</a>
        <a href="#/bible/settings">${icon('settings')} Settings</a>
      </div>
    </div>`;

  bindTicks(mount, rerender);
  mount.querySelector('#planDone')?.addEventListener('click', () => {
    bible.completePlanDay();
    haptic('done');
    toast('On to the next day.');
    rerender();
  });
}

/** With no plan running, the useful thing is a way back to where you were. */
function freeBlock() {
  const last = bible.lastBook();
  const next = bible.nextUnread();
  const rows = [];
  if (last) {
    const b = bible.bookById(last);
    const p = bible.bookProgress(last);
    rows.push(`<a class="read-item" href="#/bible/read?book=${last}">
      <span class="ri-box">${icon('play', 14)}</span>
      <span class="ri-text"><b>Carry on in ${escapeHtml(b.name)}</b><i>${p.read} of ${p.total} chapters read</i></span>
    </a>`);
  }
  if (next) {
    rows.push(`<a class="read-item" href="#/bible/read?book=${next.split(':')[0]}">
      <span class="ri-box">${icon('book', 14)}</span>
      <span class="ri-text"><b>${escapeHtml(bible.refName(next))}</b><i>The next chapter you have not read</i></span>
    </a>`);
  }
  if (!rows.length) {
    rows.push(`<a class="read-item" href="#/bible/read?book=mrk">
      <span class="ri-box">${icon('book', 14)}</span>
      <span class="ri-text"><b>Mark 1</b><i>The shortest gospel. As good a place to start as any.</i></span>
    </a>`);
  }
  return `<div class="read-list">${rows.join('')}</div>`;
}

/* ---------------- plans ---------------- */

export function renderPlans(mount) {
  const st = store.get().bible;
  const current = planById(st.settings.plan);

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>Plans</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <p class="muted small">
        A plan decides what today asks of you. The lectionary follows the church
        year and cannot be fallen behind on. The rest are sequences: today is
        always the next reading you have not done, so a missed day postpones the
        plan rather than deleting a day out of it.
      </p>

      <div class="plan-list">
        ${PLANS.map((p) => `<button class="plan ${p.id === current.id ? 'on' : ''}" data-plan="${p.id}">
          <span class="plan-head">
            <b>${escapeHtml(p.name)}</b>
            ${p.id === current.id ? `<span class="pill done">Current</span>` : ''}
          </span>
          <i>${escapeHtml(p.blurb)}</i>
          ${p.kind === 'sequence' ? `<span class="pill ghost">${p.days} days</span>` : ''}
          ${p.kind === 'cycle' ? `<span class="pill ghost">Repeats weekly</span>` : ''}
        </button>`).join('')}
      </div>

      ${current.kind === 'sequence' ? planProgress(current, st) : ''}
    </div>`;

  mount.querySelectorAll('[data-plan]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.plan;
      if (id === st.settings.plan) return;
      // Switching restarts the position, which is why it asks first: someone
      // two hundred days into a year plan should not lose that to a mis-tap.
      const started = st.planDone > 0;
      if (started && !confirm(`Switch to "${planById(id).name}"? Your position in ${current.name} (day ${st.planDone + 1}) is reset. Chapters you have already read stay read.`)) return;
      bible.setPlan(id);
      haptic('done');
      renderPlans(mount);
    });
  });
}

function planProgress(plan, st) {
  const done = st.planDone;
  const frac = plan.days ? Math.min(done / plan.days, 1) : 0;
  return `<section class="card">
    <div class="h-row">${icon('route', 16)}<h2>Where you are</h2></div>
    <div class="prog-bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
    <p class="muted small">Day ${done + 1} of ${plan.days}. Started ${escapeHtml(st.settings.planStart)}.</p>
  </section>`;
}

/* ---------------- settings ---------------- */

export function renderBibleSettings(mount) {
  const s = store.get().bible.settings;

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>Bible settings</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <section class="card">
        <div class="h-row">${icon('bell', 16)}<h2>Reminder</h2></div>
        <label class="setting toggle">
          <span><b>Remind me to read</b><i>Scheduled as a real alarm on the APK, so it fires whether or not the app is running.</i></span>
          <input type="checkbox" id="remind" ${s.remind ? 'checked' : ''}>
        </label>
        <label class="setting">
          <span><b>At</b></span>
          <input type="time" id="remindAt" value="${escapeHtml(s.remindAt)}">
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('book', 16)}<h2>Reading</h2></div>
        <label class="setting toggle">
          <span><b>Larger text</b><i>For the context screens.</i></span>
          <input type="checkbox" id="largeText" ${s.largeText ? 'checked' : ''}>
        </label>
      </section>

      <section class="card">
        <div class="h-row">${icon('help', 16)}<h2>About the text</h2></div>
        <p class="muted small">
          NiFo tracks what you read and tells you what a book is for. It does not
          contain the text of the Bible, and that is deliberate: the Orthodox
          Study Bible's translations are under copyright, and the app would have
          to ship them to show them. Read from your own copy, and mark it here.
        </p>
        <p class="muted small">
          The canon, the chapter and verse counts, and the lectionary are taken
          from the Orthodox Study Bible itself, so what the app counts is what
          your Bible actually contains.
        </p>
      </section>

      <div class="linkrow">
        <a href="#/bible/plans">${icon('route')} Plans</a>
        <a href="#/bible/track">${icon('chart')} Tracking</a>
      </div>
    </div>`;

  const set = (key, value) => {
    store.update((st) => {
      st.bible.settings[key] = value;
    });
  };
  mount.querySelector('#remind').addEventListener('change', (e) => {
    set('remind', e.target.checked);
    bible.syncAlarm();
  });
  mount.querySelector('#remindAt').addEventListener('change', (e) => {
    set('remindAt', e.target.value);
    bible.syncAlarm();
  });
  mount.querySelector('#largeText').addEventListener('change', (e) => set('largeText', e.target.checked));
}

export { CONTEXT };
