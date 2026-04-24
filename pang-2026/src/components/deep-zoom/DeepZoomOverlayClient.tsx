"use client";

/**
 * PANG — deep-zoom overlay, production composition.
 *
 * Home-route adapter around `<DeepZoomConnector>`. Subscribes to the
 * works store's `entries` so that a `setActiveDeepZoom` write (from
 * the Room's second-tap binding) mounts `<DeepZoom>` against the
 * *current* entry list — if the collector edits a work between tap
 * and render, the resolver lands on the latest tileSource or
 * returns `null` (unmounting the stale overlay, which is safe).
 *
 * Composition only. Lifecycle + telemetry + escape semantics live
 * in `DeepZoom`; resolver logic lives in `src/deep-zoom/resolve.ts`.
 */

import type { ReactElement } from "react";
import { DeepZoomConnector } from "@/components/deep-zoom/DeepZoom";
import { resolveTileSource } from "@/deep-zoom/resolve";
import { useWorks } from "@/stores/works";

export function DeepZoomOverlayClient(): ReactElement {
  const entries = useWorks((s) => s.entries);
  return (
    <DeepZoomConnector
      resolve={(workId, fileRef) =>
        resolveTileSource(workId, fileRef, entries)
      }
    />
  );
}
