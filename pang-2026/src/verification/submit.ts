/**
 * PANG — client-side verification submitter.
 *
 * The glue between the collector's tap and the server's ack. Three
 * public entry points:
 *
 *   - `submitVerificationOnce`  — one POST against `/api/verification/
 *     request`. Pure network + schema-validation; does not mutate the
 *     store or outbox. The caller drives retries via `RETRY_POLICY`.
 *
 *   - `dispatchVerificationRequest` — the primary action. Writes to
 *     the outbox, flips the store to `"requesting"`, posts, and
 *     flips to `"requested"` on 2xx or `"failed"` on terminal.
 *     Classifies error codes so a 4xx is terminal (never retried)
 *     and a 5xx / network error enters the retry schedule.
 *
 *   - `drainOutbox` — wakes the outbox: walks every durable record
 *     whose `nextAttemptAt` is in the past and re-submits it with
 *     incremented attempt counts. Called on AppBoot, on
 *     `window.addEventListener("online", …)`, and from the reconcile
 *     path.
 *
 * Classification table:
 *
 *   | HTTP | client sees         | retry? | store outcome              |
 *   |------|---------------------|--------|----------------------------|
 *   | 200  | ack                 | n/a    | `"requested"`              |
 *   | 4xx  | `schema|voice|bad*` | no     | `"failed"` (reason:http4xx)|
 *   | 5xx  | transient           | yes    | stays in outbox            |
 *   | net  | `"network/timeout"` | yes    | stays in outbox            |
 *
 * The retry table mirrors `RETRY_POLICY.baseDelaysMs`. After
 * `shouldGiveUp(attempt)` the record is popped from the outbox and
 * the store flips to `"failed"` with `reason: "retries/exhausted"`.
 *
 * Every edge emits a `verification.*` instant so a regression is
 * diagnosable without attaching a debugger. The spans declared by
 * the server-side route round-trip through a request header someday
 * (iteration #5 collector); iteration #4 cross-correlates by
 * `requestId`.
 */

import { VerificationAckSchema, type VerificationRequest } from "./schema";
import {
  enqueueVerificationRequest,
  listOutboxRecords,
  removeOutboxRecord,
  updateOutboxRecord,
  type OutboxRecord,
} from "./outbox";
import { nextDelayMs, shouldGiveUp } from "./retry";
import {
  outboxDrainCompleteEvent,
  outboxDrainStartEvent,
  outboxDrainStepEvent,
  requestAckEvent,
  requestFailEvent,
  requestSubmitEvent,
} from "./otel";
import { useVerification } from "@/stores/verification";

// ---------- Result shapes ----------------------------------------

export type SubmitOutcome =
  | { kind: "ack"; receivedAt: string; latencyMs: number }
  | {
      kind: "terminal";
      status: number;
      errorKey: string;
    }
  | { kind: "transient"; reason: string };

const ENDPOINT = "/api/verification/request";

// ---------- Pure one-shot POST ----------------------------------

/**
 * Fire one POST. Does not touch the store or outbox. Caller decides
 * what to do with the outcome.
 */
export async function submitVerificationOnce(
  request: VerificationRequest,
): Promise<SubmitOutcome> {
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      // The request is already durable in the outbox; a cache miss is
      // fine. No credentials are needed — iteration #4 is gallery-gated
      // at the link level, not per-request auth.
      cache: "no-store",
      credentials: "omit",
      keepalive: true,
    });
  } catch (err) {
    return {
      kind: "transient",
      reason: classifyNetworkError(err),
    };
  }

  const latencyMs = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      startedAt,
  );

  // 2xx = ack.
  if (res.status >= 200 && res.status < 300) {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { kind: "transient", reason: "ack/parse" };
    }
    const ack = VerificationAckSchema.safeParse(json);
    if (!ack.success) {
      return { kind: "transient", reason: "ack/schema" };
    }
    return {
      kind: "ack",
      receivedAt: ack.data.receivedAt,
      latencyMs,
    };
  }

  // 4xx = terminal (client bug). 5xx = transient (server bug).
  if (res.status >= 400 && res.status < 500) {
    const errorKey = await extractErrorKey(res);
    return { kind: "terminal", status: res.status, errorKey };
  }
  return {
    kind: "transient",
    reason: `http/${res.status}`,
  };
}

// ---------- Primary dispatch -------------------------------------

/**
 * The main entry the UI calls. Enqueues the request durably, flips
 * the store, tries to POST once. On 2xx removes the outbox record;
 * on transient leaves it (so the drain picks it up later). On
 * terminal removes it and flips the store to `"failed"`.
 */
export async function dispatchVerificationRequest(
  request: VerificationRequest,
): Promise<SubmitOutcome> {
  const store = useVerification.getState();

  // Durable-first: write to the outbox before the store flips so a
  // crash between the two leaves a record the reconcile can recover.
  let record: OutboxRecord;
  try {
    record = await enqueueVerificationRequest(request);
  } catch (err) {
    // Outbox write failed — the surface must not show an optimistic
    // `"requesting"`. Flip straight to `"failed"` so the ask-affordance
    // re-appears.
    store.replaceState(request.workId, {
      kind: "failed",
      requestId: request.requestId,
      submittedAt: request.submittedAt,
      reason: classifyOutboxError(err),
    });
    return {
      kind: "transient",
      reason: "outbox/write",
    };
  }

  // Optimistic store flip. `beginRequest` is idempotent — if the work
  // is already `"requested"`, it returns the existing state and our
  // new requestId is silently dropped (the outbox holds two records
  // in that pathological case; the dedup-on-requestId at the server
  // keeps things honest).
  store.beginRequest({
    workId: request.workId,
    requestId: request.requestId,
    submittedAt: request.submittedAt,
  });

  return postAndResolve(record);
}

// ---------- Post + resolve one record ----------------------------

/**
 * POST a single outbox record, applying the store side-effects for
 * each possible outcome. Shared by the primary dispatch path and the
 * drain path — the retry bookkeeping lives in `drainOutbox`, not
 * here.
 */
async function postAndResolve(record: OutboxRecord): Promise<SubmitOutcome> {
  const store = useVerification.getState();
  const { request } = record;

  requestSubmitEvent(
    request.requestId,
    request.workId,
    record.attempt,
  );

  const outcome = await submitVerificationOnce(request);

  if (outcome.kind === "ack") {
    requestAckEvent(
      request.requestId,
      request.workId,
      outcome.latencyMs,
    );
    store.ack(request.workId);
    await removeOutboxRecord(request.requestId);
    return outcome;
  }

  if (outcome.kind === "terminal") {
    requestFailEvent(
      request.requestId,
      request.workId,
      outcome.errorKey,
      record.attempt,
    );
    store.markFailed(request.workId, outcome.errorKey);
    await removeOutboxRecord(request.requestId);
    return outcome;
  }

  // Transient — stay in the outbox; the drain scheduler moves the
  // next-attempt timestamp forward.
  requestFailEvent(
    request.requestId,
    request.workId,
    outcome.reason,
    record.attempt,
  );
  return outcome;
}

// ---------- Outbox drain -----------------------------------------

/**
 * Replay every due outbox record. Called on AppBoot, on window
 * `online`, and from the reconcile path. Returns a tally so the
 * caller can log or assert in tests.
 */
export async function drainOutbox(
  now: Date = new Date(),
): Promise<{ sent: number; retried: number; gaveUp: number }> {
  const records = await listOutboxRecords();
  const due = records.filter((r) => r.nextAttemptAt <= now.toISOString());
  outboxDrainStartEvent(due.length);

  let sent = 0;
  let retried = 0;
  let gaveUp = 0;

  for (const record of due) {
    if (shouldGiveUp(record.attempt)) {
      // Past the ceiling — terminal. Flip store and pop the record.
      useVerification
        .getState()
        .markFailed(record.request.workId, "retries/exhausted");
      await removeOutboxRecord(record.request.requestId);
      outboxDrainStepEvent(
        record.request.requestId,
        "give-up",
        record.attempt,
      );
      gaveUp += 1;
      continue;
    }

    const outcome = await postAndResolve(record);
    if (outcome.kind === "ack") {
      sent += 1;
      outboxDrainStepEvent(
        record.request.requestId,
        "sent",
        record.attempt,
      );
      continue;
    }
    if (outcome.kind === "terminal") {
      // A 4xx is terminal and already popped in `postAndResolve`.
      outboxDrainStepEvent(
        record.request.requestId,
        "give-up",
        record.attempt,
      );
      gaveUp += 1;
      continue;
    }
    // Transient — bump attempt, schedule the next try.
    const nextAttempt = record.attempt + 1;
    const delayMs = nextDelayMs(nextAttempt, Math.random());
    const scheduled = new Date(Date.now() + delayMs).toISOString();
    const next: OutboxRecord = {
      request: record.request,
      attempt: nextAttempt,
      nextAttemptAt: scheduled,
      lastErrorReason: outcome.reason,
    };
    await updateOutboxRecord(next);
    outboxDrainStepEvent(
      record.request.requestId,
      "retry",
      nextAttempt,
    );
    retried += 1;
  }

  outboxDrainCompleteEvent(sent, retried, gaveUp);
  return { sent, retried, gaveUp };
}

// ---------- Classifiers ------------------------------------------

function classifyNetworkError(err: unknown): string {
  if (err instanceof TypeError) return "network/fetch";
  if (err instanceof Error) {
    if (err.name === "AbortError") return "network/abort";
    if (err.name === "TimeoutError") return "network/timeout";
  }
  return "network/unknown";
}

function classifyOutboxError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "QuotaExceededError") return "outbox/quota";
    if (err.name === "NotAllowedError") return "outbox/permission";
  }
  return "outbox/write";
}

async function extractErrorKey(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: unknown };
    if (typeof json.error === "string" && json.error.length > 0) {
      return json.error;
    }
  } catch {
    // fallthrough
  }
  return `http/${res.status}`;
}
