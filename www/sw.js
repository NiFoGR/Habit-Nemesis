// Offline-first service worker. Bump CACHE to drop everything stored.
// Code is revalidated against the network; the cache is the offline answer.
const CACHE = 'nifo-v28';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',

  // shell
  './js/app.js',
  './js/back.js',
  './js/settings.js',
  './js/lock.js',
  './js/names.js',
  './js/store.js',
  './js/ui.js',
  './js/icons.js',
  './js/native.js',
  './js/nightlight.js',
  './js/tabs.js',
  './js/nifo.js',
  './js/intro.js',

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

  // habits
  './js/habits/program.js',
  './js/habits/home.js',
  './js/habits/edit.js',
  './js/habits/tracking.js',

  // arena
  './js/arena/program.js',
  './js/arena/home.js',
  './js/arena/result.js',
  './js/arena/year.js',
  './js/arena/feats.js',
  './js/arena/cabinet.js',
  './js/arena/crest.js',
  './js/artwork.js',
  './js/arena/face.js',
  './js/arena/moment.js',
  './js/arena/rank.js',
  './js/arena/review.js',
  './js/arena/share.js',

  // wind-down
  './js/breathe/program.js',
  './js/breathe/session.js',
  './js/breathe/home.js',
  './js/pray/home.js',

  // bible, and the prayer rule
  './js/bible/canon.js',
  './js/bible/context.js',
  './js/bible/text.js',
  './js/bible/program.js',
  './js/bible/home.js',
  './js/bible/reader.js',
  './js/bible/read.js',
  './js/bible/book.js',
  './js/bible/tracking.js',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',

  // Crests. Precached: one arriving late leaves a hole where the screen is.
  './img/rank-unranked.webp',
  './img/rank-0-bottom.webp',
  './img/rank-1-npc.webp',
  './img/rank-2-prospect.webp',
  './img/rank-3-contender.webp',
  './img/rank-4-menace.webp',
  './img/rank-5-locked.webp',
  './img/rank-6-topg.webp',
];

/* Scripture and notes: 154 files, megabytes, and absent from the packed build
   (npm run pack:web). Kept out of SHELL because addAll is all-or-nothing, so
   one missing note file would cost the whole offline mode. Cached one at a
   time, best effort. */
const SCRIPTURE = [
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
  './bible/notes/_index.json',
  './bible/notes/1ch.json',
  './bible/notes/1co.json',
  './bible/notes/1es.json',
  './bible/notes/1jn.json',
  './bible/notes/1ki.json',
  './bible/notes/1ma.json',
  './bible/notes/1pe.json',
  './bible/notes/1th.json',
  './bible/notes/1ti.json',
  './bible/notes/2ch.json',
  './bible/notes/2co.json',
  './bible/notes/2es.json',
  './bible/notes/2jn.json',
  './bible/notes/2ki.json',
  './bible/notes/2ma.json',
  './bible/notes/2pe.json',
  './bible/notes/2th.json',
  './bible/notes/2ti.json',
  './bible/notes/3jn.json',
  './bible/notes/3ki.json',
  './bible/notes/3ma.json',
  './bible/notes/4ki.json',
  './bible/notes/act.json',
  './bible/notes/amo.json',
  './bible/notes/bar.json',
  './bible/notes/col.json',
  './bible/notes/dan.json',
  './bible/notes/deu.json',
  './bible/notes/ecc.json',
  './bible/notes/eph.json',
  './bible/notes/epj.json',
  './bible/notes/est.json',
  './bible/notes/exo.json',
  './bible/notes/eze.json',
  './bible/notes/gal.json',
  './bible/notes/gen.json',
  './bible/notes/hab.json',
  './bible/notes/hag.json',
  './bible/notes/heb.json',
  './bible/notes/hos.json',
  './bible/notes/isa.json',
  './bible/notes/jas.json',
  './bible/notes/jdg.json',
  './bible/notes/jdt.json',
  './bible/notes/jer.json',
  './bible/notes/jhn.json',
  './bible/notes/job.json',
  './bible/notes/joe.json',
  './bible/notes/jon.json',
  './bible/notes/jos.json',
  './bible/notes/jud.json',
  './bible/notes/lam.json',
  './bible/notes/lev.json',
  './bible/notes/luk.json',
  './bible/notes/mal.json',
  './bible/notes/mat.json',
  './bible/notes/mic.json',
  './bible/notes/mrk.json',
  './bible/notes/nah.json',
  './bible/notes/neh.json',
  './bible/notes/num.json',
  './bible/notes/oba.json',
  './bible/notes/phm.json',
  './bible/notes/php.json',
  './bible/notes/pro.json',
  './bible/notes/psa.json',
  './bible/notes/rev.json',
  './bible/notes/rom.json',
  './bible/notes/rut.json',
  './bible/notes/sir.json',
  './bible/notes/sng.json',
  './bible/notes/tit.json',
  './bible/notes/tob.json',
  './bible/notes/wis.json',
  './bible/notes/zec.json',
  './bible/notes/zep.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async (c) => {
        // The app half stays all-or-nothing: a missing file here should fail loudly.
        await c.addAll(SHELL);
        await Promise.allSettled(SCRIPTURE.map((u) => c.add(u)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Scripture and notes change only when the app is rebuilt, and they are
   megabytes, so they are served from the cache without asking. */
const IMMUTABLE = /\/bible\/[^/]*\.json$|\/bible\/notes\/[^/]*\.json$/;

function put(request, response) {
  if (!response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin;

  if (mine && IMMUTABLE.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { put(e.request, res); return res; }))
    );
    return;
  }

  /* Network first for the app's own code. Cache-first meant a release that
     edited styles.css but not sw.js was invisible on a phone that already had a
     copy: remembering to bump a constant is not a mechanism. In the APK the
     network is the bundled asset next to this file, so it costs nothing. */

  e.respondWith(
    fetch(e.request)
      .then((res) => { if (mine) put(e.request, res); return res; })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
