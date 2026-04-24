/**
 * PANG — OutcomeChapter pure-helper tests (iter #11).
 *
 * The component's React mount is covered by Playwright e2e. These
 * unit tests lock the pure helper — `computeOutcomeArrival` — which
 * owns three load-bearing branches from the iteration #11 brief's
 * failure-mode declaration:
 *
 *   1. *Decline variant has no emissive change.* The planner omits
 *      the `place` beat for `variant: "decline"`; the helper must
 *      return 0 for a null beat regardless of tMs or motion prefs.
 *   2. *Reduced-motion clamp (P19).* `prefers-reduced-motion: reduce`
 *      pins the factor to 1.0 on the first tick inside the place
 *      beat's window, without any curve. Before the beat starts,
 *      the factor is 0 — the emissive has not yet been authorised
 *      to rise.
 *   3. *Normal motion* follows the rate-6 `arrivalFactor` curve,
 *      rising monotonically from 0 at `startMs` toward 1 at the
 *      beat's end. Already exhaustively tested in
 *      `envelope.test.ts`; here we just re-confirm the delegation.
 *
 * The RAF clock, the beat-edge diff, the ready latch, and the
 * dismiss affordance are e2e territory — a headless React render
 * test would rebuild Playwright's scaffolding for less reward.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planConfirmationChapter,
  planDeclineChapter,
  arrivalFactor,
  findBeatByKind,
} from "@/ai/chapter";
import { computeOutcomeArrival } from "./OutcomeChapter";

describe("computeOutcomeArrival — decline variant", () => {
  it("returns 0 when placeBeat is null (decline has no place beat)", () => {
    const plan = planDeclineChapter("w-a", "2026-04-24T10:00:00.000Z");
    const placeBeat = findBeatByKind(plan, "place");
    assert.equal(placeBeat, null);
    // Sweep a range of tMs + motion settings — all zero.
    for (const tMs of [0, 1500, 5000, 14000, 20000]) {
      for (const reduced of [true, false]) {
        assert.equal(computeOutcomeArrival(null, tMs, reduced), 0);
      }
    }
  });
});

describe("computeOutcomeArrival — confirmation variant (normal motion)", () => {
  const plan = planConfirmationChapter("w-a", "2026-04-24T10:00:00.000Z");
  const placeBeat = findBeatByKind(plan, "place");

  it("has a place beat", () => {
    assert.ok(placeBeat);
  });

  it("matches arrivalFactor at the beat's boundary + interior", () => {
    // Pre-beat: 0.
    assert.equal(
      computeOutcomeArrival(placeBeat, placeBeat!.startMs - 1, false),
      arrivalFactor(placeBeat, placeBeat!.startMs - 1),
    );
    // Mid-beat: between 0 and 1, matches the curve.
    const mid = placeBeat!.startMs + placeBeat!.durationMs / 2;
    const mine = computeOutcomeArrival(placeBeat, mid, false);
    const theirs = arrivalFactor(placeBeat, mid);
    assert.equal(mine, theirs);
    assert.ok(mine > 0 && mine < 1);
    // Post-beat end: should saturate near 1 (the curve is
    // asymptotic; envelope.test.ts locks the exact shape — here we
    // just verify parity with the delegated function).
    const endSample = computeOutcomeArrival(
      placeBeat,
      placeBeat!.startMs + placeBeat!.durationMs + 10,
      false,
    );
    assert.equal(
      endSample,
      arrivalFactor(
        placeBeat,
        placeBeat!.startMs + placeBeat!.durationMs + 10,
      ),
    );
  });

  it("rises monotonically across the beat (sanity on 10 samples)", () => {
    const samples: number[] = [];
    for (let i = 0; i <= 10; i += 1) {
      const t =
        placeBeat!.startMs + (placeBeat!.durationMs * i) / 10;
      samples.push(computeOutcomeArrival(placeBeat, t, false));
    }
    for (let i = 1; i < samples.length; i += 1) {
      assert.ok(
        samples[i]! >= samples[i - 1]!,
        `non-monotonic at index ${i}: ${samples[i - 1]} → ${samples[i]}`,
      );
    }
  });
});

describe("computeOutcomeArrival — confirmation variant (reduced motion)", () => {
  const plan = planConfirmationChapter("w-a", "2026-04-24T10:00:00.000Z");
  const placeBeat = findBeatByKind(plan, "place");

  it("returns 0 before the place beat starts", () => {
    assert.equal(
      computeOutcomeArrival(placeBeat, placeBeat!.startMs - 1, true),
      0,
    );
    assert.equal(computeOutcomeArrival(placeBeat, 0, true), 0);
  });

  it("returns 1 at the first tick inside the place beat (no curve)", () => {
    assert.equal(
      computeOutcomeArrival(placeBeat, placeBeat!.startMs, true),
      1,
    );
    assert.equal(
      computeOutcomeArrival(placeBeat, placeBeat!.startMs + 1, true),
      1,
    );
  });

  it("returns 1 after the place beat ends (rest state pinned)", () => {
    const after = placeBeat!.startMs + placeBeat!.durationMs + 100;
    assert.equal(computeOutcomeArrival(placeBeat, after, true), 1);
  });

  it("never produces a value strictly between 0 and 1 (no curve)", () => {
    for (let i = 0; i <= 100; i += 1) {
      const t = (plan.totalMs * i) / 100;
      const value = computeOutcomeArrival(placeBeat, t, true);
      assert.ok(
        value === 0 || value === 1,
        `non-clamped value under reduced-motion at t=${t}: ${value}`,
      );
    }
  });
});
