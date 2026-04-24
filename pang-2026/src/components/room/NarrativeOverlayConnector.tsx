"use client";

/**
 * PANG — narrative overlay connector (iter #14).
 *
 * A tiny client island that runs the arrival hook and mounts the
 * overlay component. The page-level Server Component can include this
 * once; the hook + overlay take it from there.
 *
 * Lives at the page level (not inside `TheRoomClient`) for the same
 * reason the other connectors do: the overlay is chrome, The Room is
 * the art surface. Keeping them sibling components prevents a re-render
 * cascade on focus / zoom transitions.
 */

import type { ReactElement } from "react";
import { useNarrativeOverlay } from "./useNarrativeOverlay";
import { NarrativeOverlay } from "./NarrativeOverlay";

export function NarrativeOverlayConnector(): ReactElement {
  useNarrativeOverlay();
  return <NarrativeOverlay />;
}
