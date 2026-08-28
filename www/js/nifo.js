// Whether this install has the five preloaded sections.
//
// The app was built for one person and then handed to someone else, and most
// of what it does is not general: a stranger installing it does not want a
// pelvic floor programme, a length-training log, a prayer rule, 1,344 chapters
// of scripture and a wind-down. They want the grid, the Arena and the Cabinet,
// which are the three rooms that work for anything you are keeping.
//
// So a fresh install is locked, and the five appear only when someone who
// knows the app says so. One button at the bottom of Settings, one PIN, and -
// deliberately - one attempt: a wrong answer removes the button for good,
// which is what makes it a door rather than a keypad to be guessed at. The
// only way back from that is erasing the app's data, and that is not
// advertised anywhere.
//
// This is not security and is not pretending to be. The PIN is in the source
// like every other constant, the sections are not encrypted, and anyone who
// opens the file can read it. It exists so the app can be given away without
// giving away what it is for.
//
// Three states, so "never offered it" and "answered it wrong" are not the same
// thing:
//   0  locked, the button is there
//   1  unlocked, the five are on
//   2  burned, the button is gone for ever

import * as store from './store.js';

const PIN = '1926';

export const nifoState = () => store.get().settings.nifoOnly;

/** True when the five are on. Read by the grid, the Arena's scoring through
 *  it, the router and the settings screen. */
export const nifoUnlocked = () => nifoState() === 1;

/** True only while the button should still be on the settings screen. */
export const nifoOffered = () => nifoState() === 0;

/**
 * One attempt. Right: the five come on, including the grid rows, because
 * unlocking them and then leaving the grid empty would read as nothing having
 * happened. Wrong: the button is gone.
 */
export function tryNifoPin(entered) {
  if (!nifoOffered()) return false;
  const ok = String(entered).trim() === PIN;
  store.update((st) => {
    st.settings.nifoOnly = ok ? 1 : 2;
    if (ok) st.habits.settings.showLinked = true;
  });
  return ok;
}
