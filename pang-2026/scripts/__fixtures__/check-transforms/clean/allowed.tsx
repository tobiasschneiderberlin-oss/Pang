// PANG — check-transforms fixture. Everything here is allowed:
//   - matrix(...) transforms (Three.js-adjacent, not the 2018
//     regression)
//   - a variable named `scaleFactor` — the word "scale" appears
//     but not as a CSS-transform call
//   - a line comment mentioning `transform: scale(2)` — comments
//     are stripped before the regex runs
//   - a block comment mentioning `scale-125`
//   - OSD-style config keys containing `scale`
const scaleFactor = 2;
const osdConfig = { navigatorSizeRatio: 0.2 };

/* Historical note: earlier prototypes abused transform: scale(2)
   on static images. See iteration #7 for the pivot to
   OpenSeadragon. */
export function Allowed(): JSX.Element {
  // Matrix transforms are fine — they are not the scale-family.
  return (
    <div
      style={{ transform: "matrix(1, 0, 0, 1, 0, 0)" }}
      data-scale-factor={scaleFactor}
      data-osd-ratio={osdConfig.navigatorSizeRatio}
    >
      matrix transforms are fine
    </div>
  );
}
