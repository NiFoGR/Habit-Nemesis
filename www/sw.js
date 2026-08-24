// Offline-first service worker. The app is fully usable with no connection ,
// which matters, because you should be able to train anywhere.
// Bump CACHE when shipping changes so old assets are dropped.
const CACHE = 'nifo-v11';

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
  './js/nightlight.js',

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

  './js/pray/prayers.js',
  './js/pray/program.js',
  './js/pray/session.js',

  // wind-down
  './js/breathe/program.js',
  './js/breathe/session.js',
  './js/breathe/home.js',
  './js/pray/home.js',

  // bible, which the prayer rule is part of
  './js/bible/canon.js',
  './js/bible/context.js',
  './js/bible/parse.js',
  './js/bible/text.js',
  './js/bible/program.js',
  './js/bible/home.js',
  './js/bible/reader.js',
  './js/bible/read.js',
  './js/bible/book.js',
  './js/bible/tracking.js',

  // scripture: bundled with the app, precached so reading works offline from
  // the first launch rather than after the first time each book is touched
  './bible/_meta.json',
  './bible/1ch.json',
  './bible/1co.json',
  './bible/1es.json',
  './bible/1jn.json',
  './bible/1ki.json',
  './bible/1ma.json',
  './bible/1pe.json',
  './bible/1th.json',
  './bible/1ti.json',
  './bible/2ch.json',
  './bible/2co.json',
  './bible/2es.json',
  './bible/2jn.json',
  './bible/2ki.json',
  './bible/2ma.json',
  './bible/2pe.json',
  './bible/2th.json',
  './bible/2ti.json',
  './bible/3jn.json',
  './bible/3ki.json',
  './bible/3ma.json',
  './bible/4ki.json',
  './bible/act.json',
  './bible/amo.json',
  './bible/bar.json',
  './bible/col.json',
  './bible/dan.json',
  './bible/deu.json',
  './bible/ecc.json',
  './bible/eph.json',
  './bible/epj.json',
  './bible/est.json',
  './bible/exo.json',
  './bible/eze.json',
  './bible/gal.json',
  './bible/gen.json',
  './bible/hab.json',
  './bible/hag.json',
  './bible/heb.json',
  './bible/hos.json',
  './bible/isa.json',
  './bible/jas.json',
  './bible/jdg.json',
  './bible/jdt.json',
  './bible/jer.json',
  './bible/jhn.json',
  './bible/job.json',
  './bible/joe.json',
  './bible/jon.json',
  './bible/jos.json',
  './bible/jud.json',
  './bible/lam.json',
  './bible/lev.json',
  './bible/luk.json',
  './bible/mal.json',
  './bible/mat.json',
  './bible/mic.json',
  './bible/mrk.json',
  './bible/nah.json',
  './bible/neh.json',
  './bible/num.json',
  './bible/oba.json',
  './bible/phm.json',
  './bible/php.json',
  './bible/pro.json',
  './bible/psa.json',
  './bible/rev.json',
  './bible/rom.json',
  './bible/rut.json',
  './bible/sir.json',
  './bible/sng.json',
  './bible/tit.json',
  './bible/tob.json',
  './bible/wis.json',
  './bible/zec.json',
  './bible/zep.json',

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
