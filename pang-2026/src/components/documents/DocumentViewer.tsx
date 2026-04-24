"use client";

/**
 * PANG — the tactile document viewer.
 *
 * A full-screen `<canvas>` overlay that paints a document (PDF page 1
 * or a single image) and lets the collector pinch-zoom into it. Back
 * gestures — pinch-out past the fit-to-viewport threshold, drag-down
 * past 120 px, or Escape — close the viewer. No other chrome.
 *
 * The viewer is the "paint in" gesture from the spine: the gesture
 * that says the collector trusts the work enough to bring it close
 * to her eye. It is not a document-management surface; it is a
 * magnifier.
 *
 * Stack:
 *   - `<canvas>` paints the rasterised page at `zoom × fit × DPR`.
 *     Image MIMEs rasterise once into an `ImageBitmap` + redraw on
 *     each state tick. PDFs rasterise page 1 via pdfjs-dist 4.x into
 *     an off-screen canvas, then blit into the viewport.
 *   - Pointer events go through `GestureTracker` (see
 *     `src/documents/viewer.ts`) — pure math, no DOM coupling.
 *   - Overlay chrome: a muji `x more pages.` line for multi-page
 *     PDFs (page 1 only in v1); a muji "this document is no longer
 *     available." line when the bytes are gone.
 *
 * Contracts:
 *   - Opening the viewer sets `activeViewer` in the works store to
 *     `${workId}:${fileRef}`. The Room canvas gates its RAF on this,
 *     so opening the viewer pauses the scene's GPU.
 *   - Closing writes `activeViewer = null` and focus stays on the
 *     original work — the back gesture lands on the scene exactly
 *     where we left it. `documents.viewer.close` names the `via`.
 *   - Zoom-depth telemetry fires on level *changes*, not per tick.
 *     A pinch from 1 → 8 × fires three events (levels 2, 3, 4), not
 *     three hundred.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useWorks } from "@/stores/works";
import { useSurfaceClaim } from "@/stores/use-surface-claim";
import { DOCUMENTS_VIEWER, DOCUMENT_VIEWER_LABEL } from "@/ai/chapter/voice";
import { readDocumentBytes } from "@/documents/bytes";
import {
  documentsViewerCloseEvent,
  documentsViewerOpenEvent,
  documentsViewerZoomDepthEvent,
} from "@/documents/otel";
import {
  GestureTracker,
  IDENTITY_STATE,
  applyPan,
  applyPinch,
  dragDownThreshold,
  fitToViewport,
  pinchOutThreshold,
  zoomDepthLevel,
  type ViewerState,
} from "@/documents/viewer";

/**
 * Viewer connector. Reads `activeViewer` + the focused entry's
 * documents; mounts the inner viewer when a match is found. Unmounts
 * on close, re-mounts (via key) on a new file.
 */
export function DocumentViewerConnector(): ReactElement | null {
  const activeViewer = useWorks((s) => s.activeViewer);
  const entries = useWorks((s) => s.entries);
  const resolved = useMemo(() => {
    if (!activeViewer) return null;
    const sep = activeViewer.indexOf(":");
    if (sep <= 0) return null;
    const workId = activeViewer.slice(0, sep);
    const fileRef = activeViewer.slice(sep + 1);
    const entry = entries.find((e) => e.id === workId);
    if (!entry) return null;
    const doc = (entry.documents ?? []).find((d) => d.fileRef === fileRef);
    if (!doc) return null;
    return { workId, doc };
  }, [activeViewer, entries]);
  if (!resolved) return null;
  return (
    <DocumentViewer
      key={`${resolved.workId}:${resolved.doc.fileRef}`}
      workId={resolved.workId}
      fileRef={resolved.doc.fileRef}
      mime={resolved.doc.mime}
      kind={resolved.doc.type}
    />
  );
}

interface DocumentViewerProps {
  readonly workId: string;
  readonly fileRef: string;
  readonly mime: "application/pdf" | "image/png" | "image/jpeg";
  readonly kind: "coa" | "invoice" | "condition_report";
}

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      bitmap: OffscreenCanvas | ImageBitmap;
      intrinsicW: number;
      intrinsicH: number;
      morePages: number;
    }
  | { kind: "missing" };

function DocumentViewer(props: DocumentViewerProps): ReactElement {
  // Iteration #11 — claim the document-viewer surface. The outcome
  // chapter waits for Room; a confirmation during a viewer session
  // queues until the collector closes back to the Room.
  useSurfaceClaim("document-viewer");

  const setActiveViewer = useWorks((s) => s.setActiveViewer);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const stateRef = useRef<ViewerState>(IDENTITY_STATE);
  const trackerRef = useRef<GestureTracker | null>(null);
  const fitRef = useRef<number>(1);
  const viewportRef = useRef<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });
  const zoomLevelRef = useRef<number>(1);

  // Emit `documents.viewer.open` once per mount.
  useEffect(() => {
    documentsViewerOpenEvent(props.workId, props.fileRef, props.kind);
    // Close-on-unmount fires in the close paths below; we don't
    // double-emit here.
  }, [props.workId, props.fileRef, props.kind]);

  // Close helpers — unify the telemetry + store write.
  const close = useRef((via: "pointer" | "keyboard" | "focus_change") => {
    documentsViewerCloseEvent(props.workId, props.fileRef, via);
    setActiveViewer(null);
  });

  // Load document bytes from OPFS + rasterise. PDFs go through
  // pdfjs-dist (dynamic import so the viewer chunk is the only caller
  // that pays its cost); images go through `createImageBitmap` which
  // is zero-copy on the main thread once the Blob lands.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const bytes = await readDocumentBytes(
        props.workId,
        props.fileRef,
        props.mime,
      );
      if (cancelled) return;
      if (!bytes) {
        setLoad({ kind: "missing" });
        return;
      }
      if (bytes.mime === "image/png" || bytes.mime === "image/jpeg") {
        try {
          const bitmap = await createImageBitmap(bytes.file);
          if (cancelled) {
            bitmap.close?.();
            return;
          }
          setLoad({
            kind: "ready",
            bitmap,
            intrinsicW: bitmap.width,
            intrinsicH: bitmap.height,
            morePages: 0,
          });
        } catch {
          setLoad({ kind: "missing" });
        }
        return;
      }
      // PDF path.
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        const buffer = await bytes.file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        const doc = await loadingTask.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        const page = await doc.getPage(1);
        if (cancelled) {
          void doc.destroy();
          return;
        }
        // Render at a reasonable raster resolution — the canvas
        // re-scales on draw, so a 2× source is plenty for the
        // zoom-in experience. Heavier DPR costs memory with no
        // sharpness win past 3×.
        const viewport = page.getViewport({ scale: 2 });
        const off = new OffscreenCanvas(viewport.width, viewport.height);
        const ctx = off.getContext("2d");
        if (!ctx) {
          void doc.destroy();
          setLoad({ kind: "missing" });
          return;
        }
        await page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setLoad({
          kind: "ready",
          bitmap: off,
          intrinsicW: viewport.width,
          intrinsicH: viewport.height,
          morePages: Math.max(0, doc.numPages - 1),
        });
        void doc.destroy();
      } catch {
        setLoad({ kind: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.workId, props.fileRef, props.mime]);

  // Initial viewport measure + tracker setup. Re-runs only on
  // layout changes via the resize observer.
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    trackerRef.current = new GestureTracker();
    const ro = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      viewportRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      // If already-loaded, re-fit. The fit derives from intrinsic +
      // viewport; state is reset so zoom "starts" at the new fit.
      if (load.kind === "ready") {
        fitRef.current = fitToViewport(
          load.intrinsicW,
          load.intrinsicH,
          rect.width,
          rect.height,
        );
        stateRef.current = IDENTITY_STATE;
        drawNow();
      }
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      trackerRef.current?.clear();
      trackerRef.current = null;
    };
    // `load.kind === "ready"` branches live inside — depending on
    // `load` would recreate the tracker on every load state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the bitmap is in, compute the fit and draw a first frame.
  useEffect(() => {
    if (load.kind !== "ready") return;
    const { w, h } = viewportRef.current;
    if (w === 0 || h === 0) return;
    fitRef.current = fitToViewport(load.intrinsicW, load.intrinsicH, w, h);
    stateRef.current = IDENTITY_STATE;
    zoomLevelRef.current = zoomDepthLevel(1);
    drawNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Paint the current state. Called per gesture sample + on load.
  const drawNow = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = viewportRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (load.kind !== "ready") return;
    const effectiveZoom = fitRef.current * stateRef.current.zoom;
    const drawW = load.intrinsicW * effectiveZoom;
    const drawH = load.intrinsicH * effectiveZoom;
    // Centre + pan. We draw in DPR-scaled pixels so the bitmap stays
    // crisp at high zoom.
    const cx = w / 2 + stateRef.current.panX;
    const cy = h / 2 + stateRef.current.panY;
    const x = cx - drawW / 2;
    const y = cy - drawH / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // `drawImage` accepts `OffscreenCanvas` and `ImageBitmap`; no
    // runtime check needed.
    ctx.drawImage(
      load.bitmap as CanvasImageSource,
      x,
      y,
      drawW,
      drawH,
    );
  };

  // Pointer handlers. `touch-action: none` on the canvas element
  // keeps the browser from synthesising scroll from a pinch.
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    trackerRef.current?.pointerDown({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const sample = tracker.pointerMove({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    if (!sample) return;
    const { w, h } = viewportRef.current;
    const prev = stateRef.current;
    if (sample.kind === "pinch") {
      stateRef.current = applyPinch(
        prev,
        sample.factor,
        sample.centreX,
        sample.centreY,
        w,
        h,
      );
      const level = zoomDepthLevel(stateRef.current.zoom);
      if (level !== zoomLevelRef.current) {
        zoomLevelRef.current = level;
        documentsViewerZoomDepthEvent(
          props.workId,
          props.fileRef,
          level,
        );
      }
    } else {
      stateRef.current = applyPan(prev, sample.deltaX, sample.deltaY);
    }
    drawNow();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // releasePointerCapture throws when the pointer is already gone;
      // harmless, but we swallow the specific error the way the
      // WebKit / Chromium pointer-capture tests expect.
    }
    const tracker = trackerRef.current;
    if (!tracker) return;

    // Check dismiss thresholds before we drop the pointer.
    const totalDy = tracker.totalVerticalDrag;
    const pinchedOut = pinchOutThreshold(stateRef.current);
    const draggedDown = dragDownThreshold(totalDy);
    tracker.pointerUp(e.pointerId);
    if (pinchedOut || draggedDown) {
      close.current("pointer");
    }
  };

  // Keyboard dismiss — Escape only; Enter + Space are navigation
  // keys that would close the viewer too aggressively when a screen-
  // reader user is reading through content.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close.current("keyboard");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Chrome overlays ----------------------------------------------
  //
  // Two muji lines may appear:
  //   - "this document is no longer available." when OPFS returned null
  //     (the bytes fell out behind the fileRef).
  //   - "N more pages." when the source PDF has pages beyond the first
  //     we rasterised. Both are sentence-case voice-corpus.

  const footerLine: string | null = (() => {
    if (load.kind === "missing") return DOCUMENTS_VIEWER.missingBytes;
    if (load.kind === "ready" && load.morePages > 0) {
      return DOCUMENTS_VIEWER.morePages(load.morePages);
    }
    return null;
  })();

  return (
    <div
      ref={hostRef}
      className="fixed inset-0 z-50 bg-paper"
      style={{ borderRadius: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={DOCUMENT_VIEWER_LABEL}
      data-pang-surface="document-viewer"
    >
      <canvas
        ref={canvasRef}
        // `touch-action: none` lets the pointer gesture layer own the
        // surface (Primitive §40 — pointer events + touch-action).
        className="block h-full w-full select-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden="true"
      />
      {footerLine && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 text-center"
          aria-hidden="true"
        >
          <span
            className="text-xs uppercase tracking-wide text-ink-ai"
            data-pang-source="voice-corpus"
          >
            {footerLine}
          </span>
        </div>
      )}
    </div>
  );
}
