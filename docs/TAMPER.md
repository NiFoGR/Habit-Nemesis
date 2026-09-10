# What is defended, and what is not

The record is localStorage on a phone. Anyone can open it and change it. This
says what that means, what the app does about it, and what would have to change
the day any of it stops being true.

## The threat model

Ask who the adversary is and what they gain.

**Someone editing their own record.** They gain a nicer graph. Nobody else is
affected. There is no leaderboard, no shared standing, no paid feature gated on
progress and no server that believes anything the phone says. Defending against
this would cost real work and buy nothing, so the app does not.

**Someone moving the device clock.** This is the one that matters, and not
because it is an exploit. A clock that is simply wrong damages an honest record,
and that is a bug rather than a threat. It is covered below.

**Someone unpacking and re-signing the APK.** The app is plain JavaScript in
`assets/public/`, readable and editable in a text editor. A re-signed build is a
different application to the store, installs alongside nothing, and has no
server to lie to. There is nothing here to protect.

## The clock

`ledger.js` is the only code that writes a result, and it settles every week
that has ended since the last launch. "Ended" was read off the device clock and
nothing else.

Measured with the clock moved and the record compared against one whose clock
never moved:

| clock | what it wrote |
|---|---|
| +7 days | the week in progress closed as a **loss**, and one feat |
| +60 days | the same, and nothing more |
| +400 days | the same, and one more dated feat |
| back to the real date | the fabricated loss **stayed for ever** |
| −30 days | nothing |

Weeks past the jump were already safe: `closeWeeks` skips a week with no marks
in it, and a week you have not lived through has none. The damage was the week
you were in the middle of, and `rescore` could never undo it, because it only
touches weeks nobody played.

**The rule now: a week that has not ended cannot hold a verdict.** `unwind()`
runs before anything else in `sync()` and drops any `won`, `lost` or `void`
stored at or after the current week. Nothing legitimate writes there, so
anything found came from a clock that was wrong, and dropping it costs nothing:
`closeWeeks` builds the week back out of the marks, which are never touched, so
the same entries settle to the same result once the clock is right. The record
after a jump and back is now identical to one that never moved.

Two things it deliberately does not do.

- **A `record` week is left alone.** Deleting one turned four backfilled
  performances into four played wins and five feats the moment a clock went back
  a month. A backfilled week is a performance, not a verdict.
- **Months and the ladder are left alone.** A month settles only when every week
  in it is stored, and a jump stores none of them, so the case does not arise.
  Rolling the ladder back would be a real demotion for an imagined problem.

**What a forward clock can still do:** advance a feat that counts days. Feats
store the date first earned and are never taken back, and un-earning one would
be worse for an honest user than the exploit is worth.

**Timezone travel** reads as a small backwards move, which now writes nothing.
Crossing the date line westwards can put a just-closed week back into the
present for a day; it is dropped and re-closes from the same marks with the same
score.

## Backfill

Marking a day you kept before you added the habit is a feature. It is bounded
already, and the bounds are not new work:

- A row owes only the days between its creation and its archiving, so no mark
  can land before the habit existed. `createdAt` is set by the app and is not
  editable.
- The calendar refuses a day in the future.
- `MAX_BACKFILL_WEEKS` caps the first-run sweep at 130 weeks.

## Why there is no checksum

A digest the app computes is one the editor can recompute, so it proves nothing
about intent. It would detect corruption, and `hydrate()` already does that
better: every value that comes off disk is coerced to its type or dropped, so a
truncated or hand-mangled record opens as a valid one rather than a broken app.
A checksum here would be a thing to point at rather than a thing that works.

## Why R8 is off

Minifying obfuscates the Java layer. The app's logic is not in the Java layer,
it is the JavaScript sitting in plain text beside it, so R8 protects nothing
here. It would shrink the bundle, and Capacitor registers plugins reflectively,
so turning it on needs a run on a real device rather than a green build. That is
a size decision to make deliberately, not a security one to make now.

## The day this changes

Anything competitive leaving the device inverts all of it. A shared leaderboard,
a friends list, a public standing: the moment a number on someone else's screen
comes from this phone, the phone stops being trusted.

- Scores that others see are computed on the server from the marks, not sent
  ready-made.
- Marks arrive with the moment they were made, server-stamped on arrival, and
  the server decides which week they land in.
- A record that arrives claiming days in the future, or a month of perfect days
  in one request, is refused rather than merged.

None of that is worth building before there is something to defend.

## The sign-in screen

Same shape of answer, in `docs/ACCOUNTS.md` section 7. The gate on the form
counts five wrong passwords and then makes you wait, per account and per device
so changing the address does not reset it, and it survives a reload. It is a
courtesy: the publishable key ships in the APK, so the auth endpoint can be
called without ever loading the screen. Supabase's own rate limits are the
control, and its leaked-password check is worth more than everything on the
form put together.

One thing there is a defence rather than a courtesy: **sign-up says the same
thing whether or not the address already had an account.** Two answers would
make the form a way of asking which of a list of addresses has one here.

## What is checked

`npm run check:release`, on every push:

- No source map in `www/`. There is no build step, so nothing needs one.
- No secret in `www/`. Every JWT found is decoded rather than pattern-matched,
  and any role but `anon` fails. The publishable key is public by design; the
  service key bypasses Row Level Security, which is the only thing keeping one
  account's rows from another's.
- `ads/config.js` ships `TESTING = true`, so a sideloaded APK can never serve a
  real ad. `tools/patch-ads.mjs` flips it in the copied assets and nowhere else.
- One keystore in the repo and it is the debug one.
- The privacy page and the Data safety answers name the same sign-in routes.

`tools/patch-release-signing.mjs` refuses a release build that would use the
debug alias, and refuses one with WebView debugging forced on.
