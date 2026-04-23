#!/usr/bin/env tsx
/**
 * PANG — A22 enrichment eval runner.
 *
 * Iterates `FIXTURES`, calls the enrichment agent (or reads a canned
 * `EnrichmentOutput`), scores the result, prints a report, and exits
 * non-zero if the aggregate pass rate falls below `EVAL_THRESHOLD`
 * (0.85 from `src/ai/agents/enrichment.ts`).
 *
 * Modes:
 *
 *   npm run eval:enrichment:mock   — no network; canned responses.
 *                                     Safe for CI; proves the harness.
 *   npm run eval:enrichment        — real Anthropic call. Requires
 *                                     ANTHROPIC_API_KEY. Costs real
 *                                     cents per run.
 *
 * CI policy: eval:enrichment:mock runs on every push. eval:enrichment
 * runs on workflow_dispatch + nightly (see .github/workflows/ci.yml
 * once wired in iteration #7).
 *
 * The runner validates that every output the mock (or the real agent)
 * produces parses through `EnrichmentOutputSchema`. A mock that can't
 * parse is a broken mock — the scorer never sees it.
 */

import {
  EnrichmentOutputSchema,
  ProvenanceSubmissionSchema,
  newSubmissionId,
  type EnrichmentOutput,
  type ProvenanceSubmission,
} from "@/enrichment/schema";
import { ArtworkSnapshotSchema } from "@/verification/schema";
import {
  EVAL_THRESHOLD,
  runEnrichmentAgent,
} from "@/ai/agents/enrichment";
import { acceptGallery } from "@/ai/camel/trust";
import { FIXTURES, FIXTURE_WORK_HASHES } from "./fixtures";
import { MOCK_RESPONSES } from "./mocks";
import { scoreFixture } from "./score";
import type {
  AggregateResult,
  EnrichmentFixture,
  FixtureResult,
} from "./types";

const MOCK = process.env["PANG_EVAL_MOCK"] === "1";

// Deterministic timestamp for the mock path so `datetime()` passes
// without introducing a clock dependency in CI.
const MOCK_GENERATED_AT = "2026-04-23T12:00:00.000Z";
// A stable submittedAt for deterministic fixtures.
const FIXTURE_SUBMITTED_AT = "2026-04-23T10:00:00.000Z";

async function runOne(fixture: EnrichmentFixture): Promise<FixtureResult> {
  let output: EnrichmentOutput;
  let error: string | undefined;

  try {
    if (MOCK) {
      const canned = MOCK_RESPONSES[fixture.id];
      if (!canned) {
        throw new Error(
          `no mock response registered for fixture ${fixture.id}`,
        );
      }
      // Parse through the schema so a malformed mock fails loud.
      output = EnrichmentOutputSchema.parse({
        ...canned,
        generatedAt: MOCK_GENERATED_AT,
      });
    } else {
      const workHash = FIXTURE_WORK_HASHES[fixture.id];
      if (!workHash) {
        throw new Error(
          `no work hash registered for fixture ${fixture.id}`,
        );
      }
      const submission: ProvenanceSubmission =
        ProvenanceSubmissionSchema.parse({
          version: "v1",
          submissionId: newSubmissionId(),
          workId: fixture.id,
          contributorId: fixture.contributorId,
          contributorRole: fixture.contributorRole,
          records: fixture.records,
          basedOnWorkHash: workHash,
          submittedAt: FIXTURE_SUBMITTED_AT,
        });
      const artwork = ArtworkSnapshotSchema.parse(fixture.artwork);
      const result = await runEnrichmentAgent({
        submission: acceptGallery(submission),
        artwork: acceptGallery(artwork),
        basedOnWorkHash: workHash,
      });
      if (result === null) {
        throw new Error("enrichment agent returned null (retries exhausted)");
      }
      output = result;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    return {
      id: fixture.id,
      description: fixture.description,
      score: 0,
      pass: false,
      fields: [],
      error,
    };
  }

  const fields = scoreFixture(fixture, output);
  const passedFields = fields.filter((f) => f.pass).length;
  const declared = fields.length;
  const score = declared === 0 ? 1 : passedFields / declared;
  const pass = score >= EVAL_THRESHOLD;
  return {
    id: fixture.id,
    description: fixture.description,
    score,
    pass,
    fields,
  };
}

function printReport(agg: AggregateResult): void {
  const bar = "─".repeat(70);
  console.log(bar);
  console.log(
    `  PANG — enrichment A22 eval (${MOCK ? "mock" : "live"})`,
  );
  console.log(bar);
  for (const r of agg.perFixture) {
    const status = r.pass ? "PASS" : "FAIL";
    console.log(
      `  [${status}] ${r.id}  score=${(r.score * 100).toFixed(0)} %`,
    );
    console.log(`         ${r.description}`);
    if (r.error) {
      console.log(`         error: ${r.error}`);
    }
    for (const f of r.fields) {
      const mark = f.pass ? "ok " : "FAIL";
      console.log(`         [${mark}] ${f.field}: ${f.reason}`);
    }
  }
  console.log(bar);
  console.log(
    `  ${agg.fixturesPassed}/${agg.fixturesRun} fixtures passed ` +
      `(${(agg.passRate * 100).toFixed(0)} %, threshold ${(agg.threshold * 100).toFixed(0)} %)`,
  );
  console.log(bar);
}

async function main(): Promise<void> {
  if (!MOCK && !process.env["ANTHROPIC_API_KEY"]) {
    console.error(
      "eval:enrichment requires ANTHROPIC_API_KEY (or PANG_EVAL_MOCK=1)",
    );
    process.exit(2);
  }

  const perFixture: FixtureResult[] = [];
  for (const fixture of FIXTURES) {
    perFixture.push(await runOne(fixture));
  }

  const passed = perFixture.filter((r) => r.pass).length;
  const passRate = perFixture.length === 0 ? 1 : passed / perFixture.length;
  const agg: AggregateResult = {
    fixturesRun: perFixture.length,
    fixturesPassed: passed,
    passRate,
    threshold: EVAL_THRESHOLD,
    perFixture,
  };

  printReport(agg);

  // Telemetry line — same shape as `pang.eval.intake` so the future
  // collector ingests both without translation.
  console.log(
    JSON.stringify({
      span: "pang.eval.enrichment",
      mode: MOCK ? "mock" : "live",
      fixturesRun: agg.fixturesRun,
      fixturesPassed: agg.fixturesPassed,
      passRate: agg.passRate,
      threshold: agg.threshold,
    }),
  );

  if (passRate < EVAL_THRESHOLD) {
    console.error(
      `A22 regression: pass rate ${(passRate * 100).toFixed(0)} % < ${(EVAL_THRESHOLD * 100).toFixed(0)} %`,
    );
    process.exit(1);
  }
}

void main();
