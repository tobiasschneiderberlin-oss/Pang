/**
 * PANG — camera animator.
 *
 * Drives the camera toward a moving target position + look-at using
 * exponential smoothing. Not a Framer spring (deliberately — the
 * spring primitive is a 2018 default), not momentum (explicit
 * out-of-scope in the iteration brief). A single rate constant
 * gives a critically-damped single-settle feel that matches the
 * "Granola confidence glide" reference: one soft arrival, no bounce.
 *
 * The math: `alpha = 1 - exp(-rate * dt)`. Frame-rate independent
 * (60Hz and 120Hz behave the same), time-integration stable (never
 * overshoots), and the only tuning knob is `rate` (higher = snappier).
 *
 * We keep the animator's internal position separate from the
 * `PerspectiveCamera` — the animator advances a state vector every
 * tick, then writes the camera. Lets the gesture controller mutate
 * *targets* without fighting the RAF loop.
 */

import type { PerspectiveCamera } from "three/webgpu";

/** Exponential-smoothing rate (units: 1/s). Higher = snappier. */
const DEFAULT_RATE = 6.0;

/**
 * A camera target in world coordinates. `eye` is where the camera
 * sits; `gaze` is the point it looks at. Both are metres.
 */
export interface CameraTarget {
  eye: [number, number, number];
  gaze: [number, number, number];
}

export class CameraAnimator {
  private readonly camera: PerspectiveCamera;
  private readonly rate: number;

  /** Current (animated) eye position. */
  private eyeX = 0;
  private eyeY = 1.7;
  private eyeZ = 2.5;

  /** Current gaze point (what the camera looks at). */
  private gazeX = 0;
  private gazeY = 1.5;
  private gazeZ = -3;

  /** Target position the animator glides toward. Mutated externally. */
  public target: CameraTarget = {
    eye: [0, 1.7, 2.5],
    gaze: [0, 1.5, -3],
  };

  constructor(camera: PerspectiveCamera, rate: number = DEFAULT_RATE) {
    this.camera = camera;
    this.rate = rate;
    // Seed from the camera's initial pose so the first tick doesn't
    // spring-jump from (0,0,0).
    this.eyeX = camera.position.x;
    this.eyeY = camera.position.y;
    this.eyeZ = camera.position.z;
    this.target.eye = [this.eyeX, this.eyeY, this.eyeZ];
  }

  /**
   * Advance the animator by `dt` seconds and push the result to the
   * camera. Safe to call every frame — the smoothing coefficient is
   * time-integrated so variable frame times don't distort motion.
   */
  tick(dt: number): void {
    // Clamp dt so a tab-switched pause doesn't cause a snap on resume.
    const step = Math.min(dt, 0.1);
    const alpha = 1 - Math.exp(-this.rate * step);

    this.eyeX += (this.target.eye[0] - this.eyeX) * alpha;
    this.eyeY += (this.target.eye[1] - this.eyeY) * alpha;
    this.eyeZ += (this.target.eye[2] - this.eyeZ) * alpha;

    this.gazeX += (this.target.gaze[0] - this.gazeX) * alpha;
    this.gazeY += (this.target.gaze[1] - this.gazeY) * alpha;
    this.gazeZ += (this.target.gaze[2] - this.gazeZ) * alpha;

    this.camera.position.set(this.eyeX, this.eyeY, this.eyeZ);
    this.camera.lookAt(this.gazeX, this.gazeY, this.gazeZ);
  }

  /** Snap to the target without smoothing. For unit-test seeding. */
  snap(): void {
    this.eyeX = this.target.eye[0];
    this.eyeY = this.target.eye[1];
    this.eyeZ = this.target.eye[2];
    this.gazeX = this.target.gaze[0];
    this.gazeY = this.target.gaze[1];
    this.gazeZ = this.target.gaze[2];
    this.camera.position.set(this.eyeX, this.eyeY, this.eyeZ);
    this.camera.lookAt(this.gazeX, this.gazeY, this.gazeZ);
  }
}
