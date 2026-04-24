/**
 * PANG — voice corpus bundle.
 *
 * `PANG_VOICE_STRINGS` is the namespaced re-export of every
 * hand-authored user-facing string PANG ships. One module per domain
 * still owns the authoring (e.g. `src/ai/chapter/voice.ts` for arrival
 * + ask-gallery copy); this file is the one flat view the voice layer
 * uses to:
 *
 *   1. Pick the six canonical samples that `rebuild-voice-prompt.ts`
 *      bakes into `src/ai/prompts/voice.ts`'s examples block.
 *   2. Give A25 (corpus discipline) a stable import target so every
 *      JSX text node / attribute in `src/components/**` and `app/**`
 *      can resolve to a corpus module, directly or through this
 *      barrel.
 *   3. Make renames audible — removing a canonical slot or a domain
 *      namespace fails compilation, not just CI.
 *
 * Why not a code-gen'd file: the bundle is a hand-curated index. The
 * corpora are the sources; this module is the map. A code-gen'd
 * version would bury which strings are canonical and which are
 * chrome; by keeping the map narrow and typed, the six canonical
 * slots remain a doctrine decision visible in a single scroll.
 *
 * Doctrine link: iter #12's outcome gate (Aha Sprint § 12.Outcome
 * gate) requires primitives 63–66 — seed-every-privileged-LLM-call,
 * corpus-every-user-facing-string, seed-as-artifact, banned-vocabulary-
 * single-sourced. This file is the anchor for primitives 64 and 65.
 *
 * Freezing rule: both the outer bundle and every namespace inside are
 * `Object.freeze`'d. The `as const satisfies` clause gives compile-
 * time confidence; `Object.freeze` gives runtime. A mutation fails
 * both ways.
 */

import {
  ARIA_ANNOUNCE,
  ARRIVAL_IMAGE_ALT,
  ARTIFACT_LABELS,
  ASK_GALLERY,
  ATTRIBUTION_LABEL,
  BULLET_SEPARATOR,
  CONTEXT_LABEL,
  DEEP_ZOOM_CLOSE,
  DEEP_ZOOM_LABEL,
  DISMISS_AFFORDANCE,
  DOCUMENTS_CONTEXT_LINE,
  DOCUMENTS_LABEL,
  DOCUMENT_VIEWER_LABEL,
  DOCUMENTS_VIEWER,
  NULL_REFLECTION,
  OUTCOME_NARRATION,
  OUTCOME_SURFACE_LABEL,
  SURFACE_LABEL,
} from "@/ai/chapter/voice";

// ---------- Namespaces ---------------------------------------------
//
// Each namespace is a frozen record of strings (or string-returning
// functions, where a template parameter is load-bearing). The names
// match the doctrine's tabular organisation in `PANG_Voice.md` —
// "arrival", "ask_gallery", "outcome", "documents", "chapter" — so a
// contributor who knows the doctrine knows the namespace.
//
// The six canonical slots used by `rebuild-voice-prompt.ts` are
// documented at the bottom of the file. The slot addresses are
// stable: renaming one is a doctrine edit.

export const INVITE = Object.freeze({
  /** The greeting that opens the invite-landing surface.
   *  Canonical sample: the first of six. Muji register. */
  greeting:
    "{Gallery name} invited you to PANG.",
  /** The warm CTA below the greeting. Imperative, warm because
   *  the collection is the subject. */
  openCta: "Open your collection",
  /** Passkey enrollment prompt. Quiet. */
  passkeyPrompt: "Sign in with your device",
  /** OTP fallback line when passkeys are unavailable. Quiet. */
  otpFallback: "Check your email to continue.",
  /** OTP expiry — factual, actionable. */
  otpExpired: "Link expired. Open the original email.",
}) satisfies Readonly<Record<string, string>>;

export const ASK_GALLERY_NS = ASK_GALLERY;

export const OUTCOME = Object.freeze({
  /** Canonical sample: the confirmation line. */
  confirmation: OUTCOME_NARRATION.confirmation,
  /** The decline line. */
  decline: OUTCOME_NARRATION.decline,
}) satisfies Readonly<Record<"confirmation" | "decline", string>>;

export const PUSH = Object.freeze({
  /** Canonical sample: the push offer shown once under the
   *  "requested" chip. */
  offer: ASK_GALLERY.pushOffer,
  accept: ASK_GALLERY.pushAccept,
  dismiss: ASK_GALLERY.pushDismiss,
  granted: ASK_GALLERY.pushGranted,
  declined: ASK_GALLERY.pushDeclined,
}) satisfies Readonly<Record<string, string>>;

export const DISPATCH = Object.freeze({
  /** Canonical sample: the email-subject label seed. Templated at
   *  runtime with `{artist}` and `{title}`. Here we ship the shape
   *  the P-LLM bakes — the Correspondence Agent emits the subject,
   *  not this corpus. */
  email_label: "Verification request — {artist}, {title}",
  /** The chooser prompt above the send-now surface. */
  chooser_prompt: ASK_GALLERY.sendPrompt,
  /** Send-now channel CTAs. */
  send_email: ASK_GALLERY.sendEmail,
  send_whatsapp: ASK_GALLERY.sendWhatsApp,
  /** Chip shown after the message left the page. */
  dispatched: ASK_GALLERY.dispatched,
  /** Chip shown after the TTL elapsed. */
  expired: ASK_GALLERY.expired,
}) satisfies Readonly<Record<string, string>>;

export const ARRIVAL = Object.freeze({
  /** Canonical sample: the wall text that frames a placed work.
   *  Sentence case, observational. Shown under the still-life of
   *  the work after the arrival beat. */
  placement: NULL_REFLECTION.first,
  /** The paired line — the gallery's silence stated as fact. */
  gallery_silence: NULL_REFLECTION.second,
  /** Above the bio block. */
  context_label: CONTEXT_LABEL,
  /** Above the gallery name. */
  attribution_label: ATTRIBUTION_LABEL,
  /** The single dismiss affordance. */
  dismiss: DISMISS_AFFORDANCE,
  /** Surface-level screen-reader label. */
  surface_label: SURFACE_LABEL,
  /** Empty-alt for the captured-still overlay. Decorative image. */
  image_alt: ARRIVAL_IMAGE_ALT,
}) satisfies Readonly<Record<string, string>>;

export const OUTCOME_CHAPTER = Object.freeze({
  /** Surface-level screen-reader label for the outcome chapter. */
  surface_label: OUTCOME_SURFACE_LABEL,
}) satisfies Readonly<Record<"surface_label", string>>;

export const ARTIFACTS = Object.freeze({
  coa: ARTIFACT_LABELS.coa,
  invoice: ARTIFACT_LABELS.invoice,
  condition_report: ARTIFACT_LABELS.condition_report,
}) satisfies Readonly<Record<"coa" | "invoice" | "condition_report", string>>;

export const DOCUMENTS = Object.freeze({
  /** The closing wall-text on the documents beat. */
  context_line: DOCUMENTS_CONTEXT_LINE,
  /** Landmark label on the documents chapter. */
  label: DOCUMENTS_LABEL,
  /** Dialog label for the document-viewer overlay. */
  viewer_label: DOCUMENT_VIEWER_LABEL,
  /** Muji fallback when an opened document's OPFS bytes are gone. */
  missing_bytes: DOCUMENTS_VIEWER.missingBytes,
  /** Muji footer when a multi-page document is truncated. */
  more_pages: DOCUMENTS_VIEWER.morePages,
}) satisfies Readonly<{
  context_line: string;
  label: string;
  viewer_label: string;
  missing_bytes: string;
  more_pages: (count: number) => string;
}>;

export const DEEP_ZOOM = Object.freeze({
  label: DEEP_ZOOM_LABEL,
  /** Close button's `aria-label`. */
  close_label: DEEP_ZOOM_CLOSE.label,
  /** Close button's visible text. */
  close_action: DEEP_ZOOM_CLOSE.action,
}) satisfies Readonly<Record<string, string>>;

export const CHAPTER_CHROME = Object.freeze({
  /** Typographic middot used between fields; always aria-hidden. */
  bullet: BULLET_SEPARATOR,
}) satisfies Readonly<Record<"bullet", string>>;

export const ARIA = ARIA_ANNOUNCE;

// ---------- The bundle ---------------------------------------------
//
// The outer object is frozen too; both the bundle and each namespace
// are runtime-immutable. The `satisfies` clause catches a namespace
// drift at compile-time (adding a namespace without typing it breaks
// the build).

export const PANG_VOICE_STRINGS = Object.freeze({
  invite: INVITE,
  ask_gallery: ASK_GALLERY_NS,
  outcome: OUTCOME,
  outcome_chapter: OUTCOME_CHAPTER,
  push: PUSH,
  dispatch: DISPATCH,
  arrival: ARRIVAL,
  artifacts: ARTIFACTS,
  documents: DOCUMENTS,
  deep_zoom: DEEP_ZOOM,
  chapter_chrome: CHAPTER_CHROME,
  aria: ARIA,
}) satisfies PangVoiceStringsShape;

/**
 * Shape enforcement. Each namespace is a frozen record of strings or
 * string-returning helpers. The outer bundle is also frozen. Adding a
 * new namespace means adding a key here and to the `satisfies` target
 * below — the TypeScript compiler catches an unmapped namespace at
 * build time.
 */
// `NamespaceValue` accepts strings and arbitrary string-returning
// helper functions. A wider shape than `(...args: readonly unknown[])`
// lets domain-specific signatures (e.g. `(count: number) => string`,
// `(galleryName: string) => string`) flow through without losing
// their call-site types. The bundle is the index, not the signature
// discipline — the domain corpora carry that.
type NamespaceValue = string | ((...args: never[]) => string);
type Namespace = Readonly<Record<string, NamespaceValue>>;

type PangVoiceStringsShape = Readonly<{
  invite: Namespace;
  ask_gallery: Namespace;
  outcome: Namespace;
  outcome_chapter: Namespace;
  push: Namespace;
  dispatch: Namespace;
  arrival: Namespace;
  artifacts: Namespace;
  documents: Namespace;
  deep_zoom: Namespace;
  chapter_chrome: Namespace;
  aria: Namespace;
}>;

// ---------- Canonical samples for the voice seed -------------------
//
// `rebuild-voice-prompt.ts` reads these addresses (and these only) to
// assemble the "Voice examples" block of `src/ai/prompts/voice.ts`.
// Changing any of them renames a doctrine slot. Adding a seventh
// sample is a doctrine edit.
//
// Address format: `{namespace}.{slot}` — see `resolveCanonical` below.

export const CANONICAL_SAMPLE_ADDRESSES = Object.freeze([
  "invite.greeting",
  "ask_gallery.action",
  "outcome.confirmation",
  "push.offer",
  "dispatch.email_label",
  "arrival.placement",
] as const);

export type CanonicalSampleAddress =
  (typeof CANONICAL_SAMPLE_ADDRESSES)[number];

/**
 * Resolve a canonical sample address to its string value. Used by
 * `rebuild-voice-prompt.ts` and its unit test. Throws if the slot
 * has been renamed or removed — the rebuild fails loud.
 */
export function resolveCanonical(address: CanonicalSampleAddress): string {
  const [ns, key] = address.split(".") as [string, string];
  const namespace = (PANG_VOICE_STRINGS as unknown as Record<string, unknown>)[
    ns
  ] as Record<string, unknown> | undefined;
  if (!namespace) {
    throw new Error(
      `PANG_VOICE_STRINGS: canonical namespace "${ns}" missing`,
    );
  }
  const value = namespace[key];
  if (typeof value !== "string") {
    throw new Error(
      `PANG_VOICE_STRINGS: canonical slot "${address}" missing or not a string`,
    );
  }
  return value;
}
