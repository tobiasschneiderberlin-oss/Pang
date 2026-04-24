/**
 * PANG — DZI pyramid-plan tests.
 *
 * Locks the math of `planPyramid`. The sharp-backed tile writer is
 * exercised by a one-off build; the plan is the part that has to be
 * right without running.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planPyramid,
  makeProceduralSource,
  SEEDS,
} from "./build-deepzoom-pyramids";

describe("planPyramid", () => {
  it("a 1x1 source has one level with one tile", () => {
    const p = planPyramid(1, 1, 254);
    assert.equal(p.maxLevel, 0);
    assert.equal(p.levels.length, 1);
    assert.equal(p.totalTiles, 1);
    assert.equal(p.levels[0]?.width, 1);
    assert.equal(p.levels[0]?.height, 1);
  });

  it("a 256x256 source spans levels 0..8 and ends at 256x256", () => {
    const p = planPyramid(256, 256, 254);
    assert.equal(p.maxLevel, 8);
    assert.equal(p.levels.length, 9);
    assert.equal(p.levels[0]?.width, 1);
    assert.equal(p.levels[8]?.width, 256);
    assert.equal(p.levels[8]?.height, 256);
  });

  it("respects a non-default tile size", () => {
    // 1024x1024 with tile=512 → level 10, top level has 4 tiles.
    const p = planPyramid(1024, 1024, 512);
    assert.equal(p.maxLevel, 10);
    const top = p.levels[10];
    assert.ok(top);
    assert.equal(top.width, 1024);
    assert.equal(top.cols, 2);
    assert.equal(top.rows, 2);
    assert.equal(top.tileCount, 4);
  });

  it("handles rectangular sources — max(w,h) drives maxLevel", () => {
    const p = planPyramid(3000, 4000, 254);
    // log2(4000) ≈ 11.97 → maxLevel 12
    assert.equal(p.maxLevel, 12);
    const top = p.levels[12];
    assert.ok(top);
    assert.equal(top.width, 3000);
    assert.equal(top.height, 4000);
  });

  it("totalTiles is the sum of per-level tile counts", () => {
    const p = planPyramid(512, 512, 254);
    const sum = p.levels.reduce((acc, l) => acc + l.tileCount, 0);
    assert.equal(p.totalTiles, sum);
  });

  it("levels are ordered 0..maxLevel ascending", () => {
    const p = planPyramid(2000, 1500, 254);
    for (let i = 0; i < p.levels.length; i++) {
      assert.equal(p.levels[i]?.level, i);
    }
  });

  it("rejects non-positive dimensions", () => {
    assert.throws(() => planPyramid(0, 10, 254));
    assert.throws(() => planPyramid(10, 0, 254));
    assert.throws(() => planPyramid(10, 10, 0));
    assert.throws(() => planPyramid(-1, 10, 254));
  });
});

describe("makeProceduralSource", () => {
  it("produces width * height * 3 bytes (RGB, no alpha)", () => {
    const seed = {
      id: "test",
      width: 64,
      height: 48,
      sizeM: [0.1, 0.08] as const,
      accent: [100, 120, 140] as const,
      base: [200, 180, 160] as const,
      label: "test",
    };
    const buf = makeProceduralSource(seed);
    assert.equal(buf.length, 64 * 48 * 3);
  });

  it("is deterministic — identical bytes on re-run", () => {
    const seed = {
      id: "determinism",
      width: 32,
      height: 32,
      sizeM: [0.1, 0.1] as const,
      accent: [0, 128, 255] as const,
      base: [255, 128, 0] as const,
      label: "test",
    };
    const a = makeProceduralSource(seed);
    const b = makeProceduralSource(seed);
    assert.ok(a.equals(b));
  });

  it("differs between distinct seed ids", () => {
    const base = {
      width: 32,
      height: 32,
      sizeM: [0.1, 0.1] as const,
      accent: [0, 128, 255] as const,
      base: [255, 128, 0] as const,
      label: "test",
    };
    const a = makeProceduralSource({ ...base, id: "one" });
    const b = makeProceduralSource({ ...base, id: "two" });
    assert.ok(!a.equals(b));
  });
});

describe("SEEDS", () => {
  it("ships three seed works with distinct ids", () => {
    assert.equal(SEEDS.length, 3);
    const ids = new Set(SEEDS.map((s) => s.id));
    assert.equal(ids.size, 3);
  });

  it("every seed has long edge >= 3000 px (honest deep-zoom territory)", () => {
    for (const seed of SEEDS) {
      assert.ok(
        Math.max(seed.width, seed.height) >= 3000,
        `${seed.id}: long edge ${Math.max(seed.width, seed.height)} < 3000`,
      );
    }
  });

  it("every seed id is slug-safe (a-z, 0-9, hyphen only)", () => {
    for (const seed of SEEDS) {
      assert.match(seed.id, /^[a-z0-9-]+$/);
    }
  });
});
