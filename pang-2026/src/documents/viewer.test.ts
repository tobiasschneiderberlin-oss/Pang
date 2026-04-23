/**
 * PANG — document viewer math tests.
 *
 * Locks the four primitives the `DocumentViewer` component reads
 * every frame:
 *
 *   - `fitToViewport`: initial zoom lands inside the viewport.
 *   - `applyPinch`: pinch anchors the world-space point under the
 *     fingers.
 *   - `applyPan`: single-finger drag translates the image.
 *   - `zoomDepthLevel`: log bucket matches the telemetry catalogue.
 *
 * Plus the gesture tracker: its totalDy accumulates past an interim
 * upward flick so a ratchet drag-down qualifies even through jitter.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GestureTracker,
  IDENTITY_STATE,
  MAX_ZOOM,
  MIN_ZOOM,
  applyPan,
  applyPinch,
  dragDownThreshold,
  fitToViewport,
  pinchOutThreshold,
  zoomDepthLevel,
} from "./viewer";

describe("fitToViewport", () => {
  it("scales width-first when the document is wider than the viewport", () => {
    const fit = fitToViewport(400, 200, 200, 400);
    assert.equal(fit, 0.5);
  });

  it("scales height-first when the document is taller than the viewport", () => {
    const fit = fitToViewport(200, 400, 400, 200);
    assert.equal(fit, 0.5);
  });

  it("returns 1 on a degenerate zero input", () => {
    assert.equal(fitToViewport(0, 0, 100, 100), 1);
    assert.equal(fitToViewport(100, 100, 0, 0), 1);
  });
});

describe("applyPinch", () => {
  it("preserves the world point under the pinch centre", () => {
    // World space: document centre is at (0,0); with a zoom of 1,
    // the world point under viewport centre is (0,0).
    const viewportW = 1000;
    const viewportH = 1000;
    // Pinch centre at the right-middle of the viewport.
    const centreX = 750;
    const centreY = 500;

    // World point currently under the pinch centre (with prev state):
    const prev = IDENTITY_STATE;
    const prevWorldX =
      (centreX - viewportW / 2 - prev.panX) / prev.zoom; // 250
    const prevWorldY =
      (centreY - viewportH / 2 - prev.panY) / prev.zoom; // 0

    const next = applyPinch(prev, 2, centreX, centreY, viewportW, viewportH);
    // After the pinch, the same viewport-space centre should land on
    // the same world point.
    const nextWorldX =
      (centreX - viewportW / 2 - next.panX) / next.zoom;
    const nextWorldY =
      (centreY - viewportH / 2 - next.panY) / next.zoom;
    assert.ok(Math.abs(prevWorldX - nextWorldX) < 1e-9);
    assert.ok(Math.abs(prevWorldY - nextWorldY) < 1e-9);
    assert.equal(next.zoom, 2);
  });

  it("clamps zoom at MIN and MAX", () => {
    const min = applyPinch(IDENTITY_STATE, 0.01, 0, 0, 100, 100);
    assert.equal(min.zoom, MIN_ZOOM);
    const max = applyPinch(IDENTITY_STATE, 1000, 0, 0, 100, 100);
    assert.equal(max.zoom, MAX_ZOOM);
  });
});

describe("applyPan", () => {
  it("adds the delta to the pan fields", () => {
    const next = applyPan({ zoom: 2, panX: 10, panY: 20 }, 5, -3);
    assert.deepEqual(next, { zoom: 2, panX: 15, panY: 17 });
  });
});

describe("dismiss thresholds", () => {
  it("pinchOut triggers at or below 0.85 zoom", () => {
    assert.equal(pinchOutThreshold({ zoom: 1, panX: 0, panY: 0 }), false);
    assert.equal(pinchOutThreshold({ zoom: 0.9, panX: 0, panY: 0 }), false);
    assert.equal(pinchOutThreshold({ zoom: 0.85, panX: 0, panY: 0 }), true);
    assert.equal(pinchOutThreshold({ zoom: 0.4, panX: 0, panY: 0 }), true);
  });

  it("dragDown triggers at or above 120 px", () => {
    assert.equal(dragDownThreshold(0), false);
    assert.equal(dragDownThreshold(119), false);
    assert.equal(dragDownThreshold(120), true);
    assert.equal(dragDownThreshold(1000), true);
  });
});

describe("zoomDepthLevel", () => {
  it("log-buckets zoom into telemetry levels", () => {
    assert.equal(zoomDepthLevel(0.5), 1);
    assert.equal(zoomDepthLevel(1), 1);
    assert.equal(zoomDepthLevel(1.99), 1);
    assert.equal(zoomDepthLevel(2), 2);
    assert.equal(zoomDepthLevel(3.9), 2);
    assert.equal(zoomDepthLevel(4), 3);
    assert.equal(zoomDepthLevel(8), 4);
    assert.equal(zoomDepthLevel(16), 5);
  });
});

describe("GestureTracker — pinch", () => {
  it("emits an incremental factor per sample", () => {
    const t = new GestureTracker();
    t.pointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    t.pointerDown({ pointerId: 2, clientX: 100, clientY: 0 }); // dist 100
    // Move pointer 2 to distance 200 — factor should be 2.
    const s1 = t.pointerMove({ pointerId: 2, clientX: 200, clientY: 0 });
    assert.ok(s1);
    assert.equal(s1!.kind, "pinch");
    if (s1!.kind === "pinch") assert.ok(Math.abs(s1!.factor - 2) < 1e-9);
    // Next sample, move to 400 — factor should be another 2 relative
    // to the last sample, not relative to the original 100.
    const s2 = t.pointerMove({ pointerId: 2, clientX: 400, clientY: 0 });
    assert.ok(s2);
    if (s2!.kind === "pinch") assert.ok(Math.abs(s2!.factor - 2) < 1e-9);
  });
});

describe("GestureTracker — pan ratchet", () => {
  it("peaks totalDy past an interim upward flick", () => {
    const t = new GestureTracker();
    t.pointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    const s1 = t.pointerMove({ pointerId: 1, clientX: 0, clientY: 100 });
    assert.ok(s1);
    if (s1!.kind === "pan") assert.equal(s1!.totalDy, 100);
    // Upward flick shouldn't reset the ratchet.
    const s2 = t.pointerMove({ pointerId: 1, clientX: 0, clientY: 80 });
    assert.ok(s2);
    if (s2!.kind === "pan") assert.equal(s2!.totalDy, 100);
    // Further drag past the peak bumps the ratchet.
    const s3 = t.pointerMove({ pointerId: 1, clientX: 0, clientY: 150 });
    assert.ok(s3);
    if (s3!.kind === "pan") assert.equal(s3!.totalDy, 150);
  });
});

describe("GestureTracker — lifecycle", () => {
  it("clears state on pointerUp when no pointers remain", () => {
    const t = new GestureTracker();
    t.pointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    t.pointerMove({ pointerId: 1, clientX: 0, clientY: 100 });
    assert.equal(t.totalVerticalDrag, 100);
    t.pointerUp(1);
    assert.equal(t.activeCount, 0);
    assert.equal(t.totalVerticalDrag, 0);
  });

  it("ignores unknown pointer moves", () => {
    const t = new GestureTracker();
    const s = t.pointerMove({ pointerId: 99, clientX: 0, clientY: 0 });
    assert.equal(s, null);
  });
});
