// PANG — check-transforms fixture. Simulates the 2018 regression:
// a CSS transform: scale(2) on a flat image, which is exactly what
// the scanner must catch. Not wired into the app.
export function BadCssTransform(): JSX.Element {
  return (
    <div
      style={{ transform: "scale(2)" }}
    >
      flat image pretending to zoom
    </div>
  );
}
