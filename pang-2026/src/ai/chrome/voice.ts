/**
 * PANG — chrome voice corpus (iter #15).
 *
 * Strings rendered inside shipping chrome surfaces that are neither
 * chapters nor agent outputs. The first tenant is `SettingsOverlay` —
 * the small Popover-API panel that carries the two silence-default
 * opt-ins (audio + haptics).
 *
 * Register note: every string here passes the Museumsschild test —
 * observational, sentence case, no imperative, no marketing, no
 * evaluation. These strings could hang as a small sign on a gallery
 * wall. "turn on audio" would fail (imperative + marketing-noun-for-
 * -a-feature); "the room's voice" / "a low sound that moves with
 * attention" hold.
 *
 * Doctrine link: `PANG_Voice.md` § *Failure prose* + A25 corpus
 * discipline (every JSX string resolves through a corpus module).
 * This corpus is plugged into `PANG_VOICE_STRINGS` under the
 * `settings_overlay` namespace in `src/ai/prompts/strings.ts`.
 */

/**
 * SettingsOverlay strings. Each key maps to an `aria-label`, an
 * on-screen label, or a short explainer line. Toggle state is
 * rendered as lowercase `"on"` / `"off"` — the register of a
 * museum's audio-guide switch, not a marketing copy button.
 */
export const SETTINGS_OVERLAY = Object.freeze({
  /** Aria-label on the opener affordance (the small trigger in the
   *  Room chrome). */
  trigger: "the room's settings",
  /** Aria-label on the overlay container itself. */
  panelLabel: "quiet settings",
  /** Heading inside the panel. */
  panelHeading: "quiet settings",
  /** Label above the audio toggle. */
  audioLabel: "the room's voice",
  /** Explainer line beneath the audio label. */
  audioHint: "a low sound that moves with attention.",
  /** Label above the haptics toggle. */
  hapticsLabel: "the hand's answer",
  /** Explainer line beneath the haptics label. */
  hapticsHint: "a short pulse at the seams.",
  /** Helper text rendered when `hapticsSupported()` is false. */
  hapticsUnsupported: "this device keeps its hands still.",
  /** Close affordance visible text + aria-label. */
  close: "close",
  /** Toggle state text — lowercase on-register. */
  on: "on",
  off: "off",
}) satisfies Readonly<Record<string, string>>;
