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

// Bump on any SW logic change so old caches are dropped on activate.
// iter #19: bump from v0.1.0-iteration-0 → v0.2.0-iter-19. Older
// versions cached every navigation under the literal key "/" and a
// 2 s network timeout would serve that stale cached "/" for any
// later route. Combined with iter #17's pre-fix 500 page being
// cached, users got a stuck "This page couldn't load" served from
// their own SW instead of the live page. The fixes below scope
// caches per-URL and tighten the offline fallback.
const VERSION = "v0.2.0-iter-19";
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
      // Cache only successful HTML navigations. iter #19: never
      // cache a non-OK response — a 500 from a bad deploy would
      // otherwise stick in the shell cache and be served as the
      // offline fallback for every subsequent route. Cache only
      // the Room shell (the home navigation) so an offline reload
      // returns the wall, not whatever route the user happened to
      // be on when the network dropped.
      if (preload.ok && new URL(event.request.url).pathname === "/") {
        cache.put("/", preload.clone()).catch(() => {});
      }
      return preload;
    }

    const networkRace = Promise.race([
      fetch(event.request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000),
      ),
    ]);

    const response = await networkRace;
    if (response && response.ok && new URL(event.request.url).pathname === "/") {
      cache.put("/", response.clone()).catch(() => {});
    }
    return response;
  } catch {
    // Offline fallback only for the home route. iter #19: a 2 s
    // timeout on a slow `/scan` should NOT serve a cached `/`; let
    // the browser surface the actual network failure instead. The
    // collector's own retry on a slow connection then hits the
    // network freshly rather than getting stuck on a stale shell.
    if (new URL(event.request.url).pathname === "/") {
      const cached = await cache.match("/");
      if (cached) return cached;
    }
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
// server-side; here we trust the wire shape and render.
//
// Iter #10: the payload kind is always `"outcome"` carrying
// (requestId, workId, outcome, decidedAt). The SW:
//
//   1. Renders a museumsschild notification (title + body live in the
//      SW so the wire shape stays small — primitive 53).
//   2. Broadcasts an `{ kind: "verification.outcome", ... }` event on
//      the `pang-verification` BroadcastChannel so any open tab
//      running the reconciler flips its store immediately, without a
//      reload.
//   3. Binds `notificationData.url` to `/?work=<workId>` so a tap
//      opens the Room focused on the work.
//
// Museumsschild voice: the notification title is the state that just
// became true ("a gallery has confirmed a work"), not an alert. The
// body names the work if we had the title on the wire, but we do not
// — the payload is three fields. A later iter may add a short subject
// line from the agent once the injection-hardened path is verified.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  if (!data || data.kind !== "outcome") return;

  const outcome = data.outcome;
  const workId = typeof data.workId === "string" ? data.workId : "";
  let title;
  let body;
  if (outcome === "confirmed") {
    title = "a gallery has confirmed a work.";
    body = "the work is now verified on the wall.";
  } else if (outcome === "declined") {
    title = "a gallery has answered.";
    body = "the work remains as it is.";
  } else if (outcome === "expired") {
    title = "the ask went quiet.";
    body = "the signed link elapsed without an answer.";
  } else {
    return;
  }

  const url = workId ? `/?work=${encodeURIComponent(workId)}` : "/";

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, {
          body,
          tag: `pang/verification/${workId || "default"}`,
          badge: "/icons/icon-192.png",
          icon: "/icons/icon-192.png",
          silent: false,
          requireInteraction: false,
          data: { url, requestId: data.requestId, workId, outcome },
        });
      } catch {
        // A showNotification failure should not swallow the
        // BroadcastChannel relay — any open tab is still our best
        // correctness path.
      }
      // Relay to any open tab. BroadcastChannel is fire-and-forget;
      // a missing listener drops the event silently.
      try {
        const bc = new BroadcastChannel("pang-verification");
        bc.postMessage({
          kind: "verification.outcome",
          requestId: data.requestId,
          workId,
          outcome,
          decidedAt: data.decidedAt,
        });
        bc.close();
      } catch {
        // Ignore — some embedded runtimes drop BroadcastChannel.
      }
    })(),
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
