/**
 * PANG — agent model registry.
 *
 * Deterministic per-agent model selection (A19). No agent may
 * construct a model ID at runtime — the strings live here and here
 * only, keyed by agent name. Env overrides are allowed in this file
 * and only this file; the gate runner scans the rest of `src/lib/
 * agents/` to ensure no other module touches `ANTHROPIC_MODEL_*`.
 *
 * When a model id moves (e.g. Sonnet 4.6 → 4.7), this is the single
 * PR target. The Aha-sprint iteration logs the rationale.
 */

/**
 * Production model IDs. Pinned to the 2026 generation we validated
 * against; changing one of these requires running the eval corpus
 * (A22) and documenting the pass-rate delta.
 */
const DEFAULT_MODELS = {
  intakePrimary: "claude-sonnet-4-6", // Vision + structured output
  intakeQuarantine: "claude-haiku-4-6", // document extraction only
  enrichment: "claude-sonnet-4-6",
  narrative: "claude-sonnet-4-6",
  correspondence: "claude-sonnet-4-6",
} as const;

/** Read an env override, falling back to the pinned default. */
function pick(envKey: string, fallback: string): string {
  const v = process.env[envKey];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export const AGENT_MODEL_IDS = {
  intake: pick("ANTHROPIC_MODEL_INTAKE", DEFAULT_MODELS.intakePrimary),
  intakeQuarantine: pick(
    "ANTHROPIC_MODEL_INTAKE_Q",
    DEFAULT_MODELS.intakeQuarantine,
  ),
  enrichment: pick("ANTHROPIC_MODEL_ENRICHMENT", DEFAULT_MODELS.enrichment),
  narrative: pick("ANTHROPIC_MODEL_NARRATIVE", DEFAULT_MODELS.narrative),
  correspondence: pick(
    "ANTHROPIC_MODEL_CORRESPONDENCE",
    DEFAULT_MODELS.correspondence,
  ),
} as const;

export type AgentName = keyof typeof AGENT_MODEL_IDS;
