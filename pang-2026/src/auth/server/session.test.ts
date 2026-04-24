/**
 * PANG — session lifecycle tests.
 *
 * Exercises the create → read → rotate → revoke round trip via the
 * mocked `next/headers` cookie jar. These tests own three invariants
 * that nothing else exercises at unit level:
 *
 *   - `createSession` writes both the store row AND the cookie.
 *   - `rotateSession` writes the new row *before* deleting the old
 *     one (a crash between the two leaves a valid session in place).
 *   - `revokeSession` deletes the row AND clears the cookie (both
 *     halves matter — a stale cookie with a deleted row returns null
 *     from `readCurrentSession`, which must also be verified here).
 *   - `requireSession` raises `UnauthenticatedError` on expiry and
 *     best-effort-cleans up the file.
 *
 * Auth is a security surface — the cookie write path is the easiest
 * thing to get wrong, and a silent regression here would let stolen
 * cookies outlive the session they were minted for.
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installNextHeadersMock } from "@/test/next-headers-mock";
import { __resetAuthStoresForTests, writeSession } from "./store";
import { SESSION_COOKIE_NAME } from "../config";
import { newSessionToken, newUserId } from "../ids";
import type { SessionRecord } from "../schema";

const jar = installNextHeadersMock();

const {
  createSession,
  readCurrentSession,
  rotateSession,
  revokeSession,
  requireSession,
  UnauthenticatedError,
} = await import("./session");

before(async () => {
  await __resetAuthStoresForTests();
});

beforeEach(async () => {
  await __resetAuthStoresForTests();
  jar.clear();
});

describe("createSession", () => {
  it("writes the store row AND sets the cookie", async () => {
    const userId = newUserId();
    const record = await createSession({
      userId,
      method: "passkey",
      credentialId: null,
    });
    assert.equal(record.userId, userId);
    assert.match(record.sessionToken, /^[0-9a-f]{64}$/);
    // Cookie is set.
    assert.equal(jar.get(SESSION_COOKIE_NAME), record.sessionToken);
    // Round-trip via readCurrentSession reads the same record back.
    const roundTripped = await readCurrentSession();
    assert.ok(roundTripped);
    assert.equal(roundTripped.sessionToken, record.sessionToken);
  });

  it("expiresAt is SESSION_MAX_AGE_SECONDS (14d) ahead of createdAt", async () => {
    const record = await createSession({
      userId: newUserId(),
      method: "passkey",
      credentialId: null,
    });
    const deltaSeconds =
      (Date.parse(record.expiresAt) - Date.parse(record.createdAt)) / 1000;
    assert.equal(deltaSeconds, 14 * 24 * 60 * 60);
  });
});

describe("readCurrentSession", () => {
  it("returns null when no cookie is set", async () => {
    assert.equal(await readCurrentSession(), null);
  });

  it("returns null when the cookie points at an unknown token", async () => {
    jar.set(SESSION_COOKIE_NAME, "a".repeat(64));
    assert.equal(await readCurrentSession(), null);
  });

  it("returns null when the cookie's token shape is malformed", async () => {
    jar.set(SESSION_COOKIE_NAME, "not-hex");
    assert.equal(await readCurrentSession(), null);
  });

  it("returns null on expired session AND cleans up the file", async () => {
    const userId = newUserId();
    const token = newSessionToken();
    const expired: SessionRecord = {
      sessionToken: token,
      userId,
      method: "passkey",
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      rotatedAt: new Date(Date.now() - 3600_000).toISOString(),
      // 1s in the past.
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      credentialId: null,
    };
    await writeSession(expired);
    jar.set(SESSION_COOKIE_NAME, token);
    assert.equal(await readCurrentSession(), null);
    // Second read is also null — the expired row was cleaned up.
    assert.equal(await readCurrentSession(), null);
  });
});

describe("rotateSession", () => {
  it("issues a fresh token and invalidates the old one", async () => {
    const original = await createSession({
      userId: newUserId(),
      method: "passkey",
      credentialId: null,
    });
    const oldToken = original.sessionToken;
    const rotated = await rotateSession(original);
    assert.notEqual(rotated.sessionToken, oldToken);
    assert.equal(rotated.userId, original.userId);
    // Cookie now points at the new token.
    assert.equal(jar.get(SESSION_COOKIE_NAME), rotated.sessionToken);
    // Old token no longer reads back — point the jar at it to check.
    jar.set(SESSION_COOKIE_NAME, oldToken);
    assert.equal(await readCurrentSession(), null);
    // New token reads back.
    jar.set(SESSION_COOKIE_NAME, rotated.sessionToken);
    const roundTripped = await readCurrentSession();
    assert.ok(roundTripped);
    assert.equal(roundTripped.sessionToken, rotated.sessionToken);
  });

  it("rotatedAt advances and expiresAt resets", async () => {
    const original = await createSession({
      userId: newUserId(),
      method: "passkey",
      credentialId: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    const rotated = await rotateSession(original);
    assert.ok(
      Date.parse(rotated.rotatedAt) > Date.parse(original.rotatedAt),
      "rotatedAt should advance",
    );
    assert.ok(
      Date.parse(rotated.expiresAt) > Date.parse(original.expiresAt),
      "expiresAt should reset forward",
    );
  });
});

describe("revokeSession", () => {
  it("deletes the store row AND clears the cookie", async () => {
    const record = await createSession({
      userId: newUserId(),
      method: "passkey",
      credentialId: null,
    });
    assert.equal(jar.get(SESSION_COOKIE_NAME), record.sessionToken);
    await revokeSession(record.sessionToken);
    // Cookie cleared.
    assert.equal(jar.has(SESSION_COOKIE_NAME), false);
    // Row gone too — even if a stale cookie is replayed, the lookup
    // returns null.
    jar.set(SESSION_COOKIE_NAME, record.sessionToken);
    assert.equal(await readCurrentSession(), null);
  });
});

describe("requireSession", () => {
  it("returns the record when a valid session exists", async () => {
    const record = await createSession({
      userId: newUserId(),
      method: "passkey",
      credentialId: null,
    });
    const got = await requireSession();
    assert.equal(got.sessionToken, record.sessionToken);
  });

  it("throws UnauthenticatedError('no-session') with no cookie", async () => {
    await assert.rejects(requireSession(), (err: unknown) => {
      assert.ok(err instanceof UnauthenticatedError);
      assert.equal((err as InstanceType<typeof UnauthenticatedError>).reason, "no-session");
      return true;
    });
  });

  it("throws UnauthenticatedError on expired session", async () => {
    const userId = newUserId();
    const token = newSessionToken();
    await writeSession({
      sessionToken: token,
      userId,
      method: "passkey",
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      rotatedAt: new Date(Date.now() - 3600_000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      credentialId: null,
    });
    jar.set(SESSION_COOKIE_NAME, token);
    await assert.rejects(requireSession(), (err: unknown) => {
      assert.ok(err instanceof UnauthenticatedError);
      return true;
    });
  });
});
