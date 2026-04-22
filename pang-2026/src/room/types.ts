/**
 * PANG — The Room: shared types.
 *
 * The room surface has three capability tiers (DS Ch. 08 / Appendix
 * D). Capability detection runs once on mount; every renderer under
 * `gpu/` and `gl2/` implements the `RoomRenderer` contract so the
 * React mount can swap them without adapter code. Tier `none` is a
 * DOM fallback — the spine never breaks, only the surface does.
 *
 * `Work` is the room's *view* of a verified collection entry. It
 * carries only the fields the GPU draw needs (image URL + pose +
 * aliveness tier). The full domain entry shape lives elsewhere (the
 * works store); the room is deliberately decoupled so a schema
 * change in intake doesn't ripple into a draw call.
 */

/** Runtime-detected capability tier for the room surface. */
export type Tier = "gpu" | "gl2" | "none";

export interface Work {
  readonly id: string;
  /** Blob URL or OPFS handle URL. The scene loads textures lazily. */
  readonly imageUrl: string;
  /** Wall position, metres, room-frame (Y-up, -Z is the back wall). */
  readonly position: readonly [number, number, number];
  /** Physical size on the wall, metres (width × height). */
  readonly size: readonly [number, number];
  /**
   * Aliveness. `verified` works receive a warmer emissive bias and
   * light preference; `unverified` works sit quiet, awaiting the
   * collector's tap.
   */
  readonly status: "verified" | "unverified";
}

/**
 * The contract every renderer must implement. Narrow by design —
 * anything richer (setCamera, setExposure, setTimeOfDay) lives on the
 * scene or the gesture controller, not the renderer. Gives us one
 * seam to swap WebGPU for WebGL2 and nothing more.
 */
export interface RoomRenderer {
  /** The canvas the renderer binds to. Same canvas for both tiers. */
  readonly canvas: HTMLCanvasElement;
  /** Async init (WebGPU adapter request). Must be awaited. */
  init(): Promise<void>;
  /** Render one frame. Non-throwing; absorbs device-lost internally. */
  render(): void;
  /** Size change. Called on resize + devicePixelRatio change. */
  resize(width: number, height: number, dpr: number): void;
  /** Release GPU resources. Called on unmount. */
  dispose(): void;
}
