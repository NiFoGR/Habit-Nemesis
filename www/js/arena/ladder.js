// The ladder. Nine rungs, and the maths of standing on one.
//
// Imports nothing, so store.js can read it too instead of keeping the copy it
// used to need.

/** Low to high. `bar` is the month score that holds you in the division. */
export const DIVISIONS = [
  { id: 'bottom', name: 'Bottom G', bar: 0.2 },
  { id: 'npc', name: 'NPC', bar: 0.3 },
  { id: 'prospect', name: 'Prospect', bar: 0.4 },
  { id: 'contender', name: 'Contender', bar: 0.5 },
  { id: 'menace', name: 'Menace', bar: 0.6 },
  { id: 'mentzer', name: 'Mentzer', bar: 0.7 },
  { id: 'locked', name: 'Locked In', bar: 0.8 },
  { id: 'topg', name: 'Top G', bar: 0.9 },
  // The only rung that asks for everything. One missed cell in a month loses it.
  { id: 'full', name: 'Full', bar: 1 },
];

/** Unranked. Shaped like a division so callers can read `.name`, but it has
 *  no bar: it is the absence of a rung. */
export const UNRANKED = { id: 'unranked', name: 'Unranked', bar: 0 };

export const divisionOf = (id) => DIVISIONS.find((d) => d.id === id) || DIVISIONS[1];
export const divisionIndex = (id) => Math.max(0, DIVISIONS.findIndex((d) => d.id === id));

/** The division a month score earns outright, ignoring where you were. */
export function divisionForScore(score) {
  let out = DIVISIONS[0];
  for (const d of DIVISIONS) if (score >= d.bar) out = d;
  return out;
}
