#!/usr/bin/env tsx
/**
 * PANG — A22 intake eval runner.
 *
 * Iterates `FIXTURES`, calls the intake agent (or a mock) with each
 * fixture image, scores the result against declared expected fields,
 * prints a report, and exits non-zero if the aggregate pass rate
 * falls below `EVAL_THRESHOLD` (0.85 from src/ai/agents/intake.ts).
 *
 * Modes:
 *
 *   npm run eval:intake:mock       — no network; canned responses.
 *                                     Safe for CI; proves the harness.
 *   npm run eval:intake            — real Anthropic call. Requires
 *                                     ANTHROPIC_API_KEY. Costs real
 *                                     cents per run.
 *
 * CI policy: eval:intake:mock runs on every push. eval:intake runs
 * on workflow_dispatch + nightly (see .github/workflows/ci.yml).
 *
 * Tier 3 of the testing discipline upgrade (2026-04-23).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { EVAL_THRESHOLD, runIntakeAgent } from "@/ai/agents/intake";
import { acceptUser } from "@/ai/camel/trust";
import type { IntakeOutput } from "@/ai/tools/artwork";
import { FIXTURES } from "./fixtures";
import { MOCK_RESPONSES } from "./mocks";
import { scoreFixture } from "./score";
import type { AggregateResult, FixtureResult, IntakeFixture } from "./types";

const MOCK = process.env["PANG_EVAL_MOCK"] === "1";
const FIXTURES_DIR = join(process.cwd(), "evals", "intake", "fixtures");

async function runOne(fixture: IntakeFixture): Promise<FixtureResult> {
  let output: IntakeOutput;
  let error: string | undefined;

  try {
    if (MOCK) {
      const canned = MOCK_RESPONSES[fixture.id];
      if (!canned) {
        throw new Error(
          `no mock response registered for fixture ${fixture.id}`,
        );
      }
      output = canned;
    } else {
      const bytes = new Uint8Array(
        await readFile(join(FIXTURES_DIR, fixture.imageFile)),
      );
      const image = acceptUser({ bytes, mime: fixture.imageMime });
      const input = {
        image,
        captureMeta: {
          capturedAt: new Date().toISOString(),
          tier: "B" as const,
        },
      };
      const result = await runIntakeAgent(input);
      if (result === null) {
        throw new Error("intake agent returned null (compensate)");
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
    `  PANG — intake A22 eval (${MOCK ? "mock" : "live"})`,
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
      "eval:intake requires ANTHROPIC_API_KEY (or PANG_EVAL_MOCK=1)",
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

  // Also emit a single-line JSON payload for CI log-scraping and
  // future dashboard ingestion. Same shape the collector will
  // consume (OTel-compatible attrs under pang.eval.*).
  console.log(
    JSON.stringify({
      span: "pang.eval.intake",
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
