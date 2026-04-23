"use client";

/**
 * PANG — client boot island.
 *
 * Mounted once at the layout root. Responsibilities:
 *   1. Project the preferences store to :root (knobs.css consumers).
 *   2. Bootstrap OPFS so the storage root exists before any write.
 *   3. Hydrate the works store from OPFS (the collection survives
 *      restarts) and install a subscription that keeps OPFS in
 *      lockstep with the store for the rest of the session.
 *   4. Register the service worker with navigation preload.
 *   5. Detect capability tier and write it to data-tier.
 *
 * No UI. No context providers. This is a side-effect component — the
 * rest of the tree reads from the store, the DOM, and OPFS directly.
 */

import { useEffect } from "react";
import { bindPreferencesToRoot } from "@design/preferences";
import { bootstrapOpfs } from "@/lib/storage/bootstrap";
import { useWorks } from "@/stores/works";
import {
  hydrateWorks,
  installWorksPersistence,
} from "@/stores/works.persist";
import { registerServiceWorker } from "@/sw/register";
import { detectCapabilityTier } from "@/auth/tier";
import {
  installGlobalErrorBeacons,
  reportFailure,
} from "@/lib/telemetry/beacon";

export function AppBoot(): null {
  useEffect(() => {
    // App-wide failure beacons. Installs `window.onerror` +
    // `onunhandledrejection`; any error that escapes a try/catch
    // anywhere in the client bundle lands in /api/telemetry and
    // shows up in Vercel function logs. Idempotent.
    installGlobalErrorBeacons();

    const unbindPrefs = bindPreferencesToRoot();

    // Fire-and-observe. Each step is idempotent and logs its own
    // errors into observability (A16); none blocks the others.
    void registerServiceWorker();

    // OPFS bootstrap must complete before hydration so the /works
    // directory exists; hydration must complete before the
    // subscription installs so we don't over-write with an empty
    // snapshot. After that, the subscription keeps OPFS in sync.
    let unsubscribeWorks: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      try {
        await bootstrapOpfs();
        if (cancelled) return;
        const hydrated = await hydrateWorks();
        if (cancelled) return;
        for (const entry of hydrated) {
          useWorks.getState().addEntry(entry);
        }
        unsubscribeWorks = installWorksPersistence();
      } catch (err) {
        reportFailure({
          errorKey: "persist/bootstrap",
          stage: "boot",
          site: "AppBoot/opfs-hydrate",
          detail:
            err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      }
    })();

    const tier = detectCapabilityTier();
    document.documentElement.dataset["tier"] = tier;

    return () => {
      cancelled = true;
      unsubscribeWorks?.();
      unbindPrefs();
    };
  }, []);

  return null;
}
