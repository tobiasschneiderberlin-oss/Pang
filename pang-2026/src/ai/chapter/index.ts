/**
 * PANG — chapter module barrel.
 *
 * Consumers should import from this file rather than reaching into
 * the internal module layout. The surface is small by design:
 *
 *   - `planChapter`        — `IntakeOutput → ChapterPlan`
 *   - `activeBeats`        — `(plan, tMs) → ActiveBeat[]`
 *   - `findBeatByKind`     — single-beat lookup
 *   - `isReady`            — dismissable?
 *   - `diffActiveBeats`    — enter / exit id sets for telemetry
 *   - `ariaLineForActive`  — best single string for the live region
 *   - `beatEnvelope`       — per-beat opacity (for one-off queries)
 *   - `arrivalFactor`      — scene's work-hangs-itself factor
 *   - `overlayOpacity`     — captured-still overlay envelope
 *   - `chapter*Event`      — observability emitters
 *   - voice corpus         — `ARTIFACT_LABELS`, `NULL_REFLECTION`, etc.
 */

export type {
  ActiveBeat,
  Beat,
  BeatKind,
  BeatPayload,
  ChapterArtifact,
  ChapterPlan,
  ChapterPlanBase,
  ChapterShape,
  DocumentsChapterPlan,
  OutcomeChapterPlan,
} from "./types";
export { BEAT_KIND_ORDER } from "./types";

export {
  planChapter,
  planConfirmationChapter,
  planDeclineChapter,
  planDocumentsChapter,
} from "./plan";

export {
  activeBeats,
  findBeatByKind,
  isReady,
  diffActiveBeats,
  ariaLineForActive,
  persistentSlots,
  persistentArtifactSlots,
} from "./driver";

export {
  beatEnvelope,
  beatProgress,
  arrivalFactor,
  overlayOpacity,
} from "./envelope";

export {
  chapterPlanEvent,
  chapterBeatEnterEvent,
  chapterBeatExitEvent,
  chapterReadyEvent,
  chapterDismissEvent,
  chapterFallbackEvent,
  chapterOutcomePlanEvent,
  chapterOutcomeBeatEnterEvent,
  chapterOutcomeBeatExitEvent,
  chapterOutcomeReadyEvent,
  chapterOutcomeDismissEvent,
  chapterOutcomeSkippedEvent,
  chapterOutcomeFrameTimeEvent,
  summariseSamples,
  type OutcomeVariant,
  type OutcomeSkipReason,
  type FrameTimeSummary,
} from "./otel";

export {
  ARTIFACT_LABELS,
  NULL_REFLECTION,
  CONTEXT_LABEL,
  ATTRIBUTION_LABEL,
  DISMISS_AFFORDANCE,
  SURFACE_LABEL,
  ARIA_ANNOUNCE,
  OUTCOME_NARRATION,
  OUTCOME_SURFACE_LABEL,
  DOCUMENTS_CONTEXT_LINE,
  DOCUMENTS_VIEWER,
  DOCUMENTS_LABEL,
  DOCUMENT_VIEWER_LABEL,
  DEEP_ZOOM_LABEL,
  DEEP_ZOOM_CLOSE,
  ARRIVAL_IMAGE_ALT,
  BULLET_SEPARATOR,
} from "./voice";
