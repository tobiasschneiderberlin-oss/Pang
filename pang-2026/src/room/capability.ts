/**
 * PANG — room capability detection.
 *
 * Probes the runtime for the best renderer tier, in order:
 *
 *   1. WebGPU — `navigator.gpu.requestAdapter()` must resolve to a
 *      live adapter. The call is cheap on a warm browser; we still
 *      race it against a short timeout so a mis-configured device
 *      doesn't stall the room's first paint.
 *   2. WebGL2 — a throwaway `<canvas>` must return a
 *      `WebGL2RenderingContext`. Any renderer-relevant extension
 *      checks live in `gl2/renderer.ts`, not here — this test only
 *      answers "can we draw at all."
 *   3. none — DOM twin handles the render. Laura still sees her
 *      collection; she just sees it as a screen-reader navigable list.
 *
 * Mobile Safari on iOS 18+ has WebGPU behind a flag; WebGL2 is the
 * normal tier there. Android Chrome and desktop Chromium report WebGPU
 * as of 2026. `none` is rare in practice — accessibility tools, very
 * old browsers, privacy-hardened profiles that block `navigator.gpu`.
 */

import type { Tier } from "./types";

/** Upper bound on the adapter request — if WebGPU stalls, fall back. */
const WEBGPU_PROBE_TIMEOUT_MS = 500;

/**
 * Returns the best available tier for the current runtime. Pure —
 * does not retain the adapter or context; the actual renderer will
 * request its own.
 */
export async function detectCapability(): Promise<Tier> {
  if (typeof window === "undefined") return "none";

  // ---- 1. WebGPU ----
  // `navigator.gpu` is the entry point; `requestAdapter()` may resolve
  // to null on devices without a compatible backend even when the API
  // is present. Race against a timeout so a slow probe never delays
  // the first paint.
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (gpu) {
    try {
      const adapter = await Promise.race([
        gpu.requestAdapter(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), WEBGPU_PROBE_TIMEOUT_MS),
        ),
      ]);
      if (adapter) return "gpu";
    } catch {
      // Fall through to WebGL2.
    }
  }

  // ---- 2. WebGL2 ----
  // A detached canvas keeps the probe free of layout side-effects.
  // The context is released to the GC immediately after the check.
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (gl) return "gl2";
  } catch {
    // Fall through.
  }

  return "none";
}
