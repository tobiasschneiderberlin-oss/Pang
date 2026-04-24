/**
 * PANG — WebAuthn options generation (iter #9).
 *
 * Enrollment and assertion options issued by `/api/auth/passkey/options`.
 * Challenges are stored server-side (one-use, TTL 90s) and looked up
 * on enroll/assert by the challenge value itself — there is no
 * client-side challenge signing, so replay is prevented by
 * server-owned state rather than a cookie round-trip.
 *
 * We use `@simplewebauthn/server` so the CBOR + COSE complexity is
 * not ours to own. Its `generateRegistrationOptions` /
 * `generateAuthenticationOptions` helpers produce the right-shape
 * PublicKeyCredential*Options the browser expects.
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type GenerateAuthenticationOptionsOpts,
  type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { getRpId, getRpName, CHALLENGE_TTL_SECONDS } from "../config";
import { newChallenge } from "../ids";
import { ChallengeRecordSchema, type ChallengeRecord } from "../schema";
import { writeChallenge } from "../server/store";

// ---------- Enrollment --------------------------------------------

export interface EnrollOptionsInput {
  readonly userId: string;
  readonly userHandle: string;
  readonly bindSessionToken: string;
}

export interface EnrollOptionsOutput {
  readonly options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
  readonly challenge: string;
}

export async function mintEnrollOptions(
  input: EnrollOptionsInput,
): Promise<EnrollOptionsOutput> {
  const challenge = newChallenge();
  const opts: GenerateRegistrationOptionsOpts = {
    rpID: getRpId(),
    rpName: getRpName(),
    userID: new TextEncoder().encode(input.userHandle),
    userName: input.userId, // visible in platform UI; userId is the id, not PII
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    challenge: base64UrlToBuffer(challenge),
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  };
  const options = await generateRegistrationOptions(opts);
  await stashChallenge({
    challenge,
    purpose: "enroll",
    scope: { kind: "bind", bindSessionToken: input.bindSessionToken },
  });
  return { options, challenge };
}

// ---------- Assertion ---------------------------------------------

export interface AssertOptionsInput {
  /** Credential ids to advertise to the authenticator. Empty for conditional UI (discoverable-only). */
  readonly allowCredentialIds: readonly {
    id: string;
    transports: readonly AuthenticatorTransportFuture[];
  }[];
}

export interface AssertOptionsOutput {
  readonly options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
  readonly challenge: string;
}

export async function mintAssertOptions(
  input: AssertOptionsInput,
): Promise<AssertOptionsOutput> {
  const challenge = newChallenge();
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: getRpId(),
    userVerification: "required",
    challenge: base64UrlToBuffer(challenge),
    allowCredentials: input.allowCredentialIds.length
      ? input.allowCredentialIds.map((c) => ({
          id: c.id,
          transports: [...c.transports],
        }))
      : [],
  };
  const options = await generateAuthenticationOptions(opts);
  await stashChallenge({
    challenge,
    purpose: "assert",
    scope: { kind: "public" },
  });
  return { options, challenge };
}

// ---------- Helpers -----------------------------------------------

function base64UrlToBuffer(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface StashInput {
  readonly challenge: string;
  readonly purpose: ChallengeRecord["purpose"];
  readonly scope: ChallengeRecord["scope"];
}

async function stashChallenge(input: StashInput): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000);
  const record: ChallengeRecord = ChallengeRecordSchema.parse({
    challenge: input.challenge,
    purpose: input.purpose,
    scope: input.scope,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  await writeChallenge(record);
}
