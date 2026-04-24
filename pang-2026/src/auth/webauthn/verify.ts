/**
 * PANG — WebAuthn enroll + assert verification (iter #9).
 *
 * Thin wrapper around `@simplewebauthn/server`'s
 * `verifyRegistrationResponse` and `verifyAuthenticationResponse`.
 * The wrapper layer adds three behaviours the raw library doesn't
 * own:
 *
 *   1. Challenge lookup via our single-use `takeChallenge()` store.
 *      The library accepts a `expectedChallenge` string; we supply
 *      the challenge from the record and delete it on read.
 *   2. Origin allow-listing via `getAllowedOrigins()`. The request
 *      origin is asserted against the list before any CBOR parse.
 *   3. Clone-detector escalation: if the stored counter exceeds the
 *      response counter, the credential is moved to the revoked
 *      store and an `auth.passkey.clone_detected` span fires.
 */

import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { withOtelSpan } from "@/lib/otel/span";
import { getAllowedOrigins, getRpId } from "../config";
import {
  listCredentialsForUser,
  readCredential,
  revokeCredential,
  takeChallenge,
  writeCredential,
  writeUser,
} from "../server/store";
import { UserRecordSchema, type CredentialRecord } from "../schema";

// ---------- Enrollment --------------------------------------------

export interface EnrollVerifyInput {
  readonly response: RegistrationResponseJSON;
  /** The userId the bind session committed to. */
  readonly userId: string;
  /** The userHandle the invite JWT assigned. */
  readonly userHandle: string;
  /** The gallery id from the invite. */
  readonly galleryId: string;
}

export type EnrollVerifyResult =
  | { ok: true; credential: CredentialRecord }
  | { ok: false; reason: EnrollFailureReason };

export type EnrollFailureReason =
  | "bad-challenge"
  | "bad-origin"
  | "not-verified"
  | "credential-exists"
  | "internal";

export async function verifyEnroll(
  input: EnrollVerifyInput,
): Promise<EnrollVerifyResult> {
  return withOtelSpan("auth.passkey.enroll.verify", async (span) => {
    span.setAttribute("pang.auth.user_id", input.userId);
    const challengeRecord = await takeChallenge(
      input.response.response.clientDataJSON
        ? decodeClientDataChallenge(input.response.response.clientDataJSON)
        : "",
    );
    if (challengeRecord === null || challengeRecord.purpose !== "enroll") {
      span.setAttribute("pang.auth.fail_reason", "bad-challenge");
      return { ok: false, reason: "bad-challenge" as const };
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: [...getAllowedOrigins()],
        expectedRPID: getRpId(),
        requireUserVerification: true,
      });
    } catch (err) {
      span.recordException(err);
      span.setAttribute("pang.auth.fail_reason", "not-verified");
      return { ok: false, reason: "not-verified" as const };
    }

    if (!verification.verified || !verification.registrationInfo) {
      span.setAttribute("pang.auth.fail_reason", "not-verified");
      return { ok: false, reason: "not-verified" as const };
    }

    // SimpleWebAuthn v11 introduced a flattened shape — credential is
    // at `registrationInfo.credential`. The older shape used separate
    // `credentialID`, `credentialPublicKey`, `counter` fields.
    const info = verification.registrationInfo;
    const credential = info.credential;
    if (!credential) {
      span.setAttribute("pang.auth.fail_reason", "not-verified");
      return { ok: false, reason: "not-verified" as const };
    }

    const credentialId = credential.id;
    const existing = await readCredential(credentialId);
    if (existing !== null) {
      span.setAttribute("pang.auth.fail_reason", "credential-exists");
      return { ok: false, reason: "credential-exists" as const };
    }

    const publicKeyB64Url = toBase64Url(credential.publicKey);
    const record: CredentialRecord = {
      credentialId,
      userId: input.userId,
      publicKey: publicKeyB64Url,
      counter: credential.counter,
      transports: (credential.transports ?? []) as CredentialRecord["transports"],
      credentialDeviceType: info.credentialDeviceType,
      credentialBackedUp: info.credentialBackedUp,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      revocationReason: null,
    };

    // Persist the user row first — on crash the credential is
    // orphaned, but the user record is harmless.
    await writeUser(
      UserRecordSchema.parse({
        userId: input.userId,
        userHandle: input.userHandle,
        createdAt: record.createdAt,
        galleryId: input.galleryId,
      }),
    );
    await writeCredential(record);

    span.setAttribute("pang.auth.credential_id", credentialId);
    span.setAttribute("pang.auth.device_type", info.credentialDeviceType);
    span.setAttribute("pang.auth.backed_up", info.credentialBackedUp);
    return { ok: true, credential: record };
  });
}

// ---------- Assertion ---------------------------------------------

export interface AssertVerifyInput {
  readonly response: AuthenticationResponseJSON;
}

export type AssertVerifyResult =
  | { ok: true; credential: CredentialRecord }
  | { ok: false; reason: AssertFailureReason };

export type AssertFailureReason =
  | "bad-challenge"
  | "bad-origin"
  | "not-verified"
  | "unknown-credential"
  | "revoked"
  | "clone-detected"
  | "internal";

export async function verifyAssert(
  input: AssertVerifyInput,
): Promise<AssertVerifyResult> {
  return withOtelSpan("auth.passkey.assert.verify", async (span) => {
    const credentialId = input.response.id;
    span.setAttribute("pang.auth.credential_id", credentialId);

    const credential = await readCredential(credentialId);
    if (credential === null) {
      span.setAttribute("pang.auth.fail_reason", "unknown-credential");
      return { ok: false, reason: "unknown-credential" as const };
    }
    if (credential.revokedAt !== null) {
      span.setAttribute("pang.auth.fail_reason", "revoked");
      return { ok: false, reason: "revoked" as const };
    }

    const challengeRecord = await takeChallenge(
      decodeClientDataChallenge(input.response.response.clientDataJSON),
    );
    if (challengeRecord === null || challengeRecord.purpose !== "assert") {
      span.setAttribute("pang.auth.fail_reason", "bad-challenge");
      return { ok: false, reason: "bad-challenge" as const };
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: [...getAllowedOrigins()],
        expectedRPID: getRpId(),
        requireUserVerification: true,
        credential: {
          id: credential.credentialId,
          publicKey: fromBase64Url(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch (err) {
      span.recordException(err);
      span.setAttribute("pang.auth.fail_reason", "not-verified");
      return { ok: false, reason: "not-verified" as const };
    }

    if (!verification.verified) {
      span.setAttribute("pang.auth.fail_reason", "not-verified");
      return { ok: false, reason: "not-verified" as const };
    }

    const newCounter = verification.authenticationInfo.newCounter;
    if (credential.counter > 0 && newCounter <= credential.counter) {
      // Cloning detector. Revoke the credential and fire the span.
      await withOtelSpan("auth.passkey.clone_detected", async (cloneSpan) => {
        cloneSpan.setAttribute("pang.auth.credential_id", credentialId);
        cloneSpan.setAttribute("pang.auth.stored_counter", credential.counter);
        cloneSpan.setAttribute("pang.auth.response_counter", newCounter);
      });
      await revokeCredential(credentialId, "clone-detected");
      span.setAttribute("pang.auth.fail_reason", "clone-detected");
      return { ok: false, reason: "clone-detected" as const };
    }

    const updated: CredentialRecord = {
      ...credential,
      counter: newCounter,
      lastUsedAt: new Date().toISOString(),
    };
    await writeCredential(updated);
    return { ok: true, credential: updated };
  });
}

// ---------- Public utility ----------------------------------------

/**
 * Return the live credentials for a user, shaped for an
 * authenticator `allowCredentials` list. Used when the collector
 * already has a userId cookie but needs to step up — not wired this
 * iteration.
 */
export async function liveCredentialsForUser(userId: string): Promise<
  readonly { id: string; transports: CredentialRecord["transports"] }[]
> {
  const rows = await listCredentialsForUser(userId);
  return rows
    .filter((r) => r.revokedAt === null)
    .map((r) => ({ id: r.credentialId, transports: r.transports }));
}

// ---------- Helpers -----------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Extract the `challenge` field from a base64url-encoded
 * `clientDataJSON` payload without trusting it — we use the value
 * to look up our stored challenge record, which then authoritatively
 * supplies the expected challenge to SimpleWebAuthn. If the stored
 * challenge doesn't match what the client claims, the verify call
 * fails on a different path (it compares the actual base64url bytes).
 */
function decodeClientDataChallenge(clientDataJSONb64url: string): string {
  try {
    const bytes = fromBase64Url(clientDataJSONb64url);
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text) as { challenge?: unknown };
    if (typeof parsed.challenge !== "string") return "";
    return parsed.challenge;
  } catch {
    return "";
  }
}
