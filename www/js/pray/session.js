// The guided rule.
//
// One prayer at a time, Greek and English together by default. No score, no
// grading, no streak pressure while you are in it. The only thing the app does
// at the end is record that the rule was kept.

import * as store from '../store.js';
import * as pray from './program.js';
import { ruleDef } from './prayers.js';
import { escapeHtml, fmtClock, haptic } from '../ui.js';
import { icon } from '../icons.js';

export function startRule(mount, slot, onDone) {
  const def = ruleDef(slot);
  const steps = pray.rule(slot);
  const lang = store.get().pray.settings.lang;
  const large = store.get().pray.settings.largeText;

  let i = 0;
  let timer = null;
  let silenceEnd = 0;

  document.body.classList.add('in-session');

  const cleanup = () => {
    clearInterval(timer);
    timer = null;
    document.body.classList.remove('in-session');
  };

  const leave = (kept) => {
    cleanup();
    onDone(kept);
  };

  function lines(prayer) {
    const showEl = lang !== 'en' && prayer.el.length;
    const showEn = lang !== 'el' && prayer.en.length;
    const block = (arr, cls, dir) =>
      `<div class="pr-text ${cls}" lang="${dir}">${arr.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>`;
    return `${showEl ? block(prayer.el, 'el', 'el') : ''}${showEn ? block(prayer.en, 'en', 'en') : ''}`;
  }

  function draw() {
    const step = steps[i];
    const last = i === steps.length - 1;

    if (step.kind === 'silence') {
      silenceEnd = Date.now() + step.ms;
      mount.innerHTML = shell(`
        <div class="pr-silence" id="sil">
          <b id="silClock">${fmtClock(step.ms)}</b>
          <span>Stillness</span>
        </div>`, last);
      clearInterval(timer);
      timer = setInterval(() => {
        const left = silenceEnd - Date.now();
        const el = mount.querySelector('#silClock');
        if (!el) return clearInterval(timer);
        el.textContent = fmtClock(Math.max(0, left));
        if (left <= 0) {
          clearInterval(timer);
          haptic('phase');
          next();
        }
      }, 200);
      wire(last);
      return;
    }

    clearInterval(timer);
    const p = step.prayer;
    mount.innerHTML = shell(`
      <h2 class="pr-title">${escapeHtml(lang === 'el' ? p.title.el : p.title.en)}${p.own ? ' <i class="pr-own">yours</i>' : ''}</h2>
      ${p.repeat > 1 ? `<div class="pr-repeat">${p.repeat}&times;</div>` : ''}
      ${lines(p)}
      ${p.note ? `<p class="pr-note">${escapeHtml(p.note)}</p>` : ''}`, last);
    wire(last);
  }

  function shell(body, last) {
    return `
      <div class="screen pray-run${large ? ' big' : ''}">
        <header class="screen-head">
          <button class="icon-btn" id="close" aria-label="Close">${icon('close')}</button>
          <h1>${escapeHtml(def.label)}</h1>
          <span class="icon-btn ghost"></span>
        </header>
        <div class="pr-bar">${steps.map((_, n) => `<i class="${n < i ? 'done' : n === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="pr-body">${body}</div>
        <div class="pr-nav">
          <button class="btn ghost" id="prev" ${i === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn primary" id="next">${last ? 'Amen' : 'Next'}</button>
        </div>
      </div>`;
  }

  function next() {
    if (i >= steps.length - 1) return finish();
    i++;
    haptic('tick');
    draw();
    mount.querySelector('.pr-body')?.scrollTo(0, 0);
  }

  function wire(last) {
    mount.querySelector('#next').addEventListener('click', () => (last ? finish() : next()));
    mount.querySelector('#prev').addEventListener('click', () => {
      if (i === 0) return;
      i--;
      draw();
    });
    mount.querySelector('#close').addEventListener('click', () => {
      // Leaving early records nothing. The rule was either kept or it was not.
      if (i === 0 || confirm('Leave without finishing? Nothing will be recorded.')) leave(false);
    });
  }

  function finish() {
    cleanup();
    pray.markKept(slot);
    haptic('level');
    renderDone(mount, slot, () => onDone(true));
  }

  draw();
  return { stop: cleanup };
}

/** The close of the rule. Short on purpose. */
function renderDone(mount, slot, onExit) {
  const def = ruleDef(slot);
  const today = pray.dayState();
  const s = pray.streak();
  const left = pray.outstanding();

  mount.innerHTML = `
    <div class="screen pray-done">
      <div class="done-mark">${icon('check', 34)}</div>
      <h1>${escapeHtml(def.label)} kept</h1>
      <p class="muted">${today.complete ? 'Both kept today.' : left.length ? `${left[0] === 'morning' ? 'Morning' : 'Night'} still to come.` : ''}</p>

      <div class="stat-grid">
        <div class="stat"><b>${s}</b><span>day streak</span></div>
        <div class="stat"><b>${pray.lifetime()}</b><span>rules kept</span></div>
      </div>

      <button class="btn primary big" id="done">Done</button>
    </div>`;
  mount.querySelector('#done').addEventListener('click', onExit);
}
