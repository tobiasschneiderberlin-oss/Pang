/**
 * PANG — id generator tests.
 *
 * Locks the shape of every auth identifier. These regexes are the
 * same ones the Zod schemas enforce on the read path; if the
 * generator drifts, every downstream store breaks on the first write.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  newBindSessionToken,
  newChallenge,
  newInviteJti,
  newSessionToken,
  newUserHandle,
  newUserId,
} from "./ids";

describe("id generators", () => {
  it("newUserId matches u_<22 base62>", () => {
    for (let i = 0; i < 16; i++) {
      assert.match(newUserId(), /^u_[A-Za-z0-9]{22}$/);
    }
  });

  it("newUserHandle is 22 chars of base64url", () => {
    for (let i = 0; i < 16; i++) {
      assert.match(newUserHandle(), /^[A-Za-z0-9_-]{22}$/);
    }
  });

  it("newSessionToken is 64 hex chars", () => {
    for (let i = 0; i < 16; i++) {
      assert.match(newSessionToken(), /^[0-9a-f]{64}$/);
    }
  });

  it("newBindSessionToken is 64 hex chars", () => {
    for (let i = 0; i < 16; i++) {
      assert.match(newBindSessionToken(), /^[0-9a-f]{64}$/);
    }
  });

  it("newChallenge is 43 chars of base64url (32 bytes, unpadded)", () => {
    for (let i = 0; i < 16; i++) {
      assert.match(newChallenge(), /^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("newInviteJti is base64url and non-empty", () => {
    for (let i = 0; i < 16; i++) {
      assert.match(newInviteJti(), /^[A-Za-z0-9_-]+$/);
    }
  });

  it("generators do not collide across 1000 calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(newSessionToken());
    assert.equal(seen.size, 1000);
  });
});
