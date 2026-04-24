/**
 * A25 fixture — fail. Hardcoded `aria-label` — a common icon-button
 * regression. The label is the only way an assistive reader sees
 * the control; it must be corpus-sourced.
 */

export function Component(): JSX.Element {
  return (
    <button type="button" aria-label="Close">
      {"\u00D7"}
    </button>
  );
}
