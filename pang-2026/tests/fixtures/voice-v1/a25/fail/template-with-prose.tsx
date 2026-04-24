/**
 * A25 fixture — fail. Template literal carrying prose in its quasis.
 * The prose belongs in a corpus; a template should only compose
 * corpus-sourced identifiers with punctuation.
 */

import { FIXTURE_CORPUS } from "../corpus/voice";

export function Component(): JSX.Element {
  return (
    <button
      type="button"
      aria-label={`Click to ${FIXTURE_CORPUS.label} now`}
    />
  );
}
