"use client";

/**
 * PANG — `<Diff>` primitive.
 *
 * When Laura edits an AI-suggested field, PANG must show the before /
 * after without chatter (Primitive §15, A15). A single strike-through
 * on the original with the new value to its right. No colour, no
 * toast, no "saved!" confirmation — the change is the confirmation.
 *
 * The component is dumb — it renders the transition. The commit lives
 * in the review screen's reducer. If `next` equals `previous` the
 * component renders `next` alone (no strike).
 */

import type { ReactElement } from "react";

export interface DiffProps {
  readonly previous: string | null;
  readonly next: string | null;
  readonly label?: string;
}

export function Diff(props: DiffProps): ReactElement {
  const { previous, next, label } = props;
  const same = previous === next;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs uppercase tracking-wide text-ink-ai">
          {label}
        </span>
      )}
      <span className="flex flex-wrap items-baseline gap-2 text-ink">
        {!same && previous !== null && (
          <span className="line-through text-ink-ai" aria-label="previous value">
            {previous}
          </span>
        )}
        <span aria-label="current value">{next ?? ""}</span>
      </span>
    </div>
  );
}
