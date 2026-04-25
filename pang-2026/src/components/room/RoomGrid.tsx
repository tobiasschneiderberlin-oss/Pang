"use client";

/**
 * PANG — The Room, grid view (iter #21).
 *
 * Default home view. A scrollable CSS-grid of work tiles, the
 * familiar conventional pattern (Apple Photos / Google Photos) that
 * gives Laura an instant overview of every work in the collection.
 * The chrome (scan trigger top-left, view toggle + settings
 * top-right) is shared with the space view; only this body changes.
 *
 * The space view (`<TheRoomClientDynamic />`) remains one tap away
 * via the chrome view-toggle for collectors who want the immersive
 * WebGPU experience. Iter #21's pivot is that the grid is the
 * default, not the Room — the Room becomes the addition, not the
 * gating affordance.
 *
 * Visual contract:
 *   - CSS grid, `auto-fit minmax(140px, 1fr)`. On a phone (390 px
 *     viewport with 2 × 16 px gutter), that yields 2 columns with
 *     room to breathe; on a tablet (768 px) it lays out at 4–5
 *     columns automatically.
 *   - Sharp corners (P9) — containers are square; tiles inherit.
 *   - OKLCH only (P11) — all colour through tokens.
 *   - Sentence case labels (P14) — A25 corpus discipline.
 *   - No emoji, no marketing copy. Empty state is the same "an
 *     empty wall" sr-only landmark from `RoomDOMTwin`; the visible
 *     empty state is just a quiet line.
 *
 * Tap on a tile sets `focusedId` on the works store. The
 * `<FocusedWorkPanel>` (already mounted by `app/page.tsx`) reads
 * that and renders the focused chrome — same surface the Room
 * canvas focus uses, so grid and space views share a single focus
 * model.
 */

import type { ReactElement } from "react";
import {
  useWorks,
  type CollectionEntry,
} from "@/stores/works";

const EMPTY_LINE = "an empty wall";

export function RoomGrid(): ReactElement {
  const entries = useWorks((s) => s.entries);
  const focusedId = useWorks((s) => s.focusedId);
  const setFocusedId = useWorks((s) => s.setFocusedId);

  if (entries.length === 0) {
    return (
      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <p className="text-sm text-ink-muted" data-testid="pang-grid-empty">
          {EMPTY_LINE}
        </p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{
        // Safe-area-aware padding so tiles don't slide under the
        // chrome row at the top or the home indicator at the bottom.
        paddingTop: "calc(env(safe-area-inset-top) + 4rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
        paddingLeft: "max(env(safe-area-inset-left), 1rem)",
        paddingRight: "max(env(safe-area-inset-right), 1rem)",
      }}
      data-testid="pang-grid"
    >
      <ul
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() =>
                setFocusedId(focusedId === e.id ? null : e.id)
              }
              aria-pressed={focusedId === e.id}
              aria-label={ariaLabelFor(e)}
              data-testid="pang-grid-tile"
              data-status={e.status}
              className="group relative block w-full overflow-hidden bg-paper-5"
              style={{
                borderRadius: 0,
                aspectRatio: `${e.size[0]} / ${e.size[1]}`,
                outline:
                  focusedId === e.id ? "2px solid var(--ink)" : "none",
                outlineOffset: focusedId === e.id ? "-2px" : "0",
              }}
            >
              {/* Image fills the tile; object-cover so the work's
               *  aspect ratio dominates the framing. iter #21:
               *  bare `<img>` is intentional — works are
               *  user-captured blob URLs whose lifetime is owned by
               *  the works store; routing them through `<Image>` /
               *  the optimizer would either fail (blob URLs aren't
               *  remote images) or break the blob's reference
               *  semantics. The same source already feeds the
               *  Three.js texture path on the canvas; that path
               *  doesn't go through Next/Image either. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.imageUrl}
                alt=""
                className="block h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              {/* Status mark — a small dot bottom-right. Verified
               *  works carry a warm-emissive dot; unverified are
               *  outlined-empty. Same semantic as the canvas
               *  alive-vs-dormant rendering, in 2D. */}
              <span
                aria-hidden="true"
                className="absolute bottom-2 right-2 block h-2 w-2"
                style={{
                  borderRadius: "9999px",
                  background:
                    e.status === "verified" ? "var(--warmth)" : "transparent",
                  border: "1px solid var(--hairline)",
                }}
              />
            </button>
            {/* Visible label below the tile. Sentence case; voice
             *  register matches the canvas DOM twin. */}
            <p
              className="mt-2 truncate text-xs text-ink-muted"
              style={{ textAlign: "left" }}
            >
              {visibleLabelFor(e)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Aria-label for screen readers. Matches the `RoomDOMTwin` register —
 * status-first, observational, no marketing.
 */
function ariaLabelFor(e: CollectionEntry): string {
  return e.status === "verified"
    ? `work ${shortId(e.id)}`
    : `work ${shortId(e.id)}, awaiting verification`;
}

/**
 * Visible label below the tile. Prefers artist + title if the
 * verification hint snapshot carries them; falls back to a short
 * id-suffix line. Always sentence case.
 */
function visibleLabelFor(e: CollectionEntry): string {
  const snap = e.verificationHint?.artworkSnapshot;
  if (snap?.artist && snap.title) {
    return `${snap.artist.toLowerCase()} · ${snap.title.toLowerCase()}`;
  }
  if (snap?.artist) return snap.artist.toLowerCase();
  if (snap?.title) return snap.title.toLowerCase();
  return e.status === "verified"
    ? `work ${shortId(e.id)}`
    : "awaiting verification";
}

function shortId(id: string): string {
  return id.length > 6 ? id.slice(-6) : id;
}
