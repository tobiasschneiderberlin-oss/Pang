/**
 * PANG — scanner dispatcher.
 *
 * Runs the two CV workers (rectangle detector + MediaPipe segmenter)
 * behind one interface. The Viewfinder sends `ImageBitmap` frames to
 * `ingest()`; the dispatcher routes them:
 *
 *   1. Every frame → rectangle detector. Fast (~6 ms) and covers 90%
 *      of works (paintings, framed photos, editions).
 *   2. If rectangle detection returns `null` for > 1 second of frames,
 *      the dispatcher wakes the segmenter and starts forwarding every
 *      3rd frame to it (~50 ms inference, kept below 15 Hz main-thread
 *      equivalence).
 *   3. As soon as a rectangle reappears, the dispatcher stops sending
 *      to the segmenter — the segmenter stays hot in case it's needed
 *      again, it just goes idle.
 *
 * Why a dispatcher instead of running both every frame: the segmenter
 * is ~8× more expensive and redundant when rectangles are healthy.
 * The 1-second threshold is the "Laura is aiming at a sculpture, not
 * a painting" tell — rectangle detection will have had multiple
 * chances to lock on by then.
 *
 * Callers subscribe to one event stream:
 *
 *   - "rectangle" → { rect }
 *   - "segment"   → { mask, bbox, coverage }
 *   - "none"      → nothing visible yet
 *   - "error"     → failure surfaced from a worker
 *
 * Stability is tracked on the rectangle branch only (the segmenter
 * produces different shape every frame by design); the UI's
 * auto-capture gate watches stability on rectangles and uses a
 * held-coverage heuristic on segments.
 */

import type {
  MainToWorker,
  WorkerRectangle,
  WorkerToMain,
} from "./rectangleDetector.worker";
import type {
  MainToSegmenter,
  SegmenterToMain,
  WorkerSegment,
} from "./segmenter.worker";

export type ScannerEvent =
  | { kind: "rectangle"; rect: WorkerRectangle }
  | { kind: "segment"; seg: WorkerSegment }
  | { kind: "none" }
  | { kind: "error"; source: "rectangle" | "segmenter"; message: string };

export interface ScannerDispatcher {
  ingest(bitmap: ImageBitmap): void;
  close(): void;
}

const FALLBACK_AFTER_EMPTY_MS = 1_000;
const SEGMENTER_EVERY_N_FRAMES = 3;

export function createScannerDispatcher(
  onEvent: (event: ScannerEvent) => void,
): ScannerDispatcher {
  const rectWorker = new Worker(
    new URL("./rectangleDetector.worker.ts", import.meta.url),
    { type: "module", name: "pang-cv-rectangle" },
  );
  let segWorker: Worker | null = null;
  let segReady = false;

  let frameSeq = 0;
  let lastRectAt = performance.now();
  let segFramesSinceDispatch = 0;
  let closed = false;

  rectWorker.addEventListener("message", (ev: MessageEvent<WorkerToMain>) => {
    const msg = ev.data;
    if (closed) return;
    if (msg.kind === "error") {
      onEvent({ kind: "error", source: "rectangle", message: msg.message });
      return;
    }
    if (msg.kind !== "result") return;
    if (msg.rect) {
      lastRectAt = performance.now();
      onEvent({ kind: "rectangle", rect: msg.rect });
    } else {
      const since = performance.now() - lastRectAt;
      if (since < FALLBACK_AFTER_EMPTY_MS) {
        onEvent({ kind: "none" });
      }
      // If the empty streak exceeds the threshold, don't emit "none" —
      // the segmenter branch will emit (either a segment or "none").
    }
  });

  rectWorker.addEventListener("error", (ev) => {
    if (closed) return;
    onEvent({
      kind: "error",
      source: "rectangle",
      message: ev.message ?? "rectangle worker crashed",
    });
  });

  function ensureSegmenter(): void {
    if (segWorker) return;
    segWorker = new Worker(
      new URL("./segmenter.worker.ts", import.meta.url),
      { type: "module", name: "pang-cv-segmenter" },
    );
    segWorker.addEventListener(
      "message",
      (ev: MessageEvent<SegmenterToMain>) => {
        const msg = ev.data;
        if (closed) return;
        if (msg.kind === "ready") {
          segReady = true;
          return;
        }
        if (msg.kind === "error") {
          onEvent({ kind: "error", source: "segmenter", message: msg.message });
          return;
        }
        if (msg.kind !== "result") return;
        if (msg.mask) {
          onEvent({ kind: "segment", seg: msg.mask });
        } else {
          onEvent({ kind: "none" });
        }
      },
    );
    segWorker.addEventListener("error", (ev) => {
      if (closed) return;
      onEvent({
        kind: "error",
        source: "segmenter",
        message: ev.message ?? "segmenter worker crashed",
      });
    });
    const init: MainToSegmenter = { kind: "init" };
    segWorker.postMessage(init);
  }

  return {
    ingest(bitmap: ImageBitmap): void {
      if (closed) {
        bitmap.close();
        return;
      }
      frameSeq++;

      // Always tee to rectangle detector. The bitmap is a transferable,
      // so we split by posting the *same* bitmap to one worker and, if
      // the segmenter is active, a cloned bitmap to the other. Cloning
      // is cheap — it's a structured clone of a GPU handle, not a pixel
      // copy, on browsers where ImageBitmap is GPU-backed.
      const needsSegmenter =
        performance.now() - lastRectAt > FALLBACK_AFTER_EMPTY_MS;

      if (needsSegmenter && !segWorker) ensureSegmenter();

      if (
        needsSegmenter &&
        segWorker &&
        segReady &&
        segFramesSinceDispatch >= SEGMENTER_EVERY_N_FRAMES - 1
      ) {
        // Segmenter gets the original bitmap; rectangle detector gets
        // a clone. The segmenter path is the more expensive branch,
        // so giving it the zero-copy transfer is the net win.
        void (async () => {
          const clone = await createImageBitmap(bitmap);
          const rectMsg: MainToWorker = {
            kind: "frame",
            bitmap: clone,
            frameId: frameSeq,
          };
          rectWorker.postMessage(rectMsg, [clone]);
          const segMsg: MainToSegmenter = {
            kind: "frame",
            bitmap,
            frameId: frameSeq,
          };
          segWorker!.postMessage(segMsg, [bitmap]);
        })();
        segFramesSinceDispatch = 0;
      } else {
        segFramesSinceDispatch++;
        const rectMsg: MainToWorker = {
          kind: "frame",
          bitmap,
          frameId: frameSeq,
        };
        rectWorker.postMessage(rectMsg, [bitmap]);
      }
    },
    close(): void {
      closed = true;
      const rectClose: MainToWorker = { kind: "close" };
      rectWorker.postMessage(rectClose);
      rectWorker.terminate();
      if (segWorker) {
        const segClose: MainToSegmenter = { kind: "close" };
        segWorker.postMessage(segClose);
        segWorker.terminate();
        segWorker = null;
      }
    },
  };
}
