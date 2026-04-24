/**
 * PANG — chapter observability.
 *
 * The arrival chapter is a timed choreography: a regression surfaces
 * as "the wrong beat at the wrong time" or "a beat that never fired."
 * The failure-mode declaration in iteration #3's brief requires that
 * when the chapter breaks, the break is *nameable* — not just "the
 * arrival felt off."
 *
 * This module emits structured events at the boundaries of the
 * chapter's lifecycle. Each event is a single-line JSON blob prefixed
 * `chapter.*`, matching the shape of the server-side spans emitted by
 * `src/lib/otel/span.ts`. A future client-side collector (iteration #5
 * observability) ingests these alongside server spans without
 * translation.
 *
 * Why a separate module instead of reusing `withOtelSpan`: chapter
 * beats overlap and are long-lived (up to 7s). Wrapping each in a
 * promise-style span would force the driver to manage N concurrent
 * promise lifetimes. A beat's events are *instants* (enter / exit),
 * not spans; logging them directly matches the conceptual model.
 *
 * Event catalogue:
 *
 *   chapter.plan           — one per mount. Attrs: shape summary.
 *   chapter.beat.enter     — beat entered the active set.
 *   chapter.beat.exit      — beat left the active set (or ready hit).
 *   chapter.ready          — chapter reached the dismissable state.
 *   chapter.dismiss        — Laura acted on the affordance.
 *   chapter.fallback       — a capability fell back (e.g. no View
 *                            Transitions → direct render).
 */

import type { ChapterShape } from "./types";

/** Shape of every `chapter.*` event payload. Mirrors the span shim. */
export interface ChapterEventPayload {
  readonly event: `chapter.${string}`;
  /** Wall-clock ms since epoch. */
  readonly t: number;
  /** Chapter-local ms since start (zero for `chapter.plan`). */
  readonly tChapterMs?: number;
  readonly attrs: Record<string, string | number | boolean | readonly string[]>;
}

/**
 * Primitive emitter. Single-line JSON to `console.debug` so the browser
 * devtools preserve it and a future collector can ingest via a sink.
 * Guarded for non-console environments (Node test runner has
 * `console.debug` but not in every mode).
 */
function emit(payload: ChapterEventPayload): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(JSON.stringify(payload));
  }
}

/** One-shot event at chapter mount. Names the shape of the plan. */
export function chapterPlanEvent(workId: string, shape: ChapterShape, totalMs: number): void {
  emit({
    event: "chapter.plan",
    t: Date.now(),
    tChapterMs: 0,
    attrs: {
      "pang.chapter.work_id": workId,
      "pang.chapter.total_ms": totalMs,
      "pang.chapter.beat_count": shape.beatCount,
      "pang.chapter.artifact_count": shape.artifactCount,
      "pang.chapter.has_artifacts": shape.hasArtifacts,
      "pang.chapter.has_attribution": shape.hasAttribution,
      "pang.chapter.has_context": shape.hasContext,
      "pang.chapter.has_null_reflection": shape.hasNullReflection,
    },
  });
}

/** Beat just became active. */
export function chapterBeatEnterEvent(
  beatId: string,
  kind: string,
  tChapterMs: number,
): void {
  emit({
    event: "chapter.beat.enter",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.beat_id": beatId,
      "pang.chapter.beat_kind": kind,
    },
  });
}

/** Beat just left the active set. */
export function chapterBeatExitEvent(
  beatId: string,
  kind: string,
  tChapterMs: number,
): void {
  emit({
    event: "chapter.beat.exit",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.beat_id": beatId,
      "pang.chapter.beat_kind": kind,
    },
  });
}

/** Chapter reached its dismissable state. */
export function chapterReadyEvent(tChapterMs: number): void {
  emit({
    event: "chapter.ready",
    t: Date.now(),
    tChapterMs,
    attrs: {},
  });
}

/** Laura acted on the dismiss affordance. */
export function chapterDismissEvent(
  tChapterMs: number,
  via: "pointer" | "keyboard",
): void {
  emit({
    event: "chapter.dismiss",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.dismiss_via": via,
    },
  });
}

/**
 * A capability fallback fired — e.g. View Transitions not supported
 * and the chapter rendered the direct path. Named so diagnostic work
 * doesn't start with "was it the cross-doc transition?"
 */
export function chapterFallbackEvent(
  tChapterMs: number,
  which: string,
  detail?: string,
): void {
  emit({
    event: "chapter.fallback",
    t: Date.now(),
    tChapterMs,
    attrs: detail
      ? {
          "pang.chapter.fallback": which,
          "pang.chapter.fallback_detail": detail,
        }
      : {
          "pang.chapter.fallback": which,
        },
  });
}

// ---------- Outcome chapter events (iter #11) --------------------
//
// The outcome chapter is a sibling of the arrival chapter, not an
// overload: it plays on a confirmed / declined verification, carries
// a variant dimension, and is gated by the active surface. Its events
// share the `chapter.outcome.*` prefix so arrival telemetry stays
// distinct in the collector's view and in the server aggregator.
//
// Every outcome span carries:
//   pang.chapter.variant      "confirmation" | "decline"
//   pang.chapter.work_id      string
//   pang.chapter.decided_at   ISO-8601
//
// The lifecycle mirrors arrival: plan → beat.enter / beat.exit pairs
// → ready → dismiss. Two extras:
//
//   chapter.outcome.skipped         — the trigger fired but the
//                                     chapter did not mount. The
//                                     `reason` attr discriminates.
//   chapter.outcome.frame_time_ms   — histogram summary of RAF deltas
//                                     over the full chapter run. The
//                                     failure-mode declaration's
//                                     "p95 widened before Laura
//                                     complained" signal.

export type OutcomeVariant = "confirmation" | "decline";

/** Reasons a queued outcome chapter decides not to mount. */
export type OutcomeSkipReason =
  /** The entry already has an `outcomeChapterShownAt` timestamp. */
  | "already-shown"
  /** The active surface is not the Room when the transition fires. */
  | "surface-not-room";

/** One-shot event at outcome-chapter mount — names the planned shape. */
export function chapterOutcomePlanEvent(
  variant: OutcomeVariant,
  workId: string,
  decidedAt: string,
  totalMs: number,
  beatCount: number,
): void {
  emit({
    event: "chapter.outcome.plan",
    t: Date.now(),
    tChapterMs: 0,
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
      "pang.chapter.decided_at": decidedAt,
      "pang.chapter.total_ms": totalMs,
      "pang.chapter.beat_count": beatCount,
    },
  });
}

/** Outcome beat became active. */
export function chapterOutcomeBeatEnterEvent(
  variant: OutcomeVariant,
  workId: string,
  beatId: string,
  kind: string,
  tChapterMs: number,
): void {
  emit({
    event: "chapter.outcome.beat_enter",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
      "pang.chapter.beat_id": beatId,
      "pang.chapter.beat_kind": kind,
    },
  });
}

/** Outcome beat left the active set. */
export function chapterOutcomeBeatExitEvent(
  variant: OutcomeVariant,
  workId: string,
  beatId: string,
  kind: string,
  tChapterMs: number,
): void {
  emit({
    event: "chapter.outcome.beat_exit",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
      "pang.chapter.beat_id": beatId,
      "pang.chapter.beat_kind": kind,
    },
  });
}

/** Outcome chapter reached its dismissable state — latches shown-at. */
export function chapterOutcomeReadyEvent(
  variant: OutcomeVariant,
  workId: string,
  tChapterMs: number,
): void {
  emit({
    event: "chapter.outcome.ready",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
    },
  });
}

/** Laura acted on the outcome chapter's dismiss affordance. */
export function chapterOutcomeDismissEvent(
  variant: OutcomeVariant,
  workId: string,
  tChapterMs: number,
  via: "pointer" | "keyboard",
): void {
  emit({
    event: "chapter.outcome.dismiss",
    t: Date.now(),
    tChapterMs,
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
      "pang.chapter.dismiss_via": via,
    },
  });
}

/** The queued outcome chapter did not mount. Reason names the branch. */
export function chapterOutcomeSkippedEvent(
  variant: OutcomeVariant,
  workId: string,
  reason: OutcomeSkipReason,
): void {
  emit({
    event: "chapter.outcome.skipped",
    t: Date.now(),
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
      "pang.chapter.skip_reason": reason,
    },
  });
}

/**
 * Frame-time histogram summary, emitted once per chapter run on
 * dismiss. Derived from the RAF delta samples. A widened `p95` / `p99`
 * tail is the pre-Laura signal that the chapter's DOM updates are
 * colliding with WebGPU holds.
 *
 * The caller is responsible for sample collection; this emitter is a
 * pure data sink. `count` is the number of RAF ticks sampled; a run
 * with fewer than 2 samples is silently ignored (the chapter
 * dismissed before a meaningful sample could accrue — measuring it
 * would mislead).
 */
export function chapterOutcomeFrameTimeEvent(
  variant: OutcomeVariant,
  workId: string,
  samples: readonly number[],
): void {
  if (samples.length < 2) return;
  const { p50, p95, p99, mean, max } = summariseSamples(samples);
  emit({
    event: "chapter.outcome.frame_time_ms",
    t: Date.now(),
    attrs: {
      "pang.chapter.variant": variant,
      "pang.chapter.work_id": workId,
      "pang.chapter.frame_count": samples.length,
      "pang.chapter.frame_p50_ms": p50,
      "pang.chapter.frame_p95_ms": p95,
      "pang.chapter.frame_p99_ms": p99,
      "pang.chapter.frame_mean_ms": mean,
      "pang.chapter.frame_max_ms": max,
    },
  });
}

/**
 * Deterministic percentile summary. Exported for unit tests; the
 * emitter above is the normal callsite. Rounds to one decimal place
 * so the OTel attributes stay compact.
 */
export interface FrameTimeSummary {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly mean: number;
  readonly max: number;
}

export function summariseSamples(samples: readonly number[]): FrameTimeSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  const pickPercentile = (p: number): number => {
    // Nearest-rank, clamped into the array. Simple, defensible, and
    // matches the chrome devtools convention (rather than linear
    // interpolation) for small-n samples typical of a 14 s chapter.
    const rank = Math.ceil((p / 100) * sorted.length) - 1;
    const clamped = Math.max(0, Math.min(sorted.length - 1, rank));
    return roundDecimal(sorted[clamped]!, 1);
  };
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    p50: pickPercentile(50),
    p95: pickPercentile(95),
    p99: pickPercentile(99),
    mean: roundDecimal(sum / samples.length, 1),
    max: roundDecimal(sorted[sorted.length - 1]!, 1),
  };
}

function roundDecimal(value: number, decimals: number): number {
  const k = 10 ** decimals;
  return Math.round(value * k) / k;
}
