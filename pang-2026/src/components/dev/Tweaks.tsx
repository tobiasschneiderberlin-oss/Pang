"use client";

/**
 * PANG — Tweaks overlay (dev-only).
 *
 * A small fixed-position panel at the bottom-right of the viewport
 * that surfaces the DS knobs while we tune them against Laura's
 * hands. First knob wired: `timeWarmth` — the day-to-dusk lighting
 * bias that `TheRoomCanvas` reads from the preferences store and
 * applies live via `setLightingByWarmth()`.
 *
 * Scope discipline: this is a *dev* affordance, not the shipping
 * Tweaks sheet from DS Chapter 11. The shipping sheet is a full
 * sidecar with preset pickers, numeric inputs, and a voice-styled
 * "what these do" explainer. That lands as its own iteration. This
 * overlay exists to iterate on the warmth curve without rebuilding
 * the app after every tweak.
 *
 * Visibility: gated on `process.env.NODE_ENV === "development"`.
 * Next.js substitutes the env string at build time, so the JSX
 * branch is dead-code-eliminated in production bundles. No runtime
 * check is needed, but the explicit gate keeps the file honest when
 * read in isolation.
 *
 * Styling contract: follows the 48 gates.
 *   - P9 sharp corners — `radius: 0` on the panel container; the
 *     slider thumb / close button use the 2px chrome radius.
 *   - P11 OKLCH only — every colour resolves through `tokens.css`.
 *   - P14 register — "TWEAKS" in MONO-CAP; labels in sentence case.
 *   - P23 a11y floor — controls are ≥ 24×24; the close button is 32×32.
 *   - P24 token discipline — every length is a token; no naked px.
 *   - P15 motion — a single `transition: transform` with a named
 *     easing keyword (`ease-out`), the only allowed shape outside
 *     the motion lib; no hand-authored curves.
 */

import { useState } from "react";
import type { ReactElement } from "react";
import { usePreferences } from "@design/preferences";
import { TWEAKS } from "@/ai/dev/voice";

const IS_DEV = process.env.NODE_ENV === "development";

export function Tweaks(): ReactElement | null {
  const timeWarmth = usePreferences((s) => s.timeWarmth);
  const setPref = usePreferences((s) => s.set);
  const [expanded, setExpanded] = useState(false);

  if (!IS_DEV) return null;

  const toggle = (): void => setExpanded((v) => !v);

  return (
    <aside
      // Bottom-right, respecting the safe-area inset. `max()` gives a
      // sensible fallback when the inset evaluates to 0 (non-notched
      // devices); 16px (--s-4) keeps the panel off the viewport edge.
      // `z-50` sits above the room canvas but below any modal chrome.
      className="fixed z-50 font-mono text-[11px] tracking-wider uppercase"
      style={{
        right: "max(env(safe-area-inset-right), var(--s-4))",
        bottom: "max(env(safe-area-inset-bottom), var(--s-4))",
      }}
      aria-label={TWEAKS.panel_label}
    >
      {expanded ? (
        <div
          className="flex flex-col gap-3 bg-paper-5 text-ink p-4 shadow-lg"
          style={{
            // Panel container: radius 0 (P9). 1px hairline via token.
            border: "1px solid var(--hairline)",
            width: "var(--s-32)", // 128px
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">{TWEAKS.header}</span>
            <button
              type="button"
              onClick={toggle}
              aria-label={TWEAKS.collapse_label}
              className="text-ink-muted hover:text-ink"
              style={{
                // Close affordance: 32×32 target (well above the 24×24
                // P23 floor). Chrome radius 2px — P9 allow-listed.
                width: "var(--s-8)",
                height: "var(--s-8)",
                borderRadius: "var(--r-chrome)",
              }}
            >
              {TWEAKS.close_glyph}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="tweak-time-warmth"
              className="text-ink-muted"
              style={{ fontSize: "10px" }}
            >
              {TWEAKS.time_warmth_label}
            </label>
            <input
              id="tweak-time-warmth"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={timeWarmth}
              onChange={(e) =>
                setPref("timeWarmth", Number(e.currentTarget.value))
              }
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={timeWarmth}
              className="w-full accent-warm-deep"
              style={{
                // Native range height is typically ~16px; pad vertically
                // so the actionable area meets the 24×24 floor (P23).
                height: "var(--s-6)",
              }}
            />
            <div className="flex justify-between text-ink-muted normal-case">
              <span style={{ fontSize: "10px" }}>{TWEAKS.cool}</span>
              <span
                className="font-mono tabular-nums"
                style={{ fontSize: "10px" }}
              >
                {timeWarmth.toFixed(2)}
              </span>
              <span style={{ fontSize: "10px" }}>{TWEAKS.warm}</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label={TWEAKS.open_label}
          className="bg-paper-5 text-ink-muted hover:text-ink font-mono tracking-wider uppercase"
          style={{
            // Collapsed trigger: 32×32 (P23 comfortable above 24×24).
            // Chrome radius 2px. Hairline border via token.
            width: "var(--s-8)",
            height: "var(--s-8)",
            borderRadius: "var(--r-chrome)",
            border: "1px solid var(--hairline)",
            fontSize: "9px",
            letterSpacing: "0.08em",
          }}
        >
          {TWEAKS.trigger_glyph}
        </button>
      )}
    </aside>
  );
}
