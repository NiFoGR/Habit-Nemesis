// The Supabase project this build talks to. The only file to edit when it moves.
//
// FILL BEFORE ANY BUILD THAT NEEDS AN ACCOUNT. Both values come from the
// project dashboard, Settings > API. Until they are set the app runs exactly as
// it always has, local only, and every account screen says so rather than
// failing.
//
// The publishable key is public by design: it is compiled into the app and
// anyone can read it. Row Level Security is the only thing keeping one user's
// rows from another, which is why supabase/schema.sql turns it on for every
// table. Never put the secret key in www/.

export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

/** Nothing account-shaped is offered until a project is configured. */
export const configured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

// The custom scheme the OAuth redirect comes back through on the APK, matched
// by the intent filter tools/patch-deeplink.mjs writes into the manifest. It is
// the app id, so changing one means changing both.
export const NATIVE_SCHEME = 'com.habitnemesis.app';
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://auth`;
