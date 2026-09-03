// The introduction. Seven pages on a new install, replayable from Settings.
//
// Two of them are done rather than read: page 2 makes you mark a cell, page 7
// builds the grid you leave on. Everything else is one picture and one line.

import * as store from './store.js';
import * as habits from './habits/program.js';
import * as arena from './arena/program.js';
import { icon, logoMark } from './icons.js';
import { crest } from './arena/crest.js';
import { counts } from './arena/feats.js';
import { cup } from './arena/cup.js';
import { escapeHtml, chime, haptic, celebrate } from './ui.js';
import { navigate } from './back.js';
import { configured } from './account/config.js';

/** True until it has been finished or skipped once. */
export const introDue = () => !store.get().settings.onboarded;

const pct = (v) => `${Math.round(v * 100)}%`;

/* ---------------- the pictures ---------------- */

/** The grid, drawn with the grid's own classes, so what you are told to tap
 *  looks like the thing you then tap. Dates are not real. */
function miniGrid() {
  // A done cell wears the row's colour on the real grid. Muted here read as off.
  const cell = (cls, ico, colour) => `<span class="hg-cell ${cls}"${cls === 'on' ? ` style="color:${colour}"` : ''}>${ico ? icon(ico, 16) : ''}</span>`;
  const row = (name, colour, cells) => `<div class="hg-row">
    <span class="hg-name"><span class="hg-ring" style="color:${colour}">${icon('check', 18)}</span><span>${escapeHtml(name)}</span></span>
    ${cells}
  </div>`;
  // Today first, like the grid itself: "Oldest first" is off by default.
  return `<div class="hgrid intro-grid" style="--cols:4">
    <div class="hg-head"><span></span><i class="now"><b>MON</b><em>15</em></i><i><b>SUN</b><em>14</em></i><i><b>SAT</b><em>13</em></i><i><b>FRI</b><em>12</em></i></div>
    ${row('Run', 'var(--accent)',
      `<button class="hg-cell intro-tap" id="tapMe" aria-label="Mark today">${icon('check', 16)}</button>` +
      cell('no', 'close') + cell('on', 'check', 'var(--accent)') + cell('on', 'check', 'var(--accent)'))}
    ${row('Read', '#a78bfa', cell('') + cell('on', 'check', '#a78bfa') + cell('no', 'close') + cell('on', 'check', '#a78bfa'))}
  </div>`;
}

/** One row per kind, and none of them a starter: the last page offers those. */
function kinds() {
  const sample = [
    { name: 'Cold shower', colour: 'mint', meta: 'every day' },
    { name: 'Steps', colour: 'sky', meta: 'at least 8,000' },
    { name: 'No phone in bed', colour: 'clay', meta: '6 in 7' },
  ];
  return `<div class="intro-kinds">
    ${sample.map((h) => `<span class="intro-kind" style="--kc:${habits.hexOf(h.colour)}">
      <i class="intro-dot"></i>
      <b>${escapeHtml(h.name)}</b>
      <em>${escapeHtml(h.meta)}</em>
    </span>`).join('')}
  </div>`;
}

/** The fixture card, cut down to the two numbers and the gap between them. */
function fixture() {
  return `<div class="intro-fix">
    <span class="intro-fix-side"><b>68%</b><i>You</i></span>
    <span class="intro-fix-vs">${icon('versus', 20)}</span>
    <span class="intro-fix-side"><b>74%</b><i>Your Nemesis</i></span>
    <span class="intro-race"><u style="width:48%"></u></span>
  </div>`;
}

/** Every rung and what it costs. The one screen that answers "how do I get
 *  there", so it is the whole ladder rather than the next step. */
function ladder() {
  return `<ol class="intro-ladder">
    ${arena.DIVISIONS.map((d, i) => `<li>
      <span class="intro-rung">
        <span class="intro-rung-crest">${crest(i, 30)}</span>
        <span class="intro-rung-name">${escapeHtml(d.name)}</span>
        <span class="intro-rung-need">${pct(d.bar)}</span>
      </span>
    </li>`).reverse().join('')}
  </ol>`;
}

function cabinet() {
  const shelf = (id, colour) => `<span class="intro-cup" style="--cc:${colour}">${cup(id, 56)}</span>`;
  return `<div class="intro-cabinet">
    <div class="intro-cups">${shelf('winter', '#8fd0ff')}${shelf('spring', '#4ade80')}${shelf('autumn', '#fbbf24')}</div>
    <div class="intro-feats">
      <span class="intro-feat">${icon('flame', 14)}A month straight</span>
      <span class="intro-feat">${icon('medal', 14)}Beat the Nemesis</span>
      <span class="intro-feat">${icon('crown', 14)}Top G</span>
    </div>
  </div>`;
}

function starters(picked) {
  return `<div class="starter-list intro-starters">
    ${habits.STARTERS.map((h, i) => `<button class="starter ${picked.has(i) ? 'picked' : ''}" data-pick="${i}" style="--sc:${habits.hexOf(h.colour)}">
      <span class="starter-dot"></span>
      <span class="starter-name">${escapeHtml(h.name)}</span>
      <span class="starter-meta">${escapeHtml(habits.starterMeta(h))}</span>
      <span class="starter-add">${icon(picked.has(i) ? 'check' : 'plus', 15)}</span>
    </button>`).join('')}
  </div>`;
}

/* ---------------- the pages ---------------- */

const PAGES = [
  {
    title: 'Habit Nemesis',
    line: `Everything you are keeping, on one screen. It lives on your phone${configured() ? ', and an account is optional' : ''}.`,
    art: () => `<span class="intro-logo">${logoMark(76)}</span>`,
    next: 'Show me',
  },
  {
    title: 'Mark the day',
    line: 'One row per thing you keep, one column per day.',
    done: 'That is the whole of it. The days behind are the record, and they can be edited too.',
    art: miniGrid,
    cta: 'Tap the cell',
    // Nothing here can be got wrong, and nothing can trap you: the button
    // opens on its own after a few seconds.
    gate: true,
  },
  {
    title: 'A row is anything',
    line: 'A yes, a number with a target, or a few days a week. Four in seven wants any four of them.',
    art: kinds,
  },
  {
    title: 'The week is a match',
    line: 'Every week you play a week you already had. Your best is your Nemesis.',
    art: fixture,
  },
  {
    title: 'The ladder',
    line: 'A month is the average of its weeks. Clear the next number to go up one, drop below yours to go down one.',
    art: ladder,
    tall: true,
  },
  {
    title: 'What you keep',
    // A function, not a string: PAGES is built at import time and the store is
    // not hydrated yet.
    line: () => `Three cups a year, on the seasons. ${counts().total} feats, each one worth saying out loud.`,
    art: cabinet,
  },
  {
    title: 'Start with these',
    line: 'Tap the ones you want. Everything about them can change later.',
    art: null,
    cta: 'Start',
    tall: true,
  },
];

/* ---------------- the screen ---------------- */

/** A page's line may be a function when it has to read the record. */
function lineOf(page, marked) {
  const v = marked && page.done ? page.done : page.line;
  return typeof v === 'function' ? v() : v;
}

export function renderIntro(mount) {
  let i = 0;
  let marked = false;
  const picked = new Set();
  let opener = null;

  const finish = () => {
    clearTimeout(opener);
    for (const n of [...picked].sort()) habits.addStarter(n);
    store.update((st) => {
      st.settings.onboarded = true;
    });
    navigate('#/hub');
  };

  function draw() {
    clearTimeout(opener);
    const page = PAGES[i];
    const last = i === PAGES.length - 1;
    const locked = page.gate && !marked;
    const cta = last
      ? picked.size
        ? `Start with ${picked.size}`
        : 'Start'
      : locked
        ? page.cta
        : page.next || 'Next';

    // A tall page leads with its heading: seven rungs above the title push it
    // off the bottom of a phone.
    const art = page.art ? `<div class="intro-art">${page.art()}</div>` : '';
    const head = `<h1 class="intro-title">${escapeHtml(page.title)}</h1>
      <p class="intro-line" id="line">${escapeHtml(lineOf(page, marked))}</p>`;

    mount.innerHTML = `
      <div class="screen intro">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <span></span>
          <button class="icon-btn text-btn" id="skip">Skip</button>
        </header>

        <div class="step-bar">${PAGES.map((_, n) => `<i class="${n < i ? 'done' : n === i ? 'on' : ''}"></i>`).join('')}</div>

        <div class="intro-body ${page.tall ? 'tall' : ''}">
          ${page.tall ? head + art : art + head}
          ${last ? starters(picked) : ''}
        </div>

        <button class="btn primary big" id="next" ${locked ? 'disabled' : ''}>${escapeHtml(cta)}</button>
      </div>`;

    if (locked) opener = setTimeout(open, 4000);
    wire(page, last);
  }

  /** The gate opening, whether it was tapped or waited out. */
  function open() {
    const btn = mount.querySelector('#next');
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = 'Next';
  }

  function wire(page, last) {
    mount.querySelector('#next').addEventListener('click', () => {
      haptic('press');
      if (last) return finish();
      i++;
      marked = false;
      draw();
    });
    // Back steps a page. On the first it means Skip.
    mount.querySelector('#back').addEventListener('click', () => {
      if (i === 0) return finish();
      i--;
      marked = false;
      draw();
    });
    mount.querySelector('#skip').addEventListener('click', finish);

    mount.querySelector('#tapMe')?.addEventListener('click', (e) => {
      if (marked) return;
      marked = true;
      clearTimeout(opener);
      const cell = e.currentTarget;
      cell.classList.remove('intro-tap');
      cell.classList.add('on');
      cell.style.color = 'var(--accent)';
      chime('mark');
      haptic('hit');
      celebrate(cell, { count: 8, spread: 60 });
      mount.querySelector('#line').textContent = page.done;
      open();
    });

    mount.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        const n = Number(b.dataset.pick);
        if (picked.has(n)) picked.delete(n);
        else picked.add(n);
        haptic(picked.has(n) ? 'hit' : 'tick');
        chime(picked.has(n) ? 'mark' : 'unmark');
        draw();
      })
    );
  }

  draw();
}
