# Signing

`nifo-debug.keystore` is the fixed key every NiFo APK is signed with.

## Why it is committed

Gradle signs debug builds with `~/.android/debug.keystore` and quietly generates
a throwaway one when that file is missing. On a fresh CI runner it is always
missing, so every build used to come out signed by a different key. Android
refuses to install an update whose signature does not match the installed app,
so the only way to take an update was to uninstall first, and uninstalling wipes
localStorage and IndexedDB. That is every session, measurement and encrypted
photo gone.

Pinning one key keeps the signature stable, so updates install straight over the
top and the data stays.

## What it is not

A release key. It uses Android's standard debug alias and passwords
(`androiddebugkey`, `android`, `android`), which are public by definition, so
this file protects nothing and is safe to commit for a personal sideloaded app.

If NiFo is ever published, generate a real release key, keep it out of the repo
in a secret, and sign release builds with that instead. Do not reuse this one.

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
