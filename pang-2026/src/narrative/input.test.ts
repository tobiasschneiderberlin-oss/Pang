/**
 * PANG — narrative input assembler tests.
 *
 * The assembler is the CaMeL boundary (primitive 70). The tests cover:
 *
 *   - empty collection → skip("empty-collection")
 *   - below threshold → skip("thin-provenance")
 *   - threshold met via verified-works count
 *   - threshold met via provenance count alone
 *   - hash is deterministic and changes when collection changes
 *   - month string is UTC-calendar-based
 *   - returned input is `'P'`-branded at runtime
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ASSEMBLER_MIN_PROVENANCE_ENTRIES,
  ASSEMBLER_MIN_VERIFIED_WORKS,
  assembleNarrativeInput,
  hashCollection,
  monthOf,
  type NarrativeCollectorState,
} from "./input";
import { trustSourceOf } from "@/ai/camel/trust";

function mkWork(i: number, artistId = "artist-richter"): {
  id: string;
  title: string;
  artistId: string;
  artist: string;
  year: number;
  medium: string;
} {
  return {
    id: `work-${i}`,
    title: `Work ${i}`,
    artistId,
    artist: artistId.replace(/^artist-/, ""),
    year: 1982 + i,
    medium: "oil on canvas",
  };
}

function mkProv(i: number, workId = "work-1"): {
  workId: string;
  kind: string;
  year: number;
  summary: string;
} {
  return {
    workId,
    kind: "acquisition",
    year: 2000 + i,
    summary: `Provenance entry ${i}.`,
  };
}

const state = (overrides: Partial<NarrativeCollectorState> = {}): NarrativeCollectorState => ({
  collectorId: "collector-abc",
  verifiedWorks: [mkWork(1)],
  provenanceEntries: [],
  bioMujiParagraphs: { "artist-richter": "A factual bio paragraph." },
  ...overrides,
});

const now = new Date(Date.UTC(2026, 3 /* April */, 24, 12, 0, 0));

describe("monthOf", () => {
  it("produces YYYY-MM", () => {
    assert.equal(monthOf(now), "2026-04");
  });

  it("pads single-digit months", () => {
    const d = new Date(Date.UTC(2026, 0 /* Jan */, 3));
    assert.equal(monthOf(d), "2026-01");
  });

  it("uses UTC, not local time", () => {
    const d = new Date(Date.UTC(2026, 11 /* Dec */, 31, 23, 59));
    assert.equal(monthOf(d), "2026-12");
  });
});

describe("assembleNarrativeInput — skips", () => {
  it("returns empty-collection skip for zero verified works", () => {
    const r = assembleNarrativeInput(
      state({ verifiedWorks: [] }),
      now,
    );
    assert.equal(r.kind, "skip");
    assert.equal(r.kind === "skip" ? r.reason : null, "empty-collection");
  });

  it("returns thin-provenance skip below both thresholds", () => {
    const r = assembleNarrativeInput(
      state({
        verifiedWorks: [mkWork(1), mkWork(2)],
        provenanceEntries: [mkProv(1), mkProv(2)],
      }),
      now,
    );
    assert.equal(r.kind, "skip");
    assert.equal(r.kind === "skip" ? r.reason : null, "thin-provenance");
  });
});

describe("assembleNarrativeInput — threshold met", () => {
  it("passes with enough verified works alone", () => {
    const works = Array.from(
      { length: ASSEMBLER_MIN_VERIFIED_WORKS },
      (_, i) => mkWork(i + 1),
    );
    const r = assembleNarrativeInput(state({ verifiedWorks: works }), now);
    assert.equal(r.kind, "input");
  });

  it("passes with enough provenance entries alone", () => {
    const provs = Array.from(
      { length: ASSEMBLER_MIN_PROVENANCE_ENTRIES },
      (_, i) => mkProv(i + 1),
    );
    const r = assembleNarrativeInput(
      state({ verifiedWorks: [mkWork(1)], provenanceEntries: provs }),
      now,
    );
    assert.equal(r.kind, "input");
  });

  it("brands the returned input 'P'", () => {
    const works = [mkWork(1), mkWork(2), mkWork(3)];
    const r = assembleNarrativeInput(state({ verifiedWorks: works }), now);
    assert.equal(r.kind, "input");
    if (r.kind !== "input") return;
    assert.equal(trustSourceOf(r.input), "P");
  });

  it("embeds the current YYYY-MM string", () => {
    const works = [mkWork(1), mkWork(2), mkWork(3)];
    const r = assembleNarrativeInput(state({ verifiedWorks: works }), now);
    assert.equal(r.kind, "input");
    if (r.kind !== "input") return;
    assert.equal(r.input.month, "2026-04");
  });
});

describe("hashCollection", () => {
  it("is deterministic across repeated calls", () => {
    const s = state({
      verifiedWorks: [mkWork(1), mkWork(2), mkWork(3)],
      provenanceEntries: [mkProv(1)],
    });
    const h1 = hashCollection(s);
    const h2 = hashCollection(s);
    assert.equal(h1, h2);
  });

  it("changes when a verified work is added", () => {
    const before = state({ verifiedWorks: [mkWork(1), mkWork(2)] });
    const after = state({
      verifiedWorks: [mkWork(1), mkWork(2), mkWork(3)],
    });
    assert.notEqual(hashCollection(before), hashCollection(after));
  });

  it("changes when a provenance entry is added", () => {
    const before = state({ provenanceEntries: [mkProv(1)] });
    const after = state({ provenanceEntries: [mkProv(1), mkProv(2)] });
    assert.notEqual(hashCollection(before), hashCollection(after));
  });

  it("changes when the bio-muji paragraph length changes", () => {
    const before = state({
      bioMujiParagraphs: { "artist-richter": "short" },
    });
    const after = state({
      bioMujiParagraphs: {
        "artist-richter": "a much longer bio paragraph with detail",
      },
    });
    assert.notEqual(hashCollection(before), hashCollection(after));
  });

  it("is stable under verifiedWorks ordering", () => {
    const asc = state({
      verifiedWorks: [mkWork(1), mkWork(2), mkWork(3)],
    });
    const desc = state({
      verifiedWorks: [mkWork(3), mkWork(2), mkWork(1)],
    });
    // canonical sort inside hashCollection erases the ordering.
    assert.equal(hashCollection(asc), hashCollection(desc));
  });
});
