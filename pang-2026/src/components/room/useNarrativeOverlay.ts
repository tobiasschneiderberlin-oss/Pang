"use client";

/**
 * PANG — useNarrativeOverlay (iter #14).
 *
 * The arrival-trigger hook. Mounts alongside The Room and subscribes
 * to `useActiveSurface`. When the Room surface becomes active, the
 * hook waits a short settle delay, then fetches
 * `GET /api/narrative/current`. If the fetch returns 200, the hook
 * writes the response into the narrative session store; the overlay
 * component reads `isVisible` off the same store.
 *
 *   - 204 No Content → silence. The overlay does not render; the hook
 *     leaves the store's `current` as `null`.
 *   - 200 → `setCurrent(response)` — the overlay renders after the
 *     store's `isVisible` flips true.
 *   - 401 → the collector is not authenticated; silence.
 *   - fetch error → silence. The overlay is a passive surface; an
 *     error toast is the wrong register.
 *
 * Re-run discipline: the hook fires once per surface-transition into
 * `"room"`. It does not re-fire when a sub-surface (focus, deep-zoom,
 * documents) takes the stage and then releases back to Room — those
 * are *within-session* transitions the overlay's own session-scoped
 * dismissal already handles.
 */

import { useEffect } from "react";
import { useActiveSurface } from "@/stores/surface";
import { useNarrative } from "@/stores/narrative";
import { NarrativeCurrentResponseSchema } from "@/narrative/schema";

/**
 * Settle delay in ms between Room-active edge and the GET call. Long
 * enough for the arrival ceremony to feel unhurried; short enough the
 * fetch is in flight by the time the paint is done (network p50 ~120
 * ms on local dev, ~300 ms on LTE). 800 ms keeps the GET off the
 * critical paint path on real devices.
 *
 * Exposed for the Playwright spec to drive with URL query (see
 * `e2e/narrative-overlay.spec.ts`): a 0-ms override removes the
 * settle wait so the test doesn't race.
 */
export const NARRATIVE_SETTLE_MS = 800;

/**
 * Fire a GET, parse the response, and adopt into the store. Exported
 * for the Playwright spec and dev-tweaks wiring.
 */
export async function adoptCurrentNarrative(): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/narrative/current", {
      method: "GET",
      credentials: "same-origin",
    });
  } catch {
    // Network failure — silence.
    return;
  }
  if (response.status !== 200) {
    // 204 → silence; 401 → silence; 5xx → silence. The overlay is
    // passive; the Room keeps running.
    return;
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return;
  }
  const parsed = NarrativeCurrentResponseSchema.safeParse(json);
  if (!parsed.success) return;
  useNarrative.getState().setCurrent(parsed.data);
}

/**
 * The hook. Place inside a Room-hosted client island so it runs when
 * the Room mounts. Re-runs only on surface transition into `"room"`.
 *
 * Test harness: pass `{ settleMs: 0 }` to bypass the settle wait.
 */
export function useNarrativeOverlay(
  opts: { readonly settleMs?: number } = {},
): void {
  const active = useActiveSurface();
  const settleMs = opts.settleMs ?? NARRATIVE_SETTLE_MS;

  useEffect(() => {
    if (active !== "room") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      void adoptCurrentNarrative();
    }, settleMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, settleMs]);
}
