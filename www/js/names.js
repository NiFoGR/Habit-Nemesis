// What each section is called.
//
// Discreet mode renames the two sections whose names you might not want read
// over your shoulder. Every screen asks here rather than checking the setting
// itself, so there is one place to change a name and one place to search.

import * as store from './store.js';

export const kegelName = () => (store.get().settings.discreet ? 'Core Training' : 'Kegels');
export const peName = () => (store.get().settings.discreet ? 'Length Training' : 'PE');
