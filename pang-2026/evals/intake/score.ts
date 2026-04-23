/**
 * PANG — intake eval scorer.
 *
 * Fuzzy match between `IntakeOutput.artwork` and a fixture's
 * `expected` block. A full exact-match would be brittle against
 * Claude's phrasing variance (e.g. "oil on canvas" vs "oil on
 * canvas, mounted on panel"); a token-overlap with normalization
 * lets a real answer land as pass even when the string isn't
 * byte-identical.
 *
 * Rules per field:
 *
 *   artist       → normalized equality (casefold + strip accents)
 *   title        → Jaccard token overlap ≥ 0.6
 *   medium       → token overlap ≥ 0.5 (medium strings are short
 *                   and Claude's phrasing varies more)
 *   year         → exact numeric match
 *   dimensionsCm → within 5 % on h and w independently
 *
 * When a fixture doesn't declare a field, the scorer doesn't score
 * it. The ratio is passed / declared, never passed / 5.
 */

import type { IntakeOutput } from "@/ai/tools/artwork";
import type { FieldScore, IntakeFixture } from "./types";

// ---------- Field-level helpers ----------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------- Per-field scorers ------------------------------------

function scoreArtist(
  expected: string,
  actual: string | null,
): FieldScore {
  if (actual === null) {
    return {
      field: "artist",
      pass: false,
      expected,
      actual,
      reason: "agent returned null",
    };
  }
  const eq = normalize(expected) === normalize(actual);
  return {
    field: "artist",
    pass: eq,
    expected,
    actual,
    reason: eq ? "normalized match" : "normalized mismatch",
  };
}

function scoreTitle(
  expected: string,
  actual: string | null,
): FieldScore {
  if (actual === null) {
    return {
      field: "title",
      pass: false,
      expected,
      actual,
      reason: "agent returned null",
    };
  }
  const sim = jaccard(tokens(expected), tokens(actual));
  const pass = sim >= 0.6;
  return {
    field: "title",
    pass,
    expected,
    actual,
    reason: `token overlap ${sim.toFixed(2)}${pass ? "" : " (< 0.60)"}`,
  };
}

function scoreMedium(
  expected: string,
  actual: string | null,
): FieldScore {
  if (actual === null) {
    return {
      field: "medium",
      pass: false,
      expected,
      actual,
      reason: "agent returned null",
    };
  }
  const sim = jaccard(tokens(expected), tokens(actual));
  const pass = sim >= 0.5;
  return {
    field: "medium",
    pass,
    expected,
    actual,
    reason: `token overlap ${sim.toFixed(2)}${pass ? "" : " (< 0.50)"}`,
  };
}

function scoreYear(
  expected: number | null,
  actual: number | null,
): FieldScore {
  const pass = expected === actual;
  return {
    field: "year",
    pass,
    expected,
    actual,
    reason: pass ? "exact match" : "mismatch",
  };
}

function scoreDimensions(
  expected: { h: number; w: number; d?: number },
  actual: IntakeOutput["artwork"]["dimensionsCm"],
): FieldScore {
  if (actual === null) {
    return {
      field: "dimensionsCm",
      pass: false,
      expected,
      actual,
      reason: "agent returned null",
    };
  }
  const tol = 0.05;
  const within = (a: number, b: number) => Math.abs(a - b) / b <= tol;
  const hPass = within(actual.h, expected.h);
  const wPass = within(actual.w, expected.w);
  const pass = hPass && wPass;
  return {
    field: "dimensionsCm",
    pass,
    expected,
    actual,
    reason: pass
      ? "within 5 %"
      : `h ${hPass ? "ok" : "off"}, w ${wPass ? "ok" : "off"}`,
  };
}

// ---------- Aggregate -------------------------------------------

export function scoreFixture(
  fixture: IntakeFixture,
  output: IntakeOutput,
): readonly FieldScore[] {
  const fields: FieldScore[] = [];
  const expected = fixture.expected;
  const actual = output.artwork;

  if (expected.artist !== undefined)
    fields.push(scoreArtist(expected.artist, actual.artist));
  if (expected.title !== undefined)
    fields.push(scoreTitle(expected.title, actual.title));
  if (expected.medium !== undefined)
    fields.push(scoreMedium(expected.medium, actual.medium));
  if (expected.year !== undefined)
    fields.push(scoreYear(expected.year, actual.year));
  if (expected.dimensionsCm !== undefined)
    fields.push(scoreDimensions(expected.dimensionsCm, actual.dimensionsCm));

  return fields;
}
