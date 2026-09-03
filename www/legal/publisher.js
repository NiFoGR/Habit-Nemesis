// Who publishes the app. Every legal page reads its identity from here, so
// filling it in later is one edit.
//
// address is deliberately empty, and the pages are written to read without it:
// anything that only makes sense with an address carries data-publisher-when
// and is dropped. Contact is by email.
//
// Filling it in is what unlocks the EU. The Digital Services Act makes a trader
// publish an address, Play Console asks for it before it will list the app in
// the 27 EU countries, and until then those countries stay off in country
// availability. Use a business address if you ever fill it, never a home one:
// it goes on a public store listing.

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

const set = (key) => {
  const value = PUBLISHER[key];
  return typeof value === 'string' && !!value.trim();
};

/** Writes every element carrying data-publisher="<key>". Unset ones get .not-set.
 *  An element carrying data-publisher-when="<key>" is removed when that field is
 *  empty, so a sentence that needs an address does not run without one. */
export function fill(root = document) {
  for (const el of root.querySelectorAll('[data-publisher-when]')) {
    if (!set(el.dataset.publisherWhen)) el.remove();
  }
  for (const el of root.querySelectorAll('[data-publisher]')) {
    const key = el.dataset.publisher;
    el.textContent = field(key);
    el.classList.toggle('not-set', !set(key));
  }
}
