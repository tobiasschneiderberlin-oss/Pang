/**
 * PANG — service worker.
 *
 * Minimal install / activate / fetch handler. Goal at this iteration:
 * make the app installable as a PWA and survive a brief offline blip
 * on a previously-visited route. Not a full offline-first architecture
 * — that lands with background sync + IndexedDB caching when the
 * upload flows arrive.
 *
 * Cache invalidation: bump CACHE_NAME on every meaningful change to
 * SW behaviour. Old caches are evicted on activate.
 */

// Bump this when shipping changes that invalidate cached responses
// (route shape changes, link href format changes, etc.). The activate
// handler below evicts every cache whose name doesn't match.
const CACHE_NAME = 'pang-v5-wordmark-icon';

// Same-origin GETs that should be available when offline. Keep this
// list short — Next/Turbopack handles its own asset hashing for
// /_next/* routes which we let the runtime cache populate.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  // Activate this SW immediately rather than waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      // Take control of any open clients (so a returning user gets
      // the new SW without a hard reload).
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET. Mutations go straight to the network.
  if (event.request.method !== 'GET') return;

  // Don't intercept cross-origin fetches (Anthropic API, image CDNs,
  // Supabase calls when wired). Let them hit the network unmediated.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first with cache fallback. Successful responses populate
  // the cache so next-time-offline sees the last-known-good version.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => {
              /* cache write best-effort */
            });
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return Response.error();
      }
    })(),
  );
});
