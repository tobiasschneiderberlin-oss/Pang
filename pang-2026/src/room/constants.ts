/**
 * PANG — The Room: metric constants.
 *
 * Pure data, no dependencies. Lives separate from `scene.ts` so
 * modules that only need the room's floor plan (the works store,
 * layout functions, a11y announcers) don't transitively pull in
 * Three.js. `three/webgpu` touches browser globals (`self`) at
 * module load, which trips Node's test runner and server-side
 * renderers; keeping constants pure keeps those callers clean.
 */

/**
 * Gallery cube, metres. 8m wide, 4m tall, 6m deep — a modest
 * museum-scale room that reads as "a room", not "a corridor."
 */
export const ROOM = {
  width: 8,
  height: 4,
  depth: 6,
} as const;

/** Centre height for a hung work, metres. Museum-standard 1500mm. */
export const WORK_CENTRE_HEIGHT = 1.5;
