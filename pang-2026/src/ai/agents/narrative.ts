/**
 * PANG — Narrative Agent (iter #14).
 *
 * Fourth agent in the four-agent architecture. Authors a single short
 * observational paragraph about the collector's collection, shown as
 * a passive overlay in The Room no more than once per calendar month
 * per collector.
 *
 * Why a separate agent:
 *
 *   - The spine's line on this surface is specific: "Observation, not
 *     evaluation." The voice seed + `NARRATIVE_SYSTEM_PROMPT` + the
 *     hard post-generation check hold the register together. A
 *     one-shot template can't carry the specificity ("your fourth
 *     Hojgaard, the largest") without reading like a form letter.
 *   - The input is already sanitised — provenance is 'gallery', bio-
 *     muji is 'P' from the Enrichment pass. No 'Q' enters; no
 *     Q-LLM pass is needed. Capability site is `agent.narrative.pLlm:
 *     ["P", "gallery"]`.
 *
 * CaMeL:
 *   - `assertCapability("agent.narrative.pLlm", input)` runs before
 *     the round-trip (A7). The input is 'P'-branded by the assembler;
 *     the capability table accepts 'P' | 'gallery'.
 *   - The output is parsed through `NarrativeOutputSchema` (A1, A3).
 *   - `runBannedVocabularyCheck` runs on `{ narrative: output.paragraph
 *     }` — the "narrative" key activates the soft-list *hard* path
 *     inside `sanitize.ts`, so `EVALUATIVE_VOCABULARY` is enforced as
 *     a fail, not a warning. This is the A5 defence-in-depth layer; the
 *     schema `.refine()` is the first pass.
 *
 * Retry policy (A21): two retries after initial, temperature climb
 * 0.2 → 0.4 → 0.6. Terminal failure returns `null` — the overlay
 * stays silent for the month. "We have nothing to observe this
 * month" is the right register; an error modal is not.
 *
 * Budget (A18, A23): `AGENT_BUDGETS.narrative` — 4k input, 512
 * output, $0.10/call. One call per collector per calendar month, so
 * the per-account monthly cap (A23) has headroom.
 *
 * Model pin (A19): `claude-sonnet-4-6` via `AGENT_MODEL_IDS.narrative`
 * — short-prose Sonnet is the right point. Haiku (correspondence)
 * reads slightly terser than the spine asks for this surface.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_BUDGETS,
  AGENT_MODEL_IDS,
  PANG_VOICE_SYSTEM_PROMPT,
  assertCapability,
  brand,
  enforceInputBudget,
  estimateTokens,
  extractToolUse,
  runBannedVocabularyCheck,
  withOtelSpan,
  withRetry,
  type RetryPolicy,
  type Trusted,
} from "./_shared";
import {
  NARRATIVE_SYSTEM_PROMPT,
  narrativeTool,
} from "@/ai/prompts/narrative";
import {
  NarrativeOutputSchema,
  type NarrativeInput,
  type NarrativeOutput,
} from "@/narrative/schema";

// ---------- Retry policy (A21) -----------------------------------

/**
 * Narrative is a background pipeline, not an interactive path. Two
 * retries is still right — a single model burp shouldn't burn the
 * month, but we don't want to hammer the endpoint with a fallback
 * cascade. Same shape as the other agents so the A22 corpus shares
 * attempt semantics.
 *
 * `onTerminalFailure: "null"` — the route writes a `kind: "skipped"`
 * marker with `reason: "agent-failure"` and the month is closed.
 */
export const RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  onTerminalFailure: "null",
  temperatures: [0.2, 0.4, 0.6],
} as const;

/** Eval threshold (A22). Aligns with the other agents. */
export const EVAL_THRESHOLD = 0.85 as const;

// ---------- The agent --------------------------------------------

/**
 * Run the Narrative Agent. Returns a `'P'`-branded `NarrativeOutput`
 * on success, `null` on terminal failure. The route caller writes
 * the marker — this function is pure input → output, no I/O.
 */
export async function runNarrative(
  input: Trusted<NarrativeInput, "P">,
): Promise<Trusted<NarrativeOutput, "P"> | null> {
  return withOtelSpan(
    "pang.narrative.generate",
    async (span) => {
      span.setAttribute("gen_ai.system", "anthropic");
      span.setAttribute("gen_ai.request.model", AGENT_MODEL_IDS.narrative);
      span.setAttribute("gen_ai.operation.name", "agent.narrative");
      span.setAttribute("pang.narrative.month", input.month);
      span.setAttribute(
        "pang.narrative.verified_work_count",
        input.verifiedWorks.length,
      );
      span.setAttribute(
        "pang.narrative.provenance_entry_count",
        input.provenanceEntries.length,
      );
      span.setAttribute(
        "pang.narrative.collection_hash",
        input.collectionHash,
      );

      // ---- Capability assert before the round-trip -------------
      assertCapability("agent.narrative.pLlm", input);

      const client = new Anthropic();

      // ---- Budget check before the round-trip ------------------
      const userText = renderUserText(input);
      const userContent: Anthropic.MessageParam["content"] = [
        { type: "text", text: userText },
      ];
      const estimatedInput = estimateTokens({
        text:
          PANG_VOICE_SYSTEM_PROMPT +
          NARRATIVE_SYSTEM_PROMPT +
          userText,
      });
      enforceInputBudget("narrative", estimatedInput);
      span.setAttribute("pang.input.tokens_estimate", estimatedInput);
      span.setAttribute("pang.agent.trust_sources", ["P", "gallery"]);

      // ---- P-LLM call with retry -------------------------------
      const output = await withRetry(RETRY_POLICY, async (attempt) => {
        const response = await client.messages.create({
          model: AGENT_MODEL_IDS.narrative,
          max_tokens: AGENT_BUDGETS.narrative.maxOutputTokens,
          temperature: RETRY_POLICY.temperatures?.[attempt] ?? 0.2,
          system: [
            {
              type: "text",
              text: PANG_VOICE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: NARRATIVE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [narrativeTool],
          tool_choice: { type: "tool", name: narrativeTool.name },
          messages: [{ role: "user", content: userContent }],
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
        const validated: NarrativeOutput = NarrativeOutputSchema.parse(
          toolUse.input,
        );

        // ---- A5 defence-in-depth -------------------------------
        // Wrap the paragraph under the `narrative` field name so the
        // sanitize walker flips on the narrative-context branch and
        // runs EVALUATIVE_VOCABULARY hard (not just the marketing
        // ban list). A regression in the schema refine would still
        // be caught here.
        runBannedVocabularyCheck({ narrative: validated.paragraph });

        return validated;
      });

      if (output === null) {
        span.setAttribute("pang.narrative.failure_reason", "agent-failure");
        return null;
      }

      span.setAttribute(
        "pang.narrative.paragraph_length",
        output.paragraph.length,
      );

      return brand(output, "P");
    },
    { "gen_ai.system": "anthropic" },
  );
}

// ---------- Helpers ----------------------------------------------

function renderUserText(input: NarrativeInput): string {
  return [
    `Month: ${input.month}`,
    `Collection hash: ${input.collectionHash}`,
    "",
    `Verified works (${input.verifiedWorks.length}):`,
    JSON.stringify(input.verifiedWorks, null, 2),
    "",
    `Provenance entries (${input.provenanceEntries.length}):`,
    JSON.stringify(input.provenanceEntries, null, 2),
    "",
    "Artist bioMuji paragraphs:",
    JSON.stringify(input.bioMujiParagraphs, null, 2),
    "",
    "Call `composeMonthlyReading` exactly once.",
  ].join("\n");
}
