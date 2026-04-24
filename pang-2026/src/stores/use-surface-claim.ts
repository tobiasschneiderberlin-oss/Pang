"use client";

/**
 * PANG — one-call surface claim hook (iter #11).
 *
 * The canonical shape for a route/surface component to register itself
 * as the active surface:
 *
 *     useSurfaceClaim("room");
 *
 * On mount, the hook calls `setActiveSurface(kind)`. On unmount it
 * calls `clearActiveSurface(kind)` — which is a no-op if a later
 * surface has already claimed the stage. The hook is idempotent under
 * StrictMode's double-mount (same `setActiveSurface` call).
 *
 * Why a hook and not a HOC or a server-component prop: React's layout
 * effect semantics give us deterministic mount ordering — layout
 * effects fire in tree order on mount, in reverse on unmount. A parent
 * route transition runs the new surface's layout effect *after* the
 * old one's cleanup, so the claim always reflects the current tree.
 */

import { useLayoutEffect } from "react";
import { useSurface, type SurfaceKind } from "./surface";

/**
 * Register the calling component as the active surface for its
 * lifetime. The `kind` should be a stable constant — do not pass a
 * value that changes across renders, or the hook will churn on every
 * rerender.
 */
export function useSurfaceClaim(kind: SurfaceKind): void {
  useLayoutEffect(() => {
    useSurface.getState().setActiveSurface(kind);
    return () => {
      useSurface.getState().clearActiveSurface(kind);
    };
  }, [kind]);
}
