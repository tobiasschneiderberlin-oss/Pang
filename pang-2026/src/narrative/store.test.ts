/**
 * PANG — Narrative monthly marker store tests (iter #14).
 *
 * Primitive 51 exercise: the store is the idempotency boundary.
 * `now: Date` is injected on every call, so "faked clock" here is
 * literally "pass a controlled Date" — no global time mocking
 * needed, and no Vitest dependency.
 *
 * The store root is redirected to a tmpdir via the
 * `PANG_NARRATIVE_STORE_DIR` env hook so tests cannot leak into
 * the repo's real `.pang/` folder (primitive 52: the stand-in
 * mirrors the Supabase row shape; tests must not pollute shared
 * state).
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  NarrativeStoreError,
  clearCollector,
  getCurrentMonth,
  getPriorMonthHash,
  hasCurrentMonth,
  putCurrentMonth,
  resolveMarkerPath,
  storeRoot,
} from "./store";
import type { NarrativeMarker } from "./schema";

// ---- tmpdir bootstrap -------------------------------------------

let TMP_ROOT: string;
const PRIOR_ENV = process.env["PANG_NARRATIVE_STORE_DIR"];

before(() => {
  TMP_ROOT = mkdtempSync(path.join(os.tmpdir(), "pang-narrative-"));
  process.env["PANG_NARRATIVE_STORE_DIR"] = TMP_ROOT;
});

after(() => {
  if (PRIOR_ENV === undefined) delete process.env["PANG_NARRATIVE_STORE_DIR"];
  else process.env["PANG_NARRATIVE_STORE_DIR"] = PRIOR_ENV;
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(async () => {
  // Every test starts from a clean tree — no cross-test leakage.
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(TMP_ROOT, { recursive: true });
});

// ---- fixtures ----------------------------------------------------

const COLLECTOR = "collector-abc";
const APRIL = new Date(Date.UTC(2026, 3 /* April */, 24, 12, 0, 0));
const MARCH = new Date(Date.UTC(2026, 2 /* March */, 15, 9, 0, 0));
const FEB = new Date(Date.UTC(2026, 1 /* Feb */, 10, 9, 0, 0));

function paragraphMarker(
  month: string,
  collectionHash: string,
  paragraph: string,
): NarrativeMarker {
  return {
    kind: "paragraph",
    collectorId: COLLECTOR,
    month,
    collectionHash,
    paragraph,
    decidedAt: new Date(Date.UTC(2026, 3, 24, 12, 0, 0)).toISOString(),
  };
}

function skippedMarker(
  month: string,
  collectionHash: string,
): NarrativeMarker {
  return {
    kind: "skipped",
    collectorId: COLLECTOR,
    month,
    collectionHash,
    reason: "thin-provenance",
    decidedAt: new Date(Date.UTC(2026, 3, 24, 12, 0, 0)).toISOString(),
  };
}

const NOMINAL_PARAGRAPH =
  "Four Hojgaards sit on the west wall, the largest acquired in 2019. Next to them is a single Taeuber-Arp from 1935, the only work on paper in this collection. The provenance ledger for both names continues to grow year on year.";

// ---- storeRoot + path resolution --------------------------------

describe("storeRoot", () => {
  it("honours the PANG_NARRATIVE_STORE_DIR env override", () => {
    assert.equal(storeRoot(), TMP_ROOT);
  });
});

describe("resolveMarkerPath", () => {
  it("composes <root>/<collector>/<YYYY-MM>.json", () => {
    const p = resolveMarkerPath(COLLECTOR, "2026-04");
    assert.equal(p, path.join(TMP_ROOT, COLLECTOR, "2026-04.json"));
  });

  it("rejects a collectorId with a path separator", () => {
    assert.throws(
      () => resolveMarkerPath("../escape", "2026-04"),
      (err: Error) => err instanceof NarrativeStoreError,
    );
  });

  it("rejects a collectorId with a null byte", () => {
    assert.throws(
      () => resolveMarkerPath("bad\0id", "2026-04"),
      (err: Error) => err instanceof NarrativeStoreError,
    );
  });

  it("rejects a malformed month", () => {
    assert.throws(
      () => resolveMarkerPath(COLLECTOR, "april-2026"),
      (err: Error) => err instanceof NarrativeStoreError,
    );
  });
});

// ---- hasCurrentMonth / getCurrentMonth --------------------------

describe("getCurrentMonth / hasCurrentMonth", () => {
  it("returns null when no marker exists", async () => {
    assert.equal(await getCurrentMonth(COLLECTOR, APRIL), null);
    assert.equal(await hasCurrentMonth(COLLECTOR, APRIL), false);
  });

  it("round-trips a paragraph marker", async () => {
    const marker = paragraphMarker("2026-04", "hash-april-1234", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, marker, APRIL);
    const read = await getCurrentMonth(COLLECTOR, APRIL);
    assert.deepEqual(read, marker);
    assert.equal(await hasCurrentMonth(COLLECTOR, APRIL), true);
  });

  it("round-trips a skipped marker", async () => {
    const marker = skippedMarker("2026-04", "hash-april-skip");
    await putCurrentMonth(COLLECTOR, marker, APRIL);
    const read = await getCurrentMonth(COLLECTOR, APRIL);
    assert.deepEqual(read, marker);
  });

  it("scopes reads by month — a March marker is invisible in April", async () => {
    const march = paragraphMarker("2026-03", "hash-march", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, march, MARCH);
    assert.equal(await hasCurrentMonth(COLLECTOR, APRIL), false);
    assert.equal(await hasCurrentMonth(COLLECTOR, MARCH), true);
  });
});

// ---- putCurrentMonth discipline ---------------------------------

describe("putCurrentMonth", () => {
  it("rejects a marker whose month disagrees with `now`", async () => {
    const mismatched = paragraphMarker(
      "2026-03", // marker says March
      "hash-x",
      NOMINAL_PARAGRAPH,
    );
    await assert.rejects(
      () => putCurrentMonth(COLLECTOR, mismatched, APRIL /* but now is April */),
      (err: Error) => err instanceof NarrativeStoreError,
    );
  });

  it("rejects a marker whose collectorId disagrees", async () => {
    const mismatched = paragraphMarker("2026-04", "hash-x", NOMINAL_PARAGRAPH);
    (mismatched as { collectorId: string }).collectorId = "someone-else";
    await assert.rejects(
      () => putCurrentMonth(COLLECTOR, mismatched, APRIL),
      (err: Error) => err instanceof NarrativeStoreError,
    );
  });

  it("is idempotent: two ticks in the same month produce one marker", async () => {
    // Primitive 51: the marker is the idempotency boundary. A caller
    // that checked `hasCurrentMonth` first will short-circuit on the
    // second tick; the store itself is last-write-wins, so two puts
    // in the same month don't duplicate.
    const first = paragraphMarker("2026-04", "hash-first-001", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, first, APRIL);

    const dir = path.join(TMP_ROOT, COLLECTOR);
    const afterFirst = await fs.readdir(dir);
    assert.deepEqual(afterFirst.sort(), ["2026-04.json"]);

    // A second tick in the same calendar month. The route is supposed
    // to short-circuit, but if it does call through, the filesystem
    // still holds one entry for that month.
    const second = paragraphMarker(
      "2026-04",
      "hash-second-002",
      NOMINAL_PARAGRAPH.replace("Four", "Five"),
    );
    await putCurrentMonth(COLLECTOR, second, APRIL);

    const afterSecond = await fs.readdir(dir);
    assert.deepEqual(afterSecond.sort(), ["2026-04.json"]);
    const read = await getCurrentMonth(COLLECTOR, APRIL);
    assert.equal(read?.kind, "paragraph");
    if (read?.kind === "paragraph") {
      // last-write wins; confirms the atomic rename landed.
      assert.equal(read.collectionHash, "hash-second-002");
    }
  });

  it("commits atomically — no tmp file remains after a successful write", async () => {
    const marker = paragraphMarker("2026-04", "hash-atomic", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, marker, APRIL);
    const dir = path.join(TMP_ROOT, COLLECTOR);
    const files = await fs.readdir(dir);
    // Only the settled file; no `.tmp-*` siblings.
    assert.deepEqual(
      files.filter((f) => f.includes(".tmp-")),
      [],
    );
    assert.deepEqual(files.sort(), ["2026-04.json"]);
  });
});

// ---- getPriorMonthHash ------------------------------------------

describe("getPriorMonthHash", () => {
  it("returns null when the collector dir does not exist", async () => {
    assert.equal(await getPriorMonthHash(COLLECTOR, APRIL), null);
  });

  it("returns null when only the current month is on disk", async () => {
    const april = paragraphMarker("2026-04", "hash-april", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, april, APRIL);
    assert.equal(await getPriorMonthHash(COLLECTOR, APRIL), null);
  });

  it("returns the most-recent prior month's collectionHash", async () => {
    const feb = paragraphMarker("2026-02", "hash-feb", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, feb, FEB);
    const march = paragraphMarker("2026-03", "hash-march", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, march, MARCH);

    // now = April. Prior is March.
    assert.equal(await getPriorMonthHash(COLLECTOR, APRIL), "hash-march");
  });

  it("treats a skipped marker the same as a paragraph marker for prior-hash", async () => {
    const march = skippedMarker("2026-03", "hash-march-skipped");
    await putCurrentMonth(COLLECTOR, march, MARCH);
    assert.equal(await getPriorMonthHash(COLLECTOR, APRIL), "hash-march-skipped");
  });

  it("ignores the current month even if markers for both months exist", async () => {
    const march = paragraphMarker("2026-03", "hash-march", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, march, MARCH);
    const april = paragraphMarker("2026-04", "hash-april", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, april, APRIL);
    assert.equal(await getPriorMonthHash(COLLECTOR, APRIL), "hash-march");
  });
});

// ---- clearCollector ---------------------------------------------

describe("clearCollector", () => {
  it("removes every marker for a collector", async () => {
    const feb = paragraphMarker("2026-02", "hash-feb", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, feb, FEB);
    const march = paragraphMarker("2026-03", "hash-march", NOMINAL_PARAGRAPH);
    await putCurrentMonth(COLLECTOR, march, MARCH);

    await clearCollector(COLLECTOR);

    assert.equal(await getCurrentMonth(COLLECTOR, MARCH), null);
    assert.equal(await getCurrentMonth(COLLECTOR, FEB), null);
    assert.equal(await getPriorMonthHash(COLLECTOR, APRIL), null);
  });

  it("is a no-op when the collector dir does not exist", async () => {
    await clearCollector("never-existed");
    // The assertion is that we didn't throw.
    assert.ok(true);
  });
});
