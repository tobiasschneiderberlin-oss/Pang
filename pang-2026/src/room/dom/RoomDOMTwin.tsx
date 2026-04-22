"use client";
/**
 * PANG — the canvas DOM twin.
 *
 * A screen-reader-navigable list that shadows the spatial canvas.
 * The canvas itself carries `role="presentation"` because the
 * depth, lighting, and gestures are not meaningful to an assistive
 * technology; the twin carries the a11y tree. Activating a twin
 * button drives canvas focus through the imperative handle — same
 * destination pose as a finger tap.
 *
 * Why a twin, not ARIA on the canvas:
 *   - A `<canvas>` is a single opaque node to a screen reader; ARIA
 *     properties on it describe the canvas, not its contents.
 *   - The Accessible Object Model (AOM) phase-4 would let the
 *     canvas publish a virtual a11y tree, but AOM is not shipped
 *     (P23). The twin is the shipped 2026 pattern.
 *   - The twin has its own keyboard tree; Tab/Enter/Arrow behave
 *     as HTML defaults, which is richer than any canvas-level
 *     focus grammar could be.
 *
 * The twin is visually invisible but not `aria-hidden`. It lives
 * in the same parent as the canvas so focus-order is adjacent.
 */

import type { ReactElement } from "react";
import type { CollectionEntry } from "@/stores/works";

export interface RoomDOMTwinProps {
  readonly entries: readonly CollectionEntry[];
  readonly focusedId: string | null;
  readonly onFocus: (id: string | null) => void;
}

export function RoomDOMTwin({
  entries,
  focusedId,
  onFocus,
}: RoomDOMTwinProps): ReactElement {
  return (
    <nav
      aria-label="your works"
      // `sr-only` equivalent — off-screen but still in the focus
      // tree and announced. Not `display: none` (which would strip
      // it from the a11y tree) and not `aria-hidden` (which would
      // hide it from screen readers while still appearing).
      className="absolute left-0 top-0 h-px w-px overflow-hidden whitespace-nowrap"
      style={{ clip: "rect(0 0 0 0)", clipPath: "inset(50%)" }}
    >
      {entries.length === 0 ? (
        // Empty wall: still announce the landmark so the SR user
        // knows the canvas has *a* structure, even when empty.
        // The phrasing is the register: no CTA, no coaching.
        <p>an empty wall</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={focusedId === e.id}
                onClick={() => {
                  // If already focused, a second activation returns
                  // to the wall overview — same as tapping empty
                  // space in the canvas.
                  onFocus(focusedId === e.id ? null : e.id);
                }}
              >
                {labelFor(e)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

/**
 * Announce label for a twin button. Minimal, register-compliant.
 * Artist/title become richer when the full `CollectionEntry`
 * carries them (post-intake wiring); today the twin sees only the
 * Room-level projection (id + status), so the status reads as the
 * primary cue.
 */
function labelFor(e: CollectionEntry): string {
  // Voice register: no evaluative language, no marketing.
  // "work awaiting verification" / "verified work" — short, Museumsschild.
  return e.status === "verified"
    ? `work ${shortId(e.id)}`
    : `work ${shortId(e.id)}, awaiting verification`;
}

/** Last six characters of the id, for a compact SR-friendly suffix. */
function shortId(id: string): string {
  return id.length > 6 ? id.slice(-6) : id;
}
