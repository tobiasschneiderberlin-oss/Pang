"use client";

/**
 * PANG — service worker registration.
 *
 * Renders nothing. On mount in production builds it registers the
 * `/sw.js` service worker, which makes the app installable as a PWA
 * and serves a previously-visited route from cache when offline.
 *
 * Why production-only: a registered SW caches aggressively. In dev
 * that turns iteration into "why is my page stale?" debugging. If
 * you accidentally registered a SW in dev once, clear it via
 * DevTools → Application → Service workers → Unregister.
 */

import { useEffect } from "react";

export function SwRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Registration can fail in private mode, behind some corporate
      // proxies, or when the SW file 404s. Don't crash the app over it.
      // eslint-disable-next-line no-console
      console.warn("[SW] registration failed:", err);
    });
  }, []);

  return null;
}
