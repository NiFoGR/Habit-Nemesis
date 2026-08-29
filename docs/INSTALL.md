# Putting NiFo on a phone

The app is a PWA. There is no App Store listing and there never will be, so
it goes on a phone from a link.

**https://nifogr.github.io/NiFo-App/**

That page is published by `.github/workflows/pages.yml` on every push to the
default branch. It serves `dist-web/`, which is the app minus `www/bible/`.

## iPhone

Safari only. Chrome and Firefox on iOS can make a bookmark but not an app:
it opens in a browser tab with an address bar, and the offline cache does
not stick.

1. Open the link in **Safari**.
2. Tap the **Share** button, the square with an arrow out of the top.
3. Scroll the list and tap **Add to Home Screen**.
4. Tap **Add**.
5. Open it from the **home screen icon**, not from Safari.

That last step is the one people miss. Launched from the icon it runs full
screen with no address bar and keeps its own storage. Opened from a Safari
tab it is just a web page.

Leave it open for a few seconds on the first run. That is the service worker
caching the app, and after it finishes the app works with no signal.

## Android

Same link in Chrome, then **Install app** from the menu, or the prompt that
appears on its own. The APK from `.github/workflows/android-apk.yml` is the
better build if you can sideload: only that one has real alarms.

## What a new install gets

The three rooms: the habit grid, the Arena and the Cabinet. Build your own
rows, mark them, play a week against a week you already had.

It does not get the five preloaded sections, so no scripture is downloaded,
which is why the hosted build is 1 MB rather than 8.

## What an iPhone does not do

**Reminders.** Every alarm in the app is scheduled through Android's
AlarmManager. On an iPhone the reminder switches do nothing, which is what
"A real alarm on the APK" under each of them means. Use the phone's own
Clock or Reminders app.

**Nothing else.** Marking, scoring, weeks, months, divisions, cups, feats
and the year all run on-device and work the same.

## The data

On the phone, in the phone's own storage. No account, no server, nothing
leaves the device. Two people with the app share nothing.

Which also means: deleting the home-screen icon deletes the record, and iOS
can clear a site's storage when it is low on space. **Settings → Export
backup** writes a file. Worth doing once a month.

Two installs cannot be merged. Import replaces what is there.
