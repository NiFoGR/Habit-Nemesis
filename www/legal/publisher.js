// Who publishes the app. Every legal page reads its identity from here, so
// filling it in later is one edit.
//
// address is EMPTY, and is the last one left. The pages print
// [NOT SET: address] on screen until it is filled, which is the point: a blank
// reads as finished, a marker does not.
//
// The address becomes public. The EU Digital Services Act makes a trader
// publish it once the app is listed, so use a business address, never a home
// one. A £30-a-year registered office or a mail-forwarding address is the
// usual answer for a sole trader who works from home.

export const PUBLISHER = Object.freeze({
  name: 'Nikiforos Nikolaidis', // the sole trader's own legal name
  trading: 'Habit Nemesis', // the trading name, if it differs from the above
  email: 'nikiforosn2007@gmail.com', // reachable, and answered: users and both stores write to it
  address: '', // one line, business, public
  country: 'United Kingdom',
  jurisdiction: 'England and Wales',
  effective: '2026-08-31', // 'YYYY-MM-DD', the date the current documents took effect
  appName: 'Habit Nemesis',
});

/** The value, or a marker loud enough to stop a release. */
export function field(key) {
  const value = PUBLISHER[key];
  return typeof value === 'string' && value.trim() ? value : `[NOT SET: ${key}]`;
}

/** Writes every element carrying data-publisher="<key>". Unset ones get .not-set. */
export function fill(root = document) {
  for (const el of root.querySelectorAll('[data-publisher]')) {
    const key = el.dataset.publisher;
    const value = PUBLISHER[key];
    el.textContent = field(key);
    el.classList.toggle('not-set', !(typeof value === 'string' && value.trim()));
  }
}
