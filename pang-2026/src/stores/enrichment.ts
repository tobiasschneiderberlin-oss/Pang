/**
 * PANG — enrichment store.
 *
 * Per-work state for the enrichment lifecycle. Mirrors the
 * OPFS-backed cache into an in-memory slice the render tree can
 * subscribe to without doing OPFS I/O on every focus change.
 *
 *   "none"       — no enrichment has ever been requested for this
 *                  work. Default for unknown ids.
 *   "enriching"  — submission accepted; agent is running (or queued
 *                  on the batch dispatch). UI shows no chatter, just
 *                  an absence: the focused surface renders what it
 *                  has and the timeline simply isn't there yet.
 *   "ready"      — a cached `EnrichmentOutput` is available for this
 *                  work; the surface reads it from the cache on
 *                  demand.
 *   "stale"      — hash drift was detected (intake record's content
 *                  fields changed after the enrichment was cached);
 *                  awaiting re-dispatch. Still rendered from the old
 *                  cache until the new payload lands — "less rich"
 *                  is better than "empty".
 *   "failed"     — the agent exhausted its retries. A future manual
 *                  refresh (iteration #7) can re-enqueue; for now
 *                  the state sits until reconcile clears it or the
 *                  work hash changes.
 *
 * The store holds the runtime state; `enrichment.persist.ts` mirrors
 * it to OPFS. The cache on disk is the durable payload; this store
 * is the durable *status*.
 *
 * Idempotency: `beginEnriching(workId, submissionId)` is a no-op
 * when the work's state is anything other than `"none"`, `"stale"`,
 * or `"failed"`. A second tap does not generate a second agent
 * run — the submissionId is the idempotency key and the server
 * deduplicates on it, but the client short-circuits first so the
 * observability stays tidy.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type EnrichmentState =
  | { kind: "none" }
  | {
      kind: "enriching";
      submissionId: string;
      submittedAt: string;
    }
  | {
      kind: "ready";
      submissionId: string;
      submittedAt: string;
      basedOnWorkHash: string;
      generatedAt: string;
    }
  | {
      kind: "stale";
      submissionId: string;
      submittedAt: string;
      /** The hash the cached payload was built against. */
      previousWorkHash: string;
      generatedAt: string;
    }
  | {
      kind: "failed";
      submissionId: string;
      submittedAt: string;
      reason: string;
    };

export type EnrichmentKind = EnrichmentState["kind"];

export interface EnrichmentStore {
  /** Map from workId → state. Missing entry means `{ kind: "none" }`. */
  readonly byWorkId: Readonly<Record<string, EnrichmentState>>;

  /**
   * Read a work's state. Returns `{ kind: "none" }` for unknown ids
   * rather than `undefined` so the render path never has to
   * defensive-default.
   */
  stateOf(workId: string): EnrichmentState;

  /**
   * Transition into `"enriching"`. Idempotent: if the work is
   * already in a non-terminal-retryable state (`"enriching"`,
   * `"ready"`), returns the existing state. Only `"none"`,
   * `"stale"`, and `"failed"` permit a new submission.
   *
   * Returns the state after the attempted transition — the caller
   * can compare `state.submissionId` to the one it generated to
   * detect an idempotent no-op.
   */
  beginEnriching(input: {
    workId: string;
    submissionId: string;
    submittedAt: string;
  }): EnrichmentState;

  /** Agent finished; cache now carries the fresh output. */
  markReady(
    workId: string,
    payload: {
      basedOnWorkHash: string;
      generatedAt: string;
    },
  ): void;

  /**
   * Hash drift detected at reconcile. Preserves the current
   * submission metadata so the next successful run can be attributed
   * to the same ask. `previousWorkHash` is kept for observability
   * (`enrichment.cache.invalidate` attribution).
   */
  markStale(
    workId: string,
    previousWorkHash: string,
  ): void;

  /** Mark terminal failure; `reason` is a short machine-readable key. */
  markFailed(workId: string, reason: string): void;

  /**
   * Force a state — used by persistence rehydration and the
   * reconcile path. Callers outside those surfaces should prefer
   * the explicit transitions above.
   */
  replaceState(workId: string, state: EnrichmentState): void;

  /** Reset for testing; not wired to any user action. */
  clear(): void;
}

/**
 * Module-scoped singleton "none" state. Exported so external
 * consumers (the Panel, any other store reader) can reuse the same
 * reference as a fallback inside Zustand selectors — a freshly
 * allocated `{ kind: "none" }` on every call would hand React an
 * unstable snapshot and trigger the `getServerSnapshot should be
 * cached to avoid an infinite loop` warning under `useSyncExternalStore`.
 */
export const ENRICHMENT_NONE: EnrichmentState = { kind: "none" };
const NONE: EnrichmentState = ENRICHMENT_NONE;

export const useEnrichment = create<EnrichmentStore>()(
  subscribeWithSelector((set, get) => ({
    byWorkId: {},

    stateOf(workId) {
      return get().byWorkId[workId] ?? NONE;
    },

    beginEnriching({ workId, submissionId, submittedAt }) {
      const current = get().byWorkId[workId] ?? NONE;
      const retryable =
        current.kind === "none" ||
        current.kind === "stale" ||
        current.kind === "failed";
      if (!retryable) return current;
      const next: EnrichmentState = {
        kind: "enriching",
        submissionId,
        submittedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
      return next;
    },

    markReady(workId, { basedOnWorkHash, generatedAt }) {
      const current = get().byWorkId[workId];
      if (!current) return;
      // Only transition from an in-flight or stale state. `"ready"`
      // → `"ready"` on the same hash is a no-op; a changed hash
      // lands by going through `"stale"` first (reconcile path).
      if (
        current.kind !== "enriching" &&
        current.kind !== "stale"
      ) {
        return;
      }
      const next: EnrichmentState = {
        kind: "ready",
        submissionId: current.submissionId,
        submittedAt: current.submittedAt,
        basedOnWorkHash,
        generatedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markStale(workId, previousWorkHash) {
      const current = get().byWorkId[workId];
      if (!current) return;
      // Only `"ready"` entries go stale. An `"enriching"` entry
      // keeps running — its output will land against the *new* hash.
      if (current.kind !== "ready") return;
      const next: EnrichmentState = {
        kind: "stale",
        submissionId: current.submissionId,
        submittedAt: current.submittedAt,
        previousWorkHash,
        generatedAt: current.generatedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markFailed(workId, reason) {
      const current = get().byWorkId[workId];
      if (!current) return;
      if (current.kind !== "enriching") return;
      const next: EnrichmentState = {
        kind: "failed",
        submissionId: current.submissionId,
        submittedAt: current.submittedAt,
        reason,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    replaceState(workId, state) {
      set((prev) => ({
        byWorkId: { ...prev.byWorkId, [workId]: state },
      }));
    },

    clear() {
      set({ byWorkId: {} });
    },
  })),
);
