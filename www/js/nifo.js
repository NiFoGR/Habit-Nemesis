// Whether this install has the five preloaded sections.
//
// A fresh install is locked to the three rooms. One button at the foot of
// Settings, one PIN, one attempt. Not security: the PIN is right here.
//
//   0 locked, button showing   1 unlocked   2 wrong answer, button gone

import * as store from './store.js';

const PIN = '1926';

export const nifoState = () => store.get().settings.nifoOnly;

/** Are the five on? */
export const nifoUnlocked = () => nifoState() === 1;

/** Should the button still be on the settings screen? */
export const nifoOffered = () => nifoState() === 0;

export function tryNifoPin(entered) {
  if (!nifoOffered()) return false;
  const ok = String(entered).trim() === PIN;
  store.update((st) => {
    st.settings.nifoOnly = ok ? 1 : 2;
    if (ok) st.habits.settings.showLinked = true;
  });
  return ok;
}
