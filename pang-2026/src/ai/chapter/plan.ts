/**
 * PANG — chapter planner.
 *
 * Turns an `IntakeOutput` + the newly-added work's id + its captured-
 * still blob URL into a `ChapterPlan`. Pure function: same input, same
 * plan — so the driver and the UI can both `useState(() =>
 * planChapter(...))` without fear of drift.
 *
 * Timing philosophy:
 *
 * The chapter must be satisfying for every shape of work. The full
 * state (artifacts + gallery + context) runs about 42 seconds; the
 * null state (no artifacts, no gallery, no bio) runs about 30 seconds.
 * The spine brief (iteration #3) fixed the 30–45s budget; the planner
 * keeps both ends of it achievable by stretching the pauses in the
 * null branch rather than manufacturing content.
 *
 * Beats may overlap. The narration rides on top of the approach + place
 * beats (the voice calls out the work as the wall settles it into
 * view). Artifacts arrive one after another, each with its own
 * envelope. The settle beat holds silence before the dismiss
 * affordance appears.
 *
 * Observability: the plan's `shape` summarises which branches were
 * taken. `chapter.plan` logs shape once per chapter; every beat enter/
 * exit is logged by the driver.
 */

import type { IntakeOutput } from "@/ai/tools/artwork";
import type { DocumentRecord } from "@/stores/works";
import type {
  Beat,
  ChapterArtifact,
  ChapterPlan,
  ChapterShape,
  DocumentsChapterPlan,
  OutcomeChapterPlan,
} from "./types";
import {
  ARTIFACT_LABELS,
  DOCUMENTS_CONTEXT_LINE,
  OUTCOME_NARRATION,
} from "./voice";

// ---- Timing table (ms) -------------------------------------------
//
// Named constants so the iteration log can quote them and future
// tuning shows up as a single diff. The ceiling-case composition is
// approximately:
//
//   approach        [   0, 3000)
//   narration       [2000, 7000)          (ai arrivalLine)
//   place           [2800, 5800)          (work hangs itself)
//   pause           [7000, 9000)          (the wall holds)
//   artifact[0]     [9000, 13000)
//   artifact[1]     [13000, 17000)
//   artifact[2]     [17000, 21000)        (max 3 — the spine is the work, not paperwork)
//   attribution     [cursor, cursor+5000) (only if galleryName present)
//   context         [cursor, cursor+7000) (only if bioMuji present)
//   settle          [cursor, cursor+5000)
//   ready           [cursor, ∞)
//
// The null branch replaces the three-artifact slot + attribution +
// context with a null-reflection (12_000ms) and a second pause
// (5000ms) so the total lands at ~31s — inside the 30–45s band.

const APPROACH_MS = 3000;
const NARRATION_MS = 5000;
const NARRATION_DELAY_MS = 2000; // narration starts 2s into approach
const PLACE_DELAY_MS = 2800;
const PLACE_MS = 3000;
const PAUSE_MS = 2000;
const ARTIFACT_MS = 4000;
const MAX_ARTIFACTS = 3;
const ATTRIBUTION_MS = 5000;
const CONTEXT_MS = 7000;
// The null branch has no artifact procession to carry the middle —
// the reflection + pause must fill the same ~18s slot for the total to
// land at or above the 30s floor. Longer than a single-artifact beat
// is intentional: the null state is a *wall text*, not a placeholder.
const NULL_REFLECTION_MS = 12_000;
const NULL_PAUSE_MS = 5000;
const SETTLE_MS = 5000;

// Envelope shape knobs. Held constant across beat kinds so the whole
// chapter reads as one hand — not ten hands with their own curves.
const STANDARD_FADE_IN_MS = 900;
const STANDARD_FADE_OUT_MS = 1200;
// Narration holds longer so the line reads through its full window.
const NARRATION_FADE_OUT_MS = 2000;

/** Plan the arrival chapter. Pure. Safe to call in `useState(() => ...)`. */
export function planChapter(
  output: IntakeOutput,
  workId: string,
  workImageUrl: string,
): ChapterPlan {
  const beats: Beat[] = [];

  // ---- Opening: approach + place + narration ---------------------
  beats.push({
    id: "approach",
    kind: "approach",
    startMs: 0,
    durationMs: APPROACH_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
    payload: { kind: "camera" },
  });

  // Narration comes before `place` in the beat list even though both
  // overlap — ordering in the array is chronological-by-startMs (the
  // driver is order-agnostic but the tests + the iteration-log
  // inspector both read the list top-to-bottom as a timeline).
  beats.push({
    id: "narration",
    kind: "narration",
    startMs: NARRATION_DELAY_MS,
    durationMs: NARRATION_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: NARRATION_FADE_OUT_MS,
    payload: { kind: "text", text: output.arrivalLine, source: "ai" },
  });

  beats.push({
    id: "place",
    kind: "place",
    startMs: PLACE_DELAY_MS,
    durationMs: PLACE_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
    payload: { kind: "pose" },
  });

  // Pause — silence between opening and procession.
  const pauseStart = NARRATION_DELAY_MS + NARRATION_MS; // 7000
  beats.push({
    id: "pause",
    kind: "pause",
    startMs: pauseStart,
    durationMs: PAUSE_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
  });

  let cursor = pauseStart + PAUSE_MS; // 9000

  // ---- Artifact procession ---------------------------------------
  const artifacts = pickArtifacts(output);
  for (let i = 0; i < artifacts.length; i++) {
    beats.push({
      id: `artifact/${i}`,
      kind: "artifact",
      startMs: cursor,
      durationMs: ARTIFACT_MS,
      fadeInMs: STANDARD_FADE_IN_MS,
      fadeOutMs: STANDARD_FADE_OUT_MS,
      payload: { kind: "artifact", artifact: artifacts[i]! },
    });
    cursor += ARTIFACT_MS;
  }

  // ---- Attribution + context -------------------------------------
  const hasAttribution = Boolean(output.galleryOfOrigin.galleryName);
  if (hasAttribution) {
    beats.push({
      id: "attribution",
      kind: "attribution",
      startMs: cursor,
      durationMs: ATTRIBUTION_MS,
      fadeInMs: STANDARD_FADE_IN_MS,
      fadeOutMs: STANDARD_FADE_OUT_MS,
      payload: {
        kind: "attribution",
        galleryName: output.galleryOfOrigin.galleryName!,
      },
    });
    cursor += ATTRIBUTION_MS;
  }

  const hasContext = Boolean(output.artistContext.bioMuji);
  if (hasContext) {
    beats.push({
      id: "context",
      kind: "context",
      startMs: cursor,
      durationMs: CONTEXT_MS,
      fadeInMs: STANDARD_FADE_IN_MS,
      fadeOutMs: STANDARD_FADE_OUT_MS,
      payload: {
        kind: "context",
        label: "About the artist.",
        body: output.artistContext.bioMuji!,
      },
    });
    cursor += CONTEXT_MS;
  }

  // ---- Null-state reflection -------------------------------------
  // Only kicks in if the chapter has no middle content at all (no
  // artifacts, no attribution, no context). A second pause follows to
  // lengthen the silence — the null state is allowed to breathe.
  const hasMiddle =
    artifacts.length > 0 || hasAttribution || hasContext;
  const hasNullReflection = !hasMiddle;
  if (hasNullReflection) {
    beats.push({
      id: "null-reflection",
      kind: "null-reflection",
      startMs: cursor,
      durationMs: NULL_REFLECTION_MS,
      fadeInMs: STANDARD_FADE_IN_MS,
      fadeOutMs: NARRATION_FADE_OUT_MS,
      // The payload is the *composed* reflection — the UI may also
      // read `NULL_REFLECTION` directly to split into two visual
      // lines. The text here is the ARIA-readable collapse.
      payload: {
        kind: "text",
        text: "The wall holds the work. The gallery has not yet answered.",
        source: "voice-corpus",
      },
    });
    cursor += NULL_REFLECTION_MS;
    beats.push({
      id: "pause/null",
      kind: "pause",
      startMs: cursor,
      durationMs: NULL_PAUSE_MS,
      fadeInMs: STANDARD_FADE_IN_MS,
      fadeOutMs: STANDARD_FADE_OUT_MS,
    });
    cursor += NULL_PAUSE_MS;
  }

  // ---- Settle + ready --------------------------------------------
  beats.push({
    id: "settle",
    kind: "settle",
    startMs: cursor,
    durationMs: SETTLE_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
  });
  cursor += SETTLE_MS;

  // The ready beat has a nominal short fade-in and an unbounded
  // duration (we represent "unbounded" as a very large number — the
  // driver clamps to the plan total for envelope purposes).
  beats.push({
    id: "ready",
    kind: "ready",
    startMs: cursor,
    durationMs: Number.MAX_SAFE_INTEGER - cursor,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: 0,
  });

  const totalMs = cursor;

  const shape: ChapterShape = {
    beatCount: beats.length,
    hasArtifacts: artifacts.length > 0,
    artifactCount: artifacts.length,
    hasAttribution,
    hasContext,
    hasNullReflection,
  };

  return {
    variant: "arrival",
    beats,
    totalMs,
    readyAtMs: totalMs,
    workId,
    workImageUrl,
    arrivalLine: output.arrivalLine,
    sourceOutput: output,
    shape,
  };
}

// ---- Outcome timing table (ms) -----------------------------------
//
// Outcome chapters are short. The work is already on the wall — the
// chapter is a museum-caption acknowledgement, not a procession. The
// full outcome runs ~14s:
//
//   approach/outcome  [   0, 2200)    camera breath toward the work
//   narration         [ 1500, 7000)   voice-corpus confirm or decline line
//   place/outcome     [ 2500, 5500)   emissive rise (confirm only; decline is a no-op)
//   pause             [ 7000, 9000)   silence
//   settle            [ 9000, 14000)  camera breath
//   ready             [14000, ∞)
//
// The decline variant omits the `place` beat — the work does not
// change state, so there is no pose change to ride.

const OUTCOME_APPROACH_MS = 2200;
const OUTCOME_NARRATION_MS = 5500;
const OUTCOME_NARRATION_DELAY_MS = 1500;
const OUTCOME_PLACE_DELAY_MS = 2500;
const OUTCOME_PLACE_MS = 3000;
const OUTCOME_PAUSE_MS = 2000;
const OUTCOME_SETTLE_MS = 5000;

/**
 * Plan the *confirmation* chapter — the wall acknowledgement played
 * when the gallery confirms a verification request. The work's
 * emissive is expected to rise 0 → 1 over the `confirmation` beat
 * (driver: `arrivalFactor(findBeatByKind(plan, "confirmation"), tMs)`),
 * and `setWorkVerified(id, true)` is called at the tick the chapter
 * reaches `settle`, pinning the rest state.
 */
export function planConfirmationChapter(
  workId: string,
  decidedAt: string,
): OutcomeChapterPlan {
  return planOutcomeChapter("confirmation", workId, decidedAt);
}

/**
 * Plan the *decline* chapter — the wall acknowledgement played when
 * the gallery does not confirm. The work stays dormant; there is no
 * pose change. The narration is the observational fact ("the gallery
 * did not confirm this work"), not an apology.
 */
export function planDeclineChapter(
  workId: string,
  decidedAt: string,
): OutcomeChapterPlan {
  return planOutcomeChapter("decline", workId, decidedAt);
}

/** Shared planner body for the two outcome variants. Pure. */
function planOutcomeChapter(
  variant: "confirmation" | "decline",
  workId: string,
  decidedAt: string,
): OutcomeChapterPlan {
  const beats: Beat[] = [];

  beats.push({
    id: "approach",
    kind: "approach",
    startMs: 0,
    durationMs: OUTCOME_APPROACH_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
    payload: { kind: "camera" },
  });

  // The outcome narration beat carries the voice-corpus line. The
  // beat's `kind` is the variant itself — "confirmation" or
  // "decline" — so consumers that want to key on the outcome don't
  // need a second lookup.
  const narrationLine = OUTCOME_NARRATION[variant];
  beats.push({
    id: "narration",
    kind: variant,
    startMs: OUTCOME_NARRATION_DELAY_MS,
    durationMs: OUTCOME_NARRATION_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: NARRATION_FADE_OUT_MS,
    payload: {
      kind: "text",
      text: narrationLine,
      source: "voice-corpus",
    },
  });

  // Confirmation has a `place`-equivalent beat so the arrival-factor
  // helper (reused across chapters) can drive the GL emissive rise.
  // Decline omits it — the work stays dormant.
  if (variant === "confirmation") {
    beats.push({
      id: "place",
      kind: "place",
      startMs: OUTCOME_PLACE_DELAY_MS,
      durationMs: OUTCOME_PLACE_MS,
      fadeInMs: STANDARD_FADE_IN_MS,
      fadeOutMs: STANDARD_FADE_OUT_MS,
      payload: { kind: "pose" },
    });
  }

  // Pause — lets the narration fade.
  const pauseStart = OUTCOME_NARRATION_DELAY_MS + OUTCOME_NARRATION_MS;
  beats.push({
    id: "pause",
    kind: "pause",
    startMs: pauseStart,
    durationMs: OUTCOME_PAUSE_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
  });

  let cursor = pauseStart + OUTCOME_PAUSE_MS;

  beats.push({
    id: "settle",
    kind: "settle",
    startMs: cursor,
    durationMs: OUTCOME_SETTLE_MS,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: STANDARD_FADE_OUT_MS,
  });
  cursor += OUTCOME_SETTLE_MS;

  beats.push({
    id: "ready",
    kind: "ready",
    startMs: cursor,
    durationMs: Number.MAX_SAFE_INTEGER - cursor,
    fadeInMs: STANDARD_FADE_IN_MS,
    fadeOutMs: 0,
  });

  const totalMs = cursor;

  const shape: ChapterShape = {
    beatCount: beats.length,
    hasArtifacts: false,
    artifactCount: 0,
    hasAttribution: false,
    hasContext: false,
    hasNullReflection: false,
  };

  return {
    variant,
    beats,
    totalMs,
    readyAtMs: totalMs,
    workId,
    narrationLine,
    decidedAt,
    shape,
  };
}

/**
 * Project intake documents into `ChapterArtifact`s, capped at
 * `MAX_ARTIFACTS`. Field ordering is preserved from the model output;
 * we pick the first three fields so the card reads as a tag, not a
 * table.
 *
 * `fileRef`/`mime` are null here — arrival-chapter artifacts are the
 * field-only preview (the scan isn't clickable yet; the documents
 * chapter iteration #6 ships the tap-to-view surface). The type
 * narrows consumers; the null clarifies the contract.
 */
function pickArtifacts(output: IntakeOutput): readonly ChapterArtifact[] {
  const docs = output.documents.slice(0, MAX_ARTIFACTS);
  return docs.map((doc, index) => {
    const entries = Object.entries(doc.extractedFields).slice(0, 3);
    return {
      id: `${doc.type}/${index}`,
      kind: doc.type,
      label: ARTIFACT_LABELS[doc.type],
      fields: entries.map(([k, v]) => [k, v] as const),
      fileRef: null,
      mime: null,
    };
  });
}

// ---- Documents-chapter timing table (ms) -------------------------
//
// Iteration #6 extends the chapter primitive to evidence. Timings
// chosen so totalMs lands in the brief's [6000, 12000] band across
// document counts n ∈ [1, 8]:
//
//   settle        [0, 600)                   opening breath
//   artifact/i    [600 + i·800, ... +3000)   staggered reveal
//   context       [after last artifact, +2500)   closing line
//   ready         [..., ∞)                   terminal
//
// For n=1: totalMs ≈ 6100 ms (floor).
// For n=8: totalMs ≈ 11700 ms (just under ceiling).
//
// The stagger (800 ms) plus the per-artifact duration (3000 ms)
// keeps the procession legible on low-end devices — a card has
// ~800 ms alone on stage before the next arrives, then overlaps in
// hold. Fade-in/out mirror the arrival chapter's rate-6 curve.

const DOC_SETTLE_MS = 600;
const DOC_ARTIFACT_STAGGER_MS = 800;
const DOC_ARTIFACT_DURATION_MS = 3000;
const DOC_CONTEXT_MS = 2500;
const DOC_FADE_IN_MS = 600;
const DOC_FADE_OUT_MS = 900;
const MAX_DOCUMENT_ARTIFACTS = 8;

/**
 * Plan the *documents* chapter — the staggered-reveal procession
 * played when Laura focuses a work with attached documents. Pure.
 * Same `(documents, workId, focusedAt)` input produces byte-identical
 * output across calls — safe for `useState(() => planDocumentsChapter(...))`.
 *
 * A work with no documents is still a legal input: the plan has
 * `settle → context → ready` (no artifact beats) and `totalMs` sits
 * on the floor. The renderer (`DocumentsChapter.tsx`) short-circuits
 * on an empty artifact list and renders nothing — the plan's
 * null-safety keeps the consumer branch-free.
 */
export function planDocumentsChapter(
  documents: readonly DocumentRecord[],
  workId: string,
  focusedAt: string,
): DocumentsChapterPlan {
  const beats: Beat[] = [];

  // --- Settle: opening breath -------------------------------------
  beats.push({
    id: "settle/open",
    kind: "settle",
    startMs: 0,
    durationMs: DOC_SETTLE_MS,
    fadeInMs: DOC_FADE_IN_MS,
    fadeOutMs: DOC_FADE_OUT_MS,
  });

  // --- Artifacts: staggered reveal --------------------------------
  const capped = documents.slice(0, MAX_DOCUMENT_ARTIFACTS);
  const artifacts: ChapterArtifact[] = capped.map((doc, index) => ({
    id: `${doc.type}/${index}`,
    kind: doc.type,
    label: ARTIFACT_LABELS[doc.type],
    fields: Object.entries(doc.extractedFields)
      .slice(0, 3)
      .map(([k, v]) => [k, v] as const),
    fileRef: doc.fileRef,
    mime: doc.mime,
  }));

  let lastArtifactEndMs = DOC_SETTLE_MS;
  artifacts.forEach((artifact, index) => {
    const startMs = DOC_SETTLE_MS + index * DOC_ARTIFACT_STAGGER_MS;
    beats.push({
      id: `artifact/${index}`,
      kind: "artifact",
      startMs,
      durationMs: DOC_ARTIFACT_DURATION_MS,
      fadeInMs: DOC_FADE_IN_MS,
      fadeOutMs: DOC_FADE_OUT_MS,
      payload: { kind: "artifact", artifact },
    });
    lastArtifactEndMs = startMs + DOC_ARTIFACT_DURATION_MS;
  });

  // --- Context: closing voice-corpus line -------------------------
  const contextStartMs = lastArtifactEndMs;
  beats.push({
    id: "context",
    kind: "context",
    startMs: contextStartMs,
    durationMs: DOC_CONTEXT_MS,
    fadeInMs: DOC_FADE_IN_MS,
    fadeOutMs: DOC_FADE_OUT_MS,
    payload: {
      kind: "context",
      label: "Documents.",
      body: DOCUMENTS_CONTEXT_LINE,
    },
  });
  const contextEndMs = contextStartMs + DOC_CONTEXT_MS;

  // --- Ready: terminal --------------------------------------------
  beats.push({
    id: "ready",
    kind: "ready",
    startMs: contextEndMs,
    durationMs: Number.MAX_SAFE_INTEGER - contextEndMs,
    fadeInMs: DOC_FADE_IN_MS,
    fadeOutMs: 0,
  });

  const totalMs = contextEndMs;

  const shape: ChapterShape = {
    beatCount: beats.length,
    hasArtifacts: artifacts.length > 0,
    artifactCount: artifacts.length,
    hasAttribution: false,
    hasContext: true,
    hasNullReflection: false,
  };

  return {
    variant: "documents",
    beats,
    totalMs,
    readyAtMs: totalMs,
    workId,
    shape,
    artifacts,
    contextLine: DOCUMENTS_CONTEXT_LINE,
    focusedAt,
  };
}
