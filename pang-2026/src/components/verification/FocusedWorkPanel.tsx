"use client";

/**
 * PANG — the focused-work DOM panel.
 *
 * A small overlay that appears in the bottom-left quadrant when a
 * work is focused in The Room. Iteration #4 carries two things:
 *
 *   1. Artist / title plaque — one line each, museumsschild register.
 *   2. The AskGallery affordance (button, chip, or editor).
 *
 * The panel is decorative chrome, not a modal. It does not trap
 * focus, does not dim the canvas, and does not intercept gestures
 * outside its own box. Taps on the canvas outside the panel still
 * dismiss focus.
 *
 * The panel is wired purely through the works store: when
 * `focusedId` is null, the panel renders nothing; when it points at
 * an entry, the panel reads the entry's `verificationHint` for the
 * plaque and delegates the affordance to `<AskGallery />`.
 */

import type { ReactElement } from "react";
import { useWorks, type CollectionEntry } from "@/stores/works";
import { AskGallery } from "./AskGallery";

export function FocusedWorkPanel(): ReactElement | null {
  const focusedId = useWorks((s) => s.focusedId);
  const entries = useWorks((s) => s.entries);
  if (!focusedId) return null;
  const entry = entries.find((e) => e.id === focusedId);
  if (!entry) return null;
  return <Panel entry={entry} />;
}

function Panel(props: { readonly entry: CollectionEntry }): ReactElement {
  const hint = props.entry.verificationHint;
  const artist = hint?.artworkSnapshot.artist;
  const title = hint?.artworkSnapshot.title;
  const year = hint?.artworkSnapshot.year;

  return (
    <aside
      className="pointer-events-auto absolute bottom-8 left-8 flex max-w-sm flex-col gap-3 bg-paper p-4"
      style={{ borderRadius: 0 }}
      aria-label="focused work"
    >
      {(artist || title) && (
        <div className="flex flex-col">
          {artist && (
            <span className="text-sm text-ink" data-pang-source="intake">
              {artist}
            </span>
          )}
          {title && (
            <span className="text-xs italic text-ink-ai" data-pang-source="intake">
              {title}
              {year !== null && year !== undefined ? `, ${year}` : ""}
            </span>
          )}
        </div>
      )}
      <AskGallery entry={props.entry} />
    </aside>
  );
}
