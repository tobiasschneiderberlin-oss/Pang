/**
 * PANG — OSD tile-source override for OPFS caching.
 *
 * Installs a `downloadTileStart` override on `viewer.source` after
 * OSD's `open` event fires. The override replaces OSD's default
 * `Image`-based loader with a `fetchTileCached` call:
 *
 *   - Cache hit  → convert Blob → HTMLImageElement → `context.finish(img)`
 *                  Emits `deep_zoom.cache.hit` + `deep_zoom.tile.load`
 *                  with `source: "opfs"`.
 *   - Cache miss → fetch() + store + convert + finish.
 *                  Emits `deep_zoom.cache.miss` + `deep_zoom.tile.load`
 *                  with `source: "network"`.
 *   - Failure    → `context.finish(null, null, msg)`.
 *                  Emits `deep_zoom.tile.load` with `ok: false`.
 *
 * Why a wrapper instead of a SW fetch handler: the handler would
 * also have to attribute hits/misses back to the main thread for
 * telemetry. Doing the work in-thread keeps the `source` attribution
 * hanging off the same call stack that decided to fetch — no
 * cross-thread message plumbing, and the Playwright heap-delta gate
 * still exercises the cache.
 *
 * The Object URL is revoked after OSD has copied the image into its
 * tile canvas (on the next microtask after `context.finish`). A
 * long-lived leaked Object URL is ≤ 1 KB of browser bookkeeping;
 * this is belt-and-braces.
 */

import type OpenSeadragon from "openseadragon";
import {
  deepZoomCacheEvictEvent,
  deepZoomCacheHitEvent,
  deepZoomCacheMissEvent,
  deepZoomTileLoadEvent,
} from "./otel";
import { fetchTileCached } from "./opfs-cache";

/**
 * Contract for the OSD ImageJob we hand to the override — narrowed
 * to just the fields the override touches. OSD's published type
 * declares `any` for `data`; we narrow to the Image shape we hand
 * back.
 */
interface ImageJobLike {
  src?: string;
  finish(
    data: HTMLImageElement | null,
    request: XMLHttpRequest | null,
    errorMessage: string | null,
  ): void;
}

/**
 * Install the override. Idempotent: calling twice on the same
 * viewer replaces the override with itself (the second install
 * wins, which is harmless when inputs are stable).
 */
export function installOpfsTileCacheOverride(
  viewer: OpenSeadragon.Viewer,
  workId: string,
  fileRef: string,
): void {
  viewer.addOnceHandler("open", () => {
    // OSD's TileSource is attached to each `TiledImage` in the
    // viewer's World (a single-image viewer has one TiledImage at
    // index 0). The type's `downloadTileStart` signature accepts
    // `context: ImageJob`. We shadow it with a narrower impl that
    // calls our cache.
    if (viewer.world.getItemCount() === 0) return;
    const item = viewer.world.getItemAt(0);
    if (!item) return;
    const source = item.source as unknown as {
      downloadTileStart(context: ImageJobLike): void;
    } | null;
    if (!source) return;

    source.downloadTileStart = (context: ImageJobLike): void => {
      const url = typeof context.src === "string" ? context.src : "";
      if (!url) {
        context.finish(null, null, "tile url missing");
        return;
      }
      const started = Date.now();
      fetchTileCached(
        url,
        undefined,
        {
          onEvict: (count, bytesFreed, bytesRemaining) => {
            deepZoomCacheEvictEvent(count, bytesFreed, bytesRemaining);
          },
        },
      )
        .then(({ blob, source: src }) => {
          if (src === "opfs") {
            deepZoomCacheHitEvent(workId, fileRef, blob.size);
          } else {
            deepZoomCacheMissEvent(workId, fileRef);
          }
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = (): void => {
            const duration = Date.now() - started;
            deepZoomTileLoadEvent(workId, fileRef, duration, true, src);
            context.finish(img, null, null);
            // OSD copies the image into its tile canvas synchronously
            // inside finish(); by the time the microtask below runs,
            // the Object URL is no longer needed.
            queueMicrotask(() => URL.revokeObjectURL(objectUrl));
          };
          img.onerror = (): void => {
            const duration = Date.now() - started;
            deepZoomTileLoadEvent(workId, fileRef, duration, false, src);
            URL.revokeObjectURL(objectUrl);
            context.finish(null, null, "image decode failed");
          };
          img.src = objectUrl;
        })
        .catch((err: unknown) => {
          const duration = Date.now() - started;
          deepZoomTileLoadEvent(workId, fileRef, duration, false, "network");
          const msg =
            err instanceof Error ? err.message : String(err ?? "fetch failed");
          context.finish(null, null, msg);
        });
    };
  });
}
