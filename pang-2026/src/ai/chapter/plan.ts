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
import type { Beat, ChapterArtifact, ChapterPlan, ChapterShape } from "./types";
import { ARTIFACT_LABELS } from "./voice";

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

/**
 * Project intake documents into `ChapterArtifact`s, capped at
 * `MAX_ARTIFACTS`. Field ordering is preserved from the model output;
 * we pick the first three fields so the card reads as a tag, not a
 * table.
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
    };
  });
}
