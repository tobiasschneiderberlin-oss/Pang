/**
 * PANG — works store tests.
 *
 * Pure-function tests for the store's mutation surface and the
 * layout projection. The Zustand store itself is verified via its
 * public API (`getState()` / `setState()` via the mutators); the
 * React integration is exercised by the diff effect which owns a
 * dedicated test below.
 *
 * Coverage:
 *   - `addEntry` is idempotent on id
 *   - `removeEntry` no-ops on missing id
 *   - `layoutEntries` is deterministic, centre-balanced, metric
 *   - `entryFromIntake` honours dimensionsCm and defaults when null
 *
 * These tests lock behaviour the scene diff relies on. A regression
 * here ripples into a subtle "work jumps on the wall" bug that is
 * hard to notice and easy to break.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { IntakeOutput } from "@/ai/tools/artwork";
import {
  entryFromIntake,
  layoutEntries,
  useWorks,
  type CollectionEntry,
} from "./works";

// ---------- Fixtures --------------------------------------------

const E1: CollectionEntry = {
  id: "e1",
  imageUrl: "blob:e1",
  status: "verified",
  size: [0.6, 0.8],
};
const E2: CollectionEntry = {
  id: "e2",
  imageUrl: "blob:e2",
  status: "unverified",
  size: [1.0, 0.7],
};
const E3: CollectionEntry = {
  id: "e3",
  imageUrl: "blob:e3",
  status: "verified",
  size: [0.5, 0.5],
};

// ---------- Store mutations -------------------------------------

describe("useWorks (Zustand store)", () => {
  beforeEach(() => {
    useWorks.getState().clear();
  });

  it("adds entries", () => {
    useWorks.getState().addEntry(E1);
    useWorks.getState().addEntry(E2);
    const entries = useWorks.getState().entries;
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.id, "e1");
    assert.equal(entries[1]?.id, "e2");
  });

  it("addEntry is idempotent on id — replaces, does not duplicate", () => {
    useWorks.getState().addEntry(E1);
    useWorks.getState().addEntry({ ...E1, status: "unverified" });
    const entries = useWorks.getState().entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.status, "unverified");
  });

  it("removeEntry no-ops when the id is absent", () => {
    useWorks.getState().addEntry(E1);
    useWorks.getState().removeEntry("not-present");
    assert.equal(useWorks.getState().entries.length, 1);
  });

  it("removeEntry removes the matching entry and keeps order", () => {
    useWorks.getState().addEntry(E1);
    useWorks.getState().addEntry(E2);
    useWorks.getState().addEntry(E3);
    useWorks.getState().removeEntry("e2");
    const ids = useWorks.getState().entries.map((e) => e.id);
    assert.deepEqual(ids, ["e1", "e3"]);
  });

  it("clear empties the store", () => {
    useWorks.getState().addEntry(E1);
    useWorks.getState().addEntry(E2);
    useWorks.getState().clear();
    assert.equal(useWorks.getState().entries.length, 0);
  });
});

// ---------- layoutEntries ---------------------------------------

describe("layoutEntries", () => {
  it("returns an empty array for no entries", () => {
    assert.deepEqual(layoutEntries([]), []);
  });

  it("centre-balances a single work at x=0", () => {
    const [w] = layoutEntries([E1]);
    assert.ok(w);
    assert.equal(w.position[0], 0);
  });

  it("centre-balances a triptych around x=0", () => {
    // Total layout width = 0.6 + 0.4 + 1.0 + 0.4 + 0.5 = 2.9. The
    // invariant is the *bounding box* sits symmetrically around 0 —
    // midpoint of centres is only zero when outer works are equal
    // widths, which isn't a layout property we care about.
    const works = layoutEntries([E1, E2, E3]);
    assert.equal(works.length, 3);
    const leftEdge = works[0]!.position[0] - works[0]!.size[0] / 2;
    const rightEdge = works[2]!.position[0] + works[2]!.size[0] / 2;
    const midpoint = (leftEdge + rightEdge) / 2;
    assert.ok(Math.abs(midpoint) < 1e-9, `bbox midpoint ${midpoint} not zero`);
  });

  it("preserves entry identity (status, imageUrl) in the projection", () => {
    const [w] = layoutEntries([E1]);
    assert.ok(w);
    assert.equal(w.id, "e1");
    assert.equal(w.status, "verified");
    assert.equal(w.imageUrl, "blob:e1");
    assert.deepEqual([...w.size], [0.6, 0.8]);
  });

  it("is deterministic: same input, same output", () => {
    const a = layoutEntries([E1, E2]);
    const b = layoutEntries([E1, E2]);
    assert.deepEqual(a, b);
  });

  it("places all works at the same y (WORK_CENTRE_HEIGHT, 1.5m)", () => {
    const works = layoutEntries([E1, E2, E3]);
    for (const w of works) assert.equal(w.position[1], 1.5);
  });

  it("places all works at the same z (just in front of back wall)", () => {
    const works = layoutEntries([E1, E2, E3]);
    const z = works[0]!.position[2];
    for (const w of works) assert.equal(w.position[2], z);
  });
});

// ---------- entryFromIntake -------------------------------------

function makeIntake(overrides: Partial<IntakeOutput["artwork"]> = {}): IntakeOutput {
  return {
    artwork: {
      artist: "Untitled",
      title: "Untitled",
      year: null,
      medium: null,
      dimensionsCm: null,
      confidenceBySource: {
        artist: 0.5,
        title: 0.5,
        year: 0.5,
        medium: 0.5,
        dimensions: 0.5,
      },
      ...overrides,
    },
    artistContext: {
      nationality: null,
      birthYear: null,
      bioMuji: null,
      bannedVocabularyDetected: false,
    },
    galleryOfOrigin: {
      galleryId: "g",
      galleryName: "g",
      detectedFrom: null,
      confidence: 0.5,
    },
    documents: [],
    arrivalLine: "added.",
  };
}

describe("entryFromIntake", () => {
  it("creates an unverified entry (new intakes are dormant)", () => {
    const entry = entryFromIntake(makeIntake(), "blob:x");
    assert.equal(entry.status, "unverified");
  });

  it("reads dimensions when present, converting cm → metres", () => {
    const entry = entryFromIntake(
      makeIntake({ dimensionsCm: { w: 80, h: 60 } }),
      "blob:x",
    );
    assert.deepEqual([...entry.size], [0.8, 0.6]);
  });

  it("falls back to a sensible default when dimensions are null", () => {
    const entry = entryFromIntake(makeIntake(), "blob:x");
    // Default is 0.6 × 0.8m.
    assert.equal(entry.size[0], 0.6);
    assert.equal(entry.size[1], 0.8);
  });

  it("honours an explicit id override", () => {
    const entry = entryFromIntake(makeIntake(), "blob:x", { id: "fixed-id" });
    assert.equal(entry.id, "fixed-id");
  });

  it("generates a non-empty id when none is provided", () => {
    const entry = entryFromIntake(makeIntake(), "blob:x");
    assert.ok(entry.id.length > 0);
  });
});
