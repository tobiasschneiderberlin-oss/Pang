/**
 * PANG — Correspondence Agent (iter #10).
 *
 * Composes the short verification-request message the collector
 * sends to their gallery by email or WhatsApp. The route handler
 * (`/api/verification/dispatch`) feeds the agent a rectified artwork
 * snapshot + the gallery's display name + the chosen channel; the
 * agent returns a Zod-validated `CorrespondenceOutput` carrying a
 * subject (email only) and a body with the two placeholder strings
 * `{{CONFIRM_URL}}` and `{{DECLINE_URL}}`. The route replaces the
 * placeholders with the signed confirm + decline links.
 *
 * Why a separate agent, not a hand-rolled template:
 *
 *   - The collector sees the body before they tap send. A template
 *     reads like a form letter; a composed message reads like the
 *     message the collector might have written themselves. The
 *     Museumsschild test is the gate.
 *   - The artwork snapshot is irregular — artist null, year null,
 *     dimensions missing. The agent elides missing fields gracefully;
 *     a template chokes on nulls or emits scaffold-looking clauses.
 *   - Voice discipline (A5 banned-vocabulary, no marketing, no
 *     emojis, no title case) is prompt-enforced through the shared
 *     PANG_VOICE_SYSTEM_PROMPT + agent system prompt. A regression
 *     there surfaces as an eval failure, not a rewrite.
 *
 * Safety:
 *   - The agent never sees the signed confirm/decline URLs. It
 *     emits placeholders; the route substitutes them. Keeps the
 *     cryptographic payload out of the prompt cache and makes an
 *     injection that rewrites the link impossible.
 *   - `assertCapability` checks the trust source of `artwork` before
 *     the P-LLM round-trip (A7/A8). The artwork must be `'gallery'`
 *     or `'P'`-branded; an unvetted `'Q'`-branded input short-
 *     circuits with a `PANGTrustViolation`.
 *
 * Retry policy (A21): two retries after the initial attempt. Terminal
 * failure returns `null` — the route's caller flips the UI back to
 * `"requested"` and shows the send-now affordance without a message
 * preview. No error surface.
 *
 * Budget (A18, A23): `AGENT_BUDGETS.correspondence` — 2k input, 512
 * output, $0.05/call. Model pinned to `claude-haiku-4-5` in
 * `@/ai/agents/models.ts`; Haiku is the right speed/cost point for a
 * sub-second interactive message compose.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_MODEL_IDS,
  AGENT_BUDGETS,
  AgentContractError,
  PANG_VOICE_SYSTEM_PROMPT,
  assertCapability,
  brand,
  enforceInputBudget,
  estimateTokens,
  extractToolUse,
  runBannedVocabularyCheck,
  VoiceViolation,
  withOtelSpan,
  withRetry,
  type RetryPolicy,
  type Trusted,
} from "./_shared";
import {
  CORRESPONDENCE_SYSTEM_PROMPT,
  correspondenceTool,
} from "@/ai/prompts/correspondence";
import {
  CONFIRM_PLACEHOLDER,
  CorrespondenceOutputSchema,
  DECLINE_PLACEHOLDER,
  checkPlaceholders,
  type CorrespondenceChannel,
  type CorrespondenceOutput,
} from "@/verification/correspondence.schema";
import type { ArtworkSnapshot } from "@/verification/schema";

// ---------- Retry policy (A21) -----------------------------------

/**
 * Correspondence is on the collector's interactive path. Latency
 * matters: a four-second compose round-trip is fine; a ten-second
 * retry loop is not. Two retries after the initial attempt, same
 * shape as intake and enrichment so the eval corpus (A22) shares
 * attempt-to-seed mappings.
 *
 * `onTerminalFailure: "null"` — the collector sees no preview and
 * the dispatch route returns a degraded payload (no `previewBody`,
 * a fallback body template). The failure is observable in
 * `correspondence.agent.fail` telemetry.
 */
export const RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  onTerminalFailure: "null",
  temperatures: [0.2, 0.4, 0.6],
} as const;

/** Eval threshold (A22). Aligns with intake + enrichment. */
export const EVAL_THRESHOLD = 0.85 as const;

// ---------- Agent input ------------------------------------------

export interface CorrespondenceAgentRunInput {
  /** Rectified artwork snapshot, already trust-branded. */
  readonly artwork: Trusted<ArtworkSnapshot, "gallery" | "P">;
  /**
   * The gallery's display name, wrapped in an object (the `assertCapability`
   * runtime requires a branded object; a bare primitive fails closed).
   * Branded at the route boundary with the gallery trust source.
   */
  readonly gallery: Trusted<{ readonly displayName: string }, "gallery" | "P">;
  /** Which channel the collector chose. */
  readonly channel: CorrespondenceChannel;
}

// ---------- The agent --------------------------------------------

/**
 * Run the Correspondence Agent. Returns a `'P'`-branded
 * `CorrespondenceOutput` on success, `null` on terminal failure.
 * The dispatch route must replace the two placeholders in `body`
 * before the message is handed off to the collector's browser.
 */
export async function runCorrespondenceAgent(
  input: CorrespondenceAgentRunInput,
): Promise<Trusted<CorrespondenceOutput, "P"> | null> {
  return withOtelSpan(
    "gen_ai.agent.correspondence",
    async (span) => {
      span.setAttribute("gen_ai.system", "anthropic");
      span.setAttribute(
        "gen_ai.request.model",
        AGENT_MODEL_IDS.correspondence,
      );
      span.setAttribute("gen_ai.operation.name", "agent.correspondence");
      span.setAttribute("pang.correspondence.channel", input.channel);

      const client = new Anthropic();

      // ---- Budget check before the round-trip ------------------
      const userContent = buildUserContent(input);
      const promptText =
        PANG_VOICE_SYSTEM_PROMPT +
        CORRESPONDENCE_SYSTEM_PROMPT +
        userContent;
      const estimatedInput = estimateTokens({ text: promptText });
      enforceInputBudget("correspondence", estimatedInput);
      span.setAttribute("pang.input.tokens_estimate", estimatedInput);
      span.setAttribute("pang.agent.trust_sources", ["gallery", "P"]);

      // ---- Capability assert before the round-trip -------------
      assertCapability("agent.correspondence.pLlm", input.artwork);
      assertCapability("agent.correspondence.pLlm", input.gallery);

      // ---- P-LLM call with retry -------------------------------
      const output = await withRetry(RETRY_POLICY, async (attempt) => {
        const response = await client.messages.create({
          model: AGENT_MODEL_IDS.correspondence,
          max_tokens: AGENT_BUDGETS.correspondence.maxOutputTokens,
          temperature: RETRY_POLICY.temperatures?.[attempt] ?? 0.2,
          system: [
            {
              type: "text",
              text: PANG_VOICE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: CORRESPONDENCE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [correspondenceTool],
          tool_choice: { type: "tool", name: correspondenceTool.name },
          messages: [
            {
              role: "user",
              content: userContent,
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
        const validated: CorrespondenceOutput =
          CorrespondenceOutputSchema.parse(toolUse.input);

        // ---- Defence-in-depth checks after schema parse ------
        if (validated.bannedVocabularyDetected) {
          // The agent flagged itself; rejected path forces a retry.
          throw new VoiceViolation(
            "$.bannedVocabularyDetected",
            "self-flagged",
            "agent set bannedVocabularyDetected=true",
          );
        }
        // WhatsApp MUST have null subject; email MUST have a subject.
        if (input.channel === "whatsapp" && validated.subject !== null) {
          throw new AgentContractError(
            "schema_mismatch",
            "whatsapp channel requires null subject",
          );
        }
        if (input.channel === "email" && validated.subject === null) {
          throw new AgentContractError(
            "schema_mismatch",
            "email channel requires a subject",
          );
        }
        // Placeholders exactly once each.
        const ph = checkPlaceholders(validated.body);
        if (!ph.ok) {
          throw new AgentContractError(
            "schema_mismatch",
            `placeholder check failed: ${ph.reason}`,
          );
        }
        // Banned-vocabulary check on subject + body.
        runBannedVocabularyCheck(validated.body);
        if (validated.subject !== null) {
          runBannedVocabularyCheck(validated.subject);
        }

        return validated;
      });

      if (output === null) return null;

      span.setAttribute("pang.correspondence.body_length", output.body.length);
      if (output.subject !== null) {
        span.setAttribute(
          "pang.correspondence.subject_length",
          output.subject.length,
        );
      }

      return brand(output, "P");
    },
    { "gen_ai.system": "anthropic" },
  );
}

// ---------- Helpers ----------------------------------------------

function buildUserContent(
  input: CorrespondenceAgentRunInput,
): Anthropic.MessageParam["content"] {
  return [
    {
      type: "text",
      text: [
        `Channel: ${input.channel}`,
        `Gallery: ${input.gallery.displayName}`,
        "",
        "Artwork:",
        JSON.stringify(input.artwork, null, 2),
        "",
        `Body MUST contain ${CONFIRM_PLACEHOLDER} and ${DECLINE_PLACEHOLDER} exactly once each.`,
        input.channel === "whatsapp"
          ? "Subject MUST be null (WhatsApp)."
          : "Subject is required (email).",
        "",
        "Call `composeVerificationMessage` exactly once.",
      ].join("\n"),
    },
  ];
}

// ---------- Placeholder substitution -----------------------------

/**
 * Replace `{{CONFIRM_URL}}` and `{{DECLINE_URL}}` in the composed
 * body. Idempotent — calling twice with the same URLs yields the
 * same string. The caller is the dispatch route; the agent never
 * touches the signed URLs.
 *
 * Exported here (not in the schema module) because the substitution
 * is a concern of the agent output lifecycle: the output is not
 * "final" until the URLs land.
 */
export function substitutePlaceholders(
  body: string,
  confirmUrl: string,
  declineUrl: string,
): string {
  return body
    .split(CONFIRM_PLACEHOLDER)
    .join(confirmUrl)
    .split(DECLINE_PLACEHOLDER)
    .join(declineUrl);
}
