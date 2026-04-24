/**
 * PANG — verification reconcile.
 *
 * On boot, the render-cache store (`useVerification`) and the durable
 * outbox (OPFS) can drift. A crash between the outbox write and the
 * store flip leaves a record without a mirror; a crash between the
 * ack and the remove leaves a store in `"requested"` with an orphan
 * outbox file; a successful decide-then-crash can leave a
 * `"confirmed"` or `"declined"` store next to an outbox record that
 * should have been popped.
 *
 * This module closes that gap on every AppBoot. Four shapes of drift
 * are handled:
 *
 *   1. Outbox record, store says `"none"`
 *      — rehydrate the store to `"requesting"` from the record and
 *      let `drainOutbox` retry the send. Do NOT flip to `"requested"`
 *      here: we don't know whether the server saw the request, so
 *      `"requesting"` is the honest state.
 *
 *   2. Outbox record, store says `"confirmed"` | `"declined"`
 *      — the outbox is stale (the outcome already landed). Remove
 *      the record; the store wins.
 *
 *   3. Outbox record, store says `"failed"`
 *      — the failure path should have popped the record at the time.
 *      This is an orphan. Remove the record; the store wins.
 *
 *   4. Store says `"requesting"`, no outbox record
 *      — the optimistic flip survived but the durable write didn't,
 *      or the outbox file was garbage-collected. Downgrade to
 *      `"failed"` with reason `"reconcile/lost"` so the ask-affordance
 *      re-appears and the collector can tap again.
 *
 * After reconcile, `drainOutbox` is called so any due records (new
 * ones from case 1, plus anything from a prior session whose
 * `nextAttemptAt` has passed) replay immediately. The `online`
 * listener wires the same drain to reconnection.
 *
 * This module is the spine's *failure-mode* answer for the
 * verification surface — iteration #4's fifth declaration made
 * "observable, not magical" explicit. Every reconcile path fires
 * `verification.reconcile` with tallies so a desync is visible in
 * telemetry.
 */

import { drainOutbox } from "./submit";
import {
  listOutboxRecords,
  removeOutboxRecord,
  type OutboxRecord,
} from "./outbox";
import { reconcileEvent, type ReconcileSummary } from "./otel";
import { useVerification, type VerificationState } from "@/stores/verification";

/**
 * Deterministic plan for a reconcile pass. Given the current outbox
 * records and the store's `byWorkId` snapshot, returns the set of
 * side-effects that should run (record IDs to remove, workIds to
 * rehydrate to `"requesting"`, workIds to downgrade to `"failed"`).
 *
 * Pure — no I/O, no store writes. The caller applies the plan.
 * Testable in isolation from OPFS.
 */
export interface ReconcilePlan {
  readonly summary: ReconcileSummary;
  /** Request IDs whose outbox record should be removed. */
  readonly recordsToRemove: readonly string[];
  /** Work IDs to rehydrate into `"requesting"` state. */
  readonly rehydrate: ReadonlyArray<{
    readonly workId: string;
    readonly state: VerificationState;
  }>;
  /** Work IDs whose `"requesting"` state should downgrade to `"failed"`. */
  readonly downgrade: ReadonlyArray<{
    readonly workId: string;
    readonly reason: string;
  }>;
}

export function planReconcile(
  records: readonly OutboxRecord[],
  byWorkId: Readonly<Record<string, VerificationState>>,
): ReconcilePlan {
  const byRequestId = new Map<string, OutboxRecord>();
  for (const r of records) byRequestId.set(r.request.requestId, r);

  const recordsToRemove: string[] = [];
  const rehydrate: { workId: string; state: VerificationState }[] = [];
  const downgrade: { workId: string; reason: string }[] = [];

  let orphanOutboxEntries = 0;
  let orphanStoreEntries = 0;
  let resubmitted = 0;
  let downgraded = 0;

  for (const record of records) {
    const { workId, requestId, submittedAt } = record.request;
    const current = byWorkId[workId] ?? { kind: "none" as const };

    switch (current.kind) {
      case "none": {
        rehydrate.push({
          workId,
          state: { kind: "requesting", requestId, submittedAt },
        });
        resubmitted += 1;
        break;
      }
      case "confirmed":
      case "declined":
      case "expired":
      case "failed": {
        recordsToRemove.push(requestId);
        orphanOutboxEntries += 1;
        break;
      }
      case "requesting":
      case "requested":
      case "dispatched":
        // In-flight or awaiting gallery action. Leave the outbox
        // entry in place; the dispatched-state walker polls
        // /api/verification/outcome in `reconcileVerification()`.
        break;
      default: {
        const _never: never = current;
        void _never;
      }
    }
  }

  for (const [workId, state] of Object.entries(byWorkId)) {
    if (state.kind !== "requesting") continue;
    if (byRequestId.has(state.requestId)) continue;
    downgrade.push({ workId, reason: "reconcile/lost" });
    orphanStoreEntries += 1;
    downgraded += 1;
  }

  return {
    summary: {
      orphanOutboxEntries,
      orphanStoreEntries,
      resubmitted,
      downgraded,
    },
    recordsToRemove,
    rehydrate,
    downgrade,
  };
}

/**
 * Run the reconcile pass. Idempotent: calling twice with no state
 * change does nothing the second time. Safe to call before
 * `drainOutbox` (it calls `drainOutbox` itself at the end).
 *
 * Returns the summary so the boot path can log it, and tests can
 * assert on it.
 */
export async function reconcileVerification(): Promise<ReconcileSummary> {
  const records = await listOutboxRecords();
  const store = useVerification.getState();
  const plan = planReconcile(records, store.byWorkId);

  for (const requestId of plan.recordsToRemove) {
    await removeOutboxRecord(requestId);
  }
  for (const { workId, state } of plan.rehydrate) {
    store.replaceState(workId, state);
  }
  for (const { workId, reason } of plan.downgrade) {
    store.markFailed(workId, reason);
  }

  reconcileEvent(plan.summary);

  // After reconcile, kick the drain so any due records replay now.
  // `drainOutbox` is a no-op if nothing is due. We swallow errors —
  // the drain path already logs its own events and the reconcile
  // summary reflects the pre-drain state.
  try {
    await drainOutbox();
  } catch {
    // non-fatal
  }

  return plan.summary;
}

/**
 * Install the `window.online` listener that drains the outbox when
 * connectivity returns. Returns an unsubscribe function so tests and
 * hot-reload can clean up. Safe to call more than once — each
 * install returns its own unsubscribe.
 *
 * Does not call `drainOutbox` on install; that's `reconcileVerification`'s
 * job. The listener is purely edge-triggered on the `online` event.
 */
export function installOnlineDrain(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    void drainOutbox().catch(() => {});
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

// ---------- Dispatched-state walker (iter #10) -------------------

/**
 * Poll `/api/verification/outcome/<requestId>` for a single dispatched
 * entry. Returns the outcome if the gallery has acted, else `null`.
 *
 * The endpoint returns:
 *   - 204 No Content — no outcome yet; keep polling.
 *   - 200 + VerificationOutcome — gallery acted; flip the store.
 *   - 401 — the collector session evaporated; give up.
 *   - 5xx / network — transient; the walker's caller will retry with
 *     backoff.
 *
 * Separated from the store flip so tests can assert on the wire-level
 * classification without DOM / store plumbing.
 */
export async function pollOutcomeOnce(
  requestId: string,
): Promise<
  | { readonly kind: "pending" }
  | { readonly kind: "outcome"; readonly outcome: "confirmed" | "declined" | "expired"; readonly decidedAt: string }
  | { readonly kind: "unauth" }
  | { readonly kind: "error"; readonly reason: string }
> {
  let res: Response;
  try {
    res = await fetch(`/api/verification/outcome/${requestId}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (err) {
    return { kind: "error", reason: err instanceof Error ? err.message : "network" };
  }
  if (res.status === 204) return { kind: "pending" };
  if (res.status === 401) return { kind: "unauth" };
  if (!res.ok) {
    return { kind: "error", reason: `http/${res.status}` };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { kind: "error", reason: "bad_json" };
  }
  const { VerificationOutcomeSchema } = await import("./schema");
  const parsed = VerificationOutcomeSchema.safeParse(json);
  if (!parsed.success) return { kind: "error", reason: "schema" };
  return {
    kind: "outcome",
    outcome: parsed.data.outcome,
    decidedAt: parsed.data.decidedAt,
  };
}

/**
 * Install a `document.visibilitychange` listener that runs
 * `walkDispatchedOnce` when the collector's tab becomes visible again.
 * The collector who sent an email on Monday comes back on Wednesday;
 * this is the moment to fold any confirmed / declined outcomes that
 * landed in the meantime. Push is the primary rail, but push isn't
 * guaranteed (denied permission, expired subscription, browser
 * silencing); the visibility walker is the always-available
 * reconciliation path.
 *
 * Returns an unsubscribe function so tests and hot-reload can clean
 * up. Safe to call more than once.
 */
export function installDispatchedVisibilityWalker(): () => void {
  if (typeof document === "undefined") return () => {};
  const handler = (): void => {
    if (document.visibilityState !== "visible") return;
    void walkDispatchedOnce().catch(() => {});
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

/**
 * Walk the store's dispatched entries and fold any landed outcomes
 * into the store. Idempotent: calling twice with no new outcomes is
 * a no-op. Safe to call on a timer or in response to a
 * `visibilitychange`.
 *
 * Returns a count of outcomes applied so the caller can log telemetry
 * and tests can assert.
 */
export async function walkDispatchedOnce(): Promise<number> {
  if (typeof fetch === "undefined") return 0;
  const store = useVerification.getState();
  const dispatched = Object.entries(store.byWorkId).filter(
    ([, state]) => state.kind === "dispatched",
  );
  if (dispatched.length === 0) return 0;

  let applied = 0;
  for (const [workId, state] of dispatched) {
    if (state.kind !== "dispatched") continue;
    const result = await pollOutcomeOnce(state.requestId);
    if (result.kind === "outcome") {
      if (result.outcome === "confirmed") {
        store.markConfirmed(workId, result.decidedAt);
      } else if (result.outcome === "declined") {
        store.markDeclined(workId, result.decidedAt);
      } else {
        // expired
        store.markExpired(workId, result.decidedAt);
      }
      applied += 1;
    }
    // pending / unauth / error — leave the dispatched state alone.
  }
  return applied;
}
