/**
 * PANG — check-transforms scanner tests.
 *
 * Locks the three things P24d's CI gate depends on:
 *
 *   1. A CSS `transform: scale(...)` literal in an otherwise-legal
 *      source file is caught and reported with path + line + match.
 *   2. A Tailwind `scale-*` utility (including `scale-x-*`,
 *      `scale-y-*`, and arbitrary values) is caught.
 *   3. Matrix transforms, variables named `scaleFactor`, and
 *      scale-family mentions inside JS comments do NOT trip the
 *      scanner — those are the documented allow-list (see
 *      `check-transforms.ts` header).
 *
 * Fixtures live under `scripts/__fixtures__/check-transforms/`. The
 * test passes fixture paths as custom `roots` so the scan is
 * hermetic — nothing from real `src/` or `app/` can leak in or out.
 *
 * Also covers the `exempt` escape hatch: passing the violating dir
 * as exempt must produce ok=true. This is the same mechanism that
 * exempts `src/components/deep-zoom/` in production.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanForTransformScale } from "./check-transforms";

const VIOLATING = "scripts/__fixtures__/check-transforms/violating";
const CLEAN = "scripts/__fixtures__/check-transforms/clean";

describe("scanForTransformScale — violating fixtures", () => {
  it("flags transform: scale(2) in a style literal", async () => {
    const result = await scanForTransformScale({ roots: [VIOLATING] });
    assert.equal(result.ok, false);
    assert.ok(result.scanned >= 2, `scanned at least the two fixtures, got ${result.scanned}`);
    const cssHit = result.violations.find((v) =>
      v.path.endsWith("css-transform.tsx"),
    );
    assert.ok(cssHit, "expected a violation in css-transform.tsx");
    assert.match(cssHit!.match, /transform\s*[:=]\s*['"`].*\bscale\(/);
    assert.ok(cssHit!.line > 0, "line number must be 1-indexed");
  });

  it("flags Tailwind scale-125 in a className", async () => {
    const result = await scanForTransformScale({ roots: [VIOLATING] });
    const twHit = result.violations.find((v) =>
      v.path.endsWith("tailwind-scale.tsx"),
    );
    assert.ok(twHit, "expected a violation in tailwind-scale.tsx");
    assert.match(twHit!.match, /\bscale-125\b/);
  });
});

describe("scanForTransformScale — clean fixtures", () => {
  it("accepts matrix(...) transforms", async () => {
    const result = await scanForTransformScale({ roots: [CLEAN] });
    assert.equal(
      result.ok,
      true,
      `clean fixtures should pass, got violations: ${JSON.stringify(result.violations)}`,
    );
    assert.ok(result.scanned >= 1, "at least one file must have been scanned");
  });

  it("does not trip on scale-family mentions inside JS comments", async () => {
    // `allowed.tsx` deliberately includes a line comment and a block
    // comment that each mention `transform: scale(2)` / `scale-125`.
    // If the comment-stripping regex regresses, these would produce
    // violations. Asserting ok=true on the clean fixture locks that.
    const result = await scanForTransformScale({ roots: [CLEAN] });
    assert.equal(result.violations.length, 0);
  });

  it("does not trip on variables named scaleFactor", async () => {
    // Same clean fixture declares `const scaleFactor = 2;` — the
    // Tailwind regex requires a class-list boundary, so this must
    // not match.
    const result = await scanForTransformScale({ roots: [CLEAN] });
    assert.equal(result.violations.length, 0);
  });
});

describe("scanForTransformScale — exempt escape hatch", () => {
  it("ok=true when the violating dir is exempted", async () => {
    const result = await scanForTransformScale({
      roots: [VIOLATING],
      exempt: [VIOLATING],
    });
    assert.equal(result.ok, true);
    assert.equal(result.violations.length, 0);
    // The exempt prefix check fires before readdir, so `scanned`
    // should be 0 — confirms no files were read.
    assert.equal(result.scanned, 0);
  });
});

describe("scanForTransformScale — maxViolations cap", () => {
  it("stops collecting after maxViolations is reached", async () => {
    const result = await scanForTransformScale({
      roots: [VIOLATING],
      maxViolations: 1,
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
  });
});
