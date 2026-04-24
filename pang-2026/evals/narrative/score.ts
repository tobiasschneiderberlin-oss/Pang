/**
 * PANG — narrative eval scorer (iter #14, A22).
 *
 * Pure function over `(NarrativeFixture, NarrativeOutput) →
 * FieldScore[]`. Each declared expectation produces exactly one
 * score; the aggregate pass rate is `passed / declared`.
 *
 * Rules per field:
 *   paragraphLengthBand  → length in [min, max]
 *   mustMention          → every listed substring appears (case-i)
 *   mustNotContain       → no substring appears (case-insensitive)
 *   runBannedCheck       → runBannedVocabularyCheck({ narrative })
 *                           succeeds (narrative context runs the soft
 *                           list hard)
 *   noFirstPerson        → no i/me/my/we/our/us word-boundary hit
 *   sentenceCase         → no ≥ 3-word title-case run
 */

import { runBannedVocabularyCheck } from "@/ai/camel/sanitize";
import type { NarrativeOutput } from "@/narrative/schema";
import type {
  FieldScore,
  NarrativeExpectations,
  NarrativeFixture,
} from "./types";

// ---------- Per-field scorers ------------------------------------

function scoreParagraphLengthBand(
  band: { readonly min: number; readonly max: number },
  actual: string,
): FieldScore {
  const len = actual.length;
  const pass = len >= band.min && len <= band.max;
  return {
    field: "paragraphLengthBand",
    pass,
    expected: band,
    actual: len,
    reason: pass
      ? `${len} chars in [${band.min}, ${band.max}]`
      : `${len} chars outside [${band.min}, ${band.max}]`,
  };
}

function scoreMustMention(
  expected: readonly string[],
  actual: string,
): FieldScore {
  const lower = actual.toLowerCase();
  const misses = expected.filter((s) => !lower.includes(s.toLowerCase()));
  const pass = misses.length === 0;
  return {
    field: "mustMention",
    pass,
    expected,
    actual: `${actual.length} chars`,
    reason: pass
      ? "all substrings appear"
      : `missing: ${misses.join(", ")}`,
  };
}

function scoreMustNotContain(
  forbidden: readonly string[],
  actual: string,
): FieldScore {
  const lower = actual.toLowerCase();
  const leaks = forbidden.filter((s) => lower.includes(s.toLowerCase()));
  const pass = leaks.length === 0;
  return {
    field: "mustNotContain",
    pass,
    expected: forbidden,
    actual: leaks,
    reason: pass
      ? "none of the forbidden substrings appear"
      : `leaked: ${leaks.join(", ")}`,
  };
}

function scoreRunBannedCheck(paragraph: string): FieldScore {
  try {
    // The `narrative` key activates the narrative-context branch in
    // `sanitize.ts`, which runs `EVALUATIVE_VOCABULARY` as a *hard*
    // fail. A regression in the schema refine is caught here.
    runBannedVocabularyCheck({ narrative: paragraph });
    return {
      field: "runBannedCheck",
      pass: true,
      expected: "no banned or evaluative vocabulary",
      actual: "clean",
      reason: "paragraph passes the A5 hard-ban check (narrative context)",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      field: "runBannedCheck",
      pass: false,
      expected: "no banned or evaluative vocabulary",
      actual: msg,
      reason: msg,
    };
  }
}

const FIRST_PERSON_MARKERS = [
  " i ",
  " i'",
  " me ",
  " my ",
  " mine ",
  " we ",
  " we'",
  " our ",
  " us ",
  " ours ",
] as const;

function scoreNoFirstPerson(paragraph: string): FieldScore {
  const padded = ` ${paragraph.toLowerCase()} `;
  const hit = FIRST_PERSON_MARKERS.find((m) => padded.includes(m));
  const pass = hit === undefined;
  return {
    field: "noFirstPerson",
    pass,
    expected: "no first-person pronouns",
    actual: hit ?? "none",
    reason: pass
      ? "no first-person pronouns found"
      : `first-person marker detected: ${hit?.trim() ?? ""}`,
  };
}

/**
 * Heuristic sentence-case check. A run of three or more consecutive
 * words each starting uppercase is treated as title case; everything
 * else passes. Proper nouns still slide through — we check for three
 * in a row, which is unusual for names in prose.
 */
function scoreSentenceCase(paragraph: string): FieldScore {
  const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
  let run = 0;
  let worstRun = 0;
  for (const w of words) {
    // Strip leading punctuation / quotes; check first alpha.
    const first = (w.match(/[A-Za-z]/)?.[0] ?? "").toLowerCase();
    const firstRaw = w.match(/[A-Za-z]/)?.[0] ?? "";
    const isCapital = firstRaw !== "" && firstRaw === firstRaw.toUpperCase();
    if (isCapital && first !== "") {
      run += 1;
      if (run > worstRun) worstRun = run;
    } else {
      run = 0;
    }
  }
  const pass = worstRun < 3;
  return {
    field: "sentenceCase",
    pass,
    expected: "no ≥ 3-word title-case run",
    actual: `longest run = ${worstRun}`,
    reason: pass
      ? `longest uppercase-run is ${worstRun} word(s)`
      : `title-case run of ${worstRun} words detected`,
  };
}

// ---------- Aggregate -------------------------------------------

export function scoreFixture(
  fixture: NarrativeFixture,
  output: NarrativeOutput,
): readonly FieldScore[] {
  const exp: NarrativeExpectations = fixture.expected;
  const fields: FieldScore[] = [];

  if (exp.paragraphLengthBand !== undefined) {
    fields.push(scoreParagraphLengthBand(exp.paragraphLengthBand, output.paragraph));
  }
  if (exp.mustMention !== undefined) {
    fields.push(scoreMustMention(exp.mustMention, output.paragraph));
  }
  if (exp.mustNotContain !== undefined) {
    fields.push(scoreMustNotContain(exp.mustNotContain, output.paragraph));
  }
  if (exp.runBannedCheck === true) {
    fields.push(scoreRunBannedCheck(output.paragraph));
  }
  if (exp.noFirstPerson === true) {
    fields.push(scoreNoFirstPerson(output.paragraph));
  }
  if (exp.sentenceCase === true) {
    fields.push(scoreSentenceCase(output.paragraph));
  }

  return fields;
}
