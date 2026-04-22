/**
 * PANG — service-worker registration.
 *
 * Registers `/sw.js` at scope `/`. Enables Navigation Preload as early
 * as possible (redundant with the SW's own activate handler, but
 * cheaper than waiting for the second load).
 *
 * No user-facing UI. Failures are observable only (iteration #5 wires
 * the span). Registration is a best-effort enhancement — the app
 * works without it; offline boot (P4) is the only capability that
 * degrades.
 */

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      type: "classic",
      updateViaCache: "none",
    });

    if (registration.navigationPreload) {
      await registration.navigationPreload.enable();
    }

    // Roll updates as they arrive. The SW itself calls `skipWaiting`
    // so no prompt is needed; the next navigation picks up the new
    // version transparently. This matches the "silent between
    // sessions" doctrine — no "new version available" banner.
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // No-op for now. iteration #5 emits an observability span.
      });
    });
  } catch {
    // Registration failure is non-fatal. The shell still works from
    // network. iteration #5 wires the span to `pang.sw.register.fail`.
  }
}
