// Section names. Discreet mode renames two of them.

import * as store from './store.js';

export const kegelName = () => (store.get().settings.discreet ? 'Core Training' : 'Kegels');
export const peName = () => (store.get().settings.discreet ? 'Length Training' : 'PE');
