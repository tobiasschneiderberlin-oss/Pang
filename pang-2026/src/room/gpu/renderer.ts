/**
 * PANG — WebGPU renderer wrapper (room, tier A).
 *
 * Thin adapter over `three/webgpu` `WebGPURenderer`. The wrapper's
 * only job is to satisfy the `RoomRenderer` contract so `TheRoomCanvas`
 * can swap it with the WebGL2 wrapper without touching React code.
 *
 * `three/webgpu` resolves to `build/three.webgpu.js` (see the `three`
 * package `exports` map). The classic `MeshStandardMaterial` /
 * `DirectionalLight` / `Scene` values in `scene.ts` pass through r170's
 * transparent translation layer — we do **not** re-author materials
 * as TSL nodes here, and the scene stays renderer-agnostic.
 *
 * Device-lost is the one path worth naming: `WebGPURenderer` emits a
 * `lost` event through `onDeviceLost`; we absorb it, log once, and let
 * the next frame no-op. The React mount observes the renderer's state
 * and re-detects capability on a downgrade cascade. For the scaffold
 * the absorb is silent — the observer wiring lands with the gesture
 * step.
 */

import type { Scene, PerspectiveCamera } from "three/webgpu";
import type { RoomRenderer } from "../types";

export async function createGPURenderer(
  canvas: HTMLCanvasElement,
  scene: Scene,
  camera: PerspectiveCamera,
): Promise<RoomRenderer> {
  // Lazy import — the `three/webgpu` bundle is ~250kB gzipped and
  // is never loaded on tier B/C devices. Dynamic import keeps it out
  // of the WebGL2 path.
  const mod = await import("three/webgpu");
  const { WebGPURenderer } = mod;

  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
  });

  // Absorb device-lost. The React mount can re-init if it wants; the
  // inner loop simply stops drawing. Never throws to the RAF callback.
  renderer.onDeviceLost = () => {
    // A verbose warning would trip P6 (CSP) observability budgets on
    // every lost-device event; the observable ledger (A9, iteration
    // later) will route this properly. For now: swallow.
  };

  let initialized = false;

  async function init(): Promise<void> {
    if (initialized) return;
    await renderer.init();
    // sRGB output — matches `scene.ts` texture colorSpace.
    renderer.outputColorSpace = "srgb";
    initialized = true;
  }

  function render(): void {
    if (!initialized) return;
    // `WebGPURenderer.render` returns `Promise<void> | undefined`.
    // We fire-and-forget: the RAF callback is the ordering guarantee
    // we need, not the promise chain. Errors are absorbed to keep the
    // loop alive.
    try {
      const maybe = renderer.render(scene, camera);
      if (maybe && typeof maybe.then === "function") {
        maybe.catch(() => {
          /* swallowed per contract */
        });
      }
    } catch {
      /* swallowed */
    }
  }

  function resize(width: number, height: number, dpr: number): void {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, /* updateStyle */ false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    renderer.dispose();
  }

  return { canvas, init, render, resize, dispose };
}
