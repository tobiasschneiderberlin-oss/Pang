"use client";

/**
 * PANG — artifact carrier.
 *
 * One document in the arrival chapter's procession — a certificate,
 * invoice, or condition report. Renders as a small museum-tag card
 * beside the work: a category label, then up to three extracted
 * field pairs rendered as `fieldName · value` lines.
 *
 * The carrier is *dumb*. It owns no state and no motion primitives;
 * the caller (`ArrivalChapter`) applies the opacity + subtle drift
 * via the beat envelope. A carrier is a scene fragment, not an
 * actor.
 *
 * Visual rules:
 *   - Sharp corners (P9 — containers have `border-radius: 0`).
 *   - 2px hairline border in `border-ink-ai` so the card reads as
 *     AI-assembled chrome, not collector-authored content.
 *   - Sentence-case label; `ALL CAPS` reserved for the category tag.
 *   - No heading level (the chapter's live region handles ARIA
 *     announcement); the carrier is visual reinforcement only.
 *
 * Copy rules mirror `voice.ts`:
 *   - Field keys are rendered verbatim from the extracted record —
 *     they came through `sanitize()` and are bounded strings.
 *   - Values sit inline, separated by a middle-dot. No truncation;
 *     the chapter layout already caps to three fields.
 */

import type { ReactElement } from "react";
import type { ChapterArtifact } from "@/ai/chapter";
import { BULLET_SEPARATOR } from "@/ai/chapter/voice";

export interface ArtifactCarrierProps {
  readonly artifact: ChapterArtifact;
  /**
   * Per-frame envelope from the chapter driver. Applied as opacity.
   * The fallback (undefined) renders fully opaque — useful in
   * Storybook-style previews.
   */
  readonly envelope?: number;
  /**
   * Per-frame progress from the chapter driver. Drives a tiny
   * vertical drift (≤ 8px) so the card reads as *settling*, not
   * *popping*. Zero is the settled resting position.
   */
  readonly progress?: number;
}

export function ArtifactCarrier(props: ArtifactCarrierProps): ReactElement {
  const opacity = clamp01(props.envelope ?? 1);
  const drift = typeof props.progress === "number"
    ? (1 - clamp01(props.progress)) * 8 // starts at +8px, settles to 0
    : 0;

  return (
    <div
      className="pointer-events-none flex w-64 max-w-[70vw] flex-col gap-2 border-[2px] border-ink-ai bg-paper p-4"
      style={{
        // A single border-radius override is prohibited (P9). Leave
        // sharp corners. Opacity + translate are the only inline
        // styles — both are per-frame state the chapter drives.
        opacity,
        transform: `translate3d(0, ${drift}px, 0)`,
      }}
      // The carrier is AI-assembled (the Q-LLM extracted the
      // fields, the P-LLM picked the category label). The data-*
      // attribute lets the eval harness locate the region and the
      // string-audit ignore the field keys as data, not UI copy.
      data-pang-source="ai"
      aria-hidden="true"
    >
      <span className="text-xs uppercase tracking-wide text-ink-ai">
        {props.artifact.label}
      </span>
      <ul className="flex flex-col gap-1 text-sm text-ink">
        {props.artifact.fields.map(([key, value]) => (
          <li key={key} className="flex gap-2">
            <span className="text-ink-ai">{key}</span>
            <span aria-hidden="true" className="text-ink-ai">
              {BULLET_SEPARATOR}
            </span>
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 1;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
