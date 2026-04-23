/**
 * PANG — enrichment cache tests.
 *
 * Locks the pure core of the cache module: index projection, parse
 * round-trip, and the reconcile planner. The OPFS-wrapping read /
 * write / invalidate paths depend on `navigator.storage`; they are
 * exercised end-to-end under Playwright (see iteration #4's pattern
 * for the verification outbox).
 *
 * Each case here is a regression guard: a silent drift in the durable
 * shape or in the reconcile matrix would turn "the timeline is wrong"
 * into an investigation. These tests turn it into a red test.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseIndex,
  parseIndexEntry,
  planReconcile,
  projectIndexEntry,
  serialiseIndex,
  type EnrichmentIndexEntry,
} from "./cache";
import type { EnrichmentOutput } from "./schema";

const sampleHash = "a".repeat(64);

const sampleOutput: EnrichmentOutput = {
  version: "v1",
  workId: "w-1",
  basedOnWorkHash: sampleHash,
  timeline: [],
  artistContext: {
    nationality: "German",
    birthYear: 1970,
    bioMuji: "Trained in Düsseldorf. Works in oil.",
    bannedVocabularyDetected: false,
  },
  generatedAt: "2026-04-23T10:00:00.000Z",
};

describe("projectIndexEntry", () => {
  it("keeps only the three durable fields", () => {
    const entry = projectIndexEntry(sampleOutput);
    assert.equal(entry.workId, "w-1");
    assert.equal(entry.basedOnWorkHash, sampleHash);
    assert.equal(entry.generatedAt, "2026-04-23T10:00:00.000Z");
    assert.equal(Object.keys(entry).length, 3);
  });
});

describe("parseIndexEntry", () => {
  it("parses a well-formed row", () => {
    const parsed = parseIndexEntry({
      workId: "w-1",
      basedOnWorkHash: sampleHash,
      generatedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.notEqual(parsed, null);
    assert.equal(parsed?.workId, "w-1");
  });

  it("rejects a non-hex hash", () => {
    const parsed = parseIndexEntry({
      workId: "w-1",
      basedOnWorkHash: "not-a-hash",
      generatedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(parsed, null);
  });

  it("rejects a too-short hash", () => {
    const parsed = parseIndexEntry({
      workId: "w-1",
      basedOnWorkHash: "a".repeat(63),
      generatedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(parsed, null);
  });

  it("rejects a missing workId", () => {
    const parsed = parseIndexEntry({
      basedOnWorkHash: sampleHash,
      generatedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(parsed, null);
  });

  it("rejects null + primitives defensively", () => {
    assert.equal(parseIndexEntry(null), null);
    assert.equal(parseIndexEntry(42), null);
    assert.equal(parseIndexEntry("x"), null);
  });
});

describe("serialiseIndex / parseIndex", () => {
  it("round-trips an index", () => {
    const entries: EnrichmentIndexEntry[] = [
      {
        workId: "w-1",
        basedOnWorkHash: sampleHash,
        generatedAt: "2026-04-23T10:00:00.000Z",
      },
      {
        workId: "w-2",
        basedOnWorkHash: "b".repeat(64),
        generatedAt: "2026-04-23T11:00:00.000Z",
      },
    ];
    const text = serialiseIndex(entries);
    const back = parseIndex(text);
    assert.equal(back.length, 2);
    assert.equal(back[0]!.workId, "w-1");
    assert.equal(back[1]!.workId, "w-2");
  });

  it("drops malformed rows and keeps the good ones", () => {
    const text = JSON.stringify([
      {
        workId: "w-1",
        basedOnWorkHash: sampleHash,
        generatedAt: "2026-04-23T10:00:00.000Z",
      },
      { workId: "w-2", basedOnWorkHash: "oops", generatedAt: "2026-04-23T11:00:00.000Z" },
      "not-an-object",
    ]);
    const parsed = parseIndex(text);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.workId, "w-1");
  });

  it("returns [] on malformed JSON", () => {
    assert.deepEqual(parseIndex("not json"), []);
  });

  it("returns [] on non-array top-level", () => {
    assert.deepEqual(parseIndex(JSON.stringify({ not: "an array" })), []);
  });
});

describe("planReconcile — hash-based drift shapes", () => {
  const indexEntry = (
    workId: string,
    hash: string,
  ): EnrichmentIndexEntry => ({
    workId,
    basedOnWorkHash: hash,
    generatedAt: "2026-04-23T10:00:00.000Z",
  });

  it("is a no-op when every entry's hash matches the current store", () => {
    const index = [indexEntry("w-1", sampleHash)];
    const hashes = new Map([["w-1", sampleHash]]);
    const plan = planReconcile(index, hashes);
    assert.equal(plan.staleWorkIds.length, 0);
    assert.equal(plan.orphanWorkIds.length, 0);
  });

  it("marks an entry stale when the current hash differs", () => {
    const index = [indexEntry("w-1", sampleHash)];
    const hashes = new Map([["w-1", "b".repeat(64)]]);
    const plan = planReconcile(index, hashes);
    assert.deepEqual(plan.staleWorkIds, ["w-1"]);
    assert.equal(plan.orphanWorkIds.length, 0);
  });

  it("marks an entry orphan when the work no longer exists", () => {
    const index = [indexEntry("w-1", sampleHash)];
    const hashes = new Map<string, string>();
    const plan = planReconcile(index, hashes);
    assert.deepEqual(plan.orphanWorkIds, ["w-1"]);
    assert.equal(plan.staleWorkIds.length, 0);
  });

  it("handles a mix of stable, stale, and orphan entries", () => {
    const index = [
      indexEntry("w-stable", "1".repeat(64)),
      indexEntry("w-stale", "2".repeat(64)),
      indexEntry("w-orphan", "3".repeat(64)),
    ];
    const hashes = new Map([
      ["w-stable", "1".repeat(64)],
      ["w-stale", "x".repeat(64)],
    ]);
    const plan = planReconcile(index, hashes);
    assert.deepEqual(plan.staleWorkIds, ["w-stale"]);
    assert.deepEqual(plan.orphanWorkIds, ["w-orphan"]);
  });

  it("is stable on an empty index (no-op)", () => {
    const plan = planReconcile([], new Map());
    assert.equal(plan.staleWorkIds.length, 0);
    assert.equal(plan.orphanWorkIds.length, 0);
  });
});
