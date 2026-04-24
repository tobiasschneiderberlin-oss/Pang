/**
 * rebuild-voice-prompt — unit tests.
 *
 * End-to-end: run the script with --stdout and assert the output
 * contains every canonical sample verbatim, the BEGIN/END markers,
 * and the stable prompt body. The script is called out-of-process
 * because it is a CI-invoked binary — testing it in-process would
 * miss flag-parsing regressions and the shebang-line concerns.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_SAMPLE_ADDRESSES,
  resolveCanonical,
} from "../src/ai/prompts/strings";

const HERE = dirname(fileURLToPath(import.meta.url));

function runStdout(): string {
  // Run from the package root (scripts/ is a subdir). `tsx` compiles
  // the script in-process and prints on stdout. A non-zero exit is
  // a test failure by itself.
  const pkgRoot = join(HERE, "..");
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      join(pkgRoot, "scripts/rebuild-voice-prompt.ts"),
      "--stdout",
    ],
    { cwd: pkgRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `rebuild-voice-prompt --stdout exited ${result.status}: ${result.stderr}`,
    );
  }
  return result.stdout;
}

test("rebuild --stdout emits a non-empty file", () => {
  const out = runStdout();
  assert.ok(out.length > 0);
  // The stable prompt opens with the same sentence on every run.
  assert.match(out, /You are writing strings that will appear inside PANG/);
});

test("every canonical sample address and its value appear in the output", () => {
  const out = runStdout();
  for (const address of CANONICAL_SAMPLE_ADDRESSES) {
    assert.ok(
      out.includes(address),
      `rebuild output missing canonical address ${address}`,
    );
    const value = resolveCanonical(address);
    assert.ok(
      out.includes(JSON.stringify(value)),
      `rebuild output missing value for ${address}: ${value}`,
    );
  }
});

test("BEGIN/END markers are present exactly once", () => {
  const out = runStdout();
  const begins = out.match(/EXAMPLES:BEGIN/g) ?? [];
  const ends = out.match(/EXAMPLES:END/g) ?? [];
  assert.equal(begins.length, 1, "expected exactly one BEGIN marker");
  assert.equal(ends.length, 1, "expected exactly one END marker");
});

test("output is byte-stable across runs", () => {
  // Any non-determinism (timestamps, random ordering) would break
  // CI's `check:voice-prompt` check which diffs committed vs rebuild.
  const a = runStdout();
  const b = runStdout();
  assert.equal(a, b, "rebuild output must be deterministic");
});
