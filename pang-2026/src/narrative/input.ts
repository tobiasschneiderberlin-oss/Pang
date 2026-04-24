/**
 * PANG — Narrative input assembler (iter #14).
 *
 * Pure, deterministic function that walks the collector's verified
 * collection and produces a `NarrativeInput` the P-LLM can consume.
 * The assembler is the **CaMeL boundary** (primitive 70): nothing
 * `'Q'`-branded reaches the P-LLM. Provenance entries come from the
 * `'gallery'`-branded feed; bio-muji paragraphs come from enrichment
 * (already `'P'`); verified work records are already rectified at
 * intake-confirm (`'P'`).
 *
 * Threshold rule (iter #14 failure-mode brief § 3 — empty/thin
 * collection): require ≥ 3 verified works OR ≥ 5 provenance entries.
 * Below the threshold the assembler returns `{ skip: "thin-provenance"
 * }` or `{ skip: "empty-collection" }` and the agent is never called.
 * A trivial paragraph about a single work is worse than silence; the
 * spine's "occasionally, PANG offers…" register is the discipline.
 *
 * Hash contract: `collectionHash` is a SHA-256 hex digest over a
 * canonical JSON serialization of
 *   (sorted verifiedWorkIds, provenanceEntryCount, sorted bioMuji
 *    artistIds + paragraph lengths).
 * A change in any of those three changes the hash. Hashing the full
 * bioMuji text would be correct but leak voice-level sensitivity into
 * a stability signal — length + id is enough to detect "artist bio
 * rewritten" without inviting the agent to replay the same paragraph.
 *
 * The assembler does NOT call the Anthropic API. It is pure data
 * shaping; unit-testable with a synthetic collector fixture.
 */

import { createHash } from "node:crypto";
import { brand, type Trusted } from "@/ai/camel/trust";
import {
  NarrativeInputSchema,
  type NarrativeInput,
  type NarrativeProvenanceEntry,
  type NarrativeSkipReason,
  type NarrativeVerifiedWork,
} from "./schema";

/**
 * The collector state the assembler walks. A thin interface because
 * v1 reads from an in-memory shape the route composes — the Supabase
 * mirror (out of scope for this iter) will adapt its rows to this
 * interface at the data layer, keeping call sites stable.
 */
export interface NarrativeCollectorState {
  readonly collectorId: string;
  readonly verifiedWorks: readonly NarrativeVerifiedWork[];
  readonly provenanceEntries: readonly NarrativeProvenanceEntry[];
  /** artistId → bio-muji paragraph from Enrichment (already `'P'`). */
  readonly bioMujiParagraphs: Readonly<Record<string, string>>;
}

/**
 * Assembler output. Either a `Trusted<NarrativeInput, "P">` the agent
 * can consume, or a typed skip carrying one of the closed reasons.
 * Skip ≠ error — the route records the reason on telemetry and moves
 * on.
 */
export type NarrativeInputResult =
  | { readonly kind: "input"; readonly input: Trusted<NarrativeInput, "P"> }
  | { readonly kind: "skip"; readonly reason: NarrativeSkipReason };

/**
 * Threshold below which the assembler declines to call the P-LLM.
 * See iter #14 failure-mode brief § 3. Documented in the open-
 * questions section of the brief; tune here if the cadence surfaces
 * a regression on Laura's hands.
 */
export const ASSEMBLER_MIN_VERIFIED_WORKS = 3;
export const ASSEMBLER_MIN_PROVENANCE_ENTRIES = 5;

/**
 * Produce the YYYY-MM string for a given `Date`. UTC-based; the
 * narrative is a monthly idempotent, and calendar-month boundaries
 * are a property of civil time, not of the server's TZ. A collector
 * in Melbourne who scans a work at 11pm UTC is in the same "month"
 * as a collector in Vancouver at 4pm UTC — neither of them should
 * see a boundary wobble.
 */
export function monthOf(now: Date): string {
  const y = now.getUTCFullYear().toString().padStart(4, "0");
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Canonical hash over the collection shape. See module doc. Exported
 * for unit tests and the route's "unchanged" gate.
 */
export function hashCollection(
  state: NarrativeCollectorState,
): string {
  const workIds = [...state.verifiedWorks]
    .map((w) => w.id)
    .sort((a, b) => a.localeCompare(b));
  const provenanceCount = state.provenanceEntries.length;
  const bioMujiSig = Object.entries(state.bioMujiParagraphs)
    .map(([artistId, p]) => `${artistId}:${p.length}`)
    .sort((a, b) => a.localeCompare(b));

  const canon = JSON.stringify({
    workIds,
    provenanceCount,
    bioMujiSig,
  });
  return createHash("sha256").update(canon).digest("hex").slice(0, 24);
}

/**
 * Assemble the agent input. Pure function; safe to call in any
 * context (route handler, unit test, dev script). Returns a discriminated
 * union so the caller can branch on `kind` without a try/catch on a
 * skip reason.
 */
export function assembleNarrativeInput(
  state: NarrativeCollectorState,
  now: Date,
): NarrativeInputResult {
  if (state.verifiedWorks.length === 0) {
    return { kind: "skip", reason: "empty-collection" };
  }

  // Thin-provenance gate. The assembler's threshold is a *disjunction*
  // — either enough verified works or enough provenance entries is
  // sufficient substance for an observational paragraph. A collection
  // with 3 works and no provenance passes; one with 1 work and 10
  // provenance entries also passes (the provenance itself is the
  // subject matter).
  const hasEnoughWorks =
    state.verifiedWorks.length >= ASSEMBLER_MIN_VERIFIED_WORKS;
  const hasEnoughProvenance =
    state.provenanceEntries.length >= ASSEMBLER_MIN_PROVENANCE_ENTRIES;
  if (!hasEnoughWorks && !hasEnoughProvenance) {
    return { kind: "skip", reason: "thin-provenance" };
  }

  const input: NarrativeInput = NarrativeInputSchema.parse({
    collectorId: state.collectorId,
    month: monthOf(now),
    verifiedWorks: state.verifiedWorks,
    provenanceEntries: state.provenanceEntries,
    bioMujiParagraphs: state.bioMujiParagraphs,
    collectionHash: hashCollection(state),
  });

  return { kind: "input", input: brand(input as object, "P") as Trusted<NarrativeInput, "P"> };
}
