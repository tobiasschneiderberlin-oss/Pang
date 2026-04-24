/**
 * PANG — dev-only surface voice corpus.
 *
 * Strings rendered exclusively inside the Tweaks overlay
 * (`src/components/dev/Tweaks.tsx`). The overlay is dev-gated via
 * `process.env.NODE_ENV === "development"` — Next substitutes the env
 * string at build time so the branch is dead-code-eliminated in
 * production bundles. Still, A25 walks the source; these literals
 * must live in a corpus module.
 *
 * Register note: several strings in this corpus are **off-register**
 * (title case). They are preserved here verbatim by the iter #13
 * move-only sweep and flagged in the findings. A future iteration
 * may rewrite them to sentence case; a rewrite happens in that
 * iteration, not here.
 *
 * Doctrine link: `PANG_Voice.md` § *Failure prose*.
 */

/**
 * Tweaks-overlay a11y + visible text. Each slot pairs an aria-label
 * with a visible text; the pair is presented verbatim for audit
 * traceability.
 */
export const TWEAKS = Object.freeze({
  /** Landmark label on the panel `<aside>`. Title case (off-register; flagged in iter #13 findings). */
  panel_label: "Developer tweaks",
  /** Visible header inside the expanded panel. Proper-noun register — the DS Tweaks panel. */
  header: "Tweaks",
  /** Close button aria-label. Title case (off-register; flagged). */
  collapse_label: "Collapse tweaks",
  /** Visible close glyph. */
  close_glyph: "×",
  /** Label above the warmth slider. Title case (off-register; flagged). */
  time_warmth_label: "Time warmth",
  /** Warmth slider ends — lowercase, sentence case. */
  cool: "cool",
  warm: "warm",
  /** Collapsed-button aria-label. Title case (off-register; flagged). */
  open_label: "Open tweaks",
  /** Collapsed-button visible glyph. */
  trigger_glyph: "T",
}) satisfies Readonly<Record<string, string>>;
