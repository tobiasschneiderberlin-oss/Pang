"use client";

/**
 * PANG — deep zoom (the painting magnifier).
 *
 * Primitive §21. The sole sanctioned call site for OpenSeadragon in
 * the codebase. The anti-pattern — a CSS `transform: scale(2)` on a
 * flat JPEG — is forbidden everywhere else in `src/` by the
 * `check-transforms` gate (folded into P24). When Laura pinches
 * past the flat-image ceiling, she arrives here, and OSD serves
 * tiles from the pyramid.
 *
 * This module is intentionally a thin wrapper. We own:
 *
 *   - Lifecycle. Mount instantiates an `OpenSeadragon.Viewer`;
 *     unmount calls `.destroy()`. No stale viewers, no stale tile
 *     caches, no stale canvas contexts — the Playwright harness
 *     asserts heap delta under 5 MB across 10 mount/unmount
 *     cycles.
 *   - Close contract. Escape (keyboard), Escape button (pointer),
 *     or focus change via the works store all land at the same
 *     exit: `setActiveDeepZoom(null)`, preserved `focusedId`. The
 *     iter #6 DocumentViewer contract generalised.
 *   - Telemetry. `deep_zoom.{open,close,zoom_depth,tile.load}`
 *     fire at OSD event boundaries; zoom-depth is bucketed on log
 *     scale so a pinch from 1 → 8× fires three events, not three
 *     hundred.
 *   - Chrome. `role="dialog" aria-label="deep zoom"` + a small
 *     Escape affordance in the top-right. OSD's own controls (home,
 *     zoom, fullscreen) are suppressed — its RAF already drives the
 *     surface, and PANG's voice does not need OSD's chrome.
 *
 * OSD owns everything else: pointer / wheel / pinch gestures, tile
 * requests, canvas management, easing. PANG's own gesture primitives
 * (Primitive §40) do not touch this surface. If we ever need a
 * second OSD call site, either a) inline its lifecycle here and pass
 * through, or b) extract a `createDeepZoomViewer()` helper in
 * `src/deep-zoom/` and let the second site consume it. Never a
 * second `new OpenSeadragon(...)` elsewhere.
 *
 * The connector (`DeepZoomConnector`) subscribes to `activeDeepZoom`
 * on the works store — same shape as `DocumentViewerConnector` —
 * and mounts `<DeepZoom>` when the composite key is set. Caller-side
 * API: `useWorks.getState().setActiveDeepZoom(\`${workId}:${tileRef}\`)`.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import OpenSeadragon from "openseadragon";
import { useWorks } from "@/stores/works";
import { DEEP_ZOOM_LABEL } from "@/ai/chapter";
import {
  deepZoomOpenEvent,
  deepZoomCloseEvent,
  deepZoomZoomDepthEvent,
  deepZoomTileLoadEvent,
  deepZoomDepthLevel,
} from "@/deep-zoom/otel";
import type { TileSource } from "@/deep-zoom/source";

/**
 * Tile source contract. The two shapes OSD consumes natively:
 *
 *   - `{ kind: "simple-image", url }` — flat JPEG / PNG fallback.
 *     No pyramid, no tiling; the surface exists, but the "paint
 *     strokes visible" promise waits on real DZI source.
 *   - `{ kind: "dzi", url }` — URL to a `.dzi` manifest. OSD reads
 *     the manifest, requests tile levels on demand. Real deep zoom.
 *
 * Definition lives in `src/deep-zoom/source.ts` (Zod-validated, used
 * by both the durable store and the runtime viewer). Re-exported
 * here under the legacy name `DeepZoomSource` so existing call
 * sites keep compiling.
 */
export type DeepZoomSource = TileSource;

export interface DeepZoomProps {
  readonly workId: string;
  readonly fileRef: string;
  readonly source: DeepZoomSource;
}

/**
 * Connector. Reads `activeDeepZoom` from the works store; when set,
 * parses the composite `${workId}:${fileRef}` key and mounts
 * `<DeepZoom>` against the matching entry's deep-zoom source. A
 * consumer writes `setActiveDeepZoom(composite)` to open; the
 * DeepZoom instance calls `setActiveDeepZoom(null)` to close.
 *
 * The iter #7 brief declares source-tile generation as out of scope;
 * the connector therefore accepts a direct source map or a
 * smoke-route pre-baked tile source. Callers in production pass a
 * resolver; the smoke route passes a fixed DZI / simple-image. See
 * `app/deep-zoom-smoke/page.tsx`.
 */
export interface DeepZoomConnectorProps {
  /**
   * Resolve a composite key to a tile source. Returns `null` if the
   * work has no deep-zoom source registered (in which case nothing
   * renders — the connector is a no-op).
   */
  readonly resolve: (
    workId: string,
    fileRef: string,
  ) => DeepZoomSource | null;
}

export function DeepZoomConnector(
  props: DeepZoomConnectorProps,
): ReactElement | null {
  const activeDeepZoom = useWorks((s) => s.activeDeepZoom);
  if (!activeDeepZoom) return null;
  const sep = activeDeepZoom.indexOf(":");
  if (sep <= 0) return null;
  const workId = activeDeepZoom.slice(0, sep);
  const fileRef = activeDeepZoom.slice(sep + 1);
  const source = props.resolve(workId, fileRef);
  if (!source) return null;
  return (
    <DeepZoom
      key={`${workId}:${fileRef}`}
      workId={workId}
      fileRef={fileRef}
      source={source}
    />
  );
}

export function DeepZoom(props: DeepZoomProps): ReactElement {
  const setActiveDeepZoom = useWorks((s) => s.setActiveDeepZoom);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const zoomLevelRef = useRef<number>(1);
  const [ready, setReady] = useState<boolean>(false);

  // Close helpers — unify telemetry + store write. Stable ref so the
  // keyboard effect does not re-subscribe on every state tick.
  // `closeEmittedRef` lets us fire a single `deep_zoom.close` on
  // unmount when the exit came from a focus change elsewhere (the
  // works store clears `activeDeepZoom` on `setFocusedId`, which
  // unmounts the connector without giving us a pointer/keyboard
  // path to hook).
  const closeEmittedRef = useRef<boolean>(false);
  const close = useRef((via: "pointer" | "keyboard" | "focus_change") => {
    if (closeEmittedRef.current) return;
    closeEmittedRef.current = true;
    deepZoomCloseEvent(props.workId, props.fileRef, via);
    setActiveDeepZoom(null);
  });

  // Mount / unmount OSD. This effect is the only `new OpenSeadragon`
  // call site in the repo (enforced by `check-transforms` + code
  // review). Deps lock the viewer to one composite key via the
  // connector's `key` prop — a new composite remounts.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const tileSources =
      props.source.kind === "simple-image"
        ? { type: "image", url: props.source.url }
        : props.source.url;

    const viewer = OpenSeadragon({
      element: host,
      tileSources,
      // Suppress OSD's default UI — PANG's dialog chrome is the
      // whole surface, and the iter #7 brief forbids overlaying
      // extra zoom controls. OSD still handles pinch / wheel /
      // keyboard internally (that's what P23 + Primitive §21
      // want).
      showNavigationControl: false,
      showNavigator: false,
      showFullPageControl: false,
      showHomeControl: false,
      showZoomControl: false,
      showRotationControl: false,
      showFlipControl: false,
      showSequenceControl: false,
      autoHideControls: true,
      immediateRender: true,
      // Visibility ratio of 1 keeps the image fitting inside the
      // viewport on open; the image cannot pan off-screen.
      visibilityRatio: 1,
      constrainDuringPan: true,
      // Lock the prefix to a copy we ship; OSD's default CDN
      // reference would be blocked by P6's strict CSP.
      prefixUrl: "/vendor/openseadragon/images/",
      // No DOM overlays. We own the dialog frame; OSD owns the
      // canvas inside.
      // OSD's `zoomToRefPoint: true` and `pinchRotate: false` defaults
      // are exactly what we want, so we don't re-declare them here —
      // @types/openseadragon's GestureSettings omits both fields, and
      // the defaults survive untouched.
      gestureSettingsTouch: {
        scrollToZoom: true,
        clickToZoom: false,
        dblClickToZoom: true,
        pinchToZoom: true,
        flickEnabled: true,
        flickMinSpeed: 120,
        flickMomentum: 0.25,
        dragToPan: true,
      },
    });
    viewerRef.current = viewer;

    viewer.addHandler("open", () => {
      setReady(true);
      deepZoomOpenEvent(props.workId, props.fileRef, props.source.kind);
    });

    viewer.addHandler("zoom", (event) => {
      const zoom = (event as OpenSeadragon.ZoomEvent).zoom;
      const level = deepZoomDepthLevel(zoom);
      if (level !== zoomLevelRef.current) {
        zoomLevelRef.current = level;
        deepZoomZoomDepthEvent(props.workId, props.fileRef, level);
      }
    });

    // Track tile load latency. The `time` attribute OSD hands us is
    // request-start wall clock ms; `Date.now() - time` is the
    // resolution duration. v1 reports `"network"`; the OPFS
    // write-through cache lands in a later iteration + will pass
    // `"cache"` instead.
    const onTileLoaded = (event: OpenSeadragon.TileLoadedEvent): void => {
      const tile = event.tile as unknown as { loadTime?: number };
      const started =
        typeof tile.loadTime === "number" ? tile.loadTime : Date.now();
      const durationMs = Math.max(0, Date.now() - started);
      deepZoomTileLoadEvent(
        props.workId,
        props.fileRef,
        durationMs,
        true,
        "network",
      );
    };
    const onTileLoadFailed = (
      event: OpenSeadragon.TileLoadFailedEvent,
    ): void => {
      const duration = typeof event.time === "number" ? event.time : 0;
      deepZoomTileLoadEvent(
        props.workId,
        props.fileRef,
        duration,
        false,
        "network",
      );
    };
    viewer.addHandler("tile-loaded", onTileLoaded);
    viewer.addHandler("tile-load-failed", onTileLoadFailed);

    return () => {
      // OSD's destroy tears down event listeners + cached tiles +
      // canvas contexts. This is the sole leak boundary.
      try {
        viewer.destroy();
      } catch {
        // destroy() throws if the viewer was already torn down by a
        // synchronous close race; harmless — the cleanup it was
        // meant to do has already run.
      }
      viewerRef.current = null;
    };
    // The connector remounts via `key` on composite change; we do
    // not want to recreate OSD on any prop mutation short of that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus the dialog on mount so its onKeyDown handler catches
  // Escape. The a11y contract for a `role="dialog" aria-modal`
  // surface is that focus enters the dialog on open; we satisfy it
  // here by calling `.focus()` on the container, which also solves
  // a routing problem. Competing keydown listeners (OSD's own
  // `canvasKeyHandler` cancels bubbling via `$.cancelEvent`; the
  // Next.js dev overlay registers capture-phase handlers that can
  // swallow Escape) made a `document`-level window listener
  // unreliable. Handling keydown on the dialog element itself —
  // which is where focus lives — guarantees the close path fires
  // before anything else reaches up the tree.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Emit `deep_zoom.close` with `via: "focus_change"` on unmount if
  // neither the pointer nor keyboard path already emitted. The works
  // store clears `activeDeepZoom` inside `setFocusedId`, which
  // unmounts the connector without passing through our handlers —
  // this effect names the exit so telemetry stays complete.
  //
  // The setup resets `closeEmittedRef.current = false`. React 19
  // StrictMode in dev-mode fires a cleanup-then-setup cycle on
  // mount; the cleanup side would otherwise trip the guard and
  // starve a subsequent pointer/keyboard close on the steady-state
  // remount. Resetting at setup time recovers the guard for the
  // live lifecycle; production (StrictMode off) sees a single
  // setup + a single cleanup and the reset is a no-op.
  useEffect(() => {
    closeEmittedRef.current = false;
    return () => {
      if (!closeEmittedRef.current) {
        closeEmittedRef.current = true;
        deepZoomCloseEvent(props.workId, props.fileRef, "focus_change");
      }
    };
  }, [props.workId, props.fileRef]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-paper focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={DEEP_ZOOM_LABEL}
      data-pang-surface="deep-zoom"
      data-pang-ready={ready ? "true" : "false"}
      onKeyDownCapture={(e) => {
        // Capture phase — runs before OSD's bubble-phase
        // `canvasKeyHandler`, which calls `cancelEvent` on Escape
        // and would otherwise swallow the event before the close
        // path fires. React delegates all events through the root,
        // so capture-phase handling here beats any descendant
        // bubble listener regardless of focus location.
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close.current("keyboard");
        }
      }}
    >
      <div
        ref={hostRef}
        // OSD injects its canvas into this host. The `touch-action:
        // none` keeps the browser from synthesising scroll from a
        // pinch — OSD owns the gesture. A fixed 100 % / 100 % box
        // gives OSD a stable measurement target.
        className="absolute inset-0 select-none"
        style={{ touchAction: "none" }}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => close.current("pointer")}
        className="absolute right-4 top-4 px-3 py-2 text-xs uppercase tracking-wide text-ink-ai"
        aria-label="close deep zoom"
        data-pang-source="voice-corpus"
      >
        close
      </button>
    </div>
  );
}
