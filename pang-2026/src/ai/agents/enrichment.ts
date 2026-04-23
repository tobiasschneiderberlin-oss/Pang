/**
 * PANG — Enrichment Agent.
 *
 * Turns a verified artwork + a `ProvenanceSubmission` into an
 * `EnrichmentOutput`: a deterministically-assembled timeline plus
 * one paragraph of P-LLM-authored artist context.
 *
 * Flow:
 *   1. Per-record Q-LLM pass over any `untrustedNote` → bounded safe
 *      string or `null` via `sanitize()`.
 *   2. Deterministic assembly of `TimelineEntry[]` from sanitised
 *      record fields. The P-LLM never authors a timeline entry.
 *   3. P-LLM pass with the rectified artwork snapshot + the list of
 *      safe notes → refined `EnrichedArtistContext` (bioMuji only).
 *   4. Compose `EnrichmentOutput`; brand as `Trusted<…, "P">`.
 *
 * Retry policy: two retries on `ZodError` / `AgentContractError`
 * with temperature escalation (same shape as intake). Terminal
 * failure → null. The collector sees *less* rich provenance, not
 * an error surface; the failure is observable in
 * `enrichment.agent.fail` telemetry.
 *
 * Budget: A21 RETRY_POLICY from `@/enrichment/retry`; per-agent
 * token + cost caps from `AGENT_BUDGETS.enrichment` +
 * `AGENT_BUDGETS.enrichmentQuarantine`.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_MODEL_IDS,
  AGENT_BUDGETS,
  PANG_VOICE_SYSTEM_PROMPT,
  assertCapability,
  brand,
  enforceInputBudget,
  estimateTokens,
  extractToolUse,
  sanitize,
  withOtelSpan,
  withRetry,
  wrapUntrusted,
  type RetryPolicy,
  type Trusted,
  type Untrusted,
} from "./_shared";
import {
  ENRICHMENT_SYSTEM_PROMPT,
  enrichmentTool,
  ENRICHMENT_QUARANTINED_SYSTEM_PROMPT,
  enrichmentQuarantinedTool,
} from "@/ai/prompts/enrichment";
import { z } from "zod";
import {
  EnrichedArtistContextSchema,
  EnrichmentOutputSchema,
  TimelineEntrySchema,
  type EnrichedArtistContext,
  type EnrichmentOutput,
  type ProvenanceRecord,
  type ProvenanceSubmission,
  type TimelineEntry,
} from "@/enrichment/schema";
import type { ArtworkSnapshot } from "@/verification/schema";

// ---------- Retry policy (A21) -----------------------------------

/**
 * Enrichment runs off the collector's interactive path, so the
 * retry loop optimises for eventual success rather than latency.
 * Two retries after the initial attempt — same shape as intake on
 * purpose: a single `temperatures` array keeps the attempt-to-seed
 * mapping identical across agents and keeps the eval corpus shared.
 *
 * `onTerminalFailure: "null"` — the collector sees *less* rich
 * provenance, not an error surface. The failure is observable in
 * `enrichment.agent.fail` telemetry.
 */
export const RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  onTerminalFailure: "null",
  temperatures: [0.0, 0.3, 0.6],
} as const;

/** Eval threshold (A22). Same as intake for now. */
export const EVAL_THRESHOLD = 0.85 as const;

// ---------- Agent input ------------------------------------------

export interface EnrichmentAgentInput {
  /** The gallery's submitted envelope. Already schema-validated at
   *  the endpoint. The agent re-reads it through the CaMeL lens. */
  readonly submission: Trusted<ProvenanceSubmission, "gallery">;
  /** The current rectified artwork snapshot. Branded `'gallery'` at
   *  the intake → amend boundary before iteration #5 ever sees it. */
  readonly artwork: Trusted<ArtworkSnapshot, "gallery">;
  /** Pre-computed hash of `artwork` (see `computeWorkHash`). The
   *  agent echoes this on the output so the cache invalidation is
   *  content-addressable. */
  readonly basedOnWorkHash: string;
}

/**
 * The Q-LLM's narrow output schema. Mirrors the JSON-schema tool in
 * `@/ai/prompts/enrichment.ts` and is the only shape `sanitize()`
 * accepts from the quarantine call site.
 */
const SanitizedNoteSchema = z
  .object({
    note: z.union([z.string().min(1).max(160), z.null()]),
  })
  .strict();

type SanitizedNote = z.infer<typeof SanitizedNoteSchema>;

// ---------- The agent --------------------------------------------

/**
 * Run the enrichment agent. Returns a `'P'`-branded
 * `EnrichmentOutput` on success, `null` on terminal failure.
 * Callers must pass the result through a `persist.*` site before
 * the OPFS cache write.
 */
export async function runEnrichmentAgent(
  input: EnrichmentAgentInput,
): Promise<Trusted<EnrichmentOutput, "P"> | null> {
  return withOtelSpan(
    "gen_ai.agent.enrichment",
    async (span) => {
      span.setAttribute("gen_ai.system", "anthropic");
      span.setAttribute("gen_ai.request.model", AGENT_MODEL_IDS.enrichment);
      span.setAttribute("gen_ai.operation.name", "agent.enrichment");
      span.setAttribute(
        "pang.enrichment.submission_id",
        input.submission.submissionId,
      );
      span.setAttribute("pang.enrichment.work_id", input.submission.workId);
      span.setAttribute(
        "pang.enrichment.record_count",
        input.submission.records.length,
      );
      span.setAttribute(
        "pang.enrichment.contributor_role",
        input.submission.contributorRole,
      );

      const client = new Anthropic();

      // ---- 1. Q-LLM pass over every untrustedNote --------------
      const safeNotes: (string | null)[] = await Promise.all(
        input.submission.records.map((record, idx) =>
          record.untrustedNote === null || record.untrustedNote.length === 0
            ? Promise.resolve<string | null>(null)
            : runQuarantined(client, record.untrustedNote, idx, span),
        ),
      );

      // ---- 2. Deterministic timeline assembly -------------------
      const timeline = assembleTimeline(
        input.submission.records,
        safeNotes,
        input.submission.contributorRole,
      );

      // ---- 3. Budget check for the P-LLM round-trip -------------
      const safeNotesText = safeNotes.filter((n): n is string => n !== null);
      const pllmPromptText =
        PANG_VOICE_SYSTEM_PROMPT +
        ENRICHMENT_SYSTEM_PROMPT +
        JSON.stringify(input.artwork) +
        JSON.stringify(safeNotesText);
      const estimatedInput = estimateTokens({ text: pllmPromptText });
      enforceInputBudget("enrichment", estimatedInput);
      span.setAttribute("pang.input.tokens_estimate", estimatedInput);
      span.setAttribute("pang.agent.trust_sources", ["gallery", "P"]);

      // ---- 4. Capability assert before the round-trip -----------
      assertCapability("agent.enrichment.pLlm", input.submission);
      assertCapability("agent.enrichment.pLlm", input.artwork);

      // ---- 5. P-LLM call with retry -----------------------------
      const artistContext = await withRetry(RETRY_POLICY, async (attempt) => {
        const response = await client.messages.create({
          model: AGENT_MODEL_IDS.enrichment,
          max_tokens: AGENT_BUDGETS.enrichment.maxOutputTokens,
          temperature: RETRY_POLICY.temperatures?.[attempt] ?? 0,
          system: [
            {
              type: "text",
              text: PANG_VOICE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: ENRICHMENT_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [enrichmentTool],
          tool_choice: { type: "tool", name: enrichmentTool.name },
          messages: [
            {
              role: "user",
              content: buildPllmUserContent(input.artwork, safeNotesText),
            },
          ],
        });

        span.setAttribute(
          "gen_ai.usage.input_tokens",
          response.usage.input_tokens,
        );
        span.setAttribute(
          "gen_ai.usage.output_tokens",
          response.usage.output_tokens,
        );

        const toolUse = extractToolUse<unknown>(response);
        const validated: EnrichedArtistContext =
          EnrichedArtistContextSchema.parse(toolUse.input);
        return validated;
      });

      if (artistContext === null) return null;

      // ---- 6. Compose the output + re-parse + brand -------------
      const output: EnrichmentOutput = EnrichmentOutputSchema.parse({
        version: "v1",
        workId: input.submission.workId,
        basedOnWorkHash: input.basedOnWorkHash,
        timeline,
        artistContext,
        generatedAt: new Date().toISOString(),
      });

      span.setAttribute(
        "pang.enrichment.timeline_entries",
        output.timeline.length,
      );

      return brand(output, "P");
    },
    { "gen_ai.system": "anthropic" },
  );
}

// ---------- Deterministic timeline assembly -----------------------

/**
 * Assemble `TimelineEntry[]` from sanitised record fields.
 *
 * The P-LLM never sees this function's output nor authors any of
 * its entries — that is the load-bearing invariant. Every entry's
 * `note` is the corresponding *sanitised* safe note (or null).
 *
 * Sort order: `year` ascending, nulls last. Stable inside a single
 * year so two gallery records for the same year land in submission
 * order.
 */
export function assembleTimeline(
  records: readonly ProvenanceRecord[],
  safeNotes: readonly (string | null)[],
  contributorRole: ProvenanceSubmission["contributorRole"],
): TimelineEntry[] {
  if (records.length !== safeNotes.length) {
    throw new Error(
      "enrichment: safeNotes length must match records length",
    );
  }
  const entries = records.map((record, idx) =>
    TimelineEntrySchema.parse({
      year: record.year,
      location: record.location,
      context: record.context,
      imageRef: record.imageRef,
      note: safeNotes[idx] ?? null,
      contributorRole,
    }),
  );
  // Chronological sort, nulls last, stable within a year.
  const indexed = entries.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => {
    const ay = a.e.year;
    const by = b.e.year;
    if (ay === null && by === null) return a.i - b.i;
    if (ay === null) return 1;
    if (by === null) return -1;
    if (ay === by) return a.i - b.i;
    return ay - by;
  });
  return indexed.map((x) => x.e);
}

// ---------- Helpers -----------------------------------------------

function buildPllmUserContent(
  artwork: Trusted<ArtworkSnapshot, "gallery">,
  safeNotes: readonly string[],
): Anthropic.MessageParam["content"] {
  return [
    {
      type: "text",
      text: [
        "Artwork (verified, rectified):",
        JSON.stringify(artwork, null, 2),
        "",
        safeNotes.length === 0
          ? "No contributor notes survived sanitisation."
          : `Sanitised notes from contributors (${safeNotes.length}):`,
        ...safeNotes.map((n, i) => `  ${i + 1}. ${n}`),
        "",
        "Author the enriched artist context. Call the `enrichArtistContext` tool exactly once.",
      ].join("\n"),
    },
  ];
}

/**
 * Quarantined read of a single contributor note. Returns a
 * sanitised string (bounded to 160 chars) or `null` when the Q-LLM
 * found nothing worth keeping. The P-LLM never sees the raw text.
 *
 * The branding path mirrors the intake agent exactly: the Q-LLM
 * output is `'Q'`-branded, then immediately downgraded to `'P'`
 * via `sanitize()`, which re-parses against `SanitizedNoteSchema`
 * and runs the banned-vocabulary check.
 */
async function runQuarantined(
  client: Anthropic,
  untrustedNote: string,
  recordIndex: number,
  parentSpan: { setAttribute(k: string, v: unknown): void },
): Promise<string | null> {
  return withOtelSpan(
    "gen_ai.agent.enrichment.q",
    async (childSpan) => {
      childSpan.setAttribute("gen_ai.system", "anthropic");
      childSpan.setAttribute(
        "gen_ai.request.model",
        AGENT_MODEL_IDS.enrichmentQuarantine,
      );
      childSpan.setAttribute("gen_ai.operation.name", "agent.enrichment.q");
      childSpan.setAttribute(
        "pang.enrichment.record_index",
        recordIndex,
      );

      const untrusted: Untrusted<{ text: string }> = brand(
        { text: untrustedNote },
        "Q",
      );
      assertCapability("agent.enrichment.qLlm", untrusted);

      // Budget pre-check. The per-call text is tiny (≤256 chars), but
      // we still route through `enforceInputBudget` so an off-by-one
      // doctrine change surfaces in a clear place.
      const wrapped = wrapUntrusted(untrusted.text);
      enforceInputBudget(
        "enrichmentQuarantine",
        estimateTokens({
          text: ENRICHMENT_QUARANTINED_SYSTEM_PROMPT + wrapped,
        }),
      );

      const response = await client.messages.create({
        model: AGENT_MODEL_IDS.enrichmentQuarantine,
        max_tokens: AGENT_BUDGETS.enrichmentQuarantine.maxOutputTokens,
        temperature: 0,
        system: [
          {
            type: "text",
            text: ENRICHMENT_QUARANTINED_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [enrichmentQuarantinedTool],
        tool_choice: { type: "tool", name: enrichmentQuarantinedTool.name },
        messages: [{ role: "user", content: wrapped }],
      });

      childSpan.setAttribute(
        "gen_ai.usage.input_tokens",
        response.usage.input_tokens,
      );
      childSpan.setAttribute(
        "gen_ai.usage.output_tokens",
        response.usage.output_tokens,
      );

      const toolUse = extractToolUse<unknown>(response);
      const qBranded = brand(toolUse.input as object, "Q");
      const safe = sanitize(
        qBranded,
        SanitizedNoteSchema,
        "P",
      ) as Trusted<SanitizedNote, "P">;

      parentSpan.setAttribute(
        `pang.q_llm.note_${recordIndex}_kept`,
        safe.note !== null,
      );
      return safe.note;
    },
  );
}
