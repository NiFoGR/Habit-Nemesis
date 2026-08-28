// The bottom bar.
//
// Three rooms, and the one you are in most is the one under your thumb. The
// grid sits in the middle and sits proud, the way a game puts the thing you
// came to do in the centre rather than filing it alphabetically on the left.
//
// This is the menu CLAUDE.md said the app would never have, and the rule it
// breaks was written against something else. The old hub was a *list of the
// things the grid already listed* - the same data, twice, one tap apart. A bar
// with three rooms in it is not that: no two of these show the same number.
// The rule has been rewritten rather than quietly bent.
//
// It appears on the three roots and nowhere else. Everything deeper is a
// pushed screen with a corner arrow, which keeps one rule instead of a list of
// exceptions, and gives the reader and the session players the whole height.

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

/** Draw the bar once. `badges` is asked on every route change for a set of tab
 *  ids that have something waiting - a result you have not seen, a knockout
 *  running - so the dot is always current without this module knowing what a
 *  knockout is. */
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
  // A tap on the tab you are already on is not navigation, so it must not push
  // a second entry onto the stack for Back to unwind.
  bar.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tab]');
    if (!a) return;
    haptic('tick');
    if (location.hash === a.getAttribute('href')) e.preventDefault();
  });
}

/** Show the bar on a root, hide it everywhere else, and light the tab you are
 *  standing in. */
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

/** True when this hash is one of the three rooms. */
export const isRoot = (path) => ROOTS.includes(path);
