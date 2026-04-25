"use client";

/**
 * PANG — Room body switch (iter #21).
 *
 * Reads `usePreferences().viewMode` and renders either the grid
 * (default, conventional photo overview) or the space (the WebGPU
 * Room canvas). Lives as a client component so the server tree
 * stays cheap and the WebGPU chunk only loads when the collector
 * actually toggles to the space view.
 *
 * The grid is the entry; the space is the depth. Iter #21's pivot.
 *
 * SSR note: on the server we render the grid unconditionally. The
 * preferences store hydrates from OPFS on the client; if the
 * collector's saved `viewMode` is `"space"`, the canvas mounts
 * after hydration. The split-second of "grid" the user sees on a
 * cold space-mode load is the same shape they see on every cold
 * reload of /scan — visually empty until the heavy module lands.
 * View Transitions smooth the swap.
 */

import type { ReactElement } from "react";
import { usePreferences } from "@design/preferences";
import { TheRoomClientDynamic } from "@/room/dom/TheRoomClientDynamic";
import { RoomGrid } from "@/components/room/RoomGrid";

export function RoomBody(): ReactElement {
  // The server renders with `DEFAULT_PREFERENCES.viewMode === "grid"`
  // and the client's first render mirrors it (same default initial
  // state in the zustand store), so there is no hydration mismatch
  // at this boundary. AppBoot's async OPFS hydration updates the
  // store afterwards; that update is a normal re-render, not a
  // hydration-time disagreement. No explicit suppression needed.
  const viewMode = usePreferences((s) => s.viewMode);
  return viewMode === "space" ? <TheRoomClientDynamic /> : <RoomGrid />;
}
