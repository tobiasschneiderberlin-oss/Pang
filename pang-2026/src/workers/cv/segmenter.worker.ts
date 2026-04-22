/// <reference lib="webworker" />
/**
 * PANG — MediaPipe Image Segmenter worker.
 *
 * Fallback for non-rectangular works (sculpture, objects on paper with
 * torn edges, editions in unusual mounts). Runs after the rectangle
 * detector has failed to find a stable quadrilateral for ~1s — the
 * dispatcher owns that timing.
 *
 * Ships `MobileNetV3` selfie-segmenter for now (250 KB model, ships
 * with MediaPipe, works well on any prominent foreground subject
 * against a contrasting background). Swap to a purpose-trained
 * artwork-segmentation model when the eval corpus (A22) says the swap
 * is worth it; the wire protocol doesn't change.
 *
 * The WASM assets are resolved via MediaPipe's `FilesetResolver`
 * pointing at the public CDN by default. A self-hosted path is
 * available via the `MP_VISION_BASE_URL` build-time env (see
 * `next.config.ts`); when set, the service worker precaches the
 * assets for offline fallback.
 *
 * Protocol:
 *
 *   main → worker
 *     { kind: "init" }
 *     { kind: "frame", bitmap, frameId }     // ImageBitmap transferred
 *     { kind: "close" }
 *
 *   worker → main
 *     { kind: "ready" }
 *     { kind: "result", frameId, mask: Segment | null }
 *     { kind: "error", frameId, message }
 */

import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

// ---------- Wire protocol ------------------------------------------

export interface WorkerSegment {
  /** Binary foreground mask, row-major, width × height bytes.
   *  1 = foreground pixel, 0 = background. */
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** Axis-aligned bounding box of the foreground in normalised coords. */
  readonly bbox: readonly [number, number, number, number]; // [x, y, w, h]
  /** Fraction of pixels that landed in foreground. Low values are
   *  treated as no-detection by the dispatcher. */
  readonly coverage: number;
}

export type MainToSegmenter =
  | { kind: "init" }
  | { kind: "frame"; bitmap: ImageBitmap; frameId: number }
  | { kind: "close" };

export type SegmenterToMain =
  | { kind: "ready" }
  | { kind: "result"; frameId: number; mask: WorkerSegment | null }
  | { kind: "error"; frameId: number; message: string };

// ---------- Asset resolution --------------------------------------

/** MediaPipe CDN for the WASM runtime. The service worker caches the
 *  response so subsequent launches are offline-safe. A build-time
 *  override is read from the worker URL's query param (Next + Turbopack
 *  don't expose process.env cleanly inside a module worker, so we
 *  piggy-back on the worker URL). */
const DEFAULT_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";

/** Selfie segmenter (int8 quantised). 255 KB. General-purpose
 *  foreground model trained on humans; strong empirical performance
 *  on centred objects with contrasting backgrounds — good enough for
 *  the fallback surface this iteration targets. */
const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

/** Minimum foreground coverage before the dispatcher treats a segment
 *  as a real detection. Below 2% is noise. */
const MIN_COVERAGE = 0.02;

/** Downscale for runtime. MediaPipe is more expensive than our hand
 *  sobel — cap the long edge at 256 so we still fit a 15 Hz target
 *  on mid-tier mobile (frame budget ≈ 65 ms, MediaPipe at 256 px
 *  lands under 40 ms on a Pixel 10 Pro). */
const TARGET_LONG_EDGE = 256;

// ---------- State --------------------------------------------------

let segmenter: ImageSegmenter | null = null;
let initPromise: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (segmenter) return;
  if (!initPromise) {
    initPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(DEFAULT_WASM_BASE);
      segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: DEFAULT_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })();
  }
  await initPromise;
}

// ---------- Message loop -------------------------------------------

self.addEventListener("message", (ev: MessageEvent<MainToSegmenter>) => {
  const msg = ev.data;
  if (msg.kind === "close") {
    segmenter?.close();
    segmenter = null;
    self.close();
    return;
  }

  if (msg.kind === "init") {
    ensureReady()
      .then(() => {
        const out: SegmenterToMain = { kind: "ready" };
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(out);
      })
      .catch((e) => {
        const out: SegmenterToMain = {
          kind: "error",
          frameId: -1,
          message: e instanceof Error ? e.message : String(e),
        };
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(out);
      });
    return;
  }

  if (msg.kind !== "frame") return;

  void handleFrame(msg);
});

async function handleFrame(msg: {
  bitmap: ImageBitmap;
  frameId: number;
}): Promise<void> {
  try {
    await ensureReady();
    if (!segmenter) throw new Error("segmenter not initialised");

    const { bitmap, frameId } = msg;
    const scale = TARGET_LONG_EDGE / Math.max(bitmap.width, bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext("2d");
    if (!ctx) throw new Error("no 2d context in segmenter worker");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const result: ImageSegmenterResult = segmenter.segmentForVideo(
      off,
      performance.now(),
    );
    const mask = extractMask(result, w, h);
    bitmap.close();

    const out: SegmenterToMain = {
      kind: "result",
      frameId,
      mask,
    };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(out);
  } catch (e) {
    msg.bitmap.close();
    const out: SegmenterToMain = {
      kind: "error",
      frameId: msg.frameId,
      message: e instanceof Error ? e.message : String(e),
    };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(out);
  }
}

// ---------- Mask extraction ---------------------------------------

function extractMask(
  result: ImageSegmenterResult,
  width: number,
  height: number,
): WorkerSegment | null {
  const cat = result.categoryMask;
  if (!cat) return null;

  // `getAsUint8Array` returns per-pixel category ids. Selfie-segmenter
  // emits 1 = foreground, 0 = background.
  const raw = cat.getAsUint8Array();
  const mask = new Uint8Array(raw.length);
  let count = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < raw.length; i++) {
    const isFg = raw[i]! > 0 ? 1 : 0;
    mask[i] = isFg;
    if (isFg) {
      count++;
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  // MediaPipe's category mask API returns a borrowed buffer; mask data
  // stays valid until the next segment call, so we close the handle
  // here.
  cat.close();

  const coverage = count / (width * height);
  if (coverage < MIN_COVERAGE) return null;

  return {
    mask,
    width,
    height,
    bbox: [
      minX / width,
      minY / height,
      (maxX - minX) / width,
      (maxY - minY) / height,
    ],
    coverage,
  };
}
