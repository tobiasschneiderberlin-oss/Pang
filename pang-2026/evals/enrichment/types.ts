/**
 * PANG — enrichment eval types.
 *
 * An enrichment fixture carries the *inputs* the agent would receive
 * in production (a `ProvenanceSubmission` + an `ArtworkSnapshot`) and
 * the *expected properties* of the resulting `EnrichmentOutput`. The
 * scorer checks those properties; the runner owns the call shape.
 *
 * We score declared properties only. A fixture that doesn't know the
 * artist's birth year omits `expected.artistContext.birthYear`, and
 * the scorer doesn't penalise its absence. This is the same contract
 * as the intake eval (A22).
 *
 * The A22 convention set in `src/ai/agents/enrichment.ts` is
 * `EVAL_THRESHOLD = 0.85` — a fixture passes when ≥ 85 % of its
 * declared properties pass.
 */

import type {
  ContributorRole,
  ProvenanceRecord,
} from "@/enrichment/schema";
import type { ArtworkSnapshot } from "@/verification/schema";

export interface EnrichmentFixture {
  /** Stable identifier (`enrichment-01-gallery-nominal`, …). */
  readonly id: string;
  /** One-line description for the eval report. */
  readonly description: string;

  // ---- Inputs the agent would see in production -----------------
  /** The rectified artwork snapshot under enrichment. */
  readonly artwork: ArtworkSnapshot;
  /** The submission envelope's contributor identity. */
  readonly contributorId: string;
  readonly contributorRole: ContributorRole;
  /** The attached records. Same shape as a live submission. */
  readonly records: readonly ProvenanceRecord[];

  // ---- What we expect out of a correct agent run ----------------
  readonly expected: EnrichmentExpectations;
}

/**
 * Declared, optional expectations. An omitted property is not scored.
 * Each present property becomes one `FieldScore` in the result.
 */
export interface EnrichmentExpectations {
  /** Exact count of entries in `output.timeline`. */
  readonly timelineLength?: number;
  /** Expected `year` column in declared order (nulls allowed; the
   *  scorer uses `null` for undated entries and checks nulls-last). */
  readonly timelineYearsInOrder?: readonly (number | null)[];
  /** Expected contributor-role on every timeline entry. The agent
   *  plumbs the submission's role onto each entry. */
  readonly timelineContributorRole?: ContributorRole;
  /** Minimum number of records whose note survived Q-LLM sanitisation.
   *  Zero is a legitimate expectation (all-null or all-poisoned). */
  readonly notesKeptMin?: number;
  /** Maximum number of records whose note may have survived. For a
   *  poisoned-note fixture we expect either 0 (stripped) or 1 (kept
   *  as a truly benign fragment) but never more. */
  readonly notesKeptMax?: number;
  /** When set, bio must NOT contain any of these substrings (case-
   *  insensitive). Used by the poisoned-note fixture to detect a
   *  successful injection leak. */
  readonly bioMustNotContain?: readonly string[];
  /** Expected `artistContext.nationality` — token-overlap ≥ 0.5. */
  readonly nationality?: string | null;
  /** Expected `artistContext.birthYear` — exact match or both null. */
  readonly birthYear?: number | null;
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
  /** Error from `runEnrichmentAgent`, if any. */
  readonly error?: string;
}

export interface AggregateResult {
  readonly fixturesRun: number;
  readonly fixturesPassed: number;
  readonly passRate: number;
  readonly threshold: number;
  readonly perFixture: readonly FixtureResult[];
}
