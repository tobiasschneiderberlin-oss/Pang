"use client";
/**
 * PANG — The Room, client composition.
 *
 * Subscribes to the works store, projects entries into wall
 * positions via `layoutEntries()`, and renders the canvas + DOM
 * twin side by side. Focus is a shared piece of state: canvas
 * taps flow into React via `onFocusChange`; twin activations flow
 * into the canvas via the imperative handle. Either path updates
 * the single `focusedId` state, and either path feels the same
 * to the collector.
 *
 * This component is intentionally small — composition only. The
 * GL lifetime, RAF loop, gestures, and scene graph all live in
 * `src/room/**`; React is the adapter around them (Primitive §35
 * and § 1.5 of the architecture doc).
 */

import { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { TheRoomCanvas } from "@/room/dom/TheRoomCanvas";
import type { TheRoomCanvasHandle } from "@/room/dom/TheRoomCanvas";
import { RoomDOMTwin } from "@/room/dom/RoomDOMTwin";
import { layoutEntries, useWorks } from "@/stores/works";

export function TheRoomClient(): ReactElement {
  const entries = useWorks((s) => s.entries);
  const works = useMemo(() => layoutEntries(entries), [entries]);

  const canvasRef = useRef<TheRoomCanvasHandle | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <div className="relative h-full w-full">
      <TheRoomCanvas
        ref={canvasRef}
        works={works}
        onFocusChange={setFocusedId}
      />
      <RoomDOMTwin
        entries={entries}
        focusedId={focusedId}
        onFocus={(id) => {
          canvasRef.current?.focusWork(id);
          // Mirror into React state immediately so the twin's
          // `aria-pressed` reflects the request without waiting
          // for the RAF loop's next `onFocusChange`. The loop
          // will re-announce the same value shortly after; the
          // React reconciler deduplicates.
          setFocusedId(id);
        }}
      />
    </div>
  );
}
