/**
 * PANG — Intake Agent.
 *
 * The canonical first agent. The kickoff brief for iteration #1
 * declares it ships at the full 48-gate ceiling. See:
 *   - `PANG_AI_Era_2026.md` §§ 3, 7c
 *   - `PANG_Aha_Sprint.md` §§ "Iteration #1 — Intake Agent"
 *   - `PANG_Gates.md` §§ A1–A23
 *
 * Flow (matching the brief's ASCII diagram):
 *   1. If `untrustedDoc` present → Q-LLM pass → sanitize() → safeFields
 *   2. P-LLM (Vision) with rectified image + safeFields
 *   3. extractToolUse → Zod parse → runBannedVocabularyCheck
 *   4. Brand result as `Trusted<IntakeOutput, 'P'>`
 *   5. Return
 *
 * Retry policy: two retries on `ZodError` / no-tool-use with a
 * temperature escalation. Terminal failure → compensate (the UI
 * opens the amend surface).
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
  INTAKE_SYSTEM_PROMPT,
  intakeTool,
  QUARANTINED_SYSTEM_PROMPT,
  quarantinedTool,
} from "@/ai/prompts/intake";
import {
  IntakeOutputSchema,
  QuarantinedDocumentFieldsSchema,
  type IntakeOutput,
  type QuarantinedDocumentFields,
} from "@/ai/tools/artwork";

// ---------- Agent input ------------------------------------------

export interface IntakeAgentInput {
  /** Rectified PNG bytes (from the scanner worker). User-branded
   *  because the user held the device; capability graph allows
   *  this into `agent.intake.pLlm`. */
  readonly image: Trusted<{ bytes: Uint8Array; mime: "image/png" }, "user">;
  /** Optional untrusted document text (email body, scanned PDF
   *  text). Q-LLM reads this; P-LLM never does. */
  readonly untrustedDoc?: Untrusted<{ text: string }>;
  /** Capture metadata — client-declared; observability only. */
  readonly captureMeta: {
    capturedAt: string;
    tier: "A" | "B" | "C";
  };
}

// ---------- Retry policy (A21) -----------------------------------

export const RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  onTerminalFailure: "compensate",
  temperatures: [0.0, 0.3, 0.6],
} as const;

// ---------- Eval threshold (A22) ---------------------------------

export const EVAL_THRESHOLD = 0.85 as const;

// ---------- The agent --------------------------------------------

/**
 * Run the intake agent. Returns a `'P'`-branded `IntakeOutput`.
 * Callers must pass the result through `persist.supabase`-capable
 * sites only (see `CAPABILITIES`).
 */
export async function runIntakeAgent(
  input: IntakeAgentInput,
): Promise<Trusted<IntakeOutput, "P"> | null> {
  return withOtelSpan(
    "gen_ai.agent.intake",
    async (span) => {
      span.setAttribute("gen_ai.system", "anthropic");
      span.setAttribute("gen_ai.request.model", AGENT_MODEL_IDS.intake);
      span.setAttribute("gen_ai.operation.name", "agent.intake");
      span.setAttribute("pang.capture.tier", input.captureMeta.tier);

      const client = new Anthropic();

      // ---- 1. Q-LLM pass if document present -----------------
      const safeFields = input.untrustedDoc
        ? await runQuarantined(client, input.untrustedDoc, span)
        : null;

      // ---- 2. Budget check ---------------------------------
      const estimatedInput = estimateTokens({
        text:
          PANG_VOICE_SYSTEM_PROMPT +
          INTAKE_SYSTEM_PROMPT +
          JSON.stringify(safeFields ?? {}),
        imageBase64Bytes: Math.ceil((input.image.bytes.byteLength * 4) / 3),
      });
      enforceInputBudget("intake", estimatedInput);
      span.setAttribute("pang.input.tokens_estimate", estimatedInput);
      span.setAttribute(
        "pang.agent.trust_sources",
        safeFields ? ["user", "P"] : ["user"],
      );

      // ---- 3. Capability assert before the round-trip -------
      assertCapability("agent.intake.pLlm", input.image);
      if (safeFields) assertCapability("agent.intake.pLlm", safeFields);

      // ---- 4. P-LLM call with retry -------------------------
      const result = await withRetry(RETRY_POLICY, async (attempt) => {
        const response = await client.messages.create({
          model: AGENT_MODEL_IDS.intake,
          max_tokens: AGENT_BUDGETS.intake.maxOutputTokens,
          temperature: RETRY_POLICY.temperatures?.[attempt] ?? 0,
          system: [
            {
              type: "text",
              text: PANG_VOICE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: INTAKE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [intakeTool],
          tool_choice: { type: "tool", name: intakeTool.name },
          messages: [
            {
              role: "user",
              content: buildUserContent(input, safeFields),
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
        const validated = IntakeOutputSchema.parse(toolUse.input);
        return validated;
      });

      if (result === null) return null;

      // ---- 5. Brand and return ------------------------------
      return brand(result, "P");
    },
    { "gen_ai.system": "anthropic" },
  );
}

// ---------- Helpers -----------------------------------------------

function buildUserContent(
  input: IntakeAgentInput,
  safeFields: Trusted<QuarantinedDocumentFields, "P"> | null,
): Anthropic.MessageParam["content"] {
  const base64 = toBase64(input.image.bytes);
  const parts: Anthropic.MessageParam["content"] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: base64,
      },
    },
    {
      type: "text",
      text: safeFields
        ? `Safe fields from attached document (already sanitized):\n${JSON.stringify(
            safeFields,
            null,
            2,
          )}\n\nExtract the artwork record. Call the intake tool exactly once.`
        : "Extract the artwork record from this image. Call the intake tool exactly once.",
    },
  ];
  return parts;
}

/**
 * Quarantined read of an untrusted document. Returns a
 * `'P'`-branded safeFields object via `sanitize()`. The P-LLM
 * never sees the raw document bytes.
 */
async function runQuarantined(
  client: Anthropic,
  untrustedDoc: Untrusted<{ text: string }>,
  span: { setAttribute(k: string, v: unknown): void },
): Promise<Trusted<QuarantinedDocumentFields, "P">> {
  return withOtelSpan(
    "gen_ai.agent.intake.q",
    async (childSpan) => {
      childSpan.setAttribute("gen_ai.system", "anthropic");
      childSpan.setAttribute(
        "gen_ai.request.model",
        AGENT_MODEL_IDS.intakeQuarantine,
      );
      childSpan.setAttribute("gen_ai.operation.name", "agent.intake.q");

      assertCapability("agent.intake.qLlm", untrustedDoc);

      const wrapped = wrapUntrusted(untrustedDoc.text);
      const response = await client.messages.create({
        model: AGENT_MODEL_IDS.intakeQuarantine,
        max_tokens: AGENT_BUDGETS.intakeQuarantine.maxOutputTokens,
        temperature: 0,
        system: [
          {
            type: "text",
            text: QUARANTINED_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [quarantinedTool],
        tool_choice: { type: "tool", name: quarantinedTool.name },
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

      // The Q-LLM's output is 'Q'-branded here, then immediately
      // downgraded to 'P' via sanitize() which re-parses against
      // the narrow QuarantinedDocumentFields schema.
      const qBranded = brand(toolUse.input as object, "Q");
      const safe = sanitize(
        qBranded,
        QuarantinedDocumentFieldsSchema,
        "P",
      ) as Trusted<QuarantinedDocumentFields, "P">;

      span.setAttribute("pang.q_llm.fields_found", Object.keys(safe).length);
      return safe;
    },
  );
}

function toBase64(bytes: Uint8Array): string {
  // Node & modern browsers: Buffer isn't available in the browser,
  // so use a pure-TS loop. The agent runs server-side (route handler),
  // but the helper is safe either way.
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { Buffer?: unknown }).Buffer !== "undefined"
  ) {
    const BufferCtor = (
      globalThis as { Buffer: { from(b: Uint8Array): { toString(enc: string): string } } }
    ).Buffer;
    return BufferCtor.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
