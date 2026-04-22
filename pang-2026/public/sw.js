/**
 * PANG — service worker.
 *
 * Hand-authored (not generated) for iteration #0. Workbox lands in a
 * later iteration when the runtime-caching strategies proliferate.
 * The rules here are minimal and named:
 *
 *   - Navigation Preload: on, for HTML navigations. P3 asserts.
 *   - Pre-cache: the app shell (navigation target + critical chunks
 *     are handled by Next.js's build manifest; we intercept and cache
 *     them on first response). No explicit asset list to drift from
 *     the real build.
 *   - Fetch strategy:
 *       • HTML   — network-first with preload, 2s timeout, fall back
 *                  to cached shell. (P4 offline boot.)
 *       • Static — stale-while-revalidate, keyed by URL.
 *       • API   — network-only. Never cache trusted data.
 *
 * P3 asserts this file is served with Cache-Control: no-cache and
 * Service-Worker-Allowed: / (set in next.config.ts headers()).
 */

/* eslint-disable no-restricted-globals */

const VERSION = "v0.1.0-iteration-0";
const SHELL_CACHE = `pang-shell-${VERSION}`;
const RUNTIME_CACHE = `pang-runtime-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Cache the navigation target. Next.js hashes static assets;
      // fetching "/" warms the shell and the first paint's JS/CSS
      // via `cache.addAll` would be brittle against hash rotation.
      // We rely on the fetch handler below to populate on first hit.
      await cache.add(new Request("/", { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation Preload — P3 asserts presence.
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      // Drop old versioned caches.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) => k.startsWith("pang-") && !k.endsWith(VERSION),
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Navigation requests — network-first with preload, 2s timeout,
 * fallback to cached shell. This is the heart of P4.
 */
async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const preload = await event.preloadResponse;
    if (preload) {
      // Warm the shell cache in the background.
      cache.put("/", preload.clone()).catch(() => {});
      return preload;
    }

    const networkRace = Promise.race([
      fetch(event.request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000),
      ),
    ]);

    const response = await networkRace;
    if (response && response.ok) {
      cache.put("/", response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match("/");
    if (cached) return cached;
    // Last resort — a minimal offline page. No network, no cache,
    // no shell. The register script reports this to observability.
    return new Response(
      "<!doctype html><meta charset=utf-8><title>PANG</title>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

/**
 * Static requests — stale-while-revalidate.
 */
async function handleStatic(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);
  const fetchPromise = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached ?? fetchPromise;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never cache API routes (A7 — trusted-data discipline).
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Static assets: Next.js writes to /_next/static/* with hashes.
  // Fonts, icons, manifest: cacheable.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(handleStatic(event));
  }
});

// Declarative Web Push — subscribed only for gallery-originated
// verification outcomes. The payload schema is enforced at send time
// server-side; here we simply trust it and render.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "PANG", {
      body: data.body ?? "",
      tag: data.tag ?? "pang",
      badge: "/icons/icon-192.png",
      icon: "/icons/icon-192.png",
      silent: false,
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if (client.url.endsWith(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
