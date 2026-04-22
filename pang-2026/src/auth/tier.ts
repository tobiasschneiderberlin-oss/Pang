/**
 * PANG — capability tier detection.
 *
 * Three tiers. The Architecture doc fixes the semantics:
 *
 *   A — WebGPU + OffscreenCanvas + dedicated Worker + deviceMotion.
 *       Gets the full Room render with WebGPU Liquid Glass (Primitive
 *       §37), paint-depth parallax, specular highlights.
 *   B — WebGL 2 + OffscreenCanvas. No glass shader; the Room renders
 *       as a flat catalog with depth cues but no runtime refraction.
 *   C — No WebGL 2 or no OffscreenCanvas. A CSS-only grid ships;
 *       the 3D Room is swapped for a columns-based layout.
 *
 * Tier is read once at boot, written to `:root[data-tier]`, and never
 * re-evaluated mid-session. The assumption is that hardware does not
 * change, and browser flags do not toggle during a session.
 */

import { TIERS, type Tier } from "@design/locked";

/** Narrow runtime feature detection. Must not throw. */
function hasWebGPU(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator && typeof (navigator as { gpu?: unknown }).gpu === "object";
}

function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2");
    return ctx !== null;
  } catch {
    return false;
  }
}

function hasOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== "undefined";
}

function hasDeviceMotion(): boolean {
  return typeof DeviceMotionEvent !== "undefined";
}

export function detectCapabilityTier(): Tier {
  if (typeof window === "undefined") return "C"; // SSR

  const webgpu = hasWebGPU();
  const webgl2 = hasWebGL2();
  const offscreen = hasOffscreenCanvas();
  const motion = hasDeviceMotion();

  if (webgpu && offscreen && motion) return "A";
  if (webgl2 && offscreen) return "B";
  return "C";
}

/** Useful for tests, for the settings screen, and for observability. */
export function describeTier(tier: Tier): {
  tier: Tier;
  features: Readonly<Record<string, boolean>>;
} {
  return {
    tier,
    features: {
      webgpu: hasWebGPU(),
      webgl2: hasWebGL2(),
      offscreenCanvas: hasOffscreenCanvas(),
      deviceMotion: hasDeviceMotion(),
    },
  };
}

/** Re-export so consumers don't need to pull from `@design/locked`. */
export { TIERS };
export type { Tier };
