// Bottom bar: Cabinet, Grid, Arena. Drawn once, shown on the three roots only.

import { icon } from './icons.js';
import { haptic } from './ui.js';

export const TABS = [
  { id: 'cabinet', hash: '#/cabinet', icon: 'trophy', label: 'Cabinet' },
  { id: 'grid', hash: '#/hub', icon: 'habits', label: 'Grid', main: true },
  { id: 'arena', hash: '#/arena', icon: 'versus', label: 'Arena' },
];

const ROOTS = TABS.map((t) => t.hash);

let bar = null;
let badgesOf = () => ({});

/** Draw once. `badges` is asked per route for tabs with something waiting. */
export function initTabs({ badges = () => ({}) } = {}) {
  badgesOf = badges;
  bar = document.getElementById('tabs');
  if (!bar) return;
  bar.innerHTML = TABS.map(
    (t) => `<a class="tab ${t.main ? 'main' : ''}" data-tab="${t.id}" href="${t.hash}" aria-label="${t.label}">
      <span class="tab-ico">${icon(t.icon, t.main ? 26 : 21)}<i class="tab-dot" hidden></i></span>
      <i class="tab-label">${t.label}</i>
    </a>`
  ).join('');
  // Same tab is not navigation, so do not push an entry.
  bar.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tab]');
    if (!a) return;
    haptic('tick');
    if (location.hash === a.getAttribute('href')) e.preventDefault();
  });
}

/** Show on a root, hide elsewhere, light the current tab. */
export function syncTabs(path) {
  if (!bar) return;
  const at = ROOTS.indexOf(path);
  const show = at >= 0;
  bar.hidden = !show;
  document.body.classList.toggle('has-tabs', show);
  if (!show) return;
  const marks = badgesOf() || {};
  bar.querySelectorAll('[data-tab]').forEach((a, i) => {
    a.classList.toggle('on', i === at);
    a.setAttribute('aria-current', i === at ? 'page' : 'false');
    const dot = a.querySelector('.tab-dot');
    if (dot) dot.hidden = !marks[a.dataset.tab] || i === at;
  });
}
