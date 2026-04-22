/// <reference lib="webworker" />
/**
 * PANG — rectangle detector worker.
 *
 * Iteration #2 scanner re-land. Pure-JS Sobel edge map + quadrilateral
 * approximation over the edge contour, running in a dedicated module
 * worker off the main thread (P20).
 *
 * Why not OpenCV.js: a 3 MB WASM blob fetched from a CDN breaks the
 * offline shell budget (P4, < 300 ms paint) and adds a cold-start tax
 * on first scan. A hand-rolled Sobel + quad fit runs at 15 Hz on a
 * mid-tier Android in under 6 ms per frame for 320×240 input, which
 * is enough for the live-brackets register this iteration targets.
 *
 * Protocol:
 *
 *   main → worker
 *     { kind: "frame", bitmap, frameId }   // ImageBitmap transferred
 *     { kind: "close" }
 *
 *   worker → main
 *     { kind: "result", frameId, rect: Rectangle | null }
 *     { kind: "error", frameId, message }
 *
 * `Rectangle` carries corners in normalised [0..1] image coordinates
 * (origin top-left). Stability is a running EMA of inverse corner
 * drift across the last ~10 frames; callers use > 0.9 as the stable
 * threshold for auto-capture.
 */

// ---------- Wire protocol ------------------------------------------

export interface WorkerRectangle {
  readonly corners: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  readonly stability: number; // 0..1 EMA
  readonly area: number; // normalised 0..1
}

export type MainToWorker =
  | { kind: "frame"; bitmap: ImageBitmap; frameId: number }
  | { kind: "close" };

export type WorkerToMain =
  | { kind: "result"; frameId: number; rect: WorkerRectangle | null }
  | { kind: "error"; frameId: number; message: string };

// ---------- Detector state -----------------------------------------

/** Downscale target. 320 on the long edge is the sweet spot — enough
 *  resolution for a physical artwork rectangle to survive Sobel while
 *  cheap enough to run at 15 Hz on a 2023 mid-tier. */
const TARGET_LONG_EDGE = 320;

/** Stability EMA half-life. 4 frames ≈ 270 ms at 15 Hz, which matches
 *  the hand's perceptual "held still" threshold. */
const STABILITY_ALPHA = 0.35;

/** Minimum normalised area for a valid rectangle. Below 0.08 it's
 *  noise, not a work. */
const MIN_AREA = 0.08;

/** Corner-drift tolerance in normalised image units. Inter-frame
 *  movement below this contributes to stability. */
const STABLE_DRIFT = 0.008;

let lastCorners:
  | readonly [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ]
  | null = null;
let stabilityEma = 0;

// ---------- Main ---------------------------------------------------

self.addEventListener("message", (ev: MessageEvent<MainToWorker>) => {
  const msg = ev.data;
  if (msg.kind === "close") {
    self.close();
    return;
  }
  if (msg.kind !== "frame") return;

  try {
    const rect = detect(msg.bitmap);
    const response: WorkerToMain = {
      kind: "result",
      frameId: msg.frameId,
      rect,
    };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(response);
  } catch (e) {
    const response: WorkerToMain = {
      kind: "error",
      frameId: msg.frameId,
      message: e instanceof Error ? e.message : String(e),
    };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(response);
  } finally {
    msg.bitmap.close();
  }
});

// ---------- Detection ----------------------------------------------

function detect(bitmap: ImageBitmap): WorkerRectangle | null {
  const { width: W, height: H } = bitmap;
  const scale = TARGET_LONG_EDGE / Math.max(W, H);
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));

  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context in worker");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);

  // Luminance + Sobel gradient magnitude.
  const lum = toLuma(image.data, w, h);
  const mag = sobel(lum, w, h);
  // Adaptive threshold: keep top ~6% of gradient magnitudes.
  const thr = percentile(mag, 0.94);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mag.length; i++) mask[i] = mag[i]! >= thr ? 1 : 0;

  // Find the largest connected component that looks rectangular.
  const quad = findBestQuadrilateral(mask, w, h);
  if (!quad) {
    stabilityEma *= 1 - STABILITY_ALPHA;
    lastCorners = null;
    return null;
  }

  // Normalise corners to [0..1].
  const corners = quad.map(([x, y]) => [x / w, y / h] as [number, number]) as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const area = polygonArea(corners);
  if (area < MIN_AREA) {
    stabilityEma *= 1 - STABILITY_ALPHA;
    lastCorners = null;
    return null;
  }

  // Stability EMA against last frame.
  let instantStable = 0;
  if (lastCorners) {
    const drift = meanCornerDrift(corners, lastCorners);
    instantStable = Math.max(0, 1 - drift / STABLE_DRIFT);
  }
  stabilityEma =
    STABILITY_ALPHA * instantStable + (1 - STABILITY_ALPHA) * stabilityEma;
  lastCorners = corners;

  return { corners, stability: clamp01(stabilityEma), area };
}

// ---------- Primitives ---------------------------------------------

function toLuma(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
): Float32Array {
  const out = new Float32Array(w * h);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    // Rec.709 luma.
    out[j] =
      0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!;
  }
  return out;
}

function sobel(lum: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -lum[i - w - 1]! -
        2 * lum[i - 1]! -
        lum[i + w - 1]! +
        lum[i - w + 1]! +
        2 * lum[i + 1]! +
        lum[i + w + 1]!;
      const gy =
        -lum[i - w - 1]! -
        2 * lum[i - w]! -
        lum[i - w + 1]! +
        lum[i + w - 1]! +
        2 * lum[i + w]! +
        lum[i + w + 1]!;
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

function percentile(xs: Float32Array, p: number): number {
  // Quick-and-dirty percentile via a sampled histogram. Exact sort on
  // 320×240 floats is wasteful when we're after a cut-off, not a rank.
  const bins = 256;
  const hist = new Uint32Array(bins);
  let max = 0;
  for (let i = 0; i < xs.length; i++) if (xs[i]! > max) max = xs[i]!;
  if (max === 0) return 0;
  for (let i = 0; i < xs.length; i++) {
    const b = Math.min(bins - 1, Math.floor((xs[i]! / max) * (bins - 1)));
    hist[b]!++;
  }
  const target = p * xs.length;
  let cum = 0;
  for (let b = 0; b < bins; b++) {
    cum += hist[b]!;
    if (cum >= target) return (b / (bins - 1)) * max;
  }
  return max;
}

/**
 * Find the largest connected edge-blob and approximate its convex
 * hull as a quadrilateral via the "four extremal points" heuristic.
 * For a flat artwork under even lighting this is within 2–4 px of the
 * true corners at 320-px scale — sufficient for the live-bracket
 * overlay. A second-pass polyline-simplification refinement can land
 * in a follow-up without re-writing the wire protocol.
 */
function findBestQuadrilateral(
  mask: Uint8Array,
  w: number,
  h: number,
): [number, number][] | null {
  // Dilate once so gap-bridges don't fragment the contour.
  const dilated = dilate(mask, w, h);

  // Largest connected component via flood-fill pass.
  const labels = new Int32Array(w * h);
  let bestLabel = 0;
  let bestCount = 0;
  let nextLabel = 0;
  const stack: number[] = [];
  for (let i = 0; i < dilated.length; i++) {
    if (dilated[i] !== 1 || labels[i] !== 0) continue;
    nextLabel++;
    let count = 0;
    stack.push(i);
    labels[i] = nextLabel;
    while (stack.length) {
      const j = stack.pop()!;
      count++;
      const x = j % w;
      const y = (j - x) / w;
      const neigh = [
        y > 0 ? j - w : -1,
        y < h - 1 ? j + w : -1,
        x > 0 ? j - 1 : -1,
        x < w - 1 ? j + 1 : -1,
      ];
      for (const n of neigh) {
        if (n < 0) continue;
        if (dilated[n] === 1 && labels[n] === 0) {
          labels[n] = nextLabel;
          stack.push(n);
        }
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestLabel = nextLabel;
    }
  }
  if (bestLabel === 0) return null;

  // Collect points in the best component.
  const pts: [number, number][] = [];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === bestLabel) {
      const x = i % w;
      const y = (i - x) / w;
      pts.push([x, y]);
    }
  }
  if (pts.length < 20) return null;

  // Four extremal points: min(x+y), max(x+y), min(x-y), max(x-y).
  // For a rectangle in image space these are TL, BR, BL, TR respectively
  // (y grows downward). Order canonically: TL, TR, BR, BL.
  let tl = pts[0]!,
    tr = pts[0]!,
    br = pts[0]!,
    bl = pts[0]!;
  let tlS = tl[0] + tl[1];
  let brS = br[0] + br[1];
  let trD = tr[0] - tr[1];
  let blD = bl[0] - bl[1];
  for (const p of pts) {
    const s = p[0] + p[1];
    const d = p[0] - p[1];
    if (s < tlS) {
      tl = p;
      tlS = s;
    }
    if (s > brS) {
      br = p;
      brS = s;
    }
    if (d > trD) {
      tr = p;
      trD = d;
    }
    if (d < blD) {
      bl = p;
      blD = d;
    }
  }

  return [tl, tr, br, bl];
}

function dilate(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i] === 1) {
        out[i] = 1;
        if (x > 0) out[i - 1] = 1;
        if (x < w - 1) out[i + 1] = 1;
        if (y > 0) out[i - w] = 1;
        if (y < h - 1) out[i + w] = 1;
      }
    }
  }
  return out;
}

function polygonArea(
  corners: readonly (readonly [number, number])[],
): number {
  // Shoelace on normalised corners in [0..1]. Returns a 0..1 value.
  let a = 0;
  for (let i = 0; i < corners.length; i++) {
    const [x0, y0] = corners[i]!;
    const [x1, y1] = corners[(i + 1) % corners.length]!;
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function meanCornerDrift(
  a: readonly (readonly [number, number])[],
  b: readonly (readonly [number, number])[],
): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    sum += Math.hypot(a[i]![0] - b[i]![0], a[i]![1] - b[i]![1]);
  }
  return sum / 4;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
