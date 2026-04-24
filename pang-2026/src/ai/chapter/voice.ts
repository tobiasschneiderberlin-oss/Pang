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
 * Voice corpus for the ask-gallery affordance — the one-tap verification
 * request the collector sends to their gallery. Every string is
 * museumsschild-register: observational, sentence case, no imperative,
 * no marketing. "ask" is the verb, not "request" or "verify".
 *
 * Lifecycle strings read as wall text in their own right — "the
 * gallery has not yet answered" is complete as a sentence; it is not
 * an apology for the gallery's silence.
 */
export const ASK_GALLERY = Object.freeze({
  /** Initial affordance label — replaces the dormant chip. */
  action: "ask my gallery",
  /** Subhead under the action — the surface's own explanation. */
  actionHint: "the gallery confirms. the work comes alive.",
  /** Pre-submit edit button. */
  edit: "edit the gallery",
  /** Pre-submit "looks right" confirm button. */
  confirm: "send",
  /** Transient chip during the outbox/submit flight. */
  pending: "sending the ask.",
  /** Stable chip after ack, before the gallery decides. */
  requested: "the gallery has been asked.",
  /** Failed chip — retry is explicit on tap. */
  failed: "the ask did not land.",
  /** Failed chip action. */
  failedAction: "try again",
  /** Confirmation chip after the gallery confirms. */
  confirmed: "the gallery confirmed.",
  /** Decline chip after the gallery declines. */
  declined: "the gallery did not confirm.",
  /** Placeholder inside the free-text gallery editor. */
  editPlaceholder: "the gallery the work came from",
  /** Label above the edit field. */
  editLabel: "the gallery",
  /** Push-subscribe offer — shown once under the "requested" chip. */
  pushOffer: "tell me when the gallery answers.",
  /** Push-subscribe accept button. Sentence case. */
  pushAccept: "notify me",
  /** Push-subscribe dismissal — acknowledges the quiet choice. */
  pushDismiss: "not now",
  /** Chip after the subscription stored. */
  pushGranted: "the notification is on.",
  /** Chip after the subscription was refused (permission or error). */
  pushDeclined: "the notification stays off.",
  /** Prompt above the send-now chooser. Iter #10. */
  sendPrompt: "choose the channel the gallery prefers.",
  /** Send-now email button. */
  sendEmail: "send by email",
  /** Send-now WhatsApp button. */
  sendWhatsApp: "send by whatsapp",
  /** Chip after the collector has handed off the message. */
  dispatched: "the message is with the gallery.",
  /** Chip after the signed-link TTL elapsed without action. */
  expired: "the ask went quiet.",
}) satisfies Readonly<Record<string, string>>;

/**
 * Outcome chapter narration corpus — the wall-caption lines played
 * when the gallery answers a verification request. Two variants:
 *
 *   - confirmation: the work's emissive has just risen from dormant
 *     to verified-rest. The line acknowledges the fact of
 *     confirmation, not the collector's action. It is a museum
 *     caption, not a reward.
 *   - decline: the work remains dormant. The line states the fact
 *     without apology or reassurance. The collector is allowed to
 *     feel the absence of confirmation.
 *
 * Both pass the Museumsschild test — observational, sentence case,
 * no imperative, no marketing, no evaluation.
 */
export const OUTCOME_NARRATION = Object.freeze({
  confirmation: "the gallery confirms this work.",
  decline: "the gallery did not confirm this work.",
}) satisfies Readonly<Record<"confirmation" | "decline", string>>;

/**
 * The one affordance string — shown once the chapter has entered the
 * `ready` beat. Intentionally lowercase + terse; sits at the bottom
 * of the surface like a museum footer.
 */
export const DISMISS_AFFORDANCE = "tap to return";

/**
 * Documents-chapter closing line — rendered on the `context` beat
 * at the end of the procession. Sentence case. Museumsschild. Frames
 * the documents as evidence, not chrome; not an instruction to read
 * them, not a reassurance about their presence.
 *
 * Codified iteration #6: the spine's claim that "documents exist
 * as evidence" gets a terminal wall-text. One line; no pair; no
 * rotation yet (per doctrine, rotation lands with a second line's
 * purpose, not the first line's opportunity).
 */
export const DOCUMENTS_CONTEXT_LINE = "papers of record.";

/**
 * Documents-chapter viewer strings — shown inside the canvas
 * viewer overlay. Each passes the Museumsschild test; none is
 * marketing, none evaluative.
 *
 * `missingBytes` is the honest state when a document's OPFS bytes
 * are unavailable (eviction, migration loss). Rendered muji inside
 * the viewer; the chapter keeps playing around it.
 */
export const DOCUMENTS_VIEWER = Object.freeze({
  /** Muji fallback when the bytes are gone. */
  missingBytes: "this document is no longer available.",
  /** Muji footer when a multi-page document is truncated to page 1. */
  morePages: (count: number): string =>
    count === 1 ? "one more page." : `${count} more pages.`,
}) satisfies Readonly<{
  missingBytes: string;
  morePages: (count: number) => string;
}>;

/** Screen-reader label for the documents chapter + overlay. */
export const DOCUMENTS_LABEL = "documents";

/**
 * Screen-reader label for the deep-zoom overlay (iteration #7).
 * The surface is a magnifier for the work itself — paint, canvas
 * weave, restoration marks — not a separate artefact. One word,
 * lowercase, because the Museumsschild test says so.
 */
export const DEEP_ZOOM_LABEL = "deep zoom";

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
  confirmation: "The gallery confirms this work.",
  decline: "The gallery did not confirm this work.",
  pause: "",
  settle: "The chapter settles.",
  ready: "tap to return.",
});
