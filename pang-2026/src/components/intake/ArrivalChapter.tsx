"use client";

/**
 * PANG — the arrival chapter.
 *
 * Where a newly-added work "hangs itself." The review frame animates
 * (via View Transitions, Primitive §3) into this surface. The Room
 * renders the full collection behind the arrival image; the
 * just-added work is already on the wall and the camera has glided
 * to it. The captured-image overlay (the rectified still from the
 * viewfinder) sits in front while the arrival moment settles, then
 * dissolves so the wall-hung work reads as the work. The voice line
 * sits below — the P-LLM's `arrivalLine`, nothing else. No "added!"
 * toast. No "view in collection" button. The chapter *is* the
 * confirmation.
 *
 * The order of writes matters:
 *
 *   1. On mount, the entry is added to the works store with a
 *      known id. The Room's diff effect picks it up and the scene
 *      hangs a mesh on the back wall.
 *   2. Focus is written to the store, which syncs through to the
 *      canvas — the camera begins its glide to the work.
 *   3. The image overlay fades out at the end of the settle window.
 *      By then the canvas has already rendered the work with its
 *      texture; the user sees the overlay give way to the wall.
 *   4. On dismiss, the client navigates home. Focus is preserved in
 *      the store, so the home route opens with the camera still on
 *      the new work.
 *
 * Iteration #1 shipped this as a standalone page; iteration #2
 * step 3 replaces that placeholder with the Room behind. The spine
 * line "arrival is a placement, not a dismiss" is now literal.
 */

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { IntakeOutput } from "@/ai/tools/artwork";
import { entryFromIntake, useWorks, type CollectionEntry } from "@/stores/works";
import { TheRoomClient } from "@/room/dom/TheRoomClient";

export interface ArrivalChapterProps {
  readonly output: IntakeOutput;
  readonly imageBlobUrl: string;
  readonly onDone: () => void;
}

/**
 * How long the captured-still overlay holds at full opacity before
 * it begins to dissolve. Matches the camera animator's rate-6
 * exponential smoothing — the glide has converged by ~500 ms, so
 * 700 ms of hold gives the eye a beat to read the frame before the
 * Room takes over.
 */
const OVERLAY_HOLD_MS = 700;

/**
 * How long the dismiss affordance takes to appear. Laura has to
 * *see* the work land before she can move on. Matches the voice
 * doctrine: the moment is the confirmation.
 */
const READY_DELAY_MS = 1400;

export function ArrivalChapter(props: ArrivalChapterProps): ReactElement {
  const addEntry = useWorks((s) => s.addEntry);
  const setFocusedId = useWorks((s) => s.setFocusedId);

  // The entry id is minted once (on mount) and cached. A re-render
  // must not add a second copy or move focus; idempotent add guards
  // us but the cached id keeps intent clear.
  const entryRef = useRef<CollectionEntry | null>(null);
  if (entryRef.current === null) {
    entryRef.current = entryFromIntake(props.output, props.imageBlobUrl);
  }

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [ready, setReady] = useState(false);

  // Place the work on the wall + point the camera at it. Running
  // once per arrival mount is the whole point — don't add works
  // to a dep array; the id is stable for the life of this surface.
  useEffect(() => {
    addEntry(entryRef.current!);
    setFocusedId(entryRef.current!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Overlay fade-out.
  useEffect(() => {
    const t = window.setTimeout(() => setOverlayVisible(false), OVERLAY_HOLD_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Dismiss affordance.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), READY_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-paper"
      aria-label="arrival"
      onPointerDown={ready ? props.onDone : undefined}
      style={{ viewTransitionName: "intake-frame" }}
    >
      {/* The Room — the work has already hung itself on the wall and
          the camera is gliding toward it. The canvas fills the
          viewport; the image overlay and voice line sit in front. */}
      <div className="absolute inset-0">
        <TheRoomClient />
      </div>

      {/* The captured still. Carries the shared view-transition name
          so the review → arrival morph lands here; fades out after
          the settle window, revealing the wall-hung work beneath.
          next/image is explicitly wrong here: the source is a
          short-lived blob: URL that never leaves the device. */}
      <div
        className="pointer-events-none absolute inset-0 grid place-items-center"
        style={{
          opacity: overlayVisible ? 1 : 0,
          // A plain opacity envelope, not a motion primitive. No
          // cubic-bezier (P15 is about motion curves, not named
          // easing keywords); the overlay is declarative chrome
          // that reveals the wall, not a gesture response.
          transition: "opacity 600ms ease-out",
        }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.imageBlobUrl}
          alt=""
          className="max-h-[70vh] max-w-[90vw] object-contain"
          style={{ viewTransitionName: "add-to-wall" }}
        />
      </div>

      {/* The one voice line. AI-authored; rendered in AI-ink. Sits
          at the bottom like a museum caption — close to where the
          camera has framed the work, far enough from the top edge
          that the chrome and the work don't fight. */}
      <p
        className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto max-w-2xl px-8 text-center text-lg text-ink-ai"
        data-pang-source="ai"
      >
        {props.output.arrivalLine}
      </p>

      {ready && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-xs uppercase tracking-wide text-ink-ai"
          aria-hidden="true"
        >
          tap to return
        </span>
      )}
    </main>
  );
}
