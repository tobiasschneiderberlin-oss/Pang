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
      case "failed": {
        recordsToRemove.push(requestId);
        orphanOutboxEntries += 1;
        break;
      }
      case "requesting":
      case "requested":
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
