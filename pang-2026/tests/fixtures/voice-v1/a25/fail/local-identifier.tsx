/**
 * A25 fixture — fail. A local `const` holding prose used as an
 * attribute. Not imported from a corpus, so A25 rejects it.
 */

const localLabel = "close the panel";

export function Component(): JSX.Element {
  return <button type="button" aria-label={localLabel} />;
}
