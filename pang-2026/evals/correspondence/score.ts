/**
 * PANG — correspondence eval scorer.
 *
 * Pure function over `(CorrespondenceFixture, CorrespondenceOutput) →
 * FieldScore[]`. Each declared expectation produces exactly one
 * score; the aggregate pass rate is `passed / declared`.
 *
 * Rules per field:
 *   subjectShape               → null vs non-null check on `subject`
 *   subjectMustMention         → every listed substring appears (case-i)
 *   bodyMustMention            → every listed substring appears (case-i)
 *   bodyMustNotContain         → no substring appears (case-insensitive)
 *   placeholdersOncePerKind    → CONFIRM + DECLINE placeholders appear
 *                                 exactly once each
 *   bannedVocabularyFlagFalse  → output.bannedVocabularyDetected === false
 *   runBannedCheck             → subject + body pass runBannedVocabularyCheck
 *   bodyLengthBand             → output.body.length in [min, max]
 */

import { runBannedVocabularyCheck } from "@/ai/camel/sanitize";
import {
  checkPlaceholders,
  type CorrespondenceOutput,
} from "@/verification/correspondence.schema";
import type {
  CorrespondenceExpectations,
  CorrespondenceFixture,
  FieldScore,
} from "./types";

// ---------- Per-field scorers ------------------------------------

function scoreSubjectShape(
  expected: "null" | "non-null",
  actual: string | null,
): FieldScore {
  const isNull = actual === null;
  const pass = expected === "null" ? isNull : !isNull;
  return {
    field: "subjectShape",
    pass,
    expected,
    actual: isNull ? null : actual,
    reason: pass
      ? `subject is ${isNull ? "null" : "non-null"} as expected`
      : `expected ${expected}, got ${isNull ? "null" : "non-null"}`,
  };
}

function scoreSubjectMustMention(
  expected: readonly string[],
  actual: string | null,
): FieldScore {
  if (actual === null) {
    return {
      field: "subjectMustMention",
      pass: false,
      expected,
      actual: null,
      reason: "subject is null — cannot contain any substring",
    };
  }
  const lower = actual.toLowerCase();
  const misses = expected.filter((s) => !lower.includes(s.toLowerCase()));
  const pass = misses.length === 0;
  return {
    field: "subjectMustMention",
    pass,
    expected,
    actual,
    reason: pass
      ? "all substrings appear"
      : `missing: ${misses.join(", ")}`,
  };
}

function scoreBodyMustMention(
  expected: readonly string[],
  actual: string,
): FieldScore {
  const lower = actual.toLowerCase();
  const misses = expected.filter((s) => !lower.includes(s.toLowerCase()));
  const pass = misses.length === 0;
  return {
    field: "bodyMustMention",
    pass,
    expected,
    actual: `${actual.length} chars`,
    reason: pass
      ? "all substrings appear"
      : `missing: ${misses.join(", ")}`,
  };
}

function scoreBodyMustNotContain(
  forbidden: readonly string[],
  actual: string,
): FieldScore {
  const lower = actual.toLowerCase();
  const leaks = forbidden.filter((s) => lower.includes(s.toLowerCase()));
  const pass = leaks.length === 0;
  return {
    field: "bodyMustNotContain",
    pass,
    expected: forbidden,
    actual: leaks,
    reason: pass
      ? "none of the forbidden substrings appear"
      : `leaked: ${leaks.join(", ")}`,
  };
}

function scorePlaceholders(output: CorrespondenceOutput): FieldScore {
  const ph = checkPlaceholders(output.body);
  return {
    field: "placeholdersOncePerKind",
    pass: ph.ok,
    expected: "{{CONFIRM_URL}} × 1 and {{DECLINE_URL}} × 1",
    actual: ph.ok ? "ok" : ph.reason,
    reason: ph.ok ? "both placeholders appear exactly once" : `${ph.reason}`,
  };
}

function scoreBannedFlagFalse(output: CorrespondenceOutput): FieldScore {
  const pass = output.bannedVocabularyDetected === false;
  return {
    field: "bannedVocabularyFlagFalse",
    pass,
    expected: false,
    actual: output.bannedVocabularyDetected,
    reason: pass
      ? "agent self-flag is false"
      : "agent self-flagged banned vocabulary",
  };
}

function scoreRunBannedCheck(output: CorrespondenceOutput): FieldScore {
  try {
    runBannedVocabularyCheck(output.body);
    if (output.subject !== null) runBannedVocabularyCheck(output.subject);
    return {
      field: "runBannedCheck",
      pass: true,
      expected: "no banned vocabulary",
      actual: "clean",
      reason: "subject and body pass the A5 hard-ban check",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      field: "runBannedCheck",
      pass: false,
      expected: "no banned vocabulary",
      actual: msg,
      reason: msg,
    };
  }
}

function scoreBodyLengthBand(
  band: { readonly min: number; readonly max: number },
  actual: string,
): FieldScore {
  const len = actual.length;
  const pass = len >= band.min && len <= band.max;
  return {
    field: "bodyLengthBand",
    pass,
    expected: band,
    actual: len,
    reason: pass
      ? `${len} chars in [${band.min}, ${band.max}]`
      : `${len} chars outside [${band.min}, ${band.max}]`,
  };
}

// ---------- Aggregate -------------------------------------------

export function scoreFixture(
  fixture: CorrespondenceFixture,
  output: CorrespondenceOutput,
): readonly FieldScore[] {
  const exp: CorrespondenceExpectations = fixture.expected;
  const fields: FieldScore[] = [];

  if (exp.subjectShape !== undefined) {
    fields.push(scoreSubjectShape(exp.subjectShape, output.subject));
  }
  if (exp.subjectMustMention !== undefined) {
    fields.push(scoreSubjectMustMention(exp.subjectMustMention, output.subject));
  }
  if (exp.bodyMustMention !== undefined) {
    fields.push(scoreBodyMustMention(exp.bodyMustMention, output.body));
  }
  if (exp.bodyMustNotContain !== undefined) {
    fields.push(scoreBodyMustNotContain(exp.bodyMustNotContain, output.body));
  }
  if (exp.placeholdersOncePerKind === true) {
    fields.push(scorePlaceholders(output));
  }
  if (exp.bannedVocabularyFlagFalse === true) {
    fields.push(scoreBannedFlagFalse(output));
  }
  if (exp.runBannedCheck === true) {
    fields.push(scoreRunBannedCheck(output));
  }
  if (exp.bodyLengthBand !== undefined) {
    fields.push(scoreBodyLengthBand(exp.bodyLengthBand, output.body));
  }

  return fields;
}
