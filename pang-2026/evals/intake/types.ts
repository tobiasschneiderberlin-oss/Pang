/**
 * PANG — intake eval types.
 *
 * The shape of an eval fixture + the shape of a per-fixture score.
 * Used by the runner (`run.ts`) and the scorer (`score.ts`).
 *
 * Tier 3 of the testing discipline upgrade (2026-04-23).
 */

export interface IntakeFixture {
  /** Stable identifier (`intake-01`, `intake-frida-01`, …). */
  readonly id: string;
  /** One-line description for the eval report. Do not include
   *  sensitive provenance data here — fixtures may be committed. */
  readonly description: string;
  /** Path relative to the fixture directory. PNG or JPEG. */
  readonly imageFile: string;
  /** Declared MIME of the fixture image. */
  readonly imageMime: "image/png" | "image/jpeg";
  /** Expected structured fields the intake agent should return. All
   *  fields are optional — a fixture that doesn't know the artist
   *  omits `artist`, and the scorer ignores what isn't declared. */
  readonly expected: {
    readonly artist?: string;
    readonly title?: string;
    readonly medium?: string;
    readonly year?: number | null;
    readonly dimensionsCm?: {
      readonly h: number;
      readonly w: number;
      readonly d?: number;
    };
  };
  /** Optional untrusted-document body the fixture simulates
   *  (e.g. an email forwarded from the gallery). */
  readonly untrustedDocText?: string;
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
  /** Ratio of fields that passed the fuzzy match. */
  readonly score: number;
  /** True when at least 4/5 declared fields match, per the A22
   *  convention set at the kickoff brief (EVAL_THRESHOLD = 0.85). */
  readonly pass: boolean;
  readonly fields: readonly FieldScore[];
  /** Error from runIntakeAgent, if any. */
  readonly error?: string;
}

export interface AggregateResult {
  readonly fixturesRun: number;
  readonly fixturesPassed: number;
  readonly passRate: number;
  /** The A22 threshold from `src/ai/agents/intake.ts` (0.85). */
  readonly threshold: number;
  readonly perFixture: readonly FixtureResult[];
}
