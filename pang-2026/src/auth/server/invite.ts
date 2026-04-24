/**
 * PANG — invite JWT sign + verify (iter #9).
 *
 * The gallery mints an invite JWT and embeds it in the link shared
 * with the collector. The `/api/auth/invite/bind` route trades the
 * JWT for a bind cookie + starts the enrollment ceremony. Tokens are
 * single-use — the bind route writes a consumed-marker before it
 * issues the cookie.
 *
 * HS256 is the signing alg. The secret rotates per deployment in
 * production; `getInviteSecret()` reads it from env. The jti is a
 * 16-byte CSPRNG value (base64url) assigned at sign time.
 *
 * Claims:
 *   { iat, exp, jti, gid (gallery id), uid (user id assigned at
 *     invite time — the collector's identity is known the moment
 *     the gallery issues the link) }
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { getInviteSecret, INVITE_TTL_SECONDS } from "../config";
import { newInviteJti, newUserHandle, newUserId } from "../ids";
import { UserIdSchema } from "../schema";

// ---------- Claims -------------------------------------------------

export const InviteClaimsSchema = z
  .object({
    gid: z.string().min(1).max(64),
    uid: UserIdSchema,
    uhandle: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    jti: z.string().min(1).max(128),
    iat: z.number().int(),
    exp: z.number().int(),
  })
  .strict();
export type InviteClaims = z.infer<typeof InviteClaimsSchema>;

// ---------- Sign ---------------------------------------------------

export interface InviteInput {
  galleryId: string;
  /** Optional override — present when the gallery pre-provisioned the user. */
  userId?: string;
  /** Optional override — paired with userId. */
  userHandle?: string;
}

export interface InviteResult {
  jwt: string;
  claims: InviteClaims;
}

export async function signInvite(input: InviteInput): Promise<InviteResult> {
  const userId = input.userId ?? newUserId();
  const userHandle = input.userHandle ?? newUserHandle();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + INVITE_TTL_SECONDS;
  const jti = newInviteJti();
  const payload = {
    gid: input.galleryId,
    uid: userId,
    uhandle: userHandle,
  } satisfies Partial<InviteClaims>;
  const jwt = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(getInviteSecret());
  const claims: InviteClaims = {
    ...payload,
    jti,
    iat: now,
    exp,
  };
  return { jwt, claims };
}

// ---------- Verify -------------------------------------------------

export class InviteVerifyError extends Error {
  readonly reason: "bad-jwt" | "expired" | "bad-payload";
  constructor(reason: "bad-jwt" | "expired" | "bad-payload", message?: string) {
    super(message ?? reason);
    this.reason = reason;
    this.name = "InviteVerifyError";
  }
}

export async function verifyInvite(jwt: string): Promise<InviteClaims> {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(jwt, getInviteSecret(), {
      algorithms: ["HS256"],
    });
    payload = result.payload;
  } catch (err) {
    // jose throws for signature mismatch, expired, malformed.
    const msg = err instanceof Error ? err.message : String(err);
    // The exp path surfaces as `ERR_JWT_EXPIRED` in jose's error name.
    if (err instanceof Error && err.name === "JWTExpired") {
      throw new InviteVerifyError("expired", msg);
    }
    throw new InviteVerifyError("bad-jwt", msg);
  }

  const parsed = InviteClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new InviteVerifyError("bad-payload", JSON.stringify(parsed.error.flatten()));
  }
  return parsed.data;
}
