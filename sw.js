/**
 * Offline cache for Bornomala.
 *
 * The whole app is a handful of static files plus the model, so the strategy
 * is simple and total: precache everything on install, serve cache-first, and
 * never depend on the network at runtime. That is the point — the app has to
 * work on the day the network is gone.
 *
 * Bump CACHE when any shell file or the model changes.
 */

const CACHE = 'bornomala-v2';

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
  './src/message.js',
  './src/model.js',
  './src/phrasebook.js',
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

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
