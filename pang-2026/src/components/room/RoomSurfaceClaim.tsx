"use client";

/**
 * PANG — Room surface claim (iter #11).
 *
 * The home route (`app/page.tsx`) is a Server Component; the active-
 * surface store is a client-only Zustand slice. A tiny client island
 * that does nothing but claim the stage keeps the page component
 * pure. Sibling of `RoomDOMTwin`, `DocumentsChapterConnector`, etc.
 *
 * The claim is idempotent and survives StrictMode's double-mount.
 * Unmount releases *only if* the Room is still the current owner —
 * a later surface (scan via client navigation, focus sub-surface)
 * takes the stage first, and the Room's cleanup respects that claim.
 */

import type { ReactElement } from "react";
import { useSurfaceClaim } from "@/stores/use-surface-claim";

export function RoomSurfaceClaim(): ReactElement | null {
  useSurfaceClaim("room");
  return null;
}
