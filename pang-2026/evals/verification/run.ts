#!/usr/bin/env tsx
/**
 * PANG — verification outcome-chapter eval.
 *
 * A deterministic fixture sweep over the confirmation + decline
 * planners. Unlike the intake eval (A22), verification has no model
 * in the loop — the planners are pure functions of (workId,
 * decidedAt) and the voice corpus. The eval still lives alongside
 * the other evals because:
 *
 *   1. It protects the outcome chapter's *shape* — totalMs band,
 *      beat sequence, narration source — from future voice or
 *      timing drift. A regression in any of these would leak into
 *      Laura's surface as a wrong-length chapter or a stale line.
 *
 *   2. It exercises the barrel export path from `@/ai/chapter`,
 *      catching any future re-export breakage that the unit tests
 *      would miss (the unit tests import from `./plan` directly).
 *
 *   3. It emits the same `pang.eval.verification` JSON line that
 *      the future collector ingests — the reconcile events + outcome
 *      events + eval lines cross-correlate by `requestId` one day.
 *
 * CI policy: runs on every push via `npm run check:eval:verification`
 * (and transitively via `npm run verify`). No network, no env
 * dependency.
 */

import {
  planConfirmationChapter,
  planDeclineChapter,
  OUTCOME_NARRATION,
  type OutcomeChapterPlan,
} from "@/ai/chapter";

interface VerificationFixture {
  readonly id: string;
  readonly description: string;
  readonly variant: "confirmation" | "decline";
  readonly workId: string;
  readonly decidedAt: string;
}

interface FixtureResult {
  readonly id: string;
  readonly description: string;
  readonly pass: boolean;
  readonly checks: readonly FieldResult[];
}

interface FieldResult {
  readonly field: string;
  readonly pass: boolean;
  readonly reason: string;
}

const FIXTURES: readonly VerificationFixture[] = [
  {
    id: "verif-01-confirm-typical",
    description:
      "Confirmation chapter — the gallery confirms a dormant work.",
    variant: "confirmation",
    workId: "w-alpha",
    decidedAt: "2026-04-23T11:00:00.000Z",
  },
  {
    id: "verif-02-decline-typical",
    description:
      "Decline chapter — the gallery does not confirm. Work stays dormant.",
    variant: "decline",
    workId: "w-beta",
    decidedAt: "2026-04-23T11:00:00.000Z",
  },
  {
    id: "verif-03-confirm-late-decision",
    description:
      "Confirmation chapter — arbitrary decidedAt plumbs through unchanged.",
    variant: "confirmation",
    workId: "w-gamma",
    decidedAt: "2026-05-01T16:42:00.000Z",
  },
  // Iter #11 — the outcome-mount queue surfaces chapters FIFO, one at a
  // time. The planner is a pure function of (workId, decidedAt), so
  // FIFO correctness at the *plan* level means each fixture produces a
  // plan whose workId is exactly its input — no cross-contamination
  // when multiple plans exist in-flight. verif-04 / verif-05 add two
  // rapid-fire decidedAt timestamps sharing the same second; a bug
  // that keyed the planner on decidedAt alone would show up here.
  {
    id: "verif-04-confirm-rapidfire-first",
    description:
      "Confirmation chapter — first of two rapid-fire confirms sharing a decidedAt window.",
    variant: "confirmation",
    workId: "w-delta",
    decidedAt: "2026-04-23T11:00:00.100Z",
  },
  {
    id: "verif-05-decline-rapidfire-second",
    description:
      "Decline chapter — second of two rapid-fire outcomes; workId identifies the plan, not time.",
    variant: "decline",
    workId: "w-epsilon",
    decidedAt: "2026-04-23T11:00:00.180Z",
  },
];

// Accepts any timing band the planner produces today; the floor /
// ceiling guards against an accidental drift that would breach the
// spine's sub-arrival budget for outcome chapters.
const MIN_TOTAL_MS = 8_000;
const MAX_TOTAL_MS = 18_000;

function planFor(fixture: VerificationFixture): OutcomeChapterPlan {
  return fixture.variant === "confirmation"
    ? planConfirmationChapter(fixture.workId, fixture.decidedAt)
    : planDeclineChapter(fixture.workId, fixture.decidedAt);
}

function check(
  field: string,
  condition: boolean,
  reason: string,
): FieldResult {
  return { field, pass: condition, reason };
}

function scoreFixture(fixture: VerificationFixture): FixtureResult {
  const plan = planFor(fixture);
  const narration = plan.beats.find((b) => b.kind === fixture.variant);
  const narrationPayload =
    narration?.payload?.kind === "text" ? narration.payload : null;
  const lastBeat = plan.beats[plan.beats.length - 1];

  const checks: FieldResult[] = [
    check(
      "variant",
      plan.variant === fixture.variant,
      `plan.variant is ${plan.variant}`,
    ),
    check(
      "workId",
      plan.workId === fixture.workId,
      `plan.workId is ${plan.workId}`,
    ),
    check(
      "decidedAt",
      plan.decidedAt === fixture.decidedAt,
      `plan.decidedAt plumbed through`,
    ),
    check(
      "narration.kind",
      narration !== undefined,
      narration
        ? `found ${fixture.variant} beat`
        : `missing ${fixture.variant} beat`,
    ),
    check(
      "narration.text",
      narrationPayload !== null &&
        narrationPayload.text === OUTCOME_NARRATION[fixture.variant],
      narrationPayload
        ? `narration matches corpus`
        : `narration payload missing or wrong kind`,
    ),
    check(
      "narration.source",
      narrationPayload !== null && narrationPayload.source === "voice-corpus",
      narrationPayload
        ? `source is ${narrationPayload.source}`
        : `narration payload missing`,
    ),
    check(
      "ready.last",
      lastBeat?.kind === "ready",
      `last beat kind is ${lastBeat?.kind ?? "<none>"}`,
    ),
    check(
      "settle.before.ready",
      plan.beats.some((b) => b.kind === "settle"),
      plan.beats.some((b) => b.kind === "settle")
        ? `settle beat present`
        : `settle beat missing`,
    ),
    check(
      "totalMs.band",
      plan.totalMs >= MIN_TOTAL_MS && plan.totalMs <= MAX_TOTAL_MS,
      `totalMs=${plan.totalMs}`,
    ),
    check(
      "place.presence",
      fixture.variant === "confirmation"
        ? plan.beats.some((b) => b.kind === "place")
        : !plan.beats.some((b) => b.kind === "place"),
      fixture.variant === "confirmation"
        ? `confirmation includes place beat`
        : `decline omits place beat`,
    ),
    check(
      "monotonic.starts",
      isMonotonic(plan.beats.map((b) => b.startMs)),
      `beats in non-decreasing startMs`,
    ),
  ];

  const pass = checks.every((c) => c.pass);
  return {
    id: fixture.id,
    description: fixture.description,
    pass,
    checks,
  };
}

function isMonotonic(xs: readonly number[]): boolean {
  for (let i = 1; i < xs.length; i++) {
    if (xs[i]! < xs[i - 1]!) return false;
  }
  return true;
}

function printReport(results: readonly FixtureResult[], passed: number): void {
  const bar = "─".repeat(70);
  console.log(bar);
  console.log("  PANG — verification outcome-chapter eval");
  console.log(bar);
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    console.log(`  [${status}] ${r.id}`);
    console.log(`         ${r.description}`);
    for (const c of r.checks) {
      const mark = c.pass ? "ok " : "FAIL";
      console.log(`         [${mark}] ${c.field}: ${c.reason}`);
    }
  }
  console.log(bar);
  console.log(
    `  ${passed}/${results.length} fixtures passed` +
      ` (${((passed / Math.max(1, results.length)) * 100).toFixed(0)} %)`,
  );
  console.log(bar);
}

function main(): void {
  const results = FIXTURES.map(scoreFixture);
  const passed = results.filter((r) => r.pass).length;

  printReport(results, passed);

  // Telemetry line — matches the shape `pang.eval.intake` uses so a
  // future dashboard ingests both without translation.
  console.log(
    JSON.stringify({
      span: "pang.eval.verification",
      fixturesRun: results.length,
      fixturesPassed: passed,
      passRate: results.length === 0 ? 1 : passed / results.length,
    }),
  );

  if (passed < results.length) {
    console.error(
      `verification eval regression: ${results.length - passed} fixture(s) failed`,
    );
    process.exit(1);
  }
}

main();
