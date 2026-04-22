/**
 * PANG — Artwork schemas.
 *
 * Two schema families live here:
 *
 *   1. The *P-LLM output* schema — what Claude's intake tool returns
 *      after rectified-image analysis + any safe fields. This is the
 *      shape validated at `/api/intake` before the value leaves the
 *      server.
 *
 *   2. The *Q-LLM output* schema — what the quarantined model returns
 *      when reading untrusted email/PDF/certificate content. This is
 *      re-parsed by `sanitize()` as the single downgrade path.
 *
 * Every field carries a narrow type. Zod's `.strict()` rejects any
 * extra field — a Q-LLM that tries to smuggle an instruction under
 * an unexpected key fails validation. Confidence scores are clamped.
 *
 * Referenced by `PANG_AI_Era_2026.md` §§ 3, 7c.
 */

import { z } from "zod";

// ---------- Shared primitives -------------------------------------

/** A confidence value in `[0, 1]`. */
export const ConfidenceSchema = z.number().min(0).max(1);

/** Dimensions in centimetres. `d` is optional (sculpture vs flat work). */
export const DimensionsCmSchema = z
  .object({
    h: z.number().positive().max(2000),
    w: z.number().positive().max(2000),
    d: z.number().positive().max(2000).optional(),
  })
  .strict();

/** A nullable non-empty string within length bounds. */
function nonEmptyString(max: number): z.ZodType<string | null> {
  return z.union([z.string().min(1).max(max), z.null()]);
}

// ---------- P-LLM intake output -----------------------------------

export const ArtworkCoreSchema = z
  .object({
    artist: nonEmptyString(120),
    title: nonEmptyString(240),
    year: z.number().int().min(-3000).max(3000).nullable(),
    medium: nonEmptyString(120),
    dimensionsCm: DimensionsCmSchema.nullable(),
    confidenceBySource: z
      .object({
        artist: ConfidenceSchema,
        title: ConfidenceSchema,
        year: ConfidenceSchema,
        medium: ConfidenceSchema,
        dimensions: ConfidenceSchema,
      })
      .strict(),
  })
  .strict();

export const ArtistContextSchema = z
  .object({
    nationality: nonEmptyString(60),
    birthYear: z.number().int().min(-3000).max(3000).nullable(),
    bioMuji: nonEmptyString(280),
    // Must be `false`. A true value would indicate the P-LLM itself
    // returned banned vocabulary — the runtime check catches it, but
    // naming the field forces the model to "notice" the rule.
    bannedVocabularyDetected: z.literal(false),
  })
  .strict();

export const GalleryOfOriginSchema = z
  .object({
    galleryId: nonEmptyString(64),
    galleryName: nonEmptyString(120),
    detectedFrom: z
      .enum(["email", "certificate", "visual"])
      .nullable(),
    confidence: ConfidenceSchema,
  })
  .strict();

export const DocumentKindSchema = z.enum(["coa", "invoice", "condition_report"]);

export const DocumentSchema = z
  .object({
    type: DocumentKindSchema,
    fileRef: z.string().min(1).max(512),
    // Sanitized-via-Q-LLM map. Values are plain strings here because
    // sanitize() already re-parsed them; the brand lives on the
    // enclosing record, not individual string fields.
    extractedFields: z.record(z.string().min(1).max(240)),
  })
  .strict();

export const IntakeOutputSchema = z
  .object({
    artwork: ArtworkCoreSchema,
    artistContext: ArtistContextSchema,
    galleryOfOrigin: GalleryOfOriginSchema,
    documents: z.array(DocumentSchema).max(8),
    arrivalLine: z.string().min(1).max(240),
  })
  .strict();

export type IntakeOutput = z.infer<typeof IntakeOutputSchema>;

// ---------- Q-LLM document extraction -----------------------------

/**
 * Shape returned by the quarantined model when given an untrusted
 * document (email body, scanned certificate, etc.). Every string is
 * short, bounded, and free-form — the P-LLM never reads these
 * directly; only `sanitize()` downgrades them via this schema.
 *
 * Keep the shape narrow. A wider Q-schema is a wider attack surface.
 */
export const QuarantinedDocumentFieldsSchema = z
  .object({
    galleryName: nonEmptyString(120),
    artistName: nonEmptyString(120),
    workTitle: nonEmptyString(240),
    editionInfo: nonEmptyString(80),
    signatureDescription: nonEmptyString(240),
    purchaseDate: nonEmptyString(40),
    purchaseAmount: nonEmptyString(40),
    currency: nonEmptyString(10),
  })
  .strict()
  // Every field is independently optional at the wire; the Q-LLM
  // returns null for anything it cannot locate. `.partial()` makes
  // this explicit.
  .partial();

export type QuarantinedDocumentFields = z.infer<
  typeof QuarantinedDocumentFieldsSchema
>;

// ---------- Intake request body (client → /api/intake) -----------

export const IntakeRequestMetadataSchema = z
  .object({
    /** OPFS key for the rectified image bytes. */
    imageRef: z.string().min(1).max(512),
    /** Image MIME type. PNG only — we rectify to PNG on-device. */
    imageMime: z.literal("image/png"),
    /** SHA-256 of the rectified image, hex. */
    imageSha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** Client-declared capture source. The server does not trust this
     *  blindly; it is an observability tag, not a privilege. */
    source: z.enum(["camera", "file", "share"]),
    /** Optional document attachments — validated further server-side. */
    documents: z
      .array(
        z
          .object({
            type: DocumentKindSchema,
            opfsRef: z.string().min(1).max(512),
            mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
            sha256: z.string().regex(/^[0-9a-f]{64}$/),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();

export type IntakeRequestMetadata = z.infer<typeof IntakeRequestMetadataSchema>;
