// Offline-first service worker. The app is fully usable with no connection ,
// which matters, because you should be able to train anywhere.
// Bump CACHE when shipping changes so old assets are dropped.
const CACHE = 'nifo-v8';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',

  // shell
  './js/app.js',
  './js/back.js',
  './js/hub.js',
  './js/settings.js',
  './js/lock.js',
  './js/names.js',
  './js/store.js',
  './js/ui.js',
  './js/icons.js',
  './js/native.js',

  // kegels
  './js/kegels/program.js',
  './js/kegels/session.js',
  './js/kegels/home.js',
  './js/kegels/report.js',
  './js/kegels/tracking.js',
  './js/kegels/tutorial.js',
  './js/kegels/roadmap.js',
  './js/kegels/pocket.js',
  './js/kegels/review.js',

  // pe
  './js/pe/program.js',
  './js/pe/home.js',
  './js/pe/timer.js',
  './js/pe/measure.js',
  './js/pe/camera.js',
  './js/pe/stats.js',
  './js/pe/gallery.js',
  './js/pe/guide.js',
  './js/pe/vault.js',
  './js/pe/db.js',
  './js/pe/pin.js',

  // prayer
  './js/pray/prayers.js',
  './js/pray/program.js',
  './js/pray/session.js',
  './js/pray/home.js',

  // bible
  './js/bible/canon.js',
  './js/bible/lectionary.js',
  './js/bible/context.js',
  './js/bible/pascha.js',
  './js/bible/plans.js',
  './js/bible/program.js',
  './js/bible/home.js',
  './js/bible/read.js',
  './js/bible/book.js',
  './js/bible/tracking.js',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            // Cache same-origin successes so a first online visit primes everything.
            if (res.ok && new URL(e.request.url).origin === location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});
