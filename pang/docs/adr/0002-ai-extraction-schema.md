# ADR-002: AI Extraction Schema (Pipeline A)

**Status:** Accepted
**Date:** 2026-04-28
**Refines:** [ADR-001 § Sub-decision 3 (AI Scan Pipeline)](0001-backend-architecture.md)

---

## Context

PANG's signature interaction is the artwork scan: the collector points a camera at a work, the system extracts a structured record, the collector confirms with one tap. The frontend already ships an `ArtworkScanner` component. The MVP question was: how complex should the extraction be at launch?

ADR-001 left this open as Q5 — it drives prompt design, output schema, and the eval corpus.

## Decision

**Pipeline A only at launch.** The camera capture is the artwork itself; no supporting-document multi-image flow. Output is a Zod-validated structured record with confidence-per-field. **No value or authenticity assessment, ever.**

### Schema (target — implemented in ADR-001 action item 12)

```ts
type HexColor = `#${string}`;

type ArtworkExtraction = {
  // Visual classification
  visualType:
    | "painting"
    | "drawing"
    | "print"
    | "photograph"
    | "sculpture"
    | "mixed-media"
    | "unknown";

  // Surface description
  dominantPalette: HexColor[];     // 0..5 entries, sorted by area share
  framePresent: boolean;
  frameDescription: string | null; // "thin walnut floater", etc.

  // Marks visible on the work
  signaturePresent: boolean;
  signatureLocation: string | null; // "lower right", "verso", null
  signatureText: string | null;     // OCR if legible
  inscriptionText: string | null;   // any text other than signature
  editionMarking: string | null;    // "5/100", "A.P.", "PP", "HC", etc.

  // Per-field confidence, 0..1
  confidenceMap: Record<
    Exclude<keyof ArtworkExtraction, "confidenceMap" | "bannedVocabularyDetected" | "rejectionReason">,
    number
  >;

  // Safety
  bannedVocabularyDetected: boolean;
  rejectionReason: string | null;   // populated when the model can't proceed
};
```

### What is **NOT** in the schema (and never will be)

| Field | Why we never extract this |
|---|---|
| `artistName`, `title`, `medium` | Need supporting documents (Pipeline B) for non-guessing answers. Style-based guessing produces confident lies. |
| `dimensionsCm` | Cannot be reliably inferred from a single uncalibrated photo. |
| `estimatedValue` | Appraisal is licensed work in most jurisdictions. The platform must not appear to value art. |
| `isGenuine`, `authenticityScore` | Authenticity needs catalog raisonné comparison and chain-of-custody review. The platform must not appear to make that claim. |
| `attribution` | Same reason as `artistName` — needs a CoA or wall label. |
| Any "art-historical movement" guess | Interpretive, not extractive. Belongs in editorial content, not scan output. |

The `unknown` value of `visualType` is the relief valve when the model genuinely cannot tell.

### Confirm UX

The frontend reads `confidenceMap` and renders fields tiered by confidence:

| Confidence | Visual | Behavior |
|---|---|---|
| > 0.85 | green check | pre-confirmed |
| 0.5 – 0.85 | yellow caret | "tap to verify" |
| < 0.5 | gray pencil | "tap to edit" |

**Cumulative confidence gate:** if the mean confidence across non-null fields is < 0.6, the "Add to collection" action is disabled until the collector explicitly steps through a manual review. This prevents one-tap-confirm of low-quality extractions.

"Confirm all" respects the green tier; tapping any field opens an inline edit sheet.

### Hardening (lifted from ADR-001 § Sub-decision 3)

1. **Structured output via Anthropic API.** Zod-validated at the boundary. Treat the raw response as `Untrusted<ArtworkExtraction>` until validated; carry the brand through types so usage of unvalidated data is a compile error.
2. **Prompt versioning in repo.** Live in `pang/lib/ai/prompts/scan-artwork.v1.ts`. Hash `(prompt text + model + schema)` and log the hash with every call.
3. **Eval corpus on prompt change.** CI runs ≥10 known images with expected outputs through the new prompt before merge. Regression on any image fails the build.
4. **Image size cap.** Reject >5MB; downscale client-side to 2048px max edge before upload.
5. **Audit log every call.** Request hash, response hash, prompt version, cost, latency, user, gallery_id. Useful for prompt regression debugging and for the GwG/§147 AO retrieval contract.
6. **Cost budget.** ~$0.04 per scan with Sonnet 4.6 + structured output. Track moving average; alert above $0.10.

### Migration to Pipeline A+B (deferred)

Pipeline B (artwork + 1–3 supporting documents) is forward-compatible with this schema. When triggered, fields like `artistName?`, `title?`, `dimensionsCm?`, `sourceMap?`, and `documentsObserved[]` extend `ArtworkExtraction` without breaking existing call sites. The trigger is collector demand or measurable extraction-failure rate above threshold (TBD when telemetry exists).

## Consequences

### What this enables

- **Faster MVP.** ~2 weeks for the scan flow vs ~5 weeks for A+B.
- **The system never makes claims it can't justify visually.** Every extracted field has a clear visual basis the user can verify.
- **Clean upgrade path.** Pipeline B additions are additive, not migrational.

### What this costs

- **Initial extraction is intentionally limited.** Collectors will type artist name, title, year, medium, dimensions. The scan accelerates the visual fields only.
- **The "Add to collection" flow needs good keyboard/edit UX.** Most fields will be hand-entered at first.

### What we'll need to revisit

- Pipeline B trigger criteria (collector demand, failure rate threshold).
- Whether `dominantPalette` is worth extracting (search use case is real, but adds prompt cost).
- The 0.6 cumulative confidence threshold — calibrate against the eval corpus once it exists.

## Status

Accepted. Implementation deferred until ADR-001 action item 12 (`/api/scan` edge route).
