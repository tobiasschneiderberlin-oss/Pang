#!/usr/bin/env tsx
/**
 * PANG — A22 narrative eval runner (iter #14).
 *
 * Iterates `FIXTURES`, calls the narrative agent (or a mock) with
 * each fixture's `NarrativeInput`, scores the result against declared
 * expected fields, prints a report, and exits non-zero if the
 * aggregate pass rate falls below `EVAL_THRESHOLD` (0.85 from
 * `src/ai/agents/narrative.ts`).
 *
 * Modes:
 *
 *   npm run eval:narrative:mock   — no network; canned responses.
 *                                    Safe for CI; proves the harness.
 *   npm run eval:narrative        — real Anthropic call. Requires
 *                                    ANTHROPIC_API_KEY. Costs real
 *                                    cents per run.
 *
 * CI policy: eval:narrative:mock runs on every push via check:eval.
 * The live variant runs on workflow_dispatch + nightly.
 *
 * The runner parses every response through `NarrativeOutputSchema`
 * regardless of mode — a mock that can't parse is a broken mock, and
 * a drifted agent output lands as a schema failure, not a silent
 * score.
 */

import {
  NarrativeInputSchema,
  NarrativeOutputSchema,
  type NarrativeOutput,
} from "@/narrative/schema";
import { EVAL_THRESHOLD, runNarrative } from "@/ai/agents/narrative";
import { brand } from "@/ai/camel/trust";
import { FIXTURES } from "./fixtures";
import { MOCK_RESPONSES } from "./mocks";
import { scoreFixture } from "./score";
import type {
  AggregateResult,
  FixtureResult,
  NarrativeFixture,
} from "./types";

const MOCK = process.env["PANG_EVAL_MOCK"] === "1";

async function runOne(fixture: NarrativeFixture): Promise<FixtureResult> {
  let output: NarrativeOutput;
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
      output = NarrativeOutputSchema.parse(canned);
    } else {
      // Validate input through the schema so a malformed fixture
      // fails loud, then P-brand for the agent's capability gate.
      const parsed = NarrativeInputSchema.parse(fixture.input);
      const result = await runNarrative(
        brand(parsed as object, "P") as Parameters<typeof runNarrative>[0],
      );
      if (result === null) {
        throw new Error("narrative agent returned null (retries exhausted)");
      }
      // Strip the phantom `'P'` brand back to the plain shape the
      // scorer consumes. The schema re-parse is defensive.
      output = NarrativeOutputSchema.parse(result);
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
  console.log(`  PANG — narrative A22 eval (${MOCK ? "mock" : "live"})`);
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
      "eval:narrative requires ANTHROPIC_API_KEY (or PANG_EVAL_MOCK=1)",
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

  // Telemetry line — same shape as `pang.eval.correspondence` so the
  // future collector ingests all four without translation.
  console.log(
    JSON.stringify({
      span: "pang.eval.narrative",
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
