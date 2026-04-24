/**
 * A25 fixture — pass. A corpus-sourced function called inline.
 * The callee traces to a corpus module; the call result is accepted.
 */

import { FIXTURE_CORPUS } from "../corpus/voice";

const formatLabel = (s: string): string => s.toUpperCase();

export function Component(): JSX.Element {
  return (
    <button type="button" aria-label={FIXTURE_CORPUS.aria.close}>
      {FIXTURE_CORPUS.label /* corpus identifier used as JSX child */}
    </button>
  );
}

// `formatLabel` is a local helper (not a corpus). A25 rejects its
// use for user-facing attrs; the pass fixture above doesn't call it.
void formatLabel;
