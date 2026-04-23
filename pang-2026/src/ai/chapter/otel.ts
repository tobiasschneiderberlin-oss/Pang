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
