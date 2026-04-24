/**
 * PANG — invite JWT sign + verify tests.
 *
 * Locks the shape of the claims, the HS256 sign/verify roundtrip, and
 * the three error reasons `verifyInvite` emits. No filesystem, no
 * cookies — pure JWT algebra.
 *
 * The `getInviteSecret()` helper is env-backed with a named dev
 * fallback; we set the env var here so the secret is deterministic
 * and the test doesn't race the config module's lazy init.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
// Type-only import so `InviteVerifyError` is usable as a type in
// error-predicate narrowing below. The runtime value comes from the
// dynamic `await import()` so the env override above lands first.
import type { InviteVerifyError as InviteVerifyErrorType } from "./invite";

// Deterministic invite secret for the whole file.
process.env["PANG_AUTH_INVITE_SECRET"] = "a".repeat(48); // ≥ 32 chars

const { signInvite, verifyInvite, InviteVerifyError, InviteClaimsSchema } =
  await import("./invite");
const { getInviteSecret } = await import("../config");

describe("signInvite", () => {
  it("produces a parseable HS256 JWT whose claims round-trip", async () => {
    const { jwt, claims } = await signInvite({ galleryId: "droste" });
    assert.match(jwt, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const verified = await verifyInvite(jwt);
    assert.equal(verified.gid, "droste");
    assert.equal(verified.uid, claims.uid);
    assert.equal(verified.uhandle, claims.uhandle);
    assert.equal(verified.jti, claims.jti);
    assert.equal(verified.iat, claims.iat);
    assert.equal(verified.exp, claims.exp);
  });

  it("accepts pre-provisioned userId + userHandle", async () => {
    const userId = "u_" + "a".repeat(22);
    const userHandle = "b".repeat(22);
    const { claims } = await signInvite({
      galleryId: "droste",
      userId,
      userHandle,
    });
    assert.equal(claims.uid, userId);
    assert.equal(claims.uhandle, userHandle);
  });

  it("claims pass strict Zod validation", async () => {
    const { claims } = await signInvite({ galleryId: "droste" });
    const parsed = InviteClaimsSchema.safeParse(claims);
    assert.ok(parsed.success, JSON.stringify(parsed));
  });

  it("exp is INVITE_TTL_SECONDS (14d) after iat", async () => {
    const { claims } = await signInvite({ galleryId: "droste" });
    assert.equal(claims.exp - claims.iat, 14 * 24 * 60 * 60);
  });
});

describe("verifyInvite", () => {
  it("rejects a bad signature with reason 'bad-jwt'", async () => {
    const { jwt } = await signInvite({ galleryId: "droste" });
    // Flip one char in the signature segment.
    const parts = jwt.split(".");
    parts[2] = parts[2]!.split("").reverse().join("");
    const tampered = parts.join(".");
    await assert.rejects(verifyInvite(tampered), (err: unknown) => {
      assert.ok(err instanceof InviteVerifyError);
      assert.equal((err as InviteVerifyErrorType).reason, "bad-jwt");
      return true;
    });
  });

  it("rejects an expired JWT with reason 'expired'", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({
      gid: "droste",
      uid: "u_" + "c".repeat(22),
      uhandle: "d".repeat(22),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now - 3600)
      .setExpirationTime(now - 60) // 1 min in the past
      .setJti("test-jti")
      .sign(getInviteSecret());
    await assert.rejects(verifyInvite(expired), (err: unknown) => {
      assert.ok(err instanceof InviteVerifyError);
      assert.equal((err as InviteVerifyErrorType).reason, "expired");
      return true;
    });
  });

  it("rejects a JWT with a valid signature but malformed payload", async () => {
    const now = Math.floor(Date.now() / 1000);
    const mal = await new SignJWT({
      // missing uid, uhandle
      gid: "droste",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setJti("test-jti-2")
      .sign(getInviteSecret());
    await assert.rejects(verifyInvite(mal), (err: unknown) => {
      assert.ok(err instanceof InviteVerifyError);
      assert.equal((err as InviteVerifyErrorType).reason, "bad-payload");
      return true;
    });
  });

  it("rejects garbage that isn't even a JWT", async () => {
    await assert.rejects(verifyInvite("not.a.jwt"), (err: unknown) => {
      assert.ok(err instanceof InviteVerifyError);
      assert.equal((err as InviteVerifyErrorType).reason, "bad-jwt");
      return true;
    });
  });
});
