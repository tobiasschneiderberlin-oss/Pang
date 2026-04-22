"use client";

/**
 * PANG — `<Confidence>` primitive.
 *
 * AI-authored text never renders unmarked (Primitive §15, A14). Every
 * field produced by the Intake Agent's P-LLM wears this wrapper. It
 * renders the value in PANG-Ambient gray (`text-ink-ai`) so the eye
 * reads *author* before *content*.
 *
 * Two variants:
 *   source="ai"       — the P-LLM authored it (default for intake)
 *   source="gallery"  — a verified gallery fact. Renders in `text-ink`
 *                       (the confident ink); a small tick sits to the
 *                       left.
 *
 * The optional `score` is a 0..1 confidence from the agent. Below
 * `0.75` we render the field at 70% opacity — a visual cue that Laura
 * should glance at it. No number, no progress bar; the ink carries
 * the signal.
 */

import type { ReactElement, ReactNode } from "react";

export interface ConfidenceProps {
  readonly source: "ai" | "gallery";
  readonly score?: number;
  readonly children: ReactNode;
  /** Optional label above the value, e.g. "artist" or "year". */
  readonly label?: string;
}

export function Confidence(props: ConfidenceProps): ReactElement {
  const soft = typeof props.score === "number" && props.score < 0.75;
  const tone =
    props.source === "gallery" ? "text-ink" : "text-ink-ai";
  return (
    <div className="flex flex-col gap-1">
      {props.label && (
        <span className="text-xs uppercase tracking-wide text-ink-ai">
          {props.label}
        </span>
      )}
      <span
        className={[tone, soft ? "opacity-70" : ""].join(" ").trim()}
        // The quarantined render surface is declared in
        // CAPABILITIES['render.ui.quarantined']; this primitive is the
        // *only* place that surface is drawn. The `data-*` attribute
        // lets the eval harness (A22) locate AI-authored regions.
        data-pang-source={props.source}
      >
        {props.source === "gallery" && (
          <span aria-hidden="true" className="mr-2">
            ·
          </span>
        )}
        {props.children}
      </span>
    </div>
  );
}
