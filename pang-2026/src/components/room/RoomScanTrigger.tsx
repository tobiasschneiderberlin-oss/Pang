"use client";

/**
 * PANG — the Room's scan trigger (iter #18).
 *
 * A small chrome affordance anchored to the Room's top-left, mirroring
 * the `SettingsOverlay` trigger top-right. Tap → `/scan` → viewfinder
 * → arrival.
 *
 * Why this exists: Laura's first session (2026-04-25) on
 * `pang-gamma.vercel.app` showed the empty Room as a flat gray field
 * with the settings icon as the only chrome. There was no
 * discoverable path to intake. The doctrine's "when empty, it is
 * paper" line argues against marketing-CTAs on the empty surface,
 * not against minimal chrome affordances. A small icon button passes
 * the same museumsschild test the settings opener does — one
 * observational label, no imperative, no marketing.
 *
 * Visual contract:
 *   - `<button type="button">` with ≥ 24×24 hit target (P23 floor).
 *   - Container border-radius 0 (P9); chrome border-radius
 *     `var(--r-chrome)` 2 px on the button itself.
 *   - OKLCH colour only (P11). Token-resolved background +
 *     hairline border, matching the SettingsOverlay opener.
 *   - Sentence case label, lowercase (P14). String resolves through
 *     `ROOM.scan_trigger_label` per A25.
 *   - No emoji. The plus is an inline SVG (`<svg>`) sized 14×14
 *     within the 44×44 button — the same hit-target floor the
 *     settings opener uses.
 */

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { ROOM_SCAN_TRIGGER_LABEL } from "@/ai/room/voice";

export function RoomScanTrigger(): ReactElement {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={ROOM_SCAN_TRIGGER_LABEL}
      data-testid="pang-room-scan-trigger"
      onClick={() => router.push("/scan")}
      className="pointer-events-auto fixed left-4 top-[max(env(safe-area-inset-top),1rem)] z-40 grid h-11 min-w-11 place-items-center border border-hairline bg-paper-5 px-3 text-xs text-ink"
      style={{ borderRadius: "var(--r-chrome)" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M7 1.5V12.5M1.5 7H12.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
