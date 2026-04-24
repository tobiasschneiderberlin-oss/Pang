/**
 * PANG — narrative schema tests.
 *
 * The schema owns three invariants the agent runner relies on:
 *
 *   1. paragraph length band [120, 600]
 *   2. no banned or evaluative vocabulary (hard — the field name is
 *      `paragraph`, which the narrative-context detector does NOT pick
 *      up, so the schema does the work itself)
 *   3. no first-person pronouns ("i", "me", "my", "we", "our", "us")
 *
 * `NarrativeMarkerSchema`'s discriminated union is the row shape the
 * filesystem stand-in persists; a drifted tool output fails here,
 * not at the OTel boundary.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  NarrativeInputSchema,
  NarrativeMarkerSchema,
  NarrativeOutputSchema,
  NarrativeSkipReasonSchema,
  NARRATIVE_PARAGRAPH_MAX,
  NARRATIVE_PARAGRAPH_MIN,
} from "./schema";

describe("NarrativeOutputSchema", () => {
  const nominal =
    "Four Hojgaards sit on the west wall, the largest acquired in 2019. Next to them is a single Taeuber-Arp from 1935, the only work on paper in this collection. The provenance ledger for both names continues to grow year on year.";

  it("accepts a nominal observational paragraph", () => {
    const out = NarrativeOutputSchema.parse({ paragraph: nominal });
    assert.equal(out.paragraph.length >= NARRATIVE_PARAGRAPH_MIN, true);
    assert.equal(out.paragraph.length <= NARRATIVE_PARAGRAPH_MAX, true);
  });

  it("rejects a paragraph shorter than the min", () => {
    const short = "A short paragraph.";
    assert.throws(() => NarrativeOutputSchema.parse({ paragraph: short }));
  });

  it("rejects a paragraph longer than the max", () => {
    const long = "observational line ".repeat(50);
    assert.throws(() => NarrativeOutputSchema.parse({ paragraph: long }));
  });

  it("rejects an evaluative adjective from the soft list", () => {
    const evaluative = [
      "Four Hojgaards — a striking sequence — sit on the west wall. ",
      "The provenance ledger for the work continues to grow year on year. ",
      "Next to them, a single Taeuber-Arp from 1935 holds the paper.",
    ].join("");
    assert.throws(() =>
      NarrativeOutputSchema.parse({ paragraph: evaluative }),
    );
  });

  it("rejects a banned marketing term", () => {
    const marketing = [
      "Your collection is an amazing arc from 1982 to 2019. ",
      "Four Hojgaards on the west wall, the largest acquired in 2019. ",
      "The provenance ledger for these works continues to grow.",
    ].join("");
    assert.throws(() =>
      NarrativeOutputSchema.parse({ paragraph: marketing }),
    );
  });

  it("rejects first-person 'we'", () => {
    const firstPlural = [
      "we see four Hojgaards on the west wall, the largest from 2019. ",
      "Next to them is a single Taeuber-Arp from 1935, and the provenance ",
      "ledger continues to grow year on year for both names.",
    ].join("");
    assert.throws(() =>
      NarrativeOutputSchema.parse({ paragraph: firstPlural }),
    );
  });

  it("rejects first-person 'i'", () => {
    const firstSingular = [
      "I see four Hojgaards on the west wall, the largest from 2019. ",
      "Next to them is a single Taeuber-Arp from 1935, and the provenance ",
      "ledger continues to grow year on year for both names.",
    ].join("");
    assert.throws(() =>
      NarrativeOutputSchema.parse({ paragraph: firstSingular }),
    );
  });

  it("rejects extra fields (strict shape)", () => {
    assert.throws(() =>
      NarrativeOutputSchema.parse({
        paragraph: nominal,
        extraField: "nope",
      }),
    );
  });

  it("permits 'you' / 'your' — the ownership exception", () => {
    const you =
      "Your fourth Hojgaard, acquired in 2019, is the largest on the west wall. Next to it is a single Taeuber-Arp from 1935, the only work on paper in this collection.";
    const out = NarrativeOutputSchema.parse({ paragraph: you });
    assert.match(out.paragraph, /your/i);
  });
});

describe("NarrativeInputSchema", () => {
  const base = {
    collectorId: "collector-abc",
    month: "2026-04",
    verifiedWorks: [
      {
        id: "work-1",
        title: "Kerze",
        artistId: "artist-richter",
        artist: "Gerhard Richter",
        year: 1982,
        medium: "oil on canvas",
      },
    ],
    provenanceEntries: [
      {
        workId: "work-1",
        kind: "acquisition",
        year: 2019,
        summary: "Acquired via Galerie Droste.",
      },
    ],
    bioMujiParagraphs: {
      "artist-richter": "A short bio-muji paragraph about Richter.",
    },
    collectionHash: "hash-1234abcd",
  };

  it("accepts a minimal valid input", () => {
    const out = NarrativeInputSchema.parse(base);
    assert.equal(out.collectorId, "collector-abc");
  });

  it("rejects malformed month", () => {
    assert.throws(() =>
      NarrativeInputSchema.parse({ ...base, month: "2026-4" }),
    );
    assert.throws(() =>
      NarrativeInputSchema.parse({ ...base, month: "April 2026" }),
    );
  });

  it("rejects empty verified works", () => {
    assert.throws(() =>
      NarrativeInputSchema.parse({ ...base, verifiedWorks: [] }),
    );
  });

  it("accepts null year + null medium", () => {
    const out = NarrativeInputSchema.parse({
      ...base,
      verifiedWorks: [
        {
          id: "work-2",
          title: "Untitled",
          artistId: "artist-unknown",
          artist: "Unknown",
          year: null,
          medium: null,
        },
      ],
    });
    assert.equal(out.verifiedWorks[0]!.year, null);
  });
});

describe("NarrativeSkipReasonSchema", () => {
  it("accepts every declared skip reason", () => {
    const reasons = [
      "empty-collection",
      "thin-provenance",
      "same-month-marker",
      "unchanged-collection",
      "agent-failure",
      "evaluative-vocabulary",
    ];
    for (const r of reasons) {
      assert.equal(NarrativeSkipReasonSchema.parse(r), r);
    }
  });

  it("rejects an ad-hoc reason", () => {
    assert.throws(() =>
      NarrativeSkipReasonSchema.parse("some-other-reason"),
    );
  });
});

describe("NarrativeMarkerSchema", () => {
  const paragraph =
    "Four Hojgaards sit on the west wall, the largest acquired in 2019. Next to them, a single Taeuber-Arp from 1935 holds the only work on paper in this collection.";

  it("accepts a paragraph marker", () => {
    const marker = NarrativeMarkerSchema.parse({
      kind: "paragraph",
      collectorId: "c-1",
      month: "2026-04",
      collectionHash: "hash-1234abcd",
      paragraph,
      decidedAt: new Date().toISOString(),
    });
    assert.equal(marker.kind, "paragraph");
  });

  it("accepts a skipped marker", () => {
    const marker = NarrativeMarkerSchema.parse({
      kind: "skipped",
      collectorId: "c-1",
      month: "2026-04",
      collectionHash: "hash-1234abcd",
      reason: "thin-provenance",
      decidedAt: new Date().toISOString(),
    });
    assert.equal(marker.kind, "skipped");
  });

  it("rejects a paragraph marker missing the paragraph", () => {
    assert.throws(() =>
      NarrativeMarkerSchema.parse({
        kind: "paragraph",
        collectorId: "c-1",
        month: "2026-04",
        collectionHash: "hash-1234abcd",
        decidedAt: new Date().toISOString(),
      }),
    );
  });
});
