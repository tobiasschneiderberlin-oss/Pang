/**
 * PANG — push subscription wire contract.
 *
 * What the collector's device sends to the server after a successful
 * `pushManager.subscribe()` call. The shape mirrors the W3C
 * `PushSubscription.toJSON()` output plus a `requestId`/`workId` pair so
 * the gallery's dispatcher knows *why* the subscription exists — we do
 * not maintain a general push channel; each subscription is tied to a
 * specific verification request and expires when the gallery answers.
 *
 * Server-side the subscription is persisted next to the outbox record
 * (both keyed by `requestId`) so a later push dispatch can look up both
 * without a database join. When the gallery decides, the server sends
 * the Declarative Web Push payload and then deletes the subscription —
 * we never accumulate a subscription list per collector.
 *
 * The `keys` object's `p256dh` and `auth` values are base64url strings
 * per RFC 8291. We bound their length (up to 256 chars) so an attacker
 * cannot wedge an oversized key into the store.
 */

import { z } from "zod";
import { RequestIdSchema } from "@/verification/schema";

// ---------- Subscription envelope --------------------------------

/**
 * Base64url validator — 1..256 chars, no padding, URL-safe alphabet.
 * `p256dh` is 65 bytes (87 base64url chars); `auth` is 16 bytes
 * (22 chars). We accept a broad range to stay resilient across agents
 * that may pad or trim differently.
 */
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export const PushKeysSchema = z
  .object({
    p256dh: z.string().min(1).max(256).regex(BASE64URL),
    auth: z.string().min(1).max(256).regex(BASE64URL),
  })
  .strict();

export type PushKeys = z.infer<typeof PushKeysSchema>;

export const PushSubscribePayloadSchema = z
  .object({
    version: z.literal("v1"),
    requestId: RequestIdSchema,
    workId: z.string().min(1).max(64),
    /**
     * The push service endpoint the gallery's dispatcher posts to.
     * Always HTTPS in 2026; we reject anything else at the wire.
     */
    endpoint: z
      .string()
      .min(1)
      .max(1024)
      .refine((v) => v.startsWith("https://"), {
        message: "endpoint must be https",
      }),
    /**
     * Seconds-since-epoch of the subscription's hard expiry, when the
     * user agent supplies one. `null` when the agent returns no expiry
     * (Chromium typically returns a year; Safari returns `null`).
     */
    expirationTime: z.union([z.number().int().min(0).max(4_000_000_000), z.null()]),
    keys: PushKeysSchema,
    /**
     * Client clock of the subscription moment — paired with the
     * server's own stamp so a systemic drift surfaces the same way
     * the request endpoint surfaces `submittedAt` vs. `receivedAt`.
     */
    subscribedAt: z.string().datetime(),
  })
  .strict();

export type PushSubscribePayload = z.infer<typeof PushSubscribePayloadSchema>;

// ---------- Server ack -------------------------------------------

export const PushSubscribeAckSchema = z
  .object({
    requestId: RequestIdSchema,
    status: z.literal("stored"),
    storedAt: z.string().datetime(),
  })
  .strict();

export type PushSubscribeAck = z.infer<typeof PushSubscribeAckSchema>;
