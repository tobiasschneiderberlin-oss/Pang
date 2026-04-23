/**
 * PANG — enrichment eval scorer.
 *
 * Pure function over `(EnrichmentFixture, EnrichmentOutput) →
 * FieldScore[]`. Each declared expectation produces exactly one
 * score; the aggregate pass rate is `passed / declared`.
 *
 * The match rules are deliberately loose in the natural-language
 * corners (bio, nationality) and tight on the structural ones
 * (timeline length, year order, contributor role) — the structure
 * is the agent's load-bearing contract; the prose is where Claude
 * legitimately phrases things differently across temperatures.
 *
 * Rules per field:
 *   timelineLength            → exact numeric match
 *   timelineYearsInOrder      → exact sequence match (null-compatible)
 *   timelineContributorRole   → every entry matches
 *   notesKept (min / max)     → count of non-null notes in the band
 *   bioMustNotContain         → no substring appears (case-insensitive)
 *   nationality               → token overlap ≥ 0.5, or both null
 *   birthYear                 → exact numeric match, or both null
 */

import type { EnrichmentOutput } from "@/enrichment/schema";
import type {
  EnrichmentExpectations,
  EnrichmentFixture,
  FieldScore,
} from "./types";

// ---------- Token helpers (shared shape with intake) -------------

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
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length > 1),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------- Per-field scorers ------------------------------------

function scoreTimelineLength(
  expected: number,
  actual: number,
): FieldScore {
  const pass = actual === expected;
  return {
    field: "timelineLength",
    pass,
    expected,
    actual,
    reason: pass ? "exact match" : "length mismatch",
  };
}

function scoreTimelineYears(
  expected: readonly (number | null)[],
  actual: readonly (number | null)[],
): FieldScore {
  if (actual.length !== expected.length) {
    return {
      field: "timelineYearsInOrder",
      pass: false,
      expected,
      actual,
      reason: `length mismatch (expected ${expected.length}, got ${actual.length})`,
    };
  }
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      return {
        field: "timelineYearsInOrder",
        pass: false,
        expected,
        actual,
        reason: `index ${i} differs (expected ${expected[i]}, got ${actual[i]})`,
      };
    }
  }
  return {
    field: "timelineYearsInOrder",
    pass: true,
    expected,
    actual,
    reason: "ordered match",
  };
}

function scoreTimelineContributorRole(
  expected: string,
  output: EnrichmentOutput,
): FieldScore {
  const mismatches = output.timeline.filter(
    (e) => e.contributorRole !== expected,
  ).length;
  const pass = mismatches === 0;
  return {
    field: "timelineContributorRole",
    pass,
    expected,
    actual: output.timeline.map((e) => e.contributorRole),
    reason: pass
      ? `all ${output.timeline.length} entries match`
      : `${mismatches} entries differ`,
  };
}

function scoreNotesKept(
  min: number | undefined,
  max: number | undefined,
  output: EnrichmentOutput,
): FieldScore {
  const kept = output.timeline.filter((e) => e.note !== null).length;
  const lo = min ?? 0;
  const hi = max ?? Number.POSITIVE_INFINITY;
  const pass = kept >= lo && kept <= hi;
  return {
    field: "notesKept",
    pass,
    expected: { min: lo, max: max ?? null },
    actual: kept,
    reason: pass
      ? `${kept} notes kept, in [${lo}, ${max ?? "∞"}]`
      : `${kept} notes kept, outside [${lo}, ${max ?? "∞"}]`,
  };
}

function scoreBioMustNotContain(
  forbidden: readonly string[],
  output: EnrichmentOutput,
): FieldScore {
  const bio = output.artistContext.bioMuji.toLowerCase();
  const leaks = forbidden.filter((f) => bio.includes(f.toLowerCase()));
  const pass = leaks.length === 0;
  return {
    field: "bioMustNotContain",
    pass,
    expected: forbidden,
    actual: leaks,
    reason: pass
      ? "none of the forbidden substrings appear"
      : `leaked: ${leaks.join(", ")}`,
  };
}

function scoreNationality(
  expected: string | null,
  actual: string | null,
): FieldScore {
  if (expected === null) {
    const pass = actual === null;
    return {
      field: "nationality",
      pass,
      expected,
      actual,
      reason: pass ? "both null" : "expected null, got value",
    };
  }
  if (actual === null) {
    return {
      field: "nationality",
      pass: false,
      expected,
      actual,
      reason: "agent returned null",
    };
  }
  const sim = jaccard(tokens(expected), tokens(actual));
  const pass = sim >= 0.5;
  return {
    field: "nationality",
    pass,
    expected,
    actual,
    reason: `token overlap ${sim.toFixed(2)}${pass ? "" : " (< 0.50)"}`,
  };
}

function scoreBirthYear(
  expected: number | null,
  actual: number | null,
): FieldScore {
  const pass = expected === actual;
  return {
    field: "birthYear",
    pass,
    expected,
    actual,
    reason: pass ? "exact match" : "mismatch",
  };
}

// ---------- Aggregate -------------------------------------------

export function scoreFixture(
  fixture: EnrichmentFixture,
  output: EnrichmentOutput,
): readonly FieldScore[] {
  const exp: EnrichmentExpectations = fixture.expected;
  const fields: FieldScore[] = [];

  if (exp.timelineLength !== undefined) {
    fields.push(
      scoreTimelineLength(exp.timelineLength, output.timeline.length),
    );
  }
  if (exp.timelineYearsInOrder !== undefined) {
    fields.push(
      scoreTimelineYears(
        exp.timelineYearsInOrder,
        output.timeline.map((e) => e.year),
      ),
    );
  }
  if (exp.timelineContributorRole !== undefined) {
    fields.push(
      scoreTimelineContributorRole(exp.timelineContributorRole, output),
    );
  }
  if (exp.notesKeptMin !== undefined || exp.notesKeptMax !== undefined) {
    fields.push(scoreNotesKept(exp.notesKeptMin, exp.notesKeptMax, output));
  }
  if (exp.bioMustNotContain !== undefined) {
    fields.push(scoreBioMustNotContain(exp.bioMustNotContain, output));
  }
  if (exp.nationality !== undefined) {
    fields.push(
      scoreNationality(exp.nationality, output.artistContext.nationality),
    );
  }
  if (exp.birthYear !== undefined) {
    fields.push(
      scoreBirthYear(exp.birthYear, output.artistContext.birthYear),
    );
  }

  return fields;
}
