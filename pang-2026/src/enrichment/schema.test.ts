/**
 * PANG — enrichment schema tests.
 *
 * Locks the wire shapes and the derivation of `basedOnWorkHash`.
 * Every check here is a regression guard: if a contributor can
 * smuggle an extra field past `.strict()`, or if the hash stops
 * being deterministic, the enrichment cache becomes a poisoning
 * surface.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ProvenanceSubmissionSchema,
  EnrichmentOutputSchema,
  ProvenanceRecordSchema,
  TimelineEntrySchema,
  computeWorkHash,
  computeSubmissionBatchHash,
  newSubmissionId,
} from "./schema";

const goodRecord = {
  year: 2018,
  location: "Galerie Droste, Düsseldorf",
  context: "private" as const,
  imageRef: null,
  untrustedNote: "Collected from the artist's studio visit.",
};

const goodSnapshot = {
  artist: "Jane Doe",
  title: "Untitled #3",
  year: 2018,
  medium: "oil on canvas",
  dimensionsCm: { h: 120, w: 90 } as { h: number; w: number; d?: number },
};

describe("ProvenanceSubmissionSchema", () => {
  it("accepts a well-formed submission", () => {
    const parsed = ProvenanceSubmissionSchema.parse({
      version: "v1",
      submissionId: newSubmissionId(),
      workId: "w-1",
      contributorId: "gal-1",
      contributorRole: "gallery",
      records: [goodRecord],
      basedOnWorkHash: "a".repeat(64),
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(parsed.records.length, 1);
  });

  it("rejects missing workId", () => {
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: [goodRecord],
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects records array longer than 16", () => {
    const tooMany = Array.from({ length: 17 }, () => goodRecord);
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: tooMany,
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects empty records array", () => {
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: [],
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects untrustedNote longer than 256 chars", () => {
    const longNote = "x".repeat(257);
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: [{ ...goodRecord, untrustedNote: longNote }],
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects malformed basedOnWorkHash", () => {
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: [goodRecord],
        basedOnWorkHash: "not-a-hash",
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects unknown contributor role", () => {
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "artist",
        records: [goodRecord],
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects extra top-level fields via .strict()", () => {
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: [goodRecord],
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
        adminOverride: "bypass-auth",
      }),
    );
  });

  it("rejects nullable year out of range", () => {
    assert.throws(() =>
      ProvenanceSubmissionSchema.parse({
        version: "v1",
        submissionId: newSubmissionId(),
        workId: "w-1",
        contributorId: "gal-1",
        contributorRole: "gallery",
        records: [{ ...goodRecord, year: 5000 }],
        basedOnWorkHash: "a".repeat(64),
        submittedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });
});

describe("ProvenanceRecordSchema", () => {
  it("accepts a null untrustedNote", () => {
    const parsed = ProvenanceRecordSchema.parse({
      ...goodRecord,
      untrustedNote: null,
    });
    assert.equal(parsed.untrustedNote, null);
  });

  it("accepts a null year (undated provenance)", () => {
    const parsed = ProvenanceRecordSchema.parse({
      ...goodRecord,
      year: null,
    });
    assert.equal(parsed.year, null);
  });

  it("rejects bogus context", () => {
    assert.throws(() =>
      ProvenanceRecordSchema.parse({
        ...goodRecord,
        context: "armory",
      }),
    );
  });

  it("rejects extra fields (.strict)", () => {
    assert.throws(() =>
      ProvenanceRecordSchema.parse({
        ...goodRecord,
        ignoreInstructions: "hi",
      }),
    );
  });
});

describe("TimelineEntrySchema", () => {
  it("accepts a sanitised entry (null note)", () => {
    const parsed = TimelineEntrySchema.parse({
      year: 2018,
      location: "Galerie Droste, Düsseldorf",
      context: "private",
      imageRef: null,
      note: null,
      contributorRole: "gallery",
    });
    assert.equal(parsed.contributorRole, "gallery");
  });

  it("rejects an entry with an untrustedNote field (extra key)", () => {
    assert.throws(() =>
      TimelineEntrySchema.parse({
        year: 2018,
        location: "Galerie Droste, Düsseldorf",
        context: "private",
        imageRef: null,
        note: null,
        contributorRole: "gallery",
        untrustedNote: "should not survive sanitization",
      }),
    );
  });
});

describe("EnrichmentOutputSchema", () => {
  it("accepts a minimal valid output", () => {
    const parsed = EnrichmentOutputSchema.parse({
      version: "v1",
      workId: "w-1",
      basedOnWorkHash: "a".repeat(64),
      timeline: [],
      artistContext: {
        nationality: "German",
        birthYear: 1970,
        bioMuji:
          "Trained in Düsseldorf. Works in oil. Exhibits regionally.",
        bannedVocabularyDetected: false,
      },
      generatedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(parsed.timeline.length, 0);
  });

  it("rejects bannedVocabularyDetected: true via literal(false)", () => {
    assert.throws(() =>
      EnrichmentOutputSchema.parse({
        version: "v1",
        workId: "w-1",
        basedOnWorkHash: "a".repeat(64),
        timeline: [],
        artistContext: {
          nationality: null,
          birthYear: null,
          bioMuji: "x",
          bannedVocabularyDetected: true,
        },
        generatedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });

  it("rejects bioMuji longer than 480 chars", () => {
    const tooLong = "x".repeat(481);
    assert.throws(() =>
      EnrichmentOutputSchema.parse({
        version: "v1",
        workId: "w-1",
        basedOnWorkHash: "a".repeat(64),
        timeline: [],
        artistContext: {
          nationality: null,
          birthYear: null,
          bioMuji: tooLong,
          bannedVocabularyDetected: false,
        },
        generatedAt: "2026-04-23T10:00:00.000Z",
      }),
    );
  });
});

describe("computeWorkHash", () => {
  it("is deterministic on identical snapshots", async () => {
    const a = await computeWorkHash(goodSnapshot);
    const b = await computeWorkHash(goodSnapshot);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("changes when artist changes", async () => {
    const a = await computeWorkHash(goodSnapshot);
    const b = await computeWorkHash({ ...goodSnapshot, artist: "Someone Else" });
    assert.notEqual(a, b);
  });

  it("changes when dimensions change", async () => {
    const a = await computeWorkHash(goodSnapshot);
    const b = await computeWorkHash({
      ...goodSnapshot,
      dimensionsCm: { h: 121, w: 90 } as { h: number; w: number },
    });
    assert.notEqual(a, b);
  });

  it("treats null dimensions and undefined d the same", async () => {
    // The schema allows `dimensionsCm` to be null; a present dimensions
    // object with undefined `d` should hash to the same as the explicit
    // null inside. (Both normalise to `null` in the hash input.)
    const a = await computeWorkHash({
      ...goodSnapshot,
      dimensionsCm: { h: 120, w: 90 } as { h: number; w: number },
    });
    const b = await computeWorkHash({
      ...goodSnapshot,
      dimensionsCm: { h: 120, w: 90, d: undefined } as unknown as {
        h: number;
        w: number;
        d?: number;
      },
    });
    assert.equal(a, b);
  });
});

describe("computeSubmissionBatchHash", () => {
  it("is deterministic on identical record sets", async () => {
    const a = await computeSubmissionBatchHash([goodRecord]);
    const b = await computeSubmissionBatchHash([goodRecord]);
    assert.equal(a, b);
  });

  it("is order-sensitive", async () => {
    const r2 = { ...goodRecord, year: 2019 };
    const a = await computeSubmissionBatchHash([goodRecord, r2]);
    const b = await computeSubmissionBatchHash([r2, goodRecord]);
    assert.notEqual(a, b);
  });
});
