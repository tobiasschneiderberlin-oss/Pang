/**
 * PANG — chapter types.
 *
 * A "chapter" is the timed narrative PANG plays when a freshly-added
 * work arrives on the wall. The model is a sequence of *beats* — named,
 * overlapping time windows that each own one visible gesture: the
 * camera approaches, the work hangs itself, the arrival line fades in,
 * a certificate folds in beside it, the gallery attribution appears,
 * the chapter settles.
 *
 * The state machine is pure. Given an `IntakeOutput` and the current
 * wall-clock offset `tMs` (milliseconds since the chapter started),
 * `activeBeats()` returns the beats that should be painting *right
 * now*. The UI side consumes that list and renders — it does not
 * schedule anything itself. The envelope (fade-in → hold → fade-out)
 * is a pure function of the beat + current time, so render state is
 * equal to `f(tMs)` with no hidden state.
 *
 * This is the spine line "arrival is a chapter, not a dismiss" made
 * mechanical. The 30–45s budget lives in `plan.ts`; the voice-authored
 * labels live in `voice.ts`; the per-beat envelopes live in
 * `envelope.ts`; the driver selection logic lives in `driver.ts`. This
 * file is the shape they all agree on.
 *
 * Load-bearing invariants:
 *   - Every beat carries `startMs` and `durationMs` (inclusive/
 *     exclusive — a beat owns [startMs, startMs + durationMs)).
 *   - Beats may overlap. Narration regularly rides on top of the
 *     approach beat; artifacts ride on top of the pause.
 *   - `ChapterPlan.totalMs` is the point at which the `ready` state
 *     begins. The chapter never "ends" — it waits for Laura's dismiss.
 *   - Null-state (no artifacts, no gallery, no bio) is a first-class
 *     plan, not a fall-through. See `PANG_Aha_Sprint.md` iteration #3
 *     brief declaration 2 ("the null state is the default").
 */

import type { IntakeOutput } from "@/ai/tools/artwork";

/**
 * The taxonomy of visible gestures a beat can own. New kinds are added
 * by extending the union + teaching `envelope.ts` how to shape them +
 * teaching the UI how to render them. Keep the set tight — each kind
 * is a renderer branch.
 */
export type BeatKind =
  /** Camera glide from wall-overview to front-of-work. */
  | "approach"
  /** The work's pose resolves — standoff + emissive ramp up. */
  | "place"
  /** The P-LLM's `arrivalLine`, rendered as wall-caption prose. */
  | "narration"
  /** Silence. No prose, no artifact. The wall holds. */
  | "pause"
  /** A certificate / invoice / condition report folds in beside the work. */
  | "artifact"
  /** The gallery of origin appears as a museum tag. */
  | "attribution"
  /** The artist context (`bioMuji`) reads as a wall text. */
  | "context"
  /** Voice-corpus reflection for the null state (no artifacts, no gallery). */
  | "null-reflection"
  /** Camera breath before the dismiss affordance appears. */
  | "settle"
  /** Terminal — dismiss affordance is present; chapter awaits Laura. */
  | "ready";

/** Ordinal used by the UI to decide render slots + reading order. */
export const BEAT_KIND_ORDER: Readonly<Record<BeatKind, number>> = Object.freeze(
  {
    approach: 0,
    place: 1,
    narration: 2,
    pause: 3,
    artifact: 4,
    attribution: 5,
    context: 6,
    "null-reflection": 7,
    settle: 8,
    ready: 9,
  },
);

/**
 * Per-artifact render payload. The chapter's artifacts are a strict
 * subset of `IntakeOutput.documents` — the same `type` (coa / invoice /
 * condition_report) and `extractedFields`, projected into a narrow
 * render-time shape so the UI doesn't re-derive `label` on every
 * frame.
 */
export interface ChapterArtifact {
  /** Stable id (derived from the document's `fileRef` — see `plan.ts`). */
  readonly id: string;
  readonly kind: "coa" | "invoice" | "condition_report";
  /** Voice-corpus label — "certificate of authenticity", etc. */
  readonly label: string;
  /**
   * A small, ordered list of `(fieldName → value)` pairs. The chapter
   * renders at most three — the spine is the work, not the paperwork.
   */
  readonly fields: ReadonlyArray<readonly [string, string]>;
}

/** Discriminated union of per-beat payloads. Narrow at render time. */
export type BeatPayload =
  | { readonly kind: "text"; readonly text: string; readonly source: "ai" | "voice-corpus" }
  | { readonly kind: "artifact"; readonly artifact: ChapterArtifact }
  | { readonly kind: "attribution"; readonly galleryName: string }
  | { readonly kind: "context"; readonly label: string; readonly body: string }
  | { readonly kind: "camera" }
  | { readonly kind: "pose" };

/**
 * A single beat in the chapter. Immutable once planned — the driver
 * only reads, never mutates.
 */
export interface Beat {
  /** Short stable id (`approach`, `narration`, `artifact/0`, `attribution`). */
  readonly id: string;
  readonly kind: BeatKind;
  /** Milliseconds since chapter start. */
  readonly startMs: number;
  /** Milliseconds. Exclusive upper bound is `startMs + durationMs`. */
  readonly durationMs: number;
  /**
   * Visual fade-in window (0 < x <= durationMs). The envelope ramps
   * `0 → 1` over `[startMs, startMs + fadeInMs)` using exponential
   * smoothing at rate 6 — matches `CameraAnimator`, so chrome and
   * camera share a curve.
   */
  readonly fadeInMs: number;
  /** Fade-out window. Ramp `1 → 0` over the last `fadeOutMs` of the beat. */
  readonly fadeOutMs: number;
  readonly payload?: BeatPayload;
}

/**
 * An immutable chapter plan. Built once per mount by `planChapter()`.
 * The driver reads `beats` in order; the UI reads `totalMs` + payload
 * slots directly.
 */
export interface ChapterPlan {
  readonly beats: readonly Beat[];
  /** Chapter length in ms — `readyAtMs` alias for readability. */
  readonly totalMs: number;
  readonly readyAtMs: number;
  /** The newly-added work's entry id — used for focus + arrival-factor. */
  readonly workId: string;
  /** The short-lived blob: URL for the captured still — overlay source. */
  readonly workImageUrl: string;
  /** The P-LLM's one-sentence arrival line — renders in the narration beat. */
  readonly arrivalLine: string;
  /** The original intake output, retained for observability + payload access. */
  readonly sourceOutput: IntakeOutput;
  /**
   * Descriptive summary of which branches of the plan were taken.
   * Surfaces in the `chapter.plan` event for observability — lets the
   * iteration log inspect the beat composition without replaying the
   * chapter.
   */
  readonly shape: ChapterShape;
}

/** Structural summary of the planned chapter. Pure data. */
export interface ChapterShape {
  readonly beatCount: number;
  readonly hasArtifacts: boolean;
  readonly artifactCount: number;
  readonly hasAttribution: boolean;
  readonly hasContext: boolean;
  readonly hasNullReflection: boolean;
}

/**
 * An "active beat" for the current tick. Pairs the beat with its
 * computed opacity envelope so the UI can render without a second
 * call. Produced by `activeBeats()` in `driver.ts`.
 */
export interface ActiveBeat {
  readonly beat: Beat;
  /** 0..1 opacity envelope — apply to visible chrome, not to audio. */
  readonly envelope: number;
  /** Fraction of the beat elapsed, 0..1. Useful for subtle motion. */
  readonly progress: number;
}
