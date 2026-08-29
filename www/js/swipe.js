// Swiping between screens. A horizontal drag on the body moves you the way the
// tab bar or the back arrow would.
//
// Touch events, not pointer events: the browser fires pointercancel the moment
// it decides the finger is panning the page, so the pointerup never arrives.
// A touchend always does.
//
// The guards below are the point of the file. A swipe that marks a cell, or
// that fights a chart you were scrolling sideways, is worse than no swipe.

const MIN_X = 56; // travel before a drag counts as a swipe
const MAX_SLOPE = 0.6; // vertical share of the travel: past this it is a scroll
const MAX_MS = 700; // slower is a drag, and a drag is not a swipe

// Controls that own the horizontal axis or a press of their own. A plain tap
// target is not on the list: a 56px drag never becomes a click.
const GUARD = [
  'input', 'textarea', 'select', 'label', // a range slider is a horizontal drag
  '.hg-drag', // the grid's reorder handle
  '#pad', '#stage', // the session pad and the gallery's pinch-zoom stage
  '[data-noswipe]',
].join(',');

let onSwipe = () => {};
let start = null;
let pager = null;

/** Something the finger could have been panning sideways instead. */
function scrollsSideways(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) {
      const x = getComputedStyle(n).overflowX;
      if (x === 'auto' || x === 'scroll') return true;
    }
  }
  return false;
}

function down(e) {
  start = null;
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const el = t.target instanceof Element ? t.target : null;
  if (!el || el.closest(GUARD) || scrollsSideways(el)) return;
  start = { x: t.clientX, y: t.clientY, at: e.timeStamp };
}

function up(e) {
  const s = start;
  start = null;
  // A second finger landed: pinch or scroll, never a page swipe.
  if (!s || e.touches.length || !e.changedTouches.length) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - s.x;
  const dy = t.clientY - s.y;
  if (Math.abs(dx) < MIN_X) return;
  if (Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) return;
  if (e.timeStamp - s.at > MAX_MS) return;
  const dir = dx < 0 ? 'left' : 'right';
  if (onSwipe(dir)) slide(dir);
}

/** The arriving screen comes in from the side the finger came from. Only when
 *  something actually moved: at the end of the tab bar, nothing should. */
function slide(dir) {
  requestAnimationFrame(() => {
    const el = document.querySelector('#app .screen');
    if (!el) return;
    el.classList.remove('swiped-left', 'swiped-right');
    void el.offsetWidth; // re-adding a class does not restart its animation
    el.classList.add(dir === 'left' ? 'swiped-left' : 'swiped-right');
  });
}

/** A paged screen claims the gesture as it draws. The router clears it on every
 *  navigation, so nothing has to remember to give it back. */
export function setPager(p) {
  pager = p;
}

export const pagerOf = () => pager;

/** `handler` is called with 'left' or 'right'. */
export function initSwipe(handler) {
  onSwipe = handler;
  document.addEventListener('touchstart', down, { passive: true });
  document.addEventListener('touchend', up, { passive: true });
  document.addEventListener('touchcancel', () => (start = null), { passive: true });
}
