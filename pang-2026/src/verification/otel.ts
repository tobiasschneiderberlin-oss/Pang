/**
 * PANG — verification observability.
 *
 * The iteration #4 brief's failure-mode paragraph names three
 * regression classes — *delivery*, *identity*, *state* — and asserts
 * they are observable without turning "the request didn't go
 * through" into an investigation. This module is where that
 * observability lives.
 *
 * Events are structured single-line JSON on `console.debug`, matching
 * the shape of `src/ai/chapter/otel.ts` so a future client-side
 * collector (iteration #5) ingests both without translation. The
 * event names live under the `verification.*` namespace; the
 * server-side endpoint also emits a `pang.api.verification.request`
 * OTel span (A10) through the existing span shim.
 *
 * Event catalogue (every one fires exactly once per edge unless
 * noted):
 *
 *   verification.outbox.enqueue      — OPFS write succeeded.
 *   verification.outbox.drain.start  — replay batch began.
 *   verification.outbox.drain.step   — one item processed (fires N
 *                                      times per drain).
 *   verification.outbox.drain.complete — replay batch finished.
 *   verification.request.submit      — POST started.
 *   verification.request.ack         — POST returned 2xx.
 *   verification.request.fail        — POST rejected or threw.
 *   verification.push.subscribe      — subscription probe resolved
 *                                      (granted | denied | unsupported).
 *   verification.confirmation.received — gallery confirmed.
 *   verification.decline.received    — gallery declined.
 *   verification.reconcile           — boot-time outbox/store
 *                                      reconcile completed.
 */

export type VerificationEvent =
  | "verification.outbox.enqueue"
  | "verification.outbox.drain.start"
  | "verification.outbox.drain.step"
  | "verification.outbox.drain.complete"
  | "verification.request.submit"
  | "verification.request.ack"
  | "verification.request.fail"
  | "verification.push.subscribe"
  | "verification.confirmation.received"
  | "verification.decline.received"
  | "verification.reconcile";

export interface VerificationEventPayload {
  readonly event: VerificationEvent;
  /** Wall-clock ms since epoch. */
  readonly t: number;
  readonly attrs: Record<
    string,
    string | number | boolean | readonly string[]
  >;
}

function emit(payload: VerificationEventPayload): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(JSON.stringify(payload));
  }
}

// ---------- Outbox -----------------------------------------------

export function outboxEnqueueEvent(
  requestId: string,
  workId: string,
): void {
  emit({
    event: "verification.outbox.enqueue",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.work_id": workId,
    },
  });
}

export function outboxDrainStartEvent(pending: number): void {
  emit({
    event: "verification.outbox.drain.start",
    t: Date.now(),
    attrs: { "pang.verification.pending": pending },
  });
}

export function outboxDrainStepEvent(
  requestId: string,
  outcome: "sent" | "retry" | "give-up",
  attempt: number,
): void {
  emit({
    event: "verification.outbox.drain.step",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.drain_outcome": outcome,
      "pang.verification.attempt": attempt,
    },
  });
}

export function outboxDrainCompleteEvent(
  sent: number,
  retried: number,
  gaveUp: number,
): void {
  emit({
    event: "verification.outbox.drain.complete",
    t: Date.now(),
    attrs: {
      "pang.verification.sent": sent,
      "pang.verification.retried": retried,
      "pang.verification.gave_up": gaveUp,
    },
  });
}

// ---------- Network ----------------------------------------------

export function requestSubmitEvent(
  requestId: string,
  workId: string,
  attempt: number,
): void {
  emit({
    event: "verification.request.submit",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.work_id": workId,
      "pang.verification.attempt": attempt,
    },
  });
}

export function requestAckEvent(
  requestId: string,
  workId: string,
  latencyMs: number,
): void {
  emit({
    event: "verification.request.ack",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.work_id": workId,
      "pang.verification.latency_ms": latencyMs,
    },
  });
}

export function requestFailEvent(
  requestId: string,
  workId: string,
  reason: string,
  attempt: number,
): void {
  emit({
    event: "verification.request.fail",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.work_id": workId,
      "pang.verification.reason": reason,
      "pang.verification.attempt": attempt,
    },
  });
}

// ---------- Push -------------------------------------------------

export type PushSubscribeOutcome =
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

export function pushSubscribeEvent(
  requestId: string,
  outcome: PushSubscribeOutcome,
  detail?: string,
): void {
  emit({
    event: "verification.push.subscribe",
    t: Date.now(),
    attrs: detail
      ? {
          "pang.verification.request_id": requestId,
          "pang.verification.push_outcome": outcome,
          "pang.verification.push_detail": detail,
        }
      : {
          "pang.verification.request_id": requestId,
          "pang.verification.push_outcome": outcome,
        },
  });
}

// ---------- Outcome ----------------------------------------------

export function confirmationReceivedEvent(
  requestId: string,
  workId: string,
  via: "push" | "reconcile" | "poll",
): void {
  emit({
    event: "verification.confirmation.received",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.work_id": workId,
      "pang.verification.via": via,
    },
  });
}

export function declineReceivedEvent(
  requestId: string,
  workId: string,
  via: "push" | "reconcile" | "poll",
): void {
  emit({
    event: "verification.decline.received",
    t: Date.now(),
    attrs: {
      "pang.verification.request_id": requestId,
      "pang.verification.work_id": workId,
      "pang.verification.via": via,
    },
  });
}

// ---------- Reconcile --------------------------------------------

export interface ReconcileSummary {
  readonly orphanOutboxEntries: number;
  readonly orphanStoreEntries: number;
  readonly resubmitted: number;
  readonly downgraded: number;
}

export function reconcileEvent(summary: ReconcileSummary): void {
  emit({
    event: "verification.reconcile",
    t: Date.now(),
    attrs: {
      "pang.verification.orphan_outbox": summary.orphanOutboxEntries,
      "pang.verification.orphan_store": summary.orphanStoreEntries,
      "pang.verification.resubmitted": summary.resubmitted,
      "pang.verification.downgraded": summary.downgraded,
    },
  });
}
