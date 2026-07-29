/**
 * Offline cache for Bornomala.
 *
 * The whole app is a handful of static files plus the model, so the strategy
 * is simple and total: precache everything on install, serve cache-first, and
 * never depend on the network at runtime. That is the point — the app has to
 * work on the day the network is gone.
 *
 * Bump CACHE when the model changes, and on any deploy worth forcing: the
 * activate handler deletes every other cache, which is what evicts a stale
 * shell from a phone that has been offline for a week.
 */

const CACHE = 'bornomala-v13';

/**
 * The shell is a few tens of kilobytes and covers every structured crisis
 * message — templates, districts, frames, the paper profile, decoding. It has
 * to install even on a connection that will never finish 1.7 MB.
 */
const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './src/bitfield.js',
  './src/codec.js',
  './src/coder.js',
  './src/crc.js',
  './src/frame.js',
  './src/geo.js',
  './src/gsm7.js',
  './src/i18n.js',
  './src/message.js',
  './src/model.js',
  './src/phrasebook.js',
  './src/qr.js',
];

/** Free Bangla prose needs this. Nothing else does, so it must not gate install. */
const OPTIONAL = ['./model.bin'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        await cache.addAll(SHELL);
        // Deliberately not awaited: a model download that times out must not
        // leave the app uninstalled and the crisis path unavailable.
        for (const url of OPTIONAL) cache.add(url).catch(() => {});
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * The shell is small and changes; the model is 1.7 MB and does not.
 *
 * So the shell is network-first: a refresh with any connection at all picks up
 * a new build immediately, and falls back to the cache the moment the network
 * is not there — which is the case this whole app exists for. The model stays
 * cache-first, because re-downloading 1.7 MB on every load would be absurd.
 */
function isShell(url) {
  return url.origin === self.location.origin && !url.pathname.endsWith('model.bin');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (isShell(new URL(request.url))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // A cache miss with no network must still be a Response: returning
          // undefined here is what surfaces as "network error when attempting
          // to fetch resource" in the console.
          const hit = await caches.match(request, { ignoreSearch: true });
          if (hit) return hit;
          const shell = await caches.match('./', { ignoreSearch: true });
          if (shell && request.mode === 'navigate') return shell;
          return new Response('', { status: 504, statusText: 'offline' });
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          // Cache same-origin successes so a first visit primes the app fully.
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
