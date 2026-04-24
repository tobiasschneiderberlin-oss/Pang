/**
 * A24 — unit tests.
 *
 * Drives `scanForVoiceSeedAdoption` against three pass and three fail
 * fixtures. The pass fixtures exercise every accepted shape (direct
 * identifier, canonical array, non-first-position); the fail fixtures
 * cover the three regression shapes the gate is wired to catch
 * (string literal, missing system, array-without-seed).
 *
 * A separate CaMeL fixture checks that a `system` entry whose `text`
 * identifier ends in `QUARANTINED_SYSTEM_PROMPT` is exempted — the
 * Q-LLM path must not carry the voice seed.
 *
 * The real agent surface is also run against the gate as a smoke —
 * the three P-LLM sites (intake, enrichment, correspondence) must
 * pass; the two Q-LLM sites are exempt under the CaMeL rule.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { scanForVoiceSeedAdoption } from "./a24-voice-seed-adoption";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

test("A24 — pass fixtures (all three) pass the gate", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a24/pass"],
  });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.equal(result.checked, 3);
});

test("A24 — fail fixtures (all three) report one violation each", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a24/fail"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.checked, 3);
  assert.equal(result.violations.length, 3);
  // Spot-check that each violation names its fixture file.
  const files = new Set(result.violations.map((v) => v.file));
  assert.equal(files.size, 3);
});

test("A24 — string-literal `system` produces a descriptive fail message", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a24/fail"],
  });
  const v = result.violations.find((x) =>
    x.file.endsWith("string-literal-system.ts"),
  );
  assert.ok(v, "expected a violation on string-literal-system.ts");
  assert.match(v!.detail, /StringLiteral/);
});

test("A24 — missing `system` produces a descriptive fail message", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a24/fail"],
  });
  const v = result.violations.find((x) =>
    x.file.endsWith("missing-system.ts"),
  );
  assert.ok(v, "expected a violation on missing-system.ts");
  assert.match(v!.detail, /missing `system` field/);
});

test("A24 — array-without-seed produces a descriptive fail message", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a24/fail"],
  });
  const v = result.violations.find((x) =>
    x.file.endsWith("array-without-seed.ts"),
  );
  assert.ok(v, "expected a violation on array-without-seed.ts");
  assert.match(v!.detail, /no entry whose `text` resolves/);
});

test("A24 — quarantined `system` is exempt (CaMeL Q-LLM path)", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["tests/fixtures/voice-v1/a24/quarantined"],
  });
  assert.equal(
    result.ok,
    true,
    JSON.stringify(result.violations, null, 2),
  );
  // Quarantined sites are skipped entirely — not counted as checked.
  assert.equal(result.checked, 0);
});

test("A24 — production agent surface passes (smoke test)", () => {
  const result = scanForVoiceSeedAdoption({
    repoRoot: REPO,
    roots: ["src/ai/agents"],
  });
  assert.equal(
    result.ok,
    true,
    `A24 regressions on the real agent surface: ${JSON.stringify(result.violations, null, 2)}`,
  );
  // Three P-LLM sites: intake, enrichment, correspondence. Two
  // Q-LLM sites (intake-quarantine, enrichment-quarantine) are
  // CaMeL-exempt and do not count toward `checked`.
  assert.ok(
    result.checked >= 3,
    `expected at least 3 P-LLM agent call sites, got ${result.checked}`,
  );
});
