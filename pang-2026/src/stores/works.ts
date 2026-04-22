/**
 * PANG — works store.
 *
 * The domain entry list for the collector's wall. A thin Zustand
 * slice, deliberately separate from the render-layer `Work` type in
 * `src/room/types.ts` — the store holds what the collection *is*
 * (id, image, aliveness, physical size), and `layoutEntries()`
 * projects that into *where each work hangs* (Work[] with positions
 * on the back wall).
 *
 * Why the separation:
 *   - The render-layer `Work` is a draw-call input. Adding a new
 *     domain field (artist, documents, provenance) must not ripple
 *     into the GPU path.
 *   - Layout is the policy; entries are the facts. A future multi-
 *     wall layout or a manual-hanging mode replaces `layoutEntries()`
 *     without touching the store.
 *
 * Persistence is owned by `works.persist.ts` (OPFS: index sidecar
 * + per-entry image bytes, installed on AppBoot). The store itself
 * stays pure/in-memory; the persistence layer is a mirror, not a
 * middleware, so tests and non-DOM consumers can exercise the
 * store without reaching for OPFS. Empty on fresh install — Laura
 * is the baseline.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ROOM, WORK_CENTRE_HEIGHT } from "@/room/constants";
import type { Work } from "@/room/types";
import type { IntakeOutput } from "@/ai/tools/artwork";

/**
 * A domain entry — what the collector *has*. Image is a URL (blob:,
 * OPFS-derived, or remote). Size is the physical wall footprint in
 * metres; the scene draws the work at that scale so depth reads
 * honestly.
 *
 * Aliveness is the single most important flag: `verified` works
 * receive the warm emissive bias; `unverified` works sit dormant,
 * waiting for the collector's request-verification tap.
 */
export interface CollectionEntry {
  readonly id: string;
  readonly imageUrl: string;
  readonly status: "verified" | "unverified";
  /** Wall footprint in metres, [width, height]. */
  readonly size: readonly [number, number];
}

interface WorksStore {
  readonly entries: readonly CollectionEntry[];
  /**
   * The currently focused work id, or `null` when the camera sits in
   * the wall-overview pose. Shared state — both canvas taps and DOM
   * twin activations write here, and the arrival chapter writes here
   * on mount so the home route's Room can open already focused on
   * the new work when the collector taps to return.
   *
   * Persistence: in-memory, like `entries`. A refresh returns to the
   * wall overview, not to the last-focused work.
   */
  readonly focusedId: string | null;
  /** Idempotent on `id` — adding an existing id replaces. */
  addEntry(entry: CollectionEntry): void;
  /** No-op if the id is not present. Clears focus if the removed id was focused. */
  removeEntry(id: string): void;
  /** Set or clear the focused work. */
  setFocusedId(id: string | null): void;
  /** Reset for testing; not wired to any user action. */
  clear(): void;
}

export const useWorks = create<WorksStore>()(
  subscribeWithSelector((set) => ({
    entries: [],
    focusedId: null,
    addEntry: (entry) =>
      set((state) => {
        const filtered = state.entries.filter((e) => e.id !== entry.id);
        return { entries: [...filtered, entry] };
      }),
    removeEntry: (id) =>
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
        focusedId: state.focusedId === id ? null : state.focusedId,
      })),
    setFocusedId: (id) => set({ focusedId: id }),
    clear: () => set({ entries: [], focusedId: null }),
  })),
);

/**
 * Wall-gap between works in metres. Mirrors the `--knob-wall-gap`
 * CSS knob spirit (which is px on DOM walls); the spatial surface
 * uses a fixed metric value for now. A future step reads the knob
 * and scales proportionally.
 */
const WALL_GAP_M = 0.4;

/** Centre height for all hung works, metres. Mirrors scene constant. */
const Z_WALL = -ROOM.depth / 2 + 0.01; // just in front of back wall

/**
 * Lay out entries as a single horizontal row on the back wall,
 * centre-balanced. No aesthetic-curation logic — the collector's
 * order is the order. Multi-row / multi-wall layouts replace this
 * function; callers don't need to know the strategy.
 *
 * Deterministic: same input, same output, same frame. The diff
 * effect in `TheRoomCanvas` depends on this for stable work poses.
 */
/**
 * Default wall footprint when the intake didn't pin physical
 * dimensions. 0.6 × 0.8 m is a common "small work" footprint;
 * gets corrected when the collector confirms or the gallery
 * verifies. The scene renders at this size until then — honest,
 * not arbitrary.
 */
const DEFAULT_SIZE_M: readonly [number, number] = [0.6, 0.8];

/**
 * Convert an intake agent output (IntakeOutput) plus the blob URL
 * of the rectified capture into a `CollectionEntry`. New intakes
 * land as `unverified`: the collector has told PANG "this is mine",
 * not "my gallery confirmed this is mine." Verification lives in
 * iteration #8; until then, the work sits dormant on the wall.
 *
 * `blobUrl` is expected to remain valid for the lifetime of this
 * session; OPFS rehydration (so the image survives refresh) lands
 * alongside P5 store persistence in a later iteration.
 */
export function entryFromIntake(
  output: IntakeOutput,
  blobUrl: string,
  opts: { id?: string } = {},
): CollectionEntry {
  const d = output.artwork.dimensionsCm;
  const size: readonly [number, number] = d
    ? [Math.max(0.05, d.w / 100), Math.max(0.05, d.h / 100)]
    : DEFAULT_SIZE_M;
  return {
    id: opts.id ?? makeEntryId(),
    imageUrl: blobUrl,
    status: "unverified",
    size,
  };
}

/**
 * Generate a store-local id for a new entry. `crypto.randomUUID()`
 * is available on modern Safari, Chrome, and Firefox; the fallback
 * is a timestamp + random — fine for client-local ids that never
 * round-trip to a server keyspace.
 */
function makeEntryId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function layoutEntries(
  entries: readonly CollectionEntry[],
): Work[] {
  if (entries.length === 0) return [];
  const totalW = entries.reduce(
    (sum, e, i) => sum + e.size[0] + (i > 0 ? WALL_GAP_M : 0),
    0,
  );
  let cursor = -totalW / 2;
  const out: Work[] = [];
  for (const e of entries) {
    const halfW = e.size[0] / 2;
    cursor += halfW;
    out.push({
      id: e.id,
      imageUrl: e.imageUrl,
      position: [cursor, WORK_CENTRE_HEIGHT, Z_WALL],
      size: e.size,
      status: e.status,
    });
    cursor += halfW + WALL_GAP_M;
  }
  return out;
}
