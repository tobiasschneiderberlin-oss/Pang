/**
 * PANG — scanner surface voice corpus.
 *
 * The viewfinder owns two affordance landmarks: the canvas itself
 * ("viewfinder"), the manual-capture button ("capture"), and the
 * torch toggle which flips between "torch on" / "torch off" for both
 * its visible text and `aria-label`. Every literal is sentence case,
 * lowercase, no marketing, no evaluation.
 *
 * Doctrine link: `PANG_Voice.md` § *Failure prose* — scanner chrome
 * falls under the same register as wall text.
 */

/** Landmark label for the viewfinder canvas. One word; lowercase. */
export const VIEWFINDER_LABEL = "viewfinder";

/** `aria-label` for the manual-capture button. Lowercase. */
export const CAPTURE_LABEL = "capture";

/**
 * Torch-toggle strings. The button text AND its `aria-label` swap
 * together — the affordance's visible label IS the accessibility
 * contract. Lowercase, two words, no evaluation.
 */
export const TORCH_TOGGLE = Object.freeze({
  on: "torch on",
  off: "torch off",
}) satisfies Readonly<Record<"on" | "off", string>>;
