/**
 * PANG — narrative eval types (iter #14, A22).
 *
 * A narrative fixture carries the *inputs* the agent sees — a full
 * `NarrativeInput` (verified works, provenance entries, bio-muji
 * paragraphs) — and the *expected properties* of the resulting
 * `NarrativeOutput.paragraph`. The scorer checks the declared
 * properties only; an omitted property is not counted against the
 * fixture.
 *
 * Convention (A22): `EVAL_THRESHOLD = 0.85` from
 * `src/ai/agents/narrative.ts`. A fixture passes when ≥ 85 % of its
 * declared properties pass; the aggregate pass rate is `passed /
 * declared`.
 *
 * The fixture scope is intentionally narrow: the agent's output has
 * one field (`paragraph`), so the scorers target character-level and
 * vocabulary invariants. A fixture never asserts on specific prose
 * because the agent's temperature > 0; the contract is
 * "observational, length-banded, no banned vocabulary, no first-
 * person", not "these exact words".
 */

import type {
  NarrativeInput,
  NarrativeOutput,
} from "@/narrative/schema";

export interface NarrativeFixture {
  /** Stable identifier (`narrative-01-typical`, …). */
  readonly id: string;
  /** One-line description for the eval report. */
  readonly description: string;

  /** The `NarrativeInput` the agent would see in production. */
  readonly input: NarrativeInput;

  /** What we expect out of a correct agent run. */
  readonly expected: NarrativeExpectations;
}

/**
 * Declared, optional expectations. An omitted property is not scored.
 * Each present property becomes one `FieldScore` in the result.
 */
export interface NarrativeExpectations {
  /**
   * Paragraph length falls inside `[min, max]` chars. Tighter than
   * the schema's [120, 600] band when the fixture wants to defend a
   * subregion (e.g. ≤ 300 for thin collections).
   */
  readonly paragraphLengthBand?: {
    readonly min: number;
    readonly max: number;
  };
  /**
   * Paragraph contains each listed substring (case-insensitive). Used
   * for fixtures that seed a unique token (artist surname, year, etc.)
   * the agent must carry through.
   */
  readonly mustMention?: readonly string[];
  /**
   * Paragraph MUST NOT contain any substring (case-insensitive). Used
   * to assert the agent didn't invent a missing year / medium, or
   * didn't reach for evaluative head terms the schema refine doesn't
   * cover.
   */
  readonly mustNotContain?: readonly string[];
  /**
   * Hard banned-vocabulary check against `BANNED_VOCABULARY` +
   * `EVALUATIVE_VOCABULARY`. Mirrors the agent's runtime defence.
   */
  readonly runBannedCheck?: boolean;
  /**
   * First-person marker absence check — `i/me/my/we/our/us` must not
   * appear as a word boundary. Redundant with the schema refine, kept
   * here so a regression in the schema is surfaced by the eval too.
   */
  readonly noFirstPerson?: boolean;
  /**
   * Sentence-case check: paragraph does not contain a run of three or
   * more consecutive capitalised words (title-case heuristic).
   */
  readonly sentenceCase?: boolean;
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
  /** Error from `runNarrative`, if any. */
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
export type MockNarrativeResponse = NarrativeOutput;
