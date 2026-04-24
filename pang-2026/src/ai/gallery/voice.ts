/**
 * PANG — gallery outcome voice corpus.
 *
 * Strings rendered by the confirm/decline landing pages the gallery
 * opens from its signed-link email. Each literal is moved verbatim
 * from `app/g/_components/GalleryOutcomeClient.tsx` per the iter #13
 * sweep; no rewording.
 *
 * Doctrine link: `PANG_Voice.md` § *Failure prose*.
 */

/**
 * Outcome-client phase prose — the <p> / <span> text lines shown for
 * each response-phase transition. Sentence case; no emoji; no
 * marketing. Some lines contain a trailing `.\n        ` that the
 * JSX quasi carried — preserved verbatim for the move-only guarantee.
 */
export const GALLERY_OUTCOME_PROSE = Object.freeze({
  /** phase === "malformed" */
  malformed: "This link is not valid. It may have been mis-typed or cut short.",
  /** phase === "expired" — prose spans two visual lines in source. */
  expired:
    "This link has expired. The collector will need to send a fresh\n        request.",
  /** phase === "invalid" — prose spans two visual lines in source. */
  invalid:
    "This link did not verify. It may be for the other answer, or it\n        may have been tampered with.",
  /** phase === "already" — the prefix before the action-specific verb. */
  already_prefix: "This was already",
  /** phase === "already" — the suffix after the verb. Preserves the
   *  original quasi's trailing whitespace + line-break + sentence. */
  already_suffix: ".\n        Nothing more to do.",
  /** phase === "posting" */
  posting: "One moment.",
}) satisfies Readonly<Record<string, string>>;
