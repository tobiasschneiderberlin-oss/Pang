/**
 * PANG — auth store tests.
 *
 * Single-use challenge semantics, invite-consumed marker, atomic
 * write/rename round-trips, and credential revocation lifecycle.
 *
 * These tests touch the real filesystem under `.pang/server-*` —
 * each test resets the stores before running.
 */

import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  __resetAuthStoresForTests,
  isInviteConsumed,
  markInviteConsumed,
  readCredential,
  readSession,
  readUser,
  revokeCredential,
  takeChallenge,
  writeChallenge,
  writeCredential,
  writeSession,
  writeUser,
} from "./store";
import type {
  ChallengeRecord,
  CredentialRecord,
  SessionRecord,
  UserRecord,
} from "../schema";

const USER: UserRecord = {
  userId: "u_" + "a".repeat(22),
  userHandle: "b".repeat(22),
  galleryId: "droste",
  createdAt: new Date().toISOString(),
};

const CREDENTIAL: CredentialRecord = {
  credentialId: "cred-abc123",
  userId: USER.userId,
  publicKey: "publickey-base64url",
  counter: 0,
  transports: ["internal"],
  credentialDeviceType: "multiDevice",
  credentialBackedUp: true,
  createdAt: new Date().toISOString(),
  lastUsedAt: null,
  revokedAt: null,
  revocationReason: null,
};

const SESSION: SessionRecord = {
  sessionToken: "f".repeat(64),
  userId: USER.userId,
  method: "passkey",
  createdAt: new Date().toISOString(),
  rotatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  credentialId: CREDENTIAL.credentialId,
};

function challenge(value: string, ttlMs = 60_000): ChallengeRecord {
  const now = new Date();
  const exp = new Date(now.getTime() + ttlMs);
  return {
    challenge: value,
    purpose: "assert",
    scope: { kind: "public" },
    createdAt: now.toISOString(),
    expiresAt: exp.toISOString(),
  };
}

beforeEach(async () => {
  await __resetAuthStoresForTests();
});

describe("users", () => {
  it("round-trips a user record", async () => {
    await writeUser(USER);
    const out = await readUser(USER.userId);
    assert.deepEqual(out, USER);
  });

  it("returns null on missing user", async () => {
    assert.equal(await readUser("u_" + "z".repeat(22)), null);
  });

  it("throws on unsafe userId shape", async () => {
    await assert.rejects(readUser("../../../etc/passwd"));
  });
});

describe("credentials", () => {
  it("round-trips a credential record", async () => {
    await writeCredential(CREDENTIAL);
    const out = await readCredential(CREDENTIAL.credentialId);
    assert.deepEqual(out, CREDENTIAL);
  });

  it("revoke moves the record to the revoked store", async () => {
    await writeCredential(CREDENTIAL);
    await revokeCredential(CREDENTIAL.credentialId, "clone-detected");
    // Live read is now null.
    assert.equal(await readCredential(CREDENTIAL.credentialId), null);
  });

  it("revoke on an unknown credential is a silent no-op", async () => {
    await revokeCredential("unknown-id", "test");
    // No throw; live store still empty.
    assert.equal(await readCredential("unknown-id"), null);
  });
});

describe("sessions", () => {
  it("round-trips a session record", async () => {
    await writeSession(SESSION);
    const out = await readSession(SESSION.sessionToken);
    assert.deepEqual(out, SESSION);
  });

  it("readSession rejects malformed tokens without filesystem I/O", async () => {
    // Shape check — any token not matching /^[0-9a-f]{64}$/ returns null.
    assert.equal(await readSession("not-hex"), null);
    assert.equal(await readSession("f".repeat(63)), null); // too short
    assert.equal(await readSession("g".repeat(64)), null); // non-hex
  });

  it("returns null on unknown but well-formed tokens", async () => {
    assert.equal(await readSession("a".repeat(64)), null);
  });
});

describe("invites (consumed marker)", () => {
  it("unmarked jti is not consumed", async () => {
    assert.equal(await isInviteConsumed("test-jti"), false);
  });

  it("markInviteConsumed is idempotent; read reflects true", async () => {
    await markInviteConsumed("test-jti");
    assert.equal(await isInviteConsumed("test-jti"), true);
    await markInviteConsumed("test-jti"); // twice → no throw
    assert.equal(await isInviteConsumed("test-jti"), true);
  });

  it("rejects unsafe jti shapes", async () => {
    await assert.rejects(markInviteConsumed("../traversal"));
    // isInviteConsumed returns true (fail-closed) on unsafe input.
    assert.equal(await isInviteConsumed("../traversal"), true);
  });
});

describe("challenges (single-use)", () => {
  const VALID = "a".repeat(43);

  it("takeChallenge returns the record then deletes it", async () => {
    await writeChallenge(challenge(VALID));
    const first = await takeChallenge(VALID);
    assert.ok(first);
    assert.equal(first?.challenge, VALID);
    // Second take returns null — the challenge is gone.
    const second = await takeChallenge(VALID);
    assert.equal(second, null);
  });

  it("takeChallenge returns null on expired challenge", async () => {
    const exp = -1000; // already expired
    await writeChallenge(challenge(VALID, exp));
    assert.equal(await takeChallenge(VALID), null);
  });

  it("takeChallenge rejects malformed challenge shapes without I/O", async () => {
    assert.equal(await takeChallenge("too-short"), null);
    assert.equal(await takeChallenge("/".repeat(43)), null);
  });

  it("takeChallenge on an unknown but well-formed challenge returns null", async () => {
    assert.equal(await takeChallenge("b".repeat(43)), null);
  });
});
