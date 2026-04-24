#!/usr/bin/env tsx
/**
 * PANG — A22 correspondence eval runner.
 *
 * Iterates `FIXTURES`, calls the correspondence agent (or a mock) with
 * each fixture's artwork + gallery + channel, scores the result
 * against declared expected fields, prints a report, and exits non-zero
 * if the aggregate pass rate falls below `EVAL_THRESHOLD` (0.85 from
 * `src/ai/agents/correspondence.ts`).
 *
 * Modes:
 *
 *   npm run eval:correspondence:mock   — no network; canned responses.
 *                                          Safe for CI; proves the harness.
 *   npm run eval:correspondence        — real Anthropic call. Requires
 *                                          ANTHROPIC_API_KEY. Costs real
 *                                          cents per run.
 *
 * CI policy: eval:correspondence:mock runs on every push. The live
 * variant runs on workflow_dispatch + nightly (see .github/workflows
 * /ci.yml — the cron job picks up eval scripts by name).
 *
 * The runner parses every response through `CorrespondenceOutputSchema`
 * regardless of mode — a mock that can't parse is a broken mock, and a
 * drifted agent output lands as a schema failure, not a silent score.
 */

import {
  CorrespondenceOutputSchema,
  type CorrespondenceOutput,
} from "@/verification/correspondence.schema";
import { ArtworkSnapshotSchema } from "@/verification/schema";
import {
  EVAL_THRESHOLD,
  runCorrespondenceAgent,
} from "@/ai/agents/correspondence";
import { acceptGallery, brand } from "@/ai/camel/trust";
import { FIXTURES } from "./fixtures";
import { MOCK_RESPONSES } from "./mocks";
import { scoreFixture } from "./score";
import type {
  AggregateResult,
  CorrespondenceFixture,
  FixtureResult,
} from "./types";

const MOCK = process.env["PANG_EVAL_MOCK"] === "1";

async function runOne(fixture: CorrespondenceFixture): Promise<FixtureResult> {
  let output: CorrespondenceOutput;
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
      output = CorrespondenceOutputSchema.parse(canned);
    } else {
      const artwork = ArtworkSnapshotSchema.parse(fixture.artwork);
      const result = await runCorrespondenceAgent({
        artwork: acceptGallery(artwork as object) as Parameters<
          typeof runCorrespondenceAgent
        >[0]["artwork"],
        gallery: brand(
          { displayName: fixture.galleryDisplayName },
          "gallery",
        ) as Parameters<typeof runCorrespondenceAgent>[0]["gallery"],
        channel: fixture.channel,
      });
      if (result === null) {
        throw new Error(
          "correspondence agent returned null (retries exhausted)",
        );
      }
      // The agent returns a `'P'`-branded output; strip the phantom brand
      // back to the shape the scorer consumes. The schema re-parse is
      // defensive — the agent already parsed on the way out.
      output = CorrespondenceOutputSchema.parse(result);
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
    `  PANG — correspondence A22 eval (${MOCK ? "mock" : "live"})`,
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
      "eval:correspondence requires ANTHROPIC_API_KEY (or PANG_EVAL_MOCK=1)",
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
  // collector ingests all three without translation.
  console.log(
    JSON.stringify({
      span: "pang.eval.correspondence",
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
