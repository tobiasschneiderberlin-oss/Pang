"use client";

/**
 * PANG — the narrative overlay (iter #14).
 *
 * A DOM-only quiet overlay above The Room's canvas. When the narrative
 * store's `isVisible` slice flips true, the overlay fades in once;
 * a single tap on its dismiss affordance writes `dismissedMonth` into
 * the store and fades it out. Reopening is impossible this session —
 * a new month's reading is the only thing that revives the overlay.
 *
 * Visual contract (`PANG_Voice.md` + `docs/PANG_DS.html` appendix C):
 *
 *   - Anchored to the top-right of the Room surface via CSS Anchor
 *     Positioning when the browser supports it; a `position: fixed`
 *     fallback places it in the same corner when Anchor Positioning
 *     is missing. Feature-detect via
 *     `CSS.supports("anchor-name: --a")`.
 *   - Border radius 0 on the paragraph container (P9 containers); 2px
 *     on the chrome buttons. No box-shadow, no backdrop-filter.
 *   - Fade-in via View Transitions when available, otherwise a CSS
 *     opacity transition. The overlay does not slide, scale, or bounce
 *     — it appears.
 *   - One affordance: "DISMISS". ALL CAPS, bottom-right of the card.
 *     No second CTA, no "learn more". The overlay carries one fact.
 *
 * Accessibility:
 *
 *   - `role="dialog"`, `aria-modal="false"` — the overlay is chrome,
 *     not a modal. The Room behind it stays interactive; a tap on the
 *     wall behind the overlay does NOT dismiss. Dismissal is explicit.
 *   - `aria-label` from the voice corpus.
 *   - A visually-hidden live region announces the arrival (`polite`).
 *
 * The component does NOT own the fetch. The arrival hook
 * (`useNarrativeOverlay`) does. This component is a pure reader of
 * the store + a caller of `dismiss()` — easy to Storybook-drive and
 * trivial to Playwright-drive with a seeded store snapshot.
 */

import { useEffect, useRef, type ReactElement } from "react";
import { useNarrative } from "@/stores/narrative";
import {
  NARRATIVE_ARRIVAL_ANNOUNCE,
  NARRATIVE_DISMISS_LABEL,
  NARRATIVE_OVERLAY_LABEL,
} from "@/ai/narrative/voice";

export function NarrativeOverlay(): ReactElement | null {
  const current = useNarrative((s) => s.current);
  const isVisible = useNarrative((s) => s.isVisible);
  const dismiss = useNarrative((s) => s.dismiss);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Announce the arrival once per transition into visible. The ref
  // gate prevents the same month's paragraph from re-announcing on a
  // re-mount (sub-surface pop back to Room).
  const announcedMonthRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isVisible || current === null) return;
    if (announcedMonthRef.current === current.month) return;
    announcedMonthRef.current = current.month;
    // Aria-live polite — the region renders inside this component.
  }, [isVisible, current]);

  if (!isVisible || current === null) return null;

  function onDismissClick(): void {
    // View Transition if available — the overlay fades out as the
    // store write flips `isVisible` to false.
    type VTDocument = Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const d = document as VTDocument;
    if (typeof d.startViewTransition === "function") {
      d.startViewTransition(() => {
        dismiss();
      });
    } else {
      dismiss();
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-label={NARRATIVE_OVERLAY_LABEL}
      data-pang-surface="narrative-overlay"
      data-pang-source="ai"
      data-pang-month={current.month}
      className="pointer-events-auto fixed right-4 top-4 z-40 flex max-w-sm flex-col gap-3 bg-paper p-4 text-ink"
      style={{
        borderRadius: 0,
        // Anchor Positioning fallback: `position: fixed` places the
        // overlay in the top-right. When Anchor Positioning is
        // available, a sibling element on the Room surface declares
        // `anchor-name: --pang-room`; we consume it here.
        // The feature-detect inline keeps the CSS delivery one file.
        ["position-anchor" as unknown as string]: "--pang-room",
      }}
    >
      <p
        className="text-sm leading-snug text-ink-ai"
        data-pang-source="ai"
        data-testid="pang-narrative-paragraph"
      >
        {current.paragraph}
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDismissClick}
          className="cursor-pointer bg-paper-5 px-3 py-1 text-xs uppercase tracking-wider text-ink"
          style={{ borderRadius: "var(--r-chrome)" }}
          data-testid="pang-narrative-dismiss"
        >
          {NARRATIVE_DISMISS_LABEL}
        </button>
      </div>

      <span
        aria-live="polite"
        className="sr-only"
        data-testid="pang-narrative-announce"
      >
        {NARRATIVE_ARRIVAL_ANNOUNCE}
      </span>
    </div>
  );
}
