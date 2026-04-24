/**
 * A25 — unit tests.
 *
 * Drives `scanForCorpusDiscipline` against pass and fail fixtures.
 * Pass fixtures exercise direct corpus imports, passive templates,
 * and a corpus-call shape. Fail fixtures exercise the four
 * regressions A25 exists to catch:
 *
 *   - inline JSX text
 *   - inline attribute literal
 *   - template literal with prose in its quasis
 *   - local identifier (not corpus-sourced) bound to an attr
 *
 * The real agent-adjacent surface — `src/components/**` + `app/**` —
 * is also run as a smoke test: iter #12's audit sweep must leave zero
 * inline literals behind. The smoke test is permissive on `checked`
 * count because it varies with the codebase; the violation list must
 * be empty.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { scanForCorpusDiscipline } from "./a25-corpus-discipline";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

test("A25 — pass fixtures all pass the gate", () => {
  const result = scanForCorpusDiscipline({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a25/pass"],
  });
  assert.equal(
    result.ok,
    true,
    JSON.stringify(result.violations, null, 2),
  );
  // At least one attr/text was inspected — if checked is 0, the
  // walk didn't find anything and the pass is vacuous.
  assert.ok(
    result.checked > 0,
    `pass fixtures didn't exercise the walker (checked=${result.checked})`,
  );
});

test("A25 — inline JSX text fails", () => {
  const result = scanForCorpusDiscipline({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a25/fail"],
  });
  const v = result.violations.find((x) => x.file.endsWith("inline-jsx-text.tsx"));
  assert.ok(v, "expected a violation on inline-jsx-text.tsx");
  assert.match(v!.detail, /inline string .* in <children>/);
});

test("A25 — inline attribute literal fails", () => {
  const result = scanForCorpusDiscipline({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a25/fail"],
  });
  const v = result.violations.find((x) =>
    x.file.endsWith("inline-attribute.tsx"),
  );
  assert.ok(v, "expected a violation on inline-attribute.tsx");
  assert.match(v!.detail, /inline string .* in <aria-label>/);
});

test("A25 — template with prose in quasis fails", () => {
  const result = scanForCorpusDiscipline({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a25/fail"],
  });
  const v = result.violations.find((x) =>
    x.file.endsWith("template-with-prose.tsx"),
  );
  assert.ok(v, "expected a violation on template-with-prose.tsx");
  assert.match(v!.detail, /template quasi contains prose/);
});

test("A25 — local (non-corpus) identifier fails", () => {
  const result = scanForCorpusDiscipline({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a25/fail"],
  });
  const v = result.violations.find((x) =>
    x.file.endsWith("local-identifier.tsx"),
  );
  assert.ok(v, "expected a violation on local-identifier.tsx");
  assert.match(v!.detail, /does not resolve to a corpus module/);
});

// The production-surface smoke is the authoritative outcome check for
// iter #13's audit sweeps: it asserts every JsxText and user-facing
// JSX attribute under `src/components/**` and `app/**` resolves to a
// corpus module. Iter #13 closed every known inline literal; this
// smoke test now runs unconditionally in `npm run test` so a new
// literal anywhere in the agent-adjacent surface fails CI at the
// commit that introduces it, not at the next audit sweep.
//
// Opt-out: an emergency escape hatch (`A25_FULL_SMOKE_SKIP=1`) exists
// for local bisects where the surface is intentionally dirty. CI must
// never set it — the gate's whole value is that it fires loudly the
// moment a regression lands.
test("A25 — production surface passes (smoke test, audit-sweep gate)", { skip: process.env["A25_FULL_SMOKE_SKIP"] === "1" }, () => {
  const result = scanForCorpusDiscipline({
    repoRoot: REPO,
    roots: ["src/components", "app"],
  });
  assert.equal(
    result.ok,
    true,
    `A25 regressions on the real surface: ${JSON.stringify(
      result.violations.slice(0, 10),
      null,
      2,
    )}` + (result.violations.length > 10 ? `\n... +${result.violations.length - 10} more` : ""),
  );
});
