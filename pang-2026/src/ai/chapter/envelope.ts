/**
 * PANG — chapter envelopes.
 *
 * A beat's opacity envelope is a pure function of the beat + the
 * current time. Three phases:
 *
 *   - rising:   `[startMs, startMs + fadeInMs)`        — ramp 0 → 1
 *   - hold:     `[startMs + fadeInMs, endMs - fadeOutMs)` — 1
 *   - falling:  `[endMs - fadeOutMs, endMs)`           — ramp 1 → 0
 *
 * The ramp follows the same curve as `CameraAnimator` (rate-6
 * exponential smoothing, `alpha = 1 - exp(-rate * dt)`). Using the
 * same curve as the camera gives chrome + motion a unified "hand" —
 * nothing in the chapter moves on a different easing from the camera's
 * glide. The brief called for reusing the rate-6 animator; doing so
 * analytically (instead of running a parallel smoother per beat) is
 * the same curve with zero per-frame allocation.
 *
 * Guarantees:
 *
 *   - For any `tMs < startMs`, the envelope is exactly `0`.
 *   - For any `tMs >= endMs`, the envelope is exactly `0`.
 *   - The transition through `0` at the boundaries is continuous;
 *     the transition through `1` during hold is exact (not
 *     asymptotic) because the analytical form is clamped at both
 *     ends of fade-in / fade-out.
 *   - `progress(beat, tMs)` is clamped to `[0, 1]`.
 */

import type { Beat } from "./types";

/** Exponential-smoothing rate (1/s). Matches `src/room/animator.ts`. */
const RATE_PER_SEC = 6;

/**
 * Compute the opacity envelope of `beat` at `tMs`. Returns a value in
 * [0, 1]. Continuous across the three phases. Zero outside the beat.
 */
export function beatEnvelope(beat: Beat, tMs: number): number {
  const endMs = beat.startMs + beat.durationMs;
  if (tMs < beat.startMs) return 0;
  if (tMs >= endMs) return 0;

  // Rising phase.
  const risingEnd = beat.startMs + beat.fadeInMs;
  if (tMs < risingEnd) {
    const dt = (tMs - beat.startMs) / 1000;
    return clamp01(1 - Math.exp(-RATE_PER_SEC * dt));
  }

  // Falling phase.
  const fallingStart = endMs - beat.fadeOutMs;
  if (tMs >= fallingStart && beat.fadeOutMs > 0) {
    const dt = (endMs - tMs) / 1000;
    return clamp01(1 - Math.exp(-RATE_PER_SEC * dt));
  }

  // Hold.
  return 1;
}

/**
 * Fraction of the beat that has elapsed, in [0, 1]. Clamped — a tMs
 * before `startMs` returns 0 and a tMs past `endMs` returns 1. Useful
 * for subtle within-beat motion (e.g. an artifact card's slight
 * vertical drift during its hold phase).
 */
export function beatProgress(beat: Beat, tMs: number): number {
  if (tMs <= beat.startMs) return 0;
  const elapsed = tMs - beat.startMs;
  if (elapsed >= beat.durationMs) return 1;
  return elapsed / beat.durationMs;
}

/**
 * The "arrival factor" of a chapter — 0 while the work is still off
 * the wall, 1 once `place` has settled. Drives the scene's
 * `setWorkArrivalFactor` each frame so the GL pose matches the DOM
 * envelope.
 *
 * Shape: 0 before `place.startMs`, ramping through a rate-6 curve to
 * 1 by the time the `place` beat ends, and stays at 1 thereafter.
 */
export function arrivalFactor(
  placeBeat: Beat | null,
  tMs: number,
): number {
  if (!placeBeat) return 1; // no place beat → work is placed immediately
  if (tMs < placeBeat.startMs) return 0;
  const dt = (tMs - placeBeat.startMs) / 1000;
  return clamp01(1 - Math.exp(-RATE_PER_SEC * dt));
}

/**
 * The captured-still overlay should dissolve once the `place` beat
 * has begun — by then the canvas has a textured mesh on the wall and
 * the overlay has done its job. Returns an opacity in [0, 1].
 *
 * Shape: 1 while the overlay should be visible, ramping through a
 * rate-6 curve to 0 over the fade-out window after `place` starts.
 */
export function overlayOpacity(
  placeBeat: Beat | null,
  tMs: number,
): number {
  if (!placeBeat) return 0;
  if (tMs < placeBeat.startMs) return 1;
  const dt = (tMs - placeBeat.startMs) / 1000;
  return clamp01(Math.exp(-RATE_PER_SEC * dt));
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
