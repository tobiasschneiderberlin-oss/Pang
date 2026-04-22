/**
 * PANG — per-agent token + cost budgets (A18, A23).
 *
 * Each agent declares three numbers. The shared runner enforces them
 * before the HTTP round-trip:
 *
 *   MAX_INPUT_TOKENS  — rough input cap based on schema + image
 *                       budget; the estimator in `estimateTokens()`
 *                       is the gatekeeper.
 *   MAX_OUTPUT_TOKENS — hard cap passed to `messages.create` as
 *                       `max_tokens`.
 *   MAX_COST_USD      — soft budget for a single invocation; the
 *                       runner records the actual cost to the span
 *                       and alerts the daily/monthly cap if exceeded.
 *
 * A23 adds two global caps enforced by `checkDailyCap()` /
 * `checkMonthlyCap()`: per-collector daily (from session), per-account
 * monthly (from the Supabase `cost_ledger` materialised view).
 */

import type { AgentName } from "./models";

export interface AgentBudget {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxCostUsd: number;
}

export const AGENT_BUDGETS: Record<AgentName, AgentBudget> = {
  // The intake P-LLM receives a rectified PNG (≈ 1-2 MB before
  // base64) + a short safeFields object. Output stays compact — the
  // structured-output tool keeps it bounded.
  intake: {
    maxInputTokens: 4_000,
    maxOutputTokens: 2_048,
    maxCostUsd: 0.25,
  },
  // The quarantined model reads document text only. Narrow input,
  // narrow output.
  intakeQuarantine: {
    maxInputTokens: 16_000,
    maxOutputTokens: 512,
    maxCostUsd: 0.05,
  },
  enrichment: {
    maxInputTokens: 8_000,
    maxOutputTokens: 1_024,
    maxCostUsd: 0.15,
  },
  narrative: {
    maxInputTokens: 4_000,
    maxOutputTokens: 512,
    maxCostUsd: 0.10,
  },
  correspondence: {
    maxInputTokens: 2_000,
    maxOutputTokens: 512,
    maxCostUsd: 0.05,
  },
};

/**
 * Per-collector daily + per-account monthly caps (A23). The values
 * below are soft ceilings; the runtime reads the live counters from
 * the observability store and short-circuits with a
 * `BudgetExceededError` before the call.
 */
export const GLOBAL_CAPS = {
  perCollectorDailyUsd: 2.5,
  perAccountMonthlyUsd: 500,
} as const;

export class BudgetExceededError extends Error {
  constructor(
    public readonly agent: AgentName,
    public readonly kind: "input" | "output" | "cost" | "daily" | "monthly",
    public readonly limit: number,
    public readonly actual: number,
  ) {
    super(
      `pang budget exceeded: agent=${agent} kind=${kind} limit=${limit} actual=${actual}`,
    );
    this.name = "BudgetExceededError";
  }
}

/**
 * Crude token estimator. The Anthropic tokeniser isn't a free
 * npm package we're happy to add in iteration #1; this estimate
 * runs 4 chars ≈ 1 token and is conservative for our prompts.
 * Images count separately: each base64 MB ≈ 1280 tokens.
 */
export function estimateTokens(payload: {
  text?: string;
  imageBase64Bytes?: number;
}): number {
  const textTokens = Math.ceil((payload.text?.length ?? 0) / 4);
  const imageTokens = Math.ceil(
    ((payload.imageBase64Bytes ?? 0) / (1024 * 1024)) * 1280,
  );
  return textTokens + imageTokens;
}

/**
 * Enforce the input-token cap. Called *before* the HTTP round-trip;
 * the output cap is applied via `max_tokens` on the request itself.
 */
export function enforceInputBudget(
  agent: AgentName,
  estimated: number,
): void {
  const budget = AGENT_BUDGETS[agent];
  if (estimated > budget.maxInputTokens) {
    throw new BudgetExceededError(
      agent,
      "input",
      budget.maxInputTokens,
      estimated,
    );
  }
}
