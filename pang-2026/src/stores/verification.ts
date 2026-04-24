/**
 * PANG — verification store.
 *
 * Per-work state for the verification-request lifecycle. Mirrors the
 * outbox-durable truth into an in-memory slice the render tree can
 * subscribe to without doing OPFS I/O on every focus change.
 *
 *   "none"       — no request for this work (default on fresh entry)
 *   "requesting" — optimistic flip while the first POST is in flight
 *   "requested"  — server acked; gallery not yet contacted
 *   "dispatched" — collector has sent the URL-handoff message
 *                  (mailto:/wa.me) to the gallery; awaiting the
 *                  gallery's tap on confirm or decline (iter #10)
 *   "confirmed"  — gallery confirmed; `CollectionEntry.status` flipped
 *                  to `"verified"` in the works store on the same tick
 *   "declined"   — gallery declined; reflective state, not a retry prompt
 *   "expired"    — 30-day signed-link TTL elapsed without gallery action
 *   "failed"     — all retries exhausted; the ask-affordance re-appears
 *
 * The store holds the runtime state; `verification.persist.ts` mirrors
 * it to OPFS (index sidecar). The outbox is the source of truth for
 * unsent requests; this store is the source of truth for what the
 * surface shows. Reconcile at boot keeps the two aligned.
 *
 * Idempotency: `requestVerification(workId)` is a no-op when the
 * work's state is anything other than `"none"` or `"failed"`. A
 * second tap on a `"requesting"` or `"requested"` work does not
 * generate a second request id.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type VerificationState =
  | { kind: "none" }
  | { kind: "requesting"; requestId: string; submittedAt: string }
  | { kind: "requested"; requestId: string; submittedAt: string }
  | {
      kind: "dispatched";
      requestId: string;
      submittedAt: string;
      dispatchedAt: string;
      channel: "email" | "whatsapp";
    }
  | {
      kind: "confirmed";
      requestId: string;
      submittedAt: string;
      decidedAt: string;
    }
  | {
      kind: "declined";
      requestId: string;
      submittedAt: string;
      decidedAt: string;
    }
  | {
      kind: "expired";
      requestId: string;
      submittedAt: string;
      decidedAt: string;
    }
  | {
      kind: "failed";
      requestId: string;
      submittedAt: string;
      reason: string;
    };

export type VerificationKind = VerificationState["kind"];

/**
 * Per-work push-subscription decision. The offer is single-shot — we
 * do not nag. Once the collector has accepted, declined, or the
 * capability is unsupported, the chip never re-surfaces.
 *
 *   "unoffered"   — offer has not been made (default)
 *   "granted"     — subscription stored server-side
 *   "refused"     — collector said not now, or permission denied
 *   "unsupported" — environment cannot offer push (no VAPID / no API)
 */
export type PushDecision =
  | { kind: "unoffered" }
  | { kind: "granted"; storedAt: string }
  | { kind: "refused"; at: string }
  | { kind: "unsupported"; reason: string };

const PUSH_UNOFFERED: PushDecision = { kind: "unoffered" };

export interface VerificationStore {
  /** Map from workId → state. Missing entry means `{ kind: "none" }`. */
  readonly byWorkId: Readonly<Record<string, VerificationState>>;

  /**
   * Per-work push-subscription decision. Missing entry means
   * `{ kind: "unoffered" }`. Persisted alongside `byWorkId` so a
   * refresh doesn't re-offer.
   */
  readonly pushByWorkId: Readonly<Record<string, PushDecision>>;

  /**
   * Read a work's state. Returns `{ kind: "none" }` for unknown ids
   * rather than `undefined` so the render path never has to
   * defensive-default.
   */
  stateOf(workId: string): VerificationState;

  /**
   * Read a work's push decision. Returns `{ kind: "unoffered" }` for
   * unknown ids.
   */
  pushOf(workId: string): PushDecision;

  /** Record the collector's push decision for a work. Terminal. */
  setPushDecision(workId: string, decision: PushDecision): void;

  /**
   * Transition into `"requesting"`. Idempotent: if the work is
   * already in a non-retryable state (`"requesting"`,
   * `"requested"`, `"dispatched"`, `"confirmed"`, `"declined"`),
   * returns the existing state. Only `"none"`, `"failed"`, and
   * `"expired"` permit a new submission.
   *
   * Returns the state after the attempted transition — the caller
   * can compare `state.requestId` to the one it generated to detect
   * an idempotent no-op.
   */
  beginRequest(input: {
    workId: string;
    requestId: string;
    submittedAt: string;
  }): VerificationState;

  /** Ack from the server — flip from `"requesting"` to `"requested"`. */
  ack(workId: string): void;

  /** Mark terminal failure; `reason` is a short machine-readable key. */
  markFailed(workId: string, reason: string): void;

  /**
   * Collector handed off the message to their email client or
   * WhatsApp (iter #10). Transitions `"requested"` → `"dispatched"`.
   * Idempotent: a second call with the same channel leaves the
   * existing `dispatchedAt`; a channel change overrides.
   */
  markDispatched(input: {
    workId: string;
    dispatchedAt: string;
    channel: "email" | "whatsapp";
  }): void;

  /** Gallery confirmed. `decidedAt` is the outcome's server timestamp. */
  markConfirmed(workId: string, decidedAt: string): void;

  /** Gallery declined. */
  markDeclined(workId: string, decidedAt: string): void;

  /** Signed link's TTL elapsed without action. */
  markExpired(workId: string, decidedAt: string): void;

  /**
   * Force a state — used by persistence rehydration and the
   * reconcile path. Callers outside those surfaces should prefer
   * the explicit transitions above.
   */
  replaceState(workId: string, state: VerificationState): void;

  /** Reset for testing; not wired to any user action. */
  clear(): void;
}

const NONE: VerificationState = { kind: "none" };

export const useVerification = create<VerificationStore>()(
  subscribeWithSelector((set, get) => ({
    byWorkId: {},
    pushByWorkId: {},

    stateOf(workId) {
      return get().byWorkId[workId] ?? NONE;
    },

    pushOf(workId) {
      return get().pushByWorkId[workId] ?? PUSH_UNOFFERED;
    },

    setPushDecision(workId, decision) {
      set((state) => ({
        pushByWorkId: { ...state.pushByWorkId, [workId]: decision },
      }));
    },

    beginRequest({ workId, requestId, submittedAt }) {
      const current = get().byWorkId[workId] ?? NONE;
      const retryable =
        current.kind === "none" ||
        current.kind === "failed" ||
        current.kind === "expired";
      if (!retryable) return current;
      const next: VerificationState = {
        kind: "requesting",
        requestId,
        submittedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
      return next;
    },

    ack(workId) {
      const current = get().byWorkId[workId];
      if (!current) return;
      if (current.kind !== "requesting") return;
      const next: VerificationState = {
        kind: "requested",
        requestId: current.requestId,
        submittedAt: current.submittedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markFailed(workId, reason) {
      const current = get().byWorkId[workId];
      if (!current) return;
      // Only transition to failed from an in-flight state.
      if (
        current.kind !== "requesting" &&
        current.kind !== "requested" &&
        current.kind !== "dispatched"
      ) {
        return;
      }
      const next: VerificationState = {
        kind: "failed",
        requestId: current.requestId,
        submittedAt: current.submittedAt,
        reason,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markDispatched({ workId, dispatchedAt, channel }) {
      const current = get().byWorkId[workId];
      if (!current) return;
      // Only `"requested"` and `"dispatched"` permit this transition.
      // A second dispatch (different channel) overrides the record.
      if (current.kind !== "requested" && current.kind !== "dispatched") {
        return;
      }
      const next: VerificationState = {
        kind: "dispatched",
        requestId: current.requestId,
        submittedAt: current.submittedAt,
        dispatchedAt,
        channel,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markConfirmed(workId, decidedAt) {
      const current = get().byWorkId[workId];
      if (!current) return;
      if (
        current.kind === "confirmed" ||
        current.kind === "declined" ||
        current.kind === "expired"
      ) {
        return;
      }
      if (current.kind === "none") return;
      const next: VerificationState = {
        kind: "confirmed",
        requestId: current.requestId,
        submittedAt: current.submittedAt,
        decidedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markDeclined(workId, decidedAt) {
      const current = get().byWorkId[workId];
      if (!current) return;
      if (
        current.kind === "confirmed" ||
        current.kind === "declined" ||
        current.kind === "expired"
      ) {
        return;
      }
      if (current.kind === "none") return;
      const next: VerificationState = {
        kind: "declined",
        requestId: current.requestId,
        submittedAt: current.submittedAt,
        decidedAt,
      };
      set((state) => ({
        byWorkId: { ...state.byWorkId, [workId]: next },
      }));
    },

    markExpired(workId, decidedAt) {
      const current = get().byWorkId[workId];
      if (!current) return;
      if (
        current.kind === "confirmed" ||
        current.kind === "declined" ||
        current.kind === "expired"
      ) {
        return;
      }
      if (current.kind === "none") return;
      const next: VerificationState = {
        kind: "expired",
        requestId: current.requestId,
        submittedAt: current.submittedAt,
        decidedAt,
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
      set({ byWorkId: {}, pushByWorkId: {} });
    },
  })),
);
