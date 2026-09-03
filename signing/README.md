# Signing

`debug.keystore` is the fixed key every sideloaded APK is signed with.

## Why it is committed

Gradle signs debug builds with `~/.android/debug.keystore` and quietly generates
a throwaway one when that file is missing. On a fresh CI runner it is always
missing, so every build used to come out signed by a different key. Android
refuses to install an update whose signature does not match the installed app,
so the only way to take an update was to uninstall first, and uninstalling wipes
localStorage and IndexedDB. That is every habit and every day you marked, gone.

Pinning one key keeps the signature stable, so updates install straight over the
top and the data stays.

## What it is not

A release key. It uses Android's standard debug alias and passwords
(`androiddebugkey`, `android`, `android`), which are public by definition, so
this file protects nothing and is safe to commit for a personal sideloaded app.

This key must never sign a store release. Play and the App Store take an upload
key once and hold you to it: generate a real release key, keep it in a secret
outside the repo, and see docs/RELEASE.md. Do not reuse this one.

## Details

    alias      androiddebugkey
    store type PKCS12
    passwords  android / android
    validity   30 years from 2026-08-22
    SHA256     DB:DE:D1:5B:15:FE:ED:62:D1:B2:37:5A:E5:81:33:7D:
               8D:23:F9:E3:CA:B5:DD:99:1D:91:26:07:C8:8B:EF:C1

CI copies it to `~/.android/debug.keystore` before the Gradle build, then checks
the built APK's certificate matches. A silent signature change is the one
failure that costs data, so it fails the build rather than shipping.

The check reads the v2 signature with `apksigner`. Capacitor 8 raised minSdk to
24, and above that AGP stops writing the old v1 JAR signature, which is what
`keytool -printcert -jarfile` reads and all that it reads. Nothing about the key
changed: v2 is the scheme Android has installed from since 7.0.

## The release key

Generated 31 August 2026, and it is not in this repo. It is the **upload key**:
under Play App Signing, which every new app gets, Google holds the key that
actually signs what users install, and this one only proves that an upload came
from you. That distinction is worth knowing, because it means losing this key
is a support ticket, not the end of the app. Losing the app signing key would
be the end of the app, and Google holds it.

    alias      habitnemesis-upload
    store type PKCS12, RSA 2048
    validity   until January 2054
    SHA256     30:A2:80:A5:FA:C3:4C:18:12:B5:33:7B:3B:0A:B5:84:
               DB:D4:81:4F:C2:50:35:AD:23:BC:B1:72:31:81:E4:BA

The file and its password were handed over once, outside the repo. Put them in
a password manager. Then, before the first store build, add four repository
secrets under Settings, Secrets and variables, Actions:

    RELEASE_KEYSTORE_B64        the keystore, base64
    RELEASE_KEYSTORE_PASSWORD   the password
    RELEASE_KEY_ALIAS           habitnemesis-upload
    RELEASE_KEY_PASSWORD        the same password again

PKCS12 holds one password for the store and the key inside it, so the last two
lines are not a mistake. `tools/patch-release-signing.mjs` checks that and
fails with an explanation rather than letting Gradle report a key password
error that names neither.

The AAB job is off until the variable `RELEASE_SIGNING` is set to `true`, so
nothing here runs, or can half-run, before there is a Play account to upload to.
