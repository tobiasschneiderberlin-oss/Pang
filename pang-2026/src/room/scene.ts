/**
 * PANG — room scene factory.
 *
 * Builds a renderer-agnostic Three.js scene: four walls, floor,
 * ceiling, ambient + directional lighting, and one plane per work.
 * Materials are the classic Three.js lineage (`MeshStandardMaterial`,
 * `MeshBasicMaterial`) — the r170 transparent translation runs them
 * on both the WebGL2 and WebGPU backends without authoring shader
 * nodes twice.
 *
 * The scene exposes small handles — `addWork`, `updateWork`,
 * `removeWork`, `setLighting` — so the gesture controller (iteration
 * #2 step 2) and the works store can mutate it without re-creating
 * the geometry every frame.
 *
 * Texture loading is lazy and resilient: a missing image leaves the
 * work as a paper-coloured rectangle rather than throwing. The spine
 * never breaks on a single asset failure.
 */

// **Single-module imports.** In r170 `three/webgpu` is a superset
// bundle that re-exports every core class *and* wires them into the
// node-lighting library (`LightsNode.setupNodeLights` looks up lights
// by class identity). Importing `Scene`/`Mesh`/`AmbientLight` from
// the classic `three` entry while using `WebGPURenderer` from
// `three/webgpu` produces two copies of every class and breaks the
// lookup (console: "Multiple instances of Three.js being imported"
// + "Light node not found for AmbientLight"). The unified import
// makes the scene work on both the WebGPU path and the WebGL2 path
// (via `WebGPURenderer({ forceWebGL: true })`).
import * as THREE from "three/webgpu";
import type { Work } from "./types";
import { LIGHT_PRESETS, ROOM_PALETTE, type LightPreset } from "./palette";
// Metric constants live in `./constants` — a pure-data module so the
// works store and layout helpers can import the floor plan without
// transitively loading `three/webgpu` (which touches `self` at module
// load and breaks Node test runners / server-side renderers). Scene
// re-exports them to keep existing import paths working.
import { ROOM, WORK_CENTRE_HEIGHT } from "./constants";

export { ROOM, WORK_CENTRE_HEIGHT };

/** Depth of a work relative to the wall plane (slight stand-off). */
const WORK_STANDOFF = 0.04;

/**
 * Emissive scalar applied to verified works at rest. The arrival
 * chapter ramps its *own* emissive from 0 up to this value over the
 * place beat so the work reads as igniting as it arrives. Keep this in
 * sync with `buildWorkEntry`'s verified case — changing one without
 * the other produces a discontinuity when the arrival factor lands at 1.
 */
const VERIFIED_EMISSIVE_SCALAR = 0.08;

export interface RoomScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Add a work plane. Idempotent on `work.id` — updates if present. */
  addWork(work: Work): void;
  /** Remove a work plane and dispose its material + texture. */
  removeWork(id: string): void;
  /** Swap lighting preset. Texture loads do not re-run. */
  setLighting(preset: LightPreset): void;
  /**
   * Interpolated lighting between the two presets. `t` runs from 0
   * (full `day`, cool) to 1 (full `dusk`, warm). Bound to the
   * `--knob-time-warmth` CSS knob by `TheRoomCanvas`.
   */
  setLightingByWarmth(t: number): void;
  /**
   * Enumerate the live work meshes (for raycasting in `tap.ts`).
   * Returns a fresh array each call so the caller can mutate its
   * own copy without affecting scene state.
   */
  getWorkMeshes(): ReadonlyArray<THREE.Mesh>;
  /**
   * Look up a work's centroid (world coordinates) by id. Returns
   * null when the work is not mounted. The gesture controller uses
   * this to compute camera focus targets.
   */
  getWorkCentroid(id: string): [number, number, number] | null;
  /**
   * Drive a work's "arrival factor" — the GL side of the arrival
   * chapter's `place` beat. At `t=0`, the mesh sits flush to the wall
   * (zero stand-off) with no emissive warmth; at `t=1`, it has settled
   * into its hanging pose (full stand-off, verified-level emissive).
   * Intermediate values interpolate both. Safe to call every frame —
   * no allocations, writes are idempotent.
   *
   * Called by `ArrivalChapter` off the `chapter/envelope.ts#arrivalFactor`
   * curve so the DOM overlay, the ARIA line, and the GL pose all ride
   * the same rate-6 exponential — the spine's "one hand across chrome,
   * camera, and motion" made literal.
   */
  setWorkArrivalFactor(id: string, t: number): void;
  /** Dispose everything — geometries, materials, textures. */
  dispose(): void;
}

/** Internal handle kept per work so we can dispose precisely. */
interface WorkEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  texture: THREE.Texture | null;
  /**
   * The work's canonical wall Z — the position the layout assigned.
   * `addWork()` already offsets `mesh.position.z` by `WORK_STANDOFF`,
   * so we cache the unoffset Z here to drive the arrival animation
   * without double-counting.
   */
  baseWallZ: number;
  /** `true` for verified works (lit by default at factor=1). */
  verified: boolean;
}

export function buildRoomScene(
  initialWorks: readonly Work[] = [],
): RoomScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ROOM_PALETTE.paper);

  // ---- Camera ---------------------------------------------------
  // FOV 60° (vertical) — museum-standard gaze, well under the
  // fish-eye threshold. Phone-first framing is the forcing function:
  // at a 50° FOV, portrait aspect collapses the horizontal visible
  // width on the back wall to ~2.5m, clipping works at the wall's
  // edges. 60° restores the ~3.2m span at 5.5m depth without pushing
  // perspective into caricature. Desktop landscape stays generous.
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 1.7, ROOM.depth / 2 - 0.5);
  camera.lookAt(0, WORK_CENTRE_HEIGHT, -ROOM.depth / 2);

  // ---- Architecture --------------------------------------------
  // Walls + floor + ceiling. Single-sided materials; the camera
  // lives inside the box, so we flip the face normals by scaling
  // the box on one axis. Cheaper than authoring six planes.
  const shell = buildShell();
  scene.add(shell);

  // ---- Lighting (default: day) ---------------------------------
  const lightRig = buildLightRig("day");
  scene.add(lightRig.group);

  // ---- Works ---------------------------------------------------
  const works = new Map<string, WorkEntry>();
  for (const w of initialWorks) {
    const entry = buildWorkEntry(w);
    works.set(w.id, entry);
    scene.add(entry.mesh);
  }

  function addWork(work: Work): void {
    const existing = works.get(work.id);
    if (existing) {
      disposeWorkEntry(existing);
      scene.remove(existing.mesh);
    }
    const entry = buildWorkEntry(work);
    works.set(work.id, entry);
    scene.add(entry.mesh);
  }

  function removeWork(id: string): void {
    const entry = works.get(id);
    if (!entry) return;
    scene.remove(entry.mesh);
    disposeWorkEntry(entry);
    works.delete(id);
  }

  function setLighting(preset: LightPreset): void {
    lightRig.setPreset(preset);
  }

  function setLightingByWarmth(t: number): void {
    lightRig.setWarmth(Math.max(0, Math.min(1, t)));
  }

  function getWorkMeshes(): ReadonlyArray<THREE.Mesh> {
    return [...works.values()].map((e) => e.mesh);
  }

  function getWorkCentroid(
    id: string,
  ): [number, number, number] | null {
    const entry = works.get(id);
    if (!entry) return null;
    const p = entry.mesh.position;
    return [p.x, p.y, p.z];
  }

  // Scratch colours — avoid per-frame allocation when the arrival
  // RAF loop calls `setWorkArrivalFactor` every frame.
  const arrivalEmissiveWarm = new THREE.Color(ROOM_PALETTE.warm);
  const arrivalEmissiveScratch = new THREE.Color();

  function setWorkArrivalFactor(id: string, t: number): void {
    const entry = works.get(id);
    if (!entry) return;
    // Clamp here so callers don't need to. NaN-guards against dt
    // glitches on first-frame.
    const f = Number.isFinite(t)
      ? t < 0
        ? 0
        : t > 1
          ? 1
          : t
      : 1;
    // Z-offset: 0 → mesh flush to the wall; 1 → full stand-off.
    entry.mesh.position.z = entry.baseWallZ + WORK_STANDOFF * f;
    // Emissive: 0 → dark; 1 → verified warmth (or 0 for dormant works
    // whose rest state is unlit — we still pass through so the
    // dormant case no-ops gracefully).
    if (entry.verified) {
      arrivalEmissiveScratch
        .copy(arrivalEmissiveWarm)
        .multiplyScalar(VERIFIED_EMISSIVE_SCALAR * f);
      entry.material.emissive.copy(arrivalEmissiveScratch);
    }
  }

  function dispose(): void {
    for (const entry of works.values()) disposeWorkEntry(entry);
    works.clear();
    shell.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mat = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) for (const m of mat) m.dispose();
        else mat.dispose();
      }
    });
    lightRig.dispose();
  }

  return {
    scene,
    camera,
    addWork,
    removeWork,
    setLighting,
    setLightingByWarmth,
    getWorkMeshes,
    getWorkCentroid,
    setWorkArrivalFactor,
    dispose,
  };
}

// ---- helpers ------------------------------------------------------

function buildShell(): THREE.Group {
  const group = new THREE.Group();
  group.name = "room-shell";

  const paperMat = new THREE.MeshStandardMaterial({
    color: ROOM_PALETTE.paper,
    roughness: 0.95,
    metalness: 0,
    side: THREE.FrontSide,
  });
  const paperSoftMat = new THREE.MeshStandardMaterial({
    color: ROOM_PALETTE.paperSoft,
    roughness: 0.96,
    metalness: 0,
    side: THREE.FrontSide,
  });

  // Back wall (-Z), primary. Works hang here.
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    paperMat,
  );
  backWall.position.set(0, ROOM.height / 2, -ROOM.depth / 2);
  group.add(backWall);

  // Front wall (+Z), behind the camera — quieter, receives fill only.
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    paperSoftMat,
  );
  frontWall.position.set(0, ROOM.height / 2, ROOM.depth / 2);
  frontWall.rotation.y = Math.PI;
  group.add(frontWall);

  // Left wall.
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.depth, ROOM.height),
    paperSoftMat,
  );
  leftWall.position.set(-ROOM.width / 2, ROOM.height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  // Right wall.
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.depth, ROOM.height),
    paperSoftMat,
  );
  rightWall.position.set(ROOM.width / 2, ROOM.height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  // Floor — slightly darker paper, subtle grip for the eye.
  const floorMat = new THREE.MeshStandardMaterial({
    color: ROOM_PALETTE.paperSoft,
    roughness: 0.98,
    metalness: 0,
    side: THREE.FrontSide,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    floorMat,
  );
  floor.position.set(0, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Ceiling.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    paperSoftMat,
  );
  ceiling.position.set(0, ROOM.height, 0);
  ceiling.rotation.x = Math.PI / 2;
  group.add(ceiling);

  return group;
}

interface LightRig {
  group: THREE.Group;
  setPreset(preset: LightPreset): void;
  /**
   * Interpolate between `day` (t=0, cool) and `dusk` (t=1, warm).
   * Bound to the `--knob-time-warmth` CSS knob.
   */
  setWarmth(t: number): void;
  dispose(): void;
}

function buildLightRig(initial: LightPreset): LightRig {
  const group = new THREE.Group();
  group.name = "room-lighting";

  const ambient = new THREE.AmbientLight(0xffffff, 1);
  group.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1);
  group.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1);
  group.add(fill);

  // Scratch colour objects for lerp — avoid per-tick allocation when
  // `setWarmth` is called from the RAF loop (knob animation later).
  const keyFrom = new THREE.Color();
  const keyTo = new THREE.Color();
  const fillFrom = new THREE.Color();
  const fillTo = new THREE.Color();

  function setPreset(preset: LightPreset): void {
    const p = LIGHT_PRESETS[preset];
    ambient.intensity = p.ambient;
    key.color.setHex(p.key.color);
    key.intensity = p.key.intensity;
    // Destructure readonly tuples — `Vector3.set(x, y, z)` is not a
    // rest parameter, so spreading the `readonly [_, _, _]` literal
    // type trips TS2556.
    const [kx, ky, kz] = p.key.from;
    key.position.set(kx, ky, kz);
    fill.color.setHex(p.fill.color);
    fill.intensity = p.fill.intensity;
    const [fx, fy, fz] = p.fill.from;
    fill.position.set(fx, fy, fz);
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function setWarmth(t: number): void {
    // Lerp day → dusk. Not generic for N presets; good enough for the
    // two-point scale the knob declares. Extend with a LUT if the
    // knob gains more stops.
    const a = LIGHT_PRESETS.day;
    const b = LIGHT_PRESETS.dusk;
    ambient.intensity = lerp(a.ambient, b.ambient, t);

    keyFrom.setHex(a.key.color);
    keyTo.setHex(b.key.color);
    key.color.copy(keyFrom).lerp(keyTo, t);
    key.intensity = lerp(a.key.intensity, b.key.intensity, t);
    key.position.set(
      lerp(a.key.from[0], b.key.from[0], t),
      lerp(a.key.from[1], b.key.from[1], t),
      lerp(a.key.from[2], b.key.from[2], t),
    );

    fillFrom.setHex(a.fill.color);
    fillTo.setHex(b.fill.color);
    fill.color.copy(fillFrom).lerp(fillTo, t);
    fill.intensity = lerp(a.fill.intensity, b.fill.intensity, t);
    fill.position.set(
      lerp(a.fill.from[0], b.fill.from[0], t),
      lerp(a.fill.from[1], b.fill.from[1], t),
      lerp(a.fill.from[2], b.fill.from[2], t),
    );
  }

  setPreset(initial);

  function dispose(): void {
    // DirectionalLight + AmbientLight don't own GPU resources that
    // require explicit disposal in r170, but detaching is tidy.
    group.clear();
  }

  return { group, setPreset, setWarmth, dispose };
}

function buildWorkEntry(work: Work): WorkEntry {
  const [w, h] = work.size;
  const geom = new THREE.PlaneGeometry(w, h);

  // Alive (verified) works: a touch of emissive warmth so they read
  // as breathing vs. the quiet dormant planes. Dormant works are
  // slightly recessed in value — the hierarchy is *lit vs. unlit*,
  // not colour vs. colour.
  const verified = work.status === "verified";
  const emissive = verified
    ? new THREE.Color(ROOM_PALETTE.warm).multiplyScalar(
        VERIFIED_EMISSIVE_SCALAR,
      )
    : new THREE.Color(0x000000);

  const material = new THREE.MeshStandardMaterial({
    color: ROOM_PALETTE.paperSoft,
    emissive,
    roughness: 0.85,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = `work:${work.id}`;
  // Stand-off from the wall so the work reads as hung, not printed.
  const [px, py, pz] = work.position;
  mesh.position.set(px, py, pz + WORK_STANDOFF);
  mesh.userData = { workId: work.id };

  // Texture loads lazily. A missing image leaves the paper plane.
  let texture: THREE.Texture | null = null;
  if (work.imageUrl) {
    const loader = new THREE.TextureLoader();
    loader.load(
      work.imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        material.map = tex;
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
        texture = tex;
      },
      undefined,
      () => {
        // Swallow — the paper fallback stays. The works store owns
        // the retry contract; the scene is not a retry actor.
      },
    );
  }

  return { mesh, material, texture, baseWallZ: pz, verified };
}

function disposeWorkEntry(entry: WorkEntry): void {
  entry.mesh.geometry.dispose();
  entry.material.dispose();
  entry.texture?.dispose();
}
