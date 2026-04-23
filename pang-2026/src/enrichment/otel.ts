/**
 * PANG — enrichment observability.
 *
 * The iteration #5 brief's failure-mode paragraph names four
 * regression classes — *poisoning*, *hallucination*, *drift*, and
 * *cost* — and asserts each is observable without "the timeline is
 * wrong" becoming an investigation. This module is where that
 * observability lives.
 *
 * Events are structured single-line JSON on `console.debug`, matching
 * the `chapter.*` / `verification.*` catalogues so the same future
 * collector ingests all three without translation. The route-handler
 * side also wraps the agent call in a `gen_ai.agent.enrichment`
 * OTel span (A10) via `withOtelSpan`.
 *
 * Event catalogue:
 *
 *   enrichment.submission.received    — endpoint accepted a submission
 *                                       (after schema + auth).
 *   enrichment.submission.rejected    — endpoint refused; `reason` is
 *                                       "auth" | "schema" | "hash-mismatch"
 *                                       | "duplicate-submission".
 *   enrichment.agent.start            — agent run began.
 *   enrichment.agent.complete         — agent run succeeded; cost +
 *                                       latency on the payload.
 *   enrichment.agent.fail             — agent run terminated; `reason`
 *                                       distinguishes retryable paths.
 *   enrichment.cache.hit              — read from cache served a work.
 *   enrichment.cache.miss             — read from cache missed; agent
 *                                       may dispatch depending on state.
 *   enrichment.cache.invalidate       — cache entry invalidated;
 *                                       `reason: "workHashChanged" | "manualRefresh"`.
 *   enrichment.reconcile              — boot-time stale-cache sweep;
 *                                       tallies mirror verification.
 */

export type EnrichmentEvent =
  | "enrichment.submission.received"
  | "enrichment.submission.rejected"
  | "enrichment.agent.start"
  | "enrichment.agent.complete"
  | "enrichment.agent.fail"
  | "enrichment.cache.hit"
  | "enrichment.cache.miss"
  | "enrichment.cache.invalidate"
  | "enrichment.reconcile";

export interface EnrichmentEventPayload {
  readonly event: EnrichmentEvent;
  readonly t: number;
  readonly attrs: Record<
    string,
    string | number | boolean | readonly string[]
  >;
}

function emit(payload: EnrichmentEventPayload): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(JSON.stringify(payload));
  }
}

// ---------- Submission edges --------------------------------------

export function submissionReceivedEvent(
  submissionId: string,
  workId: string,
  contributorRole: string,
  recordCount: number,
): void {
  emit({
    event: "enrichment.submission.received",
    t: Date.now(),
    attrs: {
      "pang.enrichment.submission_id": submissionId,
      "pang.enrichment.work_id": workId,
      "pang.enrichment.contributor_role": contributorRole,
      "pang.enrichment.record_count": recordCount,
    },
  });
}

export type SubmissionRejectReason =
  | "auth"
  | "schema"
  | "hash-mismatch"
  | "duplicate-submission"
  | "budget";

export function submissionRejectedEvent(
  submissionId: string | null,
  reason: SubmissionRejectReason,
  detail?: string,
): void {
  emit({
    event: "enrichment.submission.rejected",
    t: Date.now(),
    attrs: detail
      ? {
          "pang.enrichment.submission_id": submissionId ?? "<none>",
          "pang.enrichment.reject_reason": reason,
          "pang.enrichment.reject_detail": detail,
        }
      : {
          "pang.enrichment.submission_id": submissionId ?? "<none>",
          "pang.enrichment.reject_reason": reason,
        },
  });
}

// ---------- Agent lifecycle ---------------------------------------

export function agentStartEvent(
  submissionId: string,
  workId: string,
  recordCount: number,
): void {
  emit({
    event: "enrichment.agent.start",
    t: Date.now(),
    attrs: {
      "pang.enrichment.submission_id": submissionId,
      "pang.enrichment.work_id": workId,
      "pang.enrichment.record_count": recordCount,
    },
  });
}

export function agentCompleteEvent(
  submissionId: string,
  workId: string,
  latencyMs: number,
  timelineEntries: number,
): void {
  emit({
    event: "enrichment.agent.complete",
    t: Date.now(),
    attrs: {
      "pang.enrichment.submission_id": submissionId,
      "pang.enrichment.work_id": workId,
      "pang.enrichment.latency_ms": latencyMs,
      "pang.enrichment.timeline_entries": timelineEntries,
    },
  });
}

export type AgentFailReason =
  | "schema"
  | "tool-contract"
  | "voice-violation"
  | "trust-violation"
  | "budget"
  | "network"
  | "unknown";

export function agentFailEvent(
  submissionId: string,
  workId: string,
  reason: AgentFailReason,
  attempt: number,
): void {
  emit({
    event: "enrichment.agent.fail",
    t: Date.now(),
    attrs: {
      "pang.enrichment.submission_id": submissionId,
      "pang.enrichment.work_id": workId,
      "pang.enrichment.fail_reason": reason,
      "pang.enrichment.attempt": attempt,
    },
  });
}

// ---------- Cache -------------------------------------------------

export function cacheHitEvent(workId: string, basedOnWorkHash: string): void {
  emit({
    event: "enrichment.cache.hit",
    t: Date.now(),
    attrs: {
      "pang.enrichment.work_id": workId,
      "pang.enrichment.work_hash": basedOnWorkHash,
    },
  });
}

export function cacheMissEvent(workId: string): void {
  emit({
    event: "enrichment.cache.miss",
    t: Date.now(),
    attrs: {
      "pang.enrichment.work_id": workId,
    },
  });
}

export type CacheInvalidateReason = "workHashChanged" | "manualRefresh";

export function cacheInvalidateEvent(
  workId: string,
  reason: CacheInvalidateReason,
): void {
  emit({
    event: "enrichment.cache.invalidate",
    t: Date.now(),
    attrs: {
      "pang.enrichment.work_id": workId,
      "pang.enrichment.invalidate_reason": reason,
    },
  });
}

// ---------- Reconcile --------------------------------------------

export interface EnrichmentReconcileSummary {
  /** Cached entries whose basedOnWorkHash no longer matches. */
  readonly staleCacheEntries: number;
  /** Cached entries whose workId is no longer in the works store. */
  readonly orphanCacheEntries: number;
  /** Entries invalidated by this pass (sum of the above). */
  readonly invalidated: number;
}

export function reconcileEvent(summary: EnrichmentReconcileSummary): void {
  emit({
    event: "enrichment.reconcile",
    t: Date.now(),
    attrs: {
      "pang.enrichment.stale_cache": summary.staleCacheEntries,
      "pang.enrichment.orphan_cache": summary.orphanCacheEntries,
      "pang.enrichment.invalidated": summary.invalidated,
    },
  });
}
