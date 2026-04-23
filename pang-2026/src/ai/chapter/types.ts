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
  /**
   * The outcome chapter's narration beat for a *confirmed* verification —
   * the work's emissive has just risen from 0 to the verified rest. The
   * beat owns the wall-caption prose ("the gallery confirms this work").
   */
  | "confirmation"
  /**
   * The outcome chapter's narration beat for a *declined* verification —
   * the work remains dormant. The beat owns the wall-caption prose
   * ("the gallery did not confirm this work").
   */
  | "decline"
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
    confirmation: 8,
    decline: 9,
    settle: 10,
    ready: 11,
  },
);

/**
 * Per-artifact render payload. The chapter's artifacts are a strict
 * subset of `IntakeOutput.documents` — the same `type` (coa / invoice /
 * condition_report) and `extractedFields`, projected into a narrow
 * render-time shape so the UI doesn't re-derive `label` on every
 * frame.
 *
 * `fileRef` (added iteration #6) points at the OPFS-resident document
 * bytes; null when the document surfaced in the intake without a file
 * (field-only intake — the signature description survived the Q-LLM
 * pass but the scan didn't). A null `fileRef` makes the artifact
 * card tappable-as-no-op; the viewer never opens, and the chapter
 * does not render a broken-image glyph.
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
  /**
   * OPFS path to the document bytes, or null when no scan exists.
   * Drives whether the artifact card opens a `DocumentViewer` on tap.
   */
  readonly fileRef: string | null;
  /**
   * MIME of the document bytes. `application/pdf` when `fileRef`
   * targets a PDF, image MIMEs otherwise. Null when `fileRef` is null.
   */
  readonly mime: "application/pdf" | "image/png" | "image/jpeg" | null;
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
 * Minimum structural contract every chapter plan satisfies. Driver
 * functions (`activeBeats`, `findBeatByKind`, `isReady`) read only
 * these fields — they are variant-agnostic, so the outcome chapters
 * ride the same selection logic as the arrival chapter without a
 * second code path.
 */
export interface ChapterPlanBase {
  readonly beats: readonly Beat[];
  readonly totalMs: number;
  readonly readyAtMs: number;
  readonly workId: string;
  /** Descriptive summary of which branches were taken (for telemetry). */
  readonly shape: ChapterShape;
}

/**
 * An immutable chapter plan. Built once per mount by `planChapter()`.
 * The driver reads `beats` in order; the UI reads `totalMs` + payload
 * slots directly.
 *
 * This is the **arrival** variant — produced when a freshly-scanned
 * work lands on the wall. The outcome variants (confirmation /
 * decline) use `OutcomeChapterPlan`.
 */
export interface ChapterPlan extends ChapterPlanBase {
  readonly variant: "arrival";
  /** The short-lived blob: URL for the captured still — overlay source. */
  readonly workImageUrl: string;
  /** The P-LLM's one-sentence arrival line — renders in the narration beat. */
  readonly arrivalLine: string;
  /** The original intake output, retained for observability + payload access. */
  readonly sourceOutput: IntakeOutput;
}

/**
 * Outcome chapter — plays when the gallery answers a verification
 * request. Two shapes share the same plan type:
 *
 *   - `variant: "confirmation"` — the gallery confirmed. The work's
 *     emissive rises from 0 to verified-rest over the narration beat;
 *     `setWorkVerified(id, true)` is called at `settle`.
 *   - `variant: "decline"` — the gallery did not confirm. The work
 *     remains dormant. No emissive change.
 *
 * Outcome plans are short (~14s) compared to arrival (~30–45s) — the
 * work is already on the wall; the chapter is a museum-caption
 * acknowledgement, not a procession.
 */
export interface OutcomeChapterPlan extends ChapterPlanBase {
  readonly variant: "confirmation" | "decline";
  /** The voice-corpus narration line rendered during the outcome beat. */
  readonly narrationLine: string;
  /** ISO-8601 timestamp of the gallery's decision. */
  readonly decidedAt: string;
}

/**
 * Documents chapter — plays when the collector focuses a work that
 * carries documents (CoA, invoice, condition report). Iteration #6's
 * render-discipline moment: the arrival chapter primitive (iter #3)
 * and the outcome chapter (iter #4) now extend to *evidence*.
 *
 * Shape:
 *   - `settle` (~600 ms) — opening breath before the procession.
 *   - `artifact/0..n-1` — staggered reveal, one per document. Each
 *     beat carries the document's label + extracted fields + OPFS
 *     ref; the renderer maps this to a tactile card.
 *   - `context` (~2.5 s) — a closing voice-corpus line that frames
 *     the documents ("papers of record.") as evidence, not chrome.
 *   - `ready` — terminal; the chapter waits. No dismiss affordance:
 *     the collector's gesture is the dismiss.
 *
 * Budget: `totalMs` in [6000, 12000], scaling with document count.
 *
 * Zero-tap (P25): the chapter plays on focus, not on a separate
 * "view documents" tap. The cards are evidence sitting beside the
 * work, not a hidden drawer.
 */
export interface DocumentsChapterPlan extends ChapterPlanBase {
  readonly variant: "documents";
  /** Ordered by beat index; mirrors the `artifact/i` beats' payloads. */
  readonly artifacts: readonly ChapterArtifact[];
  /** The voice-corpus closing line rendered during the context beat. */
  readonly contextLine: string;
  /** ISO-8601 timestamp of the focus that kicked off the chapter. */
  readonly focusedAt: string;
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
