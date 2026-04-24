/**
 * PANG — signed-link tests (iter #10).
 *
 * Audience discriminator is the load-bearing invariant. The matrix
 * asserts that a token signed for audience X and verified against
 * expected audience Y rejects with `wrong-audience` for every
 * off-diagonal pair. Three audiences today; the matrix grows with the
 * enum.
 *
 * Also exercises:
 *   - Per-audience TTL (collector-invite: 14d; gallery-confirm/decline: 30d).
 *   - Consumed-marker: idempotent write, fail-closed read on unsafe input.
 *   - `tryMarkSignedLinkConsumed` O_EXCL race — exactly one caller wins
 *     when two race on the same jti.
 *   - The verify layer does NOT consult the consumed-marker (caller
 *     owns ordering per primitive 51).
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env["PANG_AUTH_INVITE_SECRET"] = "a".repeat(48);

const {
  SIGNED_LINK_AUDIENCES,
  signSignedLink,
  verifySignedLink,
  SignedLinkVerifyError,
  markSignedLinkConsumed,
  isSignedLinkConsumed,
  tryMarkSignedLinkConsumed,
  ttlSecondsFor,
  __resetSignedLinksForTests,
} = await import("./signed-link");
const { getInviteSecret } = await import("../config");

const inviteInput = { audience: "collector-invite" as const, galleryId: "droste" };
const confirmInput = {
  audience: "gallery-confirm" as const,
  galleryId: "droste",
  verificationRequestId: "vr01a2b3c-abc123d4",
  workId: "wk_001",
};
const declineInput = {
  audience: "gallery-decline" as const,
  galleryId: "droste",
  verificationRequestId: "vr01a2b3c-abc123d4",
  workId: "wk_001",
};

before(async () => {
  await __resetSignedLinksForTests();
});

beforeEach(async () => {
  await __resetSignedLinksForTests();
});

describe("signSignedLink / verifySignedLink", () => {
  it("collector-invite round-trips with expected claims shape", async () => {
    const { jwt, claims } = await signSignedLink(inviteInput);
    const verified = await verifySignedLink(jwt, "collector-invite");
    assert.equal(verified.aud, "collector-invite");
    assert.equal(verified.gid, "droste");
    if (verified.aud === "collector-invite") {
      assert.equal(verified.uid, claims.aud === "collector-invite" ? claims.uid : "");
    }
  });

  it("gallery-confirm round-trips with vrid + wid", async () => {
    const { jwt } = await signSignedLink(confirmInput);
    const verified = await verifySignedLink(jwt, "gallery-confirm");
    assert.equal(verified.aud, "gallery-confirm");
    if (verified.aud === "gallery-confirm") {
      assert.equal(verified.vrid, "vr01a2b3c-abc123d4");
      assert.equal(verified.wid, "wk_001");
      assert.equal(verified.gid, "droste");
    }
  });

  it("gallery-decline round-trips with vrid + wid", async () => {
    const { jwt } = await signSignedLink(declineInput);
    const verified = await verifySignedLink(jwt, "gallery-decline");
    assert.equal(verified.aud, "gallery-decline");
  });

  it("TTLs: invite 14d, confirm/decline 30d", () => {
    assert.equal(ttlSecondsFor("collector-invite"), 14 * 24 * 60 * 60);
    assert.equal(ttlSecondsFor("gallery-confirm"), 30 * 24 * 60 * 60);
    assert.equal(ttlSecondsFor("gallery-decline"), 30 * 24 * 60 * 60);
  });

  it("exp matches the audience TTL", async () => {
    const { claims: ci } = await signSignedLink(inviteInput);
    assert.equal(ci.exp - ci.iat, 14 * 24 * 60 * 60);
    const { claims: cc } = await signSignedLink(confirmInput);
    assert.equal(cc.exp - cc.iat, 30 * 24 * 60 * 60);
  });
});

describe("audience cross-rejection matrix (3 × 3)", () => {
  // All 9 pairs. The 3 diagonal pairs succeed; the 6 off-diagonal pairs
  // reject with reason 'wrong-audience'.
  const presented = [
    { audience: "collector-invite", input: inviteInput },
    { audience: "gallery-confirm", input: confirmInput },
    { audience: "gallery-decline", input: declineInput },
  ] as const;

  for (const p of presented) {
    for (const expected of SIGNED_LINK_AUDIENCES) {
      if (p.audience === expected) {
        it(`${p.audience} → ${expected} accepts`, async () => {
          const { jwt } = await signSignedLink(p.input);
          const verified = await verifySignedLink(jwt, expected);
          assert.equal(verified.aud, expected);
        });
      } else {
        it(`${p.audience} → ${expected} rejects with wrong-audience`, async () => {
          const { jwt } = await signSignedLink(p.input);
          await assert.rejects(verifySignedLink(jwt, expected), (err: unknown) => {
            assert.ok(err instanceof SignedLinkVerifyError);
            assert.equal(
              (err as InstanceType<typeof SignedLinkVerifyError>).reason,
              "wrong-audience",
            );
            return true;
          });
        });
      }
    }
  }
});

describe("verifySignedLink error reasons", () => {
  it("rejects garbage with bad-jwt", async () => {
    await assert.rejects(verifySignedLink("not.a.jwt", "collector-invite"), (err: unknown) => {
      assert.ok(err instanceof SignedLinkVerifyError);
      assert.equal(
        (err as InstanceType<typeof SignedLinkVerifyError>).reason,
        "bad-jwt",
      );
      return true;
    });
  });

  it("rejects expired jwt with 'expired'", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({
      aud: "collector-invite",
      gid: "droste",
      uid: "u_" + "c".repeat(22),
      uhandle: "d".repeat(22),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now - 3600)
      .setExpirationTime(now - 60)
      .setJti("test-expired-jti")
      .sign(getInviteSecret());
    await assert.rejects(verifySignedLink(expired, "collector-invite"), (err: unknown) => {
      assert.ok(err instanceof SignedLinkVerifyError);
      assert.equal(
        (err as InstanceType<typeof SignedLinkVerifyError>).reason,
        "expired",
      );
      return true;
    });
  });

  it("rejects malformed payload with 'bad-payload'", async () => {
    const now = Math.floor(Date.now() / 1000);
    const mal = await new SignJWT({
      aud: "collector-invite",
      gid: "droste",
      // missing uid + uhandle
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setJti("test-malformed-jti")
      .sign(getInviteSecret());
    await assert.rejects(verifySignedLink(mal, "collector-invite"), (err: unknown) => {
      assert.ok(err instanceof SignedLinkVerifyError);
      assert.equal(
        (err as InstanceType<typeof SignedLinkVerifyError>).reason,
        "bad-payload",
      );
      return true;
    });
  });
});

describe("consumed-marker (per audience)", () => {
  it("unmarked jti is not consumed", async () => {
    assert.equal(await isSignedLinkConsumed("gallery-confirm", "test-jti"), false);
  });

  it("markSignedLinkConsumed is idempotent", async () => {
    await markSignedLinkConsumed("gallery-confirm", "test-jti");
    assert.equal(await isSignedLinkConsumed("gallery-confirm", "test-jti"), true);
    // Second call does not throw.
    await markSignedLinkConsumed("gallery-confirm", "test-jti");
    assert.equal(await isSignedLinkConsumed("gallery-confirm", "test-jti"), true);
  });

  it("marker is per-audience (confirm does NOT leak to decline)", async () => {
    await markSignedLinkConsumed("gallery-confirm", "test-jti");
    assert.equal(await isSignedLinkConsumed("gallery-confirm", "test-jti"), true);
    assert.equal(await isSignedLinkConsumed("gallery-decline", "test-jti"), false);
    assert.equal(await isSignedLinkConsumed("collector-invite", "test-jti"), false);
  });

  it("rejects unsafe jti shapes (throws on mark; fails closed on read)", async () => {
    await assert.rejects(markSignedLinkConsumed("gallery-confirm", "../traversal"));
    assert.equal(await isSignedLinkConsumed("gallery-confirm", "../traversal"), true);
  });
});

describe("tryMarkSignedLinkConsumed (O_EXCL race)", () => {
  it("two races on the same jti: exactly one wins", async () => {
    const [a, b] = await Promise.all([
      tryMarkSignedLinkConsumed("gallery-confirm", "race-jti"),
      tryMarkSignedLinkConsumed("gallery-confirm", "race-jti"),
    ]);
    const wins = [a.won, b.won].filter(Boolean).length;
    assert.equal(wins, 1, "exactly one caller won the race");
  });

  it("a subsequent call returns won=false (marker already exists)", async () => {
    const first = await tryMarkSignedLinkConsumed("gallery-confirm", "race-jti-2");
    assert.equal(first.won, true);
    const second = await tryMarkSignedLinkConsumed("gallery-confirm", "race-jti-2");
    assert.equal(second.won, false);
  });

  it("interleaves with markSignedLinkConsumed (mark-first blocks try)", async () => {
    await markSignedLinkConsumed("gallery-confirm", "race-jti-3");
    const res = await tryMarkSignedLinkConsumed("gallery-confirm", "race-jti-3");
    assert.equal(res.won, false);
  });
});

describe("verify does NOT auto-check consumed-marker", () => {
  it("a consumed jti still verifies — the caller owns the replay check", async () => {
    const { jwt, claims } = await signSignedLink(inviteInput);
    await markSignedLinkConsumed("collector-invite", claims.jti);
    // verify succeeds; it's the caller's job to check the marker
    // before performing the guarded side effect.
    const verified = await verifySignedLink(jwt, "collector-invite");
    assert.equal(verified.jti, claims.jti);
  });
});
