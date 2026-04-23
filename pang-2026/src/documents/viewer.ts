/**
 * PANG — document viewer math + gesture primitive.
 *
 * Pure, testable core behind `DocumentViewer.tsx`. Four things live here:
 *
 *   1. `ViewerState` — `{ zoom, panX, panY }`, the three numbers the
 *      canvas paint loop reads every frame. Immutable; every mutation
 *      returns a new state so tests are comparison-friendly.
 *   2. `fitToViewport` — initial zoom so the document lands at
 *      "fit-to-screen" (level 1 in the zoom-depth telemetry bucket).
 *   3. `applyPinch` / `applyPan` — gesture-to-state math. The pinch
 *      function keeps the *pinch centre* fixed in document space so
 *      the zoom feels anchored at the fingers, not at the corner.
 *   4. `pinchOutThreshold` / `dragDownThreshold` / `zoomDepthLevel` —
 *      scalar helpers the component reads to decide "is this a dismiss
 *      gesture?" and "emit a zoom-depth beacon now?".
 *
 * The "back gesture" contract in the kickoff brief — pinch-out + drag-
 * down + Escape — is resolved here. Pinch-out counts when the user
 * squeezes past the fit-to-viewport zoom + a hysteresis band (0.85),
 * so a hand that drifts past 1.0 doesn't accidentally dismiss. Drag-
 * down counts when a single-finger pointer drops more than 120 px
 * without rising again (swipe tolerance).
 *
 * Zoom-depth bucket: the coarse telemetry signal for "did she paint
 * in?" lives as a log bucket on the zoom factor, so the histogram
 * shows "she reached 2× / 4× / 8×" without flooding every pinch tick.
 *
 * Mutable gesture state lives in `GestureTracker` — a thin class with
 * no DOM coupling. `DocumentViewer.tsx` feeds it `PointerEvent`s and
 * reads state back each frame. The tracker never touches `window`, so
 * it's fully unit-testable.
 */

export interface ViewerState {
  /** World-space zoom factor; 1 = fit-to-viewport. */
  readonly zoom: number;
  /** World-space pan in pixels. 0,0 = image centred on viewport centre. */
  readonly panX: number;
  readonly panY: number;
}

export const IDENTITY_STATE: ViewerState = Object.freeze({
  zoom: 1,
  panX: 0,
  panY: 0,
});

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 16;

/**
 * Compute the fit-to-viewport zoom so the document's intrinsic
 * (`intrinsicW × intrinsicH`) fits inside `viewportW × viewportH`
 * with equal margins. "Fit" here is *contain* — the whole document
 * is visible, letterboxed if needed.
 */
export function fitToViewport(
  intrinsicW: number,
  intrinsicH: number,
  viewportW: number,
  viewportH: number,
): number {
  if (intrinsicW <= 0 || intrinsicH <= 0) return 1;
  if (viewportW <= 0 || viewportH <= 0) return 1;
  const scaleX = viewportW / intrinsicW;
  const scaleY = viewportH / intrinsicH;
  return Math.min(scaleX, scaleY);
}

/**
 * Map a two-finger pinch to a new `ViewerState`. `factor` is the
 * instantaneous ratio of current-distance / start-distance. `centreX /
 * centreY` is the viewport-space midpoint of the two fingers.
 *
 * Invariant: the world-space point under the pinch centre stays at
 * the same viewport-space point after the zoom. This is the "anchor
 * at the fingers" feel.
 */
export function applyPinch(
  prev: ViewerState,
  factor: number,
  centreX: number,
  centreY: number,
  viewportW: number,
  viewportH: number,
): ViewerState {
  const nextZoom = clampZoom(prev.zoom * factor);
  // The viewport centre in world coordinates before the pinch:
  //   world = (viewport - viewportCentre - pan) / zoom
  // We want the world point at the pinch centre to remain under the
  // same viewport point after the zoom.
  const vCentreX = viewportW / 2;
  const vCentreY = viewportH / 2;
  const worldX = (centreX - vCentreX - prev.panX) / prev.zoom;
  const worldY = (centreY - vCentreY - prev.panY) / prev.zoom;
  const nextPanX = centreX - vCentreX - worldX * nextZoom;
  const nextPanY = centreY - vCentreY - worldY * nextZoom;
  return {
    zoom: nextZoom,
    panX: nextPanX,
    panY: nextPanY,
  };
}

/**
 * Apply a single-finger pan delta to the state. The pan is applied
 * in viewport pixels; no clamping — the caller clamps after draw if
 * it wants to prevent the image from drifting off-screen. PANG's
 * viewer lets the image drift freely (the dismiss gesture is a
 * drop-off-the-bottom), so clamping would work against the contract.
 */
export function applyPan(
  prev: ViewerState,
  deltaX: number,
  deltaY: number,
): ViewerState {
  return {
    zoom: prev.zoom,
    panX: prev.panX + deltaX,
    panY: prev.panY + deltaY,
  };
}

/**
 * Has the zoom dropped past the pinch-out dismiss threshold? The
 * hysteresis is tight (0.85 × fit) so an accidental two-finger
 * wiggle doesn't dismiss, but a deliberate squeeze does.
 */
export function pinchOutThreshold(state: ViewerState): boolean {
  return state.zoom <= PINCH_OUT_ZOOM;
}
const PINCH_OUT_ZOOM = 0.85;

/**
 * Has the drag-down dismiss threshold been crossed? The caller feeds
 * total vertical pixels since the pointer went down; we compare to a
 * fixed 120 px. 120 px is large enough to survive fat-finger scroll
 * jitter and small enough that a deliberate swipe-down feels instant.
 */
export function dragDownThreshold(totalDy: number): boolean {
  return totalDy >= DRAG_DOWN_PIXELS;
}
const DRAG_DOWN_PIXELS = 120;

/**
 * Project a zoom factor onto the coarse telemetry bucket. Level 1 =
 * fit-to-viewport, level 2 = 2× fit, level 3 = 4× fit, level 4 = 8×
 * fit. This is a log bucket — each step doubles — so the histogram
 * reads as a ladder, not a long tail.
 *
 * Returns an integer ≥ 1.
 */
export function zoomDepthLevel(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 1) return 1;
  return 1 + Math.floor(Math.log2(zoom));
}

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

// ---------- Gesture tracker -------------------------------------------

/**
 * The minimum structural contract a PointerEvent must satisfy for
 * the tracker. `PointerEvent` fits this; a synthetic one in a test
 * does too.
 */
export interface ViewerPointer {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

export interface PinchSample {
  readonly kind: "pinch";
  readonly factor: number;
  readonly centreX: number;
  readonly centreY: number;
}

export interface PanSample {
  readonly kind: "pan";
  readonly deltaX: number;
  readonly deltaY: number;
  readonly totalDy: number;
}

export type GestureSample = PinchSample | PanSample;

/**
 * Tracks active pointers and produces one `GestureSample` per move.
 * One pointer down → pan. Two pointers down → pinch. Lifting a
 * finger during a pinch ends the pinch; the remaining finger
 * continues as a pan with no retroactive drift.
 *
 * The tracker holds no timers, no rAF hooks; the consumer drives it.
 * That keeps the unit tests simple — push pointer events, pull
 * samples back.
 */
export class GestureTracker {
  private pointers = new Map<number, ViewerPointer>();
  private pinchStartDistance = 0;
  private panStartY: number | null = null;
  private panTotalDy = 0;

  pointerDown(p: ViewerPointer): void {
    this.pointers.set(p.pointerId, p);
    if (this.pointers.size === 2) {
      this.pinchStartDistance = distanceBetweenTwo(this.pointers);
    }
    if (this.pointers.size === 1) {
      this.panStartY = p.clientY;
      this.panTotalDy = 0;
    }
  }

  /**
   * Returns a `GestureSample` if the move produced a meaningful
   * delta, or `null` if it should be ignored. The same pointerId
   * must previously have had `pointerDown`; an unknown id is a
   * no-op.
   */
  pointerMove(p: ViewerPointer): GestureSample | null {
    const prev = this.pointers.get(p.pointerId);
    if (!prev) return null;
    this.pointers.set(p.pointerId, p);

    if (this.pointers.size === 2) {
      // Pinch sample: compute new distance + centre, emit a factor.
      const currentDistance = distanceBetweenTwo(this.pointers);
      if (this.pinchStartDistance <= 0) {
        this.pinchStartDistance = currentDistance;
        return null;
      }
      const factorFromLastStart =
        currentDistance / this.pinchStartDistance;
      // Reset the base so each sample is *incremental* — keeps the
      // zoom math a per-sample multiplier rather than a cumulative
      // one, which the `applyPinch` contract expects.
      this.pinchStartDistance = currentDistance;
      const centre = centreOfTwo(this.pointers);
      return {
        kind: "pinch",
        factor: factorFromLastStart,
        centreX: centre.x,
        centreY: centre.y,
      };
    }

    if (this.pointers.size === 1) {
      const dx = p.clientX - prev.clientX;
      const dy = p.clientY - prev.clientY;
      if (dx === 0 && dy === 0) return null;
      // `totalDy` is the peak absolute downward displacement from
      // the initial pointerdown. A small upward drift during a
      // downward drag doesn't un-qualify it — the dismiss threshold
      // is a ratchet, not a live measurement.
      if (this.panStartY !== null) {
        const displaced = p.clientY - this.panStartY;
        if (displaced > this.panTotalDy) this.panTotalDy = displaced;
      }
      return { kind: "pan", deltaX: dx, deltaY: dy, totalDy: this.panTotalDy };
    }

    return null;
  }

  pointerUp(pointerId: number): void {
    this.pointers.delete(pointerId);
    if (this.pointers.size < 2) {
      this.pinchStartDistance = 0;
    }
    if (this.pointers.size === 0) {
      this.panStartY = null;
      this.panTotalDy = 0;
    }
  }

  /** Drop all tracked state. Used on viewer unmount. */
  clear(): void {
    this.pointers.clear();
    this.pinchStartDistance = 0;
    this.panStartY = null;
    this.panTotalDy = 0;
  }

  /** Snapshot for tests + per-frame reads. */
  get activeCount(): number {
    return this.pointers.size;
  }

  get totalVerticalDrag(): number {
    return this.panTotalDy;
  }
}

function distanceBetweenTwo(
  pointers: Map<number, ViewerPointer>,
): number {
  const arr = Array.from(pointers.values());
  if (arr.length < 2) return 0;
  const a = arr[0]!;
  const b = arr[1]!;
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function centreOfTwo(
  pointers: Map<number, ViewerPointer>,
): { readonly x: number; readonly y: number } {
  const arr = Array.from(pointers.values());
  if (arr.length < 2) return { x: 0, y: 0 };
  const a = arr[0]!;
  const b = arr[1]!;
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}
