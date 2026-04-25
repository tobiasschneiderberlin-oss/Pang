"use client";

/**
 * PANG — view-mode toggle (iter #21).
 *
 * Single chrome icon that flips the home view between `"grid"`
 * (default, conventional photo overview) and `"space"` (the WebGPU
 * Room canvas). Persists via OPFS through the preferences store —
 * a returning collector lands in their preferred mode.
 *
 * Position: top-right, just to the left of the settings opener.
 * Same visual contract as the settings + scan triggers (44×44 hit
 * target, 2 px chrome border-radius, OKLCH tokens, sentence case
 * label). Voice corpus resolves through `ROOM.view_toggle_label_*`
 * per A25 — the label reads as the *target* of the next tap, not
 * the current state.
 *
 * Doctrine link: PANG.md + PANG_Spine.md were updated in iter #21
 * to acknowledge the dual-mode home. Grid is the entry; the Room
 * is the depth on top.
 */

import { useCallback, type ReactElement } from "react";
import { usePreferences } from "@design/preferences";
import {
  ROOM_VIEW_TOGGLE_LABEL_TO_GRID,
  ROOM_VIEW_TOGGLE_LABEL_TO_SPACE,
} from "@/ai/room/voice";

export function RoomViewToggle(): ReactElement {
  const viewMode = usePreferences((s) => s.viewMode);
  const setPref = usePreferences((s) => s.set);

  const onToggle = useCallback(() => {
    setPref("viewMode", viewMode === "grid" ? "space" : "grid");
  }, [viewMode, setPref]);

  // The label names the *destination*: grid → "the room" (you tap
  // to enter the room); space → "the grid" (you tap to return).
  const label =
    viewMode === "grid"
      ? ROOM_VIEW_TOGGLE_LABEL_TO_SPACE
      : ROOM_VIEW_TOGGLE_LABEL_TO_GRID;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      data-testid="pang-room-view-toggle"
      data-mode={viewMode}
      className="pointer-events-auto fixed right-16 top-[max(env(safe-area-inset-top),1rem)] z-40 grid h-11 min-w-11 place-items-center border border-hairline bg-paper-5 px-3 text-xs text-ink"
      style={{ borderRadius: "var(--r-chrome)" }}
    >
      {viewMode === "grid" ? <SpaceIcon /> : <GridIcon />}
    </button>
  );
}

/** Three-line "room" cue — a small open-doorway glyph. */
function SpaceIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 12V4l5-2 5 2v8M2 12h10M5 12V8h4v4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Four-square grid glyph. */
function GridIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1.25" />
      <rect x="8" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2" y="8" width="4" height="4" stroke="currentColor" strokeWidth="1.25" />
      <rect x="8" y="8" width="4" height="4" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
