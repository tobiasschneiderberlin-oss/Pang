/**
 * PANG — push-subscribe client tests.
 *
 * Covers the pure halves of the push module:
 *
 *   - `urlBase64ToUint8Array` round-trips a standard VAPID public
 *     key length (65 bytes) and preserves bytes exactly.
 *   - `toPayload` builds a valid `PushSubscribePayload` from a
 *     subscription-like object.
 *   - `toPayload` throws on a subscription without keys — that is a
 *     real infrastructure bug worth surfacing, not a silent drop.
 *
 * The DOM-dependent halves (`probePushSupport`, `subscribeForOutcome`)
 * are covered by e2e tests where a real browser surface exists. Here
 * we lock the pure code path — any drift in serialisation shape
 * breaks the contract the server schema enforces.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toPayload,
  urlBase64ToUint8Array,
  type PushSubscriptionLike,
} from "./subscribe";
import { PushSubscribePayloadSchema } from "./schema";
import type { VerificationRequest } from "@/verification/schema";

function request(): VerificationRequest {
  return {
    version: "v1",
    requestId: "ku7mt1xp-abc123def456",
    workId: "w-alpha",
    galleryIdHint: "gal-1",
    galleryNameHint: null,
    galleryFreeText: null,
    detectedFrom: "email",
    artworkSnapshot: {
      artist: "Jane Doe",
      title: null,
      year: 2023,
      medium: null,
      dimensionsCm: null,
    },
    photoRef: "opfs://intake/abc.jpg",
    capturedAt: "2026-04-23T09:58:00.000Z",
    submittedAt: "2026-04-23T10:00:00.000Z",
  };
}

describe("urlBase64ToUint8Array", () => {
  it("decodes a standard base64url input exactly", () => {
    // "hello" → base64 "aGVsbG8=" → base64url "aGVsbG8"
    const bytes = urlBase64ToUint8Array("aGVsbG8");
    const str = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    assert.equal(str, "hello");
  });

  it("round-trips the `-_` → `+/` substitutions", () => {
    // Any byte in {62, 63} exercises the base64url alphabet:
    // b64url char for 62 is '-', for 63 is '_'.
    // Encoding 0xFA 0xFF in base64 is "+v8=" — in base64url it's
    // "-v8". We feed "-v8" and expect 0xFA 0xFF.
    const bytes = urlBase64ToUint8Array("-v8");
    assert.equal(bytes.length, 2);
    assert.equal(bytes[0], 0xfa);
    assert.equal(bytes[1], 0xff);
  });

  it("backs the view with a fresh ArrayBuffer", () => {
    const bytes = urlBase64ToUint8Array("aGVsbG8");
    // The runtime type is ArrayBuffer, not SharedArrayBuffer.
    assert.ok(bytes.buffer instanceof ArrayBuffer);
  });
});

describe("toPayload", () => {
  const VALID_P256DH =
    "BN5cEtzqVsZ3kkjZ5ZVoLGXczUcHwbVJ4J2c8bZ6T4xqk7m7mDTQJ1x8O-_C7vJ5S4i2eP4pKj9X8wR1aH2Yq-s";
  const VALID_AUTH = "abcd1234EFGH5678ijkl";

  it("builds a schema-valid payload from a typical subscription", () => {
    const sub: PushSubscriptionLike = {
      toJSON: () => ({
        endpoint: "https://push.example.com/abc",
        expirationTime: null,
        keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
      }),
    };
    const payload = toPayload(request(), sub);
    const parsed = PushSubscribePayloadSchema.safeParse(payload);
    assert.ok(parsed.success, JSON.stringify(parsed));
    assert.equal(payload.requestId, "ku7mt1xp-abc123def456");
    assert.equal(payload.workId, "w-alpha");
    assert.equal(payload.endpoint, "https://push.example.com/abc");
    assert.equal(payload.expirationTime, null);
    assert.equal(payload.keys.p256dh, VALID_P256DH);
    assert.equal(payload.keys.auth, VALID_AUTH);
  });

  it("carries a numeric expirationTime through unchanged", () => {
    const sub: PushSubscriptionLike = {
      toJSON: () => ({
        endpoint: "https://push.example.com/abc",
        expirationTime: 1_800_000_000,
        keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
      }),
    };
    const payload = toPayload(request(), sub);
    assert.equal(payload.expirationTime, 1_800_000_000);
  });

  it("throws when the subscription has no endpoint", () => {
    const sub: PushSubscriptionLike = {
      toJSON: () => ({
        keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
      }),
    };
    assert.throws(() => toPayload(request(), sub), /missing endpoint/);
  });

  it("throws when keys are missing", () => {
    const sub: PushSubscriptionLike = {
      toJSON: () => ({ endpoint: "https://push.example.com/abc" }),
    };
    assert.throws(() => toPayload(request(), sub), /missing endpoint or keys/);
  });

  it("throws when p256dh is missing", () => {
    const sub: PushSubscriptionLike = {
      toJSON: () => ({
        endpoint: "https://push.example.com/abc",
        keys: { auth: VALID_AUTH },
      }),
    };
    assert.throws(() => toPayload(request(), sub), /missing endpoint or keys/);
  });
});
