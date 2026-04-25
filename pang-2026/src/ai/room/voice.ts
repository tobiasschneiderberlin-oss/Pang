/**
 * PANG — The Room surface voice corpus.
 *
 * The Room is the collector's wall — the home route and the
 * primary surface. This corpus owns the literals the route itself
 * authors. The canvas + React adapters below it carry their own
 * corpora (`@/ai/chapter/voice`, `@/ai/verification/voice`,
 * `@/ai/enrichment/voice`); this file only holds the strings the
 * `<main>` landmark shows.
 *
 * Register: museumsschild. Sentence case. The phrase "Your
 * collection" uses the ownership `your` deliberately — this is the
 * one moment in the app where first-person-possessive is not a voice
 * violation (see `PANG_Voice.md` § *First person exception*).
 */

/**
 * Landmark label on The Room's `<main>`. Screen readers announce this
 * when the collector enters the surface; sighted collectors never see
 * it. Sentence case; *your* is load-bearing (the one ownership moment
 * PANG_Voice.md sanctions).
 */
export const ROOM_MAIN_LABEL = "Your collection";

/**
 * Aria-label on the scan-trigger affordance — the small chrome icon
 * (a thin plus) anchored to the Room's top-left that opens `/scan`.
 * Iter #18 added it after Laura's first session showed the empty
 * Room had no discoverable path to intake. Museumsschild register:
 * "the next work" reads as a wall label, not an app button.
 * "Add picture" / "Scan now" would fail (imperative + verb-heavy).
 */
export const ROOM_SCAN_TRIGGER_LABEL = "the next work";
