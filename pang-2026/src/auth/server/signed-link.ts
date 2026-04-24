/**
 * PANG — signed-link sign + verify (iter #10).
 *
 * Generalises the iter #9 invite JWT into an audience-discriminated
 * family. Three audiences today:
 *
 *   - "collector-invite"   — the gallery mints; the collector clicks;
 *                            the bind route trades for a cookie. This
 *                            is the iter #9 shape preserved byte-for-
 *                            byte.
 *   - "gallery-confirm"    — PANG mints on dispatch; the gallery clicks;
 *                            the confirm route writes the outcome.
 *   - "gallery-decline"    — mirror of confirm.
 *
 * What's new vs. iter #9's `invite.ts`:
 *
 *   - `aud` claim is load-bearing. A confirm token presented at the
 *     decline route (or vice versa) rejects with `wrong-audience`.
 *     Signed in; verified out; the matrix test covers all nine
 *     presented-vs-expected pairs.
 *   - Per-audience TTL. Invites live 14 days; confirm / decline live
 *     30 days (galleries triage on a weekly cadence).
 *   - Per-audience consumed-marker directory at
 *     `.pang/server-signed-links/<audience>/<jti>.consumed` instead
 *     of a single `server-invites/` dir.
 *   - Claims shape is audience-specific. Invite carries
 *     `{gid, uid, uhandle}`; confirm / decline carry
 *     `{gid, vrid, wid}`.
 *
 * Security rules preserved from iter #9:
 *
 *   - HS256 + `jose`; secret rotates per deployment via env.
 *   - jti is a 16-byte CSPRNG value (base64url).
 *   - Consumed-marker commits BEFORE the guarded side effect (primitive
 *     51); a replay reads the marker and fails closed.
 *   - A revoked / consumed record tombstones by move to the consumed
 *     directory — we never delete (primitive 50).
 *
 * `invite.ts` re-exports this module's collector-invite surface so the
 * iter #9 call sites keep working through the refactor. The re-export
 * is deleted in a follow-up commit in the same PR.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getInviteSecret, INVITE_TTL_SECONDS } from "../config";
import { newInviteJti, newUserHandle, newUserId } from "../ids";
import { UserIdSchema } from "../schema";

// ---------- Audience ----------------------------------------------

export const SIGNED_LINK_AUDIENCES = [
  "collector-invite",
  "gallery-confirm",
  "gallery-decline",
] as const;

export type SignedLinkAudience = (typeof SIGNED_LINK_AUDIENCES)[number];

const SignedLinkAudienceSchema = z.enum(SIGNED_LINK_AUDIENCES);

/** Per-audience TTL (seconds). */
const TTL_SECONDS: Readonly<Record<SignedLinkAudience, number>> = {
  "collector-invite": INVITE_TTL_SECONDS,
  // Galleries triage on a weekly cadence; 30 days covers a registrar
  // returning from holiday without the link expiring in the interim.
  "gallery-confirm": 30 * 24 * 60 * 60,
  "gallery-decline": 30 * 24 * 60 * 60,
};

export function ttlSecondsFor(audience: SignedLinkAudience): number {
  return TTL_SECONDS[audience];
}

// ---------- Claims (per audience) ---------------------------------

const CollectorInviteClaimsSchema = z
  .object({
    aud: z.literal("collector-invite"),
    gid: z.string().min(1).max(64),
    uid: UserIdSchema,
    uhandle: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    jti: z.string().min(1).max(128),
    iat: z.number().int(),
    exp: z.number().int(),
  })
  .strict();

const GalleryOutcomeClaimsSchema = z
  .object({
    aud: z.enum(["gallery-confirm", "gallery-decline"]),
    gid: z.string().min(1).max(64),
    /** Verification request id (ULID-shaped, from the outbox). */
    vrid: z.string().min(12).max(40).regex(/^[0-9a-z]+-[0-9a-z]+$/),
    /** Work id — the gallery sees it to recognise the piece. */
    wid: z.string().min(1).max(64),
    jti: z.string().min(1).max(128),
    iat: z.number().int(),
    exp: z.number().int(),
  })
  .strict();

export const SignedLinkClaimsSchema = z.discriminatedUnion("aud", [
  CollectorInviteClaimsSchema,
  GalleryOutcomeClaimsSchema.extend({ aud: z.literal("gallery-confirm") }),
  GalleryOutcomeClaimsSchema.extend({ aud: z.literal("gallery-decline") }),
]);

export type CollectorInviteClaims = z.infer<
  typeof CollectorInviteClaimsSchema
>;
export type GalleryOutcomeClaims = z.infer<
  typeof GalleryOutcomeClaimsSchema
> & { readonly aud: "gallery-confirm" | "gallery-decline" };
export type SignedLinkClaims =
  | CollectorInviteClaims
  | GalleryOutcomeClaims;

// ---------- Sign input / result -----------------------------------

export interface CollectorInviteSignInput {
  readonly audience: "collector-invite";
  readonly galleryId: string;
  /** Optional override — present when the gallery pre-provisioned the user. */
  readonly userId?: string;
  /** Optional override — paired with userId. */
  readonly userHandle?: string;
}

export interface GalleryOutcomeSignInput {
  readonly audience: "gallery-confirm" | "gallery-decline";
  readonly galleryId: string;
  readonly verificationRequestId: string;
  readonly workId: string;
}

export type SignedLinkSignInput =
  | CollectorInviteSignInput
  | GalleryOutcomeSignInput;

export interface SignedLinkResult<C extends SignedLinkClaims = SignedLinkClaims> {
  readonly jwt: string;
  readonly claims: C;
}

/**
 * Sign a signed link. The audience discriminates both the claims
 * shape and the TTL.
 */
export async function signSignedLink(
  input: SignedLinkSignInput,
): Promise<SignedLinkResult> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = ttlSecondsFor(input.audience);
  const exp = now + ttl;
  const jti = newInviteJti();

  if (input.audience === "collector-invite") {
    const userId = input.userId ?? newUserId();
    const userHandle = input.userHandle ?? newUserHandle();
    const payload = {
      aud: "collector-invite" as const,
      gid: input.galleryId,
      uid: userId,
      uhandle: userHandle,
    };
    const jwt = await new SignJWT(payload as unknown as JWTPayload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(getInviteSecret());
    const claims: CollectorInviteClaims = {
      ...payload,
      jti,
      iat: now,
      exp,
    };
    return { jwt, claims };
  }

  const payload = {
    aud: input.audience,
    gid: input.galleryId,
    vrid: input.verificationRequestId,
    wid: input.workId,
  };
  const jwt = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(getInviteSecret());
  const claims: GalleryOutcomeClaims = {
    ...payload,
    jti,
    iat: now,
    exp,
  };
  return { jwt, claims };
}

// ---------- Verify -------------------------------------------------

export class SignedLinkVerifyError extends Error {
  readonly reason:
    | "bad-jwt"
    | "expired"
    | "bad-payload"
    | "wrong-audience"
    | "consumed";
  constructor(
    reason: SignedLinkVerifyError["reason"],
    message?: string,
  ) {
    super(message ?? reason);
    this.reason = reason;
    this.name = "SignedLinkVerifyError";
  }
}

/**
 * Verify a signed link and assert its audience matches
 * `expectedAudience`. The audience match is a strict equality check —
 * a `gallery-confirm` token presented as `gallery-decline` rejects
 * with `wrong-audience`. The matrix test covers all nine pairs.
 *
 * Does NOT check the consumed-marker — that's a separate step so the
 * caller can own the ordering (primitive 51: the marker is committed
 * before the guarded side effect; verify reads the claims first, then
 * the caller checks + commits the marker atomically).
 */
export async function verifySignedLink(
  jwt: string,
  expectedAudience: SignedLinkAudience,
): Promise<SignedLinkClaims> {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(jwt, getInviteSecret(), {
      algorithms: ["HS256"],
    });
    payload = result.payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === "JWTExpired") {
      throw new SignedLinkVerifyError("expired", msg);
    }
    throw new SignedLinkVerifyError("bad-jwt", msg);
  }

  const parsed = SignedLinkClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SignedLinkVerifyError(
      "bad-payload",
      JSON.stringify(parsed.error.flatten()),
    );
  }

  if (parsed.data.aud !== expectedAudience) {
    throw new SignedLinkVerifyError(
      "wrong-audience",
      `presented=${parsed.data.aud} expected=${expectedAudience}`,
    );
  }

  return parsed.data;
}

// ---------- Consumed marker (per audience) ------------------------

const ROOT = path.resolve(process.cwd(), ".pang");
const SIGNED_LINKS_ROOT = path.join(ROOT, "server-signed-links");

function consumedDir(audience: SignedLinkAudience): string {
  return path.join(SIGNED_LINKS_ROOT, audience);
}

function sanitiseJti(jti: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(jti)) {
    throw new Error(`unsafe signed-link jti: ${jti.slice(0, 16)}`);
  }
  return jti;
}

/**
 * Mark the signed link consumed. Idempotent — a second call with the
 * same jti + audience returns silently.
 *
 * Primitive 51: callers must commit this marker BEFORE the guarded
 * side effect. A replay attempt reads the marker and fails closed.
 */
export async function markSignedLinkConsumed(
  audience: SignedLinkAudience,
  jti: string,
): Promise<void> {
  SignedLinkAudienceSchema.parse(audience);
  const safe = sanitiseJti(jti);
  const dir = consumedDir(audience);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `${safe}.consumed`);
  const tmp = `${target}.tmp`;
  await fs.writeFile(
    tmp,
    JSON.stringify({
      audience,
      jti: safe,
      consumedAt: new Date().toISOString(),
    }),
    "utf8",
  );
  await fs.rename(tmp, target);
}

export async function isSignedLinkConsumed(
  audience: SignedLinkAudience,
  jti: string,
): Promise<boolean> {
  SignedLinkAudienceSchema.parse(audience);
  if (!/^[A-Za-z0-9_-]+$/.test(jti)) return true;
  const safe = sanitiseJti(jti);
  const target = path.join(consumedDir(audience), `${safe}.consumed`);
  try {
    await fs.stat(target);
    return true;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * Atomically record a consumed-marker using `O_CREAT | O_EXCL`.
 * Returns true if this caller won the race and should proceed with
 * the side effect; false if the marker already existed (replay /
 * double-commit).
 *
 * This is the shape used by the gallery-side race-on-confirm path —
 * two operators tap the same link at the same time; exactly one
 * wins. Separate from `markSignedLinkConsumed` because the invite
 * flow uses a simpler write-through pattern (it doesn't race).
 */
export async function tryMarkSignedLinkConsumed(
  audience: SignedLinkAudience,
  jti: string,
): Promise<{ readonly won: boolean }> {
  SignedLinkAudienceSchema.parse(audience);
  const safe = sanitiseJti(jti);
  const dir = consumedDir(audience);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `${safe}.consumed`);
  try {
    const handle = await fs.open(target, "wx");
    try {
      await handle.writeFile(
        JSON.stringify({
          audience,
          jti: safe,
          consumedAt: new Date().toISOString(),
        }),
        "utf8",
      );
    } finally {
      await handle.close();
    }
    return { won: true };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "EEXIST"
    ) {
      return { won: false };
    }
    throw err;
  }
}

// ---------- Test helpers ------------------------------------------

/** Test-only: reset all consumed-marker directories. */
export async function __resetSignedLinksForTests(): Promise<void> {
  try {
    for (const audience of SIGNED_LINK_AUDIENCES) {
      const dir = consumedDir(audience);
      const entries = await fs.readdir(dir).catch(() => [] as string[]);
      for (const name of entries) {
        if (name === ".gitkeep") continue;
        await fs.unlink(path.join(dir, name)).catch(() => {});
      }
    }
  } catch {
    // non-fatal
  }
}
