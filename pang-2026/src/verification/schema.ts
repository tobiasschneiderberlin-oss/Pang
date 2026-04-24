/**
 * PANG — verification request schema.
 *
 * The wire contract between the collector's device and the server-
 * side outbox. Every field is declared here, every field is
 * `readonly`, and the schema is `.strict()` — anything the collector's
 * client sends outside this shape is rejected at the endpoint
 * boundary (A3). No `JSON.parse` on the other side reaches into raw
 * bytes (A1) because the route handler Zod-validates the whole body.
 *
 * Three design notes:
 *
 * 1. `artworkSnapshot` is the *structured* record the gallery needs
 *    to recognise the work — artist, title, year, medium, dimensions.
 *    Not a prose description. The gallery doesn't read a narrative;
 *    its registrar matches fields against a ledger.
 *
 * 2. `galleryIdHint` / `galleryNameHint` / `galleryFreeText` are three
 *    escalating levels of certainty about *which* gallery. When the
 *    intake's `galleryOfOrigin.confidence` was high, we send the id.
 *    When it was moderate, we send the name. When the collector
 *    edited the free-text field, we send that verbatim (after
 *    `sanitize()` at the boundary). The server prefers id > name >
 *    free-text when matching — all three are optional, but at least
 *    one must be present.
 *
 * 3. `requestId` is the ULID the client generates before the outbox
 *    write. It is the idempotency key: the server deduplicates on it,
 *    retries are safe by construction, and the store flips
 *    `"requested"` on the same id that lands in the outbox. A refresh
 *    mid-submit never double-sends.
 */

import { z } from "zod";
import { DimensionsCmSchema } from "@/ai/tools/artwork";

// ---------- ULID-shaped id generator -----------------------------

/**
 * Generate a client-side request id. Crockford-base32-ish; not a
 * full ULID but the shape the rest of the app already uses (see
 * `src/workers/cv/intakeQueue.ts` `newId()`). Time-ordered so the
 * outbox FIFO drain is a simple `sort()`. Collisions are
 * astronomically unlikely inside a single collector's device.
 *
 * Format: `<timestamp-base36>-<12 random base36 chars>` — 25 chars.
 * The server regex below asserts the shape.
 */
export function newRequestId(): string {
  const now = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36))
    .join("")
    .slice(0, 12);
  return `${now}-${rand}`;
}

/**
 * Schema for a request id — accepts our ULID-shaped string. Bounded
 * between 12 and 40 chars to reject obviously-malformed ids without
 * coupling to the exact length.
 */
export const RequestIdSchema = z
  .string()
  .min(12)
  .max(40)
  .regex(/^[0-9a-z]+-[0-9a-z]+$/, "request id must be <base36>-<base36>");

// ---------- Artwork snapshot -------------------------------------

/**
 * What the gallery needs to recognise the work. Mirrors
 * `ArtworkCoreSchema` but drops the confidence map — the gallery's
 * registrar doesn't care how sure PANG was about the year; the
 * gallery either recognises the work or doesn't. `confidenceBySource`
 * stays on the client for the UI; the wire shape is clean.
 */
export const ArtworkSnapshotSchema = z
  .object({
    artist: z.union([z.string().min(1).max(120), z.null()]),
    title: z.union([z.string().min(1).max(240), z.null()]),
    year: z.number().int().min(-3000).max(3000).nullable(),
    medium: z.union([z.string().min(1).max(120), z.null()]),
    dimensionsCm: DimensionsCmSchema.nullable(),
  })
  .strict();

export type ArtworkSnapshot = z.infer<typeof ArtworkSnapshotSchema>;

// ---------- Verification request ---------------------------------

/**
 * The wire shape of a single verification request. `version: "v1"`
 * future-proofs the contract — a v2 endpoint can accept both shapes
 * during migration; iteration #4 ships with v1 only.
 */
export const VerificationRequestSchema = z
  .object({
    version: z.literal("v1"),
    requestId: RequestIdSchema,
    workId: z.string().min(1).max(64),
    /**
     * High-confidence gallery id inferred from intake. When this is
     * present the server routes the request directly.
     */
    galleryIdHint: z.union([z.string().min(1).max(64), z.null()]),
    /**
     * Display name the intake saw on the work's paperwork. Used for
     * routing when the id is null, and for human review at the
     * gallery.
     */
    galleryNameHint: z.union([z.string().min(1).max(120), z.null()]),
    /**
     * Collector-edited free-text. Bounded, single-line, already
     * `sanitize()`'d by the caller before construction. The server
     * re-runs the banned-vocabulary check as defence in depth.
     */
    galleryFreeText: z.union([z.string().min(1).max(120), z.null()]),
    /**
     * Which signal the hint came from. Helps the gallery triage
     * (an email-detected hint is more reliable than a visual one).
     */
    detectedFrom: z.union([
      z.enum(["email", "certificate", "visual", "manual"]),
      z.null(),
    ]),
    /**
     * The structured record the gallery recognises the work against.
     */
    artworkSnapshot: ArtworkSnapshotSchema,
    /**
     * OPFS-backed reference to the rectified capture bytes. The
     * server does not need the bytes for iteration #4; iteration #7
     * will either fetch-on-demand or stream them into the dispatch.
     */
    photoRef: z.string().min(1).max(256),
    /**
     * ISO timestamp of the capture (from `IntakeOutput.capturedAt`
     * when present, else the intake arrival time).
     */
    capturedAt: z.string().datetime(),
    /**
     * ISO timestamp of the submit tick. Server echoes its own
     * `receivedAt`; the client tracks both so latency is observable.
     */
    submittedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (v) =>
      v.galleryIdHint !== null ||
      v.galleryNameHint !== null ||
      v.galleryFreeText !== null,
    {
      message:
        "at least one of galleryIdHint, galleryNameHint, galleryFreeText must be present",
    },
  );

export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;

// ---------- Server ack shape -------------------------------------

/**
 * What the endpoint returns on success. The `receivedAt` stamp is
 * the server's clock — the client logs both timestamps so a systemic
 * drift surfaces in telemetry.
 */
export const VerificationAckSchema = z
  .object({
    requestId: RequestIdSchema,
    status: z.literal("received"),
    receivedAt: z.string().datetime(),
  })
  .strict();

export type VerificationAck = z.infer<typeof VerificationAckSchema>;

// ---------- Confirmation / decline shapes ------------------------

/**
 * Payload the gallery sends back (via push, or via a server-initiated
 * reconcile when push was denied). The schema is minimal on purpose —
 * a decline does not carry a reason that PANG displays, because the
 * voice doctrine forbids apologising for the gallery's answer. The
 * gallery's private note to the collector, if any, is out of scope
 * for iteration #4 (iteration #7 may add a sidecar channel).
 *
 * iter #10 adds `"expired"` — the signed link's 30-day TTL elapsed
 * without the gallery acting. Distinct from `"declined"` in telemetry
 * and in the collector-side surface (the panel's reflective state
 * differs: a decline is the gallery's answer; an expiry is no answer).
 */
export const VerificationOutcomeSchema = z
  .object({
    version: z.literal("v1"),
    requestId: RequestIdSchema,
    workId: z.string().min(1).max(64),
    outcome: z.enum(["confirmed", "declined", "expired"]),
    decidedAt: z.string().datetime(),
  })
  .strict();

export type VerificationOutcome = z.infer<typeof VerificationOutcomeSchema>;

// ---------- Dispatch request + result (iter #10) -----------------

/**
 * The client's request to mint an outbound verification message. The
 * server calls the Correspondence Agent, mints confirm + decline
 * signed links, and returns a prepared URL-handoff target (mailto: or
 * wa.me://) for the collector's browser to navigate to.
 *
 * Idempotent on `requestId` — a second call with the same id returns
 * the cached payload (not a new one). The gallery sees the same pair
 * of links.
 *
 * `channel` is the collector's chosen hand-off route — email or
 * WhatsApp. SMS is deferred to a later iteration (principle-scope
 * deferral: the mechanism would work, but mobile browsers' `sms:`
 * URL support is uneven and we'd rather ship two rails that work
 * everywhere than three that don't).
 */
export const DispatchChannelSchema = z.enum(["email", "whatsapp"]);
export type DispatchChannel = z.infer<typeof DispatchChannelSchema>;

export const VerificationDispatchRequestSchema = z
  .object({
    version: z.literal("v1"),
    requestId: RequestIdSchema,
    channel: DispatchChannelSchema,
    /** The gallery's contact for this channel — email address, or E.164-ish. */
    galleryContact: z.string().min(1).max(120),
  })
  .strict();

export type VerificationDispatchRequest = z.infer<
  typeof VerificationDispatchRequestSchema
>;

/**
 * Server's response to /api/verification/dispatch. `channelUrl` is a
 * pre-built `mailto:` or `https://wa.me/<phone>?text=<body>` URL that
 * the client's `<a>.click()` hand-off triggers. The collector's email
 * client or WhatsApp app opens with the composed body pre-filled; the
 * collector taps send. PANG does not dispatch on the gallery's behalf
 * — the collector's channel is the collector's.
 *
 * `previewBody` mirrors the body that got URL-encoded into
 * `channelUrl`, so the panel can render a preview without parsing the
 * URL. Both fields are Zod-validated at the wire boundary.
 */
export const VerificationDispatchResultSchema = z
  .object({
    version: z.literal("v1"),
    requestId: RequestIdSchema,
    channel: DispatchChannelSchema,
    channelUrl: z.string().min(1).max(8192),
    previewSubject: z.string().max(200).nullable(),
    previewBody: z.string().min(1).max(6000),
    confirmUrl: z.string().url().max(2048),
    declineUrl: z.string().url().max(2048),
    dispatchedAt: z.string().datetime(),
  })
  .strict();

export type VerificationDispatchResult = z.infer<
  typeof VerificationDispatchResultSchema
>;
