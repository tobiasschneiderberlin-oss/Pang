/**
 * PANG — narrative overlay voice corpus (iter #14).
 *
 * The Narrative Agent authors the paragraph itself; this corpus covers
 * the chrome *around* the paragraph — the dismiss affordance's label,
 * the accessibility announcement, the empty-overlay placeholder shown
 * by Storybook/Playwright fixtures.
 *
 * Museumsschild — every string here could sit on a small quiet sign.
 * Doctrine link: `PANG_Voice.md` § *Failure prose*.
 */

/**
 * Accessible landmark label on the overlay `<dialog popover>`. Read by
 * screen readers. Observational, not marketing.
 */
export const NARRATIVE_OVERLAY_LABEL = "a reading of this collection";

/**
 * Single-tap dismiss label. ALL CAPS in the chrome convention; the
 * overlay has exactly this one affordance.
 */
export const NARRATIVE_DISMISS_LABEL = "DISMISS";

/**
 * ARIA live-region announcement when the paragraph fades in. Used for
 * screen-reader users who may not notice the visual fade-in. Plain
 * sentence; no evaluation, no marketing.
 */
export const NARRATIVE_ARRIVAL_ANNOUNCE =
  "a reading of this collection has arrived.";

/**
 * Placeholder shown in dev/test when an overlay is mounted without a
 * narrative (e.g., Storybook harness). Never appears in production.
 */
export const NARRATIVE_PLACEHOLDER =
  "no reading this month — check back when the collection has changed.";
