/**
 * PANG — tap raycasting.
 *
 * Converts a pointer's client-coordinate position into a work id by
 * casting a ray from the camera through the tapped pixel and
 * intersecting the work meshes.
 *
 * Two design choices:
 *
 *   1. **Only work meshes.** We intersect just the list of work
 *      meshes, not the full scene, so the raycaster never returns
 *      the back wall or floor. An empty-space tap is an empty hit,
 *      which the gesture controller interprets as "return to centre."
 *
 *   2. **No visibility check.** The renderer already culls
 *      back-facing / off-screen geometry; we don't re-check. Overlap
 *      ordering is by distance, which is `intersectObjects`' default
 *      sort.
 */

import { Raycaster, Vector2 } from "three/webgpu";
import type { Mesh, PerspectiveCamera } from "three/webgpu";

const scratchNdc = new Vector2();
const scratchRaycaster = new Raycaster();

export function raycastWork(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  workMeshes: ReadonlyArray<Mesh>,
): string | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  // NDC: (-1..+1) in both axes. Y is flipped because DOM y grows
  // downward while WebGL NDC y grows upward.
  scratchNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );

  scratchRaycaster.setFromCamera(scratchNdc, camera);
  // `recursive: false` — the work meshes are terminal; no child
  // transforms to descend into.
  const hits = scratchRaycaster.intersectObjects(
    workMeshes as Mesh[],
    false,
  );
  if (hits.length === 0) return null;

  const first = hits[0];
  if (!first) return null;
  const id = first.object.userData?.["workId"];
  return typeof id === "string" ? id : null;
}
