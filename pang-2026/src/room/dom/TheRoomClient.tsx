"use client";
/**
 * PANG — The Room, client composition.
 *
 * Subscribes to the works store, projects entries into wall
 * positions via `layoutEntries()`, and renders the canvas + DOM
 * twin side by side. Focus is shared state in the works store:
 * canvas taps flow into the store via `onFocusChange`, twin
 * activations write to the store directly, and the arrival
 * chapter writes to the store on mount — all three paths end at
 * the same `focusedId` slice, and the canvas's imperative handle
 * is the single write point that drives the gesture state.
 *
 * This component is intentionally small — composition only. The
 * GL lifetime, RAF loop, gestures, and scene graph all live in
 * `src/room/**`; React is the adapter around them (Primitive §35
 * and § 1.5 of the architecture doc).
 */

import { useEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";
import { TheRoomCanvas } from "@/room/dom/TheRoomCanvas";
import type { TheRoomCanvasHandle } from "@/room/dom/TheRoomCanvas";
import { RoomDOMTwin } from "@/room/dom/RoomDOMTwin";
import { layoutEntries, useWorks } from "@/stores/works";

export function TheRoomClient(): ReactElement {
  const entries = useWorks((s) => s.entries);
  const focusedId = useWorks((s) => s.focusedId);
  const setFocusedId = useWorks((s) => s.setFocusedId);
  const works = useMemo(() => layoutEntries(entries), [entries]);

  const canvasRef = useRef<TheRoomCanvasHandle | null>(null);

  // Push the store's focus into the canvas whenever it changes.
  // The canvas's internal gesture state is the source of truth for
  // the RAF loop; this effect keeps it synchronised with store
  // writes (arrival chapter, twin, programmatic reveal) without
  // requiring every caller to know about the imperative handle.
  useEffect(() => {
    canvasRef.current?.focusWork(focusedId);
  }, [focusedId]);

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
          // Writing to the store is enough — the effect above
          // pushes the new value into the canvas. Keeping the
          // twin write on the store side (not the imperative
          // handle) keeps the one-way-data-flow story intact.
          setFocusedId(id);
        }}
      />
    </div>
  );
}
