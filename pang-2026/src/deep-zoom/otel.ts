/**
 * PANG — deep-zoom observability.
 *
 * Iteration #7's failure-mode declaration names four regression
 * classes that have to be observable when the deep-zoom surface
 * breaks:
 *
 *   1. CSS-scale backsliding — caught at CI time by `check-transforms`,
 *      not here. No runtime signal required.
 *   2. Tile-load jank — `deep_zoom.tile.load` fires per tile with
 *      `durationMs` + `source: "network"` (v1; `"cache"` joins when
 *      the OPFS write-through cache lands). The SLO (p95 < 200 ms
 *      warm) is named in the brief; live-gating waits for the cache.
 *   3. Memory leak on unmount — Playwright asserts heap delta; this
 *      module emits `deep_zoom.open` / `deep_zoom.close` so the
 *      harness can anchor its measurements to real mount cycles.
 *   4. Escape semantics — `deep_zoom.close` carries `via: "pointer"
 *      | "keyboard" | "focus_change"`, same contract as the
 *      document viewer (iter #6). Playwright verifies `focusedId`
 *      survives.
 *
 * Event catalogue:
 *
 *   deep_zoom.open           — adapter mounted; OSD viewer instantiated.
 *   deep_zoom.close          — adapter unmounted (pointer, key, focus_change).
 *   deep_zoom.zoom_depth     — coarse zoom bucket changed (log scale).
 *   deep_zoom.tile.load      — a tile request resolved (success or failure).
 *
 * Shape mirrors `src/documents/otel.ts` — single-line JSON on
 * `console.debug`, `pang.deep_zoom.*` attribute prefix. The future
 * collector ingests all PANG telemetry through one sink without
 * translation.
 */

export type DeepZoomEvent =
  | "deep_zoom.open"
  | "deep_zoom.close"
  | "deep_zoom.zoom_depth"
  | "deep_zoom.tile.load";

export interface DeepZoomEventPayload {
  readonly event: DeepZoomEvent;
  /** Wall-clock ms since epoch. */
  readonly t: number;
  readonly attrs: Record<
    string,
    string | number | boolean | readonly string[]
  >;
}

function emit(payload: DeepZoomEventPayload): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(JSON.stringify(payload));
  }
}

/** `sourceKind` is the TileSource flavour (`"dzi"` or `"simple-image"`). */
export function deepZoomOpenEvent(
  workId: string,
  fileRef: string,
  sourceKind: "dzi" | "simple-image",
): void {
  emit({
    event: "deep_zoom.open",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.work_id": workId,
      "pang.deep_zoom.file_ref": fileRef,
      "pang.deep_zoom.source_kind": sourceKind,
    },
  });
}

export function deepZoomCloseEvent(
  workId: string,
  fileRef: string,
  via: "pointer" | "keyboard" | "focus_change",
): void {
  emit({
    event: "deep_zoom.close",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.work_id": workId,
      "pang.deep_zoom.file_ref": fileRef,
      "pang.deep_zoom.close_via": via,
    },
  });
}

/**
 * Coarse zoom-depth bucket — `level` is a log bin (1 = fit-to-
 * viewport, 2 = doubled, 3 = 4×, etc.), mirroring the documents
 * viewer's convention. Fires on level *changes*, not per pinch
 * tick — a pinch from 1 → 8× fires three events, not three
 * hundred.
 */
export function deepZoomDepthLevel(zoom: number): number {
  if (!(zoom > 0) || !Number.isFinite(zoom)) return 1;
  return Math.max(1, Math.floor(Math.log2(zoom)) + 1);
}

export function deepZoomZoomDepthEvent(
  workId: string,
  fileRef: string,
  level: number,
): void {
  emit({
    event: "deep_zoom.zoom_depth",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.work_id": workId,
      "pang.deep_zoom.file_ref": fileRef,
      "pang.deep_zoom.zoom_level": level,
    },
  });
}

/**
 * Tile-load event. `durationMs` is the resolution delta reported by
 * OSD's own `tile-loaded` (or `tile-load-failed`) handler. `source`
 * is `"network"` in v1; when the OPFS write-through tile cache lands
 * it becomes `"cache" | "network"` so the SLO dashboard can separate
 * cold + warm paths.
 */
export function deepZoomTileLoadEvent(
  workId: string,
  fileRef: string,
  durationMs: number,
  ok: boolean,
  source: "network" | "cache" = "network",
): void {
  emit({
    event: "deep_zoom.tile.load",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.work_id": workId,
      "pang.deep_zoom.file_ref": fileRef,
      "pang.deep_zoom.tile_duration_ms": durationMs,
      "pang.deep_zoom.tile_ok": ok,
      "pang.deep_zoom.tile_source": source,
    },
  });
}
