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
      className="pointer-events-auto fixed right-16 top-[max(env(safe-area-inset-top),1rem)] z-40 grid h-11 w-11 place-items-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur-md transition active:scale-95"
    >
      {viewMode === "grid" ? <SpaceIcon /> : <GridIcon />}
    </button>
  );
}

/** Three-line "room" cue — a small open-doorway glyph. */
function SpaceIcon(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 21V8l9-4 9 4v13M3 21h18M9 21v-7h6v7"
        stroke="currentColor"
        strokeWidth="1.75"
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
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
