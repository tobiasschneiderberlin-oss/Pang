/**
 * PANG — deep-zoom resolver.
 *
 * Bridges the works store to the `DeepZoomConnector` (Primitive §21).
 *
 *   - `resolveTileSource(workId, fileRef, entries)` is pure: given
 *     the current entry list and the composite's two halves, return
 *     the matching `TileSource` or `null`. No store read, no render
 *     dependency — testable in isolation.
 *
 *   - `openDeepZoomForWork(workId)` is the production-side helper
 *     that reads the live works store, looks up the entry, and
 *     writes the `activeDeepZoom` composite using the entry's
 *     tileSource URL as `fileRef`. Called from the Room's second-
 *     tap binding; no-op when the entry has no tile source (the
 *     work still hangs on the wall, the second tap is simply
 *     discarded — better than surfacing a loading spinner on an
 *     image we can't serve at depth).
 *
 * The `:` separator in the composite key means a tile URL containing
 * `:` would split wrong with naive `split(":")`. The DeepZoom
 * connector already handles this by using `indexOf(":")` and
 * `slice` — we produce composites with a single separator and let
 * any `:` in the URL live on the right-hand side untouched.
 */

import type { TileSource } from "@/deep-zoom/source";
import { useWorks, type CollectionEntry } from "@/stores/works";

/**
 * Pure resolver. Returns the TileSource matching `(workId, fileRef)`
 * from `entries`, or `null` if the work doesn't exist, has no
 * tileSource, or the fileRef doesn't match the tileSource's URL.
 *
 * The fileRef check is a lightweight safety valve — the composite
 * key was written with the entry's URL, so a mismatch means the
 * entry was edited between the tap and the render. Returning `null`
 * in that case unmounts the stale overlay, which is the right
 * answer.
 */
export function resolveTileSource(
  workId: string,
  fileRef: string,
  entries: readonly CollectionEntry[],
): TileSource | null {
  const entry = entries.find((e) => e.id === workId);
  if (!entry?.tileSource) return null;
  if (entry.tileSource.url !== fileRef) return null;
  return entry.tileSource;
}

/**
 * Read the current works store, find the entry, and write the
 * `activeDeepZoom` composite. No-op if the entry is missing or has
 * no `tileSource`.
 *
 * This is the only write to `activeDeepZoom` from the Room; the
 * connector's Escape / close button / focus-change paths are the
 * only writes of `null`. Keeping the open-write centralised here
 * means the failure mode is trivially observable: no
 * `deep_zoom.open` span ⇒ either no tileSource or no entry.
 */
export function openDeepZoomForWork(workId: string): void {
  const { entries, setActiveDeepZoom } = useWorks.getState();
  const entry = entries.find((e) => e.id === workId);
  if (!entry?.tileSource) return;
  setActiveDeepZoom(`${workId}:${entry.tileSource.url}`);
}
