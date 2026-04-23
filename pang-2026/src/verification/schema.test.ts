/**
 * PANG — verification schema tests.
 *
 * Locks the wire shape between client and server (iteration #4
 * criterion 1 in the kickoff brief). Each test encodes a rule the
 * brief declared:
 *
 *   - parses a full valid payload end-to-end
 *   - rejects missing required fields
 *   - rejects `galleryFreeText` > 120 chars
 *   - rejects all-null gallery identifiers (the refinement)
 *   - accepts each single-source (id-only, name-only, freetext-only)
 *   - bounces malformed requestIds
 *   - newRequestId() produces ids the RequestIdSchema accepts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VerificationRequestSchema,
  VerificationAckSchema,
  VerificationOutcomeSchema,
  RequestIdSchema,
  newRequestId,
  type VerificationRequest,
} from "./schema";

function validRequest(overrides: Partial<VerificationRequest> = {}): unknown {
  return {
    version: "v1",
    requestId: newRequestId(),
    workId: "w-abc",
    galleryIdHint: "droste-berlin",
    galleryNameHint: "Galerie Droste",
    galleryFreeText: null,
    detectedFrom: "email",
    artworkSnapshot: {
      artist: "Joan Mitchell",
      title: "Untitled",
      year: 1973,
      medium: "oil on canvas",
      dimensionsCm: { h: 120, w: 100 },
    },
    photoRef: "works/w-abc.png",
    capturedAt: "2026-04-23T10:00:00.000Z",
    submittedAt: "2026-04-23T10:00:04.500Z",
    ...overrides,
  };
}

// ---- requestId ----------------------------------------------------

describe("RequestIdSchema", () => {
  it("accepts a newRequestId()", () => {
    const id = newRequestId();
    const parsed = RequestIdSchema.safeParse(id);
    assert.equal(parsed.success, true, `rejected: ${id}`);
  });

  it("rejects the empty string", () => {
    assert.equal(RequestIdSchema.safeParse("").success, false);
  });

  it("rejects a plain UUID without a dash-split shape", () => {
    assert.equal(
      RequestIdSchema.safeParse("550e8400e29b41d4a716446655440000").success,
      false,
    );
  });

  it("rejects uppercase hex (base36 is lowercase by construction)", () => {
    assert.equal(RequestIdSchema.safeParse("ABC-DEF").success, false);
  });

  it("rejects a string over 40 chars", () => {
    assert.equal(
      RequestIdSchema.safeParse("x".repeat(41)).success,
      false,
    );
  });

  it("newRequestId() is unique across 1000 calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(newRequestId());
    assert.equal(seen.size, 1000);
  });
});

// ---- full request -------------------------------------------------

describe("VerificationRequestSchema", () => {
  it("parses a full valid payload", () => {
    const parsed = VerificationRequestSchema.safeParse(validRequest());
    assert.equal(parsed.success, true);
  });

  it("rejects a payload missing requestId", () => {
    const body = validRequest();
    delete (body as { requestId?: unknown }).requestId;
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("rejects a payload missing workId", () => {
    const body = validRequest();
    delete (body as { workId?: unknown }).workId;
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("rejects a payload missing artworkSnapshot", () => {
    const body = validRequest();
    delete (body as { artworkSnapshot?: unknown }).artworkSnapshot;
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("rejects galleryFreeText longer than 120 chars", () => {
    const body = validRequest({
      galleryIdHint: null,
      galleryNameHint: null,
      galleryFreeText: "x".repeat(121),
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("accepts galleryFreeText at exactly 120 chars", () => {
    const body = validRequest({
      galleryIdHint: null,
      galleryNameHint: null,
      galleryFreeText: "x".repeat(120),
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, true);
  });

  it("rejects the all-null gallery case (refinement)", () => {
    const body = validRequest({
      galleryIdHint: null,
      galleryNameHint: null,
      galleryFreeText: null,
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("accepts the id-only gallery case", () => {
    const body = validRequest({
      galleryIdHint: "g-1",
      galleryNameHint: null,
      galleryFreeText: null,
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, true);
  });

  it("accepts the name-only gallery case", () => {
    const body = validRequest({
      galleryIdHint: null,
      galleryNameHint: "Some Gallery",
      galleryFreeText: null,
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, true);
  });

  it("accepts the free-text-only gallery case", () => {
    const body = validRequest({
      galleryIdHint: null,
      galleryNameHint: null,
      galleryFreeText: "a gallery the collector typed in",
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, true);
  });

  it("rejects extra fields (strict)", () => {
    const body = validRequest();
    (body as Record<string, unknown>)["extraField"] = "smuggle";
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("rejects non-ISO timestamps", () => {
    const body = validRequest({ submittedAt: "yesterday" });
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("rejects a bad requestId shape", () => {
    const body = validRequest({ requestId: "not a ulid" });
    assert.equal(VerificationRequestSchema.safeParse(body).success, false);
  });

  it("accepts artworkSnapshot with all null fields (thin intake)", () => {
    const body = validRequest({
      artworkSnapshot: {
        artist: null,
        title: null,
        year: null,
        medium: null,
        dimensionsCm: null,
      },
    });
    assert.equal(VerificationRequestSchema.safeParse(body).success, true);
  });
});

// ---- ack ----------------------------------------------------------

describe("VerificationAckSchema", () => {
  it("parses a valid ack", () => {
    const ok = VerificationAckSchema.safeParse({
      requestId: newRequestId(),
      status: "received",
      receivedAt: "2026-04-23T10:00:05.000Z",
    });
    assert.equal(ok.success, true);
  });

  it("rejects a non-received status", () => {
    const bad = VerificationAckSchema.safeParse({
      requestId: newRequestId(),
      status: "queued",
      receivedAt: "2026-04-23T10:00:05.000Z",
    });
    assert.equal(bad.success, false);
  });
});

// ---- outcome ------------------------------------------------------

describe("VerificationOutcomeSchema", () => {
  it("parses a confirmation", () => {
    const ok = VerificationOutcomeSchema.safeParse({
      version: "v1",
      requestId: newRequestId(),
      workId: "w-abc",
      outcome: "confirmed",
      decidedAt: "2026-04-24T09:00:00.000Z",
    });
    assert.equal(ok.success, true);
  });

  it("parses a decline", () => {
    const ok = VerificationOutcomeSchema.safeParse({
      version: "v1",
      requestId: newRequestId(),
      workId: "w-abc",
      outcome: "declined",
      decidedAt: "2026-04-24T09:00:00.000Z",
    });
    assert.equal(ok.success, true);
  });

  it("rejects other outcome kinds", () => {
    const bad = VerificationOutcomeSchema.safeParse({
      version: "v1",
      requestId: newRequestId(),
      workId: "w-abc",
      outcome: "pending",
      decidedAt: "2026-04-24T09:00:00.000Z",
    });
    assert.equal(bad.success, false);
  });
});
