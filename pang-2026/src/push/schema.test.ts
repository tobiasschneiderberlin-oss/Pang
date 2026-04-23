/**
 * PANG — push-subscribe wire schema tests.
 *
 * Locks the structural contract the server enforces:
 *
 *   - Version literal must be "v1".
 *   - `endpoint` must be `https://…`.
 *   - `keys.p256dh` and `keys.auth` must be non-empty base64url.
 *   - `expirationTime` is nullable; numeric when present.
 *   - `requestId` uses the ULID-shaped regex.
 *   - Unknown top-level keys are rejected (`.strict()`).
 *
 * If any of these relax, a malformed subscription can slip into the
 * server outbox — the schema is the only gatekeeper between an
 * untrusted request body and durable storage.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PushSubscribePayloadSchema } from "./schema";

function validPayload(): Record<string, unknown> {
  return {
    version: "v1",
    requestId: "ku7mt1xp-abc123def456",
    workId: "w-alpha",
    endpoint: "https://push.example.com/abc/xyz",
    expirationTime: null,
    keys: {
      p256dh:
        "BN5cEtzqVsZ3kkjZ5ZVoLGXczUcHwbVJ4J2c8bZ6T4xqk7m7mDTQJ1x8O-_C7vJ5S4i2eP4pKj9X8wR1aH2Yq-s",
      auth: "abcd1234EFGH5678ijkl",
    },
    subscribedAt: "2026-04-23T10:00:00.000Z",
  };
}

describe("PushSubscribePayloadSchema — happy path", () => {
  it("parses a valid payload", () => {
    const parsed = PushSubscribePayloadSchema.safeParse(validPayload());
    assert.ok(parsed.success, JSON.stringify(parsed));
  });

  it("accepts a numeric expirationTime", () => {
    const payload = { ...validPayload(), expirationTime: 1_800_000_000 };
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.ok(parsed.success);
  });
});

describe("PushSubscribePayloadSchema — rejects", () => {
  it("wrong version literal", () => {
    const payload = { ...validPayload(), version: "v2" };
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("non-https endpoint", () => {
    const payload = {
      ...validPayload(),
      endpoint: "http://push.example.com/abc",
    };
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("empty p256dh", () => {
    const payload = validPayload();
    (payload.keys as Record<string, string>).p256dh = "";
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("empty auth", () => {
    const payload = validPayload();
    (payload.keys as Record<string, string>).auth = "";
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("non-base64url key characters", () => {
    const payload = validPayload();
    (payload.keys as Record<string, string>).p256dh = "has spaces in it";
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("malformed requestId", () => {
    const payload = { ...validPayload(), requestId: "no-hyphen-in-one-piece" };
    // Valid shape is `<base36>-<base36>` — so the "no-hyphen" test
    // needs a value missing the required hyphen shape or using
    // uppercase letters. Keep it simple: uppercase fails the regex.
    payload.requestId = "ABCDEFGHIJKL";
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("unknown top-level key", () => {
    const payload = { ...validPayload(), extra: "nope" };
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("missing keys object", () => {
    const payload = validPayload();
    delete (payload as { keys?: unknown }).keys;
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it("expirationTime as a string", () => {
    const payload = { ...validPayload(), expirationTime: "later" };
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });
});
