// The record, kept in your account.
//
// This is a backup, not a merge, and the difference is deliberate. The failure
// people actually have is a new phone, not two phones edited at once, and a
// merge that silently picks a winner can lose a day nobody notices for weeks.
// So the newer copy is offered and the choice is the user's, once, rather than
// taken every time in the background.
//
// A true per-cell merge needs a timestamp on every cell. store.js now stamps
// habits and groups, which is the half that cannot be reconstructed later; the
// rest is docs/RELEASE.md's next milestone.

import * as store from '../store.js';
import { supabase, user } from './session.js';

const TABLE = 'habit_state';

const need = () => {
  const sb = supabase();
  if (!sb) throw new Error('No account service is configured for this build.');
  if (!user()) throw new Error('You are not signed in.');
  return sb;
};

/** Write this device's record to the account. */
export async function push() {
  const sb = need();
  const state = JSON.parse(store.exportJson());
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: user().id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  store.markSynced();
  return true;
}

/** What the account holds, or null. RLS makes the caller's row the only one
 *  they can see, so this needs no filter of its own. */
export async function peek() {
  const sb = need();
  const { data, error } = await sb.from(TABLE).select('state, updated_at').maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Replace this device's record with the account's.
 *  Through importJson, so a row that came back from a server is sanitised on
 *  the same path as a file a user hands us. Nothing else may write the store. */
export async function pull() {
  const remote = await peek();
  if (!remote) throw new Error('Your account has no record in it yet.');
  store.importJson(JSON.stringify(remote.state));
  store.markSynced();
  return remote.updated_at;
}

/** Is the account's copy newer than the last one this device wrote? */
export async function remoteIsAhead() {
  const remote = await peek();
  if (!remote) return null;
  const mine = store.lastSynced();
  return !mine || remote.updated_at > mine ? remote : null;
}
