"use client";
/**
 * PANG — The Room canvas mount.
 *
 * Client component. Detects capability once, picks a renderer, runs
 * the RAF loop, and wires in the iteration-#2 interaction layer:
 * gesture controller, animator, tap raycaster, time-of-day knob.
 *
 * The separation of concerns stays clean:
 *   - `scene.ts` owns geometry + lighting + work meshes
 *   - `gestures.ts` owns pointer handling + gesture state
 *   - `animator.ts` owns the smooth-follow from state to camera
 *   - `tap.ts` owns the raycaster
 *   - This file owns the *composition* — how state becomes a
 *     `CameraTarget` each frame, and the RAF tick order
 *
 * Why a thin composition: the room's primary art surface is a
 * `<canvas>` (P9). Separating the GL lifetime from React
 * reconciliation keeps re-renders (sidecar UI, tweaks menu) from
 * recreating the renderer every state change.
 *
 * DOM twin (tier `none`, plus the screen-reader navigable list that
 * shadows the canvas tree) lands in the next step — this component
 * renders nothing visible when the tier resolves to `"none"` so that
 * the a11y implementation has a clean seam to mount into.
 */

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactElement, Ref } from "react";
import { detectCapability } from "../capability";
import { buildRoomScene, ROOM, WORK_CENTRE_HEIGHT } from "../scene";
import type { RoomScene } from "../scene";
import { CameraAnimator } from "../animator";
import type { CameraTarget } from "../animator";
import { attachGestureController } from "../gestures";
import type { GestureState } from "../gestures";
import { raycastWork } from "../tap";
import type { RoomRenderer, Tier, Work } from "../types";

/**
 * Field-wise equality for a `Work`. Used by the diff effect to skip
 * `scene.addWork` calls when a render pass hands the canvas a fresh
 * array that happens to carry identical values (Zustand + layout
 * recompute produces new array identities each update even when
 * the payload is unchanged).
 */
function worksEqual(a: Work, b: Work): boolean {
  return (
    a.id === b.id &&
    a.imageUrl === b.imageUrl &&
    a.status === b.status &&
    a.size[0] === b.size[0] &&
    a.size[1] === b.size[1] &&
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2]
  );
}

/**
 * Distance the camera sits from a focused work, metres. Arm's-length
 * museum viewing — close enough for detail, not so close the camera
 * clips the wall.
 */
const FOCUS_DISTANCE = 1.5;

/**
 * Default eye Z: the camera stands half a metre from the front wall
 * by default, giving the longest view of the back wall without
 * bumping into its own frustum far plane.
 */
const DEFAULT_EYE_Z = ROOM.depth / 2 - 0.5;

/** Eye height, metres (standing adult). */
const EYE_HEIGHT = 1.7;

/**
 * Imperative handle exposed to parents that need to drive focus
 * from outside the canvas — the DOM twin is the canonical caller
 * (screen-reader user activates a work in the list; the canvas
 * glides to it). The internal pointer tap path continues to work
 * unchanged; this is purely an additional write channel.
 */
export interface TheRoomCanvasHandle {
  /** Request focus on a work, or clear focus when `null`. */
  focusWork(id: string | null): void;
}

export interface TheRoomCanvasProps {
  readonly works: readonly Work[];
  /** Imperative handle for external focus control (DOM twin). */
  readonly ref?: Ref<TheRoomCanvasHandle>;
  /** Called once the first frame has drawn. */
  readonly onReady?: () => void;
  /** Called when capability resolves to `none`. */
  readonly onNoCapability?: () => void;
  /** Called when a tap lands on a work (id) or empty space (null). */
  readonly onFocusChange?: (workId: string | null) => void;
}

/**
 * Compute the animator's target from gesture state + scene. Pure;
 * called every frame. Two cases:
 *
 *   - Focus set: the camera glides to stand `FOCUS_DISTANCE` metres
 *     in front of the work, at eye height, gaze at the work centre.
 *   - No focus: the camera returns to the wall-panned default pose,
 *     gaze level across the back wall.
 */
function computeCameraTarget(
  state: GestureState,
  scene: RoomScene,
): CameraTarget {
  if (state.focusWorkId) {
    const centroid = scene.getWorkCentroid(state.focusWorkId);
    if (centroid) {
      const [wx, wy, wz] = centroid;
      return {
        eye: [wx, EYE_HEIGHT, wz + FOCUS_DISTANCE],
        gaze: [wx, wy, wz],
      };
    }
    // Focus target vanished (work removed) — fall through to default.
  }
  return {
    eye: [state.wallX, EYE_HEIGHT, DEFAULT_EYE_Z],
    gaze: [state.wallX, WORK_CENTRE_HEIGHT, -ROOM.depth / 2],
  };
}

/**
 * One-shot read of the `--knob-time-warmth` CSS knob. The knob menu
 * (which mutates it) hasn't landed yet — when it does, it will
 * broadcast through the preference store and this component
 * subscribes. For now: read once on mount.
 */
function readTimeWarmth(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--knob-time-warmth",
  );
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export function TheRoomCanvas({
  works,
  ref,
  onReady,
  onNoCapability,
  onFocusChange,
}: TheRoomCanvasProps): ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);

  // The scene is owned by the mount effect but read by the diff
  // effect (and, later, by imperative handles like a focus-by-id
  // API). Refs keep both paths honest without prop-drilling.
  const sceneRef = useRef<RoomScene | null>(null);
  const worksSnapshotRef = useRef<ReadonlyMap<string, Work>>(new Map());
  // Live gesture state, exposed via ref so the imperative handle
  // can write to it. A pointer tap and an external focus request
  // go through the same mutation point — the RAF loop doesn't care
  // which path wrote the id.
  const gestureStateRef = useRef<GestureState | null>(null);
  // Pending focus request stash. `focusWork()` can be called before
  // the async mount() finishes wiring the gesture state (the arrival
  // chapter writes focus into the store on mount, and the Room's
  // capability detection + renderer init typically takes 1–2 RAFs).
  // `undefined` means "no request stashed"; `null` is a valid stash
  // meaning "clear focus on ready".
  const pendingFocusRef = useRef<string | null | undefined>(undefined);

  useImperativeHandle(
    ref,
    () => ({
      focusWork(id) {
        const state = gestureStateRef.current;
        if (state) state.focusWorkId = id;
        else pendingFocusRef.current = id;
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let renderer: RoomRenderer | null = null;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let sceneDispose: (() => void) | null = null;
    let gestureDispose: (() => void) | null = null;

    async function mount(): Promise<void> {
      const resolved = await detectCapability();
      if (cancelled) return;
      setTier(resolved);

      if (resolved === "none") {
        onNoCapability?.();
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

      const roomScene = buildRoomScene(works);
      sceneDispose = roomScene.dispose;
      sceneRef.current = roomScene;
      worksSnapshotRef.current = new Map(works.map((w) => [w.id, w]));

      // Apply the time-of-day knob once on mount. Knob subscriptions
      // land with the Tweaks menu.
      roomScene.setLightingByWarmth(readTimeWarmth());

      // Pick the renderer. Lazy-import the gpu path so tier B devices
      // never pay its cost.
      if (resolved === "gpu") {
        const { createGPURenderer } = await import("../gpu/renderer");
        renderer = await createGPURenderer(
          canvas,
          roomScene.scene,
          roomScene.camera,
        );
      } else {
        const { createGL2Renderer } = await import("../gl2/renderer");
        renderer = await createGL2Renderer(
          canvas,
          roomScene.scene,
          roomScene.camera,
        );
      }

      await renderer.init();
      if (cancelled) {
        renderer.dispose();
        return;
      }

      renderer.resize(rect.width, rect.height, dpr);

      // Animator + gesture controller. Wire the raycaster into the
      // gesture's `hitTest` binding so a tap resolves to a work id.
      const animator = new CameraAnimator(roomScene.camera);
      const gesture = attachGestureController(canvas, {
        hitTest(cx, cy) {
          return raycastWork(
            cx,
            cy,
            canvas,
            roomScene.camera,
            roomScene.getWorkMeshes(),
          );
        },
      });
      gestureDispose = gesture.dispose;
      // Publish the live gesture state so the imperative handle can
      // drive focus from outside. Cleared on effect teardown below.
      gestureStateRef.current = gesture.state;

      // Apply any focus requested before the gesture state existed
      // (see `pendingFocusRef` — arrival chapter writes focus on
      // mount; the canvas's async init typically lands 1–2 RAFs
      // later, so the request must survive that window).
      if (pendingFocusRef.current !== undefined) {
        gesture.state.focusWorkId = pendingFocusRef.current;
        pendingFocusRef.current = undefined;
      }

      // Emit focus changes to the parent (for DOM twin sync later).
      let lastFocus: string | null = null;

      resizeObserver = new ResizeObserver((entries) => {
        if (!renderer) return;
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        const currentDpr = Math.min(window.devicePixelRatio ?? 1, 2);
        renderer.resize(width, height, currentDpr);
      });
      resizeObserver.observe(canvas);

      // RAF loop.
      let ready = false;
      let lastT = performance.now();
      const loop = (): void => {
        if (cancelled || !renderer) return;
        const now = performance.now();
        const dt = (now - lastT) / 1000;
        lastT = now;

        // State → target → camera.
        animator.target = computeCameraTarget(gesture.state, roomScene);
        animator.tick(dt);

        // Focus change notification.
        if (gesture.state.focusWorkId !== lastFocus) {
          lastFocus = gesture.state.focusWorkId;
          onFocusChange?.(lastFocus);
        }

        renderer.render();

        if (!ready) {
          ready = true;
          onReady?.();
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    void mount();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      gestureDispose?.();
      renderer?.dispose();
      sceneDispose?.();
      sceneRef.current = null;
      worksSnapshotRef.current = new Map();
      gestureStateRef.current = null;
      pendingFocusRef.current = undefined;
    };
    // `works` intentionally excluded — it seeds the scene on mount
    // but subsequent changes are handled by the diff effect below,
    // which mutates the scene in place via `addWork` / `removeWork`.
    // Including `works` here would tear down the GL context on every
    // update; the whole point of the diff effect is to keep the
    // context alive across data changes.
    //
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diff effect: fires on every `works` change (including the first
  // render after mount). If the scene is built, push deltas; if
  // not, no-op — the mount effect seeds the scene with the current
  // `works` when it finishes, so we don't miss anything.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const prev = worksSnapshotRef.current;
    const next = new Map(works.map((w) => [w.id, w]));

    // Removed.
    for (const id of prev.keys()) {
      if (!next.has(id)) scene.removeWork(id);
    }
    // Added / changed.
    for (const [id, w] of next) {
      const was = prev.get(id);
      if (!was || !worksEqual(was, w)) scene.addWork(w);
    }
    worksSnapshotRef.current = next;
  }, [works]);

  // Tier "none": render nothing. The DOM twin mounts separately.
  if (tier === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      // Fill the mounting parent. The room is the primary surface
      // (DS Ch. 08) — sidecar UI overlays, it doesn't displace.
      // `touch-action: none` prevents the browser's default horizontal
      // swipe-to-navigate / pull-to-refresh from stealing pan gestures.
      className="block h-full w-full touch-none"
      aria-label="Your collection"
      // The DOM twin (sibling element) carries the screen-reader tree;
      // the canvas itself is presentation.
      role="presentation"
    />
  );
}
