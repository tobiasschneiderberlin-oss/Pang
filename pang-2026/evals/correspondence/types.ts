/**
 * PANG — correspondence eval types.
 *
 * A correspondence fixture carries the *inputs* the agent would
 * receive in production (an `ArtworkSnapshot`, the gallery's display
 * name, and the channel) and the *expected properties* of the
 * resulting `CorrespondenceOutput`. The scorer checks those
 * properties; the runner owns the call shape.
 *
 * We score declared properties only. A fixture that does not care
 * whether the subject mentions the artist's name omits
 * `expected.subjectMustMention`, and the scorer doesn't penalise its
 * absence. Same contract as the intake + enrichment evals (A22).
 *
 * The A22 convention set in `src/ai/agents/correspondence.ts` is
 * `EVAL_THRESHOLD = 0.85` — a fixture passes when ≥ 85 % of its
 * declared properties pass.
 */

import type {
  CorrespondenceChannel,
  CorrespondenceOutput,
} from "@/verification/correspondence.schema";
import type { ArtworkSnapshot } from "@/verification/schema";

export interface CorrespondenceFixture {
  /** Stable identifier (`correspondence-01-email-nominal`, …). */
  readonly id: string;
  /** One-line description for the eval report. */
  readonly description: string;

  // ---- Inputs the agent would see in production -----------------
  readonly artwork: ArtworkSnapshot;
  readonly galleryDisplayName: string;
  readonly channel: CorrespondenceChannel;

  // ---- What we expect out of a correct agent run ----------------
  readonly expected: CorrespondenceExpectations;
}

/**
 * Declared, optional expectations. An omitted property is not scored.
 * Each present property becomes one `FieldScore` in the result.
 */
export interface CorrespondenceExpectations {
  /** Subject must be null (WhatsApp) or non-null (email). */
  readonly subjectShape?: "null" | "non-null";
  /** Subject must contain these substrings (case-insensitive). */
  readonly subjectMustMention?: readonly string[];
  /** Body must contain these substrings (case-insensitive). */
  readonly bodyMustMention?: readonly string[];
  /** Body must NOT contain these substrings (case-insensitive). Used
   *  to assert the agent didn't invent a missing artist / year. */
  readonly bodyMustNotContain?: readonly string[];
  /** Placeholder-exactly-once check. Always on when set to true. */
  readonly placeholdersOncePerKind?: boolean;
  /** Banned-vocabulary self-flag. Always false for a correct output. */
  readonly bannedVocabularyFlagFalse?: boolean;
  /** Hard banned-vocabulary check on subject + body. */
  readonly runBannedCheck?: boolean;
  /** Body character count falls inside `[min, max]`. */
  readonly bodyLengthBand?: { readonly min: number; readonly max: number };
}

export interface FieldScore {
  readonly field: string;
  readonly pass: boolean;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly reason: string;
}

export interface FixtureResult {
  readonly id: string;
  readonly description: string;
  /** Ratio of declared properties that passed. */
  readonly score: number;
  /** `score >= EVAL_THRESHOLD` (0.85). */
  readonly pass: boolean;
  readonly fields: readonly FieldScore[];
  /** Error from `runCorrespondenceAgent`, if any. */
  readonly error?: string;
}

export interface AggregateResult {
  readonly fixturesRun: number;
  readonly fixturesPassed: number;
  readonly passRate: number;
  readonly threshold: number;
  readonly perFixture: readonly FixtureResult[];
}

/** A canned mock response (sans runtime-stamped fields). */
export type MockCorrespondenceResponse = CorrespondenceOutput;
