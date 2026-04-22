"use client";

/**
 * PANG — client boot island.
 *
 * Mounted once at the layout root. Responsibilities:
 *   1. Project the preferences store to :root (knobs.css consumers).
 *   2. Bootstrap OPFS so the storage root exists before any write.
 *   3. Register the service worker with navigation preload.
 *   4. Detect capability tier and write it to data-tier.
 *
 * No UI. No context providers. This is a side-effect component — the
 * rest of the tree reads from the store, the DOM, and OPFS directly.
 */

import { useEffect } from "react";
import { bindPreferencesToRoot } from "@design/preferences";
import { bootstrapOpfs } from "@/lib/storage/bootstrap";
import { registerServiceWorker } from "@/sw/register";
import { detectCapabilityTier } from "@/auth/tier";

export function AppBoot(): null {
  useEffect(() => {
    const unbindPrefs = bindPreferencesToRoot();

    // Fire-and-observe. Each step is idempotent and logs its own
    // errors into observability (A16); none blocks the others.
    void bootstrapOpfs();
    void registerServiceWorker();

    const tier = detectCapabilityTier();
    document.documentElement.dataset["tier"] = tier;

    return () => {
      unbindPrefs();
    };
  }, []);

  return null;
}
