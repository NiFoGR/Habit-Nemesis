// The introduction. Five pages, one line each, shown once on a new install.
// Reachable from Settings afterwards. It says nothing about the five sections.

import * as store from './store.js';
import { icon, logoMark } from './icons.js';
import { crest } from './arena/crest.js';
import { escapeHtml } from './ui.js';
import { navigate } from './back.js';

/** True until it has been finished or skipped once. */
export const introDue = () => !store.get().settings.onboarded;

/* ---------------- the pages ---------------- */

/** A picture of the grid, drawn with the grid's own classes. Dates are not real. */
function miniGrid() {
  const cell = (cls, ico) => `<span class="hg-cell ${cls}">${ico ? icon(ico, 16) : ''}</span>`;
  const row = (name, colour, cells) => `<div class="hg-row">
    <span class="hg-name"><span class="hg-ring" style="color:${colour}">${icon('check', 18)}</span><span>${escapeHtml(name)}</span></span>
    ${cells}
  </div>`;
  return `<div class="hgrid intro-grid" style="--cols:4" aria-hidden="true">
    <div class="hg-head"><span></span><i><b>FRI</b><em>12</em></i><i><b>SAT</b><em>13</em></i><i><b>SUN</b><em>14</em></i><i class="now"><b>MON</b><em>15</em></i></div>
    ${row('Run', 'var(--accent)', cell('on', 'check') + cell('on', 'check') + cell('no', 'close') + `<span class="hg-cell intro-tap">${icon('check', 16)}</span>`)}
    ${row('Read', '#a78bfa', cell('on', 'check') + cell('') + cell('on', 'check') + cell(''))}
  </div>`;
}

function pages() {
  const list = [
    {
      title: 'NiFo',
      line: 'Everything you are keeping, on one screen. No account and no server: none of it leaves this phone.',
      art: `<span class="intro-logo">${logoMark(76)}</span>`,
    },
    {
      title: 'Three rooms',
      line: 'The bar at the bottom is the whole app. The grid is now, the Arena is where you stand, the Cabinet is what you have done.',
      art: `<span class="intro-rooms">
        <i>${icon('trophy', 26)}<b>Cabinet</b></i>
        <i class="on">${icon('habits', 26)}<b>Grid</b></i>
        <i>${icon('versus', 26)}<b>Arena</b></i>
      </span>`,
    },
    {
      title: 'The grid',
      line: 'One row per thing you are keeping. Tap today to mark it; the days behind it are the record. The + adds your own.',
      art: miniGrid(),
    },
    {
      title: 'The Arena',
      line: 'Every week is a match, and your opponent is a week you already had. Nobody else is in here. Win enough and you go up a division.',
      art: `<span class="intro-crest">${crest(3, 92)}</span>`,
    },
    {
      title: 'The Cabinet',
      line: 'Cups you have won, feats you have pulled off, and the year once there is a year to look at.',
      art: `<span class="intro-icon">${icon('trophy', 76)}</span>`,
    },
  ];

  return list;
}

/* ---------------- the screen ---------------- */

export function renderIntro(mount) {
  const steps = pages();
  let i = 0;

  const finish = () => {
    store.update((st) => {
      st.settings.onboarded = true;
    });
    navigate('#/hub');
  };

  function draw() {
    const step = steps[i];
    const last = i === steps.length - 1;

    mount.innerHTML = `
      <div class="screen intro">
        <header class="screen-head">
          <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
          <button class="icon-btn text-btn" id="skip">Skip</button>
        </header>

        <div class="step-bar">${steps.map((_, n) => `<i class="${n < i ? 'done' : n === i ? 'on' : ''}"></i>`).join('')}</div>

        <div class="intro-body">
          <div class="intro-art">${step.art}</div>
          <h1 class="intro-title">${escapeHtml(step.title)}</h1>
          <p class="intro-line">${escapeHtml(step.line)}</p>
        </div>

        <button class="btn primary big" id="next">${last ? 'Start' : 'Next'}</button>
      </div>`;

    mount.querySelector('#next').addEventListener('click', () => {
      if (last) return finish();
      i++;
      draw();
    });
    // Back steps a page. On the first page it means Skip.
    mount.querySelector('#back').addEventListener('click', () => {
      if (i === 0) return finish();
      i--;
      draw();
    });
    mount.querySelector('#skip').addEventListener('click', finish);
  }

  draw();
}
