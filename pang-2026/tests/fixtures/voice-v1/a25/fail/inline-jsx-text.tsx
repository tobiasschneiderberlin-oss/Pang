/**
 * A25 fixture — fail. Hardcoded JSX text. The most common regression
 * (a developer adds a new button under time pressure).
 */

export function Component(): JSX.Element {
  return (
    <button type="button">
      Sign in
    </button>
  );
}
