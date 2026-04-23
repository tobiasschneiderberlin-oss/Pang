/**
 * PANG — enrichment schema.
 *
 * Two wire contracts and one domain type:
 *
 *   1. `ProvenanceSubmission` — what a gallery / museum / prior owner
 *      POSTs to `/api/enrichment/submit` when they attach structured
 *      provenance to a verified work. Carries `records[]`; each record
 *      has a bounded `untrustedNote` field that the agent's Q-LLM
 *      quarantine reads before the P-LLM ever touches it.
 *
 *   2. `EnrichmentOutput` — what the agent returns and the OPFS cache
 *      stores. `basedOnWorkHash` is the cache-invalidation key: when
 *      the intake record's content fields change, the cached
 *      enrichment becomes stale. Timeline entries are *not* authored
 *      by the P-LLM — they are assembled deterministically from the
 *      sanitised submission fields; only `artistContext.bioMuji` is
 *      P-LLM prose.
 *
 *   3. `ProvenanceRecord` / `TimelineEntry` — the shared element
 *      shape. A `ProvenanceRecord` carries the untrusted note; a
 *      `TimelineEntry` does not (it's what survives the quarantine).
 *
 * Design notes, each load-bearing:
 *
 * • Every schema uses `.strict()`. A contributor that smuggles an
 *   instruction under an unexpected key fails validation (A3 +
 *   defence-in-depth for injection).
 *
 * • The timeline is a *structured* record, not a narrative. Contributors
 *   supply data; they do not speak. (`PANG_Spine.md` § Provenance.)
 *   The P-LLM authors `bioMuji` only — never a timeline entry.
 *
 * • `submissionId` is the client-provided idempotency key (A17). The
 *   endpoint dedupes on it; retries are safe by construction.
 *
 * • `basedOnWorkHash` is derived deterministically from the intake's
 *   content fields (`computeWorkHash()` below). Any post-enrichment
 *   edit to the work changes the hash, and boot-time reconcile
 *   invalidates the stale cache entry with
 *   `enrichment.cache.invalidate` under `reason: "workHashChanged"`.
 */

import { z } from "zod";
import { RequestIdSchema } from "@/verification/schema";
import type { ArtworkSnapshot } from "@/verification/schema";

// ---------- Submission id generator ------------------------------

/**
 * Generate a client-side submission id. Mirrors `newRequestId()`
 * from the verification schema — the shape is the same, so the
 * gate runner's `RequestIdSchema` re-use below covers both.
 */
export function newSubmissionId(): string {
  const now = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36))
    .join("")
    .slice(0, 12);
  return `${now}-${rand}`;
}

// ---------- Enums -------------------------------------------------

/**
 * The context in which the work appeared during a provenance record.
 * The set is closed on purpose — an open free-text `kind` would give
 * a contributor an unbounded surface to smuggle marketing vocabulary
 * through. Extensions are deliberate doctrine edits.
 */
export const ProvenanceContextSchema = z.enum([
  "museum",
  "fair",
  "studio",
  "private",
  "auction",
]);
export type ProvenanceContext = z.infer<typeof ProvenanceContextSchema>;

/**
 * What a contributor's role is in the supply chain of the record. Used
 * by `capabilities.ts` only indirectly (via the gallery auth token on
 * the endpoint); the tag lands on telemetry so the eval can slice
 * failures by contributor role.
 */
export const ContributorRoleSchema = z.enum([
  "gallery",
  "museum",
  "prior-owner",
]);
export type ContributorRole = z.infer<typeof ContributorRoleSchema>;

// ---------- Provenance record -------------------------------------

/**
 * One attached record in a submission. The `untrustedNote` is
 * deliberately untagged at the schema level — the brand is applied
 * at the endpoint boundary, where `wrapUntrusted()` converts the
 * primitive string into a `'Q'`-branded object.
 */
export const ProvenanceRecordSchema = z
  .object({
    /** Year the record applies to. Nullable — some provenance is undated. */
    year: z.number().int().min(-3000).max(3000).nullable(),
    /** Short bounded location. Not free-form; expected to be a place name. */
    location: z.string().min(1).max(160),
    /** What kind of venue / context. */
    context: ProvenanceContextSchema,
    /** Optional OPFS-backed ref to an image the contributor uploaded. */
    imageRef: z.union([z.string().min(1).max(512), z.null()]),
    /**
     * Contributor-supplied free-text note. Bounded to 256 chars and
     * treated as `Untrusted<string>` — the Q-LLM quarantine reads it,
     * extracts a safe summary via `sanitize()`, and the P-LLM never
     * sees the raw text. Null when the contributor left it blank.
     */
    untrustedNote: z.union([z.string().max(256), z.null()]),
  })
  .strict();

export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

// ---------- Provenance submission (endpoint wire shape) -----------

export const ProvenanceSubmissionSchema = z
  .object({
    version: z.literal("v1"),
    submissionId: RequestIdSchema,
    workId: z.string().min(1).max(64),
    /** Contributor identity — the gallery/museum/prior-owner handle. */
    contributorId: z.string().min(1).max(64),
    contributorRole: ContributorRoleSchema,
    /**
     * The attached records. Bounded at 16 per submission — a museum
     * can submit more by chunking across submissions. A contributor
     * that ships 100 records in one POST is almost certainly trying
     * to amplify a prompt-injection attempt into the Q-LLM's token
     * budget.
     */
    records: z.array(ProvenanceRecordSchema).min(1).max(16),
    /**
     * The intake hash the contributor expects to be enriching. Server
     * rejects if it disagrees with the current hash on record — that
     * prevents a stale submission from overwriting a newer enrichment
     * built off a corrected intake.
     */
    basedOnWorkHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** Submission timestamp (client clock). */
    submittedAt: z.string().datetime(),
  })
  .strict();

export type ProvenanceSubmission = z.infer<typeof ProvenanceSubmissionSchema>;

// ---------- Timeline entry (post-sanitize shape) ------------------

/**
 * What makes it onto the enriched work. Mirrors `ProvenanceRecord`
 * but drops the untrusted note in favour of an optional sanitised
 * `note` — at most a short fact extracted by the Q-LLM, not the raw
 * contributor text. `contributorRole` lands here so the render
 * surface can distinguish a museum record from a gallery record
 * without a lookup.
 */
export const TimelineEntrySchema = z
  .object({
    year: z.number().int().min(-3000).max(3000).nullable(),
    location: z.string().min(1).max(160),
    context: ProvenanceContextSchema,
    imageRef: z.union([z.string().min(1).max(512), z.null()]),
    /** Sanitised, bounded fact extracted by the Q-LLM. Null when absent. */
    note: z.union([z.string().min(1).max(160), z.null()]),
    contributorRole: ContributorRoleSchema,
  })
  .strict();

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

// ---------- Artist context (post-P-LLM shape) ---------------------

/**
 * The refined artist context paragraph. Mirrors
 * `ArtistContextSchema` from `ai/tools/artwork.ts` but widened
 * `bioMuji` to 480 chars — the enriched bio may be richer than the
 * intake's initial pass. The literal-`false` on
 * `bannedVocabularyDetected` forces the P-LLM to "notice" the voice
 * rule, same pattern as the intake agent.
 */
export const EnrichedArtistContextSchema = z
  .object({
    nationality: z.union([z.string().min(1).max(60), z.null()]),
    birthYear: z.number().int().min(-3000).max(3000).nullable(),
    bioMuji: z.string().min(1).max(480),
    bannedVocabularyDetected: z.literal(false),
  })
  .strict();

export type EnrichedArtistContext = z.infer<
  typeof EnrichedArtistContextSchema
>;

// ---------- Enrichment output (agent + cache shape) ---------------

export const EnrichmentOutputSchema = z
  .object({
    version: z.literal("v1"),
    workId: z.string().min(1).max(64),
    /**
     * SHA-256 of the intake's content fields, as returned by
     * `computeWorkHash()` below. The cache invalidates a stored
     * entry whenever this stops matching the current intake hash.
     */
    basedOnWorkHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** Deterministic assembly from sanitised record fields. */
    timeline: z.array(TimelineEntrySchema).max(64),
    /** P-LLM authored bio + structured artist facts. */
    artistContext: EnrichedArtistContextSchema,
    /** ISO timestamp of the agent's completion. */
    generatedAt: z.string().datetime(),
  })
  .strict();

export type EnrichmentOutput = z.infer<typeof EnrichmentOutputSchema>;

// ---------- Server ack --------------------------------------------

export const EnrichmentAckSchema = z
  .object({
    submissionId: RequestIdSchema,
    status: z.literal("received"),
    receivedAt: z.string().datetime(),
  })
  .strict();

export type EnrichmentAck = z.infer<typeof EnrichmentAckSchema>;

// ---------- Work hash ---------------------------------------------

/**
 * Deterministic hash of an artwork snapshot's content fields.
 * Used as the `basedOnWorkHash` on the cached enrichment so a
 * post-enrichment edit (artist correction, year fix, dimensions
 * refinement) invalidates the stale cache entry on next boot.
 *
 * Pure — same input produces the same hex string across calls,
 * across devices, across reboots. Never reads a clock.
 *
 * Stringifies in a canonical field order so re-key, re-serialise,
 * and re-null-coerce variations all collapse to the same hash.
 * A trailing sigil `|v1` future-proofs the hash shape: v2 (if it
 * arrives) will rotate the sigil so a v2 hash never matches a
 * v1 hash and the cache invalidates wholesale.
 */
export async function computeWorkHash(
  snapshot: ArtworkSnapshot,
): Promise<string> {
  const canonical = JSON.stringify([
    snapshot.artist ?? null,
    snapshot.title ?? null,
    snapshot.year ?? null,
    snapshot.medium ?? null,
    snapshot.dimensionsCm
      ? [
          snapshot.dimensionsCm.h,
          snapshot.dimensionsCm.w,
          snapshot.dimensionsCm.d ?? null,
        ]
      : null,
    "|v1",
  ]);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Submission batch hash (store-level idempotency) -------

/**
 * Deterministic hash of a submission's *records*, used as the
 * store-level idempotency key: calling `submitEnrichment(workId, records)`
 * twice in the same tick with the same record set enqueues once.
 * The server-side dedupe on `submissionId` is the authoritative check;
 * this is the client-side short-circuit.
 */
export async function computeSubmissionBatchHash(
  records: readonly ProvenanceRecord[],
): Promise<string> {
  const canonical = JSON.stringify(
    records.map((r) => [
      r.year,
      r.location,
      r.context,
      r.imageRef,
      r.untrustedNote,
    ]),
  );
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
