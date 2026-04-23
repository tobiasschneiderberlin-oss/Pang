/**
 * PANG — documents observability.
 *
 * Iteration #6's failure-mode declaration names four regression
 * classes that have to be observable when the documents-as-evidence
 * surface breaks:
 *
 *   1. Jank under staggered reveal (frame time p75 ≤ 16.67 ms).
 *   2. Source-attribution confusion (intake vs gallery vs ai).
 *   3. Missing document bytes (OPFS eviction).
 *   4. Viewer-as-escape-hatch (back gesture lands off-scene).
 *
 * This module is where those signals get names. Each event is a
 * single-line JSON blob on `console.debug` — same shape as
 * `src/ai/chapter/otel.ts`, `src/verification/otel.ts`, and
 * `src/enrichment/otel.ts`, so the future collector ingests all of
 * them through one sink without translation.
 *
 * Event catalogue:
 *
 *   documents.chapter.start       — chapter mounted; carries work_id
 *                                   + artifact_count + total_ms.
 *   documents.chapter.complete    — chapter reached `ready` once.
 *   documents.chapter.abort       — chapter unmounted before `ready`
 *                                   (focus change, viewer open with
 *                                   back-to-wall, navigation).
 *   documents.viewer.open         — overlay opened on an artifact.
 *   documents.viewer.close        — overlay closed (pointer, key, dismiss).
 *   documents.viewer.zoom_depth   — max zoom depth reached (coarse
 *                                   signal for "did she paint in?").
 *   documents.bytes.miss          — OPFS read returned null for a
 *                                   referenced fileRef.
 *   enrichment.panel.render       — panel's state flipped to ready
 *                                   for the first time on a work
 *                                   (ties iteration #5's data to
 *                                   iteration #6's surface).
 */

export type DocumentsEvent =
  | "documents.chapter.start"
  | "documents.chapter.complete"
  | "documents.chapter.abort"
  | "documents.viewer.open"
  | "documents.viewer.close"
  | "documents.viewer.zoom_depth"
  | "documents.bytes.miss"
  | "enrichment.panel.render";

export interface DocumentsEventPayload {
  readonly event: DocumentsEvent;
  /** Wall-clock ms since epoch. */
  readonly t: number;
  readonly attrs: Record<
    string,
    string | number | boolean | readonly string[]
  >;
}

function emit(payload: DocumentsEventPayload): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(JSON.stringify(payload));
  }
}

export function documentsChapterStartEvent(
  workId: string,
  artifactCount: number,
  totalMs: number,
): void {
  emit({
    event: "documents.chapter.start",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.artifact_count": artifactCount,
      "pang.documents.total_ms": totalMs,
    },
  });
}

export function documentsChapterCompleteEvent(
  workId: string,
  artifactCount: number,
  tChapterMs: number,
): void {
  emit({
    event: "documents.chapter.complete",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.artifact_count": artifactCount,
      "pang.documents.t_chapter_ms": tChapterMs,
    },
  });
}

export function documentsChapterAbortEvent(
  workId: string,
  tChapterMs: number,
  reason: "focus_change" | "viewer_opened_pre_ready" | "unmount",
): void {
  emit({
    event: "documents.chapter.abort",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.t_chapter_ms": tChapterMs,
      "pang.documents.abort_reason": reason,
    },
  });
}

export function documentsViewerOpenEvent(
  workId: string,
  fileRef: string,
  kind: "coa" | "invoice" | "condition_report",
): void {
  emit({
    event: "documents.viewer.open",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.file_ref": fileRef,
      "pang.documents.kind": kind,
    },
  });
}

export function documentsViewerCloseEvent(
  workId: string,
  fileRef: string,
  via: "pointer" | "keyboard" | "focus_change",
): void {
  emit({
    event: "documents.viewer.close",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.file_ref": fileRef,
      "pang.documents.close_via": via,
    },
  });
}

/**
 * Coarse zoom-depth signal. `level` is a log bucket — 1 = fit-to-
 * viewport, 2 = doubled, 3 = 4×, etc. — so the telemetry counts
 * "did she zoom to signature" without flooding on every pinch tick.
 */
export function documentsViewerZoomDepthEvent(
  workId: string,
  fileRef: string,
  level: number,
): void {
  emit({
    event: "documents.viewer.zoom_depth",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.file_ref": fileRef,
      "pang.documents.zoom_level": level,
    },
  });
}

export function documentsBytesMissEvent(
  workId: string,
  fileRef: string,
): void {
  emit({
    event: "documents.bytes.miss",
    t: Date.now(),
    attrs: {
      "pang.documents.work_id": workId,
      "pang.documents.file_ref": fileRef,
    },
  });
}

export function enrichmentPanelRenderEvent(
  workId: string,
  timelineCount: number,
  hasBio: boolean,
): void {
  emit({
    event: "enrichment.panel.render",
    t: Date.now(),
    attrs: {
      "pang.enrichment.work_id": workId,
      "pang.enrichment.timeline_count": timelineCount,
      "pang.enrichment.has_bio": hasBio,
    },
  });
}
