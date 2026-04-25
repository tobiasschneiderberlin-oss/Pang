"use client";

/**
 * PANG — collection grid (iter #23 art-directed visual layer).
 *
 * Pinterest-style masonry. Each tile is a real image at the work's
 * actual aspect ratio; status reads as a hairline rule at the
 * bottom (verified vs pending). No text overlays on tiles — the
 * detail view (iter #23 `<FocusedWorkPanel>`) carries the metadata.
 *
 * Replaces iter #21's pastel SVG-text grid. The visual register is
 * Pinterest / Hinge / Glass — image-first, premium, considered.
 *
 * Tap a tile → `setFocusedId` on the works store. The detail view
 * mounts on the same focus model the canvas uses, so grid + space
 * + detail share a single focused-work surface.
 */

import { useMemo, type ReactElement } from "react";
import { useWorks, type CollectionEntry } from "@/stores/works";

const COLUMNS = 3;

export function RoomGrid(): ReactElement {
  const entries = useWorks((s) => s.entries);
  const focusedId = useWorks((s) => s.focusedId);
  const setFocusedId = useWorks((s) => s.setFocusedId);

  const columnArrays = useMemo(() => {
    const cols: CollectionEntry[][] = Array.from({ length: COLUMNS }, () => []);
    const heights = Array(COLUMNS).fill(0);
    for (const entry of entries) {
      const shortest = heights.indexOf(Math.min(...heights));
      cols[shortest]!.push(entry);
      // size = [width-m, height-m] → relative tile height contribution
      const aspect = entry.size[0] / entry.size[1];
      heights[shortest] += 1 / Math.max(aspect, 0.1);
    }
    return cols;
  }, [entries]);

  if (entries.length === 0) {
    // Empty state lives in its own component (`RoomEmpty`); the
    // page composes them. Returning null here keeps `<RoomGrid>`
    // single-purpose.
    return <RoomEmptyInline />;
  }

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 4rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
        paddingLeft: "max(env(safe-area-inset-left), 0.25rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.25rem)",
      }}
      data-testid="pang-grid"
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
      >
        {columnArrays.map((column, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {column.map((entry) => (
              <Tile
                key={entry.id}
                entry={entry}
                isFocused={focusedId === entry.id}
                onSelect={() => setFocusedId(entry.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile(props: {
  readonly entry: CollectionEntry;
  readonly isFocused: boolean;
  readonly onSelect: () => void;
}): ReactElement {
  const { entry, isFocused, onSelect } = props;
  const aspectRatio = entry.size[0] / entry.size[1];
  const verified = entry.status === "verified";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isFocused}
      aria-label={ariaLabelFor(entry)}
      data-testid="pang-grid-tile"
      data-status={entry.status}
      className="group relative w-full overflow-hidden bg-paper-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
      style={{
        borderRadius: "var(--r-tile)",
        aspectRatio: `${aspectRatio}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.imageUrl}
        alt=""
        className="block h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      {/* Status hairline at bottom — verified (warm sage) vs
       *  pending (warm amber). 1px, full-width, museum-precise. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "1px",
          background: verified
            ? "var(--hairline-verified)"
            : "var(--hairline-pending)",
        }}
      />
    </button>
  );
}

function ariaLabelFor(e: CollectionEntry): string {
  const snap = e.verificationHint?.artworkSnapshot;
  const name = snap?.title || `work ${e.id.slice(-6)}`;
  return e.status === "verified"
    ? `${name}, verified`
    : `${name}, awaiting verification`;
}

/**
 * Inline empty state — kept here to keep the grid file self-contained
 * for now. The page composes `<RoomGrid>` and gets either tiles or
 * this depending on entries.length.
 */
function RoomEmptyInline(): ReactElement {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
      data-testid="pang-grid-empty"
    >
      <div className="relative mb-8 h-72 w-60">
        {/* Three blurred placeholder cards — the "your collection is
         *  about to begin" gesture. No marketing line, just the
         *  visual cue that something belongs here. */}
        <div
          className="absolute left-0 top-8 h-56 w-44 -rotate-6 origin-bottom opacity-50"
          style={{
            borderRadius: "var(--r-hero)",
            background:
              "linear-gradient(135deg, var(--paper-5) 0%, var(--paper-10) 100%)",
            filter: "blur(4px)",
          }}
        />
        <div
          className="absolute right-0 top-8 h-56 w-44 rotate-6 origin-bottom opacity-50"
          style={{
            borderRadius: "var(--r-hero)",
            background:
              "linear-gradient(135deg, var(--paper-10) 0%, var(--paper-5) 100%)",
            filter: "blur(4px)",
          }}
        />
        <div
          className="absolute left-1/2 top-0 z-10 h-64 w-48 -translate-x-1/2 shadow-2xl"
          style={{
            borderRadius: "var(--r-hero)",
            background:
              "linear-gradient(135deg, var(--paper-10) 0%, var(--paper-5) 100%)",
          }}
        />
      </div>
      <h1 className="mb-3 max-w-xs text-balance text-2xl font-bold text-ink">
        your collection begins here
      </h1>
      <p className="mb-8 max-w-72 text-base leading-relaxed text-ink-muted">
        scan the first work to add it to your wall.
      </p>
    </div>
  );
}
