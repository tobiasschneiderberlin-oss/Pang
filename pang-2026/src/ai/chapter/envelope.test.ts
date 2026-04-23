/**
 * PANG — envelope unit tests.
 *
 * The envelopes are pure functions of `(beat, tMs)`. The invariants
 * that matter:
 *
 *   - Zero strictly outside the beat window.
 *   - Rising phase is monotonically non-decreasing.
 *   - Hold phase sits at exactly 1.
 *   - Falling phase is monotonically non-increasing.
 *   - Clamped in `[0, 1]` at every sample.
 *
 * Rate-6 curve (matches `src/room/animator.ts`): `alpha = 1 - exp(-6 * dt)`
 * where `dt` is in seconds. At `dt = fadeInMs / 1000`, the envelope
 * should have ~99.75% converged (6 * 900ms = 5.4 time-constants).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arrivalFactor,
  beatEnvelope,
  beatProgress,
  overlayOpacity,
} from "./envelope";
import type { Beat } from "./types";

function baseBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    id: "t",
    kind: "narration",
    startMs: 1000,
    durationMs: 5000,
    fadeInMs: 900,
    fadeOutMs: 1200,
    payload: { kind: "text", text: "…", source: "ai" },
    ...overrides,
  };
}

// ---- beatEnvelope -------------------------------------------------

describe("beatEnvelope — outside the beat window", () => {
  it("is exactly zero before startMs", () => {
    const b = baseBeat();
    assert.equal(beatEnvelope(b, 0), 0);
    assert.equal(beatEnvelope(b, 999), 0);
    assert.equal(beatEnvelope(b, -500), 0);
  });

  it("is exactly zero at or after endMs", () => {
    const b = baseBeat();
    const endMs = b.startMs + b.durationMs; // 6000
    assert.equal(beatEnvelope(b, endMs), 0);
    assert.equal(beatEnvelope(b, endMs + 1), 0);
    assert.equal(beatEnvelope(b, 1_000_000), 0);
  });
});

describe("beatEnvelope — rising phase", () => {
  it("is zero at startMs (t=0 → alpha=0)", () => {
    const b = baseBeat();
    assert.equal(beatEnvelope(b, b.startMs), 0);
  });

  it("is non-decreasing across rising phase", () => {
    const b = baseBeat();
    let prev = -1;
    for (let t = b.startMs; t < b.startMs + b.fadeInMs; t += 50) {
      const v = beatEnvelope(b, t);
      assert.ok(v >= prev, `non-monotonic at ${t}: ${v} < ${prev}`);
      prev = v;
    }
  });

  it("matches the rate-6 curve analytically at mid-rise", () => {
    const b = baseBeat();
    const t = b.startMs + 300; // 300ms into rise
    const dt = 0.3;
    const expected = 1 - Math.exp(-6 * dt);
    const actual = beatEnvelope(b, t);
    assert.ok(
      Math.abs(actual - expected) < 1e-9,
      `envelope ${actual} vs expected ${expected}`,
    );
  });
});

describe("beatEnvelope — hold phase", () => {
  it("is exactly 1 in the hold window", () => {
    const b = baseBeat();
    const holdStart = b.startMs + b.fadeInMs; // 1900
    const holdEnd = b.startMs + b.durationMs - b.fadeOutMs; // 4800
    for (let t = holdStart; t < holdEnd; t += 100) {
      assert.equal(beatEnvelope(b, t), 1, `hold broke at ${t}`);
    }
  });
});

describe("beatEnvelope — falling phase", () => {
  it("is non-increasing across falling phase", () => {
    const b = baseBeat();
    const fallingStart = b.startMs + b.durationMs - b.fadeOutMs; // 4800
    const endMs = b.startMs + b.durationMs;
    let prev = Number.POSITIVE_INFINITY;
    for (let t = fallingStart; t < endMs; t += 50) {
      const v = beatEnvelope(b, t);
      assert.ok(v <= prev + 1e-9, `non-monotonic at ${t}: ${v} > ${prev}`);
      prev = v;
    }
  });

  it("approaches zero as t → endMs", () => {
    const b = baseBeat();
    const near = b.startMs + b.durationMs - 1; // 1ms before end
    const v = beatEnvelope(b, near);
    assert.ok(v < 0.01, `envelope at end-1ms should be ~0, got ${v}`);
  });

  it("matches rate-6 decay analytically at mid-fall", () => {
    const b = baseBeat();
    // 600ms before the end — dt = 0.6s
    const t = b.startMs + b.durationMs - 600;
    const dt = 0.6;
    const expected = 1 - Math.exp(-6 * dt);
    const actual = beatEnvelope(b, t);
    assert.ok(
      Math.abs(actual - expected) < 1e-9,
      `envelope ${actual} vs expected ${expected}`,
    );
  });
});

describe("beatEnvelope — clamp safety", () => {
  it("always returns a value in [0, 1]", () => {
    const b = baseBeat();
    for (let t = -1000; t < 10000; t += 37) {
      const v = beatEnvelope(b, t);
      assert.ok(v >= 0 && v <= 1, `envelope out of range at ${t}: ${v}`);
    }
  });

  it("handles zero fadeOut (ready-beat shape)", () => {
    const b = baseBeat({ fadeOutMs: 0, durationMs: 3000, fadeInMs: 500 });
    // No falling phase at all — value is 1 everywhere after rise.
    const holdEnd = b.startMs + b.durationMs - 1;
    assert.equal(beatEnvelope(b, holdEnd), 1);
  });
});

// ---- beatProgress -------------------------------------------------

describe("beatProgress", () => {
  it("is 0 at or before startMs", () => {
    const b = baseBeat();
    assert.equal(beatProgress(b, b.startMs), 0);
    assert.equal(beatProgress(b, b.startMs - 500), 0);
  });

  it("is 1 at or after endMs", () => {
    const b = baseBeat();
    assert.equal(beatProgress(b, b.startMs + b.durationMs), 1);
    assert.equal(beatProgress(b, b.startMs + b.durationMs + 1000), 1);
  });

  it("is exactly 0.5 at the midpoint", () => {
    const b = baseBeat();
    const mid = b.startMs + b.durationMs / 2;
    assert.equal(beatProgress(b, mid), 0.5);
  });

  it("is monotonically non-decreasing across the beat", () => {
    const b = baseBeat();
    let prev = -1;
    for (let t = b.startMs - 100; t <= b.startMs + b.durationMs + 100; t += 50) {
      const v = beatProgress(b, t);
      assert.ok(v >= prev - 1e-9, `progress non-monotonic at ${t}`);
      prev = v;
    }
  });
});

// ---- arrivalFactor -------------------------------------------------

describe("arrivalFactor", () => {
  const place: Beat = baseBeat({
    id: "place",
    kind: "place",
    startMs: 2800,
    durationMs: 3000,
    fadeInMs: 900,
    fadeOutMs: 1200,
    payload: { kind: "pose" },
  });

  it("returns 1 when there is no place beat (immediate placement)", () => {
    assert.equal(arrivalFactor(null, 0), 1);
    assert.equal(arrivalFactor(null, 999_999), 1);
  });

  it("is 0 before place.startMs", () => {
    assert.equal(arrivalFactor(place, 0), 0);
    assert.equal(arrivalFactor(place, 2799), 0);
  });

  it("is 0 at place.startMs (t=0 → alpha=0)", () => {
    assert.equal(arrivalFactor(place, place.startMs), 0);
  });

  it("climbs monotonically after place.startMs", () => {
    let prev = -1;
    for (let t = place.startMs; t < place.startMs + 2000; t += 50) {
      const v = arrivalFactor(place, t);
      assert.ok(v >= prev, `arrival non-monotonic at ${t}`);
      prev = v;
    }
  });

  it("matches rate-6 analytically", () => {
    const t = place.startMs + 500;
    const dt = 0.5;
    const expected = 1 - Math.exp(-6 * dt);
    const actual = arrivalFactor(place, t);
    assert.ok(
      Math.abs(actual - expected) < 1e-9,
      `arrival ${actual} vs expected ${expected}`,
    );
  });

  it("stays clamped in [0, 1]", () => {
    for (let t = 0; t < 10_000; t += 73) {
      const v = arrivalFactor(place, t);
      assert.ok(v >= 0 && v <= 1, `arrival out of range at ${t}: ${v}`);
    }
  });
});

// ---- overlayOpacity ------------------------------------------------

describe("overlayOpacity", () => {
  const place: Beat = baseBeat({
    id: "place",
    kind: "place",
    startMs: 2800,
    durationMs: 3000,
    fadeInMs: 900,
    fadeOutMs: 1200,
    payload: { kind: "pose" },
  });

  it("is 0 when there is no place beat (nothing to overlay)", () => {
    assert.equal(overlayOpacity(null, 0), 0);
    assert.equal(overlayOpacity(null, 5000), 0);
  });

  it("is 1 before place.startMs (overlay fully visible)", () => {
    assert.equal(overlayOpacity(place, 0), 1);
    assert.equal(overlayOpacity(place, 2799), 1);
  });

  it("is 1 at place.startMs (t=0 → exp(0)=1)", () => {
    assert.equal(overlayOpacity(place, place.startMs), 1);
  });

  it("decays monotonically after place.startMs", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let t = place.startMs; t < place.startMs + 2000; t += 50) {
      const v = overlayOpacity(place, t);
      assert.ok(v <= prev + 1e-9, `overlay non-monotonic at ${t}`);
      prev = v;
    }
  });

  it("matches rate-6 decay analytically", () => {
    const t = place.startMs + 500;
    const dt = 0.5;
    const expected = Math.exp(-6 * dt);
    const actual = overlayOpacity(place, t);
    assert.ok(
      Math.abs(actual - expected) < 1e-9,
      `overlay ${actual} vs expected ${expected}`,
    );
  });

  it("has dropped below 1% within a second of place start", () => {
    // 6 time-constants ≈ 0.25% of original.
    const t = place.startMs + 1000;
    assert.ok(overlayOpacity(place, t) < 0.01);
  });

  it("stays clamped in [0, 1]", () => {
    for (let t = 0; t < 10_000; t += 73) {
      const v = overlayOpacity(place, t);
      assert.ok(v >= 0 && v <= 1, `overlay out of range at ${t}: ${v}`);
    }
  });

  it("arrivalFactor + overlayOpacity sum to 1 (conservation)", () => {
    // The place beat is the moment of exchange — the still goes out
    // as the work comes in. Because both are the same rate-6 curve
    // running in opposite directions against the same time origin,
    // they sum to exactly 1 everywhere after place.startMs.
    for (let t = place.startMs; t < place.startMs + 2000; t += 50) {
      const sum = arrivalFactor(place, t) + overlayOpacity(place, t);
      assert.ok(
        Math.abs(sum - 1) < 1e-9,
        `conservation broken at ${t}: sum=${sum}`,
      );
    }
  });
});
