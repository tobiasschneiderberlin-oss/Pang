/**
 * A25 fixture — pass. Template literal whose substitutions resolve
 * to a corpus, with only punctuation in the quasis. The prose lives
 * in the corpus; this file is a compositor.
 */

import { FIXTURE_CORPUS } from "../corpus/voice";

export function Component(): JSX.Element {
  // Single-substitution template, passive quasis.
  return (
    <button
      type="button"
      aria-label={`${FIXTURE_CORPUS.aria.close}`}
      title={`${FIXTURE_CORPUS.label} — ${FIXTURE_CORPUS.aria.next}`}
    />
  );
}
