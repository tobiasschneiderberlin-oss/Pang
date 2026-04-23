/**
 * PANG — chapter voice corpus.
 *
 * Curated, non-model-authored strings that appear inside the arrival
 * chapter. Mirrors the authoring rules of `src/ai/prompts/failure.ts`:
 * the register must pass the Museumsschild test; every string is
 * observational, sentence case, no emoji, no imperative, no marketing
 * vocabulary.
 *
 * Why here and not in `prompts/`: these are not prompts. They are
 * *wall text* — museum-caption fragments the chapter composes around
 * the P-LLM's arrival line. They never reach a model.
 *
 * Doctrine link: `PANG_Voice.md` § *Failure prose* establishes the
 * register for voice-authored lines; this corpus follows the same
 * authoring rules. Any addition lands in voice doctrine first and is
 * mirrored here — this file is not the source.
 *
 * Tested in `voice.test.ts` against the same banned-vocabulary,
 * sentence-case, and length rules applied to failure prose.
 */

/** Kind → voice-corpus label for artifacts. Rendered as a tag above
 *  the artifact card's field list. Sentence case. No evaluation. */
export const ARTIFACT_LABELS = Object.freeze({
  coa: "certificate of authenticity",
  invoice: "invoice",
  condition_report: "condition report",
}) satisfies Readonly<Record<"coa" | "invoice" | "condition_report", string>>;

/**
 * Null-reflection corpus — rendered during the chapter when the work
 * has no artifacts and no gallery of origin. A wall text, not a
 * reassurance. The collector is allowed to feel the dormant state.
 *
 * Two lines, composed on the wall as a pair:
 *   line 1: what is
 *   line 2: what is not
 *
 * The corpus holds one pair. A future deepening (Aha Sprint § 6)
 * would add more pairs and rotate by session; a single pair is the
 * current ceiling.
 */
export const NULL_REFLECTION = Object.freeze({
  first: "The wall holds the work.",
  second: "The gallery has not yet answered.",
});

/** Prefix above the bioMuji block during the context beat. Sentence case. */
export const CONTEXT_LABEL = "About the artist.";

/** Prefix above the gallery name during the attribution beat. */
export const ATTRIBUTION_LABEL = "Recorded from.";

/**
 * The one affordance string — shown once the chapter has entered the
 * `ready` beat. Intentionally lowercase + terse; sits at the bottom
 * of the surface like a museum footer.
 */
export const DISMISS_AFFORDANCE = "tap to return";

/**
 * The screen-reader label for the arrival surface. Landmarks that
 * name the place, not the action. `aria-label` on the `<main>`.
 */
export const SURFACE_LABEL = "arrival";

/**
 * Narrate a chapter transition for the ARIA live region. The live
 * region announces short, factual lines to screen readers as beats
 * enter — sight users see a fade-in; SR users hear a phrase.
 *
 * Rules: sentence case, short, observational. No "now showing", no
 * "next up". The announcement is the fact that has just become true.
 */
export const ARIA_ANNOUNCE = Object.freeze({
  approach: "The camera turns toward the work.",
  place: "The work is on the wall.",
  narration: (arrivalLine: string): string => arrivalLine,
  artifact: (label: string): string => `A ${label} has arrived.`,
  attribution: (galleryName: string): string => `Recorded from ${galleryName}.`,
  context: "A note about the artist.",
  "null-reflection": "The wall holds the work.",
  settle: "The chapter settles.",
  ready: "tap to return.",
});
