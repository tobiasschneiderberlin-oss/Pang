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
  ChapterShape,
} from "./types";
export { BEAT_KIND_ORDER } from "./types";

export { planChapter } from "./plan";

export {
  activeBeats,
  findBeatByKind,
  isReady,
  diffActiveBeats,
  ariaLineForActive,
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
} from "./otel";

export {
  ARTIFACT_LABELS,
  NULL_REFLECTION,
  CONTEXT_LABEL,
  ATTRIBUTION_LABEL,
  DISMISS_AFFORDANCE,
  SURFACE_LABEL,
  ARIA_ANNOUNCE,
} from "./voice";
