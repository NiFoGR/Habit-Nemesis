// Offline-first service worker. Bump CACHE to drop everything stored.
// Code is revalidated against the network; the cache is the offline answer.
const CACHE = 'habit-nemesis-v4';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',

  // shell
  './js/app.js',
  './js/vendor/supabase.js',
  './js/back.js',
  './js/settings.js',
  './js/lock.js',
  './js/store.js',
  './js/ui.js',
  './js/icons.js',
  './js/native.js',
  './js/tabs.js',
  './js/intro.js',

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
  './js/arena/divisions.js',
  './js/arena/crest.js',
  './js/arena/cup.js',
  './js/artwork.js',
  './js/arena/face.js',
  './js/arena/moment.js',
  './js/arena/rank.js',
  './js/arena/review.js',
  './js/arena/share.js',
  './js/arena/standing.js',
  './js/arena/fixture.js',
  './js/arena/arc.js',
  './js/arena/week-sheet.js',
  './js/arena/feats-screen.js',

  // the account
  './js/account/config.js',
  './js/account/session.js',
  './js/account/oauth.js',
  './js/account/sync.js',
  './js/account/screen.js',

  // the legal set, reachable offline and from a public URL for the stores
  './legal/legal.css',
  './legal/publisher.js',
  './legal/privacy.html',
  './legal/terms.html',
  './legal/wellbeing.html',
  './legal/licences.html',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',

  // Crests. Precached: one arriving late leaves a hole where the screen is.
  './img/rank-full.webp',
  './img/rank-mentzer.webp',
  './img/rank-bottom.webp',
  './img/rank-contender.webp',
  './img/rank-locked.webp',
  './img/rank-menace.webp',
  './img/rank-npc.webp',
  './img/rank-prospect.webp',
  './img/rank-topg.webp',
  './img/cup-autumn.webp',
  './img/cup-spring.webp',
  './img/cup-winter.webp',
  './img/rank-unranked.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // All-or-nothing: a missing file here should fail loudly.
      .then((c) => c.addAll(SHELL))
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

function put(request, response) {
  if (!response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  /* Off-origin is not ours. The fallback below answers with index.html, and an
     API client handed a page of HTML reports a parse error rather than saying
     you are offline. */
  if (url.origin !== location.origin) return;

  /* Network first for the app's own code. Cache-first meant a release that
     edited styles.css but not sw.js was invisible on a phone that already had a
     copy: remembering to bump a constant is not a mechanism. In the APK the
     network is the bundled asset next to this file, so it costs nothing. */

  e.respondWith(
    fetch(e.request)
      .then((res) => { put(e.request, res); return res; })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
