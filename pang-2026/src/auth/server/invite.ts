/**
 * PANG — invite JWT sign + verify (iter #9, thin wrapper in iter #10).
 *
 * As of iter #10, the invite token is one audience in the signed-link
 * family (see `signed-link.ts` for the full doctrine). This file is a
 * thin compatibility wrapper that:
 *
 *   - Delegates sign/verify to `signSignedLink` / `verifySignedLink`
 *     with `audience: "collector-invite"`.
 *   - Preserves the iter #9 claims shape for call sites —
 *     `InviteClaims` is `{gid, uid, uhandle, jti, iat, exp}`; the
 *     internal `aud` is added by the signed-link layer and stripped
 *     here so call sites don't need to know about it.
 *   - Preserves the iter #9 error type `InviteVerifyError` with its
 *     three reasons `bad-jwt | expired | bad-payload`. If the JWT
 *     carries a non-collector audience it surfaces here as
 *     `bad-payload` (the collector-invite bind route has no legitimate
 *     reason to accept anything else).
 *
 * The wrapper will be removed in a follow-up once the bind route
 * imports directly from `signed-link.ts`.
 */

import { z } from "zod";
import {
  SignedLinkVerifyError,
  signSignedLink,
  verifySignedLink,
} from "./signed-link";
import { UserIdSchema } from "../schema";

// ---------- Claims -------------------------------------------------

/**
 * Public iter #9 claims shape. The `aud` claim is an implementation
 * detail of the signed-link layer and is stripped at the wrapper
 * boundary.
 */
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
  const signInput: {
    audience: "collector-invite";
    galleryId: string;
    userId?: string;
    userHandle?: string;
  } = {
    audience: "collector-invite",
    galleryId: input.galleryId,
  };
  if (input.userId !== undefined) signInput.userId = input.userId;
  if (input.userHandle !== undefined) signInput.userHandle = input.userHandle;
  const { jwt, claims } = await signSignedLink(signInput);
  if (claims.aud !== "collector-invite") {
    // Unreachable — the audience we requested round-trips.
    throw new Error("audience mismatch in signInvite wrapper");
  }
  return {
    jwt,
    claims: {
      gid: claims.gid,
      uid: claims.uid,
      uhandle: claims.uhandle,
      jti: claims.jti,
      iat: claims.iat,
      exp: claims.exp,
    },
  };
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
  let claims;
  try {
    claims = await verifySignedLink(jwt, "collector-invite");
  } catch (err) {
    if (err instanceof SignedLinkVerifyError) {
      switch (err.reason) {
        case "expired":
          throw new InviteVerifyError("expired", err.message);
        case "wrong-audience":
        case "bad-payload":
          throw new InviteVerifyError("bad-payload", err.message);
        case "consumed":
          // Not produced by verify (consumed-marker is caller-owned);
          // treat defensively as bad-payload.
          throw new InviteVerifyError("bad-payload", err.message);
        case "bad-jwt":
        default:
          throw new InviteVerifyError("bad-jwt", err.message);
      }
    }
    throw err;
  }
  if (claims.aud !== "collector-invite") {
    throw new InviteVerifyError("bad-payload", "wrong audience");
  }
  return {
    gid: claims.gid,
    uid: claims.uid,
    uhandle: claims.uhandle,
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp,
  };
}
