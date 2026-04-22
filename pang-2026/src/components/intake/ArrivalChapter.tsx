"use client";

/**
 * PANG — the arrival chapter.
 *
 * Where a newly-added work "hangs itself." The review frame animates
 * (via View Transitions, Primitive §3) into this surface. The work
 * occupies the full viewport on paper; a single line sits below it —
 * the P-LLM's `arrivalLine` — nothing else. No "added!" toast. No
 * "view in collection" button. The chapter *is* the confirmation.
 *
 * After ~1400ms the surface accepts a tap or swipe-up to return to
 * The Room. In iteration #4 the return transition animates the work
 * onto the spatial canvas at the correct wall slot.
 *
 * Iteration #1 ships this as a standalone page — no canvas behind
 * it, no audio, no haptics. The spine moment is the single line of
 * quiet confirmation, not chrome.
 */

import { useEffect, useState, type ReactElement } from "react";
import type { IntakeOutput } from "@/ai/tools/artwork";

export interface ArrivalChapterProps {
  readonly output: IntakeOutput;
  readonly imageBlobUrl: string;
  readonly onDone: () => void;
}

export function ArrivalChapter(props: ArrivalChapterProps): ReactElement {
  const [ready, setReady] = useState(false);

  // Wait one RAF + a small settling window before the tap affordance
  // appears. Laura has to *see* the work land before she can move on.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-paper p-8"
      aria-label="arrival"
      onPointerDown={ready ? props.onDone : undefined}
      style={{ viewTransitionName: "intake-frame" }}
    >
      <div
        className="relative flex max-h-[70vh] max-w-[90vw] items-center justify-center"
        style={{ viewTransitionName: "add-to-wall" }}
      >
        {/* The rectified capture. In iteration #4 this becomes a
            WebGPU-lit plane on the canvas, not an <img>. next/image
            is explicitly wrong here: the source is a short-lived
            blob: URL that never leaves the device, and lives only
            for the duration of the arrival transition before URL
            revocation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.imageBlobUrl}
          alt={props.output.artwork.title ?? "newly added work"}
          className="max-h-[70vh] max-w-[90vw] object-contain"
        />
      </div>

      {/* The one voice line. AI-authored; rendered in AI-ink. */}
      <p
        className="max-w-2xl text-center text-lg text-ink-ai"
        data-pang-source="ai"
      >
        {props.output.arrivalLine}
      </p>

      {ready && (
        <span
          className="absolute bottom-8 text-xs uppercase tracking-wide text-ink-ai"
          aria-hidden="true"
        >
          tap to return
        </span>
      )}
    </main>
  );
}
