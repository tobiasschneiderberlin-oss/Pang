/**
 * A25 fixture — pass. Direct corpus import, used as both JSX text
 * and a user-facing attribute. The canonical shape.
 */

import { FIXTURE_CORPUS } from "../corpus/voice";

export function Component(): JSX.Element {
  return (
    <button type="button" title={FIXTURE_CORPUS.title} aria-label={FIXTURE_CORPUS.aria.close}>
      {FIXTURE_CORPUS.label}
    </button>
  );
}
