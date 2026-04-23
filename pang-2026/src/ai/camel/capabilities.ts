/**
 * PANG — the capability graph.
 *
 * Single source of truth for *who accepts what*. Every Anthropic call
 * site, every persist path, every render surface declares its
 * accepted trust sources here. Adding an agent or a persist target
 * means adding a row — the A7 AST check (scripts/check-gates.ts) will
 * fail the build otherwise.
 *
 * See `PANG_AI_Era_2026.md` § 7c.
 */

import {
  PANGTrustViolation,
  trustSourceOf,
  type Trusted,
  type TrustSource,
} from "./trust";

/**
 * Declared capability table. Read-only at runtime; keys are scanned
 * at build time by the A7 gate.
 */
export const CAPABILITIES = {
  // --- Intake Agent ---------------------------------------------
  // P-LLM orchestrator. Never accepts 'Q'. Reads the rectified
  // image (branded as 'P' on the client because it is a user-held
  // object) and returns structured fields.
  "agent.intake.pLlm": ["user", "gallery", "P"],
  // Q-LLM quarantine. Reads untrusted document/email/certificate
  // content and produces 'Q'-branded fields only.
  "agent.intake.qLlm": ["Q"],

  // --- Enrichment Agent (iteration #5) --------------------------
  // P-LLM authors the enriched `bioMuji` paragraph only. Accepts
  // 'P'-branded sanitised fields (from the Q-LLM pass) and 'gallery'
  // identity, never raw 'Q'.
  "agent.enrichment.pLlm": ["gallery", "P"],
  // Q-LLM quarantine for per-record `untrustedNote` sanitisation.
  // Mirrors `agent.intake.qLlm`: reads 'Q'-branded content only and
  // returns 'Q'-branded fields, which `sanitize()` downgrades to 'P'.
  "agent.enrichment.qLlm": ["Q"],

  // --- Narrative Agent (iteration #10) --------------------------
  "agent.narrative.pLlm": ["P", "gallery"],

  // --- Correspondence Agent (iteration #8) ----------------------
  "agent.correspondence.pLlm": ["user", "gallery", "P"],

  // --- Persistence ----------------------------------------------
  // Supabase accepts nothing Q-branded. Q must go through
  // sanitize() first.
  "persist.supabase": ["user", "gallery", "P"],
  // OPFS is local-only — Q-branded bytes are fine there, they never
  // leave the device unsanitized.
  "persist.opfs": ["user", "gallery", "P", "Q"],

  // --- Render --------------------------------------------------
  "render.ui.primary": ["user", "gallery", "P"],
  // The only surface allowed to render 'Q' — always wrapped in
  // <Confidence source="ai"> with the gray-ink token.
  "render.ui.quarantined": ["Q"],
} as const satisfies Record<string, readonly TrustSource[]>;

export type CapabilitySite = keyof typeof CAPABILITIES;

/**
 * Runtime check. Throws `PANGTrustViolation` if the value's trust
 * source is not in the site's allow-list. The thrown error is
 * caught by the agent-error-contract wrapper (see `agents/base.ts`)
 * which emits an OTel span with `pang.trust.violation=true`.
 *
 * Call this for every interpolated field before the HTTP round-trip
 * or the DOM render.
 */
export function assertCapability<K extends CapabilitySite>(
  site: K,
  field: Trusted<unknown, TrustSource>,
): void {
  if (field === null || typeof field !== "object") {
    // Primitives cannot carry a brand at runtime. By convention,
    // every boundary that produces 'Q' wraps the primitive in a
    // single-field object; an unbranded primitive at a call site is
    // a programming error, not a trust event.
    throw new PANGTrustViolation(site, null, CAPABILITIES[site]);
  }
  const source = trustSourceOf(field as object);
  const allowed = CAPABILITIES[site] as readonly TrustSource[];
  if (source === null || !allowed.includes(source)) {
    throw new PANGTrustViolation(site, source, allowed);
  }
}

/** Convenience for iterating capability allow-lists (used by tests). */
export function allowedSources(site: CapabilitySite): readonly TrustSource[] {
  return CAPABILITIES[site];
}
