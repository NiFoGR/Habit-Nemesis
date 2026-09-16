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

export const SUPABASE_URL = 'https://ejsjzssrsbchyvnrrbun.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_oRyizMfx43KU0-7JgAC85Q_H6svYlhh';

/** Nothing account-shaped is offered until a project is configured. */
export const configured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

// The custom scheme the OAuth redirect comes back through on the APK, matched
// by the intent filter tools/patch-deeplink.mjs writes into the manifest.
//
// Deliberately not the package id. RFC 3986 allows a scheme letters, digits,
// plus, minus and dot, and nothing else, while an Android package may also
// carry an underscore. `nifo_habit.nemesis://auth` throws in `new URL()`, and
// native.js parses every deep link with it, so a scheme taken from the package
// would break widgets, shortcuts and the sign-in return at once.
export const NATIVE_SCHEME = 'com.habitnemesis.app';
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://auth`;
