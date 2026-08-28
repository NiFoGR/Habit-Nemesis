// The introduction, shown once on a new install.
//
// The app has no signup, no tour tooltips and no empty-state coaching, which
// is right nine times out of ten and wrong for the first sixty seconds: a grid
// with no rows on it, a bar with three unlabelled rooms and a screen called
// "the Arena" do not explain themselves to someone who did not build them.
//
// Five pages, one idea each, and every one of them is mostly a picture. Words
// here are the thing you skim past, so there is one line per page and it is
// the line you would say out loud handing someone the phone. The grid page
// shows a real grid built from the app's own classes rather than a drawing of
// one, so what you are told to tap looks like the thing you then tap.
//
// It ends by writing `onboarded`, so the router stops sending you here, and it
// is reachable from the bottom of Settings for ever afterwards - which is also
// how anyone tests it without erasing the app.

import * as store from './store.js';
import { icon, logoMark } from './icons.js';
import { crest } from './arena/crest.js';
import { nifoUnlocked } from './nifo.js';
import { escapeHtml } from './ui.js';
import { navigate } from './back.js';
import { kegelName, peName } from './names.js';

/** True until the introduction has been finished or skipped once. */
export const introDue = () => !store.get().settings.onboarded;

/* ---------------- the pages ---------------- */

/** Four days of one habit, drawn with the grid's own classes. The dates are
 *  not real and are never claimed to be: it is a picture of the shape. */
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

  // Only on an install that has them, which on a first run is never: this page
  // exists for the replay from Settings after the door at the bottom is open.
  if (nifoUnlocked()) {
    list.splice(3, 0, {
      title: 'The five',
      line: `${kegelName()}, ${peName()}, the Bible, prayer and the wind-down keep rows of their own. Tapping the name opens the section; tapping today starts it.`,
      art: `<span class="intro-rooms">
        <i>${icon('target', 24)}</i><i>${icon('trend', 24)}</i><i>${icon('scripture', 24)}</i><i>${icon('sun', 24)}</i><i>${icon('breath', 24)}</i>
      </span>`,
    });
  }
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
    // Back steps a page rather than leaving, which is what the arrow means on
    // every other paged screen in the app. From the first page there is
    // nowhere behind it, so it means the same as Skip.
    mount.querySelector('#back').addEventListener('click', () => {
      if (i === 0) return finish();
      i--;
      draw();
    });
    mount.querySelector('#skip').addEventListener('click', finish);
  }

  draw();
}
