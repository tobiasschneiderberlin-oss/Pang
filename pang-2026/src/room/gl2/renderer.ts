/**
 * PANG — WebGL2 renderer wrapper (room, tier B).
 *
 * **Same renderer class as tier A, different backend.** In r170 the
 * `WebGPURenderer` with `forceWebGL: true` is the supported WebGL2
 * path — it uses the same node materials / lighting pipeline as the
 * WebGPU backend, which means the scene factory (`src/room/scene.ts`)
 * is truly tier-agnostic and classic materials like
 * `MeshStandardMaterial` translate through the node library on both
 * paths.
 *
 * We do **not** use the classic `three.WebGLRenderer` any more: the
 * node-lights library does not look up lights by the classes exported
 * from the classic `three` module, so mixing produces
 * "Multiple instances of Three.js" + "Light node not found" console
 * noise and dark unlit surfaces (hard-won during iteration #2 smoke
 * test). One module, one materials pipeline, two backends.
 */

import type { Scene, PerspectiveCamera } from "three/webgpu";
import type { RoomRenderer } from "../types";

export async function createGL2Renderer(
  canvas: HTMLCanvasElement,
  scene: Scene,
  camera: PerspectiveCamera,
): Promise<RoomRenderer> {
  // Lazy import: `three/webgpu` is a ~1MB bundle; we load it exactly
  // once per session (tier A and tier B share the same module).
  const mod = await import("three/webgpu");
  const { WebGPURenderer } = mod;

  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    forceWebGL: true,
  });

  renderer.onDeviceLost = () => {
    /* swallowed — see contract */
  };

  let initialized = false;

  async function init(): Promise<void> {
    if (initialized) return;
    await renderer.init();
    renderer.outputColorSpace = "srgb";
    initialized = true;
  }

  function render(): void {
    if (!initialized) return;
    try {
      const maybe = renderer.render(scene, camera);
      if (maybe && typeof maybe.then === "function") {
        maybe.catch(() => {
          /* swallowed */
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
