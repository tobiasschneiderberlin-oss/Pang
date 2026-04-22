/**
 * PANG — failure prose.
 *
 * Voice-authored lines shown when something between Laura and the
 * record goes wrong. Curated, not model-generated — the P-LLM is
 * precisely what has failed, so it cannot author its own excuse.
 *
 * See `PANG_Voice.md` § *Failure prose* for the doctrine (what a
 * failure line is allowed to do, what it must never do) and the full
 * corpus. This module mirrors the corpus into code so runtime
 * surfaces (Viewfinder, /scan failed state, API 5xx handlers) pull
 * from a single source.
 *
 * Usage:
 *
 *   import { failureLine } from "@/ai/prompts/failure";
 *   const line = failureLine("camera/contested");
 *
 * Unknown keys fall back to the generic line — no string is ever
 * undefined, and no error can reach Laura without one of these lines
 * in front of it.
 */

export type FailureKey =
  // Camera acquisition
  | "camera/denied"
  | "camera/contested"
  | "camera/unreadable"
  | "camera/unsupported"
  // Capture + rectify
  | "capture/no-frame"
  | "capture/rejected"
  // Upload + transport
  | "upload/offline"
  | "upload/timeout"
  | "upload/rejected"
  // Agent pipeline
  | "agent/unreachable"
  | "agent/refused"
  | "agent/empty"
  // Unknown / catch-all
  | "unknown";

/**
 * Corpus. Each entry is the literal string shown to Laura. Rules for
 * authoring (from `PANG_Voice.md` § *Failure prose*):
 *
 *   - Describe what is literally the case. Not "we couldn't …"; not
 *     "please try again." Observe, don't apologise.
 *   - Sentence case. No emoji. No vocab from the banned list.
 *   - At most one subordinate clause. A failure line is not a
 *     paragraph.
 *   - No imperative. The retry affordance is the button; the prose
 *     is the observation.
 *
 * Each line is reviewed in the voice doctrine. Any addition lands
 * there first; this file is the mirror, not the source.
 */
const CORPUS: Readonly<Record<FailureKey, string>> = Object.freeze({
  "camera/denied":
    "The camera is held by the browser, not yet released to the page.",
  "camera/contested":
    "The frame returned nothing readable. The light, perhaps, or the angle.",
  "camera/unreadable":
    "The camera opened, then closed its eye.",
  "camera/unsupported":
    "This device has not offered a camera the page can use.",
  "capture/no-frame":
    "The shutter fired on an empty frame.",
  "capture/rejected":
    "The image did not carry enough of the work to hold on to.",
  "upload/offline":
    "A signal was lost between the camera and the page. The work waits.",
  "upload/timeout":
    "The record did not arrive. The work waits.",
  "upload/rejected":
    "The page accepted the image, then set it aside.",
  "agent/unreachable":
    "The reading room is quiet. The record will be held until it answers.",
  "agent/refused":
    "The reading room returned the image without a note.",
  "agent/empty":
    "The reading room returned a blank page.",
  unknown:
    "Something passed between the camera and the record, and did not come back.",
});

/** Return the prose line for a given failure key. */
export function failureLine(key: FailureKey | string): string {
  return CORPUS[key as FailureKey] ?? CORPUS.unknown;
}

/**
 * Map a DOM camera error onto a failure key. The `DOMException.name`
 * set for `getUserMedia` is well-specified; other error constructors
 * land as `unknown`.
 */
export function keyFromCameraError(err: unknown): FailureKey {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "camera/denied";
      case "NotReadableError":
      case "TrackStartError":
        return "camera/contested";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "camera/unsupported";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "camera/unsupported";
      case "AbortError":
        return "camera/unreadable";
      default:
        return "camera/unreadable";
    }
  }
  return "unknown";
}

/**
 * Map an upload path outcome onto a failure key. Callers should
 * classify network-vs-agent at the call site (a 502 is upload-layer,
 * a 200 with an empty output is agent-layer) before asking for a
 * line.
 */
export function keyFromUploadStatus(status: number): FailureKey {
  if (status === 0) return "upload/offline";
  if (status === 408 || status === 504) return "upload/timeout";
  if (status >= 500) return "agent/unreachable";
  if (status === 422) return "agent/refused";
  if (status >= 400 && status < 500) return "upload/rejected";
  return "unknown";
}
