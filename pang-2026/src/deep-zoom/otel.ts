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
  | "deep_zoom.tile.load"
  | "deep_zoom.cache.hit"
  | "deep_zoom.cache.miss"
  | "deep_zoom.cache.evict";

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
 * Tile-load event. `durationMs` is the resolution delta measured by
 * the OPFS override (from its entry into `fetchTileCached` to the
 * point it hands bytes back to OSD). `source` separates cold
 * (`"network"`) from warm (`"opfs"`) paths so the SLO dashboard can
 * alert on a warm-path regression without drowning in cold noise.
 * A failed network fetch still fires once with `ok: false` and
 * `source: "network"` — the cache never serves garbage, so a failure
 * attribution is always network-side.
 *
 * Legacy note: the iter #7 signature accepted `"cache"` as a
 * synonym for `"opfs"`. Keeping the union narrow (just `"opfs"`)
 * avoids telemetry confusion — the OPFS layer is the only cache we
 * ship; there is no in-memory middle tier.
 */
export function deepZoomTileLoadEvent(
  workId: string,
  fileRef: string,
  durationMs: number,
  ok: boolean,
  source: "network" | "opfs" = "network",
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

/**
 * Cache hit — the OPFS layer resolved a tile without a network
 * round-trip. `bytes` is the tile size so a dashboard can reason
 * about hit-rate weighted by payload (a 50× warm-path speedup on
 * 3 KB tiles is different from the same speedup on 50 KB tiles).
 */
export function deepZoomCacheHitEvent(
  workId: string,
  fileRef: string,
  bytes: number,
): void {
  emit({
    event: "deep_zoom.cache.hit",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.work_id": workId,
      "pang.deep_zoom.file_ref": fileRef,
      "pang.deep_zoom.cache_bytes": bytes,
    },
  });
}

/**
 * Cache miss — the tile was not in OPFS and a network fetch is
 * about to fire. Companion to `deep_zoom.cache.hit`; their sum +
 * evict count is the per-session cache accounting signal.
 */
export function deepZoomCacheMissEvent(
  workId: string,
  fileRef: string,
): void {
  emit({
    event: "deep_zoom.cache.miss",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.work_id": workId,
      "pang.deep_zoom.file_ref": fileRef,
    },
  });
}

/**
 * Cache eviction — LRU trimmed `count` tiles (total `bytesFreed`)
 * to keep the cache at or under its soft ceiling. Diagnostic: a
 * dashboard that sees evicts climbing on warm sessions is a signal
 * the working set has outgrown the ceiling and we should bump
 * `DEFAULT_MAX_BYTES` (or, more likely, the quota probe has
 * tightened the effective ceiling because the origin is crowded).
 *
 * The event is scope-less (no work id) — eviction decisions are
 * global LRU, not per-work.
 */
export function deepZoomCacheEvictEvent(
  count: number,
  bytesFreed: number,
  bytesRemaining: number,
): void {
  emit({
    event: "deep_zoom.cache.evict",
    t: Date.now(),
    attrs: {
      "pang.deep_zoom.evict_count": count,
      "pang.deep_zoom.evict_bytes_freed": bytesFreed,
      "pang.deep_zoom.evict_bytes_remaining": bytesRemaining,
    },
  });
}
