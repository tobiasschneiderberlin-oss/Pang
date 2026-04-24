/**
 * PANG — Correspondence agent schema.
 *
 * Two wire contracts:
 *
 *   1. `CorrespondenceAgentInput` — what the `/api/verification/
 *      dispatch` route passes to the agent runner. Carries the
 *      artwork snapshot (already rectified at intake + possibly
 *      amended at enrichment), the gallery's display name, and the
 *      channel (email | whatsapp).
 *
 *   2. `CorrespondenceOutput` — what the agent returns. Mirrors the
 *      JSON-schema tool in `@/ai/prompts/correspondence.ts`. Zod
 *      re-parses the tool's input (A3) — a drift between the two is
 *      the one scenario that fails closed.
 *
 * The output's `body` contains the literal placeholders
 * `{{CONFIRM_URL}}` and `{{DECLINE_URL}}` exactly once each. The
 * dispatch route replaces them with signed links before the message
 * lands in the `channelUrl` mailto:/wa.me URL.
 *
 * Why placeholders and not the signed URLs: the agent must not touch
 * the cryptographic links. Giving the agent the signed URLs would
 * (a) leak the secret-dependent payload into the prompt cache and
 * (b) let an injection rewrite the link. The placeholder-then-
 * substitute pattern isolates the cryptographic surface from the
 * prose surface.
 */

import { z } from "zod";
import { ArtworkSnapshotSchema } from "./schema";

// ---------- Agent input ------------------------------------------

export const CorrespondenceChannelSchema = z.enum(["email", "whatsapp"]);
export type CorrespondenceChannel = z.infer<
  typeof CorrespondenceChannelSchema
>;

export const CorrespondenceAgentInputSchema = z
  .object({
    artwork: ArtworkSnapshotSchema,
    /** Display name of the gallery the message is addressed to. */
    galleryDisplayName: z.string().min(1).max(120),
    channel: CorrespondenceChannelSchema,
  })
  .strict();

export type CorrespondenceAgentInput = z.infer<
  typeof CorrespondenceAgentInputSchema
>;

// ---------- Agent output -----------------------------------------

/**
 * Raw output from the P-LLM's structured tool call. The schema
 * enforces the wire contract; the agent runner runs a secondary check
 * for placeholder presence (`{{CONFIRM_URL}}` and `{{DECLINE_URL}}`
 * exactly once each) because Zod can't express "string contains X
 * exactly once" cleanly.
 */
export const CorrespondenceOutputSchema = z
  .object({
    subject: z.union([z.string().min(1).max(80), z.null()]),
    body: z.string().min(60).max(800),
    bannedVocabularyDetected: z.boolean(),
  })
  .strict();

export type CorrespondenceOutput = z.infer<typeof CorrespondenceOutputSchema>;

// ---------- Placeholder constants --------------------------------

export const CONFIRM_PLACEHOLDER = "{{CONFIRM_URL}}" as const;
export const DECLINE_PLACEHOLDER = "{{DECLINE_URL}}" as const;

/**
 * Verify the body carries both placeholders exactly once. Separate
 * from the Zod schema so the runner can attach a precise error
 * reason to the retry loop.
 */
export interface PlaceholderCheckResult {
  readonly ok: boolean;
  readonly reason?:
    | "missing-confirm"
    | "missing-decline"
    | "duplicate-confirm"
    | "duplicate-decline";
}

export function checkPlaceholders(body: string): PlaceholderCheckResult {
  const confirmCount = occurrences(body, CONFIRM_PLACEHOLDER);
  const declineCount = occurrences(body, DECLINE_PLACEHOLDER);
  if (confirmCount === 0) return { ok: false, reason: "missing-confirm" };
  if (declineCount === 0) return { ok: false, reason: "missing-decline" };
  if (confirmCount > 1) return { ok: false, reason: "duplicate-confirm" };
  if (declineCount > 1) return { ok: false, reason: "duplicate-decline" };
  return { ok: true };
}

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    count++;
    idx = found + needle.length;
  }
  return count;
}
