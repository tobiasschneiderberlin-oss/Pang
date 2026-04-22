"use client";

/**
 * PANG — the viewfinder.
 *
 * Live camera feed behind a `<canvas>` overlay. The canvas draws:
 *   - the detected rectangle as four crisp corners (Primitive §15)
 *   - the segment bbox brackets (fallback for non-rectangular works)
 *
 * Scanning runs through the hybrid dispatcher
 * (`@/workers/cv/dispatch`). Rectangle detection is cheap and
 * always-on; MediaPipe segmentation wakes up lazily if rectangles
 * stay absent for ~1 s. Auto-capture fires on rectangle stability
 * > 0.9 held for `autoCaptureMs`, or on segment coverage > 0.15 held
 * for the same window.
 *
 * Frames are handed off as `ImageBitmap` (transferable), not as PNG
 * blobs — the old `OffscreenCanvas.convertToBlob({type:"image/png"})`
 * hot path stalled Laura's feed on mid-tier mobile (iteration-#1
 * finding §7). The capture path still uses PNG encode, one-off, off
 * the hot path.
 *
 * This component is the *surface*; the actual agent call happens in
 * the parent (`/scan`). The component does not know what happens
 * after capture — it emits bytes + sha, and a voice-authored failure
 * key on anything that goes wrong.
 *
 * Failure routing: any camera error goes through
 * `keyFromCameraError` + the `failure.ts` corpus before it reaches
 * Laura, so the failed-state screen never renders raw
 * `DOMException.message` text.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  openBackCamera,
  type CameraHandle,
  type FocusPoint,
} from "@/workers/cv/cameraControl";
import {
  createScannerDispatcher,
  type ScannerDispatcher,
  type ScannerEvent,
} from "@/workers/cv/dispatch";
import type { WorkerRectangle } from "@/workers/cv/rectangleDetector.worker";
import type { WorkerSegment } from "@/workers/cv/segmenter.worker";
import {
  keyFromCameraError,
  type FailureKey,
} from "@/ai/prompts/failure";

export interface ViewfinderProps {
  onCapture: (bytes: Uint8Array, sha256: string) => void;
  /** Voice-keyed failure. The key maps into the `failure.ts` corpus;
   *  the optional `Error` carries diagnostic text for telemetry only. */
  onError: (key: FailureKey, detail?: Error) => void;
  /** Milliseconds a stable detection must hold before auto-fire.
   *  Defaults to 700 ms, matched to Laura's hands in iteration #1. */
  autoCaptureMs?: number;
}

/** Segment-path coverage threshold. Below this the fallback path
 *  doesn't commit to capture — a thin foreground is almost always
 *  noise (a corner of a hand, a distant object). */
const SEGMENT_COVERAGE_GATE = 0.15;

/** Rectangle-path stability threshold, matched to the detector's
 *  EMA half-life (see `rectangleDetector.worker.ts`). */
const RECT_STABILITY_GATE = 0.9;

export function Viewfinder(props: ViewfinderProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<CameraHandle | null>(null);
  const dispatcherRef = useRef<ScannerDispatcher | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameAt = useRef<number>(0);
  const heldSinceRef = useRef<number | null>(null);
  const latestRectangleRef = useRef<WorkerRectangle | null>(null);
  const latestSegmentRef = useRef<WorkerSegment | null>(null);
  const capturingRef = useRef(false);

  const [torchOn, setTorchOn] = useState(false);
  const [cameraSupports, setCameraSupports] =
    useState<CameraHandle["supports"] | null>(null);

  const autoCaptureMs = props.autoCaptureMs ?? 700;

  // Mount-once effects read the latest callbacks via refs so their
  // dep arrays stay empty. React 19's refs-in-render lint means we
  // update the ref inside a companion effect rather than during
  // render itself.
  const onErrorRef = useRef(props.onError);
  const onCaptureRef = useRef(props.onCapture);
  useEffect(() => {
    onErrorRef.current = props.onError;
  }, [props.onError]);
  useEffect(() => {
    onCaptureRef.current = props.onCapture;
  }, [props.onCapture]);

  // ---- Camera lifecycle ------------------------------------
  // Empty deps on purpose. A `[props]` dep tears the stream down on
  // every parent re-render — Laura sees a black canvas because the
  // camera closes as fast as it opens. React strict mode will still
  // double-invoke this effect in dev; the `cancelled` latch is what
  // keeps the double-mount clean, not the dep array.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cam = await openBackCamera({ width: 1920, height: 1080 });
        if (cancelled) {
          cam.close();
          return;
        }
        cameraRef.current = cam;
        setCameraSupports(cam.supports);
        if (videoRef.current) {
          videoRef.current.srcObject = cam.stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        onErrorRef.current(keyFromCameraError(e), e);
      }
    })();
    return () => {
      cancelled = true;
      cameraRef.current?.close();
      cameraRef.current = null;
    };
  }, []);

  // ---- Dispatcher lifecycle --------------------------------
  useEffect(() => {
    const dispatcher = createScannerDispatcher((event: ScannerEvent) => {
      switch (event.kind) {
        case "rectangle":
          latestRectangleRef.current = event.rect;
          latestSegmentRef.current = null;
          return;
        case "segment":
          latestSegmentRef.current = event.seg;
          latestRectangleRef.current = null;
          return;
        case "none":
          latestRectangleRef.current = null;
          latestSegmentRef.current = null;
          return;
        case "error":
          // Worker crashes are not Laura's fault. Classify as
          // `unknown` so the corpus line does not accuse the camera
          // when the detector itself tripped.
          onErrorRef.current(
            "unknown",
            new Error(`${event.source}: ${event.message}`),
          );
          return;
      }
    });
    dispatcherRef.current = dispatcher;
    return () => {
      dispatcher.close();
      dispatcherRef.current = null;
    };
  }, []);

  // ---- Frame loop ------------------------------------------
  useEffect(() => {
    const loop = (time: number): void => {
      rafRef.current = requestAnimationFrame(loop);
      const cam = cameraRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const dispatcher = dispatcherRef.current;
      if (!cam || !video || !canvas || !dispatcher) return;

      // Throttle dispatcher feeds to ~15 Hz. The detector is capped
      // below this; oversampling wastes main-thread cycles on the
      // `createImageBitmap` call.
      if (time - lastFrameAt.current > 1000 / 15) {
        lastFrameAt.current = time;
        void ingestFrame(video, dispatcher);
      }

      drawOverlay(
        canvas,
        latestRectangleRef.current,
        latestSegmentRef.current,
      );

      // Auto-capture gate. Rectangle path uses the detector's EMA
      // stability; segment path uses a held-coverage heuristic
      // (segmenter gives different shape every frame by design).
      const rect = latestRectangleRef.current;
      const seg = latestSegmentRef.current;

      const rectHeld =
        !!rect && rect.stability > RECT_STABILITY_GATE;
      const segHeld =
        !!seg && seg.coverage > SEGMENT_COVERAGE_GATE;

      if (rectHeld || segHeld) {
        heldSinceRef.current ??= time;
        if (
          time - heldSinceRef.current > autoCaptureMs &&
          !capturingRef.current
        ) {
          capturingRef.current = true;
          void capture(cam, onCaptureRef.current, onErrorRef.current).finally(
            () => {
              capturingRef.current = false;
              heldSinceRef.current = null;
            },
          );
        }
      } else {
        heldSinceRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [autoCaptureMs]);

  // ---- Tap-to-focus ----------------------------------------
  const onTap = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    if (!cam) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point: FocusPoint = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    void cam.focusAt(point);
  }, []);

  // ---- Torch toggle ----------------------------------------
  const onTorchToggle = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const next = !torchOn;
    setTorchOn(next);
    void cam.setTorch(next);
  }, [torchOn]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={onTap}
        aria-label="viewfinder"
      />
      {cameraSupports?.torch && (
        <button
          type="button"
          onClick={onTorchToggle}
          className="absolute bottom-8 right-8 rounded-none border border-paper bg-ink/40 px-4 py-2 text-paper"
          aria-pressed={torchOn}
          aria-label={torchOn ? "torch off" : "torch on"}
        >
          {torchOn ? "torch off" : "torch on"}
        </button>
      )}
    </div>
  );
}

// ---------- Helpers (module-local) ------------------------------

async function ingestFrame(
  video: HTMLVideoElement,
  dispatcher: ScannerDispatcher,
): Promise<void> {
  if (video.readyState < 2) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return;
  try {
    // Transferable handoff — no PNG encode in the hot path. On
    // browsers that GPU-back `ImageBitmap`, this is a zero-copy move.
    const bitmap = await createImageBitmap(video);
    dispatcher.ingest(bitmap);
  } catch {
    // A transient decode failure is a dropped frame, not a scan
    // failure. The next tick tries again.
  }
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  rect: WorkerRectangle | null,
  seg: WorkerSegment | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== width) canvas.width = Math.round(width);
  if (canvas.height !== height) canvas.height = Math.round(height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (rect) {
    drawRectangleBrackets(ctx, rect, canvas.width, canvas.height);
  } else if (seg) {
    drawSegmentBrackets(ctx, seg, canvas.width, canvas.height);
  }
}

function drawRectangleBrackets(
  ctx: CanvasRenderingContext2D,
  rect: WorkerRectangle,
  cw: number,
  ch: number,
): void {
  // Brackets only — Primitive §15. Corners are normalised; pixel
  // them against the visible canvas.
  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  const bracketLen = 20;
  for (let i = 0; i < 4; i++) {
    const [nx0, ny0] = rect.corners[i]!;
    const [nx1, ny1] = rect.corners[(i + 1) % 4]!;
    const x = nx0 * cw;
    const y = ny0 * ch;
    const dx = (nx1 - nx0) * cw;
    const dy = (ny1 - ny0) * ch;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ux * bracketLen, y + uy * bracketLen);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSegmentBrackets(
  ctx: CanvasRenderingContext2D,
  seg: WorkerSegment,
  cw: number,
  ch: number,
): void {
  // The segmenter gives a normalised axis-aligned bbox. Render the
  // same bracket motif as the rectangle path — the two detectors are
  // visually indistinguishable to Laura, which is the voice we want:
  // both say "I see the work." A silhouette fill would shout.
  const [bx, by, bw, bh] = seg.bbox;
  const x0 = bx * cw;
  const y0 = by * ch;
  const x1 = (bx + bw) * cw;
  const y1 = (by + bh) * ch;
  const corners: [number, number][] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];

  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  const bracketLen = 20;
  for (let i = 0; i < 4; i++) {
    const [x, y] = corners[i]!;
    const [nx, ny] = corners[(i + 1) % 4]!;
    const dx = nx - x;
    const dy = ny - y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ux * bracketLen, y + uy * bracketLen);
    ctx.stroke();
  }
  ctx.restore();
}

async function capture(
  cam: CameraHandle,
  onCapture: ViewfinderProps["onCapture"],
  onError: ViewfinderProps["onError"],
): Promise<void> {
  try {
    const frame = await cam.grabFrame();
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("viewfinder: no 2d context for capture");
    ctx.drawImage(frame, 0, 0);
    // Capture encode is one-off and off the hot path; PNG is fine
    // here. Rectification from detector corners is a follow-up —
    // the intake agent is robust to the full frame in iteration #2.
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sha = await sha256Hex(bytes);
    onCapture(bytes, sha);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    onError("capture/no-frame", e);
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // TS 5.7 tightens the `Uint8Array<ArrayBufferLike>` vs `BufferSource`
  // distinction because a `Uint8Array` could be backed by a
  // SharedArrayBuffer. At runtime we only ever pass in Uint8Arrays
  // created from fresh ArrayBuffers; the cast is safe.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
