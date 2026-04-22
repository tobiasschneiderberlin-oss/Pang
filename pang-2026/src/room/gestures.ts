/**
 * PANG — room gestures.
 *
 * Pointer-event controller for the room canvas. Translates a single
 * pointer's horizontal motion into a wall-pan offset, and a pointer
 * that *didn't* drag into a tap. The controller owns no rendering
 * state — it mutates a plain `GestureState` object that the RAF
 * loop reads. This seam lets the animator stay renderer-agnostic
 * and lets the gesture layer be replaced (e.g., by keyboard
 * navigation on the DOM twin) without touching the scene.
 *
 * Why `PointerEvent` and not `touchstart`:
 *   - Unifies mouse + touch + pen + stylus in one API (MDN, 2026).
 *   - Supports `setPointerCapture` so a drag that leaves the canvas
 *     is still tracked until `pointerup`.
 *   - `passive: false` is unnecessary because we only `preventDefault`
 *     on `pointerdown` after a threshold — no scroll contention.
 *
 * Tap vs. drag disambiguation:
 *   - A pointer that moves < `TAP_THRESHOLD_PX` in client space before
 *     `pointerup` is classified as a tap.
 *   - Anything more is a drag; no tap fires.
 *
 * Coordinate frame:
 *   - `wallX` is a horizontal pan offset in **metres** (world frame).
 *   - Sensitivity converts pixels of finger travel into metres of
 *     camera motion. 1px → `PIXEL_TO_METRE` metres. The exact rate
 *     is tuning; this is the reference number.
 */

import { ROOM } from "./scene";

/** Pixels of movement between down/up below which a gesture is a tap. */
const TAP_THRESHOLD_PX = 8;

/** Metres of camera travel per pixel of horizontal drag. */
const PIXEL_TO_METRE = 0.006;

/**
 * Margin from the side walls the camera refuses to cross. The camera
 * stays at least this far from each side wall so the gaze frustum
 * can't skim behind the architecture.
 */
const WALL_CLEARANCE = 1.2;

export interface GestureState {
  /** Wall pan offset, metres. Clamped to the room's floor plan. */
  wallX: number;
  /**
   * When set, the animator glides the camera to face this work.
   * When null, the animator returns to the default centred view.
   * Set by `onTapWork`; cleared on the next wall-drag.
   */
  focusWorkId: string | null;
}

export interface GestureBindings {
  /**
   * Called with the tapped work's id when a tap lands on a work
   * mesh. An empty-space tap gets `null`, which the controller uses
   * to clear focus.
   */
  hitTest(clientX: number, clientY: number): string | null;
}

/**
 * Attach pointer handlers to the canvas. Returns a `{ state, dispose }`
 * pair; the state object is live — mutated by the controller, read
 * by the RAF loop.
 */
export function attachGestureController(
  canvas: HTMLCanvasElement,
  bindings: GestureBindings,
): { state: GestureState; dispose: () => void } {
  const state: GestureState = {
    wallX: 0,
    focusWorkId: null,
  };

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startWallX = 0;
  let movedBeyondTap = false;

  const xMin = -ROOM.width / 2 + WALL_CLEARANCE;
  const xMax = ROOM.width / 2 - WALL_CLEARANCE;

  function onPointerDown(e: PointerEvent): void {
    if (pointerId !== null) return; // single-pointer for this iteration
    pointerId = e.pointerId;
    // Capture can throw under exotic conditions (pointer withdrawn, stylus
    // rejection, synthetic test events). Catch and continue — the handler
    // state still holds, drags still track; capture is a nice-to-have that
    // keeps the pointer routed to this canvas if the finger slides off.
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      /* capture unavailable; continue without it */
    }
    startX = e.clientX;
    startY = e.clientY;
    startWallX = state.wallX;
    movedBeyondTap = false;
  }

  function onPointerMove(e: PointerEvent): void {
    if (pointerId !== e.pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);

    if (!movedBeyondTap && dist >= TAP_THRESHOLD_PX) {
      movedBeyondTap = true;
      // First motion past threshold: clear any active focus so the
      // wall-pan starts from the *current* displayed camera, not the
      // pre-focus centre. (The animator converges on the gesture
      // state each tick; clearing focus immediately is the right
      // signal.)
      state.focusWorkId = null;
    }

    if (movedBeyondTap) {
      // Horizontal drag only — vertical motion is discarded this
      // iteration (no pitch gesture).
      const nextX = startWallX - dx * PIXEL_TO_METRE;
      state.wallX = Math.max(xMin, Math.min(xMax, nextX));
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (pointerId !== e.pointerId) return;
    const wasTap = !movedBeyondTap;
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      /* released already */
    }
    pointerId = null;

    if (wasTap) {
      const hit = bindings.hitTest(e.clientX, e.clientY);
      state.focusWorkId = hit; // null clears focus (empty-space tap)
    }
  }

  function onPointerCancel(e: PointerEvent): void {
    if (pointerId !== e.pointerId) return;
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      /* released already */
    }
    pointerId = null;
    // Mid-cancel: preserve whatever the state currently is. The
    // animator will simply hold position.
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  function dispose(): void {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    if (pointerId !== null) {
      try {
        canvas.releasePointerCapture(pointerId);
      } catch {
        /* ignored */
      }
    }
  }

  return { state, dispose };
}
