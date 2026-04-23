/**
 * PANG — retry policy tests.
 *
 * Locks the A21-shaped contract from `retry.ts`:
 *   - `RETRY_POLICY.maxRetries` and `.onTerminalFailure` are present
 *     (the gate runner's regex pattern).
 *   - `nextDelayMs(attempt, random01)` is bounded between 0 and the
 *     cap, and the mid-random (0.5) case returns exactly the base.
 *   - `shouldGiveUp(attempt)` matches the maxRetries boundary.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RETRY_POLICY, nextDelayMs, shouldGiveUp } from "./retry";

describe("RETRY_POLICY", () => {
  it("declares the A21-required fields", () => {
    assert.equal(typeof RETRY_POLICY.maxRetries, "number");
    assert.ok(RETRY_POLICY.maxRetries > 0);
    assert.ok(
      ["compensate", "null", "throw"].includes(
        RETRY_POLICY.onTerminalFailure,
      ),
    );
  });

  it("has one base delay per attempt (including the first)", () => {
    assert.equal(
      RETRY_POLICY.baseDelaysMs.length,
      RETRY_POLICY.maxRetries + 1,
    );
  });

  it("base delays are non-decreasing", () => {
    for (let i = 1; i < RETRY_POLICY.baseDelaysMs.length; i++) {
      assert.ok(
        RETRY_POLICY.baseDelaysMs[i]! >= RETRY_POLICY.baseDelaysMs[i - 1]!,
        `delay index ${i} regressed`,
      );
    }
  });
});

describe("nextDelayMs", () => {
  it("returns the base delay when random01 = 0.5 (zero jitter)", () => {
    for (let i = 0; i < RETRY_POLICY.baseDelaysMs.length; i++) {
      const d = nextDelayMs(i, 0.5);
      assert.equal(d, RETRY_POLICY.baseDelaysMs[i]);
    }
  });

  it("is within ±jitterFraction of the base", () => {
    for (let i = 0; i < RETRY_POLICY.baseDelaysMs.length; i++) {
      const base = RETRY_POLICY.baseDelaysMs[i]!;
      const range = base * RETRY_POLICY.jitterFraction;
      for (const r of [0, 0.25, 0.75, 0.99]) {
        const d = nextDelayMs(i, r);
        assert.ok(d >= Math.max(0, base - range), `r=${r} too small`);
        assert.ok(d <= base + range, `r=${r} too large`);
      }
    }
  });

  it("never exceeds maxDelayMs", () => {
    // Force the largest attempt ×the largest jitter → still capped.
    const d = nextDelayMs(10, 0.999);
    assert.ok(d <= RETRY_POLICY.maxDelayMs);
  });

  it("saturates to the last base delay for attempts past the table", () => {
    const lastBase = RETRY_POLICY.baseDelaysMs.at(-1)!;
    const d = nextDelayMs(99, 0.5);
    assert.equal(d, lastBase);
  });

  it("clamps negative attempts to zero", () => {
    assert.equal(nextDelayMs(-1, 0.5), 0);
  });

  it("never returns negative", () => {
    // Minimum random (r=0) with the smallest base (0 ms) should still
    // produce 0, not a negative.
    assert.equal(nextDelayMs(0, 0), 0);
  });
});

describe("shouldGiveUp", () => {
  it("is false at the retry limit", () => {
    assert.equal(shouldGiveUp(RETRY_POLICY.maxRetries), false);
  });
  it("is true past the retry limit", () => {
    assert.equal(shouldGiveUp(RETRY_POLICY.maxRetries + 1), true);
  });
});
