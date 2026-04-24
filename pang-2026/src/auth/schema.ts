/**
 * PANG — auth schemas (iter #9).
 *
 * All records that cross the server boundary validate here. Shapes
 * are picked so the filesystem-backed dev stores under `.pang/server-*`
 * are 1:1 with the Supabase row shape that will replace them.
 */

import { z } from "zod";

// ---------- User --------------------------------------------------

export const UserIdSchema = z
  .string()
  .regex(/^u_[A-Za-z0-9]{22}$/, "userId must match u_<22 base62>");
export type UserId = z.infer<typeof UserIdSchema>;

export const UserRecordSchema = z
  .object({
    userId: UserIdSchema,
    /** User handle the authenticator signs. 16 bytes, base64url. */
    userHandle: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    createdAt: z.string().datetime(),
    /**
     * The gallery that issued the invite that created this user.
     * Opaque string; used for span attribution only.
     */
    galleryId: z.string().min(1).max(64),
  })
  .strict();
export type UserRecord = z.infer<typeof UserRecordSchema>;

// ---------- Credential --------------------------------------------

export const CredentialIdSchema = z
  .string()
  .min(1)
  .max(256)
  // base64url: A–Z a–z 0–9 - _
  .regex(/^[A-Za-z0-9_-]+$/, "credentialId must be base64url");
export type CredentialId = z.infer<typeof CredentialIdSchema>;

export const CredentialTransportSchema = z.enum([
  "usb",
  "nfc",
  "ble",
  "internal",
  "hybrid",
  "smart-card",
  "cable",
]);

export const CredentialRecordSchema = z
  .object({
    credentialId: CredentialIdSchema,
    userId: UserIdSchema,
    /** base64url-encoded COSE public key. */
    publicKey: z.string().min(1),
    /** Monotonic signature counter from the authenticator. */
    counter: z.number().int().min(0),
    transports: z.array(CredentialTransportSchema).default([]),
    /** From the attestation response. "single_device" | "multi_device". */
    credentialDeviceType: z.enum(["singleDevice", "multiDevice"]),
    /** Whether the credential syncs across devices (iCloud / Google etc.). */
    credentialBackedUp: z.boolean(),
    createdAt: z.string().datetime(),
    /** ISO timestamp of the most recent successful assertion. */
    lastUsedAt: z.string().datetime().nullable(),
    /** If set, the credential has been revoked — refuse assertion. */
    revokedAt: z.string().datetime().nullable().default(null),
    /**
     * Free-text reason for revocation. Populated on counter rollback
     * detection as "clone-detected".
     */
    revocationReason: z.string().max(64).nullable().default(null),
  })
  .strict();
export type CredentialRecord = z.infer<typeof CredentialRecordSchema>;

// ---------- Session ------------------------------------------------

/** Opaque bearer token. 32 bytes, hex-encoded. */
export const SessionTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "sessionToken must be 32-byte hex");
export type SessionToken = z.infer<typeof SessionTokenSchema>;

export const SessionMethodSchema = z.enum(["passkey", "otp", "e2e-seam"]);
export type SessionMethod = z.infer<typeof SessionMethodSchema>;

export const SessionRecordSchema = z
  .object({
    sessionToken: SessionTokenSchema,
    userId: UserIdSchema,
    method: SessionMethodSchema,
    createdAt: z.string().datetime(),
    rotatedAt: z.string().datetime(),
    /** ISO timestamp at which this session expires. */
    expiresAt: z.string().datetime(),
    /** The credentialId that minted this session, if passkey. */
    credentialId: CredentialIdSchema.nullable().default(null),
  })
  .strict();
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

// ---------- Bind / invite -----------------------------------------

/** Short-TTL cookie set during the enroll ceremony. */
export const BindSessionTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "bindSessionToken must be 32-byte hex");

export const BindSessionRecordSchema = z
  .object({
    bindSessionToken: BindSessionTokenSchema,
    /** The jti of the invite JWT this bind was opened for. */
    inviteJti: z.string().min(1).max(128),
    userId: UserIdSchema,
    /** From the invite JWT; the authenticator signs this, not userId. */
    userHandle: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    galleryId: z.string().min(1).max(64),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type BindSessionRecord = z.infer<typeof BindSessionRecordSchema>;

// ---------- Challenge ---------------------------------------------

export const ChallengePurposeSchema = z.enum(["enroll", "assert"]);
export type ChallengePurpose = z.infer<typeof ChallengePurposeSchema>;

export const ChallengeRecordSchema = z
  .object({
    /** 32-byte CSPRNG, base64url. The value stored on the authenticator. */
    challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    purpose: ChallengePurposeSchema,
    /** Who the challenge is for (enroll = bind session; assert = "*"). */
    scope: z.union([
      z.object({ kind: z.literal("bind"), bindSessionToken: BindSessionTokenSchema }),
      z.object({ kind: z.literal("session"), userId: UserIdSchema }),
      z.object({ kind: z.literal("public") }),
    ]),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type ChallengeRecord = z.infer<typeof ChallengeRecordSchema>;

// ---------- Public session reply ----------------------------------

export const SessionReplySchema = z
  .object({
    userId: UserIdSchema,
    method: SessionMethodSchema,
    createdAt: z.string().datetime(),
    rotatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type SessionReply = z.infer<typeof SessionReplySchema>;
