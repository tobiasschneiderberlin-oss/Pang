/**
 * PANG — shared agent contract.
 *
 * Every agent in `src/lib/agents/*.ts` is required to use the helpers
 * exported from here. The gate runner's A-series checks scan for
 * imports from this file; an agent that does not import the contract
 * fails CI.
 *
 * Re-exports are the primary interface. The point is that adding a
 * new agent means editing *one* file (`<agent>.ts`) and pulling from
 * this module — no helper lives somewhere else.
 */

export { PANG_VOICE_SYSTEM_PROMPT } from "@/ai/prompts/voice";
export { AGENT_MODEL_IDS } from "./models";
export type { AgentName } from "./models";
export {
  AGENT_BUDGETS,
  BudgetExceededError,
  GLOBAL_CAPS,
  enforceInputBudget,
  estimateTokens,
} from "./budgets";
export { withOtelSpan } from "@/lib/otel/span";
export type { Span, SpanAttributes } from "@/lib/otel/span";
export {
  wrapUntrusted,
  markUntrustedAttachment,
} from "@/ai/camel/wrapUntrusted";
export {
  PANGTrustViolation,
  acceptUser,
  acceptGallery,
  brand,
  trustSourceOf,
  type Trusted,
  type TrustSource,
  type Untrusted,
} from "@/ai/camel/trust";
export {
  assertCapability,
  allowedSources,
  CAPABILITIES,
  type CapabilitySite,
} from "@/ai/camel/capabilities";
export {
  sanitize,
  runBannedVocabularyCheck,
  VoiceViolation,
} from "@/ai/camel/sanitize";

// ---------- Tool-use helpers (A1) --------------------------------

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Extract the single tool-use block from a `messages.create`
 * response. Throws if zero or multiple blocks are present — the
 * structured-output contract requires exactly one.
 *
 * A1: this is the *only* way to read tool output. No call site may
 * reach into `response.content[i].input` directly.
 */
export function extractToolUse<T>(response: Anthropic.Message): {
  name: string;
  input: T;
  id: string;
} {
  const blocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (blocks.length === 0) {
    throw new AgentContractError(
      "no_tool_use",
      "agent returned no tool_use block",
    );
  }
  if (blocks.length > 1) {
    throw new AgentContractError(
      "multiple_tool_use",
      `agent returned ${blocks.length} tool_use blocks; expected 1`,
    );
  }
  const block = blocks[0]!;
  return { name: block.name, input: block.input as T, id: block.id };
}

/**
 * Thrown for structural violations of the agent contract. Separate
 * from `PANGTrustViolation` (security) and `VoiceViolation` (voice)
 * so the runner can report each class independently.
 */
export class AgentContractError extends Error {
  constructor(
    public readonly kind:
      | "no_tool_use"
      | "multiple_tool_use"
      | "schema_mismatch"
      | "max_retries_exhausted",
    message: string,
  ) {
    super(message);
    this.name = "AgentContractError";
  }
}

// ---------- Retry policy contract (A21) --------------------------

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly onTerminalFailure: "compensate" | "null" | "throw";
  /** Optional per-attempt override for `temperature` — later attempts
   *  can loosen or tighten to break a loop. */
  readonly temperatures?: readonly number[];
}

/**
 * Run the agent function with the declared retry policy. Each attempt
 * catches only `ZodError` (schema mismatch) and `AgentContractError`
 * (no tool use). Security and budget failures short-circuit — those
 * are not retryable.
 */
export async function withRetry<T>(
  policy: RetryPolicy,
  attempt: (n: number) => Promise<T>,
): Promise<T | null> {
  const { ZodError } = await import("zod");
  let lastError: unknown;
  for (let n = 0; n <= policy.maxRetries; n++) {
    try {
      return await attempt(n);
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof ZodError ||
        (err instanceof AgentContractError &&
          err.kind !== "max_retries_exhausted");
      if (!retryable || n === policy.maxRetries) break;
    }
  }
  switch (policy.onTerminalFailure) {
    case "null":
      return null;
    case "compensate":
      // Compensation UI is the caller's responsibility. Throw a
      // distinguished error so the route handler can route it.
      throw new AgentContractError(
        "max_retries_exhausted",
        `compensate: ${errorMessage(lastError)}`,
      );
    case "throw":
    default:
      throw lastError instanceof Error
        ? lastError
        : new Error(errorMessage(lastError));
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
