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
import { bindPreferencesToRoot, usePreferences } from "@design/preferences";
import {
  hydratePreferences,
  installPreferencesPersistence,
} from "@design/preferences.persist";
import { bootstrapOpfs } from "@/lib/storage/bootstrap";
import { useWorks } from "@/stores/works";
import {
  hydrateWorks,
  installWorksPersistence,
} from "@/stores/works.persist";
import { useVerification } from "@/stores/verification";
import {
  hydrateVerification,
  installVerificationPersistence,
} from "@/stores/verification.persist";
import { useNarrative } from "@/stores/narrative";
import {
  installDispatchedVisibilityWalker,
  installOnlineDrain,
  installOutcomeBroadcastListener,
  reconcileVerification,
  walkDispatchedOnce,
} from "@/verification/reconcile";
import { installConfirmBridge } from "@/verification/confirm-bridge";
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

    // E2E seed hook. Behind the `NEXT_PUBLIC_PANG_E2E=1` env var so
    // the prod bundle ships no window surface. Lets Playwright seed
    // works + focus + viewer state without driving the scanner end-
    // to-end (the fake media stream is not a reliable source for
    // full-stack intake in CI). Exposure is the minimal API — the
    // store instance itself, no setters — because Zustand stores
    // carry their own `.getState()` / `.setState()` already.
    // Iter #15: expose a hydration-ready promise the E2E spec awaits
    // before interacting. Declared here so the closure over
    // `resolveHydrationReady` lives through the async chain below.
    // The Deferred pattern avoids TypeScript narrowing the setter
    // through flow analysis of the Promise constructor.
    interface Deferred {
      promise: Promise<void>;
      resolve: () => void;
    }
    function makeDeferred(): Deferred {
      let res: () => void = () => {};
      const promise = new Promise<void>((r) => {
        res = r;
      });
      return { promise, resolve: res };
    }
    const hydrationDeferred =
      process.env["NEXT_PUBLIC_PANG_E2E"] === "1" ? makeDeferred() : null;
    const hydrationReady: Promise<void> | null =
      hydrationDeferred?.promise ?? null;

    if (process.env["NEXT_PUBLIC_PANG_E2E"] === "1") {
      const token = process.env["NEXT_PUBLIC_PANG_E2E_TOKEN"] ?? "";
      type E2ESeed =
        | { action: "clear" }
        | { action?: "seed"; userId?: string };
      async function authSeed(input: E2ESeed = {}): Promise<unknown> {
        const res = await fetch("/api/auth/e2e-seam", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-pang-e2e": token,
          },
          credentials: "same-origin",
          body: JSON.stringify(input),
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`authSeed failed: ${res.status}`);
        }
        return res.status === 204 ? null : res.json();
      }
      (
        window as unknown as {
          __PANG?: {
            useWorks: typeof useWorks;
            useVerification: typeof useVerification;
            useNarrative: typeof useNarrative;
            usePreferences: typeof usePreferences;
            authSeed: typeof authSeed;
            hydrationReady: Promise<void> | null;
          };
        }
      ).__PANG = {
        useWorks,
        useVerification,
        useNarrative,
        usePreferences,
        authSeed,
        hydrationReady,
      };
    }

    const unbindPrefs = bindPreferencesToRoot();

    // Fire-and-observe. Each step is idempotent and logs its own
    // errors into observability (A16); none blocks the others.
    void registerServiceWorker();

    // OPFS bootstrap must complete before hydration so the /works
    // directory exists; hydration must complete before the
    // subscription installs so we don't over-write with an empty
    // snapshot. After that, the subscription keeps OPFS in sync.
    let unsubscribeWorks: (() => void) | null = null;
    let unsubscribeVerification: (() => void) | null = null;
    let unsubscribePreferences: (() => void) | null = null;
    let unsubscribeOnline: (() => void) | null = null;
    let unsubscribeDispatchedWalker: (() => void) | null = null;
    let unsubscribeOutcomeBroadcast: (() => void) | null = null;
    let unsubscribeConfirmBridge: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      try {
        await bootstrapOpfs();
        if (cancelled) return;
        // Preferences hydrate ahead of any other surface so the
        // :root projection (which already mounted above) reflects
        // the collector's prior choices the first paint after boot.
        // Silence-default (primitive 73) wins on fresh install because
        // the OPFS file does not exist yet.
        const persistedPrefs = await hydratePreferences();
        if (cancelled) return;
        usePreferences.getState().hydrate(persistedPrefs);
        unsubscribePreferences = installPreferencesPersistence();
        // Hydration-ready signal for the E2E spec. Resolves after
        // the OPFS snapshot has been absorbed AND the persistence
        // subscription is live — so a test click after this fires
        // a durable write to OPFS, not a value clobbered by a late
        // hydrate().
        hydrationDeferred?.resolve();
        // Works + verification hydrate in parallel — the two stores
        // are independent slices of OPFS.
        const [hydratedWorks, hydratedVerification] = await Promise.all([
          hydrateWorks(),
          hydrateVerification(),
        ]);
        if (cancelled) return;
        for (const entry of hydratedWorks) {
          useWorks.getState().addEntry(entry);
        }
        // Rehydrate verification state entry-by-entry so the store's
        // transition guards stay honest. `replaceState` accepts any
        // shape the parser returns.
        for (const [workId, state] of Object.entries(
          hydratedVerification.entries,
        )) {
          useVerification.getState().replaceState(workId, state);
        }
        for (const [workId, decision] of Object.entries(
          hydratedVerification.push,
        )) {
          useVerification.getState().setPushDecision(workId, decision);
        }
        unsubscribeWorks = installWorksPersistence();
        unsubscribeVerification = installVerificationPersistence();

        // Reconcile the verification slice against the durable
        // outbox. Any drift (orphan outbox records, lost optimistic
        // flips) is resolved and logged via `verification.reconcile`.
        // Reconcile kicks `drainOutbox` at the end, so any due
        // records replay immediately.
        await reconcileVerification();
        // Replay on `online` transitions so an offline burst of
        // requests flushes the moment connectivity returns.
        unsubscribeOnline = installOnlineDrain();
        // Dispatched-state walker: on every `visibilitychange` to
        // "visible", poll /api/verification/outcome for each record
        // in the `"dispatched"` state. Push is the primary rail; this
        // is the guaranteed-available reconciliation path for when
        // push was denied / silenced / expired. Also run once on boot
        // so a cold start after a long absence picks up any outcome
        // that landed while the tab was closed.
        unsubscribeDispatchedWalker = installDispatchedVisibilityWalker();
        void walkDispatchedOnce().catch(() => {});
        // Push → BroadcastChannel → store. An outcome push arriving
        // while the tab is open flips the store on the same tick,
        // so the Room lifts from dormant before the collector even
        // taps the notification. The BC payload is a trigger only;
        // `pollOutcomeOnce` re-fetches the authoritative outcome
        // through the server's auth gate.
        unsubscribeOutcomeBroadcast = installOutcomeBroadcastListener();
        // Verification → works bridge. On every transition of a
        // verification state into "confirmed" the bridge flips the
        // owning collection entry's status to "verified", so The
        // Room's emissive lifts from dormant to verified-rest on
        // the same tick the gallery answers. Installs after
        // hydration so the subscription observes real transitions
        // (a fresh install sees an already-confirmed snapshot as
        // current, not a change event).
        unsubscribeConfirmBridge = installConfirmBridge();
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
      unsubscribeVerification?.();
      unsubscribePreferences?.();
      unsubscribeOnline?.();
      unsubscribeDispatchedWalker?.();
      unsubscribeOutcomeBroadcast?.();
      unsubscribeConfirmBridge?.();
      unbindPrefs();
    };
  }, []);

  return null;
}
