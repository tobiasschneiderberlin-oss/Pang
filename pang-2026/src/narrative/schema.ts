/**
 * PANG — Narrative agent schemas (iter #14).
 *
 * Three wire contracts land here:
 *
 *   1. `NarrativeOutputSchema` — what the P-LLM returns through its
 *      `composeMonthlyReading` tool call. One observational paragraph
 *      (120–600 chars), sentence case, no evaluative vocabulary, no
 *      first-person. The Zod `.refine()` clauses reject violations at
 *      parse time — the agent's runtime band of checks sits downstream
 *      as defence-in-depth.
 *
 *   2. `NarrativeInputSchema` — the deterministic, assembler-produced
 *      object the agent sees. Verified works, per-work provenance
 *      entries, and the bio-muji paragraphs keyed by artist id. The
 *      assembler is the CaMeL boundary (primitive 70): nothing `'Q'`-
 *      branded reaches the P-LLM.
 *
 *   3. `NarrativeSkipReason` — the closed taxonomy of reasons the agent
 *      or the route skipped a reading. Used as both a return value and
 *      the `failure_reason` attribute on the `pang.narrative.skipped`
 *      OTel span. Primitive 62 (skip-reason telemetry) applied.
 *
 * The field named `paragraph` on `NarrativeOutputSchema` is load-
 * bearing: `runBannedVocabularyCheck`'s narrative-context detection
 * (`src/ai/camel/sanitize.ts`) matches exactly that field name, so the
 * `EVALUATIVE_VOCABULARY` soft list runs *hard* for this agent without
 * a separate code path. Renaming the field is a doctrine edit.
 */

import { z } from "zod";
import {
  BANNED_VOCABULARY,
  EVALUATIVE_VOCABULARY,
} from "@/ai/camel/banned";

// ---------- Output ------------------------------------------------

/**
 * 120–600 characters: short enough that Laura might read it to her
 * partner (~15 seconds), long enough to carry observation. Iter #14
 * outcome gate (`PANG_Aha_Sprint.md` § 14) owns the length band.
 */
export const NARRATIVE_PARAGRAPH_MIN = 120;
export const NARRATIVE_PARAGRAPH_MAX = 600;

/**
 * First-person markers that disqualify a paragraph. The narrative is
 * observational about *your collection*; it is not the collector
 * narrating. `PANG_Voice.md` § *First person exception* permits only
 * `you / your` at the ownership moment — every other pronoun in this
 * list is a voice violation.
 *
 * Whitespace sentinels so the check is word-boundary safe in practice
 * (no hit on "coming", "amount", "issue", etc.).
 */
const FIRST_PERSON_MARKERS = [
  " i ",
  " i'",
  " me ",
  " my ",
  " mine ",
  " we ",
  " we'",
  " our ",
  " us ",
  " ours ",
] as const;

function containsFirstPerson(text: string): boolean {
  // Pad the text so a leading or trailing pronoun still triggers.
  const padded = ` ${text.toLowerCase()} `;
  for (const marker of FIRST_PERSON_MARKERS) {
    if (padded.includes(marker)) return true;
  }
  return false;
}

/**
 * Hard evaluative-vocabulary check on the agent's single paragraph.
 * Mirrors `runBannedVocabularyCheck`'s narrative-context path but
 * runs synchronously inside Zod so the schema rejects the value
 * before the agent runner re-checks. Two passes — the soft list is
 * hard here because observational prose is the register.
 */
function containsBannedOrEvaluative(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of BANNED_VOCABULARY) {
    if (lower.includes(term)) return term;
  }
  for (const term of EVALUATIVE_VOCABULARY) {
    if (lower.includes(term)) return term;
  }
  return null;
}

/**
 * The paragraph the agent returns. One field, three invariants:
 *
 *   - length in `[120, 600]`
 *   - no banned or evaluative vocabulary (hard fail)
 *   - no first-person pronouns (observational register)
 *
 * `.strict()` rejects extra fields — a drifted tool schema fails here.
 */
export const NarrativeOutputSchema = z
  .object({
    paragraph: z
      .string()
      .min(NARRATIVE_PARAGRAPH_MIN)
      .max(NARRATIVE_PARAGRAPH_MAX)
      .refine(
        (p) => containsBannedOrEvaluative(p) === null,
        (p) => ({
          message: `paragraph contains banned or evaluative term: ${containsBannedOrEvaluative(p) ?? "?"}`,
        }),
      )
      .refine((p) => !containsFirstPerson(p), {
        message: "paragraph uses a first-person pronoun",
      }),
  })
  .strict();

export type NarrativeOutput = z.infer<typeof NarrativeOutputSchema>;

// ---------- Input -------------------------------------------------

/**
 * A verified work, from the assembler's perspective. Ids are opaque;
 * the agent doesn't persist them, it just needs to distinguish one
 * Hojgaard from another when counting. `year` and `medium` may be
 * `null` — the prompt instructs the agent to elide missing fields
 * rather than invent.
 */
export const NarrativeVerifiedWorkSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    artistId: z.string().min(1),
    artist: z.string().min(1),
    year: z.union([z.number().int(), z.null()]),
    medium: z.union([z.string().min(1), z.null()]),
  })
  .strict();

export type NarrativeVerifiedWork = z.infer<
  typeof NarrativeVerifiedWorkSchema
>;

/**
 * A provenance entry the gallery has registered for a work. One line
 * per entry, already sanitised at ingest. The agent uses these to
 * count ownership arcs, exhibition histories, etc.
 */
export const NarrativeProvenanceEntrySchema = z
  .object({
    workId: z.string().min(1),
    /** `acquisition`, `exhibition`, `publication`, `ownership`… */
    kind: z.string().min(1),
    /** ISO year string, or `null` when the gallery has no date. */
    year: z.union([z.number().int(), z.null()]),
    /** Short factual line — e.g. "Sold at Sotheby's, London". */
    summary: z.string().min(1).max(240),
  })
  .strict();

export type NarrativeProvenanceEntry = z.infer<
  typeof NarrativeProvenanceEntrySchema
>;

/**
 * The `NarrativeInput` passed to `runNarrative`. Already sanitised —
 * the assembler upstream owns the CaMeL boundary. Hash is part of
 * the payload so the store can detect "collection unchanged" without
 * re-assembling.
 */
export const NarrativeInputSchema = z
  .object({
    /** Stable collector identifier (used for the marker file path). */
    collectorId: z.string().min(1),
    /** `now`-aligned YYYY-MM string. */
    month: z.string().regex(/^\d{4}-\d{2}$/),
    verifiedWorks: z.array(NarrativeVerifiedWorkSchema).min(1),
    provenanceEntries: z.array(NarrativeProvenanceEntrySchema),
    /** Artist id → bio-muji paragraph from enrichment (already 'P'). */
    bioMujiParagraphs: z.record(z.string().min(1), z.string().min(1)),
    /**
     * Deterministic hash of `(verifiedWorkIds, provenanceEntryCount,
     * bioMujiHashes)`. The route's idempotency gate compares this
     * against the stored marker's prior hash.
     */
    collectionHash: z.string().min(8),
  })
  .strict();

export type NarrativeInput = z.infer<typeof NarrativeInputSchema>;

// ---------- Skip taxonomy -----------------------------------------

/**
 * The closed set of reasons the narrative pipeline skipped this
 * month's reading. Used as a Zod enum so the OTel span attribute
 * (`failure_reason`) is typed and telemetry can group by reason
 * safely.
 *
 * The taxonomy maps 1:1 to the iter #14 failure-mode brief:
 *   - empty-collection    → Laura hasn't scanned anything
 *   - thin-provenance     → below the assembler threshold
 *   - same-month-marker   → already generated this calendar month
 *   - unchanged-collection → hash matches the prior reading
 *   - agent-failure       → P-LLM returned null after retries
 *   - evaluative-vocabulary → paragraph failed hard ban check
 */
export const NarrativeSkipReasonSchema = z.enum([
  "empty-collection",
  "thin-provenance",
  "same-month-marker",
  "unchanged-collection",
  "agent-failure",
  "evaluative-vocabulary",
]);

export type NarrativeSkipReason = z.infer<typeof NarrativeSkipReasonSchema>;

// ---------- Marker on disk ----------------------------------------

/**
 * The row shape that the filesystem stand-in persists per
 * (collectorId, month). 1:1 with the Supabase column shape that lands
 * later (primitive 52).
 *
 * `kind: "paragraph"` carries a generated reading; `kind: "skipped"`
 * carries a reason. Either way, the month is closed — the monthly
 * idempotency marker commits before any side effect (primitive 51).
 */
const NarrativeMarkerParagraphSchema = z
  .object({
    kind: z.literal("paragraph"),
    collectorId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    collectionHash: z.string().min(8),
    paragraph: z.string().min(NARRATIVE_PARAGRAPH_MIN).max(NARRATIVE_PARAGRAPH_MAX),
    decidedAt: z.string().min(1),
  })
  .strict();

const NarrativeMarkerSkippedSchema = z
  .object({
    kind: z.literal("skipped"),
    collectorId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    collectionHash: z.string().min(8),
    reason: NarrativeSkipReasonSchema,
    decidedAt: z.string().min(1),
  })
  .strict();

export const NarrativeMarkerSchema = z.discriminatedUnion("kind", [
  NarrativeMarkerParagraphSchema,
  NarrativeMarkerSkippedSchema,
]);

export type NarrativeMarker = z.infer<typeof NarrativeMarkerSchema>;

// ---------- Client-facing wire ------------------------------------

/**
 * GET /api/narrative/current returns this when a current-month
 * reading exists. A skipped month returns `null` — the collector
 * sees no overlay; silence is the right register when there is
 * nothing to observe.
 */
export const NarrativeCurrentResponseSchema = z
  .object({
    paragraph: z.string().min(NARRATIVE_PARAGRAPH_MIN).max(NARRATIVE_PARAGRAPH_MAX),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    decidedAt: z.string().min(1),
    collectionHash: z.string().min(8),
  })
  .strict();

export type NarrativeCurrentResponse = z.infer<
  typeof NarrativeCurrentResponseSchema
>;

/**
 * POST /api/narrative/current body. The client (or the cron runner)
 * forwards the deterministic collector state the assembler needs —
 * works, provenance entries, bio-muji paragraphs. `collectorId` is
 * carried explicitly here rather than inferred from the session so
 * the dev-cron script can target any collector.
 *
 * Server-side: `collectorId` is validated against the authenticated
 * `userId` on the session-gated path; the cron-gated path accepts
 * arbitrary ids (the CaMeL boundary is the assembler, not the route).
 */
export const NarrativeTickRequestSchema = z
  .object({
    collectorId: z.string().min(1).max(128),
    verifiedWorks: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: z.string().min(1),
            artistId: z.string().min(1),
            artist: z.string().min(1),
            year: z.union([z.number().int(), z.null()]),
            medium: z.union([z.string().min(1), z.null()]),
          })
          .strict(),
      )
      .max(512),
    provenanceEntries: z
      .array(
        z
          .object({
            workId: z.string().min(1),
            kind: z.string().min(1),
            year: z.union([z.number().int(), z.null()]),
            summary: z.string().min(1).max(240),
          })
          .strict(),
      )
      .max(2048),
    bioMujiParagraphs: z.record(z.string().min(1), z.string().min(1).max(4096)),
  })
  .strict();

export type NarrativeTickRequest = z.infer<typeof NarrativeTickRequestSchema>;

/**
 * POST /api/narrative/current response. Either "generated" (a new
 * reading landed), "cached" (marker already existed — no new
 * round-trip), or "skipped" (assembler / agent declined, with the
 * reason surfaced to telemetry).
 */
export const NarrativeTickResponseSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("generated"),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      decidedAt: z.string().min(1),
      collectionHash: z.string().min(8),
      paragraphLength: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("cached"),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      decidedAt: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("skipped"),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      reason: NarrativeSkipReasonSchema,
      decidedAt: z.string().min(1),
    })
    .strict(),
]);

export type NarrativeTickResponse = z.infer<typeof NarrativeTickResponseSchema>;
