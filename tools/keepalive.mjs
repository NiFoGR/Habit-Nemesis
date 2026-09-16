// One real database read a day, so a free Supabase project is not paused for
// inactivity. The pause criterion is queries, not traffic, so a ping to the
// hostname would not count.
//
// The URL and the key come off www/js/account/config.js rather than out of repo
// secrets. Both are public by design and already ship inside the APK, and two
// secrets and a variable to set is three ways for this to sit skipped, which is
// what it did for its first fifteen runs.

import { SUPABASE_URL, SUPABASE_KEY, configured } from '../www/js/account/config.js';

if (!configured()) {
  console.log('no project configured, nothing to keep awake');
  process.exit(0);
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/keepalive?select=id&limit=1`, {
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
});
console.log(`HTTP ${res.status} ${await res.text()}`.trim());
// A 200 is the read. Anything else means the project is paused, gone, or the
// keepalive row never got its policy, and all three are worth a red mark.
if (!res.ok) process.exit(1);
