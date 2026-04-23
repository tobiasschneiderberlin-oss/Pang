/**
 * PANG — outbox parse/serialise tests.
 *
 * The OPFS I/O paths require a browser fixture; here we test the
 * pure halves — the record shape round-trips and malformed inputs
 * reject. The integration path (enqueue → list → drain) is
 * exercised end-to-end by the Playwright suite in Phase G.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOutboxRecord,
  serialiseOutboxRecord,
  type OutboxRecord,
} from "./outbox";
import { newRequestId, type VerificationRequest } from "./schema";

function validRequest(): VerificationRequest {
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
  };
}

describe("outbox record round-trip", () => {
  it("serialises then parses to the same record", () => {
    const original: OutboxRecord = {
      request: validRequest(),
      attempt: 0,
      nextAttemptAt: "2026-04-23T10:00:04.500Z",
    };
    const text = serialiseOutboxRecord(original);
    const parsed = parseOutboxRecord(text);
    assert.ok(parsed);
    assert.deepEqual(parsed, original);
  });

  it("preserves lastErrorReason when present", () => {
    const original: OutboxRecord = {
      request: validRequest(),
      attempt: 2,
      nextAttemptAt: "2026-04-23T10:05:00.000Z",
      lastErrorReason: "network/timeout",
    };
    const parsed = parseOutboxRecord(serialiseOutboxRecord(original));
    assert.ok(parsed);
    assert.equal(parsed.lastErrorReason, "network/timeout");
  });

  it("omits lastErrorReason when absent (exact-optional)", () => {
    const original: OutboxRecord = {
      request: validRequest(),
      attempt: 0,
      nextAttemptAt: "2026-04-23T10:00:04.500Z",
    };
    const text = serialiseOutboxRecord(original);
    // The JSON itself should not carry the key.
    assert.equal(text.includes("lastErrorReason"), false);
    const parsed = parseOutboxRecord(text);
    assert.ok(parsed);
    assert.equal("lastErrorReason" in parsed, false);
  });
});

describe("parseOutboxRecord rejects malformed input", () => {
  it("rejects invalid JSON", () => {
    assert.equal(parseOutboxRecord("{not json"), null);
  });

  it("rejects a non-object", () => {
    assert.equal(parseOutboxRecord("\"string\""), null);
  });

  it("rejects a missing request field", () => {
    assert.equal(
      parseOutboxRecord(JSON.stringify({ attempt: 0, nextAttemptAt: "" })),
      null,
    );
  });

  it("rejects a negative attempt", () => {
    const bad = serialiseOutboxRecord({
      request: validRequest(),
      attempt: 0,
      nextAttemptAt: "2026-04-23T10:00:00.000Z",
    }).replace('"attempt":0', '"attempt":-1');
    assert.equal(parseOutboxRecord(bad), null);
  });

  it("rejects a non-integer attempt", () => {
    const bad = serialiseOutboxRecord({
      request: validRequest(),
      attempt: 0,
      nextAttemptAt: "2026-04-23T10:00:00.000Z",
    }).replace('"attempt":0', '"attempt":1.5');
    assert.equal(parseOutboxRecord(bad), null);
  });

  it("rejects an empty nextAttemptAt", () => {
    const bad = JSON.stringify({
      request: validRequest(),
      attempt: 0,
      nextAttemptAt: "",
    });
    assert.equal(parseOutboxRecord(bad), null);
  });

  it("rejects a record whose embedded request fails schema", () => {
    const badRequest = { ...validRequest(), requestId: "not a ulid" };
    const bad = JSON.stringify({
      request: badRequest,
      attempt: 0,
      nextAttemptAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(parseOutboxRecord(bad), null);
  });
});
